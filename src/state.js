// ============================================================
// TrueGrain Deck Builder 2 — Reactive State
// ============================================================
import { CONFIG } from './config.js';

export const state = {
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
    // Stair state — full data model from stair-data-model-patch
    stairs: [],
    stairsEnabled: false,
    selectedStairId: null,
    // Estimate options
    wastePercent: CONFIG.waste.default,
    pricePerLF: CONFIG.pricing.materialPerLF.default,
    includeLaborEstimate: false,
    // Contact
    contactName: '', contactEmail: '', contactPhone: '', contactZip: '',
    // Computed
    results: null,
    boardLayout: null
};

const listeners = [];
let isUpdating = false;
let _calcLayout = null;
let _calcAll = null;

/**
 * Inject calculator functions at app init to avoid circular imports.
 * Called once from src/main.js before the app starts.
 */
export function initCalculators(layoutFn, allFn) {
    _calcLayout = layoutFn;
    _calcAll = allFn;
}

export function subscribe(fn) {
    listeners.push(fn);
    return () => {
        const i = listeners.indexOf(fn);
        if (i > -1) listeners.splice(i, 1);
    };
}

export function updateState(updates) {
    if (isUpdating) return;
    isUpdating = true;
    try {
        document.getElementById('buildingSpinner')?.classList.remove('hidden');
        Object.assign(state, updates);
        if (_calcLayout) state.boardLayout = _calcLayout(state);
        if (_calcAll)    state.results     = _calcAll(state);
        listeners.forEach(fn => fn(state));
        debouncedSave();
    } finally {
        isUpdating = false;
    }
}

export function loadState() {
    try {
        const saved = localStorage.getItem('truegrain-deck-state');
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (!parsed.deckLength || !parsed.deckWidth) return;
        // Backfill stair fields that may be missing from older saves
        if (Array.isArray(parsed.stairs)) {
            parsed.stairs.forEach(s => {
                if (s.landingDepth === undefined) s.landingDepth = CONFIG.stairs.landingDepth;
                if (s.landingSplit  === undefined) s.landingSplit  = 0.5;
            });
        }
        Object.assign(state, parsed);
    } catch (_) {
        localStorage.removeItem('truegrain-deck-state');
    }
}

function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

const debouncedSave = debounce(() => {
    try { localStorage.setItem('truegrain-deck-state', JSON.stringify(state)); } catch (_) {}
}, 500);
