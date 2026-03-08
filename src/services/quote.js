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
        const customerData = {
            ...data,
            _subject: `Your TrueGrain Deck Estimate — ${data.deckSize}`,
            _replyto: data.email
        };
        const [res] = await Promise.all([
            fetch(CONFIG.formspreeEndpoint, {
                method: 'POST',
                headers: jsonHeaders(),
                body: JSON.stringify(data)
            }),
            fetch(CONFIG.formspreeCustomerEndpoint, {
                method: 'POST',
                headers: jsonHeaders(),
                body: JSON.stringify(customerData)
            })
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
    const r  = state.results;
    const st = state;

    // ── Human-readable lookups ──────────────────────────────
    const colorName   = CONFIG.colors.find(c => c.id === st.mainColor)?.name || st.mainColor;
    const patternName = { straight: 'Straight', breaker: 'Breaker Board', 'picture-frame': 'Picture Frame' }[st.pattern] || st.pattern;
    const dirName     = st.boardDirection === 'length' ? 'Lengthwise' : 'Widthwise';

    // ── Board length mix (deck surface only) ────────────────
    const byLen   = r?.boards?.byLength || {};
    const boards12 = byLen[12] || 0;
    const boards16 = byLen[16] || 0;
    const boards20 = byLen[20] || 0;
    const boardLengthsAllowed = (st.selectedBoardLengths || [12, 16, 20]).join(', ') + ' ft';
    const boardMixSummary = [
        boards12 ? `${boards12} × 12ft` : null,
        boards16 ? `${boards16} × 16ft` : null,
        boards20 ? `${boards20} × 20ft` : null
    ].filter(Boolean).join(', ') || '--';

    // ── Costs ───────────────────────────────────────────────
    const costs    = r?.costs;
    const grandLow  = costs?.grandTotal?.materialsOnly?.low?.toFixed(0)  || '';
    const grandHigh = costs?.grandTotal?.materialsOnly?.high?.toFixed(0) || '';
    const grandWork = costs?.grandTotal?.materialsOnly?.working?.toFixed(0) || '';
    const hwCost    = costs?.hardware?.total?.toFixed(0) || '';
    const stgrCost  = costs?.stringers?.total?.toFixed(0) || '';
    const laborLow  = costs?.grandTotal?.withLabor?.low?.toFixed(0)  || 'N/A';
    const laborHigh = costs?.grandTotal?.withLabor?.high?.toFixed(0) || 'N/A';

    // ── Stair details ────────────────────────────────────────
    const stairSummary = (st.stairsEnabled && st.stairs?.length)
        ? st.stairs.map((s, i) =>
            `Stair ${i + 1}: ${s.edge} edge, ${s.width || 4}ft wide, ${s.shape || 'straight'}, ${s.boardsPerTread || 2} boards/tread`
          ).join(' | ')
        : 'None';

    // ── Hardware ─────────────────────────────────────────────
    const hw = r?.hardware || {};

    return {
        // ── Contact ──────────────────────────────────────────
        name:            st.contactName,
        email:           st.contactEmail,
        _replyto:        st.contactEmail,
        phone:           st.contactPhone,
        zip:             st.contactZip,

        // ── Deck dimensions ──────────────────────────────────
        deckSize:        `${st.deckLength}' x ${st.deckWidth}'`,
        deckLength:      `${st.deckLength} ft`,
        deckWidth:       `${st.deckWidth} ft`,
        deckHeight:      `${st.deckHeight} ft`,
        squareFootage:   `${(st.deckLength * st.deckWidth).toFixed(0)} sq ft`,

        // ── Design choices ───────────────────────────────────
        boardDirection:  dirName,
        joistSpacing:    `${st.joistSpacing}" O.C.`,
        pattern:         patternName,
        color:           colorName,
        railings:        st.showRailings ? 'Yes' : 'No',

        // ── Board materials ──────────────────────────────────
        boardLengthsAvailable: boardLengthsAllowed,
        boardMix:        boardMixSummary,
        boards12ft:      boards12 || 0,
        boards16ft:      boards16 || 0,
        boards20ft:      boards20 || 0,
        boardTotal:      r?.boards?.total || '',
        boardLF:         r?.boards?.linealFeet?.toFixed(0) || '',
        wastePercent:    `${st.wastePercent}%`,
        pricePerLF:      `$${st.pricePerLF.toFixed(2)}/LF`,

        // ── Hardware ─────────────────────────────────────────
        clipBoxes:       hw.clipBoxes || '',
        screwBoxes:      hw.screwBoxes || '',
        hardwareCost:    hwCost ? `$${hwCost}` : '',

        // ── Stairs ───────────────────────────────────────────
        stairsEnabled:   st.stairsEnabled ? 'Yes' : 'No',
        stairCount:      st.stairs?.length || 0,
        stairDetails:    stairSummary,
        stairTreadBoards:   r?.stairs?.treadBoards?.total || 0,
        stairRiserBoards:   r?.stairs?.riserBoards?.total || 0,
        stairTreadLF:       r?.stairs?.treadBoards?.linealFeet?.toFixed(0) || 0,
        stringerCount:      r?.stairs?.stringers?.count || 0,
        stringerCost:       stgrCost ? `$${stgrCost}` : '',

        // ── Estimate ─────────────────────────────────────────
        estimateLow:     grandLow  ? `$${grandLow}`  : '',
        estimateHigh:    grandHigh ? `$${grandHigh}` : '',
        estimateWorking: grandWork ? `$${grandWork}` : '',
        laborIncluded:   st.includeLaborEstimate ? 'Yes' : 'No',
        laborLow:        st.includeLaborEstimate ? `$${laborLow}`  : 'N/A',
        laborHigh:       st.includeLaborEstimate ? `$${laborHigh}` : 'N/A',

        // ── Formspree routing ────────────────────────────────
        _subject: `Deck Quote — ${st.contactName} — ${st.deckLength}'x${st.deckWidth}' ${colorName}`
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
