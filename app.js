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
// ============================================================================
// AGENT 1: STAIR STATE MANAGEMENT, CONFIGURATION & CALCULATIONS
// ============================================================================
// Insert this code into app.js after the existing CONFIG object
// and state object definitions
// ============================================================================

// ===========================================
// CONFIGURATION ADDITIONS
// ===========================================
// Add this to the CONFIG object (merge with existing CONFIG):

const STAIR_CONFIG = {
    stairs: {
        defaultWidth: 4,              // feet
        minWidth: 2,
        maxWidth: 8,
        boardsPerTread: {
            default: 2,
            min: 1,
            max: 4
        },
        riserHeight: {
            target: 7.5,              // inches (ideal)
            max: 7.75,                // code maximum
            min: 4                    // code minimum
        },
        treadNose: 1,                 // inches overhang
        stringerThickness: 1.5,       // inches
        stringerWidth: 11.25,         // inches (2x12 nominal)
        stringerInset: 2,             // inches from edge
        landingDepth: 3,              // feet for L-shaped
        minDeckHeightForStairs: 1,    // feet - below this, stairs disabled
        handrailHeight: 36,           // inches
        handrailPostSpacing: 4,       // feet max between posts
        codeMinWidth: 36,             // inches minimum stair width per code
    }
};

// Merge STAIR_CONFIG into CONFIG
Object.assign(CONFIG, STAIR_CONFIG);

// ===========================================
// STATE ADDITIONS
// ===========================================
// Add these properties to the existing state object:

const STAIR_STATE_DEFAULTS = {
    stairsEnabled: false,
    stairs: [],                       // Array of stair configurations
    selectedStairId: null,            // Currently selected stair for editing
    stairResults: null                // Calculated stair materials
};

// Merge into state
Object.assign(state, STAIR_STATE_DEFAULTS);

// ===========================================
// UNDO/REDO HISTORY (see Agent 7 for full implementation)
// ===========================================
// Reference to history manager - implemented in Agent 7
// let historyManager = null;

// ===========================================
// STAIR ID GENERATOR
// ===========================================
let stairIdCounter = 0;

function generateStairId() {
    return `stair_${Date.now()}_${++stairIdCounter}`;
}

// ===========================================
// STAIR CALCULATION ENGINE
// ===========================================

/**
 * Calculate stair dimensions based on deck height and configuration
 * Uses standard rise/run calculations for code compliance
 */
function calculateStairDimensions(stairConfig) {
    const deckHeightInches = state.deckHeight * 12;
    const targetRise = CONFIG.stairs.riserHeight.target;

    // Calculate number of risers (one more riser than treads)
    let numRisers = Math.round(deckHeightInches / targetRise);
    numRisers = Math.max(1, numRisers);

    // Calculate actual rise per step
    let actualRise = deckHeightInches / numRisers;

    // Ensure rise is within code limits
    if (actualRise > CONFIG.stairs.riserHeight.max) {
        numRisers = Math.ceil(deckHeightInches / CONFIG.stairs.riserHeight.max);
        actualRise = deckHeightInches / numRisers;
    } else if (actualRise < CONFIG.stairs.riserHeight.min) {
        numRisers = Math.floor(deckHeightInches / CONFIG.stairs.riserHeight.min);
        numRisers = Math.max(1, numRisers);
        actualRise = deckHeightInches / numRisers;
    }

    // Number of treads is one less than risers
    const numTreads = numRisers - 1;

    // Calculate tread depth based on boards per tread
    const boardWidthInches = CONFIG.boards.width;
    const gapInches = CONFIG.boards.gap;
    const boardsPerTread = stairConfig.boardsPerTread || CONFIG.stairs.boardsPerTread.default;
    const treadDepth = (boardsPerTread * boardWidthInches) + ((boardsPerTread - 1) * gapInches);

    // Total run (horizontal distance)
    const totalRunInches = numTreads * treadDepth;
    const totalRunFeet = totalRunInches / 12;

    // Stair width
    const stairWidthFeet = stairConfig.width || CONFIG.stairs.defaultWidth;
    const stairWidthInches = stairWidthFeet * 12;

    // L-shaped calculations
    let lShapedData = null;
    if (stairConfig.shape === 'l-shaped') {
        lShapedData = calculateLShapedDimensions(
            numRisers,
            numTreads,
            actualRise,
            treadDepth,
            stairConfig.turnDirection || 'left'
        );
    }

    return {
        numRisers,
        numTreads,
        actualRise,                    // inches
        treadDepth,                    // inches
        totalRunInches,
        totalRunFeet,
        stairWidthFeet,
        stairWidthInches,
        boardsPerTread,
        deckHeightInches,
        lShapedData,
        isValid: numTreads >= 1 && actualRise >= CONFIG.stairs.riserHeight.min
    };
}

/**
 * Calculate L-shaped stair dimensions with landing
 */
function calculateLShapedDimensions(numRisers, numTreads, actualRise, treadDepth, turnDirection) {
    // Split treads roughly in half, landing in middle
    const treadsBeforeLanding = Math.floor(numTreads / 2);
    const treadsAfterLanding = numTreads - treadsBeforeLanding;

    // Landing dimensions (square based on stair width)
    const landingDepthFeet = CONFIG.stairs.landingDepth;
    const landingDepthInches = landingDepthFeet * 12;

    // Run for each flight
    const run1Inches = treadsBeforeLanding * treadDepth;
    const run2Inches = treadsAfterLanding * treadDepth;

    // Height at landing
    const risersBeforeLanding = treadsBeforeLanding + 1; // +1 because landing counts as a step
    const heightAtLanding = risersBeforeLanding * actualRise;

    return {
        treadsBeforeLanding,
        treadsAfterLanding,
        risersBeforeLanding,
        risersAfterLanding: numRisers - risersBeforeLanding,
        landingDepthInches,
        landingDepthFeet,
        run1Inches,
        run2Inches,
        run1Feet: run1Inches / 12,
        run2Feet: run2Inches / 12,
        heightAtLanding,
        turnDirection
    };
}

/**
 * Calculate materials needed for a single stair configuration
 */
function calculateStairMaterials(stairConfig) {
    const dims = calculateStairDimensions(stairConfig);

    if (!dims.isValid) {
        return {
            isValid: false,
            treads: { byLength: { 12: 0, 16: 0, 20: 0 }, total: 0, linealFeet: 0 },
            risers: { byLength: { 12: 0, 16: 0, 20: 0 }, total: 0, linealFeet: 0 },
            stringers: { count: 0, length: 0 },
            landing: null,
            hardware: { clips: 0, screws: 0 },
            handrails: null
        };
    }

    // Tread boards calculation
    const treads = calculateTreadMaterials(dims, stairConfig);

    // Riser boards calculation
    const risers = calculateRiserMaterials(dims, stairConfig);

    // Stringers calculation
    const stringers = calculateStringerMaterials(dims, stairConfig);

    // Landing materials (for L-shaped)
    const landing = stairConfig.shape === 'l-shaped' 
        ? calculateLandingMaterials(dims, stairConfig) 
        : null;

    // Handrails (if enabled)
    const handrails = stairConfig.includeHandrails 
        ? calculateHandrailMaterials(dims, stairConfig) 
        : null;

    // Hardware (clips and screws for treads)
    const totalTreadBoards = treads.total + (landing ? landing.boards.total : 0);
    const hardware = {
        clips: Math.ceil(totalTreadBoards * 2),    // 2 clips per board
        screws: Math.ceil(totalTreadBoards * 4)    // 4 screws per board
    };

    return {
        isValid: true,
        dimensions: dims,
        treads,
        risers,
        stringers,
        landing,
        handrails,
        hardware
    };
}

/**
 * Calculate tread board materials
 */
function calculateTreadMaterials(dims, stairConfig) {
    const boardsPerTread = dims.boardsPerTread;
    const numTreads = dims.numTreads;
    const stairWidthFeet = dims.stairWidthFeet;

    // Determine optimal board length for treads
    const boardLength = selectOptimalBoardLength(stairWidthFeet);

    const totalBoards = numTreads * boardsPerTread;
    const linealFeet = totalBoards * boardLength;

    const byLength = { 12: 0, 16: 0, 20: 0 };
    byLength[boardLength] = totalBoards;

    return {
        byLength,
        total: totalBoards,
        linealFeet,
        perTread: boardsPerTread,
        boardLength
    };
}

/**
 * Calculate riser board materials (solid risers)
 */
function calculateRiserMaterials(dims, stairConfig) {
    const numRisers = dims.numRisers;
    const stairWidthFeet = dims.stairWidthFeet;
    const riserHeightInches = dims.actualRise;

    // Risers are typically 1x8 or similar - we'll use deck boards turned on edge
    // One board per riser (may need to be ripped to height)
    const boardLength = selectOptimalBoardLength(stairWidthFeet);

    const byLength = { 12: 0, 16: 0, 20: 0 };
    byLength[boardLength] = numRisers;

    return {
        byLength,
        total: numRisers,
        linealFeet: numRisers * boardLength,
        heightInches: riserHeightInches,
        boardLength
    };
}

/**
 * Calculate stringer materials
 */
function calculateStringerMaterials(dims, stairConfig) {
    // Calculate stringer length using Pythagorean theorem
    const rise = dims.deckHeightInches;
    const run = dims.totalRunInches;
    const stringerLengthInches = Math.sqrt(rise * rise + run * run);
    const stringerLengthFeet = Math.ceil(stringerLengthInches / 12);

    // Number of stringers: 2 outer + 1 center for wider stairs
    let stringerCount = 2;
    if (dims.stairWidthFeet > 3) {
        stringerCount = 3;
    }
    if (dims.stairWidthFeet > 6) {
        stringerCount = 4;
    }

    return {
        count: stringerCount,
        lengthFeet: stringerLengthFeet,
        lengthInches: stringerLengthInches,
        totalLinealFeet: stringerCount * stringerLengthFeet
    };
}

/**
 * Calculate landing materials for L-shaped stairs
 */
function calculateLandingMaterials(dims, stairConfig) {
    if (!dims.lShapedData) return null;

    const landingWidth = dims.stairWidthFeet;
    const landingDepth = dims.lShapedData.landingDepthFeet;
    const landingArea = landingWidth * landingDepth;

    // Calculate boards needed for landing surface
    const boardWidthFt = CONFIG.boards.width / 12;
    const gapFt = CONFIG.boards.gap / 12;
    const effectiveWidth = boardWidthFt + gapFt;
    const numBoardRows = Math.ceil(landingDepth / effectiveWidth);

    const boardLength = selectOptimalBoardLength(landingWidth);

    const byLength = { 12: 0, 16: 0, 20: 0 };
    byLength[boardLength] = numBoardRows;

    return {
        widthFeet: landingWidth,
        depthFeet: landingDepth,
        area: landingArea,
        boards: {
            byLength,
            total: numBoardRows,
            linealFeet: numBoardRows * boardLength
        },
        // Landing frame (joists)
        frame: {
            perimeterFeet: 2 * (landingWidth + landingDepth),
            joistCount: Math.ceil(landingWidth) + 1
        }
    };
}

