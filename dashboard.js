// Constantes de Comissão
const COMMISSION_RATE = 0.01; // R$ 0,01 por unidade acima da meta (chapa)

// --- Configuração das Máquinas (Com duplas fixas de operadores) ---
const machineConfig = {
    'SCM': {
        name: 'SCM (Seccionadora)',
        unit: 'Peças',
        rateLabel: 'Peças/H',
        defaultTarget: 500,
        isCommissionable: true,
        numOperators: 2,
        operators: ['Dionei', 'Alvaro'] // Dupla Fixa
    },
    'Giben': {
        name: 'Giben (Seccionadora)',
        unit: 'Peças',
        rateLabel: 'Peças/H',
        defaultTarget: 500,
        isCommissionable: true,
        numOperators: 2,
        operators: ['Davi', 'Iago'] // Dupla Fixa
    },
    'Romani': {
        name: 'Homag (Coladeira)',
        unit: 'Metros',
        rateLabel: 'Metros/H',
        defaultTarget: 2500,
        isCommissionable: false,
        numOperators: 2,
        operators: ['Leandro', 'Natan'] // Dupla Fixa
    },
};
const machineList = Object.keys(machineConfig);
let currentMachine = machineList[0];
let maxDailyTarget = 0; // Será carregado do localStorage ou default
let currentContentTab = 'dashboard';

let productivityChart = null;
let allRecords = []; // Armazena todos os registros em memória

// Elementos do DOM
const machineTabsContainer = document.getElementById('machine-tabs');
const currentTargetDisplay = document.getElementById('current-target');
const targetForm = document.getElementById('target-form');
const targetInput = document.getElementById('target-input');
const productionForm = document.getElementById('production-form');
const recordsTableBody = document.getElementById('records-table-body');
const currentMachineTitle = document.getElementById('current-machine-title');
const commissionSummaryBody = document.getElementById('commission-summary-body');

// Elementos de Abas
const contentDashboard = document.getElementById('content-dashboard');
const contentReport = document.getElementById('content-report');

// Elementos que mudam dinamicamente
const targetUnitDisplay = document.getElementById('target-unit-display');
const metersLabel = document.getElementById('meters-label');
const chartMainLabel = document.getElementById('chart-main-label');
const tableMainMetricHeader = document.getElementById('table-main-metric-header');

// Elementos dos Operadores (Display e Hidden Input)
const operator1Display = document.getElementById('operator1-display');
const operator2Display = document.getElementById('operator2-display');
const operator1Input = document.getElementById('operator1');
const operator2Input = document.getElementById('operator2');

// Elementos do Modal de Confirmação
const confirmationModal = document.getElementById('confirmation-modal');
const cancelDeleteButton = document.getElementById('cancel-delete');
const confirmDeleteButton = document.getElementById('confirm-delete');
let deleteCallback = null;

// Função de Alerta Customizada
const showAlert = (message, type = 'info') => {
    const container = document.getElementById('alert-container');
    const alertDiv = document.createElement('div');
    let bgColor = 'bg-blue-100';
    let textColor = 'text-blue-800';
    let icon = 'ℹ️';

    if (type === 'success') {
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
        icon = '✅';
    } else if (type === 'error') {
        bgColor = 'bg-red-100';
        textColor = 'text-red-800';
        icon = '❌';
    }

    alertDiv.className = `${bgColor} ${textColor} p-3 rounded-lg shadow-md max-w-sm transition-opacity duration-300 opacity-0`;
    alertDiv.innerHTML = `<div class="flex items-center"><span class="mr-2">${icon}</span><span>${message}</span></div>`;

    container.prepend(alertDiv);

    // Fade in
    setTimeout(() => alertDiv.style.opacity = '1', 10);

    // Fade out and remove
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
};

// Função para mostrar o modal de confirmação
const showConfirmationModal = (callback) => {
    deleteCallback = callback;
    confirmationModal.classList.remove('hidden');
    confirmationModal.classList.add('flex');
};

// Lógica de exclusão e modal
cancelDeleteButton.onclick = () => {
    confirmationModal.classList.add('hidden');
    confirmationModal.classList.remove('flex');
    deleteCallback = null;
};

