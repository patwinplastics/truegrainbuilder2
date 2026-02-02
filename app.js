// ===================================================
// TrueGrain Deck Designer - Main Application
// COMPLETE VERSION: Board Length Optimization, Email & PDF Export
// ===================================================

const CONFIG = {
    boards: {
        availableLengths: [12, 16, 20],
        width: 5.5,
        thickness: 1,
        gap: 0.1875,
        maxContinuousRun: 20
    },
    joists: {
        spacingOptions: [16, 12],
        defaultSpacing: 16
    },
    dimensions: {
        minLength: 8,
        maxLength: 40,
        minWidth: 8,
        maxWidth: 30,
        defaultLength: 16,
        defaultWidth: 12
    },
    deck: {
        minHeight: 0.5,
        maxHeight: 8,
        defaultHeight: 2
    },
    pricing: {
        materialPerLF: { min: 5.00, max: 7.00, default: 6.00 },
        laborPerSF: { min: 10.00, max: 15.00 },
        clipsPerBox: 90,
        clipBoxPrice: 42.00,
        screwsPerBox: 350,
        screwBoxPrice: 38.00
    },
    waste: {
        default: 10,
        min: 5,
        max: 20
    },
    texturePath: 'textures/',
    logoPath: 'images/truegrain-logo.png',
    formspreeEndpoint: 'https://formspree.io/f/meezabrg',
    companyInfo: {
        email: 'sales@americanprobp.com',
        phone: '1-877-442-6776',
        address: '2300 E Linden Ave, Linden, NJ 07036'
    },
    colors: [
        { id: 'aged-oak', name: 'Aged Oak', file: 'Aged-Oak.jpg', hex: '#9A9590' },
        { id: 'coastal-driftwood', name: 'Coastal Driftwood', file: 'Coastal-Driftwood.jpg', hex: '#C4B9A0' },
        { id: 'embered-taupe', name: 'Embered Taupe', file: 'Embered-Taupe.jpg', hex: '#8B7B6B' },
        { id: 'new-england-birch', name: 'New England Birch', file: 'New-England-Birch.jpg', hex: '#C9A86C' },
        { id: 'royal-ipe', name: 'Royal IPE / Nutmeg Oak', file: 'Royal-IPE.jpg', hex: '#6B5344' },
        { id: 'tropical-walnut', name: 'Tropical Walnut', file: 'Tropical-Walnut.jpg', hex: '#A67C52' }
    ],
    boardLengthColors: {
        12: 0x4CAF50,
        16: 0x2196F3,
        20: 0x9C27B0
    }
};

const state = {
    currentStep: 1,
    totalSteps: 7,
    deckLength: CONFIG.dimensions.defaultLength,
    deckWidth: CONFIG.dimensions.defaultWidth,
    deckHeight: CONFIG.deck.defaultHeight,
    joistSpacing: CONFIG.joists.defaultSpacing,
    boardDirection: 'length',
    pattern: 'straight',
    borderWidth: 1,
    mainColor: CONFIG.colors[0].id,
    breakerColor: CONFIG.colors[0].id,
    borderColor: CONFIG.colors[0].id,
    breakerSameColor: true,
    borderSameColor: true,
    showRailings: false,
    wastePercent: CONFIG.waste.default,
    pricePerLF: CONFIG.pricing.materialPerLF.default,
    includeLaborEstimate: false,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactZip: '',
    results: null,
    boardLayout: null
};

// ===================================================
// Loading Spinner Control
// ===================================================
function showLoadingSpinner() {
    const spinner = document.getElementById('buildingSpinner');
    if (spinner) spinner.classList.remove('hidden');
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('buildingSpinner');
    if (spinner) spinner.classList.add('hidden');
}

// ===================================================
// Utility Functions
// ===================================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

const stateListeners = [];
let isUpdatingState = false;

function subscribe(listener) {
    stateListeners.push(listener);
    return () => {
        const index = stateListeners.indexOf(listener);
        if (index > -1) stateListeners.splice(index, 1);
    };
}

function updateState(updates) {
    if (isUpdatingState) return;
    isUpdatingState = true;
    try {
        showLoadingSpinner();
        Object.assign(state, updates);
        state.boardLayout = calculateOptimalBoardLayout();
        state.results = calculateAll();
        stateListeners.forEach(listener => listener(state));
        debouncedSaveState();
    } finally {
        isUpdatingState = false;
    }
}

const debouncedSaveState = debounce(() => {
    try {
        localStorage.setItem('truegrain-deck-state', JSON.stringify(state));
    } catch (e) { }
}, 500);

function loadState() {
    try {
        const saved = localStorage.getItem('truegrain-deck-state');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.deckLength && parsed.deckWidth) {
                Object.assign(state, parsed);
            }
        }
    } catch (e) {
        localStorage.removeItem('truegrain-deck-state');
    }
}

// ===================================================
// BOARD LENGTH OPTIMIZATION ENGINE
// ===================================================
function calculateOptimalBoardLayout() {
    const runDim = state.boardDirection === 'length' ? state.deckLength : state.deckWidth;
    const coverDim = state.boardDirection === 'length' ? state.deckWidth : state.deckLength;
    const boardWidthFt = CONFIG.boards.width / 12;
    const gapFt = CONFIG.boards.gap / 12;
    const effectiveWidth = boardWidthFt + gapFt;
    const numRows = Math.ceil(coverDim / effectiveWidth);

    const combinations = findBoardCombinations(runDim);
    combinations.sort((a, b) => a.wastePercent - b.wastePercent);

    const bestCombo = combinations[0] || {
        segments: [{ length: selectOptimalBoardLength(runDim), actualLength: runDim }],
        wastePercent: 0
    };

    const boardsByLength = { 12: 0, 16: 0, 20: 0 };
    bestCombo.segments.forEach(seg => {
        boardsByLength[seg.length] += numRows;
    });

    return {
        runDimension: runDim,
        coverDimension: coverDim,
        numRows,
        segments: bestCombo.segments,
        boardsByLength,
        wastePercent: bestCombo.wastePercent,
        totalLinealFeet: Object.entries(boardsByLength).reduce((sum, [len, count]) => sum + (count * parseInt(len)), 0),
        usedLinealFeet: numRows * runDim,
        recommendations: combinations.slice(0, 3)
    };
}

function findBoardCombinations(targetLength) {
    const LENGTHS = CONFIG.boards.availableLengths;
    const combinations = [];
    const gapFt = CONFIG.boards.gap / 12;

    // Single board options
    for (const len of LENGTHS) {
        if (len >= targetLength) {
            const waste = len - targetLength;
            const wastePercent = (waste / len) * 100;
            combinations.push({
                segments: [{ length: len, actualLength: targetLength, start: 0 }],
                totalLength: len,
                wastePercent,
                description: `Single ${len}' board`,
                wasteAmount: waste
            });
            break;
        }
    }

    // Two board combinations
    for (const len1 of LENGTHS) {
        for (const len2 of LENGTHS) {
            const totalStock = len1 + len2;
            const coverage = len1 + len2 - gapFt;
            if (coverage >= targetLength && coverage <= targetLength + 2) {
                const seg1Actual = Math.min(len1, targetLength / 2 + 1);
                const seg2Actual = targetLength - seg1Actual - gapFt;
                if (seg2Actual > 0 && seg2Actual <= len2) {
                    const waste = totalStock - targetLength;
                    const wastePercent = (waste / totalStock) * 100;
                    combinations.push({
                        segments: [
                            { length: len1, actualLength: seg1Actual, start: 0 },
                            { length: len2, actualLength: seg2Actual, start: seg1Actual + gapFt }
                        ],
                        totalLength: totalStock,
                        wastePercent,
                        description: `${len1}' + ${len2}' boards`,
                        wasteAmount: waste
                    });
                }
            }
        }
    }

    // Perfect fits
    const perfectFits = findPerfectFits(targetLength);
    perfectFits.forEach(fit => {
        if (!combinations.find(c => c.description === fit.description)) {
            combinations.push(fit);
        }
    });

    // Three board combinations for very long decks
    if (targetLength > 32) {
        for (const len1 of LENGTHS) {
            for (const len2 of LENGTHS) {
                for (const len3 of LENGTHS) {
                    const totalStock = len1 + len2 + len3;
                    const coverage = totalStock - (2 * gapFt);
                    if (coverage >= targetLength && coverage <= targetLength + 3) {
                        const waste = totalStock - targetLength;
                        const wastePercent = (waste / totalStock) * 100;
                        if (wastePercent < 15) {
                            const seg1Actual = len1 - 0.5;
                            const seg2Actual = len2 - 0.5;
                            const seg3Actual = targetLength - seg1Actual - seg2Actual - (2 * gapFt);
                            combinations.push({
                                segments: [
                                    { length: len1, actualLength: seg1Actual, start: 0 },
                                    { length: len2, actualLength: seg2Actual, start: seg1Actual + gapFt },
                                    { length: len3, actualLength: seg3Actual, start: seg1Actual + seg2Actual + (2 * gapFt) }
                                ],
                                totalLength: totalStock,
                                wastePercent,
                                description: `${len1}' + ${len2}' + ${len3}' boards`,
                                wasteAmount: waste
                            });
                        }
                    }
                }
            }
        }
    }

    return combinations;
}

