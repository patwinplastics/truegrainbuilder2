// ============================================================
// TrueGrain Deck Builder 2 — PDF Export Service (Branded)
// Brand colors: Navy #1B2A6B | Red #C8102E | White #FFFFFF
// Requires jsPDF loaded via CDN script tag
// ============================================================
import { CONFIG }         from '../config.js';
import { state }          from '../state.js';
import { getRenderer, getCamera, getScene } from '../3d/scene.js';
import { formatCurrency } from '../ui/updates.js';

// ── Brand palette ──────────────────────────────────────────
const NAVY  = [27,  42, 107];   // #1B2A6B
const RED   = [200, 16,  46];   // #C8102E
const WHITE = [255, 255, 255];
const LGRAY = [245, 246, 248];
const DGRAY = [80,  80,  80];
const RULE  = [210, 213, 222];

// ── Logo placement ───────────────────────────────────────
const LOGO_X   = 14;
const LOGO_Y   = 5.5;
const LOGO_W   = 68;
const LOGO_H   = 22;
const LOGO_PAD = 3;

// ── Layout constants ──────────────────────────────────────
const FOOTER_H       = 22;   // total footer band height (mm)
const SNAP_MAX_H     = 80;   // max 3D snapshot height (mm) — increase to show more vertical detail
const SNAP_MAX_W_FRAC = 1;   // snapshot uses full content width

