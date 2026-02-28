// ============================================================
// TrueGrain Deck Builder 2 — Stair UI
// Absorbs stair-ui-wiring-patch.js with e.target bug FIXED.
// Fix: stair edge buttons use function(){} + this (not arrow + btn)
// ============================================================
import { CONFIG }                from '../config.js';
import { state, updateState, subscribe } from '../state.js';
import { calculateStairDimensions }     from '../3d/stairs-3d.js';

const SHAPE_TO_MODEL = { 'straight': 'straight', 'l-shape': 'l-shaped' };
const SHAPE_TO_HTML  = { 'straight': 'straight', 'l-shaped': 'l-shape' };

// ============================================================
// Stair mutations
// ============================================================
export function addStair(edge) {
    if (state.deckHeight < CONFIG.stairs.minDeckHeightForStairs) return null;
    const stair = {
        id: `stair_${Date.now()}`,
        enabled: true, edge,
        position: 0.5,
        width: CONFIG.stairs.defaultWidth,
        boardsPerTread: CONFIG.stairs.boardsPerTread.default,
        shape: 'straight',
        turnDirection: 'left',
        includeHandrails: true,
        landingDepth: CONFIG.stairs.landingDepth,
        landingSplit: 0.5
    };
    updateState({ stairs: [...state.stairs, stair], selectedStairId: stair.id, stairsEnabled: true });
    return stair;
}

export function removeStair(id) {
    const updated = state.stairs.filter(s => s.id !== id);
    updateState({ stairs: updated, stairsEnabled: updated.length > 0, selectedStairId: updated[0]?.id ?? null });
}

function updateStair(id, changes) {
    updateState({ stairs: state.stairs.map(s => s.id === id ? { ...s, ...changes } : s) });
}

function getSelected() {
    return state.selectedStairId ? state.stairs.find(s => s.id === state.selectedStairId) : null;
}

// ============================================================
// Info card refresh
// ============================================================
function refreshInfoCards(stair) {
    if (!stair) return;
    const dims = calculateStairDimensions(stair, state);
    if (!dims) return;
    setText('stairStepCount',  dims.numTreads);
    setText('stairTotalRun',   dims.totalRunFeet.toFixed(1) + ' ft');
    setText('stairRisePerStep',dims.actualRise.toFixed(1) + '"');
    setText('treadDepthDisplay', dims.treadDepth.toFixed(1) + '"');
    if (stair.shape === 'l-shaped' && dims.lShapedData) {
        const ld = dims.lShapedData;
        setText('lShapeLowerSteps',   ld.treadsBeforeLanding);
        setText('lShapeUpperSteps',   ld.treadsAfterLanding);
        setText('lShapeLandingHeight', (ld.heightAtLanding / 12).toFixed(1) + ' ft (' + Math.round(ld.heightAtLanding) + '")');
        setText('lShapeLowerRun',     ld.run1Feet.toFixed(1) + ' ft');
        setText('lShapeUpperRun',     ld.run2Feet.toFixed(1) + ' ft');
    }
}

function populateControls(stair) {
    if (!stair) return;
    // Shape radios
    const htmlShape = SHAPE_TO_HTML[stair.shape] || 'straight';
    document.querySelectorAll('input[name="stairShape"]').forEach(r => {
        r.checked = r.value === htmlShape;
        r.closest('.radio-card')?.classList.toggle('selected', r.checked);
    });
    document.getElementById('lShapeOptions')?.classList.toggle('hidden', stair.shape !== 'l-shaped');
    // Turn direction
    document.querySelectorAll('input[name="stairTurnDirection"]').forEach(r => {
        r.checked = r.value === (stair.turnDirection || 'left');
        r.closest('.radio-card')?.classList.toggle('selected', r.checked);
    });
    // Landing depth
    const ld = typeof stair.landingDepth === 'number' ? stair.landingDepth : CONFIG.stairs.landingDepth;
    setVal('landingDepthSlider', ld); setVal('landingDepthInput', ld);
    // Landing split (model 0-1 -> UI 25-75)
    const sp = Math.round((typeof stair.landingSplit === 'number' ? stair.landingSplit : 0.5) * 100);
    setVal('landingSplitSlider', sp); setVal('landingSplitInput', sp);
    refreshInfoCards(stair);
}