/**
 * Calculate handrail materials
 */
function calculateHandrailMaterials(dims, stairConfig) {
    const stringerLengthFeet = dims.totalRunFeet + 1; // Add 1 for post at bottom
    const handrailHeight = CONFIG.stairs.handrailHeight / 12; // Convert to feet

    // Posts: one at top, one at bottom, plus intermediate
    const postSpacing = CONFIG.stairs.handrailPostSpacing;
    const numPosts = Math.ceil(stringerLengthFeet / postSpacing) + 1;
    const postHeightFeet = handrailHeight + 0.5; // Extra for mounting

    // Rails: top and bottom on each side
    const railLength = Math.ceil(stringerLengthFeet);
    const numRails = 4; // 2 per side (top and bottom)

    // Balusters
    const balusterSpacing = 4 / 12; // 4 inches in feet
    const balustersPerSide = Math.floor(stringerLengthFeet / balusterSpacing);
    const totalBalusters = balustersPerSide * 2; // Both sides

    return {
        posts: {
            count: numPosts * 2, // Both sides
            heightFeet: postHeightFeet,
            totalLinealFeet: numPosts * 2 * postHeightFeet
        },
        rails: {
            count: numRails,
            lengthFeet: railLength,
            totalLinealFeet: numRails * railLength
        },
        balusters: {
            count: totalBalusters,
            heightFeet: handrailHeight - 0.5, // Between rails
            totalLinealFeet: totalBalusters * (handrailHeight - 0.5)
        }
    };
}

// ===========================================
// STAIR CRUD OPERATIONS
// ===========================================

/**
 * Add a new stair to the specified edge
 */
function addStair(edge) {
    // Check if deck height is sufficient
    if (state.deckHeight < CONFIG.stairs.minDeckHeightForStairs) {
        console.warn('Deck height too low for stairs');
        return null;
    }

    const newStair = {
        id: generateStairId(),
        enabled: true,
        edge: edge,                    // 'front', 'back', 'left', 'right'
        position: 0.5,                 // 0-1, position along edge (0.5 = center)
        width: CONFIG.stairs.defaultWidth,
        boardsPerTread: CONFIG.stairs.boardsPerTread.default,
        shape: 'straight',             // 'straight' or 'l-shaped'
        turnDirection: 'left',         // 'left' or 'right' (for l-shaped)
        includeHandrails: true
    };

    // Record for undo
    if (window.historyManager) {
        window.historyManager.recordAction('ADD_STAIR', { stair: newStair });
    }

    const updatedStairs = [...state.stairs, newStair];
    updateState({ 
        stairs: updatedStairs, 
        selectedStairId: newStair.id,
        stairsEnabled: true 
    });

    return newStair;
}

/**
 * Remove a stair by ID
 */
function removeStair(stairId) {
    const stairToRemove = state.stairs.find(s => s.id === stairId);
    if (!stairToRemove) return false;

    // Record for undo
    if (window.historyManager) {
        window.historyManager.recordAction('REMOVE_STAIR', { stair: stairToRemove });
    }

    const updatedStairs = state.stairs.filter(s => s.id !== stairId);
    const newSelectedId = state.selectedStairId === stairId 
        ? (updatedStairs.length > 0 ? updatedStairs[0].id : null)
        : state.selectedStairId;

    updateState({ 
        stairs: updatedStairs, 
        selectedStairId: newSelectedId,
        stairsEnabled: updatedStairs.length > 0
    });

    return true;
}

/**
 * Update a stair's configuration
 */
function updateStair(stairId, updates) {
    const stairIndex = state.stairs.findIndex(s => s.id === stairId);
    if (stairIndex === -1) return false;

    const oldStair = { ...state.stairs[stairIndex] };

    // Record for undo
    if (window.historyManager) {
        window.historyManager.recordAction('UPDATE_STAIR', { 
            stairId, 
            oldValues: oldStair,
            newValues: updates 
        });
    }

    const updatedStairs = [...state.stairs];
    updatedStairs[stairIndex] = { ...updatedStairs[stairIndex], ...updates };

    updateState({ stairs: updatedStairs });

    return true;
}

/**
 * Select a stair for editing
 */
function selectStair(stairId) {
    updateState({ selectedStairId: stairId });
}

/**
 * Get the currently selected stair
 */
function getSelectedStair() {
    if (!state.selectedStairId) return null;
    return state.stairs.find(s => s.id === state.selectedStairId);
}

/**
 * Validate stair placement (check for overlaps, boundaries)
 */
