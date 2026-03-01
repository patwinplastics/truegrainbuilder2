// ============================================================
// TrueGrain Deck Builder 2 — Deck Board Geometry
// Straight, picture-frame, and breaker-board patterns
// ============================================================
import { CONFIG }               from '../config.js';
import { createBoardMaterial }  from './materials.js';
import { selectOptimalBoardLength } from '../calc/optimizer.js';

function dims() {
    const bw = CONFIG.boards.width     / 12;
    const bt = CONFIG.boards.thickness / 12;
    const g  = CONFIG.boards.gap       / 12;
    return { bw, bt, g, ew: bw + g };
}

export function createDeckBoardsWithSegments(deckGroup, state, pattern, colorConfig) {
    if (!state.boardLayout) return;
    if      (pattern.type === 'picture-frame') createPictureFrameBoards(deckGroup, state, colorConfig);
    else if (pattern.type === 'breaker')       createBreakerBoards(deckGroup, state, pattern, colorConfig);
    else                                       createStraightBoards(deckGroup, state, colorConfig);
}

function createStraightBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const boardY  = state.deckHeight + bt/2;
    const isLen   = state.boardDirection === 'length';
    const { runDimension: run, coverDimension: cov, numRows, segments } = state.boardLayout;

    for (let row=0; row<numRows; row++) {
        const co = (row * ew) - cov/2 + bw/2;
        let ro   = -run/2;
        segments.forEach((seg, si) => {
            const sl  = seg.actualLength || seg.length;
            const mat = createBoardMaterial(colorConfig, sl, !isLen, `s${row}_${si}`);
            const m   = new THREE.Mesh(
                new THREE.BoxGeometry(isLen?sl:bw, bt, isLen?bw:sl),
                mat
            );
            m.position.set(isLen ? ro+sl/2 : co, boardY, isLen ? co : ro+sl/2);
            m.castShadow = m.receiveShadow = true;
            deckGroup.add(m);
            ro += sl + g;
        });
    }
}

/**
 * Picture frame: border boards on ALL 4 sides, fill boards inset.
 *
 * Layout (top-down view, boards run along length by default):
 *
 *   LLLL  FRONT BORDER (along X, full deckLength)  RRRR
 *   L  +----------------------------------+  R
 *   L  |        fill boards               |  R
 *   L  |        (run along X)             |  R
 *   L  +----------------------------------+  R
 *   LLLL  BACK BORDER (along X, full deckLength)   RRRR
 *
 *   LEFT/RIGHT borders run along Z (full deckWidth),
 *   perpendicular to front/back borders.
 *   They sit at a slightly higher Y to visually overlap at corners.
 */
function createPictureFrameBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const boardY = state.deckHeight + bt/2;
    const bc     = state.borderWidth;
    const bwFt   = bc * ew;
    const bColor = state.borderSameColor ? colorConfig : (CONFIG.colors.find(c=>c.id===state.borderColor)||colorConfig);
    const isLen  = state.boardDirection === 'length';
    const dL = state.deckLength;
    const dW = state.deckWidth;

    // Front/back border boards: run along X (deckLength), full length
    for (let i = 0; i < bc; i++) {
        const off = i * ew + bw / 2;
        // Front border (negative Z edge)
        const fb = new THREE.Mesh(
            new THREE.BoxGeometry(dL, bt, bw),
            createBoardMaterial(bColor, dL, false, `brd_front_${i}`)
        );
        fb.position.set(0, boardY, -dW / 2 + off);
        fb.castShadow = fb.receiveShadow = true;
        deckGroup.add(fb);

        // Back border (positive Z edge)
        const bb = new THREE.Mesh(
            new THREE.BoxGeometry(dL, bt, bw),
            createBoardMaterial(bColor, dL, false, `brd_back_${i}`)
        );
        bb.position.set(0, boardY, dW / 2 - off);
        bb.castShadow = bb.receiveShadow = true;
        deckGroup.add(bb);

        // Left border (negative X edge): runs along Z, full deckWidth
        const lb = new THREE.Mesh(
            new THREE.BoxGeometry(bw, bt, dW),
            createBoardMaterial(bColor, dW, true, `brd_left_${i}`)
        );
        lb.position.set(-dL / 2 + off, boardY + bt * 0.01, 0);
        lb.castShadow = lb.receiveShadow = true;
        deckGroup.add(lb);

        // Right border (positive X edge): runs along Z, full deckWidth
        const rb = new THREE.Mesh(
            new THREE.BoxGeometry(bw, bt, dW),
            createBoardMaterial(bColor, dW, true, `brd_right_${i}`)
        );
        rb.position.set(dL / 2 - off, boardY + bt * 0.01, 0);
        rb.castShadow = rb.receiveShadow = true;
        deckGroup.add(rb);
    }

    // Fill boards: inset by bwFt on all 4 sides
    const iLen  = dL - 2 * bwFt;
    const iWid  = dW - 2 * bwFt;
    const run   = isLen ? iLen : iWid;
    const cov   = isLen ? iWid : iLen;
    const nRows = Math.ceil(cov / ew);
    for (let r = 0; r < nRows; r++) {
        const co  = (r * ew) - cov / 2 + bw / 2;
        const mat = createBoardMaterial(colorConfig, run, !isLen, `pf${r}`);
        const m   = new THREE.Mesh(
            new THREE.BoxGeometry(isLen ? run : bw, bt, isLen ? bw : run),
            mat
        );
        m.position.set(isLen ? 0 : co, boardY, isLen ? co : 0);
        m.castShadow = m.receiveShadow = true;
        deckGroup.add(m);
    }
}

function createBreakerBoards(deckGroup, state, pattern, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const boardY  = state.deckHeight + bt/2;
    const isLen   = state.boardDirection === 'length';
    const bColor  = state.breakerSameColor ? colorConfig : (CONFIG.colors.find(c=>c.id===state.breakerColor)||colorConfig);
    const { runDimension: run, coverDimension: cov, numRows } = state.boardLayout;
    const bp = pattern.breakerPosition || run/2;

    const br = new THREE.Mesh(
        new THREE.BoxGeometry(isLen?bw:cov, bt, isLen?cov:bw),
        createBoardMaterial(bColor, cov, isLen, 'breaker')
    );
    br.position.set(isLen?bp-run/2:0, boardY, isLen?0:bp-run/2);
    br.castShadow=true; deckGroup.add(br);

    const s1=bp-bw/2-g, s2=run-bp-bw/2-g;
    for (let row=0; row<numRows; row++) {
        const co=(row*ew)-cov/2+bw/2;
        [[s1,-run/2+s1/2],[s2,run/2-s2/2]].forEach(([sl,ctr],si) => {
            if (sl<=0) return;
            const m=new THREE.Mesh(
                new THREE.BoxGeometry(isLen?sl:bw,bt,isLen?bw:sl),
                createBoardMaterial(colorConfig,sl,!isLen,`bk${si}_${row}`)
            );
            m.position.set(isLen?ctr:co, boardY, isLen?co:ctr);
            m.castShadow=true; deckGroup.add(m);
        });
    }
}