export function generatePDF() {
    if (!window.jspdf?.jsPDF) { alert('PDF library not loaded. Please refresh the page.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw  = doc.internal.pageSize.getWidth();   // 210
    const ph  = doc.internal.pageSize.getHeight();  // 297
    const M   = 14;
    const BODY_MAX_Y = ph - FOOTER_H - 6;
    let y = 0;

    // ── 1. HEADER BAND ──────────────────────────────────────
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pw, 36, 'F');
    doc.setFillColor(...RED);
    doc.rect(0, 0, pw, 3, 'F');

    doc.setFillColor(...WHITE);
    doc.roundedRect(LOGO_X - LOGO_PAD, LOGO_Y - LOGO_PAD, LOGO_W + LOGO_PAD * 2, LOGO_H + LOGO_PAD * 2, 2, 2, 'F');

    try {
        doc.addImage(CONFIG.logoPath, 'PNG', LOGO_X, LOGO_Y, LOGO_W, LOGO_H);
    } catch (_) {
        doc.setFont('helvetica', 'bold');   doc.setFontSize(14); doc.setTextColor(...NAVY);
        doc.text('TrueGrain', LOGO_X + 2, LOGO_Y + 10);
        doc.setTextColor(...RED);
        doc.text('Decking', LOGO_X + 36, LOGO_Y + 10);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...DGRAY);
        doc.text('FEELS REAL. LASTS LONGER.  by American PRO', LOGO_X + 2, LOGO_Y + 17);
    }

    doc.setFont('helvetica', 'bold');   doc.setFontSize(10); doc.setTextColor(...WHITE);
    doc.text('DECK MATERIAL ESTIMATE', pw - M, 17, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);  doc.setTextColor(180, 190, 220);
    doc.text(
        `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        pw - M, 23, { align: 'right' }
    );

    y = 44;

    // ── 2. 3D SNAPSHOT ──────────────────────────────────────
    try {
        const rnd = getRenderer(), cam = getCamera(), scn = getScene();
        if (rnd && cam && scn) {
            rnd.render(scn, cam);
            const canvas = rnd.domElement;
            const aspect = canvas.width / canvas.height;
            const imgW   = (pw - 2 * M) * SNAP_MAX_W_FRAC;
            const imgH   = Math.min(imgW / aspect, SNAP_MAX_H);
            doc.setDrawColor(...NAVY);
            doc.setLineWidth(0.4);
            doc.roundedRect(M, y, imgW, imgH, 2, 2, 'S');
            doc.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', M, y, imgW, imgH, '', 'FAST');
            y += imgH + 8;
        }
    } catch (_) {}

    const r = state.results;

    // ── 3. TWO-COLUMN CONTENT AREA ──────────────────────────
    const colW = (pw - 2 * M - 6) / 2;
    const colR = M + colW + 6;
    let   yL   = y;
    let   yR   = y;

    yL = drawSectionHeader(doc, 'Deck Configuration', M, yL, colW);
    yL = drawTable(doc, [
        ['Size',     `${state.deckLength}' x ${state.deckWidth}' (${(state.deckLength * state.deckWidth).toFixed(0)} sq ft)`],
        ['Height',   `${state.deckHeight}'`],
        ['Pattern',  capitalize(state.pattern.replace(/-/g, ' '))],
        ['Color',    CONFIG.colors.find(c => c.id === state.mainColor)?.name || state.mainColor],
        ['Railings', state.showRailings ? 'Yes' : 'No'],
        ['Stairs',   state.stairsEnabled ? `${state.stairs.length} set(s)` : 'None']
    ], M, yL, colW);

    yR = drawSectionHeader(doc, 'Material Summary', colR, yR, colW);
    if (r?.boards) {
        yR = drawTable(doc, [
            ['Total Boards', `${r.boards.total} (${r.boards.linealFeet.toFixed(0)} LF)`],
            ["12' Boards",   String(r.boards.byLength[12] || 0)],
            ["16' Boards",   String(r.boards.byLength[16] || 0)],
            ["20' Boards",   String(r.boards.byLength[20] || 0)],
            ['Clip Boxes',   String(r.hardware.clipBoxes)],
            ['Screw Boxes',  String(r.hardware.screwBoxes)]
        ], colR, yR, colW);
    }

    y = Math.max(yL, yR) + 8;

    // ── 4. COST ESTIMATE ──────────────────────────────────────
    if (r?.costs) {
        const c = r.costs;
        y = drawSectionHeader(doc, 'Cost Estimate', M, y, pw - 2 * M);
        y = drawTable(doc, [
            ['Materials (low)',  formatCurrency(c.materials.total.low)],
            ['Materials (high)', formatCurrency(c.materials.total.high)],
            ['Hardware',         formatCurrency(c.hardware.total)]
        ], M, y, pw - 2 * M);

        const rowH = 10;
        doc.setFillColor(...NAVY);
        doc.roundedRect(M, y, pw - 2 * M, rowH, 2, 2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...WHITE);
        doc.text('Estimated Total Range', M + 4, y + 6.5);
        doc.text(
            `${formatCurrency(c.grandTotal.materialsOnly.low)} – ${formatCurrency(c.grandTotal.materialsOnly.high)}`,
            pw - M - 4, y + 6.5, { align: 'right' }
        );
        y += rowH + 8;
    }

    // ── 5. PREPARED FOR ─────────────────────────────────────
    if (state.contactName || state.contactEmail) {
        y = drawSectionHeader(doc, 'Prepared For', M, y, pw - 2 * M);
        const lines = [
            state.contactName,
            state.contactEmail,
            state.contactPhone,
            state.contactZip ? `Zip: ${state.contactZip}` : ''
        ].filter(Boolean);

        doc.setFillColor(...LGRAY);
        doc.roundedRect(M, y, pw - 2 * M, lines.length * 6 + 6, 2, 2, 'F');
        lines.forEach((line, i) => {
            doc.setFontSize(10);
            if (i === 0) { doc.setFont('helvetica', 'bold');   doc.setTextColor(...NAVY); }
            else         { doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY); }
            doc.text(line, M + 4, y + 5 + i * 6);
        });
        y += lines.length * 6 + 10;
    }

    // ── 6. DISCLAIMER ────────────────────────────────────────
    const disclaimerText = 'This estimate is for material quantities only and does not include labor, permits, or installation costs. Prices subject to change without notice. Contact us for a full project quote.';
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(150, 150, 160);
    const dLines      = doc.splitTextToSize(disclaimerText, pw - 2 * M);
    const dHeight     = dLines.length * 4;
    const disclaimerY = Math.min(y, BODY_MAX_Y - dHeight);
    doc.text(dLines, M, disclaimerY);

    // ── 7. FOOTER BAND ───────────────────────────────────────
    doc.setFillColor(...RED);
    doc.rect(0, ph - FOOTER_H, pw, 1.5, 'F');
    doc.setFillColor(...NAVY);
    doc.rect(0, ph - FOOTER_H + 1.5, pw, FOOTER_H - 1.5, 'F');

    doc.setFont('helvetica', 'bold');   doc.setFontSize(8.5); doc.setTextColor(...WHITE);
    doc.text(CONFIG.companyInfo.phone, pw / 2, ph - 13, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(180, 190, 220);
    doc.text(`${CONFIG.companyInfo.email}  |  ${CONFIG.companyInfo.address}`, pw / 2, ph - 8,   { align: 'center' });
    doc.text('Feels Real. Lasts Longer.  by American PRO',                    pw / 2, ph - 3.5, { align: 'center' });

    doc.save(`TrueGrain-Deck-Estimate-${state.deckLength}x${state.deckWidth}.pdf`);
}

// ── Helpers ──────────────────────────────────────────────────

function drawSectionHeader(doc, title, x, y, w) {
    doc.setFillColor(...NAVY);
    doc.rect(x, y, 3, 6.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...NAVY);
    doc.text(title.toUpperCase(), x + 6, y + 5.5);
    doc.setDrawColor(...RULE); doc.setLineWidth(0.3);
    doc.line(x, y + 8, x + w, y + 8);
    return y + 12;
}

function drawTable(doc, rows, x, y, w) {
    const rowH   = 7;
    const labelW = w * 0.55;
    rows.forEach(([label, value], i) => {
        if (i % 2 === 0) { doc.setFillColor(...LGRAY); doc.rect(x, y - 1, w, rowH, 'F'); }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DGRAY);
        doc.text(label, x + 3, y + 4.5);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
        doc.text(String(value), x + labelW, y + 4.5, { align: 'left' });
        y += rowH;
    });
    return y + 3;
}

function capitalize(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
}