function validateStairPlacement(stairConfig) {
    const errors = [];
    const warnings = [];

    // Get edge dimension
    const edgeLength = (stairConfig.edge === 'front' || stairConfig.edge === 'back')
        ? state.deckLength
        : state.deckWidth;

    // Check if stair fits on edge
    if (stairConfig.width > edgeLength) {
        errors.push(`Stair width (${stairConfig.width}ft) exceeds edge length (${edgeLength}ft)`);
    }

    // Calculate stair boundaries
    const stairStart = (stairConfig.position * edgeLength) - (stairConfig.width / 2);
    const stairEnd = stairStart + stairConfig.width;

    if (stairStart < 0) {
        errors.push('Stair extends beyond left edge of deck');
    }
    if (stairEnd > edgeLength) {
        errors.push('Stair extends beyond right edge of deck');
    }

    // Check for overlaps with other stairs on same edge
    const sameEdgeStairs = state.stairs.filter(
        s => s.edge === stairConfig.edge && s.id !== stairConfig.id
    );

    for (const otherStair of sameEdgeStairs) {
        const otherStart = (otherStair.position * edgeLength) - (otherStair.width / 2);
        const otherEnd = otherStart + otherStair.width;

        if (!(stairEnd <= otherStart || stairStart >= otherEnd)) {
            errors.push(`Stair overlaps with another stair on the ${stairConfig.edge} edge`);
            break;
        }
    }

    // Check deck height
    if (state.deckHeight < CONFIG.stairs.minDeckHeightForStairs) {
        errors.push(`Deck height (${state.deckHeight}ft) is below minimum for stairs (${CONFIG.stairs.minDeckHeightForStairs}ft)`);
    }

    // Warnings for code compliance
    if (stairConfig.width * 12 < CONFIG.stairs.codeMinWidth) {
        warnings.push(`Stair width is below recommended minimum of ${CONFIG.stairs.codeMinWidth}" for code compliance`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

// ===========================================
// AGGREGATE CALCULATIONS
// ===========================================

/**
 * Calculate all stair materials combined
 */
function calculateAllStairMaterials() {
    if (!state.stairsEnabled || state.stairs.length === 0) {
        return null;
    }

    const combined = {
        treads: { byLength: { 12: 0, 16: 0, 20: 0 }, total: 0, linealFeet: 0 },
        risers: { byLength: { 12: 0, 16: 0, 20: 0 }, total: 0, linealFeet: 0 },
        landing: { boards: { byLength: { 12: 0, 16: 0, 20: 0 }, total: 0, linealFeet: 0 } },
        stringers: { count: 0, totalLinealFeet: 0 },
        handrails: { posts: 0, rails: 0, balusters: 0 },
        hardware: { clips: 0, screws: 0 },
        byStair: []
    };

    for (const stair of state.stairs) {
        const materials = calculateStairMaterials(stair);

        combined.byStair.push({
            id: stair.id,
            edge: stair.edge,
            materials
        });

        if (!materials.isValid) continue;

        // Aggregate treads
        for (const [len, count] of Object.entries(materials.treads.byLength)) {
            combined.treads.byLength[len] += count;
        }
        combined.treads.total += materials.treads.total;
        combined.treads.linealFeet += materials.treads.linealFeet;

        // Aggregate risers
        for (const [len, count] of Object.entries(materials.risers.byLength)) {
            combined.risers.byLength[len] += count;
        }
        combined.risers.total += materials.risers.total;
        combined.risers.linealFeet += materials.risers.linealFeet;

        // Aggregate landing (if any)
        if (materials.landing) {
            for (const [len, count] of Object.entries(materials.landing.boards.byLength)) {
                combined.landing.boards.byLength[len] += count;
            }
            combined.landing.boards.total += materials.landing.boards.total;
            combined.landing.boards.linealFeet += materials.landing.boards.linealFeet;
        }

        // Aggregate stringers
        combined.stringers.count += materials.stringers.count;
        combined.stringers.totalLinealFeet += materials.stringers.totalLinealFeet;

        // Aggregate handrails
        if (materials.handrails) {
            combined.handrails.posts += materials.handrails.posts.count;
            combined.handrails.rails += materials.handrails.rails.count;
            combined.handrails.balusters += materials.handrails.balusters.count;
        }

        // Aggregate hardware
        combined.hardware.clips += materials.hardware.clips;
        combined.hardware.screws += materials.hardware.screws;
    }

    // Apply waste factor
    const wasteFactor = 1 + (state.wastePercent / 100);
    combined.treads.total = Math.ceil(combined.treads.total * wasteFactor);
    combined.risers.total = Math.ceil(combined.risers.total * wasteFactor);
    combined.landing.boards.total = Math.ceil(combined.landing.boards.total * wasteFactor);

    return combined;
}

/**
 * Calculate stair costs
 */
function calculateStairCosts(stairMaterials) {
    if (!stairMaterials) return null;

    // Total decking lineal feet (treads + risers + landing)
    const totalLinealFeet = 
        stairMaterials.treads.linealFeet + 
        stairMaterials.risers.linealFeet + 
        stairMaterials.landing.boards.linealFeet;

    // Material costs
    const materialCostLow = totalLinealFeet * CONFIG.pricing.materialPerLF.min;
    const materialCostHigh = totalLinealFeet * CONFIG.pricing.materialPerLF.max;

    // Stringer cost estimate (pressure treated lumber)
    const stringerCostPerFoot = 3.50; // Approximate cost per linear foot
    const stringerCost = stairMaterials.stringers.totalLinealFeet * stringerCostPerFoot;

    // Hardware cost (clips and screws)
    const additionalClipBoxes = Math.ceil(stairMaterials.hardware.clips / CONFIG.pricing.clipsPerBox);
    const additionalScrewBoxes = Math.ceil(stairMaterials.hardware.screws / CONFIG.pricing.screwsPerBox);
    const hardwareCost = 
        (additionalClipBoxes * CONFIG.pricing.clipBoxPrice) + 
        (additionalScrewBoxes * CONFIG.pricing.screwBoxPrice);

    return {
        materials: {
            low: materialCostLow,
            high: materialCostHigh
        },
        stringers: stringerCost,
        hardware: hardwareCost,
        total: {
            low: materialCostLow + stringerCost + hardwareCost,
            high: materialCostHigh + stringerCost + hardwareCost
        }
    };
}

// ===========================================
// INTEGRATION WITH EXISTING CALCULATEALL
// ===========================================

// Store reference to original calculateAll
const originalCalculateAll = calculateAll;

// Override calculateAll to include stairs
function calculateAllWithStairs() {
    const baseResults = originalCalculateAll();

    // Calculate stair materials
    const stairMaterials = calculateAllStairMaterials();
    const stairCosts = calculateStairCosts(stairMaterials);

    // Store stair results in state
    state.stairResults = stairMaterials;

    // Merge stair data into results
    return {
        ...baseResults,
        stairs: {
            enabled: state.stairsEnabled,
            count: state.stairs.length,
            materials: stairMaterials,
            costs: stairCosts
        }
    };
}

// Replace calculateAll
// Uncomment the line below after integrating:
calculateAll = calculateAllWithStairs;

// ===========================================
// EXPORTS (for module systems) / GLOBAL ACCESS
// ===========================================

// Make functions globally accessible
window.stairFunctions = {
    calculateStairDimensions,
    calculateStairMaterials,
    calculateAllStairMaterials,
    calculateStairCosts,
    addStair,
    removeStair,
    updateStair,
    selectStair,
    getSelectedStair,
    validateStairPlacement,
    generateStairId,
    STAIR_CONFIG,
    STAIR_STATE_DEFAULTS
};

console.log('Agent 1: Stair State/Config/Calculations loaded');
// ============================================================================
// AGENT 7: UNDO/REDO HISTORY MANAGEMENT
// ============================================================================
// Insert this code into app.js after Agent 1's state management
// ============================================================================

class HistoryManager {
    constructor(maxHistorySize = 50) {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = maxHistorySize;
        this.isUndoingOrRedoing = false;
    }
    
    /**
     * Record an action for undo/redo
     */
    recordAction(actionType, data) {
        if (this.isUndoingOrRedoing) return;
        
        // Remove any actions after current index (when recording new action after undo)
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        
        // Create snapshot of current state
        const snapshot = {
            actionType,
            data,
            timestamp: Date.now(),
            previousState: this.captureState()
        };
        
        this.history.push(snapshot);
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }
        
        this.updateUI();
    }
    
    /**
     * Capture current state for undo
     */
    captureState() {
        return {
            stairs: JSON.parse(JSON.stringify(state.stairs)),
            stairsEnabled: state.stairsEnabled,
            selectedStairId: state.selectedStairId
        };
    }
    
    /**
     * Restore state from snapshot
     */
    restoreState(snapshot) {
        this.isUndoingOrRedoing = true;
        
        updateState({
            stairs: JSON.parse(JSON.stringify(snapshot.stairs)),
            stairsEnabled: snapshot.stairsEnabled,
            selectedStairId: snapshot.selectedStairId
        });
        
        this.isUndoingOrRedoing = false;
    }
    
    /**
     * Undo last action
     */
    undo() {
        if (!this.canUndo()) return false;
        
        const snapshot = this.history[this.currentIndex];
        this.restoreState(snapshot.previousState);
        this.currentIndex--;
        this.updateUI();
        
        return true;
    }
    
    /**
     * Redo last undone action
     */
    redo() {
        if (!this.canRedo()) return false;
        
        this.currentIndex++;
        const snapshot = this.history[this.currentIndex];
        
        this.isUndoingOrRedoing = true;
        
        // Re-apply the action
        switch (snapshot.actionType) {
            case 'ADD_STAIR':
                const newStairs = [...state.stairs, snapshot.data.stair];
                updateState({ 
                    stairs: newStairs,
                    stairsEnabled: true,
                    selectedStairId: snapshot.data.stair.id
                });
                break;
            case 'REMOVE_STAIR':
                const filtered = state.stairs.filter(s => s.id !== snapshot.data.stair.id);
                updateState({ 
                    stairs: filtered,
                    selectedStairId: filtered.length > 0 ? filtered[0].id : null,
                    stairsEnabled: filtered.length > 0
                });
                break;
            case 'UPDATE_STAIR':
                const updated = state.stairs.map(s => 
                    s.id === snapshot.data.stairId 
                        ? { ...s, ...snapshot.data.newValues }
                        : s
                );
                updateState({ stairs: updated });
                break;
        }
        
        this.isUndoingOrRedoing = false;
        this.updateUI();
        
        return true;
    }
    
    /**
     * Check if undo is available
     */
    canUndo() {
        return this.currentIndex >= 0;
    }
    
    /**
     * Check if redo is available
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    
    /**
     * Update undo/redo button states
     */
    updateUI() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) {
            undoBtn.disabled = !this.canUndo();
        }
        if (redoBtn) {
            redoBtn.disabled = !this.canRedo();
        }
    }
    
    /**
     * Clear history
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
        this.updateUI();
    }
}

// Initialize history manager
window.historyManager = new HistoryManager();

// Setup keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        window.historyManager.undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        window.historyManager.redo();
    }
});

// Setup button handlers
document.getElementById('undoBtn')?.addEventListener('click', () => {
    window.historyManager.undo();
});

document.getElementById('redoBtn')?.addEventListener('click', () => {
    window.historyManager.redo();
});

console.log('Agent 7: Undo/Redo History Manager loaded');



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
    
    // Error handling: show message if elements missing
    if (!container || !canvas) {
        console.error('initScene failed: container or canvas not found');
        const loadingEl = document.getElementById('sceneLoading');
        if (loadingEl) {
            loadingEl.innerHTML = '<p style="color: #c00; padding: 20px;">Error: Canvas element not found. Please refresh the page.</p>';
        }
        return;
    }
    
    // Check if Three.js loaded
    if (typeof THREE === 'undefined') {
        console.error('initScene failed: THREE.js not loaded');
        const loadingEl = document.getElementById('sceneLoading');
        if (loadingEl) {
            loadingEl.innerHTML = '<p style="color: #c00; padding: 20px;">Error: 3D library failed to load. Check your internet connection and refresh.</p>';
        }
        return;
    }


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

    try {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB);
        // ... keep all existing code until the end of initScene


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
    } catch (error) {
        console.error('initScene error:', error);
        const loadingEl = document.getElementById('sceneLoading');
        if (loadingEl) {
            loadingEl.innerHTML = '<p style="color: #c00; padding: 20px;">Error initializing 3D view: ' + error.message + '</p>';
        }
        sceneInitialized = false;
    }
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
        
        // Use railings with gaps if stairs exist
        if (state.showRailings) {
            if (state.stairsEnabled && state.stairs && state.stairs.length > 0) {
                createRailingsWithStairGaps();
            } else {
                createDetailedRailings();
            }
        }

                // Create stairs if enabled
        if (state.stairsEnabled && state.stairs && state.stairs.length > 0) {
            // Always route through window.stair3DFunctions so the L-shape patch is respected
            if (window.stair3DFunctions) {
                window.stair3DFunctions.initStairGroup();
                window.stair3DFunctions.createStairs();
            } else {
                initStairGroup();
                createStairs();
            }
        }


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

// ============================================================================
// AGENT 2: 3D STAIR GEOMETRY & RENDERING
// ============================================================================
// Insert this code into app.js after the 3D visualization section
// Dependencies: Agent 1 functions (calculateStairDimensions, etc.)
// ============================================================================

// ===========================================
// STAIR GROUP MANAGEMENT
// ===========================================

// ============================================
// STRAIGHT STAIR 3D GEOMETRY (Simplified)
// ============================================

// Stair group management
let stairGroup = null;
let stairMeshes = {};

// Initialize the stair group
function initStairGroup() {
    if (!scene) return;
    if (stairGroup) {
        scene.remove(stairGroup);
        disposeStairGroup();
    }
    stairGroup = new THREE.Group();
    stairGroup.name = 'stairGroup';
    scene.add(stairGroup);
}

// Dispose all stair meshes
function disposeStairGroup() {
    if (!stairGroup) return;
    while (stairGroup.children.length > 0) {
        const child = stairGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
        stairGroup.remove(child);
    }
    stairMeshes = {};
}

// Material creators
function createStringerMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0x8B7355,
        roughness: 0.9,
        metalness: 0.0
    });
}

function createTreadMaterial(colorConfig, boardLength, uniqueId) {
    return createBoardMaterial(colorConfig, boardLength, false, 'stairtread' + uniqueId);
}

function createRiserMaterial(colorConfig, boardLength, uniqueId) {
    return createBoardMaterial(colorConfig, boardLength, false, 'stairriser' + uniqueId);
}

function createHandrailMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        roughness: 0.6,
        metalness: 0.0
    });
}

// Get world position for stair based on edge and position
function getStairWorldPosition(stairConfig, dimensions) {
    const edge = stairConfig.edge;
    const position = stairConfig.position;
    const deckHalfLength = state.deckLength / 2;
    const deckHalfWidth = state.deckWidth / 2;
    
    let x = 0, z = 0;
    let edgeLength;
    
    switch (edge) {
        case 'front':
            edgeLength = state.deckLength;
            x = position * edgeLength - deckHalfLength;
            z = -deckHalfWidth;
            break;
        case 'back':
            edgeLength = state.deckLength;
            x = position * edgeLength - deckHalfLength;
            z = deckHalfWidth;
            break;
        case 'left':
            edgeLength = state.deckWidth;
            x = -deckHalfLength;
            z = position * edgeLength - deckHalfWidth;
            break;
        case 'right':
            edgeLength = state.deckWidth;
            x = deckHalfLength;
            z = position * edgeLength - deckHalfWidth;
            break;
    }
    return { x, z, edgeLength };
}

// Get rotation for stair based on edge
function getStairRotation(edge) {
    switch (edge) {
        case 'front': return 0;
        case 'back': return Math.PI;
        case 'left': return Math.PI / 2;
        case 'right': return -Math.PI / 2;
        default: return 0;
    }
}

// Create all stairs
function createStairs() {
    if (!stairGroup) {
        initStairGroup();
    } else {
        disposeStairGroup();
        stairGroup = new THREE.Group();
        stairGroup.name = 'stairGroup';
        scene.add(stairGroup);
    }
    
    if (!state.stairsEnabled || state.stairs.length === 0) return;
    
    const colorConfig = CONFIG.colors.find(c => c.id === state.mainColor) || CONFIG.colors[0];
    
    for (const stair of state.stairs) {
        // Use the stair's actual shape (l-shaped patch handles dispatch)
        const stairConfig = { ...stair };
        
        const dims = window.stairFunctions.calculateStairDimensions(stairConfig);
        if (!dims.isValid) continue;
        
        const stairMeshGroup = new THREE.Group();
        stairMeshGroup.name = 'stair_' + stair.id;
        stairMeshGroup.userData = { stairId: stair.id, type: 'stair' };
        
        // Create straight stair components
        createStairStringers(stairConfig, dims, stairMeshGroup);
        createStairTreadsAndRisers(stairConfig, dims, stairMeshGroup, colorConfig);
        if (stairConfig.includeHandrails) {
            createStairHandrails(stairConfig, dims, stairMeshGroup);
        }
        
        // Position and rotate the stair group
        const worldPos = getStairWorldPosition(stairConfig, dims);
        const rotation = getStairRotation(stairConfig.edge);
        
        stairMeshGroup.position.set(worldPos.x, 0, worldPos.z);
        stairMeshGroup.rotation.y = rotation;
        
        stairGroup.add(stairMeshGroup);
        stairMeshes[stair.id] = stairMeshGroup;
    }
}

// Create stair stringers (the angled side boards)
function createStairStringers(stairConfig, dims, parentGroup) {
    const stringerMaterial = createStringerMaterial();
    
    const riseTotal = state.deckHeight;
    const runTotal = dims.totalRunFeet;
    const stringerLength = Math.sqrt(riseTotal * riseTotal + runTotal * runTotal);
    const angle = Math.atan2(riseTotal, runTotal);
    
    const stringerThickness = CONFIG.stairs.stringerThickness / 12;
    const stringerWidth = CONFIG.stairs.stringerWidth / 12;
    const stringerInset = CONFIG.stairs.stringerInset / 12;
    
    const stringerGeometry = new THREE.BoxGeometry(
        stringerThickness,
        stringerWidth,
        stringerLength
    );
    
    const halfWidth = dims.stairWidthFeet / 2;
    const positions = [-halfWidth + stringerInset, halfWidth - stringerInset];
    
    
    positions.forEach((xPos) => {
        const stringer = new THREE.Mesh(stringerGeometry.clone(), stringerMaterial);
        
        // Position at center of the stair run
        const centerY = riseTotal / 2;
        const centerZ = -runTotal / 2;
        
        stringer.position.set(xPos, centerY, centerZ);
        stringer.rotation.x = -angle;
        stringer.castShadow = true;
        stringer.receiveShadow = true;
        stringer.userData = { type: 'stringer', stairId: stairConfig.id };
        parentGroup.add(stringer);
    });
}

// Create stair treads and risers
function createStairTreadsAndRisers(stairConfig, dims, parentGroup, colorConfig) {
    const boardWidthFt = CONFIG.boards.width / 12;
    const boardThicknessFt = CONFIG.boards.thickness / 12;
    const gapFt = CONFIG.boards.gap / 12;
    const treadDepthFt = dims.treadDepth / 12;
    const risePerStepFt = dims.actualRise / 12;
    const stairWidthFt = dims.stairWidthFeet;
    
    const boardLength = selectOptimalBoardLength(stairWidthFt);
    
    // Create each step
    for (let step = 0; step < dims.numTreads; step++) {
        const stepY = state.deckHeight - (step + 1) * risePerStepFt;
        const stepZ = -(step + 1) * treadDepthFt + treadDepthFt / 2;
        
        // Create tread boards
        for (let board = 0; board < dims.boardsPerTread; board++) {
            const boardZ = stepZ - treadDepthFt / 2 + board * (boardWidthFt + gapFt) + boardWidthFt / 2;
            
            const treadMaterial = createTreadMaterial(colorConfig, boardLength, `${step}_${board}`);
            const treadGeometry = new THREE.BoxGeometry(stairWidthFt, boardThicknessFt, boardWidthFt);
            const tread = new THREE.Mesh(treadGeometry, treadMaterial);
            
            tread.position.set(0, stepY + boardThicknessFt / 2, boardZ);
            tread.castShadow = true;
            tread.receiveShadow = true;
            tread.userData = { type: 'tread', stairId: stairConfig.id, step, board };
            parentGroup.add(tread);
        }
        
        // Create riser
        const riserY = stepY - risePerStepFt / 2 + boardThicknessFt;
        const riserZ = stepZ - treadDepthFt / 2;
        
        const riserMaterial = createRiserMaterial(colorConfig, boardLength, `riser_${step}`);
        const riserGeometry = new THREE.BoxGeometry(stairWidthFt, risePerStepFt, boardThicknessFt);
        const riser = new THREE.Mesh(riserGeometry, riserMaterial);
        
        riser.position.set(0, riserY, riserZ);
        riser.castShadow = true;
        riser.receiveShadow = true;
        riser.userData = { type: 'riser', stairId: stairConfig.id, step };
        parentGroup.add(riser);
    }
    
    // Final riser at deck level
    const finalRiserY = state.deckHeight - risePerStepFt / 2;
    const finalRiserMaterial = createRiserMaterial(colorConfig, boardLength, 'riser_final');
    const finalRiserGeometry = new THREE.BoxGeometry(stairWidthFt, risePerStepFt, boardThicknessFt);
    const finalRiser = new THREE.Mesh(finalRiserGeometry, finalRiserMaterial);
    
    finalRiser.position.set(0, finalRiserY, 0);
    finalRiser.castShadow = true;
    finalRiser.receiveShadow = true;
    finalRiser.userData = { type: 'riser', stairId: stairConfig.id, step: 'final' };
    parentGroup.add(finalRiser);
}

// Create stair handrails
function createStairHandrails(stairConfig, dims, parentGroup) {
    const handrailMaterial = createHandrailMaterial();
    
    const postHeight = 3;
    const postSize = 0.29;
    const railHeight = 0.29;
    const railThickness = 0.125;
    const balusterSize = 0.125;
    const balusterSpacing = 0.33;
    const bottomRailOffset = 0.25;
    
    const riseTotal = state.deckHeight;
    const runTotal = dims.totalRunFeet;
    const stairAngle = Math.atan2(riseTotal, runTotal);
    const stairLength = Math.sqrt(riseTotal * riseTotal + runTotal * runTotal);
    
    const halfWidth = dims.stairWidthFeet / 2;
    
    // Create handrails for both sides
    [-1, 1].forEach((side) => {
        const xPos = side * halfWidth;
        const sideGroup = new THREE.Group();
        
        // Posts at top and bottom
        const postGeometry = new THREE.BoxGeometry(postSize, postHeight, postSize);
        
        // Top post at deck level
        const topPost = new THREE.Mesh(postGeometry, handrailMaterial);
        topPost.position.set(xPos, state.deckHeight + postHeight / 2, 0);
        topPost.castShadow = true;
        sideGroup.add(topPost);
        
        // Bottom post at ground level
        const bottomPost = new THREE.Mesh(postGeometry, handrailMaterial);
        bottomPost.position.set(xPos, postHeight / 2, -runTotal);
        bottomPost.castShadow = true;
        sideGroup.add(bottomPost);
        
        // Top rail (angled along stair)
        const topRailGeometry = new THREE.BoxGeometry(railThickness, railHeight, stairLength);
        const topRail = new THREE.Mesh(topRailGeometry, handrailMaterial);
        const railCenterY = state.deckHeight + postHeight - railHeight / 2 - riseTotal / 2;
        const railCenterZ = -runTotal / 2;
        topRail.position.set(xPos, railCenterY, railCenterZ);
        topRail.rotation.x = -stairAngle;
        topRail.castShadow = true;
        sideGroup.add(topRail);
        
        // Bottom rail
        const bottomRailGeometry = new THREE.BoxGeometry(railThickness, railHeight, stairLength);
        const bottomRail = new THREE.Mesh(bottomRailGeometry, handrailMaterial);
        const bottomRailY = railCenterY - (postHeight - bottomRailOffset - railHeight);
        bottomRail.position.set(xPos, bottomRailY, railCenterZ);
        bottomRail.rotation.x = -stairAngle;
        bottomRail.castShadow = true;
        sideGroup.add(bottomRail);
        
        // Balusters
        const numBalusters = Math.floor(runTotal / balusterSpacing);
        const balusterHeight = postHeight - railHeight - bottomRailOffset - railHeight;
        const balusterGeometry = new THREE.BoxGeometry(balusterSize, balusterHeight, balusterSize);
        
        for (let i = 1; i < numBalusters; i++) {
            const t = i / numBalusters;
            const balusterZ = -t * runTotal;
            const balusterY = state.deckHeight - t * riseTotal + bottomRailOffset + railHeight + balusterHeight / 2;
            
            const baluster = new THREE.Mesh(balusterGeometry, handrailMaterial);
            baluster.position.set(xPos, balusterY, balusterZ);
            baluster.castShadow = true;
            sideGroup.add(baluster);
        }
        
        parentGroup.add(sideGroup);
    });
}

// ===========================================
// HIGHLIGHT/SELECTION VISUAL FEEDBACK
// ===========================================

/**
 * Highlight a stair (for hover or selection)
 */
function highlightStair(stairId, highlight = true) {
    const meshGroup = stairMeshes[stairId];
    if (!meshGroup) return;

    meshGroup.traverse(child => {
        if (child.isMesh && child.userData.type !== 'stringer') {
            if (highlight) {
                child.userData.originalEmissive = child.material.emissive?.getHex() || 0x000000;
                if (child.material.emissive) {
                    child.material.emissive.setHex(0x333333);
                }
            } else {
                if (child.material.emissive && child.userData.originalEmissive !== undefined) {
                    child.material.emissive.setHex(child.userData.originalEmissive);
                }
            }
        }
    });
}

/**
 * Show drag preview for stair positioning
 */
function showStairDragPreview(stairId, newPosition) {
    const meshGroup = stairMeshes[stairId];
    if (!meshGroup) return;

    const stair = state.stairs.find(s => s.id === stairId);
    if (!stair) return;

    const tempStair = { ...stair, position: newPosition };
    const dims = window.stairFunctions.calculateStairDimensions(tempStair);
    const worldPos = getStairWorldPosition(tempStair, dims);

    meshGroup.position.set(worldPos.x, 0, worldPos.z);
}

// ===========================================
// EXPORTS / GLOBAL ACCESS
// ===========================================

// Make functions globally accessible (including highlight/drag preview)
window.stair3DFunctions = {
    initStairGroup,
    disposeStairGroup,
    createStairs,
    createStraightStair: createStairs,
    getStairWorldPosition,
    getStairRotation,
    highlightStair,
    showStairDragPreview,
    stairMeshes: () => stairMeshes,
    stairGroup: () => stairGroup
};

console.log('Straight Stair 3D Geometry loaded');


// ============================================================================
// AGENT 3: DRAG INTERACTION & RAILING INTEGRATION
// ============================================================================
// Insert this code into app.js after Agent 2's 3D geometry code
// Dependencies: Agent 1 (state), Agent 2 (3D functions)
// ============================================================================

// ===========================================
// DRAG STATE MANAGEMENT
// ===========================================

const dragState = {
    isDragging: false,
    selectedStairId: null,
    startPosition: null,
    startMousePosition: null,
    currentEdge: null,
    edgeLength: 0,
    plane: null,           // THREE.Plane for raycasting
    offset: new THREE.Vector3()
};

let raycaster = null;
let mouse = new THREE.Vector2();

// ===========================================
// INITIALIZATION
// ===========================================

/**
 * Initialize stair drag controls
 * Call this after initScene()
 */
function initStairDragControls() {
    if (!renderer || !camera) {
        console.warn('Renderer or camera not initialized for drag controls');
        return;
    }

    raycaster = new THREE.Raycaster();

    const canvas = renderer.domElement;

    // Mouse events
    canvas.addEventListener('mousedown', onStairMouseDown, false);
    canvas.addEventListener('mousemove', onStairMouseMove, false);
    canvas.addEventListener('mouseup', onStairMouseUp, false);

    // Touch events for mobile
    canvas.addEventListener('touchstart', onStairTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onStairTouchMove, { passive: false });
    canvas.addEventListener('touchend', onStairTouchEnd, false);

    // Cursor style management
    canvas.addEventListener('mousemove', updateCursorStyle, false);

    console.log('Stair drag controls initialized');
}

// ===========================================
// MOUSE/TOUCH EVENT HANDLERS
// ===========================================

/**
 * Handle mouse down on canvas
 */
function onStairMouseDown(event) {
    if (!state.stairsEnabled || state.stairs.length === 0) return;

    event.preventDefault();

    updateMousePosition(event);

    const intersectedStair = getIntersectedStair();

    if (intersectedStair) {
        startDrag(intersectedStair.stairId, event);
    }
}

/**
 * Handle mouse move on canvas
 */
function onStairMouseMove(event) {
    if (!dragState.isDragging) return;

    event.preventDefault();

    updateMousePosition(event);
    updateDragPosition();
}

/**
 * Handle mouse up on canvas
 */
function onStairMouseUp(event) {
    if (!dragState.isDragging) return;

    event.preventDefault();

    endDrag();
}

/**
 * Handle touch start
 */
function onStairTouchStart(event) {
    if (!state.stairsEnabled || state.stairs.length === 0) return;
    if (event.touches.length !== 1) return;

    event.preventDefault();

    updateMousePositionFromTouch(event.touches[0]);

    const intersectedStair = getIntersectedStair();

    if (intersectedStair) {
        startDrag(intersectedStair.stairId, event.touches[0]);
    }
}

/**
 * Handle touch move
 */
function onStairTouchMove(event) {
    if (!dragState.isDragging) return;
    if (event.touches.length !== 1) return;

    event.preventDefault();

    updateMousePositionFromTouch(event.touches[0]);
    updateDragPosition();
}

/**
 * Handle touch end
 */
function onStairTouchEnd(event) {
    if (!dragState.isDragging) return;

    event.preventDefault();

    endDrag();
}

// ===========================================
// RAYCASTING & INTERSECTION
// ===========================================

/**
 * Update mouse position for raycasting
 */
function updateMousePosition(event) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

/**
 * Update mouse position from touch event
 */
function updateMousePositionFromTouch(touch) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
}

