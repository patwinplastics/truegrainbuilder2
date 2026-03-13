// ============================================================
// TrueGrain Deck Builder 2 — Accessories UI (Plants & Benches)
// ============================================================
import { state, updateState, subscribe } from '../state.js';
import { ACCESSORY_TYPES }               from '../3d/accessories.js';

let _nextId = 1;

function generateId() {
    return `acc_${Date.now()}_${_nextId++}`;
}

// ============================================================
// Accessory mutations
// ============================================================
function addAccessory(type) {
    const reg = ACCESSORY_TYPES[type];
    if (!reg) return;

    // Place near center of deck with slight random offset to avoid stacking
    const x = (Math.random() - 0.5) * Math.max(state.deckLength - 3, 2);
    const z = (Math.random() - 0.5) * Math.max(state.deckWidth  - 3, 2);

    const acc = { id: generateId(), type, x, z, rotation: 0 };
    updateState({ accessories: [...state.accessories, acc] });
}

function removeAccessory(id) {
    updateState({ accessories: state.accessories.filter(a => a.id !== id) });
}

function clearAllAccessories() {
    updateState({ accessories: [] });
}

// ============================================================
// Render accessory list
// ============================================================
function renderAccessoryList() {
    const list = document.getElementById('accessoryList');
    if (!list) return;

    if (!state.accessories?.length) {
        list.innerHTML = '<div class="accessory-list-empty">No accessories placed. Use the buttons below to add plants or benches to your deck.</div>';
        return;
    }

    list.innerHTML = state.accessories.map(acc => {
        const reg = ACCESSORY_TYPES[acc.type];
        const label = reg?.label || acc.type;
        const icon = reg?.category === 'plant' ? '&#x1F331;' : '&#x1FA91;';
        return `
        <div class="accessory-item" data-acc-id="${acc.id}">
            <span class="accessory-item__icon">${icon}</span>
            <span class="accessory-item__label">${label}</span>
            <button type="button" class="btn btn--danger btn--small" data-remove-acc="${acc.id}"
                style="padding:2px 8px;font-size:0.75em" aria-label="Remove">&times;</button>
        </div>`;
    }).join('');
}

// ============================================================
// Init
// ============================================================
export function initAccessoriesUI() {
    // Add buttons
    document.querySelectorAll('[data-add-accessory]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            const type = btn.dataset.addAccessory;
            if (type) addAccessory(type);
        });
    });

    // Remove buttons (delegated)
    document.getElementById('accessoryList')?.addEventListener('click', e => {
        const removeBtn = e.target.closest('[data-remove-acc]');
        if (removeBtn) {
            e.stopPropagation();
            removeAccessory(removeBtn.dataset.removeAcc);
        }
    });

    // Clear all button
    document.getElementById('clearAccessoriesBtn')?.addEventListener('click', e => {
        e.preventDefault();
        if (state.accessories?.length && confirm('Remove all accessories?')) {
            clearAllAccessories();
        }
    });

    // Subscribe to state changes
    subscribe(() => renderAccessoryList());
    renderAccessoryList();
}
