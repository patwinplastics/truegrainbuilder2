// ============================================================
// TrueGrain Deck Builder 2 — Stair UI
// Handles stair list rendering, editor, shape/L-shape controls.
// BUG FIX: stair edge buttons use function(){} + this (not arrow + btn)
// ============================================================
import { CONFIG }                          from '../config.js';
import { state, updateState, subscribe }   from '../state.js';
import { calculateStairDimensions }        from '../3d/stairs-3d.js';

const SHAPE_TO_MODEL = { 'straight': 'straight', 'l-shape': 'l-shaped' };
const SHAPE_TO_HTML  = { 'straight': 'straight', 'l-shaped': 'l-shape' };

// ============================================================
// Stair mutations
// ============================================================
export function addStair(edge) {
    if (state.deckHeight < CONFIG.stairs.minDeckHeightForStairs) {
        alert(`Deck height must be at least ${CONFIG.stairs.minDeckHeightForStairs} ft to add stairs.`);
        return null;
    }
    const stair = {
        id: `stair_${Date.now()}`,
        enabled: true, edge,
        position: 0.5,
        width: CONFIG.stairs.defaultWidth,
        boardsPerTread: CONFIG.stairs.boardsPerTread.default,
        shape: 'straight',
        turnDirection: 'right',
        includeHandrails: true,
        landingDepth: CONFIG.stairs.landingDepth,
        landingSplit: 0.5
    };
    updateState({ stairs: [...state.stairs, stair], stairsEnabled: true, selectedStairId: stair.id });
    return stair;
}

export function removeStair(id) {
    const updated = state.stairs.filter(s => s.id !== id);
    updateState({
        stairs: updated,
        stairsEnabled: updated.length > 0,
        selectedStairId: updated.length > 0 ? updated[0].id : null
    });
}

function updateStair(id, changes) {
    updateState({ stairs: state.stairs.map(s => s.id === id ? { ...s, ...changes } : s) });
}

function getSelected() {
    return state.selectedStairId ? state.stairs.find(s => s.id === state.selectedStairId) : null;
}

// ============================================================
// Stair List Renderer — called on every state change
// ============================================================
function renderStairList(st) {
    const list = document.getElementById('stairList');
    if (!list) return;

    if (!st.stairs || st.stairs.length === 0) {
        list.innerHTML = '<div class="stair-list-empty"><p>No stairs added yet. Click an edge button below to add stairs.</p></div>';
        document.getElementById('stairEditor')?.classList.add('hidden');
        return;
    }

    list.innerHTML = st.stairs.map(stair => {
        const dims = calculateStairDimensions(stair, st);
        const stepCount = dims?.numTreads || '?';
        const shape = stair.shape === 'l-shaped' ? 'L-Shape' : 'Straight';
        const edgeLabel = stair.edge.charAt(0).toUpperCase() + stair.edge.slice(1);
        return `
        <div class="stair-item ${stair.id === st.selectedStairId ? 'selected' : ''}" data-select-stair="${stair.id}" style="cursor:pointer">
            <div class="stair-item__info">
                <span class="stair-item__edge" style="font-weight:600">${edgeLabel} Edge</span>
                <span class="stair-item__details" style="font-size:0.8em;color:#666">
                    ${shape} &middot; ${stair.width || CONFIG.stairs.defaultWidth}' wide &middot; ${stepCount} steps
                </span>
            </div>
            <button type="button" class="btn btn--danger btn--small" data-remove-stair="${stair.id}"
                style="padding:2px 8px;font-size:0.75em" aria-label="Remove stair">&times;</button>
        </div>`;
    }).join('');

    // Show / hide editor
    const editor = document.getElementById('stairEditor');
    if (!editor) return;
    if (st.selectedStairId) {
        editor.classList.remove('hidden');
        const stair = st.stairs.find(s => s.id === st.selectedStairId);
        setText('stairEditorEdge', stair ? stair.edge.charAt(0).toUpperCase() + stair.edge.slice(1) : '');
    } else {
        editor.classList.add('hidden');
    }
}

