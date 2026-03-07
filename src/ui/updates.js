// ============================================================
// TrueGrain Deck Builder 2 — DOM Update Functions
// ============================================================
import { CONFIG }  from '../config.js';
import { buildDeck } from '../3d/scene.js';

export function updateUI(s) {
    updateTotalArea(s);
    updatePatternUI(s);
    updateOptimizationCard(s);
    if (s.results) {
        updateBoardBreakdown(s);
        updateEstimateSummary(s);
        updateReviewSummary(s);
    }
    updateTrimNotice(s);
    buildDeck();
    document.getElementById('buildingSpinner')?.classList.add('hidden');
}

function updateTotalArea(s) {
    setText('totalArea', (s.deckLength * s.deckWidth).toFixed(1));
}

function updatePatternUI(s) {
    document.querySelectorAll('.pattern-option').forEach(el =>
        el.classList.toggle('selected', el.dataset.pattern === s.pattern)
    );
    const bp = s.pattern === 'picture-frame';
    const br = s.pattern === 'breaker';
    toggleHidden('breakerColorSection', !br || s.breakerSameColor);
    toggleHidden('borderColorSection',  !bp || s.borderSameColor);
    toggleHidden('borderWidthSection',  !bp);
}

// ============================================================
// Trim notice banner
// ============================================================
function updateTrimNotice(s) {
    const lo = s.boardLayout;

    let trimmed    = false;
    let trimWidthIn = 0;

    if (lo) {
        if (s.pattern !== 'picture-frame') {
            trimmed     = !!lo.lastRowTrimmed;
            trimWidthIn = lo.lastRowWidthIn || 0;
        } else {
            const { bw: bwFt, ew } = (() => {
                const bw = CONFIG.boards.width / 12;
                const g  = CONFIG.boards.gap   / 12;
                return { bw, ew: bw + g };
            })();
            const bc    = s.borderWidth || 1;
            const bwFtBorder = bc * ew;
            const iLen  = s.deckLength - 2 * bwFtBorder;
            const iWid  = s.deckWidth  - 2 * bwFtBorder;
            const cov   = s.boardDirection === 'length' ? iWid : iLen;
            const gFt   = CONFIG.boards.gap / 12;
            const ewFt  = bwFt + gFt;
            const nRows = Math.ceil(cov / ewFt);
            const lastNearEdge = (nRows - 1) * ewFt;
            const lastFarEdge  = lastNearEdge + bwFt;
            trimmed     = lastFarEdge > cov + 1e-6;
            trimWidthIn = trimmed ? (cov - lastNearEdge) * 12 : 0;
        }
    }

    let banner = document.getElementById('trimNotice');
    if (!banner) {
        const container = document.querySelector('.scene-container')
                       || document.getElementById('viewportWrapper')
                       || document.getElementById('canvasWrapper')
                       || document.querySelector('.viewport-wrapper')
                       || document.querySelector('canvas')?.parentElement;
        if (container) {
            banner = document.createElement('div');
            banner.id = 'trimNotice';
            banner.className = 'trim-notice';
            container.appendChild(banner);
        }
    }

    if (!banner) return;

    if (trimmed && trimWidthIn > 0.05) {
        const inchesStr = trimWidthIn.toFixed(3).replace(/\.?0+$/, '');
        const fractionStr = toFractionString(trimWidthIn);
        banner.innerHTML =
            `<span class="trim-notice__icon">&#9888;</span>` +
            `<span class="trim-notice__text">` +
            `<strong>Board trim required:</strong> ` +
            `The last board row does not fit the deck width evenly. ` +
            `1 board per row will need to be ripped down to ` +
            `<strong>${fractionStr}" (${inchesStr}")</strong> wide to fit your dimensions precisely.` +
            `</span>`;
        banner.classList.remove('hidden');
        banner.style.display = '';
    } else {
        banner.classList.add('hidden');
        banner.style.display = 'none';
    }
}

function toFractionString(decimal) {
    const whole = Math.floor(decimal);
    const frac  = decimal - whole;
    const sixteenths = Math.round(frac * 16);
    if (sixteenths === 0)  return whole > 0 ? `${whole}` : '0';
    if (sixteenths === 16) return `${whole + 1}`;
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const g   = gcd(sixteenths, 16);
    const num = sixteenths / g;
    const den = 16 / g;
    return whole > 0 ? `${whole} ${num}/${den}` : `${num}/${den}`;
}

