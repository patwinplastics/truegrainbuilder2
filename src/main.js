// ============================================================
// TrueGrain Deck Builder 2 — Application Bootstrap
// Single entry point. Wires every module together.
// ============================================================
import { CONFIG }                                     from './config.js';
import { state, updateState, loadState,
         subscribe, initCalculators }                 from './state.js';
import { calculateOptimalBoardLayout }                from './calc/optimizer.js';
import { calculateAll }                               from './calc/estimator.js';
import { initScene, setCameraView, zoomCamera }       from './3d/scene.js';
import { preloadTextures }                            from './3d/materials.js';
import { updateUI }                                   from './ui/updates.js';
import { initColorSwatches }                          from './ui/swatches.js';
import { goToStep, initProgressNav }                  from './ui/wizard.js';
import { initStairUI }                                from './ui/stair-ui.js';
import { submitQuote }                                from './services/quote.js';
import { generatePDF }                                from './services/pdf.js';

// ---- Step 1: Inject calculators (breaks circular import) ----
initCalculators(calculateOptimalBoardLayout, calculateAll);

// ---- Step 2: Restore persisted state ----
loadState();

// ---- Step 3: Subscribe UI renderer to state ----
subscribe(updateUI);

// ---- Step 4: Boot on DOM ready ----
document.addEventListener('DOMContentLoaded', () => {
    preloadTextures();
    initScene();
    initColorSwatches();
    initProgressNav();
    initStairUI();
    bindEventListeners();

    // Sync wizard UI with restored state (e.g. currentStep from localStorage)
    goToStep(state.currentStep);
});

// ============================================================
// Helpers
// ============================================================
function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function syncSlider(sliderId, inputId, key, min, max, parse = parseFloat) {
    const sl = document.getElementById(sliderId);
    const ip = document.getElementById(inputId);
    if (!sl || !ip) return;
    sl.value = state[key];
    ip.value = state[key];
    const upd = debounce(v => updateState({ [key]: v }), 150);
    sl.addEventListener('input', e => {
        const v = parse(e.target.value);
        ip.value = v; upd(v);
    });
    ip.addEventListener('change', e => {
        let v = parse(e.target.value);
        v = Math.max(min, Math.min(max, isNaN(v) ? parse(sl.value) : v));
        e.target.value = v; sl.value = v;
        updateState({ [key]: v });
    });
}

// ============================================================
// Event Listeners
// ============================================================
function bindEventListeners() {

    // ---- Deck dimensions ----
    syncSlider('lengthSlider','lengthInput','deckLength', CONFIG.dimensions.minLength, CONFIG.dimensions.maxLength);
    syncSlider('widthSlider', 'widthInput', 'deckWidth',  CONFIG.dimensions.minWidth,  CONFIG.dimensions.maxWidth);
    syncSlider('heightSlider','heightInput','deckHeight', CONFIG.deck.minHeight,       CONFIG.deck.maxHeight);

    // ---- Joist spacing radios ----
    document.querySelectorAll('input[name="joistSpacing"]').forEach(r => {
        r.checked = +r.value === state.joistSpacing;
        r.addEventListener('change', e => updateState({ joistSpacing: +e.target.value }));
    });

    // ---- Board direction radios ----
    document.querySelectorAll('input[name="boardDirection"]').forEach(r => {
        r.checked = r.value === state.boardDirection;
        r.addEventListener('change', e => updateState({ boardDirection: e.target.value }));
    });

    // ---- Pattern cards ----
    document.querySelectorAll('.pattern-option').forEach(btn =>
        btn.addEventListener('click', () => btn.dataset.pattern && updateState({ pattern: btn.dataset.pattern }))
    );

    // ---- Border width ----
    syncSlider('borderWidthSlider','borderWidthInput','borderWidth', 1, 3, parseInt);

    // ---- Same-color toggles ----
    wire('breakerSameColor', v => {
        updateState({ breakerSameColor: v });
        document.getElementById('breakerColorSection')?.classList.toggle('hidden', v);
    });
    wire('borderSameColor', v => {
        updateState({ borderSameColor: v });
        document.getElementById('borderColorSection')?.classList.toggle('hidden', v);
    });

    // ---- Waste & price ----
    syncSlider('wasteSlider','wasteInput','wastePercent', CONFIG.waste.min, CONFIG.waste.max, parseInt);
    syncSlider('priceSlider','priceInput','pricePerLF', CONFIG.pricing.materialPerLF.min, CONFIG.pricing.materialPerLF.max);

    // ---- Labor toggle ----
    wire('includeLaborEstimate', v => updateState({ includeLaborEstimate: v }));

    // ---- Railings toggle ----
    wire('showRailings', v => updateState({ showRailings: v }));

    // ---- Stairs enabled toggle ----
    wire('stairsEnabled', v => {
        updateState({ stairsEnabled: v });
        document.getElementById('stairEdgeSection')?.classList.toggle('hidden', !v);
    });

    // ---- Contact fields ----
    ['contactName','contactEmail','contactPhone','contactZip'].forEach(key => {
        const el = document.getElementById(key);
        if (!el) return;
        el.value = state[key] || '';
        el.addEventListener('input', debounce(e => updateState({ [key]: e.target.value }), 300));
    });

    // ---- Submit quote ----
    document.getElementById('submitQuoteBtn')?.addEventListener('click', e => {
        e.preventDefault(); submitQuote();
    });

    // ---- PDF export ----
    document.querySelectorAll('[data-action="generate-pdf"]').forEach(btn =>
        btn.addEventListener('click', e => { e.preventDefault(); generatePDF(); })
    );

    // ---- Camera controls ----
    document.getElementById('view3D')?.addEventListener('click',  () => setCameraView('3d'));
    document.getElementById('viewTop')?.addEventListener('click', () => setCameraView('top'));
    document.getElementById('zoomIn')?.addEventListener('click',  () => zoomCamera(0.8));
    document.getElementById('zoomOut')?.addEventListener('click', () => zoomCamera(1.25));

    // ---- Reset ----
    document.querySelectorAll('[data-action="reset"]').forEach(btn =>
        btn.addEventListener('click', () => {
            if (confirm('Start over? Your current design will be lost.')) {
                localStorage.removeItem('truegrain-deck-state');
                location.reload();
            }
        })
    );
}

// Checkbox helper
function wire(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = !!state[id];
    el.addEventListener('change', e => handler(e.target.checked));
}
