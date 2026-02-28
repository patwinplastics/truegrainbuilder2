// ============================================================
// TrueGrain Deck Builder 2 — Quote Submission Service
// Dual Formspree send: sales team + customer confirmation
// ============================================================
import { CONFIG } from '../config.js';
import { state }  from '../state.js';

export async function submitQuote() {
    const btn = document.getElementById('submitQuoteBtn');
    setLoading(btn, true);
    try {
        const data = buildPayload();
        const [res] = await Promise.all([
            fetch(CONFIG.formspreeEndpoint, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data) }),
            fetch(CONFIG.formspreeCustomerEndpoint, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ ...data, _subject: 'Your TrueGrain Deck Estimate' }) })
        ]);
        if (res.ok) showSuccess();
        else throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        console.error('Quote submission error:', err);
        alert(`There was a problem submitting your quote. Please try again or call us at ${CONFIG.companyInfo.phone}`);
    } finally {
        setLoading(btn, false);
    }
}

function buildPayload() {
    const r = state.results;
    return {
        contactName:   state.contactName,
        contactEmail:  state.contactEmail,
        contactPhone:  state.contactPhone,
        contactZip:    state.contactZip,
        deckLength:    state.deckLength,
        deckWidth:     state.deckWidth,
        deckHeight:    state.deckHeight,
        pattern:       state.pattern,
        mainColor:     state.mainColor,
        showRailings:  state.showRailings,
        stairsEnabled: state.stairsEnabled,
        stairCount:    state.stairs?.length || 0,
        squareFootage: (state.deckLength * state.deckWidth).toFixed(0),
        boardTotal:    r?.boards?.total || '',
        boardLF:       r?.boards?.linealFeet?.toFixed(0) || '',
        estimateLow:   r?.costs?.grandTotal?.materialsOnly?.low?.toFixed(0) || '',
        estimateHigh:  r?.costs?.grandTotal?.materialsOnly?.high?.toFixed(0) || '',
        _subject:      `Deck Quote — ${state.contactName} — ${state.deckLength}x${state.deckWidth}`
    };
}

function showSuccess() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.querySelector('[data-close-modal]')?.addEventListener('click', () => modal.classList.add('hidden'), { once: true });
    } else {
        alert('Thank you! Your quote request has been submitted. We will contact you shortly.');
    }
}

function setLoading(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.querySelector('.btn-label')?.classList.toggle('hidden', on);
    btn.querySelector('.btn-spinner')?.classList.toggle('hidden', !on);
}

const jsonHeaders = () => ({ 'Content-Type': 'application/json', 'Accept': 'application/json' });
