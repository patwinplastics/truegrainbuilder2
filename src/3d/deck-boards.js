// ============================================================
// TrueGrain Deck Builder 2 — Deck Board Geometry
// Straight, picture-frame (mitered), and breaker-board patterns
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
    const boardY  = state.deckHeight + bt/2;
    const isLen   = state.boardDirection === 'length';
    const { runDimension: run, coverDimension: cov, numRows, segments } = state.boardLayout;
    for (let row=0; row<numRows; row++) {
        const co = (row * ew) - cov/2 + bw/2;
        let ro   = -run/2;
        segments.forEach((seg, si) => {
            const sl  = seg.actualLength || seg.length;
            const mat = createBoardMaterial(colorConfig, sl, !isLen, `s${row}_${si}`);
            const m   = new THREE.Mesh(new THREE.BoxGeometry(isLen?sl:bw, bt, isLen?bw:sl), mat);
            m.position.set(isLen ? ro+sl/2 : co, boardY, isLen ? co : ro+sl/2);
            m.castShadow = m.receiveShadow = true;
            deckGroup.add(m);
            ro += sl + g;
        });
    }
}

// ============================================================
// Mitered board geometry using ExtrudeGeometry
//
// Creates a board shape in the XY plane (to be rotated flat):
//   - Runs along X from -halfLen to +halfLen
//   - Width bw along Y
//   - 45-deg cut at start: outer edge shifts by +bw, inner by 0
//   - 45-deg cut at end:   outer edge shifts by -bw, inner by 0
//
//  startMiter / endMiter: +1 = cut toward +Y, -1 = cut toward -Y
// ============================================================
function makeMiteredShape(outerLen, bw, startMiter, endMiter) {
    const hl = outerLen / 2;
    const shape = new THREE.Shape();

    // Corners going clockwise (outer edge first, then inner)
    // Outer edge (y = bw side)
    const x0 = -hl + (startMiter > 0 ? bw : 0);
    const x1 =  hl - (endMiter   > 0 ? bw : 0);
    // Inner edge (y = 0 side)
    const x2 =  hl - (endMiter   < 0 ? -bw : 0);
    const x3 = -hl + (startMiter < 0 ? -bw : 0);

    shape.moveTo(x0,  bw);
    shape.lineTo(x1,  bw);
    shape.lineTo(x2,  0);
    shape.lineTo(x3,  0);
    shape.closePath();
    return shape;
}

function makeMiteredBoardMesh(outerLen, bw, bt, startMiter, endMiter, material) {
    const shape = makeMiteredShape(outerLen, bw, startMiter, endMiter);
    const geom  = new THREE.ExtrudeGeometry(shape, {
        depth:           bt,
        bevelEnabled:    false
    });
    // ExtrudeGeometry extrudes along Z. Rotate so the board lies flat (XZ plane)
    // and the extrusion becomes the board thickness (Y axis).
    geom.rotateX(-Math.PI / 2);
    // After rotateX the shape's Y becomes -Z and Z becomes Y.
    // Center the thickness: translate Y by -bt/2 so it sits symmetrically.
    geom.translate(0, bt / 2, 0);
    return new THREE.Mesh(geom, material);
}

// ============================================================
// Picture frame with 45-degree mitered corners
//
// Convention (viewed from above, boards run along X):
//   Front board (z = -dW/2 + off): miter start = +1, end = +1
//     => both ends point toward deck interior (+Z direction)
//   Back board  (z = +dW/2 - off): miter start = -1, end = -1
//     => both ends point toward deck interior (-Z direction)
//   Left board  (x = -dL/2 + off): runs along Z, start = +1, end = -1
//   Right board (x = +dL/2 - off): runs along Z, start = -1, end = +1
//
// The miter offset equals bw so the tip reaches exactly to the
// outer corner of the deck, flush with the adjacent board's cut.
// ============================================================
function createPictureFrameBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const boardY = state.deckHeight;
    const bc     = state.borderWidth;
    const bwFt   = bc * ew;
    const bColor = state.borderSameColor ? colorConfig : (CONFIG.colors.find(c => c.id === state.borderColor) || colorConfig);
    const isLen  = state.boardDirection === 'length';
    const dL = state.deckLength;
    const dW = state.deckWidth;

    for (let i = 0; i < bc; i++) {
        const off = i * ew + bw / 2;

        // Front board: along X at z = -dW/2 + off
        // Miter tips point in +Z (toward deck) at both ends
        const frontMat = createBoardMaterial(bColor, dL, false, `brd_front_${i}`);
        const front    = makeMiteredBoardMesh(dL, bw, bt, 1, -1, frontMat);
        front.position.set(0, boardY, -dW / 2 + off);
        front.castShadow = front.receiveShadow = true;
        deckGroup.add(front);

        // Back board: along X at z = +dW/2 - off
        // Miter tips point in -Z (toward deck) at both ends
        const backMat = createBoardMaterial(bColor, dL, false, `brd_back_${i}`);
        const back    = makeMiteredBoardMesh(dL, bw, bt, -1, 1, backMat);
        back.position.set(0, boardY, dW / 2 - off);
        back.castShadow = back.receiveShadow = true;
        deckGroup.add(back);

        // Left board: along Z at x = -dL/2 + off
        // Rotate 90deg around Y so it runs along Z
        const leftMat = createBoardMaterial(bColor, dW, true, `brd_left_${i}`);
        const left    = makeMiteredBoardMesh(dW, bw, bt, -1, 1, leftMat);
        left.rotation.y = Math.PI / 2;
        left.position.set(-dL / 2 + off, boardY, 0);
        left.castShadow = left.receiveShadow = true;
        deckGroup.add(left);

        // Right board: along Z at x = +dL/2 - off
        const rightMat = createBoardMaterial(bColor, dW, true, `brd_right_${i}`);
        const right    = makeMiteredBoardMesh(dW, bw, bt, 1, -1, rightMat);
        right.rotation.y = Math.PI / 2;
        right.position.set(dL / 2 - off, boardY, 0);
        right.castShadow = right.receiveShadow = true;
        deckGroup.add(right);
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
        m.position.set(isLen ? 0 : co, boardY + bt / 2, isLen ? co : 0);
        m.castShadow = m.receiveShadow = true;
        deckGroup.add(m);
    }
}

// ============================================================
// Breaker boards
// ============================================================
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
