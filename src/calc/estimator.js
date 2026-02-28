// ============================================================
// TrueGrain Deck Builder 2 — Cost & Material Estimator
// Pure functions — accept state as parameter, no globals
// ============================================================
import { CONFIG } from '../config.js';
import { selectOptimalBoardLength } from './optimizer.js';

export function calculateAll(state) {
    const pattern  = determinePattern(state);
    const boards   = calculateBoards(state, pattern);
    const hardware = calculateHardware(state);
    const withWaste = applyWaste(state, boards, hardware);
    const costs    = calculateCosts(state, withWaste);
    return {
        squareFootage: state.deckLength * state.deckWidth,
        pattern,
        boards:    withWaste.boards,
        hardware:  withWaste.hardware,
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

function applyWaste(state, boards, hw) {
    const f = 1 + state.wastePercent / 100;
    const byLen = {};
    let total = 0, lf = 0;
    Object.entries(boards.byLength).forEach(([l, c]) => { const a = Math.ceil(c * f); byLen[l] = a; total += a; lf += a * +l; });
    if (boards.borderByLength) {
        Object.entries(boards.borderByLength).forEach(([l, c]) => {
            if (c > 0) { const a = Math.ceil(c * f); byLen[l] = (byLen[l]||0) + a; total += a; lf += a * +l; }
        });
    }
    return {
        boards:   { byLength: byLen, total, linealFeet: lf, baseTotal: boards.total, baseLinealFeet: boards.linealFeet, wasteBoards: total - boards.total, segments: boards.segments },
        hardware: { ...hw, clips: Math.ceil(hw.clips*1.1), clipBoxes: Math.ceil(hw.clipBoxes*1.1), screws: Math.ceil(hw.screws*1.1), screwBoxes: Math.ceil(hw.screwBoxes*1.1) }
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
    return {
        materials: { perLF: { low: CONFIG.pricing.materialPerLF.min, high: CONFIG.pricing.materialPerLF.max, working: state.pricePerLF }, total: { low: lo, high: hi, working: wk } },
        hardware:  { total: hw },
        labor:     lab,
        grandTotal: {
            materialsOnly: { low: lo+hw, high: hi+hw, working: wk+hw },
            withLabor: lab ? { low: lo+hw+lab.low, high: hi+hw+lab.high } : null
        }
    };
}
