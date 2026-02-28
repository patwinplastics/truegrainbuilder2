// ============================================================
// TrueGrain Deck Builder 2 — Board Layout Optimizer
// Pure functions — accept state as parameter, no globals
// ============================================================
import { CONFIG } from '../config.js';

export function calculateOptimalBoardLayout(state) {
    const runDim   = state.boardDirection === 'length' ? state.deckLength : state.deckWidth;
    const coverDim = state.boardDirection === 'length' ? state.deckWidth  : state.deckLength;
    const boardWidthFt   = CONFIG.boards.width / 12;
    const gapFt          = CONFIG.boards.gap   / 12;
    const effectiveWidth = boardWidthFt + gapFt;
    const numRows        = Math.ceil(coverDim / effectiveWidth);

    const combinations = findBoardCombinations(runDim);
    combinations.sort((a, b) => a.wastePercent - b.wastePercent);

    const best = combinations[0] || {
        segments:     [{ length: selectOptimalBoardLength(runDim), actualLength: runDim }],
        wastePercent: 0
    };

    const boardsByLength = { 12: 0, 16: 0, 20: 0 };
    best.segments.forEach(seg => { boardsByLength[seg.length] += numRows; });

    return {
        runDimension:    runDim,
        coverDimension:  coverDim,
        numRows,
        segments:        best.segments,
        boardsByLength,
        wastePercent:    best.wastePercent,
        totalLinealFeet: Object.entries(boardsByLength).reduce((s, [l, c]) => s + c * +l, 0),
        usedLinealFeet:  numRows * runDim,
        recommendations: combinations.slice(0, 3)
    };
}

function findBoardCombinations(target) {
    const LENGTHS = CONFIG.boards.availableLengths;
    const gap     = CONFIG.boards.gap / 12;
    const combos  = [];

    // Single board
    for (const len of LENGTHS) {
        if (len >= target) {
            const waste = len - target;
            combos.push({
                segments:     [{ length: len, actualLength: target, start: 0 }],
                totalLength:  len,
                wastePercent: (waste / len) * 100,
                description:  `Single ${len}' board`,
                wasteAmount:  waste
            });
            break;
        }
    }

    // Two boards
    for (const l1 of LENGTHS) {
        for (const l2 of LENGTHS) {
            const coverage = l1 + l2 - gap;
            if (coverage >= target && coverage <= target + 2) {
                const seg1 = Math.min(l1, target / 2 + 1);
                const seg2 = target - seg1 - gap;
                if (seg2 > 0 && seg2 <= l2) {
                    const waste = (l1 + l2) - target;
                    combos.push({
                        segments:     [{ length: l1, actualLength: seg1, start: 0 }, { length: l2, actualLength: seg2, start: seg1 + gap }],
                        totalLength:  l1 + l2,
                        wastePercent: (waste / (l1 + l2)) * 100,
                        description:  `${l1}' + ${l2}' boards`,
                        wasteAmount:  waste
                    });
                }
            }
        }
    }

    // Perfect fits
    findPerfectFits(target, gap).forEach(fit => {
        if (!combos.find(c => c.description === fit.description)) combos.push(fit);
    });

    // Three boards for very long decks
    if (target > 32) {
        for (const l1 of LENGTHS) for (const l2 of LENGTHS) for (const l3 of LENGTHS) {
            const total    = l1 + l2 + l3;
            const coverage = total - 2 * gap;
            if (coverage >= target && coverage <= target + 3) {
                const wp = ((total - target) / total) * 100;
                if (wp < 15) {
                    const s1 = l1 - 0.5, s2 = l2 - 0.5, s3 = target - s1 - s2 - 2 * gap;
                    combos.push({
                        segments:     [{ length: l1, actualLength: s1, start: 0 }, { length: l2, actualLength: s2, start: s1 + gap }, { length: l3, actualLength: s3, start: s1 + s2 + 2 * gap }],
                        totalLength:  total,
                        wastePercent: wp,
                        description:  `${l1}' + ${l2}' + ${l3}' boards`,
                        wasteAmount:  total - target
                    });
                }
            }
        }
    }

    return combos;
}

function findPerfectFits(target, gap) {
    return [[12,12,24],[16,16,32],[20,20,40],[12,16,28],[16,20,36]]
        .filter(([,, t]) => Math.abs(target - t) < 0.5)
        .map(([l1, l2]) => ({
            segments:     [{ length: l1, actualLength: l1 - gap/2, start: 0 }, { length: l2, actualLength: l2 - gap/2, start: l1 }],
            totalLength:  l1 + l2,
            wastePercent: 0,
            description:  l1 === l2 ? `2 x ${l1}' boards (perfect fit)` : `${l1}' + ${l2}' boards (perfect fit)`,
            wasteAmount:  0
        }));
}

export function selectOptimalBoardLength(required) {
    for (const len of CONFIG.boards.availableLengths) if (len >= required) return len;
    return CONFIG.boards.availableLengths.at(-1);
}
