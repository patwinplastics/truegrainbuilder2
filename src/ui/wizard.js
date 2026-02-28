// ============================================================
// TrueGrain Deck Builder 2 — Wizard Navigation
// ============================================================
import { state, updateState } from '../state.js';

export function goToStep(step) {
    if (step < 1 || step > state.totalSteps) return;
    if (step > state.currentStep && !validateStep(state.currentStep)) return;
    updateState({ currentStep: step });
    document.querySelectorAll('.wizard-step').forEach(el =>
        el.classList.toggle('active', +el.dataset.step === step)
    );
    document.querySelectorAll('.progress-step').forEach(el => {
        const s = +el.dataset.step;
        el.classList.toggle('active', s === step);
        el.classList.toggle('completed', s < step);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep(step) {
    if (step === 1) {
        if (!state.deckLength || !state.deckWidth || state.deckLength < 8 || state.deckWidth < 8) {
            flashError('Please enter valid deck dimensions (minimum 8ft).');
            return false;
        }
    }
    if (step === 6) {
        const name  = state.contactName?.trim();
        const email = state.contactEmail?.trim();
        if (!name || !email) { flashError('Please enter your name and email address.'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { flashError('Please enter a valid email address.'); return false; }
    }
    return true;
}

function flashError(msg) {
    const el = document.querySelector('.validation-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); return; }
    alert(msg);
}

export function initProgressNav() {
    document.querySelectorAll('.progress-step').forEach(el => {
        el.addEventListener('click', () => {
            const t = +el.dataset.step;
            if (t <= state.currentStep || el.classList.contains('completed')) goToStep(t);
        });
    });
    document.querySelectorAll('[data-next-step]').forEach(btn =>
        btn.addEventListener('click', () => goToStep(state.currentStep + 1))
    );
    document.querySelectorAll('[data-prev-step]').forEach(btn =>
        btn.addEventListener('click', () => goToStep(state.currentStep - 1))
    );
}