/**
 * Get the stair mesh that the mouse is hovering over
 */
function getIntersectedStair() {
    if (!raycaster || !camera || !window.stair3DFunctions) return null;

    const stairGroup = window.stair3DFunctions.stairGroup();
    if (!stairGroup || stairGroup.children.length === 0) return null;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(stairGroup.children, true);

    for (const intersect of intersects) {
        // Walk up the parent chain to find the stair group
        let obj = intersect.object;
        while (obj) {
            if (obj.userData && obj.userData.stairId) {
                return {
                    stairId: obj.userData.stairId,
                    object: obj,
                    point: intersect.point
                };
            }
            obj = obj.parent;
        }
    }

    return null;
}

/**
 * Update cursor style based on hover state
 */
function updateCursorStyle(event) {
    if (dragState.isDragging) {
        renderer.domElement.style.cursor = 'grabbing';
        return;
    }

    if (!state.stairsEnabled || state.stairs.length === 0) {
        renderer.domElement.style.cursor = 'default';
        return;
    }

    updateMousePosition(event);

    const intersectedStair = getIntersectedStair();

    if (intersectedStair) {
        renderer.domElement.style.cursor = 'grab';

        // Highlight on hover
        if (window.stair3DFunctions) {
            // Clear previous highlights
            state.stairs.forEach(s => {
                if (s.id !== intersectedStair.stairId) {
                    window.stair3DFunctions.highlightStair(s.id, false);
                }
            });
            // Highlight current
            window.stair3DFunctions.highlightStair(intersectedStair.stairId, true);
        }
    } else {
        renderer.domElement.style.cursor = 'default';

        // Clear all highlights
        if (window.stair3DFunctions) {
            state.stairs.forEach(s => {
                window.stair3DFunctions.highlightStair(s.id, false);
            });
        }
    }
}

