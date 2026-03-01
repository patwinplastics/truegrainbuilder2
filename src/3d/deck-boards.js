// ============================================================
// TrueGrain Deck Builder 2 — Deck Board Geometry
// Straight, picture-frame (mitered), and breaker-board patterns
// ============================================================
import { CONFIG }               from '../config.js';
import { createBoardMaterial }  from './materials.js';

function dims() {
    const bw = CONFIG.boards.width     / 12;
    const bt = CONFIG.boards.thickness / 12;
    const g  = CONFIG.boards.gap       / 12;
    return { bw, bt, g, ew: bw + g };
}

// Compute length segments so each sub-quad is roughly square.
function boardSegs(lengthFt, widthFt) {
    return Math.max(1, Math.ceil(lengthFt / widthFt));
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
            const segs = boardSegs(sl, bw);
            const mat = createBoardMaterial(colorConfig, sl, !isLen, `s${row}_${si}`);
            const m   = new THREE.Mesh(
                new THREE.BoxGeometry(
                    isLen ? sl : bw, bt, isLen ? bw : sl,
                    isLen ? segs : 1, 1, isLen ? 1 : segs
                ), mat);
            m.position.set(isLen ? ro + sl / 2 : co, boardY, isLen ? co : ro + sl / 2);
            m.castShadow = true;
            m.receiveShadow = false;
            deckGroup.add(m);
            ro += sl + g;
        });
    }
}

// ============================================================
// Build a mitered board mesh.
// ============================================================
function buildMiteredMesh(pts, yBot, yTop, xMin, xMax, zMin, zMax, swapUV, material) {
    function uv(x, z) {
        const bu = (x - xMin) / (xMax - xMin);
        const bv = (z - zMin) / (zMax - zMin);
        return swapUV ? [bv, bu] : [bu, bv];
    }

    const positions = [
        [pts[0][0], yBot, pts[0][1]],
        [pts[1][0], yBot, pts[1][1]],
        [pts[2][0], yBot, pts[2][1]],
        [pts[3][0], yBot, pts[3][1]],
        [pts[0][0], yTop, pts[0][1]],
        [pts[1][0], yTop, pts[1][1]],
        [pts[2][0], yTop, pts[2][1]],
        [pts[3][0], yTop, pts[3][1]],
    ];

    const uvMap = positions.map(p => uv(p[0], p[2]));

    const triangles = [
        [4, 6, 5], [4, 7, 6],   // top
        [0, 1, 2], [0, 2, 3],   // bottom
        [0, 5, 1], [0, 4, 5],   // outer edge
        [1, 6, 2], [1, 5, 6],   // right miter
        [2, 7, 3], [2, 6, 7],   // inner edge
        [3, 4, 0], [3, 7, 4],   // left miter
    ];

    const posArr = [];
    const uvArr  = [];
    for (const [a, b, c] of triangles) {
        for (const vi of [a, b, c]) {
            posArr.push(...positions[vi]);
            uvArr.push(...uvMap[vi]);
        }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posArr), 3));
    geom.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvArr),  2));
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
}

// ============================================================
// Picture frame — precise 45-degree mitered corners
// ============================================================
function createPictureFrameBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const bc     = state.borderWidth;
    const bColor = state.borderSameColor ? colorConfig
        : (CONFIG.colors.find(c => c.id === state.borderColor) || colorConfig);
    const dL = state.deckLength;
    const dW = state.deckWidth;

    for (let i = 0; i < bc; i++) {
        const L0 = dL / 2 - i * ew;
        const W0 = dW / 2 - i * ew;
        const L1 = L0 - bw;
        const W1 = W0 - bw;
        const yBot = state.deckHeight;
        const yTop = state.deckHeight + bt;
        const mat = createBoardMaterial(bColor, dL, true, `bframe${i}`);

        // FRONT: runs along X, narrow in Z
        deckGroup.add(buildMiteredMesh(
            [[-L0,-W0],[L0,-W0],[L1,-W1],[-L1,-W1]],
            yBot, yTop, -L0, L0, -W0, -W1, true, mat
        ));
        // BACK: runs along X, narrow in Z
        deckGroup.add(buildMiteredMesh(
            [[L0,W0],[-L0,W0],[-L1,W1],[L1,W1]],
            yBot, yTop, -L0, L0, W1, W0, true, mat
        ));
        // LEFT: runs along Z, narrow in X
        deckGroup.add(buildMiteredMesh(
            [[-L0,W0],[-L0,-W0],[-L1,-W1],[-L1,W1]],
            yBot, yTop, -L0, -L1, -W0, W0, false, mat
        ));
        // RIGHT: runs along Z, narrow in X
        deckGroup.add(buildMiteredMesh(
            [[L0,-W0],[L0,W0],[L1,W1],[L1,-W1]],
            yBot, yTop, L1, L0, -W0, W0, false, mat
        ));
    }

    // Fill boards
    const isLen  = state.boardDirection === 'length';
    const bwFt   = bc * ew;
    const iLen   = dL - 2 * bwFt;
    const iWid   = dW - 2 * bwFt;
    const run    = isLen ? iLen : iWid;
    const cov    = isLen ? iWid : iLen;
    const nRows  = Math.ceil(cov / ew);
    const fillSegs = boardSegs(run, bw);
    for (let r = 0; r < nRows; r++) {
        const co  = (r * ew) - cov / 2 + bw / 2;
        const mat = createBoardMaterial(colorConfig, run, !isLen, `pf${r}`);
        const m   = new THREE.Mesh(
            new THREE.BoxGeometry(
                isLen ? run : bw, bt, isLen ? bw : run,
                isLen ? fillSegs : 1, 1, isLen ? 1 : fillSegs
            ), mat);
        m.position.set(isLen ? 0 : co, state.deckHeight + bt / 2, isLen ? co : 0);
        m.castShadow = true;
        m.receiveShadow = false;
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
    const brkSegs = boardSegs(cov, bw);
    const br = new THREE.Mesh(
        new THREE.BoxGeometry(
            isLen ? bw : cov, bt, isLen ? cov : bw,
            isLen ? 1 : brkSegs, 1, isLen ? brkSegs : 1
        ),
        createBoardMaterial(bColor, cov, isLen, 'breaker')
    );
    br.position.set(isLen ? bp - run / 2 : 0, boardY, isLen ? 0 : bp - run / 2);
    br.castShadow = true;
    br.receiveShadow = false;
    deckGroup.add(br);
    const s1 = bp - bw / 2 - g, s2 = run - bp - bw / 2 - g;
    for (let row = 0; row < numRows; row++) {
        const co = (row * ew) - cov / 2 + bw / 2;
        [[s1, -run / 2 + s1 / 2], [s2, run / 2 - s2 / 2]].forEach(([sl, ctr], si) => {
            if (sl <= 0) return;
            const segs = boardSegs(sl, bw);
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(
                    isLen ? sl : bw, bt, isLen ? bw : sl,
                    isLen ? segs : 1, 1, isLen ? 1 : segs
                ),
                createBoardMaterial(colorConfig, sl, !isLen, `bk${si}_${row}`)
            );
            m.position.set(isLen ? ctr : co, boardY, isLen ? co : ctr);
            m.castShadow = true;
            m.receiveShadow = false;
            deckGroup.add(m);
        });
    }
}