confirmDeleteButton.onclick = () => {
    if (deleteCallback) {
        deleteCallback();
    }
    confirmationModal.classList.add('hidden');
    confirmationModal.classList.remove('flex');
    deleteCallback = null;
};

// --- Operações de Dados em Memória / LocalStorage ---

// Salvar/Atualizar a Meta de Produtividade (Persistência via LocalStorage)
const saveTargetProductivity = (newTarget) => {
    maxDailyTarget = newTarget;
    currentTargetDisplay.textContent = newTarget.toLocaleString('pt-BR');
    localStorage.setItem(`target_${currentMachine}`, newTarget);
    showAlert(`Meta de produtividade para ${currentMachine} atualizada para ${newTarget} ${machineConfig[currentMachine].unit}/dia.`, 'success');
    renderUI();
};

// Carregar a Meta de Produtividade (Persistência via LocalStorage)
const fetchCurrentTarget = () => {
    const config = machineConfig[currentMachine];
    const storedTarget = localStorage.getItem(`target_${currentMachine}`);

    // Tenta carregar do localStorage, senão usa a meta padrão
    const newTarget = storedTarget ? parseFloat(storedTarget) : config.defaultTarget;

    maxDailyTarget = newTarget;
    currentTargetDisplay.textContent = newTarget.toLocaleString('pt-BR');

    // Salva o valor padrão se não existir no localStorage
    if (!storedTarget) {
        localStorage.setItem(`target_${currentMachine}`, newTarget);
    }
};


// Salvar um Novo Registro de Produção/Entrega (Em memória)
const saveProductionRecord = (record) => {
    // Adiciona um ID único e timestamp para simular o Firestore
    const newRecord = {
        ...record,
        id: crypto.randomUUID(),
        timestamp: Date.now()
    };

    allRecords.push(newRecord);

    showAlert("Registro de produção/entrega salvo com sucesso! (Em memória)", 'success');
    productionForm.reset();
    document.getElementById('date').valueAsDate = new Date();
    setupOperatorFields(currentMachine); // Garante que os valores hidden estejam corretos após o reset

    renderUI(); // Re-renderiza a UI com os novos dados
};

// Deletar um Registro (Em memória)
const deleteRecord = (recordId) => {
    showConfirmationModal(() => {
        const initialLength = allRecords.length;
        allRecords = allRecords.filter(r => r.id !== recordId);

        if (allRecords.length < initialLength) {
            showAlert("Registro deletado com sucesso. (Em memória)", 'success');
            renderUI();
        } else {
            showAlert("Erro ao deletar: Registro não encontrado.", 'error');
        }
    });
};

// --- Geração de Dados Fictícios Estáticos ---

const generateDummyData = () => {
    const dummyRecords = [];
    const endDate = new Date();

    for (let i = 0; i < 30; i++) {
        const machineName = machineList[i % machineList.length];
        const config = machineConfig[machineName];
        const [op1, op2] = config.operators; // Usa a dupla fixa

        const date = new Date(endDate);
        date.setDate(endDate.getDate() - Math.floor(i / machineList.length));
        const formattedDate = date.toISOString().split('T')[0];

        let meters, deliveredQuantity;
        const target = config.defaultTarget; // Usado para cálculo do dummy data

        if (machineName === 'Romani') {
            // Coladeira (Metros) - Sem comissão por unidade bônus
            meters = Math.round((Math.random() * 800) + 2000);
            deliveredQuantity = Math.round((Math.random() * 200) + 400);
        } else {
            // SCM/Giben (Peças) - Comissionável
            const targetOffset = (i % 5 === 0) ? -100 : 50; // Alguns abaixo da meta, a maioria acima
            meters = Math.round(target + targetOffset + (Math.random() * 50));
            // Quantidade entregue (Entre 70% e 100% do produzido)
            deliveredQuantity = Math.round(meters * (0.7 + Math.random() * 0.3));
        }

        const hours = parseFloat(((Math.random() * 2.5) + 7.5).toFixed(1));

        // --- CÁLCULO DA COMISSÃO: min(produção acima da meta, qtd entregue) ---
        let commissionUnits = 0;
        let totalCommission = 0;

        if (config.isCommissionable) {
            // 1. Unidades produzidas acima da meta
            const potentialBonusUnits = Math.max(0, meters - target);

            // 2. Unidades comissionáveis: o mínimo entre o potencial e o que foi entregue.
            commissionUnits = Math.min(potentialBonusUnits, deliveredQuantity);
            totalCommission = commissionUnits * COMMISSION_RATE;
        }

        const newRecord = {
            id: crypto.randomUUID(),
            machine: machineName,
            date: formattedDate,
            meters: meters,
            hours: hours,
            deliveredQuantity: deliveredQuantity,
            productivity_m_h: meters / hours,
            productivity_percent: (meters / target) * 100,
            operator1: op1, // Usa operador fixo
            operator2: op2, // Usa operador fixo
            commissionUnits: commissionUnits,
            totalCommission: totalCommission,
            timestamp: Date.now() - (i * 1000)
        };

        dummyRecords.push(newRecord);
    }
    allRecords = dummyRecords; // Carrega dados estáticos na memória
};