// ===========================================
// DRAG OPERATIONS
// ===========================================

/**
 * Start dragging a stair
 */
function startDrag(stairId, event) {
    const stair = state.stairs.find(s => s.id === stairId);
    if (!stair) return;

    // Disable orbit controls while dragging
    if (controls) {
        controls.enabled = false;
    }

    dragState.isDragging = true;
    dragState.selectedStairId = stairId;
    dragState.startPosition = stair.position;
    dragState.currentEdge = stair.edge;

    // Calculate edge length
    dragState.edgeLength = (stair.edge === 'front' || stair.edge === 'back')
        ? state.deckLength
        : state.deckWidth;

    // Create a horizontal plane at deck height for raycasting
    dragState.plane = new THREE.Plane(
        new THREE.Vector3(0, 1, 0),
        -state.deckHeight
    );

    // Select this stair in the UI
    if (window.stairFunctions) {
        window.stairFunctions.selectStair(stairId);
    }

    // Update cursor
    renderer.domElement.style.cursor = 'grabbing';

    // Highlight the stair
    if (window.stair3DFunctions) {
        window.stair3DFunctions.highlightStair(stairId, true);
    }
}

/**
 * Update position during drag
 */
function updateDragPosition() {
    if (!dragState.isDragging || !dragState.selectedStairId) return;

    raycaster.setFromCamera(mouse, camera);

    // Find intersection with the drag plane
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragState.plane, intersectPoint);

    if (!intersectPoint) return;

    // Convert 3D point to position along edge (0-1)
    const newPosition = getEdgePositionFromWorldPoint(
        dragState.currentEdge,
        intersectPoint
    );

    // Clamp position to keep stair on deck
    const stair = state.stairs.find(s => s.id === dragState.selectedStairId);
    if (!stair) return;

    const halfWidthRatio = (stair.width / 2) / dragState.edgeLength;
    const clampedPosition = Math.max(halfWidthRatio, Math.min(1 - halfWidthRatio, newPosition));

    // Update visual preview
    if (window.stair3DFunctions) {
        window.stair3DFunctions.showStairDragPreview(dragState.selectedStairId, clampedPosition);
    }

    // Store for final update
    dragState.currentPosition = clampedPosition;
}

/**
 * End drag operation
 */
function endDrag() {
    if (!dragState.isDragging) return;

    // Re-enable orbit controls
    if (controls) {
        controls.enabled = true;
    }

    // Apply the final position
    if (dragState.selectedStairId && dragState.currentPosition !== undefined) {
        // Check for valid placement
        const stair = state.stairs.find(s => s.id === dragState.selectedStairId);
        if (stair) {
            const testStair = { ...stair, position: dragState.currentPosition };
            const validation = window.stairFunctions.validateStairPlacement(testStair);

            if (validation.isValid) {
                window.stairFunctions.updateStair(dragState.selectedStairId, {
                    position: dragState.currentPosition
                });
            } else {
                // Reset to original position
                if (window.stair3DFunctions) {
                    window.stair3DFunctions.showStairDragPreview(
                        dragState.selectedStairId,
                        dragState.startPosition
                    );
                }
                // Show error
                console.warn('Invalid stair placement:', validation.errors);
            }
        }
    }

    // Clear highlight
    if (window.stair3DFunctions && dragState.selectedStairId) {
        window.stair3DFunctions.highlightStair(dragState.selectedStairId, false);
    }

    // Reset drag state
    dragState.isDragging = false;
    dragState.selectedStairId = null;
    dragState.startPosition = null;
    dragState.currentPosition = undefined;
    dragState.plane = null;

    // Reset cursor
    renderer.domElement.style.cursor = 'default';
}

/**
 * Convert world point to edge position (0-1)
 */
function getEdgePositionFromWorldPoint(edge, worldPoint) {
    const deckHalfLength = state.deckLength / 2;
    const deckHalfWidth = state.deckWidth / 2;

    let position;

    switch (edge) {
        case 'front':
        case 'back':
            // Position along X axis (length)
            position = (worldPoint.x + deckHalfLength) / state.deckLength;
            break;
        case 'left':
        case 'right':
            // Position along Z axis (width)
            position = (worldPoint.z + deckHalfWidth) / state.deckWidth;
            break;
        default:
            position = 0.5;
    }

    return Math.max(0, Math.min(1, position));
}

// ===========================================
// RAILING GAP INTEGRATION
// ===========================================

/**
 * Calculate railing gaps for all stairs
 * Returns an object with gaps per edge
 */
function calculateRailingGaps() {
    if (!state.stairsEnabled || state.stairs.length === 0) {
        return { front: [], back: [], left: [], right: [] };
    }

    const gaps = { front: [], back: [], left: [], right: [] };

    for (const stair of state.stairs) {
        const edgeLength = (stair.edge === 'front' || stair.edge === 'back')
            ? state.deckLength
            : state.deckWidth;

        const gapStart = (stair.position * edgeLength) - (stair.width / 2);
        const gapEnd = gapStart + stair.width;

        gaps[stair.edge].push({
            stairId: stair.id,
            start: gapStart,
            end: gapEnd,
            width: stair.width,
            position: stair.position
        });
    }

    // Sort gaps by position for each edge
    Object.keys(gaps).forEach(edge => {
        gaps[edge].sort((a, b) => a.start - b.start);
    });

    return gaps;
}

/**
 * Create railings with gaps for stairs
 * This replaces the original createDetailedRailings function when stairs are present
 */
function createRailingsWithStairGaps() {
    if (!state.showRailings) return;

    const gaps = calculateRailingGaps();
    const hasGaps = Object.values(gaps).some(edgeGaps => edgeGaps.length > 0);

    if (!hasGaps) {
        // No stairs, use original railing function
        createDetailedRailings();
        return;
    }

    // Railing parameters (matching original)
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

    const deckSurface = state.deckHeight;
    const topRailY = deckSurface + postHeight - railHeight / 2;
    const bottomRailY = deckSurface + bottomRailOffset + railHeight / 2;
    const balusterY = deckSurface + bottomRailOffset + railHeight + balusterHeight / 2;

    // Define sides with gap checking
    const sides = [
        {
            edge: 'front',
            start: [-state.deckLength / 2, -state.deckWidth / 2],
            end: [state.deckLength / 2, -state.deckWidth / 2],
            length: state.deckLength,
            axis: 'x',
            gaps: gaps.front
        },
        {
            edge: 'right',
            start: [state.deckLength / 2, -state.deckWidth / 2],
            end: [state.deckLength / 2, state.deckWidth / 2],
            length: state.deckWidth,
            axis: 'z',
            gaps: gaps.right
        },
        {
            edge: 'back',
            start: [state.deckLength / 2, state.deckWidth / 2],
            end: [-state.deckLength / 2, state.deckWidth / 2],
            length: state.deckLength,
            axis: 'x',
            gaps: gaps.back
        },
        {
            edge: 'left',
            start: [-state.deckLength / 2, state.deckWidth / 2],
            end: [-state.deckLength / 2, -state.deckWidth / 2],
            length: state.deckWidth,
            axis: 'z',
            gaps: gaps.left
        }
    ];

    sides.forEach(side => {
        if (side.gaps.length === 0) {
            // No gaps on this side, create full railing
            createRailingSegment(
                side.start, side.end, side.length, side.axis,
                postMaterial, railMaterial, balusterMaterial,
                postGeometry, balusterGeometry,
                postHeight, postSize, railHeight, railThickness,
                balusterSize, balusterSpacing, bottomRailOffset,
                deckSurface, topRailY, bottomRailY, balusterY, balusterHeight
            );
        } else {
            // Create segmented railings around gaps
            createSegmentedRailing(
                side, side.gaps,
                postMaterial, railMaterial, balusterMaterial,
                postGeometry, balusterGeometry,
                postHeight, postSize, railHeight, railThickness,
                balusterSize, balusterSpacing, bottomRailOffset,
                deckSurface, topRailY, bottomRailY, balusterY, balusterHeight
            );
        }
    });

    // Create posts at corners
    const cornerPositions = [
        [-state.deckLength / 2, -state.deckWidth / 2],
        [state.deckLength / 2, -state.deckWidth / 2],
        [state.deckLength / 2, state.deckWidth / 2],
        [-state.deckLength / 2, state.deckWidth / 2]
    ];

    cornerPositions.forEach(([x, z]) => {
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(x, deckSurface + postHeight / 2, z);
        post.castShadow = true;
        deckGroup.add(post);
    });
}

