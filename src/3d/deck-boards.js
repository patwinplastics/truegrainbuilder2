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
// Build a mitered board mesh from 4 absolute XZ corner points.
//
// pts: [[x0,z0],[x1,z1],[x2,z2],[x3,z3]] CCW order (top-down)
// Calls toNonIndexed() so each triangle gets its own verts and
// computeVertexNormals() produces flat per-face normals.
// ============================================================
function buildMiteredMesh(pts, yBot, yTop, material) {
    const p = new Float32Array([
        pts[0][0], yBot, pts[0][1],  // 0 bottom outer-left
        pts[1][0], yBot, pts[1][1],  // 1 bottom outer-right
        pts[2][0], yBot, pts[2][1],  // 2 bottom inner-right
        pts[3][0], yBot, pts[3][1],  // 3 bottom inner-left
        pts[0][0], yTop, pts[0][1],  // 4 top outer-left
        pts[1][0], yTop, pts[1][1],  // 5 top outer-right
        pts[2][0], yTop, pts[2][1],  // 6 top inner-right
        pts[3][0], yTop, pts[3][1],  // 7 top inner-left
    ]);

    const idx = [
        // Top face
        4, 6, 5,  4, 7, 6,
        // Bottom face
        0, 1, 2,  0, 2, 3,
        // Outer edge
        0, 5, 1,  0, 4, 5,
        // Right miter edge
        1, 6, 2,  1, 5, 6,
        // Inner edge
        2, 7, 3,  2, 6, 7,
        // Left miter edge
        3, 4, 0,  3, 7, 4,
    ];

    const indexedGeom = new THREE.BufferGeometry();
    indexedGeom.setAttribute('position', new THREE.BufferAttribute(p, 3));
    indexedGeom.setIndex(idx);

    // toNonIndexed() splits shared verts so each face gets its own
    // vertices — computeVertexNormals() then produces true flat normals
    // with no cross-face averaging that causes dark/discolored sides.
    const geom = indexedGeom.toNonIndexed();
    geom.computeVertexNormals();
    indexedGeom.dispose();

    return new THREE.Mesh(geom, material);
}

// ============================================================
// Picture frame — precise 45-degree mitered corners
// ============================================================
function createPictureFrameBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const bc    = state.borderWidth;
    const bwFt  = bc * ew;
    const bColor = state.borderSameColor ? colorConfig
        : (CONFIG.colors.find(c => c.id === state.borderColor) || colorConfig);
    const isLen = state.boardDirection === 'length';
    const dL = state.deckLength;
    const dW = state.deckWidth;

    for (let i = 0; i < bc; i++) {
        const L0 = dL / 2 - i * ew;
        const W0 = dW / 2 - i * ew;
        const L1 = L0 - bw;
        const W1 = W0 - bw;
        const yBot = state.deckHeight;
        const yTop = state.deckHeight + bt;

        // FRONT board: outer edge at z = -W0
        const frontMesh = buildMiteredMesh(
            [[-L0, -W0], [L0, -W0], [L1, -W1], [-L1, -W1]],
            yBot, yTop, createBoardMaterial(bColor, dL, false, `bf${i}`));
        frontMesh.castShadow = frontMesh.receiveShadow = true;
        deckGroup.add(frontMesh);

        // BACK board: outer edge at z = +W0
        const backMesh = buildMiteredMesh(
            [[L0, W0], [-L0, W0], [-L1, W1], [L1, W1]],
            yBot, yTop, createBoardMaterial(bColor, dL, false, `bb${i}`));
        backMesh.castShadow = backMesh.receiveShadow = true;
        deckGroup.add(backMesh);

        // LEFT board: outer edge at x = -L0
        const leftMesh = buildMiteredMesh(
            [[-L0, W0], [-L0, -W0], [-L1, -W1], [-L1, W1]],
            yBot, yTop, createBoardMaterial(bColor, dW, true, `bl${i}`));
        leftMesh.castShadow = leftMesh.receiveShadow = true;
        deckGroup.add(leftMesh);

        // RIGHT board: outer edge at x = +L0
        const rightMesh = buildMiteredMesh(
            [[L0, -W0], [L0, W0], [L1, W1], [L1, -W1]],
            yBot, yTop, createBoardMaterial(bColor, dW, true, `br${i}`));
        rightMesh.castShadow = rightMesh.receiveShadow = true;
        deckGroup.add(rightMesh);
    }

    // Fill boards
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
        m.position.set(isLen ? 0 : co, state.deckHeight + bt / 2, isLen ? co : 0);
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