// --- Visualização de Dados e Atualização da UI ---

const setupOperatorFields = (machineName) => {
    const config = machineConfig[machineName];

    // Assegura que a dupla é sempre 2 
    const op1 = config.operators[0];
    const op2 = config.operators[1];

    // Atualiza os elementos de display (visíveis)
    operator1Display.textContent = op1;
    operator2Display.textContent = op2;

    // Atualiza os inputs hidden (para submissão do formulário)
    operator1Input.value = op1;
    operator2Input.value = op2;
};

const updateUIMetrics = (machineName) => {
    const config = machineConfig[machineName];

    // 1. Meta Diária
    targetUnitDisplay.textContent = `${config.unit}/dia`;
    targetInput.placeholder = `Nova Meta (${config.unit})`;

    // 2. Formulário
    metersLabel.textContent = `${config.unit} Produzidos (${config.unit.toLowerCase().charAt(0)})`;

    // 3. Gráfico
    chartMainLabel.textContent = config.unit;

    // 4. Tabela
    tableMainMetricHeader.textContent = `${config.unit} (${config.unit.toLowerCase().charAt(0)})`;

    currentMachineTitle.textContent = config.name;

    // 5. Operadores Fixos
    setupOperatorFields(machineName);
};


// Função para agregar dados por Máquina e Data para o gráfico
const aggregateDataForChart = (records, machine) => {
    const filteredRecords = records.filter(r => r.machine === machine);
    const config = machineConfig[machine];

    const aggregated = filteredRecords.reduce((acc, record) => {
        const key = record.date;

        if (!acc[key]) {
            acc[key] = {
                date: record.date,
                totalMeters: 0,
                totalDelivered: 0,
            };
        }

        acc[key].totalMeters += record.meters;
        acc[key].totalDelivered += record.deliveredQuantity;

        return acc;
    }, {});

    // Ordena por data
    const sortedData = Object.values(aggregated).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Prepara arrays para Chart.js
    const labels = sortedData.map(item => item.date);
    const metersData = sortedData.map(item => item.totalMeters);
    const deliveredQuantityData = sortedData.map(item => item.totalDelivered);

    return { labels, metersData, deliveredQuantityData, unit: config.unit };
};


// Função para renderizar o Gráfico de Linhas (Métrica Principal vs. Quantidade Entregue)
const renderChart = (data) => {
    if (productivityChart) {
        productivityChart.destroy();
    }

    const ctx = document.getElementById('productivityChart').getContext('2d');
    productivityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: `${data.unit} Produzidos`,
                    data: data.metersData,
                    borderColor: '#3b82f6', // blue-500
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Quantidades Entregues (unid.)',
                    data: data.deliveredQuantityData,
                    borderColor: '#10b981', // emerald-500 
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    fill: false,
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: `${data.unit} Produzidos`
                    },
                    min: 0
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                    },
                    title: {
                        display: true,
                        text: 'Quantidades Entregues (unid.)'
                    },
                    min: 0
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: `Desempenho Diário da Máquina: ${currentMachine}`
                }
            }
        }
    });
};