function updateOptimizationCard(s) {
    const lo = s.boardLayout;
    if (!lo) return;
    setText('optWastePercent', lo.wastePercent.toFixed(1) + '%');
    setText('optTotalLF',      lo.totalLinealFeet.toFixed(0));
    setText('optUsedLF',       lo.usedLinealFeet.toFixed(0));
    setText('optNumRows',      lo.numRows);
    const recList = document.getElementById('optRecommendations');
    if (recList && lo.recommendations) {
        recList.innerHTML = lo.recommendations
            .map(r => `<li>${r.description} <span class="waste-badge">${r.wastePercent.toFixed(1)}% waste</span></li>`)
            .join('');
    }

    // Sync length checkboxes to current state (handles load from localStorage)
    CONFIG.boards.availableLengths.forEach(len => {
        const cb = document.getElementById(`boardLength${len}`);
        if (cb) cb.checked = s.selectedBoardLengths?.includes(len) ?? true;
    });

    // Stair breakdown
    const stairSection = document.getElementById('optStairBreakdown');
    if (!stairSection) return;

    const stairs = s.results?.stairs;
    if (!s.stairsEnabled || !stairs?.enabled) {
        stairSection.classList.add('hidden');
        return;
    }
    stairSection.classList.remove('hidden');

    setText('optStairCount',    stairs.stairCount);
    setText('optTreadBoards',   stairs.treadBoards.total + ' boards (' + stairs.treadBoards.linealFeet.toFixed(0) + ' LF)');
    setText('optRiserBoards',   stairs.riserBoards.total + ' boards (' + stairs.riserBoards.linealFeet.toFixed(0) + ' LF)');
    setText('optStringers',     stairs.stringers.count + ' @ ' + stairs.stringers.lengthEach.toFixed(1) + ' ft each (' + stairs.stringers.totalLinealFeet.toFixed(0) + ' LF)');

    const landingEl = document.getElementById('optLandingBoardsRow');
    if (landingEl) {
        if (stairs.landingBoards.total > 0) {
            landingEl.classList.remove('hidden');
            setText('optLandingBoards', stairs.landingBoards.total + ' boards (' + stairs.landingBoards.linealFeet.toFixed(0) + ' LF)');
        } else {
            landingEl.classList.add('hidden');
        }
    }

    setText('optStairTotalLF',  stairs.totalCompositeLF.toFixed(0));
}

function updateBoardBreakdown(s) {
    if (!s.results?.boards) return;
    const { byLength, total, linealFeet, wasteBoards } = s.results.boards;
    setText('boardTotal', total);
    setText('boardLF',    linealFeet.toFixed(0));
    setText('boardWaste', wasteBoards);
    [12, 16, 20].forEach(len => setText(`boards${len}ft`, byLength[len] || 0));
    const hw = s.results.hardware;
    setText('clipBoxes',  hw.clipBoxes);
    setText('screwBoxes', hw.screwBoxes);
    setText('joistCount', hw.joistCount);
}

function updateEstimateSummary(s) {
    if (!s.results?.costs) return;
    const { costs } = s.results;
    setText('estimateSF',       (s.deckLength * s.deckWidth).toFixed(0));
    setText('materialCostLow',  formatCurrency(costs.materials.total.low));
    setText('materialCostHigh', formatCurrency(costs.materials.total.high));
    setText('materialCostWork', formatCurrency(costs.materials.total.working));
    setText('hardwareCost',     formatCurrency(costs.hardware.total));
    setText('totalCostLow',     formatCurrency(costs.grandTotal.materialsOnly.low));
    setText('totalCostHigh',    formatCurrency(costs.grandTotal.materialsOnly.high));
    setText('totalCostWork',    formatCurrency(costs.grandTotal.materialsOnly.working));
    if (costs.labor && costs.grandTotal.withLabor) {
        toggleHidden('laborEstimateSection', false);
        setText('laborCostLow',       formatCurrency(costs.labor.low));
        setText('laborCostHigh',      formatCurrency(costs.labor.high));
        setText('totalWithLaborLow',  formatCurrency(costs.grandTotal.withLabor.low));
        setText('totalWithLaborHigh', formatCurrency(costs.grandTotal.withLabor.high));
    }
}

function updateReviewSummary(s) {
    if (!s.results) return;
    setText('reviewDeckSize',   `${s.deckLength}' x ${s.deckWidth}'`);
    setText('reviewDeckArea',   `${(s.deckLength * s.deckWidth).toFixed(0)} sq ft`);
    setText('reviewDeckHeight', `${s.deckHeight}'`);
    setText('reviewPattern',    s.pattern.replace(/-/g, ' '));
    setText('reviewMainColor',  CONFIG.colors.find(c => c.id === s.mainColor)?.name || s.mainColor);
    setText('reviewBoardCount', s.results.boards.total);
    setText('reviewBoardLF',    s.results.boards.linealFeet.toFixed(0) + ' LF');
    setText('reviewTotalCost',  formatCurrency(s.results.costs.grandTotal.materialsOnly.working));
    if (s.contactName)  setText('reviewContactName',  s.contactName);
    if (s.contactEmail) setText('reviewContactEmail', s.contactEmail);
    if (s.contactPhone) setText('reviewContactPhone', s.contactPhone);
    if (s.contactZip)   setText('reviewContactZip',   s.contactZip);
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function toggleHidden(id, hide) { document.getElementById(id)?.classList.toggle('hidden', hide); }

export function formatCurrency(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
}
