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
// Mitered board geometry
//
// All shapes defined in the XZ plane (top-down), then a flat
// box is built at the correct Y position.
//
// For a board running along X with its OUTER edge at -Z:
//   inner edge (at z=0 relative to board center): full length
//   outer edge (at z=-bw): cut back by bw at both ends
//
//   Shape (in local XZ):
//     (-hl,  0)  →  (+hl,  0)   inner edge, full length
//     (+hl-bw, -bw)             outer right
//     (-hl+bw, -bw)             outer left
//
// The mesh is centered at the board's world position.
// outerSign: -1 = outer edge is at -Z (front/back boards)
//             +1 = outer edge is at +Z (not used; flip via rotation)
// ============================================================
function makeMiteredBoardGeometry(length, bw, bt) {
    const hl = length / 2;

    // Shape in XZ plane. Outer edge faces -Z (toward outside of deck).
    // Inner edge at z = 0, outer edge at z = -bw.
    // Miter: outer corners are inset by bw from each end.
    const shape = new THREE.Shape();
    shape.moveTo(-hl,       0);   // inner left
    shape.lineTo( hl,       0);   // inner right
    shape.lineTo( hl - bw, -bw);  // outer right
    shape.lineTo(-hl + bw, -bw);  // outer left
    shape.closePath();

    // Extrude in Y (will represent board thickness)
    const geom = new THREE.ExtrudeGeometry(shape, {
        depth:        bt,
        bevelEnabled: false
    });

    // ExtrudeGeometry creates shape in XY plane, extruded along +Z.
    // We need the shape in XZ and thickness in Y.
    // Rotate -90deg around X: Y->Z, Z->-Y  (shape goes to XZ plane, extrusion goes down -Y)
    geom.rotateX(-Math.PI / 2);

    // After rotation: extrusion is along -Y. Translate up by bt so
    // bottom of board is at y=0 (caller sets position.y = deckHeight).
    geom.translate(0, bt, 0);

    // The shape outer edge is at z = -bw local space.
    // We want the board centered on its world Z position, with outer
    // edge outward. Shift the shape so it's centered: translate +bw/2 in Z.
    geom.translate(0, 0, bw / 2);

    return geom;
}

function addMiteredBoard(deckGroup, geom, material, x, y, z, rotY) {
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(x, y, z);
    if (rotY) mesh.rotation.y = rotY;
    mesh.castShadow = mesh.receiveShadow = true;
    deckGroup.add(mesh);
}

// ============================================================
// Picture frame — 45-degree mitered corners
//
// Board geometry has outer edge at -Z in local space.
// Front board  (outer edge faces -Z world): no rotation needed
// Back board   (outer edge faces +Z world): rotate Y 180deg
// Left board   (outer edge faces -X world): rotate Y +90deg
// Right board  (outer edge faces +X world): rotate Y -90deg
// ============================================================
function createPictureFrameBoards(deckGroup, state, colorConfig) {
    const { bw, bt, g, ew } = dims();
    const boardY = state.deckHeight;
    const bc     = state.borderWidth;
    const bwFt   = bc * ew;
    const bColor = state.borderSameColor ? colorConfig
        : (CONFIG.colors.find(c => c.id === state.borderColor) || colorConfig);
    const isLen  = state.boardDirection === 'length';
    const dL = state.deckLength;
    const dW = state.deckWidth;

    for (let i = 0; i < bc; i++) {
        const off = i * ew + bw / 2;

        // Front board: outer edge faces -Z (front of deck)
        const fGeom = makeMiteredBoardGeometry(dL, bw, bt);
        addMiteredBoard(deckGroup, fGeom,
            createBoardMaterial(bColor, dL, false, `brd_f${i}`),
            0, boardY, -dW / 2 + off, 0);

        // Back board: outer edge faces +Z — rotate 180deg around Y
        const bkGeom = makeMiteredBoardGeometry(dL, bw, bt);
        addMiteredBoard(deckGroup, bkGeom,
            createBoardMaterial(bColor, dL, false, `brd_b${i}`),
            0, boardY, dW / 2 - off, Math.PI);

        // Left board: outer edge faces -X — rotate +90deg around Y
        const lGeom = makeMiteredBoardGeometry(dW, bw, bt);
        addMiteredBoard(deckGroup, lGeom,
            createBoardMaterial(bColor, dW, true, `brd_l${i}`),
            -dL / 2 + off, boardY, 0, Math.PI / 2);

        // Right board: outer edge faces +X — rotate -90deg around Y
        const rGeom = makeMiteredBoardGeometry(dW, bw, bt);
        addMiteredBoard(deckGroup, rGeom,
            createBoardMaterial(bColor, dW, true, `brd_r${i}`),
            dL / 2 - off, boardY, 0, -Math.PI / 2);
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
    const bColor  = state.breakerSameColor ? colorConfig
        : (CONFIG.colors.find(c=>c.id===state.breakerColor)||colorConfig);
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