function findPerfectFits(targetLength) {
    const fits = [];
    const gapFt = CONFIG.boards.gap / 12;

    if (Math.abs(targetLength - 24) < 0.5) {
        fits.push({
            segments: [
                { length: 12, actualLength: 12 - gapFt/2, start: 0 },
                { length: 12, actualLength: 12 - gapFt/2, start: 12 }
            ],
            totalLength: 24,
            wastePercent: 0,
            description: "2 x 12' boards (perfect fit)",
            wasteAmount: 0
        });
    }

    if (Math.abs(targetLength - 32) < 0.5) {
        fits.push({
            segments: [
                { length: 16, actualLength: 16 - gapFt/2, start: 0 },
                { length: 16, actualLength: 16 - gapFt/2, start: 16 }
            ],
            totalLength: 32,
            wastePercent: 0,
            description: "2 x 16' boards (perfect fit)",
            wasteAmount: 0
        });
    }

    if (Math.abs(targetLength - 40) < 0.5) {
        fits.push({
            segments: [
                { length: 20, actualLength: 20 - gapFt/2, start: 0 },
                { length: 20, actualLength: 20 - gapFt/2, start: 20 }
            ],
            totalLength: 40,
            wastePercent: 0,
            description: "2 x 20' boards (perfect fit)",
            wasteAmount: 0
        });
    }

    if (Math.abs(targetLength - 28) < 0.5) {
        fits.push({
            segments: [
                { length: 12, actualLength: 12 - gapFt/2, start: 0 },
                { length: 16, actualLength: 16 - gapFt/2, start: 12 }
            ],
            totalLength: 28,
            wastePercent: 0,
            description: "12' + 16' boards (perfect fit)",
            wasteAmount: 0
        });
    }

    if (Math.abs(targetLength - 36) < 0.5) {
        fits.push({
            segments: [
                { length: 16, actualLength: 16 - gapFt/2, start: 0 },
                { length: 20, actualLength: 20 - gapFt/2, start: 16 }
            ],
            totalLength: 36,
            wastePercent: 0,
            description: "16' + 20' boards (perfect fit)",
            wasteAmount: 0
        });
    }

    return fits;
}

function selectOptimalBoardLength(requiredFeet) {
    for (const length of CONFIG.boards.availableLengths) {
        if (length >= requiredFeet) return length;
    }
    return CONFIG.boards.availableLengths[CONFIG.boards.availableLengths.length - 1];
}

// ===================================================
// Calculation Engine
// ===================================================
function calculateAll() {
    const pattern = determinePattern();
    const boards = calculateBoards(pattern);
    const hardware = calculateHardware(boards);
    const withWaste = applyWaste(boards, hardware);
    const costs = calculateCosts(withWaste);

    return {
        squareFootage: state.deckLength * state.deckWidth,
        pattern,
        boards: withWaste.boards,
        hardware: withWaste.hardware,
        costs,
        joistCount: calculateJoistCount(),
        boardLayout: state.boardLayout
    };
}

function determinePattern() {
    const runDimension = state.boardDirection === 'length' ? state.deckLength : state.deckWidth;
    const breakerRequired = runDimension > CONFIG.boards.maxContinuousRun;
    const breakerRecommended = runDimension > 20;

    let effectivePattern = state.pattern;
    let breakerPosition = null;

    if (effectivePattern === 'breaker' || effectivePattern === 'picture-frame') {
        breakerPosition = optimizeBreakPosition(runDimension);
    }

    return {
        type: effectivePattern,
        breakerRequired,
        breakerRecommended,
        breakerPosition,
        borderWidth: state.pattern === 'picture-frame' ? state.borderWidth : 0
    };
}

function optimizeBreakPosition(totalLength) {
    const LENGTHS = CONFIG.boards.availableLengths;
    let bestOption = { waste: Infinity, position: totalLength / 2 };

    for (const len1 of LENGTHS) {
        const remaining = totalLength - len1 - (CONFIG.boards.width / 12);
        if (remaining > 0 && remaining <= 20) {
            const len2 = selectOptimalBoardLength(remaining);
            const waste = (len1 - Math.min(len1, totalLength / 2)) + (len2 - remaining);
            if (waste < bestOption.waste) {
                bestOption = { waste, position: len1 };
            }
        }
    }

    return bestOption.waste < 2 ? bestOption.position : totalLength / 2;
}

function calculateBoards(pattern) {
    const layout = state.boardLayout;
    if (!layout) return { byLength: { 12: 0, 16: 0, 20: 0 }, total: 0, linealFeet: 0 };

    const boardsByLength = { ...layout.boardsByLength };
    let borderBoards = { 12: 0, 16: 0, 20: 0 };
    let breakerBoards = 0;

    if (pattern.type === 'picture-frame') {
        const borderWidthFt = pattern.borderWidth * (CONFIG.boards.width / 12);
        const runDim = state.boardDirection === 'length' ? state.deckLength : state.deckWidth;
        const coverDim = state.boardDirection === 'length' ? state.deckWidth : state.deckLength;

        const longBorderLength = selectOptimalBoardLength(runDim);
        borderBoards[longBorderLength] += pattern.borderWidth * 2;

        const shortBorderLength = selectOptimalBoardLength(coverDim - (2 * borderWidthFt));
        borderBoards[shortBorderLength] += pattern.borderWidth * 2;
    } else if (pattern.type === 'breaker') {
        const coverDim = state.boardDirection === 'length' ? state.deckWidth : state.deckLength;
        const breakerLength = selectOptimalBoardLength(coverDim);
        boardsByLength[breakerLength] = (boardsByLength[breakerLength] || 0) + 1;
        breakerBoards = 1;
    }

    let totalBoards = 0, totalLinealFeet = 0;
    for (const [length, count] of Object.entries(boardsByLength)) {
        totalBoards += count;
        totalLinealFeet += count * parseInt(length);
    }
    for (const [length, count] of Object.entries(borderBoards)) {
        totalBoards += count;
        totalLinealFeet += count * parseInt(length);
    }

    return {
        byLength: boardsByLength,
        borderByLength: borderBoards,
        total: totalBoards,
        linealFeet: totalLinealFeet,
        rows: layout.numRows,
        breakerBoards,
        segments: layout.segments
    };
}

function calculateJoistCount() {
    const joistRunDimension = state.boardDirection === 'length' ? state.deckWidth : state.deckLength;
    return Math.floor((joistRunDimension * 12) / state.joistSpacing) + 1;
}

function calculateHardware(boards) {
    const squareFootage = state.deckLength * state.deckWidth;
    const totalClips = Math.ceil(squareFootage * 2);
    return {
        clips: totalClips,
        clipBoxes: Math.ceil(totalClips / CONFIG.pricing.clipsPerBox),
        screws: totalClips,
        screwBoxes: Math.ceil(totalClips / CONFIG.pricing.screwsPerBox),
        joistCount: calculateJoistCount()
    };
}

function applyWaste(boards, hardware) {
    const wasteFactor = 1 + (state.wastePercent / 100);
    const adjustedByLength = {};
    let adjustedTotal = 0, adjustedLinealFeet = 0;

    for (const [length, count] of Object.entries(boards.byLength)) {
        const adjusted = Math.ceil(count * wasteFactor);
        adjustedByLength[length] = adjusted;
        adjustedTotal += adjusted;
        adjustedLinealFeet += adjusted * parseInt(length);
    }

    if (boards.borderByLength) {
        for (const [length, count] of Object.entries(boards.borderByLength)) {
            if (count > 0) {
                const adjusted = Math.ceil(count * wasteFactor);
                adjustedByLength[length] = (adjustedByLength[length] || 0) + adjusted;
                adjustedTotal += adjusted;
                adjustedLinealFeet += adjusted * parseInt(length);
            }
        }
    }

    return {
        boards: {
            byLength: adjustedByLength,
            total: adjustedTotal,
            linealFeet: adjustedLinealFeet,
            baseTotal: boards.total,
            baseLinealFeet: boards.linealFeet,
            wasteBoards: adjustedTotal - boards.total,
            segments: boards.segments
        },
        hardware: {
            ...hardware,
            clips: Math.ceil(hardware.clips * 1.1),
            clipBoxes: Math.ceil(hardware.clipBoxes * 1.1),
            screws: Math.ceil(hardware.screws * 1.1),
            screwBoxes: Math.ceil(hardware.screwBoxes * 1.1)
        }
    };
}

function calculateCosts(data) {
    const squareFootage = state.deckLength * state.deckWidth;
    const materialCostLow = data.boards.linealFeet * CONFIG.pricing.materialPerLF.min;
    const materialCostHigh = data.boards.linealFeet * CONFIG.pricing.materialPerLF.max;
    const materialCostWorking = data.boards.linealFeet * state.pricePerLF;

    const hardwareCost = (data.hardware.clipBoxes * CONFIG.pricing.clipBoxPrice) +
                         (data.hardware.screwBoxes * CONFIG.pricing.screwBoxPrice);

    let laborCost = state.includeLaborEstimate ? {
        low: squareFootage * CONFIG.pricing.laborPerSF.min,
        high: squareFootage * CONFIG.pricing.laborPerSF.max
    } : null;

    return {
        materials: {
            perLF: {
                low: CONFIG.pricing.materialPerLF.min,
                high: CONFIG.pricing.materialPerLF.max,
                working: state.pricePerLF
            },
            total: {
                low: materialCostLow,
                high: materialCostHigh,
                working: materialCostWorking
            }
        },
        hardware: { total: hardwareCost },
        labor: laborCost,
        grandTotal: {
            materialsOnly: {
                low: materialCostLow + hardwareCost,
                high: materialCostHigh + hardwareCost,
                working: materialCostWorking + hardwareCost
            },
            withLabor: laborCost ? {
                low: materialCostLow + hardwareCost + laborCost.low,
                high: materialCostHigh + hardwareCost + laborCost.high
            } : null
        }
    };
}

// ===================================================
// 3D Visualization
// ===================================================
let scene, camera, renderer, controls;
let deckGroup = null;
let textureCache = {};
let materialCache = {};
let geometryCache = {};
let sceneInitialized = false;
let isBuilding = false;
let pendingBuild = false;
let contextLost = false;

function initScene() {
    const container = document.getElementById('sceneContainer');
    const canvas = document.getElementById('deckCanvas');
    if (!container || !canvas) return;

    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        contextLost = true;
        sceneInitialized = false;
    });

    canvas.addEventListener('webglcontextrestored', () => {
        contextLost = false;
        disposeAllCaches();
        initScene();
    });

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(25, 20, 25);

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.minDistance = 5;
    controls.maxDistance = 100;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -40;
    directionalLight.shadow.camera.right = 40;
    directionalLight.shadow.camera.top = 40;
    directionalLight.shadow.camera.bottom = -40;
    scene.add(directionalLight);

    createRealisticGrass();

    deckGroup = new THREE.Group();
    scene.add(deckGroup);

    sceneInitialized = true;
    buildDeck();

    const loadingEl = document.getElementById('sceneLoading');
    if (loadingEl) loadingEl.classList.add('hidden');

    animate();

    window.addEventListener('resize', debounce(onWindowResize, 250));
    window.addEventListener('beforeunload', disposeAllCaches);
}

