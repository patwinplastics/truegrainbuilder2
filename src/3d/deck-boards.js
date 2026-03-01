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
// Picture frame with 45-degree mitered corner caps
//
// Each border row i has:
//   - off:   distance from outer deck edge to board centerline
//   - Front/back boards: run along X, length = dL - 2*bw
//             (stop at left/right board centerlines)
//   - Left/right boards: run along Z, length = dW - 2*bw
//             (stop at front/back board centerlines)
//   - 4 corner caps: bw x bw square rotated 45deg around Y,
//             positioned at each outer corner centerline
//
// The rotated square's visible diagonal lines create the 45-deg
// miter seam. The cap stays within the bw x bw corner square
// because BoxGeometry bw x bw rotated 45deg has diagonal = bw*sqrt2
// which fits diagonally within a bw*sqrt2 x bw*sqrt2 outer box—
// BUT we must position it at the corner where the gap is bw x bw.
// To avoid overhang we use cap size = bw (not bw*sqrt2), rotated 45deg,
// so it inscribes within the bw x bw corner square perfectly.
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
        const off = i * ew + bw / 2;  // centerline from outer edge

        // Side board lengths: stop at the adjacent board's centerline
        // Front/back span from (-dL/2 + off) to (+dL/2 - off), length = dL - 2*off
        // But we want boards to stop at the INNER face of adjacent boards:
        // inner face of left board = -dL/2 + off + bw/2 = -dL/2 + i*ew + bw
        // So front/back length = dL - 2*(i*ew + bw) = dL - 2*i*ew - 2*bw
        const fbLen = dL - 2 * (i * ew + bw);
        const lrLen = dW - 2 * (i * ew + bw);

        // Front board
        const fMat = createBoardMaterial(bColor, fbLen, false, `bf${i}`);
        const fb   = new THREE.Mesh(new THREE.BoxGeometry(fbLen, bt, bw), fMat);
        fb.position.set(0, boardY, -(dW / 2 - off));
        fb.castShadow = fb.receiveShadow = true;
        deckGroup.add(fb);

        // Back board
        const bkMat = createBoardMaterial(bColor, fbLen, false, `bb${i}`);
        const bkb   = new THREE.Mesh(new THREE.BoxGeometry(fbLen, bt, bw), bkMat);
        bkb.position.set(0, boardY, dW / 2 - off);
        bkb.castShadow = bkb.receiveShadow = true;
        deckGroup.add(bkb);

        // Left board
        const lMat = createBoardMaterial(bColor, lrLen, true, `bl${i}`);
        const lb   = new THREE.Mesh(new THREE.BoxGeometry(bw, bt, lrLen), lMat);
        lb.position.set(-(dL / 2 - off), boardY, 0);
        lb.castShadow = lb.receiveShadow = true;
        deckGroup.add(lb);

        // Right board
        const rMat = createBoardMaterial(bColor, lrLen, true, `br${i}`);
        const rb   = new THREE.Mesh(new THREE.BoxGeometry(bw, bt, lrLen), rMat);
        rb.position.set(dL / 2 - off, boardY, 0);
        rb.castShadow = rb.receiveShadow = true;
        deckGroup.add(rb);

        // Corner caps: bw x bw square, rotated 45deg
        // Positioned at the intersection of the board centerlines
        const cx = dL / 2 - off;
        const cz = dW / 2 - off;
        [
            [-cx, -cz],
            [ cx, -cz],
            [-cx,  cz],
            [ cx,  cz],
        ].forEach(([capX, capZ], ci) => {
            const capMat = createBoardMaterial(bColor, bw, false, `cap${i}_${ci}`);
            const cap    = new THREE.Mesh(new THREE.BoxGeometry(bw, bt, bw), capMat);
            cap.position.set(capX, boardY, capZ);
            cap.rotation.y = Math.PI / 4;
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
