// ============================================================
// TrueGrain Deck Builder 2 — Deck Board Geometry
// Straight, picture-frame (mitered), and breaker-board patterns
// ============================================================
import { CONFIG }              from '../config.js';
import { createBoardMaterial } from './materials.js';
import { createBoardGeometry, BOARD_PROFILE } from './board-profile.js';

function dims() {
    const bw = CONFIG.boards.width     / 12;
    const bt = CONFIG.boards.thickness / 12;
    const g  = CONFIG.boards.gap       / 12;
    return { bw, bt, g, ew: bw + g };
}

// Boards sit ON TOP of state.deckHeight (which is joist-top).
// Mesh pivot is at the board top surface, so lift by one board thickness
// to clear the joist surface and eliminate z-fighting.
function boardY(state) {
    return state.deckHeight + BOARD_PROFILE.thicknessFt;
}

export function createDeckBoardsWithSegments(deckGroup, state, pattern, colorConfig) {
    if (!state.boardLayout) return;
    if      (pattern.type === 'picture-frame') createPictureFrameBoards(deckGroup, state, colorConfig);
    else if (pattern.type === 'breaker')       createBreakerBoards(deckGroup, state, pattern, colorConfig);
    else                                       createStraightBoards(deckGroup, state, colorConfig);
}

// ============================================================
// Helpers
// ============================================================
function boardSegs(lengthFt, widthFt) {
    return Math.max(1, Math.ceil(lengthFt / widthFt));
}

function addProfileBoard(deckGroup, state, lengthFt, x, z, runsAlongX, material) {
    const geo = createBoardGeometry(lengthFt);
    const m   = new THREE.Mesh(geo, material);
    m.position.set(x, boardY(state), z);
    // Board geometry runs along Z by default.
    // For boards running along X, rotate 90° around Y.
    if (runsAlongX) m.rotation.y = Math.PI / 2;
    m.castShadow    = true;
    m.receiveShadow = false;
    deckGroup.add(m);
}

// ============================================================
// Straight boards
// ============================================================
function createStraightBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const isLen = state.boardDirection === 'length';
    // isLen=true  → boards run along deck LENGTH axis = world X
    // isLen=false → boards run along deck WIDTH  axis = world Z
    const { runDimension: run, coverDimension: cov, numRows, segments } = state.boardLayout;

    for (let row = 0; row < numRows; row++) {
        const co = (row * ew) - cov / 2 + bw / 2;
        let ro = -run / 2;
        segments.forEach((seg, si) => {
            const sl  = seg.actualLength || seg.length;
            const mat = createBoardMaterial(colorConfig, sl, !isLen, `s${row}_${si}`);
            const cx  = isLen ? ro + sl / 2 : co;
            const cz  = isLen ? co           : ro + sl / 2;
            addProfileBoard(deckGroup, state, sl, cx, cz, isLen, mat);
            ro += sl + g;
        });
    }
}

// ============================================================
// Build a mitered board mesh (picture frame border).
// Retains BufferGeometry — mitered corners cannot use profile extrusion.
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
        [4, 6, 5], [4, 7, 6],
        [0, 1, 2], [0, 2, 3],
        [0, 5, 1], [0, 4, 5],
        [1, 6, 2], [1, 5, 6],
        [2, 7, 3], [2, 6, 7],
        [3, 4, 0], [3, 7, 4],
    ];
    const posArr = [], uvArr = [];
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
    mesh.castShadow    = true;
    mesh.receiveShadow = false;
    return mesh;
}

// ============================================================
// Picture frame
// ============================================================
function createPictureFrameBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const bc     = state.borderWidth;
    const bColor = state.borderSameColor ? colorConfig
        : (CONFIG.colors.find(c => c.id === state.borderColor) || colorConfig);
    const dL = state.deckLength;
    const dW = state.deckWidth;
    const by = boardY(state);

    // Mitered border boards
    for (let i = 0; i < bc; i++) {
        const L0 = dL / 2 - i * ew;
        const W0 = dW / 2 - i * ew;
        const L1 = L0 - bw;
        const W1 = W0 - bw;
        const yBot = by - bt;
        const yTop = by;
        const mat = createBoardMaterial(bColor, dL, true, `bframe${i}`);
        deckGroup.add(buildMiteredMesh([[-L0,-W0],[L0,-W0],[L1,-W1],[-L1,-W1]], yBot, yTop, -L0, L0, -W0, -W1, true, mat));
        deckGroup.add(buildMiteredMesh([[L0,W0],[-L0,W0],[-L1,W1],[L1,W1]],    yBot, yTop, -L0, L0,  W1,  W0, true, mat));
        deckGroup.add(buildMiteredMesh([[-L0,W0],[-L0,-W0],[-L1,-W1],[-L1,W1]],yBot, yTop, -L0,-L1, -W0,  W0, false, mat));
        deckGroup.add(buildMiteredMesh([[L0,-W0],[L0,W0],[L1,W1],[L1,-W1]],    yBot, yTop,  L1, L0, -W0,  W0, false, mat));
    }

    // Fill boards using profile geometry
    const isLen  = state.boardDirection === 'length';
    const bwFt   = bc * ew;
    const iLen   = dL - 2 * bwFt;
    const iWid   = dW - 2 * bwFt;
    const run    = isLen ? iLen : iWid;
    const cov    = isLen ? iWid : iLen;
    const nRows  = Math.ceil(cov / ew);

    for (let r = 0; r < nRows; r++) {
        const co  = (r * ew) - cov / 2 + bw / 2;
        const mat = createBoardMaterial(colorConfig, run, !isLen, `pf${r}`);
        const cx  = isLen ? 0  : co;
        const cz  = isLen ? co : 0;
        addProfileBoard(deckGroup, state, run, cx, cz, isLen, mat);
    }
}

// ============================================================
// Breaker boards
// ============================================================
function createBreakerBoards(deckGroup, state, pattern, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const isLen  = state.boardDirection === 'length';
    const bColor = state.breakerSameColor ? colorConfig
        : (CONFIG.colors.find(c => c.id === state.breakerColor) || colorConfig);
    const { runDimension: run, coverDimension: cov, numRows } = state.boardLayout;
    const bp = pattern.breakerPosition || run / 2;

    // Breaker runs perpendicular to main boards
    const bkMat = createBoardMaterial(bColor, cov, isLen, 'breaker');
    const bkX   = isLen ? bp - run / 2 : 0;
    const bkZ   = isLen ? 0             : bp - run / 2;
    addProfileBoard(deckGroup, state, cov, bkX, bkZ, !isLen, bkMat);

    const s1 = bp - bw / 2 - g;
    const s2 = run - bp - bw / 2 - g;

    for (let row = 0; row < numRows; row++) {
        const co = (row * ew) - cov / 2 + bw / 2;
        [[s1, -run / 2 + s1 / 2], [s2, run / 2 - s2 / 2]].forEach(([sl, ctr]) => {
            if (sl <= 0) return;
            const mat = createBoardMaterial(colorConfig, sl, !isLen, `bk_${row}`);
            const cx  = isLen ? ctr : co;
            const cz  = isLen ? co  : ctr;
            addProfileBoard(deckGroup, state, sl, cx, cz, isLen, mat);
        });
    }
}