function createRealisticGrass() {
    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = 512;
    grassCanvas.height = 512;
    const ctx = grassCanvas.getContext('2d');

    ctx.fillStyle = '#4a7c23';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 15000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const length = 3 + Math.random() * 8;
        const hue = 80 + Math.random() * 40;
        const lightness = 25 + Math.random() * 25;
        ctx.strokeStyle = `hsl(${hue}, 60%, ${lightness}%)`;
        ctx.lineWidth = 0.5 + Math.random() * 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 3, y - length);
        ctx.stroke();
    }

    for (let i = 0; i < 50; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = 10 + Math.random() * 30;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(30, 60, 15, 0.3)');
        gradient.addColorStop(1, 'rgba(30, 60, 15, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    for (let i = 0; i < 40; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = 8 + Math.random() * 20;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(120, 180, 60, 0.25)');
        gradient.addColorStop(1, 'rgba(120, 180, 60, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    const grassTexture = new THREE.CanvasTexture(grassCanvas);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(8, 8);

    const grassMaterial = new THREE.MeshStandardMaterial({
        map: grassTexture,
        roughness: 0.9,
        metalness: 0.0
    });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), grassMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);
}

function preloadTextures() {
    const loader = new THREE.TextureLoader();
    CONFIG.colors.forEach(color => {
        if (!textureCache[color.id]) {
            loader.load(CONFIG.texturePath + color.file, (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                textureCache[color.id] = texture;
            }, undefined, () => console.warn(`Failed to load texture: ${color.file}`));
        }
    });
}

function disposeAllCaches() {
    for (const key in geometryCache) {
        if (geometryCache[key]) geometryCache[key].dispose();
    }
    geometryCache = {};

    for (const key in materialCache) {
        if (materialCache[key]) {
            if (materialCache[key].map) materialCache[key].map.dispose();
            materialCache[key].dispose();
        }
    }
    materialCache = {};

    for (const key in textureCache) {
        if (textureCache[key]) textureCache[key].dispose();
    }
    textureCache = {};
}

function onWindowResize() {
    const container = document.getElementById('sceneContainer');
    if (!container || !camera || !renderer) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    if (contextLost) return;
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}

const debouncedBuildDeck = debounce(() => {
    if (isBuilding) {
        pendingBuild = true;
        return;
    }
    executeBuildDeck();
}, 200);

function buildDeck() {
    debouncedBuildDeck();
}

function executeBuildDeck() {
    if (!deckGroup || !sceneInitialized || contextLost) return;

    showLoadingSpinner();
    isBuilding = true;

    while (deckGroup.children.length > 0) {
        deckGroup.remove(deckGroup.children[0]);
    }

    const colorConfig = CONFIG.colors.find(c => c.id === state.mainColor) || CONFIG.colors[0];

    try {
        createSupportPosts();
        createJoists();
        createDeckBoardsWithSegments(determinePattern(), colorConfig);
        createWhiteFascia();
        if (state.showRailings) createDetailedRailings();

        controls.target.set(0, state.deckHeight, 0);
        const maxDim = Math.max(state.deckLength, state.deckWidth);
        camera.position.set(maxDim * 1.5, state.deckHeight + maxDim * 1.05, maxDim * 1.5);

        updateBoardLegend();
    } catch (e) {
        console.error('Error building deck:', e);
    }

    isBuilding = false;
    setTimeout(() => hideLoadingSpinner(), 100);

    if (pendingBuild) {
        pendingBuild = false;
        debouncedBuildDeck();
    }
}

function createSupportPosts() {
    const postSize = 0.33;
    const postHeight = state.deckHeight;
    if (postHeight <= 0) return;

    const postMaterial = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.9 });
    const postGeometry = new THREE.BoxGeometry(postSize, postHeight, postSize);

    const positions = [
        [-state.deckLength/2 + postSize/2, -state.deckWidth/2 + postSize/2],
        [state.deckLength/2 - postSize/2, -state.deckWidth/2 + postSize/2],
        [state.deckLength/2 - postSize/2, state.deckWidth/2 - postSize/2],
        [-state.deckLength/2 + postSize/2, state.deckWidth/2 - postSize/2]
    ];

    for (let i = 1; i < Math.floor(state.deckLength / 6); i++) {
        const x = -state.deckLength/2 + (i * 6);
        positions.push([x, -state.deckWidth/2 + postSize/2], [x, state.deckWidth/2 - postSize/2]);
    }

    for (let i = 1; i < Math.floor(state.deckWidth / 6); i++) {
        const z = -state.deckWidth/2 + (i * 6);
        positions.push([-state.deckLength/2 + postSize/2, z], [state.deckLength/2 - postSize/2, z]);
    }

    positions.forEach(([x, z]) => {
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(x, postHeight / 2, z);
        post.castShadow = true;
        post.receiveShadow = true;
        deckGroup.add(post);
    });
}

function createJoists() {
    const joistWidthFt = 1.5 / 12;
    const joistHeightFt = 7.5 / 12;
    const joistSpacingFt = state.joistSpacing / 12;

    const joistLength = state.boardDirection === 'length' ? state.deckWidth : state.deckLength;
    const joistSpanDir = state.boardDirection === 'length' ? state.deckLength : state.deckWidth;

    const joistMaterial = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.9 });
    const joistGeometry = new THREE.BoxGeometry(
        state.boardDirection === 'length' ? joistWidthFt : joistLength,
        joistHeightFt,
        state.boardDirection === 'length' ? joistLength : joistWidthFt
    );

    const numJoists = Math.floor(joistSpanDir / joistSpacingFt) + 1;
    const joistY = state.deckHeight - joistHeightFt / 2;

    for (let i = 0; i < numJoists; i++) {
        const joist = new THREE.Mesh(joistGeometry, joistMaterial);
        const pos = (i * joistSpacingFt) - (joistSpanDir / 2);
        joist.position.set(
            state.boardDirection === 'length' ? pos : 0,
            joistY,
            state.boardDirection === 'length' ? 0 : pos
        );
        joist.castShadow = true;
        joist.receiveShadow = true;
        deckGroup.add(joist);
    }

    const rimGeometry = new THREE.BoxGeometry(
        state.boardDirection === 'length' ? joistWidthFt : state.deckLength,
        joistHeightFt,
        state.boardDirection === 'length' ? state.deckWidth : joistWidthFt
    );

    const rim1 = new THREE.Mesh(rimGeometry, joistMaterial);
    const rim2 = new THREE.Mesh(rimGeometry, joistMaterial);
    rim1.position.set(
        state.boardDirection === 'length' ? -joistSpanDir/2 : 0,
        joistY,
        state.boardDirection === 'length' ? 0 : -joistSpanDir/2
    );
    rim2.position.set(
        state.boardDirection === 'length' ? joistSpanDir/2 : 0,
        joistY,
        state.boardDirection === 'length' ? 0 : joistSpanDir/2
    );
    rim1.castShadow = true;
    rim2.castShadow = true;
    deckGroup.add(rim1);
    deckGroup.add(rim2);
}

function createWhiteFascia() {
    const fasciaHeight = 7.5 / 12;
    const fasciaThickness = 1 / 12;
    const fasciaMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 });
    const fasciaY = state.deckHeight - fasciaHeight / 2;

    const frontFascia = new THREE.Mesh(
        new THREE.BoxGeometry(state.deckLength, fasciaHeight, fasciaThickness),
        fasciaMaterial
    );
    frontFascia.position.set(0, fasciaY, -state.deckWidth/2 - fasciaThickness/2);
    frontFascia.castShadow = true;
    deckGroup.add(frontFascia);

    const backFascia = new THREE.Mesh(
        new THREE.BoxGeometry(state.deckLength, fasciaHeight, fasciaThickness),
        fasciaMaterial
    );
    backFascia.position.set(0, fasciaY, state.deckWidth/2 + fasciaThickness/2);
    backFascia.castShadow = true;
    deckGroup.add(backFascia);

    const leftFascia = new THREE.Mesh(
        new THREE.BoxGeometry(fasciaThickness, fasciaHeight, state.deckWidth + fasciaThickness * 2),
        fasciaMaterial
    );
    leftFascia.position.set(-state.deckLength/2 - fasciaThickness/2, fasciaY, 0);
    leftFascia.castShadow = true;
    deckGroup.add(leftFascia);

    const rightFascia = new THREE.Mesh(
        new THREE.BoxGeometry(fasciaThickness, fasciaHeight, state.deckWidth + fasciaThickness * 2),
        fasciaMaterial
    );
    rightFascia.position.set(state.deckLength/2 + fasciaThickness/2, fasciaY, 0);
    rightFascia.castShadow = true;
    deckGroup.add(rightFascia);
}

function createBoardMaterial(colorConfig, boardLengthFt, boardRunsAlongWidth, uniqueId = '') {
    const rotation = boardRunsAlongWidth ? Math.PI : Math.PI / 2;
    const cacheKey = `board_${colorConfig.id}_${rotation.toFixed(2)}_${uniqueId}`;

    if (materialCache[cacheKey]) return materialCache[cacheKey];

    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorConfig.hex),
        roughness: 0.75,
        metalness: 0.0
    });

    if (textureCache[colorConfig.id]) {
        const texture = textureCache[colorConfig.id].clone();
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        const stretchFactor = boardLengthFt / 16;
        texture.repeat.set(stretchFactor, 0.5);
        texture.center.set(0.5, 0.5);
        texture.rotation = rotation;
        texture.needsUpdate = true;
        material.map = texture;
        material.color.setHex(0xFFFFFF);
        material.needsUpdate = true;
    } else {
        const loader = new THREE.TextureLoader();
        loader.load(CONFIG.texturePath + colorConfig.file, (texture) => {
            textureCache[colorConfig.id] = texture;
            const cloned = texture.clone();
            cloned.wrapS = THREE.RepeatWrapping;
            cloned.wrapT = THREE.RepeatWrapping;
            cloned.repeat.set(boardLengthFt / 16, 0.5);
            cloned.center.set(0.5, 0.5);
            cloned.rotation = rotation;
            cloned.needsUpdate = true;
            material.map = cloned;
            material.color.setHex(0xFFFFFF);
            material.needsUpdate = true;
        });
    }

    materialCache[cacheKey] = material;
    return material;
}