/**
 * Create a single railing segment
 */
function createRailingSegment(
    start, end, length, axis,
    postMaterial, railMaterial, balusterMaterial,
    postGeometry, balusterGeometry,
    postHeight, postSize, railHeight, railThickness,
    balusterSize, balusterSpacing, bottomRailOffset,
    deckSurface, topRailY, bottomRailY, balusterY, balusterHeight
) {
    const postSpacing = 6;

    // Intermediate posts
    const numPosts = Math.floor(length / postSpacing) - 1;
    for (let i = 1; i <= numPosts; i++) {
        const t = i / (numPosts + 1);
        const x = start[0] + t * (end[0] - start[0]);
        const z = start[1] + t * (end[1] - start[1]);

        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(x, deckSurface + postHeight / 2, z);
        post.castShadow = true;
        deckGroup.add(post);
    }

    // Top rail
    const topRailGeometry = new THREE.BoxGeometry(
        axis === 'x' ? length : railThickness,
        railHeight,
        axis === 'z' ? length : railThickness
    );
    const topRail = new THREE.Mesh(topRailGeometry, railMaterial);
    topRail.position.set(
        (start[0] + end[0]) / 2,
        topRailY,
        (start[1] + end[1]) / 2
    );
    topRail.castShadow = true;
    deckGroup.add(topRail);

    // Bottom rail
    const bottomRailGeometry = new THREE.BoxGeometry(
        axis === 'x' ? length : railThickness,
        railHeight,
        axis === 'z' ? length : railThickness
    );
    const bottomRail = new THREE.Mesh(bottomRailGeometry, railMaterial);
    bottomRail.position.set(
        (start[0] + end[0]) / 2,
        bottomRailY,
        (start[1] + end[1]) / 2
    );
    bottomRail.castShadow = true;
    deckGroup.add(bottomRail);

    // Balusters
    const numBalusters = Math.floor(length / balusterSpacing);
    for (let i = 1; i < numBalusters; i++) {
        const t = i / numBalusters;
        const x = start[0] + t * (end[0] - start[0]);
        const z = start[1] + t * (end[1] - start[1]);

        const baluster = new THREE.Mesh(balusterGeometry, balusterMaterial);
        baluster.position.set(x, balusterY, z);
        baluster.castShadow = true;
        deckGroup.add(baluster);
    }
}

/**
 * Create segmented railing with gaps for stairs
 */
function createSegmentedRailing(
    side, gaps,
    postMaterial, railMaterial, balusterMaterial,
    postGeometry, balusterGeometry,
    postHeight, postSize, railHeight, railThickness,
    balusterSize, balusterSpacing, bottomRailOffset,
    deckSurface, topRailY, bottomRailY, balusterY, balusterHeight
) {
    // Create railing segments between gaps
    let currentStart = 0;

    gaps.forEach((gap, index) => {
        const segmentLength = gap.start - currentStart;

        if (segmentLength > 0.5) { // Minimum segment length
            // Calculate segment start/end points
            const t1 = currentStart / side.length;
            const t2 = gap.start / side.length;

            const segStart = [
                side.start[0] + t1 * (side.end[0] - side.start[0]),
                side.start[1] + t1 * (side.end[1] - side.start[1])
            ];
            const segEnd = [
                side.start[0] + t2 * (side.end[0] - side.start[0]),
                side.start[1] + t2 * (side.end[1] - side.start[1])
            ];

            createRailingSegment(
                segStart, segEnd, segmentLength, side.axis,
                postMaterial, railMaterial, balusterMaterial,
                postGeometry, balusterGeometry,
                postHeight, postSize, railHeight, railThickness,
                balusterSize, balusterSpacing, bottomRailOffset,
                deckSurface, topRailY, bottomRailY, balusterY, balusterHeight
            );

            // Create post at gap start (connects to stair handrail)
            const gapStartPost = new THREE.Mesh(postGeometry, postMaterial);
            gapStartPost.position.set(segEnd[0], deckSurface + postHeight / 2, segEnd[1]);
            gapStartPost.castShadow = true;
            gapStartPost.userData = { type: 'stairConnectionPost', stairId: gap.stairId };
            deckGroup.add(gapStartPost);
        }

        // Create post at gap end
        const t3 = gap.end / side.length;
        const gapEndPos = [
            side.start[0] + t3 * (side.end[0] - side.start[0]),
            side.start[1] + t3 * (side.end[1] - side.start[1])
        ];

        const gapEndPost = new THREE.Mesh(postGeometry, postMaterial);
        gapEndPost.position.set(gapEndPos[0], deckSurface + postHeight / 2, gapEndPos[1]);
        gapEndPost.castShadow = true;
        gapEndPost.userData = { type: 'stairConnectionPost', stairId: gap.stairId };
        deckGroup.add(gapEndPost);

        currentStart = gap.end;
    });

    // Create final segment after last gap
    const finalSegmentLength = side.length - currentStart;

    if (finalSegmentLength > 0.5) {
        const t1 = currentStart / side.length;
        const segStart = [
            side.start[0] + t1 * (side.end[0] - side.start[0]),
            side.start[1] + t1 * (side.end[1] - side.start[1])
        ];

        createRailingSegment(
            segStart, side.end, finalSegmentLength, side.axis,
            postMaterial, railMaterial, balusterMaterial,
            postGeometry, balusterGeometry,
            postHeight, postSize, railHeight, railThickness,
            balusterSize, balusterSpacing, bottomRailOffset,
            deckSurface, topRailY, bottomRailY, balusterY, balusterHeight
        );
    }
}

// ===========================================
// MODIFIED BUILD DECK INTEGRATION
// ===========================================

/**
 * Override/extend the buildDeck function to include stairs and railing gaps
 * Call this setup function after app initialization
 */
function setupStairBuildIntegration() {
    // Store reference to original executeBuildDeck if it exists
    const originalExecuteBuildDeck = window.executeBuildDeck || executeBuildDeck;

    // Create new function that includes stairs
    window.executeBuildDeckWithStairs = function() {
        if (!deckGroup || !sceneInitialized || contextLost) return;

        showLoadingSpinner();
        isBuilding = true;

        // Clear existing meshes
        while (deckGroup.children.length > 0) {
            deckGroup.remove(deckGroup.children[0]);
        }

        const colorConfig = CONFIG.colors.find(c => c.id === state.mainColor) || CONFIG.colors[0];

        try {
            createSupportPosts();
            createJoists();
            createDeckBoardsWithSegments(determinePattern(), colorConfig);
            createWhiteFascia();

            // Use railings with gaps if stairs exist
            if (state.showRailings) {
                if (state.stairsEnabled && state.stairs.length > 0) {
                    createRailingsWithStairGaps();
                } else {
                    createDetailedRailings();
                }
            }

            // Create stairs
            if (state.stairsEnabled && state.stairs.length > 0) {
                if (window.stair3DFunctions) {
                    window.stair3DFunctions.createStairs();
                }
            }

            controls.target.set(0, state.deckHeight, 0);
            const maxDim = Math.max(state.deckLength, state.deckWidth);
            camera.position.set(maxDim * 1.5, state.deckHeight + maxDim * 1.05, maxDim * 1.5);

            updateBoardLegend();

        } catch (e) {
            console.error('Error building deck:', e);
        }

        isBuilding = false;
        setTimeout(hideLoadingSpinner, 100);

        if (pendingBuild) {
            pendingBuild = false;
            debouncedBuildDeck();
        }
    };
}

// ===========================================
// EXPORTS / GLOBAL ACCESS
// ===========================================

window.stairDragFunctions = {
    initStairDragControls,
    calculateRailingGaps,
    createRailingsWithStairGaps,
    setupStairBuildIntegration,
    getDragState: () => dragState
};

console.log('Agent 3: Stair Drag & Railing Integration loaded');


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

// ============================================================================
// AGENT 4: UI EVENT HANDLERS & PANEL LOGIC
// ============================================================================
// Insert this code into app.js after Agent 3's drag/railing code
// Dependencies: Agent 1 (state/functions), Agent 2 (3D), Agent 3 (drag)
// ============================================================================

// ===========================================
// INITIALIZATION
// ===========================================

/**
 * Initialize all stair UI components
 * Call this from initializeApp() after initUI()
 */
function initStairUI() {
    setupStairEventListeners();
    updateStairPanel();
    updateStairWarning();

    // Subscribe to state changes for stair UI updates
    subscribe(onStateChangeForStairs);

    console.log('Stair UI initialized');
}

/**
 * Handle state changes relevant to stairs
 */
function onStateChangeForStairs(newState) {
    updateStairPanel();
    updateStairWarning();
    updateStairEstimateSummary();
    updateStairReviewSummary();
}

// ===========================================
// EVENT LISTENERS
// ===========================================

/**
 * Setup all stair-related event listeners
 */
