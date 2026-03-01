// ============================================================
// TrueGrain Deck Builder 2 — Deck Board Geometry
// Straight, picture-frame (mitered corners), and breaker-board
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

// ============================================================
// Straight boards
// ============================================================
function createStraightBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const boardY  = state.deckHeight + bt / 2;
    const isLen   = state.boardDirection === 'length';
    const { runDimension: run, coverDimension: cov, numRows, segments } = state.boardLayout;
    for (let row = 0; row < numRows; row++) {
        const co = (row * ew) - cov / 2 + bw / 2;
        let ro = -run / 2;
        segments.forEach((seg, si) => {
            const sl  = seg.actualLength || seg.length;
            const mat = createBoardMaterial(colorConfig, sl, !isLen, `s${row}_${si}`);
            const m   = new THREE.Mesh(new THREE.BoxGeometry(isLen ? sl : bw, bt, isLen ? bw : sl), mat);
            m.position.set(isLen ? ro + sl / 2 : co, boardY, isLen ? co : ro + sl / 2);
            m.castShadow = m.receiveShadow = true;
            deckGroup.add(m);
            ro += sl + g;
        });
    }
}

// ============================================================
// Picture frame — butt-jointed sides + 45-deg corner caps
//
// Each of the 4 sides is a BoxGeometry running its full length
// but trimmed SHORT by bw at each end so it stops at the
// corner boundary. A square cap (bw x bw) rotated 45 deg
// around Y fills each corner, creating the miter illusion.
//
// Top-down diagram for one corner row (i=0):
//
//   [cap]---[front board (dL - 2*bw)]---[cap]
//     |                                    |
//  [left board (dW - 2*bw)]          [right board]
//     |                                    |
//   [cap]---[back  board (dL - 2*bw)]---[cap]
//
// The cap is a square of side bw rotated 45deg, which creates
// the visual diagonal miter line at each corner.
// ============================================================
function createPictureFrameBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const boardY = state.deckHeight + bt / 2;
    const bc     = state.borderWidth;
    const bwFt   = bc * ew;
    const bColor = state.borderSameColor ? colorConfig
        : (CONFIG.colors.find(c => c.id === state.borderColor) || colorConfig);
    const isLen  = state.boardDirection === 'length';
    const dL = state.deckLength;
    const dW = state.deckWidth;

    for (let i = 0; i < bc; i++) {
        const off    = i * ew + bw / 2;   // centerline offset from outer edge
        const outerZ = dW / 2 - off;      // world Z of this border row centerline
        const outerX = dL / 2 - off;      // world X of this border row centerline

        // Each side board runs between the two adjacent corner caps.
        // It is shortened by bw on each end (the cap fills that space).
        const sideLen = dL - 2 * off;     // front/back board length
        const sideWid = dW - 2 * off;     // left/right board length

        // Front board (z = -outerZ)
        const fMat = createBoardMaterial(bColor, sideLen, false, `bf${i}`);
        const fb   = new THREE.Mesh(new THREE.BoxGeometry(sideLen, bt, bw), fMat);
        fb.position.set(0, boardY, -outerZ);
        fb.castShadow = fb.receiveShadow = true;
        deckGroup.add(fb);

        // Back board (z = +outerZ)
        const bkMat = createBoardMaterial(bColor, sideLen, false, `bb${i}`);
        const bkb   = new THREE.Mesh(new THREE.BoxGeometry(sideLen, bt, bw), bkMat);
        bkb.position.set(0, boardY, outerZ);
        bkb.castShadow = bkb.receiveShadow = true;
        deckGroup.add(bkb);

        // Left board (x = -outerX)
        const lMat = createBoardMaterial(bColor, sideWid, true, `bl${i}`);
        const lb   = new THREE.Mesh(new THREE.BoxGeometry(bw, bt, sideWid), lMat);
        lb.position.set(-outerX, boardY, 0);
        lb.castShadow = lb.receiveShadow = true;
        deckGroup.add(lb);

        // Right board (x = +outerX)
        const rMat = createBoardMaterial(bColor, sideWid, true, `br${i}`);
        const rb   = new THREE.Mesh(new THREE.BoxGeometry(bw, bt, sideWid), rMat);
        rb.position.set(outerX, boardY, 0);
        rb.castShadow = rb.receiveShadow = true;
        deckGroup.add(rb);

        // Corner caps — square bw x bw, rotated 45deg around Y
        // The diagonal of a square rotated 45deg = bw * sqrt(2) which
        // covers the corner gap exactly and creates the miter line.
        const capDiag = bw * Math.SQRT2;
        const corners = [
            [-dL / 2 + off, -dW / 2 + off],  // front-left
            [ dL / 2 - off, -dW / 2 + off],  // front-right
            [-dL / 2 + off,  dW / 2 - off],  // back-left
            [ dL / 2 - off,  dW / 2 - off],  // back-right
        ];
        corners.forEach(([cx, cz], ci) => {
            const capMat = createBoardMaterial(bColor, bw, false, `cap${i}_${ci}`);
            const cap    = new THREE.Mesh(new THREE.BoxGeometry(capDiag, bt, capDiag), capMat);
            cap.position.set(cx, boardY, cz);
            cap.rotation.y = Math.PI / 4;  // 45 degrees
            cap.castShadow = cap.receiveShadow = true;
            deckGroup.add(cap);
        });
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
            new THREE.BoxGeometry(isLen ? run : bw, bt, isLen ? bw : run), mat);
        m.position.set(isLen ? 0 : co, boardY, isLen ? co : 0);
        m.castShadow = m.receiveShadow = true;
        deckGroup.add(m);
    }
}

// ============================================================
// Breaker boards
// ============================================================
function createBreakerBoards(deckGroup, state, pattern, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const boardY  = state.deckHeight + bt / 2;
    const isLen   = state.boardDirection === 'length';
    const bColor  = state.breakerSameColor ? colorConfig
        : (CONFIG.colors.find(c => c.id === state.breakerColor) || colorConfig);
    const { runDimension: run, coverDimension: cov, numRows } = state.boardLayout;
    const bp = pattern.breakerPosition || run / 2;
    const br = new THREE.Mesh(
        new THREE.BoxGeometry(isLen ? bw : cov, bt, isLen ? cov : bw),
        createBoardMaterial(bColor, cov, isLen, 'breaker')
    );
    br.position.set(isLen ? bp - run / 2 : 0, boardY, isLen ? 0 : bp - run / 2);
    br.castShadow = true; deckGroup.add(br);
    const s1 = bp - bw / 2 - g, s2 = run - bp - bw / 2 - g;
    for (let row = 0; row < numRows; row++) {
        const co = (row * ew) - cov / 2 + bw / 2;
        [[s1, -run / 2 + s1 / 2], [s2, run / 2 - s2 / 2]].forEach(([sl, ctr], si) => {
            if (sl <= 0) return;
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(isLen ? sl : bw, bt, isLen ? bw : sl),
                createBoardMaterial(colorConfig, sl, !isLen, `bk${si}_${row}`)
            );
            m.position.set(isLen ? ctr : co, boardY, isLen ? co : ctr);
            m.castShadow = true; deckGroup.add(m);
        });
    }
}