function createDeckBoardsWithSegments(pattern, colorConfig) {
    const boardWidthFt = CONFIG.boards.width / 12;
    const boardThicknessFt = CONFIG.boards.thickness / 12;
    const gapFt = CONFIG.boards.gap / 12;
    const effectiveWidth = boardWidthFt + gapFt;
    const boardY = state.deckHeight + boardThicknessFt / 2;
    const boardRunsAlongWidth = state.boardDirection === 'width';

    const layout = state.boardLayout;
    if (!layout) return;

    const runDim = layout.runDimension;
    const coverDim = layout.coverDimension;
    const numRows = layout.numRows;
    const segments = layout.segments;

    if (pattern.type === 'picture-frame') {
        createPictureFrameBoardsWithSegments(boardY, colorConfig, layout);
    } else if (pattern.type === 'breaker') {
        createBreakerBoardsWithSegments(pattern, boardY, colorConfig, layout);
    } else {
        for (let row = 0; row < numRows; row++) {
            const coverOffset = (row * effectiveWidth) - (coverDim / 2) + (boardWidthFt / 2);
            let runOffset = -runDim / 2;

            segments.forEach((seg, segIndex) => {
                const segLength = seg.actualLength || seg.length;
                const material = createBoardMaterial(colorConfig, segLength, boardRunsAlongWidth, `seg${row}_${segIndex}`);

                const boardGeometry = new THREE.BoxGeometry(
                    state.boardDirection === 'length' ? segLength : boardWidthFt,
                    boardThicknessFt,
                    state.boardDirection === 'length' ? boardWidthFt : segLength
                );

                const board = new THREE.Mesh(boardGeometry, material);
                const boardCenterOnRun = runOffset + (segLength / 2);
                board.position.set(
                    state.boardDirection === 'length' ? boardCenterOnRun : coverOffset,
                    boardY,
                    state.boardDirection === 'length' ? coverOffset : boardCenterOnRun
                );
                board.castShadow = true;
                board.receiveShadow = true;
                deckGroup.add(board);

                runOffset += segLength + gapFt;
            });
        }
    }
}

function createPictureFrameBoardsWithSegments(boardY, colorConfig, layout) {
    const boardWidthFt = CONFIG.boards.width / 12;
    const boardThicknessFt = CONFIG.boards.thickness / 12;
    const gapFt = CONFIG.boards.gap / 12;
    const effectiveWidth = boardWidthFt + gapFt;
    const borderWidth = state.borderWidth;
    const borderWidthFt = borderWidth * effectiveWidth;

    const borderColorConfig = state.borderSameColor ? colorConfig : 
        (CONFIG.colors.find(c => c.id === state.borderColor) || colorConfig);

    for (let i = 0; i < borderWidth; i++) {
        const offset = (i * effectiveWidth) + (boardWidthFt / 2);

        const topBorder = new THREE.Mesh(
            new THREE.BoxGeometry(state.deckLength, boardThicknessFt, boardWidthFt),
            createBoardMaterial(borderColorConfig, state.deckLength, false, `border_top_${i}`)
        );
        topBorder.position.set(0, boardY, -state.deckWidth/2 + offset);
        topBorder.castShadow = true;
        deckGroup.add(topBorder);

        const bottomBorder = new THREE.Mesh(
            new THREE.BoxGeometry(state.deckLength, boardThicknessFt, boardWidthFt),
            createBoardMaterial(borderColorConfig, state.deckLength, false, `border_bottom_${i}`)
        );
        bottomBorder.position.set(0, boardY, state.deckWidth/2 - offset);
        bottomBorder.castShadow = true;
        deckGroup.add(bottomBorder);

        const leftBorder = new THREE.Mesh(
            new THREE.BoxGeometry(boardWidthFt, boardThicknessFt, state.deckWidth - 2 * borderWidthFt),
            createBoardMaterial(borderColorConfig, state.deckWidth - 2 * borderWidthFt, true, `border_left_${i}`)
        );
        leftBorder.position.set(-state.deckLength/2 + offset, boardY, 0);
        leftBorder.castShadow = true;
        deckGroup.add(leftBorder);

        const rightBorder = new THREE.Mesh(
            new THREE.BoxGeometry(boardWidthFt, boardThicknessFt, state.deckWidth - 2 * borderWidthFt),
            createBoardMaterial(borderColorConfig, state.deckWidth - 2 * borderWidthFt, true, `border_right_${i}`)
        );
        rightBorder.position.set(state.deckLength/2 - offset, boardY, 0);
        rightBorder.castShadow = true;
        deckGroup.add(rightBorder);
    }

    const innerLength = state.deckLength - 2 * borderWidthFt;
    const innerWidth = state.deckWidth - 2 * borderWidthFt;
    const boardRunsAlongWidth = state.boardDirection === 'width';
    const runDim = state.boardDirection === 'length' ? innerLength : innerWidth;
    const coverDim = state.boardDirection === 'length' ? innerWidth : innerLength;
    const numRows = Math.ceil(coverDim / effectiveWidth);

    for (let row = 0; row < numRows; row++) {
        const coverOffset = (row * effectiveWidth) - (coverDim / 2) + (boardWidthFt / 2);
        const material = createBoardMaterial(colorConfig, runDim, boardRunsAlongWidth, `field_${row}`);

        const boardGeometry = new THREE.BoxGeometry(
            state.boardDirection === 'length' ? runDim : boardWidthFt,
            boardThicknessFt,
            state.boardDirection === 'length' ? boardWidthFt : runDim
        );

        const board = new THREE.Mesh(boardGeometry, material);
        board.position.set(
            state.boardDirection === 'length' ? 0 : coverOffset,
            boardY,
            state.boardDirection === 'length' ? coverOffset : 0
        );
        board.castShadow = true;
        board.receiveShadow = true;
        deckGroup.add(board);
    }
}

function createBreakerBoardsWithSegments(pattern, boardY, colorConfig, layout) {
    const boardWidthFt = CONFIG.boards.width / 12;
    const boardThicknessFt = CONFIG.boards.thickness / 12;
    const gapFt = CONFIG.boards.gap / 12;
    const effectiveWidth = boardWidthFt + gapFt;
    const boardRunsAlongWidth = state.boardDirection === 'width';

    const breakerColorConfig = state.breakerSameColor ? colorConfig : 
        (CONFIG.colors.find(c => c.id === state.breakerColor) || colorConfig);

    const runDim = layout.runDimension;
    const coverDim = layout.coverDimension;
    const numRows = layout.numRows;
    const breakerPos = pattern.breakerPosition || (runDim / 2);

    const breakerMaterial = createBoardMaterial(breakerColorConfig, coverDim, !boardRunsAlongWidth, 'breaker');
    const breakerGeometry = new THREE.BoxGeometry(
        state.boardDirection === 'length' ? boardWidthFt : coverDim,
        boardThicknessFt,
        state.boardDirection === 'length' ? coverDim : boardWidthFt
    );

    const breaker = new THREE.Mesh(breakerGeometry, breakerMaterial);
    breaker.position.set(
        state.boardDirection === 'length' ? breakerPos - runDim/2 : 0,
        boardY,
        state.boardDirection === 'length' ? 0 : breakerPos - runDim/2
    );
    breaker.castShadow = true;
    deckGroup.add(breaker);

    const seg1Length = breakerPos - (boardWidthFt / 2) - (gapFt);
    const seg2Length = runDim - breakerPos - (boardWidthFt / 2) - (gapFt);

    for (let row = 0; row < numRows; row++) {
        const coverOffset = (row * effectiveWidth) - (coverDim / 2) + (boardWidthFt / 2);

        if (seg1Length > 0) {
            const mat1 = createBoardMaterial(colorConfig, seg1Length, boardRunsAlongWidth, `breaker_seg1_${row}`);
            const geom1 = new THREE.BoxGeometry(
                state.boardDirection === 'length' ? seg1Length : boardWidthFt,
                boardThicknessFt,
                state.boardDirection === 'length' ? boardWidthFt : seg1Length
            );
            const board1 = new THREE.Mesh(geom1, mat1);
            board1.position.set(
                state.boardDirection === 'length' ? -runDim/2 + seg1Length/2 : coverOffset,
                boardY,
                state.boardDirection === 'length' ? coverOffset : -runDim/2 + seg1Length/2
            );
            board1.castShadow = true;
            deckGroup.add(board1);
        }

        if (seg2Length > 0) {
            const mat2 = createBoardMaterial(colorConfig, seg2Length, boardRunsAlongWidth, `breaker_seg2_${row}`);
            const geom2 = new THREE.BoxGeometry(
                state.boardDirection === 'length' ? seg2Length : boardWidthFt,
                boardThicknessFt,
                state.boardDirection === 'length' ? boardWidthFt : seg2Length
            );
            const board2 = new THREE.Mesh(geom2, mat2);
            board2.position.set(
                state.boardDirection === 'length' ? runDim/2 - seg2Length/2 : coverOffset,
                boardY,
                state.boardDirection === 'length' ? coverOffset : runDim/2 - seg2Length/2
            );
            board2.castShadow = true;
            deckGroup.add(board2);
        }
    }
}