function setupStairEventListeners() {
    // Enable stairs checkbox
    const enableStairsCheckbox = document.getElementById('enableStairs');
    if (enableStairsCheckbox) {
        enableStairsCheckbox.addEventListener('change', (e) => {
            const enabled = e.target.checked;

            if (enabled && state.deckHeight < CONFIG.stairs.minDeckHeightForStairs) {
                e.target.checked = false;
                showStairWarning(`Deck height must be at least ${CONFIG.stairs.minDeckHeightForStairs} ft for stairs.`);
                return;
            }

            updateState({ stairsEnabled: enabled });

            const stairPanel = document.getElementById('stairPanel');
            if (stairPanel) {
                stairPanel.classList.toggle('hidden', !enabled);
            }
        });
    }

    document.querySelectorAll('.stair-edge-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Use 'this' to reference the button itself, not e.target
        // This ensures we get the data-edge even if user clicks on icon inside button
        const edge = this.getAttribute('data-edge') || this.dataset.edge;
        
        console.log('Stair button clicked, edge:', edge);  // Debug line
        
        if (edge) {
            onAddStairClick(edge);
        } else {
            console.error('No edge found on button:', this);
        }
    });
});


    // Delete stair button
    const deleteStairBtn = document.getElementById('deleteStairBtn');
    if (deleteStairBtn) {
        deleteStairBtn.addEventListener('click', () => {
            if (state.selectedStairId) {
                onRemoveStairClick(state.selectedStairId);
            }
        });
    }

    // Stair width slider/input
    const stairWidthSlider = document.getElementById('stairWidthSlider');
    const stairWidthInput = document.getElementById('stairWidthInput');

    if (stairWidthSlider && stairWidthInput) {
        stairWidthSlider.addEventListener('input', (e) => {
            stairWidthInput.value = e.target.value;
            onStairConfigChange('width', parseFloat(e.target.value));
        });

        stairWidthInput.addEventListener('change', (e) => {
            const val = Math.max(CONFIG.stairs.minWidth, 
                        Math.min(CONFIG.stairs.maxWidth, parseFloat(e.target.value) || CONFIG.stairs.defaultWidth));
            e.target.value = val;
            stairWidthSlider.value = val;
            onStairConfigChange('width', val);
        });
    }

    // Boards per tread radio buttons
    document.querySelectorAll('input[name="boardsPerTread"]').forEach(input => {
        input.addEventListener('change', (e) => {
            // Update selected style
            document.querySelectorAll('input[name="boardsPerTread"]').forEach(radio => {
                radio.closest('.radio-card').classList.remove('selected');
            });
            e.target.closest('.radio-card').classList.add('selected');

            onStairConfigChange('boardsPerTread', parseInt(e.target.value));
            updateTreadPreview(parseInt(e.target.value));
        });
    });

    // Stair shape radio buttons
    document.querySelectorAll('input[name="stairShape"]').forEach(input => {
        input.addEventListener('change', (e) => {
            // Update selected style
            document.querySelectorAll('input[name="stairShape"]').forEach(radio => {
                radio.closest('.radio-card').classList.remove('selected');
            });
            e.target.closest('.radio-card').classList.add('selected');

            onStairConfigChange('shape', e.target.value);

            // Show/hide turn direction
            const turnDirectionGroup = document.getElementById('turnDirectionGroup');
            if (turnDirectionGroup) {
                turnDirectionGroup.classList.toggle('hidden', e.target.value !== 'l-shaped');
            }
        });
    });

    // Turn direction radio buttons
    document.querySelectorAll('input[name="turnDirection"]').forEach(input => {
        input.addEventListener('change', (e) => {
            document.querySelectorAll('input[name="turnDirection"]').forEach(radio => {
                radio.closest('.radio-card').classList.remove('selected');
            });
            e.target.closest('.radio-card').classList.add('selected');

            onStairConfigChange('turnDirection', e.target.value);
        });
    });

    // Stair handrails checkbox
    const stairHandrailsCheckbox = document.getElementById('stairHandrails');
    if (stairHandrailsCheckbox) {
        stairHandrailsCheckbox.addEventListener('change', (e) => {
            onStairConfigChange('includeHandrails', e.target.checked);
        });
    }
}

// ===========================================
// STAIR CRUD UI HANDLERS
// ===========================================

/**
 * Handle add stair button click
 */
function onAddStairClick(edge) {
    if (state.deckHeight < CONFIG.stairs.minDeckHeightForStairs) {
        showStairWarning(`Deck height must be at least ${CONFIG.stairs.minDeckHeightForStairs} ft for stairs.`);
        return;
    }

    const newStair = window.stairFunctions.addStair(edge);

    if (newStair) {
        renderStairList();
        showStairEditor(newStair.id);
        updateTreadPreview(newStair.boardsPerTread);
        updateStairInfo(newStair);
    }
}

/**
 * Handle remove stair button click
 */
function onRemoveStairClick(stairId) {
    const success = window.stairFunctions.removeStair(stairId);

    if (success) {
        renderStairList();

        // Hide editor if no stairs left
        if (state.stairs.length === 0) {
            hideStairEditor();
        } else {
            // Show editor for first remaining stair
            showStairEditor(state.stairs[0].id);
        }
    }
}

/**
 * Handle stair configuration changes
 */
function onStairConfigChange(property, value) {
    if (!state.selectedStairId) return;

    window.stairFunctions.updateStair(state.selectedStairId, { [property]: value });

    // Update UI elements that depend on this change
    const selectedStair = window.stairFunctions.getSelectedStair();
    if (selectedStair) {
        updateStairInfo(selectedStair);

        if (property === 'boardsPerTread') {
            updateTreadPreview(value);
        }
    }
}

// ===========================================
// STAIR PANEL UPDATES
// ===========================================

/**
 * Update the entire stair panel based on current state
 */
function updateStairPanel() {
    const enableCheckbox = document.getElementById('enableStairs');
    const stairPanel = document.getElementById('stairPanel');

    if (enableCheckbox) {
        enableCheckbox.checked = state.stairsEnabled;
    }

    if (stairPanel) {
        stairPanel.classList.toggle('hidden', !state.stairsEnabled);
    }

    if (state.stairsEnabled) {
        renderStairList();

        if (state.selectedStairId) {
            showStairEditor(state.selectedStairId);
        } else if (state.stairs.length > 0) {
            showStairEditor(state.stairs[0].id);
        } else {
            hideStairEditor();
        }
    }
}

/**
 * Update the stair warning message
 */
function updateStairWarning() {
    const warningEl = document.getElementById('stairWarning');
    const enableCheckbox = document.getElementById('enableStairs');

    if (!warningEl) return;

    const deckTooLow = state.deckHeight < CONFIG.stairs.minDeckHeightForStairs;

    warningEl.classList.toggle('hidden', !deckTooLow);

    if (enableCheckbox) {
        enableCheckbox.disabled = deckTooLow;
    }

    // If deck becomes too low while stairs enabled, disable stairs
    if (deckTooLow && state.stairsEnabled) {
        updateState({ stairsEnabled: false, stairs: [] });
    }
}

/**
 * Show a temporary warning message
 */
function showStairWarning(message) {
    const warningEl = document.getElementById('stairWarning');
    if (!warningEl) return;

    const warningText = warningEl.querySelector('span');
    if (warningText) {
        warningText.textContent = message;
    }

    warningEl.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        updateStairWarning(); // Reset to default state
    }, 5000);
}

// ===========================================
// STAIR LIST RENDERING
// ===========================================

/**
 * Render the list of stairs
 */
