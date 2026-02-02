// DOM Elements
const elements = {
    capTKSlop: document.getElementById('cap-tkslop'),
    volTKSlop: document.getElementById('init-vol-tkslop'),
    percTKSlop: document.getElementById('level-percent-tkslop'),
    tvrTKSlop: document.getElementById('tvr-tkslop'),

    capTK002: document.getElementById('cap-tk002'),
    volTK002: document.getElementById('init-vol-tk002'),
    heightTK002: document.getElementById('height-mm-tk002'),
    mmTK002: document.getElementById('level-mm-tk002'),
    tvrTK002: document.getElementById('tvr-tk002'),

    transferAmount: document.getElementById('transfer-amount'),
    transferPercent: document.getElementById('transfer-percent'),

    fillTK002: document.getElementById('fill-tk002'),
    fillTKSlop: document.getElementById('fill-tkslop'),
    textTK002: document.getElementById('level-text-tk002'),
    textTKSlop: document.getElementById('level-text-tkslop'),
    valTK002: document.getElementById('vol-tk002'),
    valTKSlop: document.getElementById('vol-tkslop'),

    flowIndicator: document.getElementById('flow-indicator'),

    totalVol: document.getElementById('total-vol'),
    mixtureTVR: document.getElementById('mixture-tvr'),

    startBtn: document.getElementById('start-btn'),
    currentDate: document.getElementById('current-date')
};

// State Variables
let isTransferring = false;
let transferInterval = null;
let currentTransferData = {
    vol002: 0,
    volSlop: 0,
    remainingAmount: 0,
    totalToTransfer: 0
};

// Initialize Date
function updateDate() {
    const now = new Date();
    elements.currentDate.textContent = now.toLocaleString('es-ES');
}
setInterval(updateDate, 1000);
updateDate();

// Update Visuals and Calculations
function updateTankVisuals(source) {
    let vol002 = parseFloat(elements.volTK002.value) || 0;
    const cap002 = parseFloat(elements.capTK002.value) || 100;
    const height002 = parseFloat(elements.heightTK002.value) || 1;
    const tvr002 = parseFloat(elements.tvrTK002.value) || 0;

    let volSlop = parseFloat(elements.volTKSlop.value) || 0;
    const capSlop = parseFloat(elements.capTKSlop.value) || 100;
    const tvrSlop = parseFloat(elements.tvrTKSlop.value) || 0;

    // Handle Unit Syncs
    if (source === 'slop-perc') {
        const perc = parseFloat(elements.percTKSlop.value) || 0;
        volSlop = (perc * capSlop) / 100;
        elements.volTKSlop.value = volSlop.toFixed(2);
    } else if (source === 'slop-vol') {
        elements.percTKSlop.value = capSlop > 0 ? ((volSlop / capSlop) * 100).toFixed(1) : 0;
    } else if (source === '002-mm') {
        const mm = parseFloat(elements.mmTK002.value) || 0;
        vol002 = (mm * cap002) / height002;
        elements.volTK002.value = vol002.toFixed(2);
    } else if (source === '002-vol') {
        elements.mmTK002.value = cap002 > 0 ? ((vol002 * height002) / cap002).toFixed(0) : 0;
    }

    // Handle Transfer Amount/Percent Sync
    const amount = parseFloat(elements.transferAmount.value) || 0;
    if (source === 'percent' || source === 'slop-perc' || source === 'slop-vol' || source === 'generic') {
        const percent = parseFloat(elements.transferPercent.value) || 0;
        elements.transferAmount.value = (percent * capSlop / 100).toFixed(2);
    } else if (source === 'amount') {
        elements.transferPercent.value = capSlop > 0 ? ((amount / capSlop) * 100).toFixed(1) : 0;
    }

    // Update Visuals Current Values
    const perc002 = (vol002 / cap002) * 100;
    elements.fillTK002.style.height = `${Math.min(perc002, 100)}%`;
    const mmValCurrent = (vol002 * height002 / cap002) || 0;
    elements.textTK002.textContent = `${mmValCurrent.toFixed(0)} mm`;
    elements.valTK002.textContent = vol002.toFixed(2);

    const percSlop = (volSlop / capSlop) * 100;
    elements.fillTKSlop.style.height = `${Math.min(percSlop, 100)}%`;
    elements.textTKSlop.textContent = `${percSlop.toFixed(1)}%`;
    elements.valTKSlop.textContent = volSlop.toFixed(2);

    // Calculations for Resulting Mixture in TK-002
    const currentTransferAmount = parseFloat(elements.transferAmount.value) || 0;
    const finalVol002 = vol002 + currentTransferAmount;
    const mixTVR = finalVol002 > 0 ? (vol002 * tvr002 + currentTransferAmount * tvrSlop) / finalVol002 : 0;

    elements.totalVol.textContent = finalVol002.toFixed(2);
    elements.mixtureTVR.textContent = mixTVR.toFixed(2);
}