function createDetailedRailings() {
    const postHeight = 3;
    const postSize = 0.29;
    const railHeight = 0.29;
    const railThickness = 0.125;
    const balusterSize = 0.125;
    const balusterSpacing = 0.33;
    const bottomRailOffset = 0.25;

    const postMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 });
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 });
    const balusterMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 });

    const postGeometry = new THREE.BoxGeometry(postSize, postHeight, postSize);
    const balusterHeight = postHeight - railHeight - bottomRailOffset;
    const balusterGeometry = new THREE.BoxGeometry(balusterSize, balusterHeight, balusterSize);

    const postPositions = [
        [-state.deckLength/2, -state.deckWidth/2],
        [state.deckLength/2, -state.deckWidth/2],
        [state.deckLength/2, state.deckWidth/2],
        [-state.deckLength/2, state.deckWidth/2]
    ];

    const postSpacing = 6;
    for (let x = -state.deckLength/2 + postSpacing; x < state.deckLength/2; x += postSpacing) {
        postPositions.push([x, -state.deckWidth/2], [x, state.deckWidth/2]);
    }
    for (let z = -state.deckWidth/2 + postSpacing; z < state.deckWidth/2; z += postSpacing) {
        postPositions.push([-state.deckLength/2, z], [state.deckLength/2, z]);
    }

    postPositions.forEach(([x, z]) => {
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(x, state.deckHeight + postHeight/2, z);
        post.castShadow = true;
        deckGroup.add(post);
    });

    const deckSurface = state.deckHeight;
    const topRailY = deckSurface + postHeight - railHeight/2;
    const bottomRailY = deckSurface + bottomRailOffset + railHeight/2;
    const balusterY = deckSurface + bottomRailOffset + railHeight + balusterHeight/2;

    const sides = [
        { start: [-state.deckLength/2, -state.deckWidth/2], end: [state.deckLength/2, -state.deckWidth/2], length: state.deckLength, axis: 'x' },
        { start: [state.deckLength/2, -state.deckWidth/2], end: [state.deckLength/2, state.deckWidth/2], length: state.deckWidth, axis: 'z' },
        { start: [state.deckLength/2, state.deckWidth/2], end: [-state.deckLength/2, state.deckWidth/2], length: state.deckLength, axis: 'x' },
        { start: [-state.deckLength/2, state.deckWidth/2], end: [-state.deckLength/2, -state.deckWidth/2], length: state.deckWidth, axis: 'z' }
    ];

    sides.forEach(side => {
        const topRailGeometry = new THREE.BoxGeometry(
            side.axis === 'x' ? side.length : railThickness,
            railHeight,
            side.axis === 'z' ? side.length : railThickness
        );
        const topRail = new THREE.Mesh(topRailGeometry, railMaterial);
        topRail.position.set((side.start[0] + side.end[0]) / 2, topRailY, (side.start[1] + side.end[1]) / 2);
        topRail.castShadow = true;
        deckGroup.add(topRail);

        const bottomRailGeometry = new THREE.BoxGeometry(
            side.axis === 'x' ? side.length : railThickness,
            railHeight,
            side.axis === 'z' ? side.length : railThickness
        );
        const bottomRail = new THREE.Mesh(bottomRailGeometry, railMaterial);
        bottomRail.position.set((side.start[0] + side.end[0]) / 2, bottomRailY, (side.start[1] + side.end[1]) / 2);
        bottomRail.castShadow = true;
        deckGroup.add(bottomRail);

        const numBalusters = Math.floor(side.length / balusterSpacing);
        for (let i = 1; i < numBalusters; i++) {
            const t = i / numBalusters;
            const baluster = new THREE.Mesh(balusterGeometry, balusterMaterial);
            baluster.position.set(
                side.start[0] + t * (side.end[0] - side.start[0]),
                balusterY,
                side.start[1] + t * (side.end[1] - side.start[1])
            );
            baluster.castShadow = true;
            deckGroup.add(baluster);
        }
    });
}

function updateBoardLegend() {
    const legend = document.getElementById('boardLegend');
    if (!legend || !state.boardLayout) return;

    const boardsByLength = state.boardLayout.boardsByLength;
    const items = legend.querySelector('.board-legend__items');
    if (!items) return;

    items.innerHTML = '';
    for (const length of [12, 16, 20]) {
        if (boardsByLength[length] > 0) {
            const item = document.createElement('div');
            item.className = 'board-legend__item';
            item.innerHTML = `
                <span class="board-legend__color len-${length}"></span>
                <span>${length}' (${boardsByLength[length]})</span>
            `;
            items.appendChild(item);
        }
    }
}

// ===================================================
// UI Update Functions
// ===================================================
function updateUI() {
    updateTotalArea();
    updateOptimizationCard();
    updateBoardBreakdown();
    updateEstimateSummary();
    updateReviewSummary();
    updatePatternUI();
}

function updateTotalArea() {
    const el = document.getElementById('totalArea');
    if (el) el.textContent = `${state.deckLength * state.deckWidth} sq ft`;
}

function updateOptimizationCard() {
    const content = document.getElementById('optimizationContent');
    if (!content || !state.boardLayout) return;

    const recommendations = state.boardLayout.recommendations || [];
    if (recommendations.length === 0) {
        content.innerHTML = '<p style="color: var(--color-text-muted); font-size: var(--font-size-sm)">Calculating optimal board layout...</p>';
        return;
    }

    content.innerHTML = recommendations.slice(0, 3).map((rec, i) => {
        const iconClass = i === 0 ? 'best' : (i === 1 ? 'good' : 'alt');
        const wasteClass = rec.wastePercent < 5 ? 'low' : (rec.wastePercent < 10 ? 'medium' : 'high');
        return `
            <div class="optimization-recommendation">
                <div class="optimization-recommendation__icon ${iconClass}">${i + 1}</div>
                <div class="optimization-recommendation__content">
                    <div class="optimization-recommendation__title">${rec.description}</div>
                    <div class="optimization-recommendation__desc">${rec.segments.length} segment(s) per row</div>
                </div>
                <span class="optimization-recommendation__waste ${wasteClass}">${rec.wastePercent.toFixed(1)}% waste</span>
            </div>
        `;
    }).join('');
}

function updateBoardBreakdown() {
    const content = document.getElementById('boardBreakdownContent');
    if (!content || !state.results) return;

    const boards = state.results.boards;
    let html = '';

    for (const length of [12, 16, 20]) {
        const count = boards.byLength[length] || 0;
        if (count > 0) {
            html += `
                <div class="board-length-row">
                    <div class="board-length-row__info">
                        <span class="board-length-row__color len-${length}"></span>
                        <span class="board-length-row__label">${length}' Boards</span>
                    </div>
                    <div>
                        <span class="board-length-row__value">${count} boards</span>
                        <span class="board-length-row__lineal">${count * length} LF</span>
                    </div>
                </div>
            `;
        }
    }

    html += `
        <div class="board-length-row" style="margin-top: var(--spacing-sm); padding-top: var(--spacing-sm); border-top: 2px solid var(--color-border)">
            <div class="board-length-row__info">
                <span class="board-length-row__label" style="font-weight: 600">Total</span>
            </div>
            <div>
                <span class="board-length-row__value" style="font-weight: 600">${boards.total} boards</span>
                <span class="board-length-row__lineal">${boards.linealFeet} LF</span>
            </div>
        </div>
    `;

    if (boards.segments && boards.segments.length > 0) {
        html += '<div class="board-visual">';
        boards.segments.forEach(seg => {
            const widthPercent = (seg.length / 20) * 100;
            html += `<div class="board-visual__segment len-${seg.length}" style="width: ${widthPercent}%">${seg.length}'</div>`;
        });
        html += '</div>';
    }

    content.innerHTML = html;
}

function updateEstimateSummary() {
    const container = document.getElementById('estimateSummary');
    if (!container || !state.results) return;

    const { boards, hardware, costs } = state.results;
    const colorName = CONFIG.colors.find(c => c.id === state.mainColor)?.name || state.mainColor;

    let html = `
        <div class="estimate-section">
            <div class="estimate-section__title">Deck Boards</div>
            <div class="estimate-row">
                <span class="estimate-row__label">Color</span>
                <span class="estimate-row__value">${colorName}</span>
            </div>
            <div class="estimate-row">
                <span class="estimate-row__label">Total Boards</span>
                <span class="estimate-row__value">${boards.total} boards</span>
            </div>
            <div class="estimate-row">
                <span class="estimate-row__label">Total Lineal Feet</span>
                <span class="estimate-row__value">${boards.linealFeet} LF</span>
            </div>
            <div class="estimate-row">
                <span class="estimate-row__label">Waste Factor</span>
                <span class="estimate-row__value">${state.wastePercent}% (${boards.wasteBoards} extra boards)</span>
            </div>
        </div>

        <div class="estimate-section">
            <div class="estimate-section__title">Hardware</div>
            <div class="estimate-row">
                <span class="estimate-row__label">Clip Boxes</span>
                <span class="estimate-row__value">${hardware.clipBoxes} boxes</span>
            </div>
            <div class="estimate-row">
                <span class="estimate-row__label">Screw Boxes</span>
                <span class="estimate-row__value">${hardware.screwBoxes} boxes</span>
            </div>
            <div class="estimate-row">
                <span class="estimate-row__label">Joists Required</span>
                <span class="estimate-row__value">${hardware.joistCount} joists</span>
            </div>
        </div>

        <div class="estimate-section">
            <div class="estimate-section__title">Estimated Cost</div>
            <div class="estimate-row">
                <span class="estimate-row__label">Materials ($${costs.materials.perLF.low}-$${costs.materials.perLF.high}/LF)</span>
                <span class="estimate-row__value">$${costs.materials.total.low.toLocaleString()} - $${costs.materials.total.high.toLocaleString()}</span>
            </div>
            <div class="estimate-row">
                <span class="estimate-row__label">Hardware</span>
                <span class="estimate-row__value">$${costs.hardware.total.toLocaleString()}</span>
            </div>
    `;

    if (costs.labor) {
        html += `
            <div class="estimate-row">
                <span class="estimate-row__label">Labor Estimate</span>
                <span class="estimate-row__value">$${costs.labor.low.toLocaleString()} - $${costs.labor.high.toLocaleString()}</span>
            </div>
            <div class="estimate-row estimate-row--total">
                <span class="estimate-row__label">Total with Labor</span>
                <span class="estimate-row__value">$${costs.grandTotal.withLabor.low.toLocaleString()} - $${costs.grandTotal.withLabor.high.toLocaleString()}</span>
            </div>
        `;
    } else {
        html += `
            <div class="estimate-row estimate-row--total">
                <span class="estimate-row__label">Materials Total</span>
                <span class="estimate-row__value">$${costs.grandTotal.materialsOnly.low.toLocaleString()} - $${costs.grandTotal.materialsOnly.high.toLocaleString()}</span>
            </div>
        `;
    }

    html += `
        </div>
        <div class="estimate-disclaimer">
            Prices are estimates based on typical market rates. Actual costs may vary based on location, availability, and supplier pricing.
        </div>
    `;

    container.innerHTML = html;
}