// Renderiza o Relatório de Comissões (Divide por 2)
const renderCommissionReport = (records) => {
    const filteredRecords = records.filter(r => r.machine === currentMachine);
    const config = machineConfig[currentMachine];
    commissionSummaryBody.innerHTML = '';

    if (!config.isCommissionable) {
        commissionSummaryBody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-500">A máquina ${currentMachine} não paga comissão por Unidade Bônus.</td></tr>`;
        return;
    }

    const operatorTotals = {};

    // 1. Agrega o total de comissão por operador
    filteredRecords.forEach(record => {
        const commission = record.totalCommission || 0;

        // Divide a comissão total igualmente entre os 2 operadores para este registro
        const commissionPerOperator = commission / config.numOperators;

        // Adiciona ao total de cada operador
        const op1 = record.operator1 || 'Operador 1 Não Nomeado';
        const op2 = record.operator2 || 'Operador 2 Não Nomeado';

        operatorTotals[op1] = (operatorTotals[op1] || 0) + commissionPerOperator;
        operatorTotals[op2] = (operatorTotals[op2] || 0) + commissionPerOperator;
    });

    // 2. Cria as linhas do relatório
    // Filtra e remove operadores com comissão zero 
    const operators = Object.keys(operatorTotals)
        .filter(op => operatorTotals[op] > 0 || filteredRecords.some(r => r.operator1 === op || r.operator2 === op))
        .sort();

    if (operators.length === 0) {
        commissionSummaryBody.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-500">Nenhum registro comissionável encontrado para esta máquina.</td></tr>`;
        return;
    }

    operators.forEach(operator => {
        const totalCommission = operatorTotals[operator] || 0;
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${operator}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${totalCommission > 0 ? 'text-green-600' : 'text-gray-500'}">
                        ${totalCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                `;
        commissionSummaryBody.appendChild(row);
    });
};


// Função para renderizar os dados na tabela do Dashboard
const renderDashboardData = (records, maxTarget) => {
    const filteredRecords = records
        .filter(r => r.machine === currentMachine)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    recordsTableBody.innerHTML = '';

    if (filteredRecords.length === 0) {
        recordsTableBody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">Nenhum registro encontrado para esta máquina.</td></tr>';
    }

    filteredRecords.forEach(record => {
        const productivity_percent = ((record.meters / maxTarget) * 100).toFixed(1);

        // DADOS DE COMISSÃO
        const commissionTotal = record.totalCommission || 0;
        const commissionUnits = record.commissionUnits || 0;
        const commissionColor = commissionTotal > 0 ? 'text-green-600 font-semibold' : 'text-gray-500';

        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${record.date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${record.meters.toLocaleString('pt-BR')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${record.operator1} / ${record.operator2}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">${commissionUnits.toLocaleString('pt-BR')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${commissionColor}">${commissionTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm ${productivity_percent >= 100 ? 'text-green-600' : 'text-red-500'} font-semibold">${productivity_percent}%</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">${record.deliveredQuantity.toLocaleString('pt-BR')}</td> 
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="text-red-600 hover:text-red-900 transition duration-150" onclick="window.deleteRecord('${record.id}')">Deletar</button>
                    </td>
                `;
        recordsTableBody.appendChild(row);
    });

    // Agrega os dados e atualiza o gráfico
    const chartData = aggregateDataForChart(records, currentMachine);
    renderChart(chartData);

    // Atualiza os rótulos dinâmicos da UI
    updateUIMetrics(currentMachine);
};

// Função principal de renderização que controla as abas
const renderUI = () => {
    fetchCurrentTarget(); // Garante que a meta mais recente seja usada

    // 1. Renderiza o conteúdo da aba ativa
    if (currentContentTab === 'dashboard') {
        renderDashboardData(allRecords, maxDailyTarget);
    } else if (currentContentTab === 'report') {
        renderCommissionReport(allRecords);
    }
}

// --- Inicialização e Eventos ---

// Função para alternar a máquina selecionada
const switchMachine = (machineName) => {
    currentMachine = machineName;

    // Atualiza o visual dos botões da máquina
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.machine === machineName) {
            btn.classList.add('active');
        }
    });

    // Atualiza a meta, operadores fixos e re-renderiza a UI
    renderUI();
};

