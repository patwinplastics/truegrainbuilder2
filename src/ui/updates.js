// ============================================================
// TrueGrain Deck Builder 2 — DOM Update Functions
// ============================================================
import { CONFIG }  from '../config.js';
import { buildDeck } from '../3d/scene.js';

export function updateUI(s) {
    updateTotalArea(s);
    updatePatternUI(s);
    if (s.results) {
        updateOptimizationCard(s);
        updateBoardBreakdown(s);
        updateEstimateSummary(s);
        updateReviewSummary(s);
    }
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
