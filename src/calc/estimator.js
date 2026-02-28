// ============================================================
// TrueGrain Deck Builder 2 — Cost & Material Estimator
// Pure functions — accept state as parameter, no globals
// ============================================================
import { CONFIG } from '../config.js';
import { selectOptimalBoardLength } from './optimizer.js';
import { calculateStairDimensions } from '../3d/stairs-3d.js';

export function calculateAll(state) {
    const pattern  = determinePattern(state);
    const boards   = calculateBoards(state, pattern);
    const hardware = calculateHardware(state);
    const stairs   = calculateStairs(state);
    const withWaste = applyWaste(state, boards, hardware, stairs);
    const costs    = calculateCosts(state, withWaste);
    return {
        squareFootage: state.deckLength * state.deckWidth,
        pattern,
        boards:    withWaste.boards,
        hardware:  withWaste.hardware,
        stairs:    withWaste.stairs,
        costs,
        joistCount: calculateJoistCount(state),
        boardLayout: state.boardLayout
    };
}

export function determinePattern(state) {
    const runDim = state.boardDirection === 'length' ? state.deckLength : state.deckWidth;
    let breakerPosition = null;
    if (state.pattern === 'breaker' || state.pattern === 'picture-frame') {
        breakerPosition = optimizeBreakPosition(runDim);
    }
    return {
        type:               state.pattern,
        breakerRequired:    runDim > CONFIG.boards.maxContinuousRun,
        breakerRecommended: runDim > 20,
        breakerPosition,
        borderWidth: state.pattern === 'picture-frame' ? state.borderWidth : 0
    };
}

function optimizeBreakPosition(totalLength) {
    let best = { waste: Infinity, position: totalLength / 2 };
    for (const len1 of CONFIG.boards.availableLengths) {
        const remaining = totalLength - len1 - CONFIG.boards.width / 12;
        if (remaining > 0 && remaining <= 20) {
            const len2  = selectOptimalBoardLength(remaining);
            const waste = Math.abs(len1 - totalLength / 2) + (len2 - remaining);
            if (waste < best.waste) best = { waste, position: len1 };
        }
    }
    return best.waste < 2 ? best.position : totalLength / 2;
}

function calculateBoards(state, pattern) {
    const layout = state.boardLayout;
    if (!layout) return { byLength: { 12: 0, 16: 0, 20: 0 }, total: 0, linealFeet: 0 };

    const byLen    = { ...layout.boardsByLength };
    const border   = { 12: 0, 16: 0, 20: 0 };

    if (pattern.type === 'picture-frame') {
        const bwFt    = pattern.borderWidth * (CONFIG.boards.width / 12);
        const runDim  = state.boardDirection === 'length' ? state.deckLength : state.deckWidth;
        const covDim  = state.boardDirection === 'length' ? state.deckWidth  : state.deckLength;
        border[selectOptimalBoardLength(runDim)] += pattern.borderWidth * 2;
        border[selectOptimalBoardLength(covDim - 2 * bwFt)] += pattern.borderWidth * 2;
    } else if (pattern.type === 'breaker') {
        const covDim = state.boardDirection === 'length' ? state.deckWidth : state.deckLength;
        byLen[selectOptimalBoardLength(covDim)] = (byLen[selectOptimalBoardLength(covDim)] || 0) + 1;
    }

    let total = 0, lf = 0;
    [...Object.entries(byLen), ...Object.entries(border)].forEach(([l, c]) => { total += c; lf += c * +l; });

    return { byLength: byLen, borderByLength: border, total, linealFeet: lf, rows: layout.numRows, segments: layout.segments };
}

function calculateJoistCount(state) {
    return Math.floor(((state.boardDirection === 'length' ? state.deckWidth : state.deckLength) * 12) / state.joistSpacing) + 1;
}

function calculateHardware(state) {
    const clips = Math.ceil(state.deckLength * state.deckWidth * 2);
    return {
        clips,
        clipBoxes:  Math.ceil(clips / CONFIG.pricing.clipsPerBox),
        screws:     clips,
        screwBoxes: Math.ceil(clips / CONFIG.pricing.screwsPerBox),
        joistCount: calculateJoistCount(state)
    };
}