// Validation
function validateTransfer() {
    const vol002 = parseFloat(elements.volTK002.value);
    const volSlop = parseFloat(elements.volTKSlop.value);
    const cap002 = parseFloat(elements.capTK002.value);
    const amount = parseFloat(elements.transferAmount.value);

    if (amount <= 0) {
        alert("Ingrese un volumen a trasvasar válido.");
        return false;
    }
    if (volSlop < amount) {
        alert("El TK-Slop no tiene suficiente volumen para el trasvase.");
        return false;
    }
    if (vol002 + amount > cap002) {
        alert("El TK-002 no tiene capacidad suficiente para recibir este trasvase.");
        return false;
    }
    return true;
}

// Transfer Logic
function startTransfer() {
    if (isTransferring) {
        stopTransfer();
        return;
    }

    if (!validateTransfer()) return;

    isTransferring = true;
    elements.startBtn.textContent = "DETENER TRASVASE";
    elements.startBtn.style.backgroundColor = 'var(--danger-color)';
    elements.flowIndicator.style.width = '100%';

    currentTransferData.volSlop = parseFloat(elements.volTKSlop.value);
    currentTransferData.vol002 = parseFloat(elements.volTK002.value);
    currentTransferData.totalToTransfer = parseFloat(elements.transferAmount.value);
    currentTransferData.remainingAmount = currentTransferData.totalToTransfer;

    const simulationDuration = 3; // 3 seconds
    const tickRate = 50; // 0.05 seconds
    const totalTicks = simulationDuration / (tickRate / 1000); // 100 ticks
    const amountPerTick = currentTransferData.totalToTransfer / totalTicks;

    transferInterval = setInterval(() => {
        if (currentTransferData.remainingAmount <= 0) {
            finishTransfer();
            return;
        }

        const step = Math.min(amountPerTick, currentTransferData.remainingAmount);
        currentTransferData.volSlop -= step;
        currentTransferData.vol002 += step;
        currentTransferData.remainingAmount -= step;

        updateDisplayLive(currentTransferData.vol002, currentTransferData.volSlop);

        const tvr002 = parseFloat(elements.tvrTK002.value);
        const tvrSlop = parseFloat(elements.tvrTKSlop.value);
        const mixTVR = (currentTransferData.vol002 > 0) ? (((currentTransferData.vol002 - (currentTransferData.totalToTransfer - currentTransferData.remainingAmount)) * tvr002 + (currentTransferData.totalToTransfer - currentTransferData.remainingAmount) * tvrSlop) / currentTransferData.vol002) : tvr002;

        elements.mixtureTVR.textContent = mixTVR.toFixed(2);

    }, tickRate);
}

function updateDisplayLive(v002, vSlop) {
    const cap002 = parseFloat(elements.capTK002.value);
    const height002 = parseFloat(elements.heightTK002.value);
    const capSlop = parseFloat(elements.capTKSlop.value);

    // Update Input/Text Values
    elements.volTK002.value = v002.toFixed(2);
    elements.mmTK002.value = (v002 * height002 / cap002).toFixed(0);
    elements.volTKSlop.value = vSlop.toFixed(2);
    elements.percTKSlop.value = ((vSlop / capSlop) * 100).toFixed(1);

    // Update Visuals
    elements.fillTK002.style.height = `${(v002 / cap002) * 100}%`;
    elements.textTK002.textContent = `${(v002 * height002 / cap002).toFixed(0)} mm`;
    elements.valTK002.textContent = v002.toFixed(2);

    elements.fillTKSlop.style.height = `${(vSlop / capSlop) * 100}%`;
    elements.textTKSlop.textContent = `${((vSlop / capSlop) * 100).toFixed(1)}%`;
    elements.valTKSlop.textContent = vSlop.toFixed(2);
}

function stopTransfer() {
    isTransferring = false;
    clearInterval(transferInterval);
    elements.startBtn.textContent = "CONTINUAR";
    elements.startBtn.style.backgroundColor = 'var(--accent-color)';
    elements.flowIndicator.style.width = '0%';
}

function finishTransfer() {
    isTransferring = false;
    clearInterval(transferInterval);
    elements.startBtn.textContent = "TRASVASE COMPLETADO";
    elements.startBtn.disabled = true;
    elements.flowIndicator.style.width = '0%';

    elements.transferAmount.value = "0";
    alert("Trasvase finalizado con éxito.");
}


function resetApp() {
    location.reload();
}

// Event Listeners
elements.startBtn.addEventListener('click', startTransfer);
elements.transferPercent.addEventListener('input', () => updateTankVisuals('percent'));
elements.transferAmount.addEventListener('input', () => updateTankVisuals('amount'));
elements.percTKSlop.addEventListener('input', () => updateTankVisuals('slop-perc'));
elements.mmTK002.addEventListener('input', () => updateTankVisuals('002-mm'));

[elements.tvrTK002, elements.tvrTKSlop].forEach(input => {
    input.addEventListener('input', () => updateTankVisuals('generic'));
});

// Initial Render
updateTankVisuals('slop-perc');
updateTankVisuals('002-mm');
updateTankVisuals('generic');