// ============================================================
// Info card refresh
// ============================================================
function refreshInfoCards(stair) {
    if (!stair) return;
    const dims = calculateStairDimensions(stair, state);
    if (!dims) return;
    setText('stairStepCount',   dims.numTreads);
    setText('stairTotalRun',    dims.totalRunFeet.toFixed(1) + ' ft');
    setText('stairRisePerStep', dims.actualRise.toFixed(1) + '"');
    setText('treadDepthDisplay',dims.treadDepth.toFixed(1) + '"');
    if (stair.shape === 'l-shaped' && dims.lShapedData) {
        const ld = dims.lShapedData;
        setText('lShapeLowerSteps',    ld.treadsBeforeLanding);
        setText('lShapeUpperSteps',    ld.treadsAfterLanding);
        setText('lShapeLandingHeight', (ld.heightAtLanding / 12).toFixed(1) + ' ft (' + Math.round(ld.heightAtLanding) + '")');
        setText('lShapeLowerRun',      ld.run1Feet.toFixed(1) + ' ft');
        setText('lShapeUpperRun',      ld.run2Feet.toFixed(1) + ' ft');
    }
}

// ============================================================
// Populate editor controls from stair data
// ============================================================
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
        r.checked = r.value === (stair.turnDirection || 'right');
        r.closest('.radio-card')?.classList.toggle('selected', r.checked);
    });

    // Boards per tread
    document.querySelectorAll('input[name="boardsPerTread"]').forEach(r => {
        r.checked = +r.value === (stair.boardsPerTread || CONFIG.stairs.boardsPerTread.default);
        r.closest('.radio-card')?.classList.toggle('selected', r.checked);
    });

    // Stair width
    setVal('stairWidthSlider', stair.width || CONFIG.stairs.defaultWidth);
    setVal('stairWidthInput',  stair.width || CONFIG.stairs.defaultWidth);

    // Handrails
    const hr = document.getElementById('stairHandrails');
    if (hr) hr.checked = stair.includeHandrails !== false;

    // Landing controls
    const ld = typeof stair.landingDepth === 'number' ? stair.landingDepth : CONFIG.stairs.landingDepth;
    setVal('landingDepthSlider', ld); setVal('landingDepthInput', ld);
    const sp = Math.round((typeof stair.landingSplit === 'number' ? stair.landingSplit : 0.5) * 100);
    setVal('landingSplitSlider', sp); setVal('landingSplitInput', sp);

    refreshInfoCards(stair);
}