// ============================================================
// Stair material calculations
// ============================================================
function getStringerCount(stairWidthFt) {
    const minCenter = CONFIG.stairs.centerStringerMinWidth ?? 3;
    const minDouble = CONFIG.stairs.doubleCenterStringerMinWidth ?? 6;
    if (stairWidthFt < minCenter) return 2;
    if (stairWidthFt < minDouble) return 3;
    return 4;
}

function calculateStairs(state) {
    const result = {
        enabled: false,
        stairCount: 0,
        treadBoards: { byLength: { 12: 0, 16: 0, 20: 0 }, total: 0, linealFeet: 0 },
        riserBoards: { byLength: { 12: 0, 16: 0, 20: 0 }, total: 0, linealFeet: 0 },
        stringers: { count: 0, lengthEach: 0, totalLinealFeet: 0 },
        landingBoards: { byLength: { 12: 0, 16: 0, 20: 0 }, total: 0, linealFeet: 0 },
        totalCompositeLF: 0,
        totalCompositeBoards: 0
    };

    if (!state.stairsEnabled || !state.stairs?.length) return result;

    result.enabled = true;
    const bwFt = CONFIG.boards.width / 12;
    const gapFt = CONFIG.boards.gap / 12;

    state.stairs.forEach(stair => {
        if (!stair.enabled) return;
        result.stairCount++;

        const dims = calculateStairDimensions(stair, state);
        if (!dims?.isValid) return;

        const sw = dims.stairWidthFeet;
        const treadBoardLen = selectOptimalBoardLength(sw);

        // Tread boards: numTreads * boardsPerTread
        const treadCount = dims.numTreads * dims.boardsPerTread;
        result.treadBoards.byLength[treadBoardLen] = (result.treadBoards.byLength[treadBoardLen] || 0) + treadCount;
        result.treadBoards.total += treadCount;
        result.treadBoards.linealFeet += treadCount * treadBoardLen;

        // Riser boards: one board per riser, full stair width
        // Each riser is one board tall (riser height ~7" fits within one 5.5" board with overlap)
        const riserCount = dims.numRisers;
        result.riserBoards.byLength[treadBoardLen] = (result.riserBoards.byLength[treadBoardLen] || 0) + riserCount;
        result.riserBoards.total += riserCount;
        result.riserBoards.linealFeet += riserCount * treadBoardLen;

        // Stringers: pressure-treated 2x12 lumber
        const stringerCount = getStringerCount(sw);
        const stringerLen = Math.sqrt(
            (state.deckHeight * state.deckHeight) + (dims.totalRunFeet * dims.totalRunFeet)
        );
        result.stringers.count += stringerCount;
        result.stringers.lengthEach = Math.max(result.stringers.lengthEach, stringerLen);
        result.stringers.totalLinealFeet += stringerCount * stringerLen;

        // Landing boards (L-shaped stairs)
        if (stair.shape === 'l-shaped' && dims.lShapedData) {
            const ld = dims.lShapedData;
            const landingWidth = sw + ld.run2Feet;
            const landingDepth = Math.max(ld.landingDepthFeet, sw);
            const landingRows = Math.ceil(landingDepth / (bwFt + gapFt));
            const landingBoardLen = selectOptimalBoardLength(landingWidth);
            result.landingBoards.byLength[landingBoardLen] = (result.landingBoards.byLength[landingBoardLen] || 0) + landingRows;
            result.landingBoards.total += landingRows;
            result.landingBoards.linealFeet += landingRows * landingBoardLen;
        }
    });

    result.totalCompositeBoards = result.treadBoards.total + result.riserBoards.total + result.landingBoards.total;
    result.totalCompositeLF = result.treadBoards.linealFeet + result.riserBoards.linealFeet + result.landingBoards.linealFeet;

    return result;
}

