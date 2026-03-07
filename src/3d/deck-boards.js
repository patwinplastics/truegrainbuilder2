// ============================================================
// TrueGrain Deck Builder 2 — Deck Board Geometry
// ============================================================
import { CONFIG }                              from '../config.js';
import { createBoardMaterial, createCapMaterial } from './materials.js';
import { createBoardGeometry, createTrimmedBoardGeometry, BOARD_PROFILE } from './board-profile.js';

function dims() {
    const bw = CONFIG.boards.width     / 12;
    const bt = CONFIG.boards.thickness / 12;
    const g  = CONFIG.boards.gap       / 12;
    return { bw, bt, g, ew: bw + g };
}

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
// Core board placement helper
// Accepts optional trimWidthFt — when provided the board is
// ripped to that width via a scaled geometry so it never
// protrudes past the deck boundary.
// sideMat = textured (group 0), capMat = solid color (group 1)
// ============================================================
function addProfileBoard(deckGroup, state, lengthFt, x, z, runsAlongX, sideMat, capMat, trimWidthFt) {
    const geo = createBoardGeometry(lengthFt);
    const m   = new THREE.Mesh(geo, [sideMat, capMat]);

    // If this board must be ripped narrower, scale it on the local axis
    // that represents board width.  When runsAlongX the board width maps
    // to the Z axis of the mesh (before rotation); after the PI/2 Y-rotation
    // it maps to X.  When !runsAlongX board width maps to X directly.
    if (trimWidthFt !== undefined && trimWidthFt !== null) {
        const { bw } = dims();
        const scaleFactor = Math.max(0.001, trimWidthFt / bw);
        if (runsAlongX) {
            // After rotation board-width axis is X
            m.scale.x = scaleFactor;
            // Re-centre: the board was centred at x assuming full width;
            // after scaling we need to shift half the difference so the
            // near edge stays flush with the previous board's gap.
            // The "cover" axis for runsAlongX boards is Z.
            // Actually for straight boards co is the Z position of the
            // board centre.  We want the near edge of the trimmed board
            // to stay at co - bw/2, so the new centre is:
            //   (co - bw/2) + trimWidthFt/2
            // This is handled by the caller passing the already-adjusted z.
        } else {
            // Board-width axis is X
            m.scale.x = scaleFactor;
        }
    }

    m.position.set(x, boardY(state), z);
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
    const { runDimension: run, coverDimension: cov, numRows, segments,
            lastRowTrimmed, lastRowWidthFt } = state.boardLayout;
    const capMat = createCapMaterial(colorConfig);

    for (let row = 0; row < numRows; row++) {
        const isLastRow  = row === numRows - 1;
        const trimWidth  = (isLastRow && lastRowTrimmed) ? lastRowWidthFt : null;

        // Centre of the board on the cover axis.
        // Full board: centre at (row * ew) - cov/2 + bw/2
        // Trimmed board: near edge must stay at (row * ew) - cov/2,
        //                so centre is (row * ew) - cov/2 + trimWidth/2
        const nearEdge   = row * ew - cov / 2;
        const halfW      = trimWidth !== null ? trimWidth / 2 : bw / 2;
        const co         = nearEdge + halfW;

        let ro = -run / 2;
        segments.forEach((seg, si) => {
            const sl      = seg.actualLength || seg.length;
            const sideMat = createBoardMaterial(colorConfig, sl, true, `s${row}_${si}`);
            const cx      = isLen ? ro + sl / 2 : co;
            const cz      = isLen ? co           : ro + sl / 2;
            addProfileBoard(deckGroup, state, sl, cx, cz, isLen, sideMat, capMat, trimWidth);
            ro += sl + g;
        });
    }
}