// Função para alternar a aba de conteúdo (Dashboard/Relatório)
const switchContentTab = (tabName) => {
    currentContentTab = tabName;

    // Atualiza o visual das abas de conteúdo
    document.querySelectorAll('.content-tab-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // Alterna a visibilidade dos containers
    contentDashboard.classList.add('hidden');
    contentReport.classList.add('hidden');

    if (tabName === 'dashboard') {
        contentDashboard.classList.remove('hidden');
    } else if (tabName === 'report') {
        contentReport.classList.remove('hidden');
    }

    renderUI(); // Re-renderiza o conteúdo da aba selecionada
};

// Expor a função switchContentTab para uso no HTML onclick
window.switchContentTab = switchContentTab;


// Renderiza os botões das máquinas
const setupMachineTabs = () => {
    machineTabsContainer.innerHTML = '';
    machineList.forEach(machine => {
        const button = document.createElement('button');
        button.textContent = machineConfig[machine].name;
        button.dataset.machine = machine;
        button.className = `tab-button px-4 py-2 rounded-lg transition duration-150 text-gray-700 bg-gray-200 hover:bg-gray-300 font-medium shadow-sm`;
        if (machine === currentMachine) {
            button.classList.add('active');
        }
        button.onclick = () => switchMachine(machine);
        machineTabsContainer.appendChild(button);
    });
    updateUIMetrics(currentMachine);
};

// Lógica de submissão do formulário de Produção/Entrega
productionForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const date = document.getElementById('date').value;
    const metersInput = document.getElementById('meters');
    const hoursInput = document.getElementById('hours');
    const deliveredQuantityInput = document.getElementById('delivered-quantity');

    // Operadores são lidos dos campos hidden, que são atualizados via setupOperatorFields
    const operator1 = operator1Input.value;
    const operator2 = operator2Input.value;

    const meters = parseInt(metersInput.value);
    const hours = parseFloat(hoursInput.value);
    const deliveredQuantity = parseInt(deliveredQuantityInput.value);

    const config = machineConfig[currentMachine];

    if (!date || isNaN(meters) || isNaN(hours) || isNaN(deliveredQuantity) || hours <= 0 || meters < 0 || deliveredQuantity < 0) {
        showAlert("Por favor, insira valores válidos (Métrica Principal >= 0, Horas > 0, Quantidade Entregue >= 0).", 'error');
        return;
    }

    // --- CÁLCULO DA COMISSÃO (Regra: min(produção acima da meta, qtd entregue)) ---
    let commissionUnits = 0;
    let totalCommission = 0;
    if (config.isCommissionable) {
        // 1. Unidades produzidas acima da meta
        const potentialBonusUnits = Math.max(0, meters - maxDailyTarget);

        // 2. Unidades comissionáveis: o mínimo entre o potencial e o que foi entregue.
        commissionUnits = Math.min(potentialBonusUnits, deliveredQuantity);
        totalCommission = commissionUnits * COMMISSION_RATE;
    }

    const productivity_m_h = meters / hours;
    const productivity_percent = (meters / maxDailyTarget) * 100;

    const newRecord = {
        machine: currentMachine,
        date: date,
        meters: meters,
        hours: hours,
        deliveredQuantity: deliveredQuantity,
        productivity_m_h: productivity_m_h,
        productivity_percent: productivity_percent,
        // CAMPOS DE COMISSÃO
        operator1: operator1,
        operator2: operator2,
        commissionUnits: commissionUnits,
        totalCommission: totalCommission,
    };

    saveProductionRecord(newRecord);
});

// Lógica de submissão do formulário da Meta
targetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newTarget = parseFloat(targetInput.value);
    const config = machineConfig[currentMachine];

    if (isNaN(newTarget) || newTarget < 10) {
        showAlert(`Por favor, insira uma meta válida (mínimo 10 ${config.unit}/Dia).`, 'error');
        return;
    }

    saveTargetProductivity(newTarget);
});

// Expor a função deleteRecord para uso no HTML onclick
window.deleteRecord = deleteRecord;

const initApp = async () => {
    // 1. Gera dados fictícios para começar
    generateDummyData();

    // 2. Configura os botões de máquina
    setupMachineTabs();

    // 3. Configura os campos de operador com a dupla fixa inicial
    setupOperatorFields(currentMachine);

    // 4. Carrega a meta da máquina inicial e renderiza a UI
    renderUI();

    // 5. Define a data padrão
    document.getElementById('date').valueAsDate = new Date();
};

// Inicia a aplicação no carregamento da janela
window.onload = initApp;