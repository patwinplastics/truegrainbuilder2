// ============================================================
// TrueGrain Deck Builder 2 — Color Swatch UI
// ============================================================
import { CONFIG }              from '../config.js';
import { state, updateState }  from '../state.js';

export function initColorSwatches() {
    initGroup('mainColorSwatches',    'mainColor');
    initGroup('breakerColorSwatches', 'breakerColor');
    initGroup('borderColorSwatches',  'borderColor');
}

function initGroup(containerId, key) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '';
    CONFIG.colors.forEach(color => {
        const btn = document.createElement('button');
        btn.className = 'color-swatch';
        btn.dataset.colorId = color.id;
        btn.title = color.name;
        btn.style.backgroundColor = color.hex;
        btn.innerHTML = `<span class="swatch-label">${color.name}</span>`;
        if (state[key] === color.id) btn.classList.add('selected');
        btn.addEventListener('click', () => {
            c.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            btn.classList.add('selected');
            updateState({ [key]: color.id });
        });
        c.appendChild(btn);
    });
}

export function syncSwatchSelections() {
    [['mainColorSwatches','mainColor'],['breakerColorSwatches','breakerColor'],['borderColorSwatches','borderColor']]
        .forEach(([id, key]) => {
            document.querySelectorAll(`#${id} .color-swatch`).forEach(s =>
                s.classList.toggle('selected', s.dataset.colorId === state[key])
            );
        });
}