// ============================================================
// Mitered border mesh (picture frame)
// ============================================================
function buildMiteredMesh(pts, yBot, yTop, xMin, xMax, zMin, zMax, swapUV, material) {
    function uv(x, z) {
        const bu = (x - xMin) / (xMax - xMin);
        const bv = (z - zMin) / (zMax - zMin);
        return swapUV ? [bv, bu] : [bu, bv];
    }
    const positions = [
        [pts[0][0], yBot, pts[0][1]], [pts[1][0], yBot, pts[1][1]],
        [pts[2][0], yBot, pts[2][1]], [pts[3][0], yBot, pts[3][1]],
        [pts[0][0], yTop, pts[0][1]], [pts[1][0], yTop, pts[1][1]],
        [pts[2][0], yTop, pts[2][1]], [pts[3][0], yTop, pts[3][1]],
    ];
    const uvMap = positions.map(p => uv(p[0], p[2]));
    const triangles = [
        [4,6,5],[4,7,6], [0,1,2],[0,2,3],
        [0,5,1],[0,4,5], [1,6,2],[1,5,6],
        [2,7,3],[2,6,7], [3,4,0],[3,7,4],
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
    const dL  = state.deckLength;
    const dW  = state.deckWidth;
    const by  = boardY(state);
    const capMat = createCapMaterial(bColor);

    for (let i = 0; i < bc; i++) {
        const L0 = dL / 2 - i * ew;
        const W0 = dW / 2 - i * ew;
        const L1 = L0 - bw;
        const W1 = W0 - bw;
        const yBot = by - bt;
        const yTop = by;
        const mat  = createBoardMaterial(bColor, dL, true, `bframe${i}`);
        deckGroup.add(buildMiteredMesh([[-L0,-W0],[L0,-W0],[L1,-W1],[-L1,-W1]], yBot, yTop, -L0, L0, -W0, -W1, true,  mat));
        deckGroup.add(buildMiteredMesh([[L0,W0],[-L0,W0],[-L1,W1],[L1,W1]],    yBot, yTop, -L0, L0,  W1,  W0, true,  mat));
        deckGroup.add(buildMiteredMesh([[-L0,W0],[-L0,-W0],[-L1,-W1],[-L1,W1]],yBot, yTop, -L0,-L1, -W0,  W0, false, mat));
        deckGroup.add(buildMiteredMesh([[L0,-W0],[L0,W0],[L1,W1],[L1,-W1]],    yBot, yTop,  L1, L0, -W0,  W0, false, mat));
    }

    const isLen  = state.boardDirection === 'length';
    const bwFt   = bc * ew;
    const iLen   = dL - 2 * bwFt;
    const iWid   = dW - 2 * bwFt;
    const run    = isLen ? iLen : iWid;
    const cov    = isLen ? iWid : iLen;
    const nRows  = Math.ceil(cov / ew);
    const fillCap = createCapMaterial(colorConfig);

    // Trim detection for the picture-frame fill area
    const pfLastRowLeadingEdge = (nRows - 1) * ew;
    const pfLastRowFarEdge     = pfLastRowLeadingEdge + bw;
    const pfLastRowTrimmed     = pfLastRowFarEdge > cov + 1e-6;
    const pfLastRowWidthFt     = pfLastRowTrimmed ? (cov - pfLastRowLeadingEdge) : bw;

    for (let r = 0; r < nRows; r++) {
        const isLastRow = r === nRows - 1;
        const trimWidth = (isLastRow && pfLastRowTrimmed) ? pfLastRowWidthFt : null;

        const nearEdge  = r * ew - cov / 2;
        const halfW     = trimWidth !== null ? trimWidth / 2 : bw / 2;
        const co        = nearEdge + halfW;

        const sideMat = createBoardMaterial(colorConfig, run, true, `pf${r}`);
        const cx      = isLen ? 0  : co;
        const cz      = isLen ? co : 0;
        addProfileBoard(deckGroup, state, run, cx, cz, isLen, sideMat, fillCap, trimWidth);
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
    const { runDimension: run, coverDimension: cov, numRows,
            lastRowTrimmed, lastRowWidthFt } = state.boardLayout;
    const bp     = pattern.breakerPosition || run / 2;
    const capMat = createCapMaterial(colorConfig);
    const bkCap  = createCapMaterial(bColor);

    const bkMat = createBoardMaterial(bColor, cov, true, 'breaker');
    const bkX   = isLen ? bp - run / 2 : 0;
    const bkZ   = isLen ? 0             : bp - run / 2;
    addProfileBoard(deckGroup, state, cov, bkX, bkZ, !isLen, bkMat, bkCap);

    const s1 = bp - bw / 2 - g;
    const s2 = run - bp - bw / 2 - g;

    for (let row = 0; row < numRows; row++) {
        const isLastRow = row === numRows - 1;
        const trimWidth = (isLastRow && lastRowTrimmed) ? lastRowWidthFt : null;

        const nearEdge  = row * ew - cov / 2;
        const halfW     = trimWidth !== null ? trimWidth / 2 : bw / 2;
        const co        = nearEdge + halfW;

        [[s1, -run / 2 + s1 / 2], [s2, run / 2 - s2 / 2]].forEach(([sl, ctr]) => {
            if (sl <= 0) return;
            const sideMat = createBoardMaterial(colorConfig, sl, true, `bk_${row}`);
            const cx      = isLen ? ctr : co;
            const cz      = isLen ? co  : ctr;
            addProfileBoard(deckGroup, state, sl, cx, cz, isLen, sideMat, capMat, trimWidth);
        });
    }
}
