// ============================================================
// TrueGrain Deck Builder 2 — Color Swatch UI
// ============================================================
import { CONFIG }             from '../config.js';
import { state, updateState } from '../state.js';

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
        btn.className    = 'color-swatch';
        btn.dataset.colorId = color.id;
        btn.title        = color.name;

        // Use texture image if available, fall back to hex color
        const texUrl = `${CONFIG.texturePath}${color.file}`;
        btn.style.cssText = `
            background-image: url('${texUrl}');
            background-size: cover;
            background-position: center;
            background-color: ${color.hex};
        `;

        // Name label
        const label = document.createElement('span');
        label.className   = 'color-swatch__name';
        label.textContent = color.name;
        btn.appendChild(label);

        // Checkmark overlay
        const check = document.createElement('span');
        check.className = 'color-swatch__check';
        check.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline></svg>`;
        btn.appendChild(check);

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