function applyWaste(state, boards, hw, stairs) {
    const f = 1 + state.wastePercent / 100;
    const byLen = {};
    let total = 0, lf = 0;
    Object.entries(boards.byLength).forEach(([l, c]) => { const a = Math.ceil(c * f); byLen[l] = a; total += a; lf += a * +l; });
    if (boards.borderByLength) {
        Object.entries(boards.borderByLength).forEach(([l, c]) => {
            if (c > 0) { const a = Math.ceil(c * f); byLen[l] = (byLen[l]||0) + a; total += a; lf += a * +l; }
        });
    }

    // Apply waste to stair composite boards
    const stairWithWaste = { ...stairs };
    if (stairs.enabled) {
        const applyWasteToGroup = (group) => {
            const wasted = { byLength: {}, total: 0, linealFeet: 0 };
            Object.entries(group.byLength).forEach(([l, c]) => {
                if (c > 0) {
                    const a = Math.ceil(c * f);
                    wasted.byLength[l] = a;
                    wasted.total += a;
                    wasted.linealFeet += a * +l;
                    // Also add to main board totals
                    byLen[l] = (byLen[l] || 0) + a;
                    total += a;
                    lf += a * +l;
                }
            });
            return wasted;
        };
        stairWithWaste.treadBoards = applyWasteToGroup(stairs.treadBoards);
        stairWithWaste.riserBoards = applyWasteToGroup(stairs.riserBoards);
        stairWithWaste.landingBoards = applyWasteToGroup(stairs.landingBoards);
        stairWithWaste.totalCompositeBoards = stairWithWaste.treadBoards.total + stairWithWaste.riserBoards.total + stairWithWaste.landingBoards.total;
        stairWithWaste.totalCompositeLF = stairWithWaste.treadBoards.linealFeet + stairWithWaste.riserBoards.linealFeet + stairWithWaste.landingBoards.linealFeet;
    }

    return {
        boards:   { byLength: byLen, total, linealFeet: lf, baseTotal: boards.total, baseLinealFeet: boards.linealFeet, wasteBoards: total - boards.total, segments: boards.segments },
        hardware: { ...hw, clips: Math.ceil(hw.clips*1.1), clipBoxes: Math.ceil(hw.clipBoxes*1.1), screws: Math.ceil(hw.screws*1.1), screwBoxes: Math.ceil(hw.screwBoxes*1.1) },
        stairs:   stairWithWaste
    };
}

function calculateCosts(state, data) {
    const sf  = state.deckLength * state.deckWidth;
    const lf  = data.boards.linealFeet;
    const hw  = (data.hardware.clipBoxes * CONFIG.pricing.clipBoxPrice) + (data.hardware.screwBoxes * CONFIG.pricing.screwBoxPrice);
    const lab = state.includeLaborEstimate ? { low: sf * CONFIG.pricing.laborPerSF.min, high: sf * CONFIG.pricing.laborPerSF.max } : null;
    const lo  = lf * CONFIG.pricing.materialPerLF.min;
    const hi  = lf * CONFIG.pricing.materialPerLF.max;
    const wk  = lf * state.pricePerLF;

    // Stringer cost (pressure-treated lumber, ~$2-3/LF for 2x12)
    const stringerCost = data.stairs.enabled ? data.stairs.stringers.totalLinealFeet * 3 : 0;

    return {
        materials: { perLF: { low: CONFIG.pricing.materialPerLF.min, high: CONFIG.pricing.materialPerLF.max, working: state.pricePerLF }, total: { low: lo, high: hi, working: wk } },
        hardware:  { total: hw },
        stringers: { total: stringerCost, linealFeet: data.stairs.enabled ? data.stairs.stringers.totalLinealFeet : 0 },
        labor:     lab,
        grandTotal: {
            materialsOnly: { low: lo+hw+stringerCost, high: hi+hw+stringerCost, working: wk+hw+stringerCost },
            withLabor: lab ? { low: lo+hw+stringerCost+lab.low, high: hi+hw+stringerCost+lab.high } : null
        }
    };
}