// ============================================================
// Init — called once from main.js after DOM ready
// ============================================================
export function initStairUI() {

    // ---- Edge buttons (BUG FIX: function(){} + this) ----
    document.querySelectorAll('.stair-edge-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const edge = this.dataset.edge;
            if (edge) addStair(edge);
            else console.error('Stair edge button missing data-edge:', this);
        });
    });

    // ---- Remove stair (delegated — works for dynamically rendered list) ----
    document.getElementById('stairList')?.addEventListener('click', e => {
        // Remove button
        const removeBtn = e.target.closest('[data-remove-stair]');
        if (removeBtn) { e.stopPropagation(); removeStair(removeBtn.dataset.removeStair); return; }
        // Select stair item
        const item = e.target.closest('[data-select-stair]');
        if (item) updateState({ selectedStairId: item.dataset.selectStair });
    });

    // ---- Delete stair (editor button) ----
    document.getElementById('deleteStairBtn')?.addEventListener('click', () => {
        const stair = getSelected();
        if (stair && confirm('Remove this stair?')) removeStair(stair.id);
    });

    // ---- Shape radio ----
    document.querySelectorAll('input[name="stairShape"]').forEach(r => {
        r.addEventListener('change', function(e) {
            document.querySelectorAll('input[name="stairShape"]').forEach(x =>
                x.closest('.radio-card')?.classList.toggle('selected', x === e.target)
            );
            const shape = SHAPE_TO_MODEL[e.target.value] || 'straight';
            document.getElementById('lShapeOptions')?.classList.toggle('hidden', shape !== 'l-shaped');
            const stair = getSelected();
            if (stair) { updateStair(stair.id, { shape }); refreshInfoCards(getSelected()); }
        });
    });

    // ---- Turn direction ----
    document.querySelectorAll('input[name="stairTurnDirection"]').forEach(r => {
        r.addEventListener('change', function(e) {
            document.querySelectorAll('input[name="stairTurnDirection"]').forEach(x =>
                x.closest('.radio-card')?.classList.toggle('selected', x === e.target)
            );
            const stair = getSelected();
            if (stair) { updateStair(stair.id, { turnDirection: e.target.value }); refreshInfoCards(getSelected()); }
        });
    });

    // ---- Boards per tread ----
    document.querySelectorAll('input[name="boardsPerTread"]').forEach(r => {
        r.addEventListener('change', function(e) {
            document.querySelectorAll('input[name="boardsPerTread"]').forEach(x =>
                x.closest('.radio-card')?.classList.toggle('selected', x === e.target)
            );
            const stair = getSelected();
            if (stair) { updateStair(stair.id, { boardsPerTread: +e.target.value }); refreshInfoCards(getSelected()); }
        });
    });

    // ---- Stair width ----
    const swSlider = document.getElementById('stairWidthSlider');
    const swInput  = document.getElementById('stairWidthInput');
    if (swSlider && swInput) {
        swSlider.addEventListener('input', e => {
            const v = parseFloat(e.target.value); swInput.value = v;
            const stair = getSelected(); if (stair) updateStair(stair.id, { width: v });
        });
        swInput.addEventListener('change', e => {
            const v = Math.max(3, Math.min(8, parseFloat(e.target.value) || 4));
            e.target.value = v; swSlider.value = v;
            const stair = getSelected(); if (stair) updateStair(stair.id, { width: v });
        });
    }

    // ---- Handrails ----
    document.getElementById('stairHandrails')?.addEventListener('change', e => {
        const stair = getSelected();
        if (stair) updateStair(stair.id, { includeHandrails: e.target.checked });
    });

    // ---- Landing depth ----
    const ldSlider = document.getElementById('landingDepthSlider');
    const ldInput  = document.getElementById('landingDepthInput');
    if (ldSlider && ldInput) {
        ldSlider.addEventListener('input', e => {
            const v = parseFloat(e.target.value); ldInput.value = v;
            const stair = getSelected();
            if (stair) { updateStair(stair.id, { landingDepth: v }); refreshInfoCards(getSelected()); }
        });
        ldInput.addEventListener('change', e => {
            const v = Math.max(3, Math.min(6, parseFloat(e.target.value) || 3));
            e.target.value = v; ldSlider.value = v;
            const stair = getSelected();
            if (stair) { updateStair(stair.id, { landingDepth: v }); refreshInfoCards(getSelected()); }
        });
    }

    // ---- Landing split ----
    const lsSlider = document.getElementById('landingSplitSlider');
    const lsInput  = document.getElementById('landingSplitInput');
    if (lsSlider && lsInput) {
        lsSlider.addEventListener('input', e => {
            const p = parseInt(e.target.value, 10); lsInput.value = p;
            const stair = getSelected();
            if (stair) { updateStair(stair.id, { landingSplit: p / 100 }); refreshInfoCards(getSelected()); }
        });
        lsInput.addEventListener('change', e => {
            const p = Math.max(25, Math.min(75, parseInt(e.target.value, 10) || 50));
            e.target.value = p; lsSlider.value = p;
            const stair = getSelected();
            if (stair) { updateStair(stair.id, { landingSplit: p / 100 }); refreshInfoCards(getSelected()); }
        });
    }

    // ---- Subscribe: re-render list + refresh editor on every state change ----
    let lastSelectedId = state.selectedStairId;
    subscribe(() => {
        renderStairList(state);
        if (state.selectedStairId !== lastSelectedId) {
            lastSelectedId = state.selectedStairId;
            const stair = getSelected();
            if (stair) populateControls(stair);
        } else {
            const stair = getSelected();
            if (stair) refreshInfoCards(stair);
        }
    });

    // ---- Initial render ----
    renderStairList(state);
    const init = getSelected();
    if (init) populateControls(init);
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val)  { const el = document.getElementById(id); if (el) el.value = val; }
