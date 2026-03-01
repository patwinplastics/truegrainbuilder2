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

// ============================================================
// Mitered board geometry helper
// Creates a board with 45-degree cuts at both ends.
//
// axis: 'x' = board runs along X, 'z' = board runs along Z
// length: outer length of the board (before miter)
// width: board width (the narrow dimension)
// thickness: board height (Y)
// miterStart: +1 or -1 to control miter direction at start
// miterEnd:   +1 or -1 to control miter direction at end
//
// For a board running along X:
//   The miter cuts are in the XZ plane.
//   miterStart/End control which diagonal direction.
// ============================================================
function createMiteredBoardGeometry(length, width, thickness, axis, miterStart, miterEnd) {
    const hw = width / 2;
    const hl = length / 2;
    const ht = thickness / 2;

    // Define the 2D shape (top-down outline) as 4 corners
    // For a board along X: corners in XZ plane
    // Start end (left): x = -hl, miter cuts at 45 deg
    // End (right): x = +hl, miter cuts at 45 deg
    // miterStart/End: the amount to shift corners (= hw for 45 deg)
    const msOff = miterStart * hw;
    const meOff = miterEnd * hw;

    let corners;
    if (axis === 'x') {
        // Board runs along X. Width is in Z.
        // 4 corners top-down: [x, z]
        corners = [
            [-hl + Math.max(0, msOff),  -hw],  // bottom-left
            [ hl + Math.min(0, meOff),  -hw],  // bottom-right
            [ hl + Math.max(0, meOff),   hw],  // top-right
            [-hl + Math.min(0, msOff),   hw],  // top-left
        ];
    } else {
        // Board runs along Z. Width is in X.
        // 4 corners top-down: [x, z]
        corners = [
            [-hw, -hl + Math.max(0, msOff)],  // bottom-left
            [ hw, -hl + Math.min(0, msOff)],  // bottom-right  
            [ hw,  hl + Math.max(0, meOff)],  // top-right
            [-hw,  hl + Math.min(0, meOff)],  // top-left
        ];
    }

    // Build a box-like geometry with the mitered top-down outline
    // 8 vertices (4 top, 4 bottom), 12 triangles (6 faces x 2 tris)
    const positions = new Float32Array(8 * 3);
    for (let i = 0; i < 4; i++) {
        // Bottom vertex
        positions[i * 3]     = corners[i][0];
        positions[i * 3 + 1] = -ht;
        positions[i * 3 + 2] = corners[i][1];
        // Top vertex
        positions[(i + 4) * 3]     = corners[i][0];
        positions[(i + 4) * 3 + 1] = ht;
        positions[(i + 4) * 3 + 2] = corners[i][1];
    }

    // Indices: 6 faces
    // Bottom: 0,1,2  0,2,3
    // Top: 4,6,5  4,7,6
    // Front (z=-hw or start): 0,1,5  0,5,4
    // Back (z=+hw or end): 2,3,7  2,7,6
    // Left: 3,0,4  3,4,7
    // Right: 1,2,6  1,6,5
    const indices = [
        0,2,1, 0,3,2,   // bottom
        4,5,6, 4,6,7,   // top
        0,1,5, 0,5,4,   // front
        2,3,7, 2,7,6,   // back
        3,0,4, 3,4,7,   // left
        1,2,6, 1,6,5    // right
    ];

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    // UV mapping: project from top (XZ plane)
    const uvs = new Float32Array(8 * 2);
    for (let i = 0; i < 4; i++) {
        let u, v;
        if (axis === 'x') {
            u = (corners[i][0] + hl) / length;
            v = (corners[i][1] + hw) / width;
        } else {
            u = (corners[i][0] + hw) / width;
            v = (corners[i][1] + hl) / length;
        }
        uvs[i * 2] = u;     uvs[i * 2 + 1] = v;
        uvs[(i+4) * 2] = u; uvs[(i+4) * 2 + 1] = v;
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    return geom;
}

/**
 * Picture frame with 45-degree mitered corners.
 *
 * Each border board is cut at 45 degrees at both ends so they
 * meet cleanly at the corners like a real picture frame.
 *
 * For each border row (i = 0..borderWidth-1):
 *   Front board: runs along X at z = -dW/2 + offset
 *   Back board:  runs along X at z = +dW/2 - offset
 *   Left board:  runs along Z at x = -dL/2 + offset
 *   Right board: runs along Z at x = +dL/2 - offset
 *
 * Miter convention: at each corner the X-board and Z-board
 * each contribute half the board width to the joint.
 */
function createPictureFrameBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const boardY = state.deckHeight + bt / 2;
    const bc     = state.borderWidth;
    const bwFt   = bc * ew;
    const bColor = state.borderSameColor ? colorConfig : (CONFIG.colors.find(c => c.id === state.borderColor) || colorConfig);
    const isLen  = state.boardDirection === 'length';
    const dL = state.deckLength;
    const dW = state.deckWidth;

    for (let i = 0; i < bc; i++) {
        const off = i * ew + bw / 2;

        // Front border: along X at z = -dW/2 + off
        // Miter: start (left corner) cuts toward -z, end (right corner) cuts toward -z
        const frontGeom = createMiteredBoardGeometry(dL, bw, bt, 'x', 1, -1);
        const frontMat  = createBoardMaterial(bColor, dL, false, `brd_front_${i}`);
        const front     = new THREE.Mesh(frontGeom, frontMat);
        front.position.set(0, boardY, -dW / 2 + off);
        front.castShadow = front.receiveShadow = true;
        deckGroup.add(front);

        // Back border: along X at z = +dW/2 - off
        const backGeom = createMiteredBoardGeometry(dL, bw, bt, 'x', -1, 1);
        const backMat  = createBoardMaterial(bColor, dL, false, `brd_back_${i}`);
        const back     = new THREE.Mesh(backGeom, backMat);
        back.position.set(0, boardY, dW / 2 - off);
        back.castShadow = back.receiveShadow = true;
        deckGroup.add(back);

        // Left border: along Z at x = -dL/2 + off
        const leftGeom = createMiteredBoardGeometry(dW, bw, bt, 'z', -1, 1);
        const leftMat  = createBoardMaterial(bColor, dW, true, `brd_left_${i}`);
        const left     = new THREE.Mesh(leftGeom, leftMat);
        left.position.set(-dL / 2 + off, boardY, 0);
        left.castShadow = left.receiveShadow = true;
        deckGroup.add(left);

        // Right border: along Z at x = +dL/2 - off
        const rightGeom = createMiteredBoardGeometry(dW, bw, bt, 'z', 1, -1);
        const rightMat  = createBoardMaterial(bColor, dW, true, `brd_right_${i}`);
        const right     = new THREE.Mesh(rightGeom, rightMat);
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