// ============================================================
// Init — call once from main.js after DOM ready
// ============================================================
export function initStairUI() {
    // ---- Stair edge buttons (BUG FIX: use function(){} + this, not arrow + btn) ----
    document.querySelectorAll('.stair-edge-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const edge = this.getAttribute('data-edge') || this.dataset.edge;
            if (edge) addStair(edge);
            else console.error('Stair button missing data-edge:', this);
        });
    });

    // ---- Remove stair buttons ----
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-remove-stair]');
        if (btn) removeStair(btn.dataset.removeStair);
        const selBtn = e.target.closest('[data-select-stair]');
        if (selBtn) {
            updateState({ selectedStairId: selBtn.dataset.selectStair });
            populateControls(getSelected());
        }
    });

    // ---- Shape radio ----
    document.querySelectorAll('input[name="stairShape"]').forEach(r => {
        r.addEventListener('change', function(e) {
            document.querySelectorAll('input[name="stairShape"]').forEach(x => x.closest('.radio-card')?.classList.remove('selected'));
            e.target.closest('.radio-card')?.classList.add('selected');
            const shape = SHAPE_TO_MODEL[e.target.value] || 'straight';
            document.getElementById('lShapeOptions')?.classList.toggle('hidden', shape !== 'l-shaped');
            const stair = getSelected();
            if (stair) { updateStair(stair.id, { shape }); refreshInfoCards(getSelected()); }
        });
    });

    // ---- Turn direction radio ----
    document.querySelectorAll('input[name="stairTurnDirection"]').forEach(r => {
        r.addEventListener('change', function(e) {
            document.querySelectorAll('input[name="stairTurnDirection"]').forEach(x => x.closest('.radio-card')?.classList.remove('selected'));
            e.target.closest('.radio-card')?.classList.add('selected');
            const stair = getSelected();
            if (stair) { updateStair(stair.id, { turnDirection: e.target.value }); refreshInfoCards(getSelected()); }
        });
    });

    // ---- Landing depth ----
    const ldSlider = document.getElementById('landingDepthSlider');
    const ldInput  = document.getElementById('landingDepthInput');
    if (ldSlider && ldInput) {
        ldSlider.addEventListener('input', e => {
            const v = parseFloat(e.target.value); ldInput.value = v;
            const stair = getSelected(); if (stair) { updateStair(stair.id, { landingDepth: v }); refreshInfoCards(getSelected()); }
        });
        ldInput.addEventListener('change', e => {
            const v = Math.max(3, Math.min(6, parseFloat(e.target.value) || 3));
            e.target.value = v; ldSlider.value = v;
            const stair = getSelected(); if (stair) { updateStair(stair.id, { landingDepth: v }); refreshInfoCards(getSelected()); }
        });
    }

    // ---- Landing split ----
    const lsSlider = document.getElementById('landingSplitSlider');
    const lsInput  = document.getElementById('landingSplitInput');
    if (lsSlider && lsInput) {
        lsSlider.addEventListener('input', e => {
            const p = parseInt(e.target.value, 10); lsInput.value = p;
            const stair = getSelected(); if (stair) { updateStair(stair.id, { landingSplit: p / 100 }); refreshInfoCards(getSelected()); }
        });
        lsInput.addEventListener('change', e => {
            const p = Math.max(25, Math.min(75, parseInt(e.target.value, 10) || 50));
            e.target.value = p; lsSlider.value = p;
            const stair = getSelected(); if (stair) { updateStair(stair.id, { landingSplit: p / 100 }); refreshInfoCards(getSelected()); }
        });
    }

    // ---- Subscribe to state changes ----
    let lastId = state.selectedStairId;
    subscribe(() => {
        if (state.selectedStairId !== lastId) {
            lastId = state.selectedStairId;
            populateControls(getSelected());
        }
        const cur = getSelected();
        if (cur) refreshInfoCards(cur);
    });

    // ---- Initial populate if stair already selected ----
    const init = getSelected();
    if (init) populateControls(init);
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val)  { const el = document.getElementById(id); if (el) el.value = val; }
