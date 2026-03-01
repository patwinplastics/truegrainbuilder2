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
// Build a mitered board mesh.
//
// pts: [[x0,z0],[x1,z1],[x2,z2],[x3,z3]]
//      [outer-A, outer-B, inner-B, inner-A]
//
// swapUV: when true, flips U and V so grain runs 90 degrees differently.
//   false -> grain runs along world-X  (use for FRONT/BACK boards)
//   true  -> grain runs along world-Z  (use for LEFT/RIGHT boards)
//
// UV computed from world XZ, normalised to [-L0..L0] x [-W0..W0]:
//   base_u = (x - xMin) / (xMax - xMin)
//   base_v = (z - zMin) / (zMax - zMin)
//   if swapUV: final [u,v] = [base_v, base_u]
//   else:      final [u,v] = [base_u, base_v]
//
// matH (boardRunsAlongWidth=false, rotation=PI/2): grain along world-X -> FRONT/BACK
// matV (boardRunsAlongWidth=true,  rotation=0):    grain along world-Z -> LEFT/RIGHT
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
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
}

// ============================================================
// Compute fill-board segments clamped to the inner fill area.
// Reuses layout segments when available; otherwise subdivides
// into equal pieces of roughly maxSegFt (default 6 ft).
// ============================================================
function computeFillSegments(run, gap, layoutSegments) {
    const segs = [];
    const maxSegFt = 6;

    if (layoutSegments && layoutSegments.length > 0) {
        let remaining = run;
        for (let i = 0; i < layoutSegments.length; i++) {
            if (remaining <= 0) break;
            const raw = layoutSegments[i].actualLength || layoutSegments[i].length;
            const sl  = Math.min(raw, remaining);
            segs.push(sl);
            remaining -= sl + gap;
        }
        if (remaining > 0) {
            const n = Math.max(1, Math.ceil(remaining / maxSegFt));
            const piece = (remaining - Math.max(0, n - 1) * gap) / n;
            for (let j = 0; j < n; j++) segs.push(piece);
        }
    } else {
        const n = Math.max(1, Math.ceil(run / maxSegFt));
        const piece = (run - Math.max(0, n - 1) * gap) / n;
        for (let j = 0; j < n; j++) segs.push(piece);
    }
    return segs;
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

    // matH: FRONT/BACK run along world-X -> boardRunsAlongWidth=false -> rotation=PI/2
    // matV: LEFT/RIGHT run along world-Z -> boardRunsAlongWidth=true  -> rotation=0
    for (let i = 0; i < bc; i++) {
        const L0 = dL / 2 - i * ew;
        const W0 = dW / 2 - i * ew;
        const L1 = L0 - bw;
        const W1 = W0 - bw;
        const yBot = state.deckHeight;
        const yTop = state.deckHeight + bt;
        const xMin = -L0, xMax = L0;
        const zMin = -W0, zMax = W0;

        const matH = createBoardMaterial(bColor, dL, false, `bframe${i}_h`);
        const matV = createBoardMaterial(bColor, dW, true,  `bframe${i}_v`);

        // FRONT (runs along X -> matH, swapUV=false)
        deckGroup.add(buildMiteredMesh(
            [[-L0,-W0],[L0,-W0],[L1,-W1],[-L1,-W1]],
            yBot, yTop, xMin, xMax, zMin, zMax, false, matH
        ));
        // BACK (runs along X -> matH, swapUV=false)
        deckGroup.add(buildMiteredMesh(
            [[L0,W0],[-L0,W0],[-L1,W1],[L1,W1]],
            yBot, yTop, xMin, xMax, zMin, zMax, false, matH
        ));
        // LEFT (runs along Z -> matV, swapUV=true)
        deckGroup.add(buildMiteredMesh(
            [[-L0,W0],[-L0,-W0],[-L1,-W1],[-L1,W1]],
            yBot, yTop, xMin, xMax, zMin, zMax, true, matV
        ));
        // RIGHT (runs along Z -> matV, swapUV=true)
        deckGroup.add(buildMiteredMesh(
            [[L0,-W0],[L0,W0],[L1,W1],[L1,-W1]],
            yBot, yTop, xMin, xMax, zMin, zMax, true, matV
        ));
    }

    // Fill boards — identical pattern to createStraightBoards:
    // one createBoardMaterial call per segment with uniqueId `pf${r}_${si}`
    // so rotation is always correctly keyed to the current isLen value.
    const isLen  = state.boardDirection === 'length';
    const bwFt   = bc * ew;
    const iLen   = dL - 2 * bwFt;
    const iWid   = dW - 2 * bwFt;
    const run    = isLen ? iLen : iWid;
    const cov    = isLen ? iWid : iLen;
    const nRows  = Math.ceil(cov / ew);
    const fillSegs = computeFillSegments(run, g, state.boardLayout?.segments);

    for (let r = 0; r < nRows; r++) {
        const co = (r * ew) - cov / 2 + bw / 2;
        let ro = -run / 2;
        for (let si = 0; si < fillSegs.length; si++) {
            const sl = fillSegs[si];
            if (sl <= 0) continue;
            // Mirror straight board: unique key per segment encodes isLen via rotation
            const mat = createBoardMaterial(colorConfig, sl, !isLen, `pf${r}_${si}`);
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(isLen ? sl : bw, bt, isLen ? bw : sl), mat);
            m.position.set(
                isLen ? ro + sl / 2 : co,
                state.deckHeight + bt / 2,
                isLen ? co : ro + sl / 2
            );
            m.castShadow = m.receiveShadow = true;
            deckGroup.add(m);
            ro += sl + g;
        }
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