function updateReviewSummary() {
    const container = document.getElementById('reviewSummary');
    if (!container || !state.results) return;

    const colorName = CONFIG.colors.find(c => c.id === state.mainColor)?.name || state.mainColor;
    const patternNames = { straight: 'Straight', breaker: 'Breaker Board', 'picture-frame': 'Picture Frame' };
    const { boards, hardware, costs } = state.results;

    container.innerHTML = `
        <div class="review-card">
            <div class="review-card__title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                Deck Specifications
            </div>
            <div class="review-grid">
                <div class="review-item">
                    <span class="review-item__label">Dimensions</span>
                    <span class="review-item__value">${state.deckLength}' x ${state.deckWidth}'</span>
                </div>
                <div class="review-item">
                    <span class="review-item__label">Total Area</span>
                    <span class="review-item__value">${state.results.squareFootage} sq ft</span>
                </div>
                <div class="review-item">
                    <span class="review-item__label">Height</span>
                    <span class="review-item__value">${state.deckHeight} ft</span>
                </div>
                <div class="review-item">
                    <span class="review-item__label">Pattern</span>
                    <span class="review-item__value">${patternNames[state.pattern]}</span>
                </div>
                <div class="review-item">
                    <span class="review-item__label">Color</span>
                    <span class="review-item__value">${colorName}</span>
                </div>
                <div class="review-item">
                    <span class="review-item__label">Board Direction</span>
                    <span class="review-item__value">${state.boardDirection === 'length' ? 'Lengthwise' : 'Widthwise'}</span>
                </div>
            </div>
        </div>

        <div class="review-card">
            <div class="review-card__title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                Materials Summary
            </div>
            <div class="review-grid">
                <div class="review-item">
                    <span class="review-item__label">Total Boards</span>
                    <span class="review-item__value">${boards.total} boards</span>
                </div>
                <div class="review-item">
                    <span class="review-item__label">Lineal Feet</span>
                    <span class="review-item__value">${boards.linealFeet} LF</span>
                </div>
                <div class="review-item">
                    <span class="review-item__label">Clip Boxes</span>
                    <span class="review-item__value">${hardware.clipBoxes}</span>
                </div>
                <div class="review-item">
                    <span class="review-item__label">Screw Boxes</span>
                    <span class="review-item__value">${hardware.screwBoxes}</span>
                </div>
            </div>
        </div>

        <div class="review-card">
            <div class="review-card__title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                Estimated Cost
            </div>
            <div class="review-grid">
                <div class="review-item">
                    <span class="review-item__label">Materials + Hardware</span>
                    <span class="review-item__value">$${costs.grandTotal.materialsOnly.low.toLocaleString()} - $${costs.grandTotal.materialsOnly.high.toLocaleString()}</span>
                </div>
                ${costs.grandTotal.withLabor ? `
                <div class="review-item">
                    <span class="review-item__label">With Labor</span>
                    <span class="review-item__value">$${costs.grandTotal.withLabor.low.toLocaleString()} - $${costs.grandTotal.withLabor.high.toLocaleString()}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function updatePatternUI() {
    const pattern = state.pattern;
    const breakerColorGroup = document.getElementById('breakerColorGroup');
    const pictureFrameOptions = document.getElementById('pictureFrameOptions');
    const breakerAlert = document.getElementById('breakerAlert');

    if (breakerColorGroup) breakerColorGroup.classList.toggle('hidden', pattern !== 'breaker');
    if (pictureFrameOptions) pictureFrameOptions.classList.toggle('hidden', pattern !== 'picture-frame');

    if (breakerAlert) {
        const runDim = state.boardDirection === 'length' ? state.deckLength : state.deckWidth;
        breakerAlert.classList.toggle('hidden', runDim <= 20);
    }
}

// ===================================================
// Wizard Navigation
// ===================================================
function goToStep(step) {
    if (step < 1 || step > state.totalSteps) return;

    document.querySelectorAll('.step').forEach((el, i) => {
        el.classList.toggle('hidden', i !== step - 1);
    });

    document.querySelectorAll('.progress-step').forEach((el, i) => {
        el.classList.remove('active', 'completed');
        if (i < step - 1) el.classList.add('completed');
        if (i === step - 1) el.classList.add('active');
    });

    state.currentStep = step;

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (prevBtn) prevBtn.disabled = step === 1;
    if (nextBtn) {
        nextBtn.innerHTML = step === state.totalSteps ?
            'Finish <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' :
            'Next <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    }

    if (step === 6 || step === 7) updateUI();
}

// ===================================================
// Contact Form Validation
// ===================================================
function validateContactInfo() {
    const errors = [];
    const name = document.getElementById('contactName')?.value?.trim();
    const email = document.getElementById('contactEmail')?.value?.trim();
    const phone = document.getElementById('contactPhone')?.value?.trim();
    const zip = document.getElementById('contactZip')?.value?.trim();

    state.contactName = name;
    state.contactEmail = email;
    state.contactPhone = phone;
    state.contactZip = zip;

    if (!name) errors.push({ field: 'contactName', message: 'Name is required' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push({ field: 'contactEmail', message: 'Valid email is required' });
    if (!phone) errors.push({ field: 'contactPhone', message: 'Phone is required' });
    if (!zip || !/^\d{5}(-\d{4})?$/.test(zip)) errors.push({ field: 'contactZip', message: 'Valid ZIP code is required' });

    document.querySelectorAll('.text-input').forEach(input => input.classList.remove('error'));
    errors.forEach(err => {
        const input = document.getElementById(err.field);
        if (input) input.classList.add('error');
    });

    return errors;
}

// ===================================================
// Email Functions
// ===================================================
function generateFormData() {
    const formData = new FormData();
    const colorName = CONFIG.colors.find(c => c.id === state.mainColor)?.name || state.mainColor;
    const patternNames = { straight: 'Straight', breaker: 'Breaker Board', 'picture-frame': 'Picture Frame' };

    formData.append('Customer Name', state.contactName);
    formData.append('Customer Email', state.contactEmail);
    formData.append('Customer Phone', state.contactPhone);
    formData.append('Customer ZIP', state.contactZip);
    formData.append('Deck Dimensions', `${state.deckLength}' x ${state.deckWidth}'`);
    formData.append('Deck Area', `${state.results.squareFootage} sq ft`);
    formData.append('Deck Height', `${state.deckHeight} ft`);
    formData.append('Pattern', patternNames[state.pattern]);
    formData.append('Main Color', colorName);
    formData.append('Board Direction', state.boardDirection === 'length' ? 'Lengthwise' : 'Widthwise');
    formData.append('Joist Spacing', `${state.joistSpacing}" O.C.`);
    formData.append('Total Boards', state.results.boards.total);
    formData.append('Lineal Feet', state.results.boards.linealFeet);
    formData.append('12ft Boards', state.results.boards.byLength[12] || 0);
    formData.append('16ft Boards', state.results.boards.byLength[16] || 0);
    formData.append('20ft Boards', state.results.boards.byLength[20] || 0);
    formData.append('Clip Boxes', state.results.hardware.clipBoxes);
    formData.append('Screw Boxes', state.results.hardware.screwBoxes);
    formData.append('Estimated Cost', `$${state.results.costs.grandTotal.materialsOnly.low.toLocaleString()} - $${state.results.costs.grandTotal.materialsOnly.high.toLocaleString()}`);
    formData.append('Quote Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));

    return formData;
}

function setButtonLoading(btn, loading, text = 'Processing...') {
    if (!btn) return;
    if (loading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<svg class="spinner-rotate" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg> ${text}`;
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
    }
}

async function emailQuoteToSelf() {
    const errors = validateContactInfo();
    if (errors.length > 0) {
        document.getElementById(errors[0].field)?.focus();
        return;
    }

    if (!state.results) {
        alert('Please complete the deck configuration first.');
        return;
    }

    const btn = document.getElementById('emailMyselfBtn');
    setButtonLoading(btn, true, 'Sending...');

    const formData = generateFormData();
    formData.append('_subject', `Your TrueGrain Deck Quote ${state.deckLength}x${state.deckWidth}`);

    try {
        const response = await fetch(CONFIG.formspreeEndpoint, {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            showSuccessMessage('self');
        } else {
            throw new Error('Failed');
        }
    } catch (error) {
        console.error('Email error:', error);
        alert('Unable to send email. Please try again.');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function submitToSales(fromSuccessScreen = false) {
    const errors = validateContactInfo();
    if (errors.length > 0) {
        if (!fromSuccessScreen) document.getElementById(errors[0].field)?.focus();
        return;
    }

    if (!state.results) {
        alert('Please complete the deck configuration first.');
        return;
    }

    const btn = fromSuccessScreen ? 
        document.getElementById('alsoSubmitToSalesBtn') : 
        document.getElementById('submitToSalesBtn');
    setButtonLoading(btn, true, 'Submitting...');

    const formData = generateFormData();
    formData.append('_subject', `SALES LEAD: Deck Quote ${state.deckLength}x${state.deckWidth} - ${state.contactName}`);
    formData.append('_replyto', state.contactEmail);
    formData.append('Submission Type', 'Sales Consultation Request');

    try {
        const response = await fetch(CONFIG.formspreeEndpoint, {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            showSuccessMessage('sales');
        } else {
            throw new Error('Failed');
        }
    } catch (error) {
        console.error('Sales error:', error);
        alert(`Unable to submit. Please try again or email ${CONFIG.companyInfo.email} directly.`);
    } finally {
        setButtonLoading(btn, false);
    }
}

function showSuccessMessage(type) {
    const exportActions = document.getElementById('exportActions');
    const successMessage = document.getElementById('quoteSuccessMessage');
    if (!exportActions || !successMessage) return;

    exportActions.style.display = 'none';
    successMessage.classList.remove('hidden');
    successMessage.style.display = 'block';

    if (type === 'self') {
        successMessage.className = 'quote-success-message';
        successMessage.innerHTML = `
            <div class="quote-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="quote-success-title">Quote Sent to Your Email!</div>
            <div class="quote-success-text">
                We've sent your deck quote to <strong>${state.contactEmail}</strong>.<br>
                Check your inbox and spam folder for the details.
            </div>
            <div class="quote-success-actions">
                <button class="btn btn--outline btn--small" id="downloadPdfAfterEmailBtn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Download PDF Copy
                </button>
                <button class="btn btn--success btn--small" id="alsoSubmitToSalesBtn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2Z"></path></svg>
                    Submit to Sales Team
                </button>
                <button class="btn btn--outline btn--small" id="sendAnotherQuoteBtn">Start New Quote</button>
            </div>
        `;
    } else if (type === 'sales') {
        successMessage.className = 'quote-success-message sales-success';
        successMessage.innerHTML = `
            <div class="quote-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="quote-success-title">Quote Submitted to Our Sales Team!</div>
            <div class="quote-success-text">
                Thank you, <strong>${state.contactName}</strong>!<br>
                Our team will contact you at <strong>${state.contactEmail}</strong> within 24 hours.<br>
                A confirmation copy has been sent to your email.
            </div>
            <div class="quote-success-actions">
                <button class="btn btn--outline btn--small" id="downloadPdfAfterSalesBtn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Download PDF Copy
                </button>
                <button class="btn btn--outline btn--small" id="sendAnotherQuoteBtn2">Start New Quote</button>
            </div>
        `;
    }

    // Rebind events for dynamically created buttons
    document.getElementById('downloadPdfAfterEmailBtn')?.addEventListener('click', generatePDF);
    document.getElementById('downloadPdfAfterSalesBtn')?.addEventListener('click', generatePDF);
    document.getElementById('alsoSubmitToSalesBtn')?.addEventListener('click', () => submitToSales(true));
    document.getElementById('sendAnotherQuoteBtn')?.addEventListener('click', resetQuoteForm);
    document.getElementById('sendAnotherQuoteBtn2')?.addEventListener('click', resetQuoteForm);
}

function resetQuoteForm() {
    const exportActions = document.getElementById('exportActions');
    const successMessage = document.getElementById('quoteSuccessMessage');
    if (exportActions) exportActions.style.display = 'flex';
    if (successMessage) {
        successMessage.style.display = 'none';
        successMessage.classList.add('hidden');
    }
    goToStep(1);
}

// ===================================================
// PDF Generation
// ===================================================
async function generatePDF() {
    if (!state.results) {
        alert('Please complete the deck configuration first.');
        return;
    }

    const btn = document.querySelector('[onclick="generatePDF()"]') || 
                document.getElementById('downloadPdfBtn') ||
                document.getElementById('downloadPdfAfterEmailBtn') ||
                document.getElementById('downloadPdfAfterSalesBtn');

    if (btn) setButtonLoading(btn, true, 'Generating PDF...');

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 40;
        let y = margin;

        const colorName = CONFIG.colors.find(c => c.id === state.mainColor)?.name || 'Unknown';
        const patternNames = { straight: 'Straight', breaker: 'Breaker Board', 'picture-frame': 'Picture Frame' };

        // Header with logo
        try {
            const logoImg = new Image();
            logoImg.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                logoImg.onload = resolve;
                logoImg.onerror = reject;
                logoImg.src = CONFIG.logoPath;
                setTimeout(reject, 3000);
            });
            const canvas = document.createElement('canvas');
            canvas.width = logoImg.width;
            canvas.height = logoImg.height;
            canvas.getContext('2d').drawImage(logoImg, 0, 0);
            const logoData = canvas.toDataURL('image/png');
            doc.addImage(logoData, 'PNG', margin, y, 120, 40);
            y += 50;
        } catch (e) {
            doc.setFontSize(20);
            doc.setTextColor(139, 90, 43);
            doc.setFont('helvetica', 'bold');
            doc.text('TRUEGRAIN', margin, y + 25);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Premium Composite Decking', margin, y + 40);
            y += 50;
        }

        // Title and Date
        doc.setFontSize(22);
        doc.setTextColor(51, 51, 51);
        doc.setFont('helvetica', 'bold');
        doc.text('Deck Material Quote', pageWidth - margin, y, { align: 'right' });
        y += 20;

        doc.setFontSize(10);
        doc.setTextColor(102, 102, 102);
        doc.setFont('helvetica', 'normal');
        doc.text('Generated ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - margin, y, { align: 'right' });
        y += 30;

        // Divider
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(1);
        doc.line(margin, y, pageWidth - margin, y);
        y += 20;

        // Customer Info
        doc.setFontSize(12);
        doc.setTextColor(51, 51, 51);
        doc.setFont('helvetica', 'bold');
        doc.text('Prepared For:', margin, y);
        y += 15;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(state.contactName || 'Customer', margin, y);
        y += 14;
        if (state.contactEmail) { doc.text(state.contactEmail, margin, y); y += 14; }
        if (state.contactPhone) { doc.text(state.contactPhone, margin, y); y += 14; }
        if (state.contactZip) { doc.text('ZIP: ' + state.contactZip, margin, y); y += 14; }
        y += 10;

        // 3D Preview Capture
        const canvas3D = document.getElementById('deckCanvas');
        if (canvas3D && renderer) {
            try {
                renderer.render(scene, camera);
                const imgData = canvas3D.toDataURL('image/png', 0.9);
                const previewWidth = pageWidth - 2 * margin;
                const previewHeight = previewWidth * 0.5;

                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('3D Deck Preview', margin, y);
                y += 10;

                doc.setDrawColor(200, 200, 200);
                doc.setFillColor(245, 245, 245);
                doc.roundedRect(margin, y, previewWidth, previewHeight, 5, 5, 'FD');
                doc.addImage(imgData, 'PNG', margin + 2, y + 2, previewWidth - 4, previewHeight - 4);
                y += previewHeight + 15;
            } catch (e) {
                console.warn('Could not capture 3D preview:', e);
            }
        }

        // Specifications
        doc.setFillColor(248, 249, 250);
        doc.setDrawColor(200, 200, 200);
        const specBoxWidth = (pageWidth - 2 * margin - 10) / 2;
        doc.roundedRect(margin, y, specBoxWidth, 90, 5, 5, 'FD');
        doc.roundedRect(margin + specBoxWidth + 10, y, specBoxWidth, 90, 5, 5, 'FD');

        // Left column - Specifications
        let specY = y + 20;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 51, 51);
        doc.text('Specifications', margin + 10, specY);
        specY += 18;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const specs = [
            ['Dimensions', `${state.deckLength}' x ${state.deckWidth}'`],
            ['Total Area', `${state.results.squareFootage} sq ft`],
            ['Height', `${state.deckHeight} ft`],
            ['Pattern', patternNames[state.pattern]],
            ['Color', colorName]
        ];
        specs.forEach(([label, value]) => {
            doc.text(label + ':', margin + 10, specY);
            doc.setFont('helvetica', 'bold');
            doc.text(value, margin + 80, specY);
            doc.setFont('helvetica', 'normal');
            specY += 12;
        });

        // Right column - Materials
        let matY = y + 20;
        const rightCol = margin + specBoxWidth + 15;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Materials Required', rightCol, matY);
        matY += 18;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const materials = [
            ['Total Boards', `${state.results.boards.total} boards`],
            ['Lineal Feet', `${state.results.boards.linealFeet} LF`],
            ['Clip Boxes', `${state.results.hardware.clipBoxes} boxes`],
            ['Screw Boxes', `${state.results.hardware.screwBoxes} boxes`],
            ['Joists', `${state.results.hardware.joistCount} joists`]
        ];
        materials.forEach(([label, value]) => {
            doc.text(label + ':', rightCol, matY);
            doc.setFont('helvetica', 'bold');
            doc.text(value, rightCol + 70, matY);
            doc.setFont('helvetica', 'normal');
            matY += 12;
        });

        y += 105;

        // Board Breakdown
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Board Length Breakdown', margin, y);
        y += 15;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        [12, 16, 20].forEach(len => {
            const count = state.results.boards.byLength[len] || 0;
            if (count > 0) {
                doc.text(`${len}' Boards: ${count} boards (${count * len} LF)`, margin + 10, y);
                y += 12;
            }
        });
        y += 10;

        // Estimated Cost
        doc.setFillColor(139, 90, 43);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 50, 5, 5, 'F');

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Estimated Materials Cost', margin + 15, y + 20);

        doc.setFontSize(16);
        const costRange = `$${state.results.costs.grandTotal.materialsOnly.low.toLocaleString()} - $${state.results.costs.grandTotal.materialsOnly.high.toLocaleString()}`;
        doc.text(costRange, pageWidth - margin - 15, y + 22, { align: 'right' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Based on $5.00-$7.00/LF material pricing + hardware', margin + 15, y + 38);
        y += 65;

        // Footer
        const footerY = pageHeight - 50;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY - 15, pageWidth - margin, footerY - 15);

        doc.setFontSize(9);
        doc.setTextColor(102, 102, 102);
        doc.setFont('helvetica', 'bold');
        doc.text('TrueGrain by American Pro Building Products', margin, footerY);

        doc.setFont('helvetica', 'normal');
        doc.text(CONFIG.companyInfo.address, margin, footerY + 12);
        doc.text('Email: ' + CONFIG.companyInfo.email, pageWidth / 2, footerY, { align: 'center' });
        doc.text('Phone: ' + CONFIG.companyInfo.phone, pageWidth / 2, footerY + 12, { align: 'center' });

        doc.setFontSize(8);
        doc.text('Prices are estimates only. Contact us for final pricing.', pageWidth - margin, footerY + 12, { align: 'right' });

        // Save PDF
        const fileName = `TrueGrain-Quote-${state.deckLength}x${state.deckWidth}-${Date.now()}.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error('PDF generation error:', error);
        alert('Unable to generate PDF. Please try again.');
    } finally {
        if (btn) setButtonLoading(btn, false);
    }
}

// ===================================================
// UI Controller
// ===================================================
function initUI() {
    initColorSwatches();
    bindEventListeners();
    state.results = calculateAll();
    updateUI();
}

function initColorSwatches() {
    const createSwatches = (container, selectedId, type) => {
        if (!container) return;
        container.innerHTML = CONFIG.colors.map(color => {
            const isSelected = color.id === selectedId;
            return `
                <div class="color-swatch ${isSelected ? 'selected' : ''}" data-color="${color.id}" data-type="${type}" style="background: url('${CONFIG.texturePath}${color.file}') center/cover, ${color.hex}">
                    <span class="color-swatch__name">${color.name}</span>
                    <span class="color-swatch__check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
                </div>
            `;
        }).join('');
    };

    createSwatches(document.getElementById('mainColorSwatches'), state.mainColor, 'main');
    createSwatches(document.getElementById('breakerColorSwatches'), state.breakerColor, 'breaker');
    createSwatches(document.getElementById('borderColorSwatches'), state.borderColor, 'border');
}

function bindEventListeners() {
    // Dimension sliders
    const lengthSlider = document.getElementById('lengthSlider');
    const lengthInput = document.getElementById('lengthInput');
    if (lengthSlider && lengthInput) {
        lengthSlider.addEventListener('input', (e) => {
            lengthInput.value = e.target.value;
            updateState({ deckLength: parseFloat(e.target.value) });
        });
        lengthInput.addEventListener('change', (e) => {
            const val = Math.max(CONFIG.dimensions.minLength, Math.min(CONFIG.dimensions.maxLength, parseFloat(e.target.value) || CONFIG.dimensions.defaultLength));
            e.target.value = val;
            lengthSlider.value = val;
            updateState({ deckLength: val });
        });
    }

    const widthSlider = document.getElementById('widthSlider');
    const widthInput = document.getElementById('widthInput');
    if (widthSlider && widthInput) {
        widthSlider.addEventListener('input', (e) => {
            widthInput.value = e.target.value;
            updateState({ deckWidth: parseFloat(e.target.value) });
        });
        widthInput.addEventListener('change', (e) => {
            const val = Math.max(CONFIG.dimensions.minWidth, Math.min(CONFIG.dimensions.maxWidth, parseFloat(e.target.value) || CONFIG.dimensions.defaultWidth));
            e.target.value = val;
            widthSlider.value = val;
            updateState({ deckWidth: val });
        });
    }

    const heightSlider = document.getElementById('heightSlider');
    const heightInput = document.getElementById('heightInput');
    if (heightSlider && heightInput) {
        heightSlider.addEventListener('input', (e) => {
            heightInput.value = e.target.value;
            updateState({ deckHeight: parseFloat(e.target.value) });
        });
        heightInput.addEventListener('change', (e) => {
            const val = Math.max(CONFIG.deck.minHeight, Math.min(CONFIG.deck.maxHeight, parseFloat(e.target.value) || CONFIG.deck.defaultHeight));
            e.target.value = val;
            heightSlider.value = val;
            updateState({ deckHeight: val });
        });
    }

    // Direction buttons
    document.querySelectorAll('.direction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.direction-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            updateState({ boardDirection: btn.dataset.direction });
        });
    });

    // Joist spacing
    document.querySelectorAll('input[name="joistSpacing"]').forEach(input => {
        input.addEventListener('change', (e) => {
            document.querySelectorAll('.radio-card--small').forEach(card => card.classList.remove('selected'));
            e.target.closest('.radio-card').classList.add('selected');
            updateState({ joistSpacing: parseInt(e.target.value) });
        });
    });

    // Pattern cards
    document.querySelectorAll('.pattern-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.pattern-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
            const pattern = card.dataset.pattern;
            updateState({ pattern });

            const borderWidthGroup = document.getElementById('borderWidthGroup');
            if (borderWidthGroup) borderWidthGroup.style.display = pattern === 'picture-frame' ? 'block' : 'none';
        });
    });

    // Border width
    const borderWidthSlider = document.getElementById('borderWidthSlider');
    const borderWidthInput = document.getElementById('borderWidthInput');
    if (borderWidthSlider && borderWidthInput) {
        borderWidthSlider.addEventListener('input', (e) => {
            borderWidthInput.value = e.target.value;
            updateState({ borderWidth: parseInt(e.target.value) });
        });
        borderWidthInput.addEventListener('change', (e) => {
            const val = Math.max(1, Math.min(3, parseInt(e.target.value) || 1));
            e.target.value = val;
            borderWidthSlider.value = val;
            updateState({ borderWidth: val });
        });
    }

    // Color swatches
    document.addEventListener('click', (e) => {
        const swatch = e.target.closest('.color-swatch');
        if (swatch) {
            const type = swatch.dataset.type;
            const colorId = swatch.dataset.color;
            swatch.parentElement.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatch.classList.add('selected');
            if (type === 'main') updateState({ mainColor: colorId });
            else if (type === 'breaker') updateState({ breakerColor: colorId });
            else if (type === 'border') updateState({ borderColor: colorId });
        }
    });

    // Same color checkboxes
    const breakerSameColor = document.getElementById('breakerSameColor');
    if (breakerSameColor) {
        breakerSameColor.addEventListener('change', (e) => {
            const container = document.getElementById('breakerColorSwatchesContainer');
            if (container) container.style.display = e.target.checked ? 'none' : 'block';
            updateState({ breakerSameColor: e.target.checked });
        });
    }

    const borderSameColor = document.getElementById('borderSameColor');
    if (borderSameColor) {
        borderSameColor.addEventListener('change', (e) => {
            const container = document.getElementById('borderColorSwatchesContainer');
            if (container) container.style.display = e.target.checked ? 'none' : 'block';
            updateState({ borderSameColor: e.target.checked });
        });
    }

    // Show railings
    const showRailings = document.getElementById('showRailings');
    if (showRailings) {
        showRailings.addEventListener('change', (e) => {
            updateState({ showRailings: e.target.checked });
        });
    }

    // Waste slider
    const wasteSlider = document.getElementById('wasteSlider');
    const wasteInput = document.getElementById('wasteInput');
    if (wasteSlider && wasteInput) {
        wasteSlider.addEventListener('input', (e) => {
            wasteInput.value = e.target.value;
            updateState({ wastePercent: parseInt(e.target.value) });
        });
        wasteInput.addEventListener('change', (e) => {
            const val = Math.max(CONFIG.waste.min, Math.min(CONFIG.waste.max, parseInt(e.target.value) || CONFIG.waste.default));
            e.target.value = val;
            wasteSlider.value = val;
            updateState({ wastePercent: val });
        });
    }

    // Labor estimate checkbox
    const includeLaborEstimate = document.getElementById('includeLaborEstimate');
    if (includeLaborEstimate) {
        includeLaborEstimate.addEventListener('change', (e) => {
            updateState({ includeLaborEstimate: e.target.checked });
        });
    }

    // Contact fields
    ['contactName', 'contactEmail', 'contactPhone', 'contactZip'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', (e) => {
                updateState({ [id]: e.target.value });
            });
        }
    });

    // Navigation buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (state.currentStep > 1) goToStep(state.currentStep - 1);
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (state.currentStep < state.totalSteps) goToStep(state.currentStep + 1);
        });
    }

    // Progress steps
    document.querySelectorAll('.progress-step').forEach((step) => {
        step.addEventListener('click', () => {
            const stepNum = parseInt(step.dataset.step);
            if (stepNum !== state.currentStep) goToStep(stepNum);
        });
    });

    // View buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (btn.dataset.view === 'top') {
                camera.position.set(0, Math.max(state.deckLength, state.deckWidth) * 1.5, 0.01);
                controls.target.set(0, state.deckHeight, 0);
            } else {
                const maxDim = Math.max(state.deckLength, state.deckWidth);
                camera.position.set(maxDim * 1.5, state.deckHeight + maxDim * 1.05, maxDim * 1.5);
                controls.target.set(0, state.deckHeight, 0);
            }
        });
    });

    // Zoom controls
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => camera.position.multiplyScalar(0.8));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => camera.position.multiplyScalar(1.2));
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => {
            const maxDim = Math.max(state.deckLength, state.deckWidth);
            camera.position.set(maxDim * 1.5, state.deckHeight + maxDim * 1.05, maxDim * 1.5);
            controls.target.set(0, state.deckHeight, 0);
        });
    }

    // PDF and Email buttons
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', generatePDF);

    const emailMyselfBtn = document.getElementById('emailMyselfBtn');
    if (emailMyselfBtn) emailMyselfBtn.addEventListener('click', emailQuoteToSelf);

    const submitToSalesBtn = document.getElementById('submitToSalesBtn');
    if (submitToSalesBtn) submitToSalesBtn.addEventListener('click', () => submitToSales(false));

    // Subscribe to state changes
    subscribe(updateUI);
    subscribe(buildDeck);
}

// ===================================================
// Initialization
// ===================================================
function initializeApp() {
    loadState();
    state.boardLayout = calculateOptimalBoardLayout();
    state.results = calculateAll();
    initUI();
    preloadTextures();

    setTimeout(() => {
        initScene();
        updateUI();
        goToStep(1);
        hideLoadingSpinner();
    }, 100);
}

// Start the app
document.addEventListener('DOMContentLoaded', initializeApp);

// Add spinner animation CSS
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    @keyframes spinner-rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .spinner-rotate { animation: spinner-rotate 1s linear infinite; }
`;
document.head.appendChild(spinnerStyle);