// ============================================================
// TrueGrain Deck Builder 2 — PDF Export Service
// Requires jsPDF loaded via CDN script tag
// ============================================================
import { CONFIG }         from '../config.js';
import { state }          from '../state.js';
import { getRenderer, getCamera, getScene } from '../3d/scene.js';
import { formatCurrency } from '../ui/updates.js';

export function generatePDF() {
    if (!window.jspdf?.jsPDF) { alert('PDF library not loaded. Please refresh the page.'); return; }
    const { jsPDF } = window.jspdf;
    const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw     = doc.internal.pageSize.getWidth();
    const ph     = doc.internal.pageSize.getHeight();
    const M      = 15;
    let y        = M;

    // Header bar
    doc.setFillColor(34, 34, 34);
    doc.rect(0, 0, pw, 30, 'F');
    try { doc.addImage(CONFIG.logoPath, 'PNG', M, 5, 50, 20); }
    catch (_) { doc.setTextColor(255,255,255); doc.setFontSize(18); doc.text('TrueGrain Deck Builder', M, 18); }
    doc.setTextColor(255, 255, 255); doc.setFontSize(10);
    doc.text('Deck Material Estimate', pw - M, 18, { align: 'right' });
    y = 40;

    // 3D snapshot
    try {
        const rnd = getRenderer(), cam = getCamera(), scn = getScene();
        if (rnd && cam && scn) {
            rnd.render(scn, cam);
            doc.addImage(rnd.domElement.toDataURL('image/jpeg', 0.85), 'JPEG', M, y, pw - 2 * M, 60);
            y += 65;
        }
    } catch (_) {}

    const r = state.results;

    // Config section
    y = addSection(doc, 'Deck Configuration', M, y);
    [
        ['Size',    `${state.deckLength}' x ${state.deckWidth}' (${(state.deckLength*state.deckWidth).toFixed(0)} sq ft)`],
        ['Height',  `${state.deckHeight}'`],
        ['Pattern', state.pattern.replace(/-/g, ' ')],
        ['Color',   CONFIG.colors.find(c => c.id === state.mainColor)?.name || state.mainColor],
        ['Railings',state.showRailings ? 'Yes' : 'No'],
        ['Stairs',  state.stairsEnabled ? `${state.stairs.length} set(s)` : 'None']
    ].forEach(([l, v]) => { y = addRow(doc, l, v, M, y); });

    // Materials section
    y = addSection(doc, 'Material Summary', M, y + 4);
    if (r?.boards) {
        [
            ['Total Boards', `${r.boards.total} boards (${r.boards.linealFeet.toFixed(0)} LF)`],
            ["12' Boards",   r.boards.byLength[12] || 0],
            ["16' Boards",   r.boards.byLength[16] || 0],
            ["20' Boards",   r.boards.byLength[20] || 0],
            ['Clip Boxes',   r.hardware.clipBoxes],
            ['Screw Boxes',  r.hardware.screwBoxes]
        ].forEach(([l, v]) => { y = addRow(doc, l, String(v), M, y); });
    }

    // Costs section
    y = addSection(doc, 'Cost Estimate', M, y + 4);
    if (r?.costs) {
        const c = r.costs;
        [
            ['Materials (low)',  formatCurrency(c.materials.total.low)],
            ['Materials (high)', formatCurrency(c.materials.total.high)],
            ['Hardware',         formatCurrency(c.hardware.total)],
            ['Total (low)',      formatCurrency(c.grandTotal.materialsOnly.low)],
            ['Total (high)',     formatCurrency(c.grandTotal.materialsOnly.high)]
        ].forEach(([l, v]) => { y = addRow(doc, l, v, M, y); });
    }

    // Contact
    if (state.contactName || state.contactEmail) {
        y = addSection(doc, 'Prepared For', M, y + 4);
        [state.contactName, state.contactEmail, state.contactPhone, state.contactZip ? `Zip: ${state.contactZip}` : '']
            .filter(Boolean).forEach(line => { doc.setFontSize(10); doc.setFont(undefined,'normal'); doc.text(line, M, y); y += 5; });
    }

    // Footer
    doc.setFillColor(34, 34, 34); doc.rect(0, ph - 20, pw, 20, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8);
    doc.text(`${CONFIG.companyInfo.phone} | ${CONFIG.companyInfo.email} | ${CONFIG.companyInfo.address}`, pw / 2, ph - 10, { align: 'center' });
    doc.text(`Generated ${new Date().toLocaleDateString()}`, pw / 2, ph - 5, { align: 'center' });
    doc.save(`TrueGrain-Deck-Estimate-${state.deckLength}x${state.deckWidth}.pdf`);
}

function addSection(doc, title, x, y) {
    doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(34, 34, 34);
    doc.text(title, x, y);
    return y + 7;
}
function addRow(doc, label, value, x, y) {
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');  doc.text(label + ':', x, y);
    doc.setFont(undefined, 'normal'); doc.text(String(value), x + 55, y);
    return y + 6;
}