function renderStairList() {
    const listContainer = document.getElementById('stairList');
    if (!listContainer) return;

    if (state.stairs.length === 0) {
        listContainer.innerHTML = `
            <div class="stair-list-empty">
                <p>No stairs added yet. Click an edge button below to add stairs.</p>
            </div>
        `;
        return;
    }

    const edgeLabels = {
        front: 'Front',
        back: 'Back',
        left: 'Left',
        right: 'Right'
    };

    listContainer.innerHTML = state.stairs.map(stair => {
        const dims = window.stairFunctions.calculateStairDimensions(stair);
        const isSelected = stair.id === state.selectedStairId;

        return `
            <div class="stair-list-item ${isSelected ? 'selected' : ''}" 
                 data-stair-id="${stair.id}">
                <div class="stair-list-item-edge">
                    <span class="stair-edge-badge ${stair.edge}">${edgeLabels[stair.edge]}</span>
                </div>
                <div class="stair-list-item-info">
                    <span class="stair-info-width">${stair.width}ft wide</span>
                    <span class="stair-info-steps">${dims.numTreads} steps</span>
                    <span class="stair-info-shape">${stair.shape === 'l-shaped' ? 'L-Shaped' : 'Straight'}</span>
                </div>
                <div class="stair-list-item-actions">
                    <button class="stair-edit-btn" data-stair-id="${stair.id}" title="Edit">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="stair-delete-btn" data-stair-id="${stair.id}" title="Delete">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers for list items
    listContainer.querySelectorAll('.stair-list-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't trigger if clicking buttons
            if (e.target.closest('button')) return;

            const stairId = item.dataset.stairId;
            window.stairFunctions.selectStair(stairId);
            showStairEditor(stairId);
            renderStairList(); // Re-render to update selection
        });
    });

    // Add click handlers for edit buttons
    listContainer.querySelectorAll('.stair-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const stairId = btn.dataset.stairId;
            window.stairFunctions.selectStair(stairId);
            showStairEditor(stairId);
            renderStairList();
        });
    });

    // Add click handlers for delete buttons
    listContainer.querySelectorAll('.stair-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const stairId = btn.dataset.stairId;
            onRemoveStairClick(stairId);
        });
    });
}

// ===========================================
// STAIR EDITOR
// ===========================================

/**
 * Show the stair editor for a specific stair
 */
function showStairEditor(stairId) {
    const editor = document.getElementById('stairEditor');
    if (!editor) return;

    const stair = state.stairs.find(s => s.id === stairId);
    if (!stair) {
        hideStairEditor();
        return;
    }

    // Update state selection
    window.stairFunctions.selectStair(stairId);

    // Show editor
    editor.classList.remove('hidden');

    // Update edge label
    const edgeLabel = document.getElementById('stairEditorEdge');
    if (edgeLabel) {
        const edgeLabels = { front: 'Front', back: 'Back', left: 'Left', right: 'Right' };
        edgeLabel.textContent = `(${edgeLabels[stair.edge]} Edge)`;
    }

    // Update width
    const widthSlider = document.getElementById('stairWidthSlider');
    const widthInput = document.getElementById('stairWidthInput');
    if (widthSlider) widthSlider.value = stair.width;
    if (widthInput) widthInput.value = stair.width;

    // Update boards per tread
    document.querySelectorAll('input[name="boardsPerTread"]').forEach(radio => {
        const isSelected = parseInt(radio.value) === stair.boardsPerTread;
        radio.checked = isSelected;
        radio.closest('.radio-card').classList.toggle('selected', isSelected);
    });

    // Update shape
    document.querySelectorAll('input[name="stairShape"]').forEach(radio => {
        const isSelected = radio.value === stair.shape;
        radio.checked = isSelected;
        radio.closest('.radio-card').classList.toggle('selected', isSelected);
    });

    // Show/hide turn direction
    const turnDirectionGroup = document.getElementById('turnDirectionGroup');
    if (turnDirectionGroup) {
        turnDirectionGroup.classList.toggle('hidden', stair.shape !== 'l-shaped');
    }

    // Update turn direction
    document.querySelectorAll('input[name="turnDirection"]').forEach(radio => {
        const isSelected = radio.value === stair.turnDirection;
        radio.checked = isSelected;
        radio.closest('.radio-card').classList.toggle('selected', isSelected);
    });

    // Update handrails checkbox
    const handrailsCheckbox = document.getElementById('stairHandrails');
    if (handrailsCheckbox) {
        handrailsCheckbox.checked = stair.includeHandrails;
    }

    // Update tread preview
    updateTreadPreview(stair.boardsPerTread);

    // Update stair info
    updateStairInfo(stair);
}

/**
 * Hide the stair editor
 */
function hideStairEditor() {
    const editor = document.getElementById('stairEditor');
    if (editor) {
        editor.classList.add('hidden');
    }
}

/**
 * Update the tread preview SVG
 */
function updateTreadPreview(boardsPerTread) {
    const previewContainer = document.getElementById('treadPreview');
    const dimensionsEl = document.getElementById('treadDimensions');

    if (!previewContainer) return;

    const boardWidth = CONFIG.boards.width; // 5.5 inches
    const gap = CONFIG.boards.gap;          // 0.1875 inches
    const treadDepth = (boardsPerTread * boardWidth) + ((boardsPerTread - 1) * gap);

    // Get stair width for display
    const stair = window.stairFunctions?.getSelectedStair();
    const stairWidth = stair ? stair.width * 12 : 48; // inches

    // Create SVG preview
    const svgWidth = 200;
    const svgHeight = 60;
    const scale = svgWidth / stairWidth;
    const boardHeightScaled = boardWidth * scale * 2; // Exaggerate for visibility
    const gapScaled = gap * scale * 2;

    let boardsSVG = '';
    let yOffset = 5;

    for (let i = 0; i < boardsPerTread; i++) {
        boardsSVG += `
            <rect 
                x="5" 
                y="${yOffset}" 
                width="${svgWidth - 10}" 
                height="${boardHeightScaled}" 
                rx="2" 
                fill="var(--color-primary)" 
                opacity="${0.7 + (i * 0.1)}"
            />
        `;
        yOffset += boardHeightScaled + gapScaled;
    }

    previewContainer.innerHTML = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="tread-preview-svg">
            ${boardsSVG}
            <!-- Stringer indicators -->
            <rect x="0" y="0" width="4" height="${svgHeight}" fill="var(--color-text-muted)" opacity="0.5" rx="1"/>
            <rect x="${svgWidth - 4}" y="0" width="4" height="${svgHeight}" fill="var(--color-text-muted)" opacity="0.5" rx="1"/>
        </svg>
    `;

    // Update dimensions text
    if (dimensionsEl) {
        dimensionsEl.textContent = `${treadDepth.toFixed(1)}" deep × ${stairWidth}" wide`;
    }
}

/**
 * Update the stair info card
 */
function updateStairInfo(stair) {
    const dims = window.stairFunctions.calculateStairDimensions(stair);

    const stepCountEl = document.getElementById('stairStepCount');
    const totalRunEl = document.getElementById('stairTotalRun');
    const risePerStepEl = document.getElementById('stairRisePerStep');

    if (stepCountEl) stepCountEl.textContent = dims.numTreads;
    if (totalRunEl) totalRunEl.textContent = `${dims.totalRunFeet.toFixed(1)} ft`;
    if (risePerStepEl) risePerStepEl.textContent = `${dims.actualRise.toFixed(2)}"`;
}

// ===========================================
// ESTIMATE & REVIEW INTEGRATION
// ===========================================

/**
 * Update the estimate summary with stair materials
 * This extends the existing updateEstimateSummary function
 */
function updateStairEstimateSummary() {
    if (!state.stairsEnabled || state.stairs.length === 0) return;

    const container = document.getElementById('estimateSummary');
    if (!container) return;

    const stairMaterials = window.stairFunctions?.calculateAllStairMaterials();
    if (!stairMaterials) return;

    const stairCosts = window.stairFunctions?.calculateStairCosts(stairMaterials);

    // Check if stair section already exists
    let stairSection = container.querySelector('.estimate-section-stairs');

    if (!stairSection) {
        stairSection = document.createElement('div');
        stairSection.className = 'estimate-section estimate-section-stairs';
        container.appendChild(stairSection);
    }

    stairSection.innerHTML = `
        <div class="estimate-section-title">Stair Materials (${state.stairs.length} stair${state.stairs.length > 1 ? 's' : ''})</div>

        <div class="estimate-row">
            <span class="estimate-row-label">Tread Boards</span>
            <span class="estimate-row-value">${stairMaterials.treads.total} boards (${stairMaterials.treads.linealFeet} LF)</span>
        </div>

        <div class="estimate-row">
            <span class="estimate-row-label">Riser Boards</span>
            <span class="estimate-row-value">${stairMaterials.risers.total} boards (${stairMaterials.risers.linealFeet} LF)</span>
        </div>

        ${stairMaterials.landing.boards.total > 0 ? `
        <div class="estimate-row">
            <span class="estimate-row-label">Landing Boards</span>
            <span class="estimate-row-value">${stairMaterials.landing.boards.total} boards (${stairMaterials.landing.boards.linealFeet} LF)</span>
        </div>
        ` : ''}

        <div class="estimate-row">
            <span class="estimate-row-label">Stringers</span>
            <span class="estimate-row-value">${stairMaterials.stringers.count} stringers (${stairMaterials.stringers.totalLinealFeet} LF)</span>
        </div>

        ${stairMaterials.handrails.posts > 0 ? `
        <div class="estimate-row">
            <span class="estimate-row-label">Handrail Posts</span>
            <span class="estimate-row-value">${stairMaterials.handrails.posts} posts</span>
        </div>
        ` : ''}

        <div class="estimate-row">
            <span class="estimate-row-label">Additional Clips</span>
            <span class="estimate-row-value">${stairMaterials.hardware.clips} clips</span>
        </div>

        ${stairCosts ? `
        <div class="estimate-row estimate-row--subtotal">
            <span class="estimate-row-label">Stair Materials Cost</span>
            <span class="estimate-row-value">$${stairCosts.total.low.toLocaleString()} - $${stairCosts.total.high.toLocaleString()}</span>
        </div>
        ` : ''}
    `;
}

/**
 * Update the review summary with stair information
 */
function updateStairReviewSummary() {
    if (!state.stairsEnabled || state.stairs.length === 0) return;

    const container = document.getElementById('reviewSummary');
    if (!container) return;

    const stairMaterials = window.stairFunctions?.calculateAllStairMaterials();
    if (!stairMaterials) return;

    // Check if stair card already exists
    let stairCard = container.querySelector('.review-card-stairs');

    if (!stairCard) {
        stairCard = document.createElement('div');
        stairCard.className = 'review-card review-card-stairs';
        container.appendChild(stairCard);
    }

    const edgeLabels = { front: 'Front', back: 'Back', left: 'Left', right: 'Right' };

    stairCard.innerHTML = `
        <div class="review-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l6 6 6 6"/>
            </svg>
            Stairs (${state.stairs.length})
        </div>
        <div class="review-grid">
            ${state.stairs.map(stair => {
                const dims = window.stairFunctions.calculateStairDimensions(stair);
                return `
                    <div class="review-item review-item--full">
                        <span class="review-item-label">${edgeLabels[stair.edge]} Edge</span>
                        <span class="review-item-value">
                            ${stair.width}ft wide, ${dims.numTreads} steps, ${stair.shape === 'l-shaped' ? 'L-Shaped' : 'Straight'}
                        </span>
                    </div>
                `;
            }).join('')}

            <div class="review-item">
                <span class="review-item-label">Total Tread Boards</span>
                <span class="review-item-value">${stairMaterials.treads.total}</span>
            </div>
            <div class="review-item">
                <span class="review-item-label">Total Riser Boards</span>
                <span class="review-item-value">${stairMaterials.risers.total}</span>
            </div>
            <div class="review-item">
                <span class="review-item-label">Total Stringers</span>
                <span class="review-item-value">${stairMaterials.stringers.count}</span>
            </div>
        </div>
    `;
}

// ===========================================
// PDF EXPORT INTEGRATION
// ===========================================

/**
 * Generate stair content for PDF
 * Call this from generatePDF() after the main deck content
 */
function generateStairPDFContent(doc, startY, margin, pageWidth) {
    if (!state.stairsEnabled || state.stairs.length === 0) {
        return startY;
    }

    let y = startY;
    const stairMaterials = window.stairFunctions?.calculateAllStairMaterials();
    const stairCosts = window.stairFunctions?.calculateStairCosts(stairMaterials);

    if (!stairMaterials) return y;

    // Section header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 51, 51);
    doc.text('Stair Materials', margin, y);
    y += 20;

    // Stair details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const edgeLabels = { front: 'Front', back: 'Back', left: 'Left', right: 'Right' };

    state.stairs.forEach((stair, index) => {
        const dims = window.stairFunctions.calculateStairDimensions(stair);

        doc.setFont('helvetica', 'bold');
        doc.text(`Stair ${index + 1}: ${edgeLabels[stair.edge]} Edge`, margin, y);
        y += 12;

        doc.setFont('helvetica', 'normal');
        doc.text(`Width: ${stair.width}ft | Steps: ${dims.numTreads} | Shape: ${stair.shape === 'l-shaped' ? 'L-Shaped' : 'Straight'}`, margin + 10, y);
        y += 15;
    });

    // Materials summary
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Stair Materials Summary:', margin, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    const materials = [
        ['Tread Boards', `${stairMaterials.treads.total} boards (${stairMaterials.treads.linealFeet} LF)`],
        ['Riser Boards', `${stairMaterials.risers.total} boards (${stairMaterials.risers.linealFeet} LF)`],
        ['Stringers', `${stairMaterials.stringers.count} stringers (${stairMaterials.stringers.totalLinealFeet} LF)`]
    ];

    if (stairMaterials.landing.boards.total > 0) {
        materials.push(['Landing Boards', `${stairMaterials.landing.boards.total} boards`]);
    }

    materials.forEach(([label, value]) => {
        doc.text(`${label}: `, margin + 10, y);
        doc.setFont('helvetica', 'bold');
        doc.text(value, margin + 80, y);
        doc.setFont('helvetica', 'normal');
        y += 12;
    });

    // Cost
    if (stairCosts) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Estimated Stair Cost: ', margin + 10, y);
        doc.text(`$${stairCosts.total.low.toLocaleString()} - $${stairCosts.total.high.toLocaleString()}`, margin + 110, y);
        y += 15;
    }

    return y;
}

// ===========================================
// EXPORTS / GLOBAL ACCESS
// ===========================================

window.stairUIFunctions = {
    initStairUI,
    setupStairEventListeners,
    updateStairPanel,
    updateStairWarning,
    renderStairList,
    showStairEditor,
    hideStairEditor,
    updateTreadPreview,
    updateStairInfo,
    updateStairEstimateSummary,
    updateStairReviewSummary,
    generateStairPDFContent
};

console.log('Agent 4: Stair UI Handlers loaded');


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
        
        // Initialize stair systems
        if (window.stairDragFunctions) {
            window.stairDragFunctions.setupStairBuildIntegration();
            window.stairDragFunctions.initStairDragControls();
        }
        if (window.stairUIFunctions) {
            window.stairUIFunctions.initStairUI();
        }
        if (window.stair3DFunctions) {
            window.stair3DFunctions.initStairGroup();
        }
        
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
