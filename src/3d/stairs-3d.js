// ============================================================
// TrueGrain Deck Builder 2 — Stair 3D Geometry
// ============================================================
import { CONFIG }              from '../config.js';
import { state }               from '../state.js';
import { createBoardMaterial, materialCache } from './materials.js';
import { selectOptimalBoardLength } from '../calc/optimizer.js';

const ST = {
    th: ((CONFIG.stairs.stringerThickness ?? 1.5)) / 12,
    w:  ((CONFIG.stairs.stringerWidth     ?? 9.25)) / 12,
    in: ((CONFIG.stairs.stringerInset     ?? 1.5))  / 12
};

const EDGE_OFFSET = CONFIG.boards.thickness / 12;

const stringerMat = () => {
    if (!materialCache['_stringer']) materialCache['_stringer'] = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.9 });
    return materialCache['_stringer'];
};
const handrailMat = () => {
    if (!materialCache['_handrail']) materialCache['_handrail'] = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 });
    return materialCache['_handrail'];
};

/**
 * Calculate stringer lateral positions based on stair width.
 * Per building code:
 * - Under 3ft: 2 stringers (sides only)
 * - 3ft to 6ft: 3 stringers (sides + 1 center)
 * - Over 6ft: 4 stringers (sides + 2 evenly spaced)
 */
function getStringerPositions(stairWidthFt) {
    const minCenter = CONFIG.stairs.centerStringerMinWidth ?? 3;
    const minDouble = CONFIG.stairs.doubleCenterStringerMinWidth ?? 6;
    const sideL = -stairWidthFt / 2 + ST.in;
    const sideR =  stairWidthFt / 2 - ST.in;
    const centerYOffset = -ST.w / 2;

    if (stairWidthFt < minCenter) {
        // Narrow stairs: sides only
        return [
            { lat: sideL, yOffset: 0 },
            { lat: sideR, yOffset: 0 }
        ];
    } else if (stairWidthFt < minDouble) {
        // Standard width: sides + 1 center
        return [
            { lat: sideL, yOffset: 0 },
            { lat: 0,     yOffset: centerYOffset },
            { lat: sideR, yOffset: 0 }
        ];
    } else {
        // Wide stairs: sides + 2 evenly spaced centers
        const third = stairWidthFt / 3;
        const c1 = -stairWidthFt / 2 + third;
        const c2 = -stairWidthFt / 2 + third * 2;
        return [
            { lat: sideL, yOffset: 0 },
            { lat: c1,    yOffset: centerYOffset },
            { lat: c2,    yOffset: centerYOffset },
            { lat: sideR, yOffset: 0 }
        ];
    }
}

// ============================================================
// Public API
// ============================================================
export function createAllStairs(deckGroup, st) {
    if (!st.stairsEnabled || !st.stairs?.length) return;
    const colorConfig = CONFIG.colors.find(c => c.id === st.mainColor) || CONFIG.colors[0];
    st.stairs.forEach(stair => {
        if (!stair.enabled) return;
        const dims = calculateStairDimensions(stair, st);
        if (!dims?.isValid) return;
        const g = new THREE.Group();
        g.name = `stair_${stair.id}`;
        if (stair.shape === 'l-shaped' && dims.lShapedData) buildLShapedStair(stair, dims, g, colorConfig, st);
        else                                                  buildStraightStair(stair, dims, g, colorConfig, st);
        positionStairGroup(g, stair, st);
        deckGroup.add(g);
    });
}

function positionStairGroup(g, stair, st) {
    const p = stair.position || 0.5;
    const edge = stair.edge || 'front';
    let x = 0, z = 0, rotY = 0;

    switch (edge) {
        case 'front':
            x = (p - 0.5) * st.deckLength;
            z = st.deckWidth / 2 + EDGE_OFFSET;
            rotY = Math.PI;
            break;
        case 'back':
            x = (p - 0.5) * st.deckLength;
            z = -(st.deckWidth / 2 + EDGE_OFFSET);
            rotY = 0;
            break;
        case 'left':
            x = -(st.deckLength / 2 + EDGE_OFFSET);
            z = (p - 0.5) * st.deckWidth;
            rotY = Math.PI / 2;
            break;
        case 'right':
            x = st.deckLength / 2 + EDGE_OFFSET;
            z = (p - 0.5) * st.deckWidth;
            rotY = -Math.PI / 2;
            break;
    }

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
}

export function calculateStairDimensions(sc, st) {
    const hi = st.deckHeight * 12;
    const tgt = CONFIG.stairs.riserHeight.target;
    let nr = Math.max(1, Math.round(hi / tgt));
    let ar = hi / nr;
    if (ar > CONFIG.stairs.riserHeight.max) { nr = Math.ceil(hi / CONFIG.stairs.riserHeight.max); ar = hi / nr; }
    else if (ar < CONFIG.stairs.riserHeight.min) { nr = Math.max(1, Math.floor(hi / CONFIG.stairs.riserHeight.min)); ar = hi / nr; }
    const nt  = nr - 1;
    const bpt = sc.boardsPerTread || CONFIG.stairs.boardsPerTread.default;
    const td  = bpt * CONFIG.boards.width + (bpt - 1) * CONFIG.boards.gap;
    const swFt = sc.width || CONFIG.stairs.defaultWidth;
    const lsd = sc.shape === 'l-shaped' ? calcLShape(nr, nt, ar, td, sc.turnDirection || 'left', sc.landingDepth, sc.landingSplit) : null;
    return { numRisers: nr, numTreads: nt, actualRise: ar, treadDepth: td, totalRunFeet: (nt * td) / 12, stairWidthFeet: swFt, boardsPerTread: bpt, deckHeightInches: hi, lShapedData: lsd, isValid: nt >= 1 && ar >= CONFIG.stairs.riserHeight.min };
}

// ============================================================
// Straight stairs
// ============================================================
function buildStraightStair(sc, dims, g, cc, st) {
    const rF = st.deckHeight, rnF = dims.totalRunFeet;
    const fp = { stairConfig: sc, dims, colorConfig: cc, parentGroup: g, numTreads: dims.numTreads, numRisers: dims.numRisers, risePerStep: dims.actualRise / 12, treadDepthFt: dims.treadDepth / 12, stairWidthFt: dims.stairWidthFeet, startY: st.deckHeight, dirZ: -1, dirX: 0, originX: 0, originZ: 0, flightLabel: 'str' };
    buildFlightTreads(fp);
    buildFlightStringers({ parentGroup: g, stairWidthFt: dims.stairWidthFeet, riseFt: rF, runFt: rnF, startY: st.deckHeight, dirZ: -1, dirX: 0, originX: 0, originZ: 0, flightLabel: 'str' });
    if (sc.includeHandrails) buildFlightHandrails({ parentGroup: g, stairWidthFt: dims.stairWidthFeet, riseFt: rF, runFt: rnF, startY: st.deckHeight, originX: 0, originZ: 0, dirZ: -1, dirX: 0, flightLabel: 'str' });
}

// ============================================================
// L-shaped stairs
// ============================================================
function buildLShapedStair(sc, dims, g, cc, st) {
    const ld = dims.lShapedData;
    const rps = dims.actualRise / 12, tdf = dims.treadDepth / 12, sw = dims.stairWidthFeet;
    const sign = ld.turnDirection === 'left' ? -1 : 1;
    const rise1 = ld.risersBeforeLanding * rps, rise2 = (dims.numRisers - ld.risersBeforeLanding) * rps;
    const landingY = st.deckHeight - rise1;

    buildFlightTreads({ stairConfig: sc, dims, colorConfig: cc, parentGroup: g, numTreads: ld.treadsBeforeLanding, numRisers: ld.risersBeforeLanding, risePerStep: rps, treadDepthFt: tdf, stairWidthFt: sw, startY: st.deckHeight, dirZ: -1, dirX: 0, originX: 0, originZ: 0, flightLabel: 'f1' });
    buildFlightStringers({ parentGroup: g, stairWidthFt: sw, riseFt: rise1, runFt: ld.run1Feet, startY: st.deckHeight, dirZ: -1, dirX: 0, originX: 0, originZ: 0, flightLabel: 'f1' });

    buildLanding({ parentGroup: g, colorConfig: cc, stairWidthFt: sw, landingDepthFt: ld.landingDepthFeet, landingY, centerZ: -ld.run1Feet - ld.landingDepthFeet / 2, turnSign: sign, run2Ft: ld.run2Feet });
    buildLandingRiser({ parentGroup: g, colorConfig: cc, stairWidthFt: sw, risePerStep: rps, landingY, riserZ: -ld.run1Feet });

    const ox = 0, oz = -ld.run1Feet - ld.landingDepthFeet;
    buildFlightTreads({ stairConfig: sc, dims, colorConfig: cc, parentGroup: g, numTreads: ld.treadsAfterLanding, numRisers: dims.numRisers - ld.risersBeforeLanding, risePerStep: rps, treadDepthFt: tdf, stairWidthFt: sw, startY: landingY, dirZ: 0, dirX: sign, originX: ox, originZ: oz, flightLabel: 'f2' });
    buildFlightStringers({ parentGroup: g, stairWidthFt: sw, riseFt: rise2, runFt: ld.run2Feet, startY: landingY, dirZ: 0, dirX: sign, originX: ox, originZ: oz, flightLabel: 'f2' });

    if (sc.includeHandrails) {
        buildFlightHandrails({ parentGroup: g, stairWidthFt: sw, riseFt: rise1, runFt: ld.run1Feet, startY: st.deckHeight, originX: 0, originZ: 0, dirZ: -1, dirX: 0, flightLabel: 'f1' });
        buildFlightHandrails({ parentGroup: g, stairWidthFt: sw, riseFt: rise2, runFt: ld.run2Feet, startY: landingY, originX: ox, originZ: oz, dirZ: 0, dirX: sign, flightLabel: 'f2' });
    }
}

// ============================================================
// Flight builders
// ============================================================
function buildFlightTreads(p) {
    const bwf = CONFIG.boards.width / 12, btf = CONFIG.boards.thickness / 12, gf = CONFIG.boards.gap / 12;
    const runsX = Math.abs(p.dirX) > 0.5;
    const bl = selectOptimalBoardLength(p.stairWidthFt);
    for (let step = 0; step < p.numTreads; step++) {
        const sY = p.startY - (step + 1) * p.risePerStep;
        const ro = (step + 1) * p.treadDepthFt;
        const cx = p.originX + p.dirX * (ro - p.treadDepthFt / 2);
        const cz = p.originZ + p.dirZ * (ro - p.treadDepthFt / 2);
        for (let b = 0; b < p.dims.boardsPerTread; b++) {
            const bo = -p.treadDepthFt / 2 + b * (bwf + gf) + bwf / 2;
            const mat = createBoardMaterial(p.colorConfig, bl, false, `tr_${p.flightLabel}_${step}_${b}`);
            const geom = runsX ? new THREE.BoxGeometry(bwf, btf, p.stairWidthFt) : new THREE.BoxGeometry(p.stairWidthFt, btf, bwf);
            const m = new THREE.Mesh(geom, mat);
            m.position.set(cx + p.dirX * bo, sY + btf / 2, cz + p.dirZ * bo);
            m.castShadow = m.receiveShadow = true;
            p.parentGroup.add(m);
        }
        const rx = p.originX + p.dirX * (ro - p.treadDepthFt);
        const rz = p.originZ + p.dirZ * (ro - p.treadDepthFt);
        const rg = runsX ? new THREE.BoxGeometry(btf, p.risePerStep, p.stairWidthFt) : new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, btf);
        const rm = new THREE.Mesh(rg, createBoardMaterial(p.colorConfig, bl, false, `rs_${p.flightLabel}_${step}`));
        rm.position.set(rx, sY - p.risePerStep / 2 + btf, rz);
        rm.castShadow = true; p.parentGroup.add(rm);
    }
}

function buildFlightStringers(p) {
    const sLen  = Math.sqrt(p.riseFt * p.riseFt + p.runFt * p.runFt);
    const angle = Math.atan2(p.riseFt, p.runFt);
    const runsX = Math.abs(p.dirX) > 0.5;
    const mat   = stringerMat();

    const positions = getStringerPositions(p.stairWidthFt);

    positions.forEach(({ lat, yOffset }) => {
        const g = new THREE.BoxGeometry(ST.th, ST.w, sLen);
        const m = new THREE.Mesh(g, mat);
        const cy = p.startY - p.riseFt / 2 + yOffset;
        const rH = p.runFt / 2;
        if (runsX) {
            m.position.set(p.originX + p.dirX * rH, cy, p.originZ + lat);
            m.rotation.z = p.dirX * angle;
            m.rotation.y = Math.PI / 2;
        } else {
            m.position.set(p.originX + lat, cy, p.originZ + p.dirZ * rH);
            m.rotation.x = p.dirZ * angle;
        }
        m.castShadow = true;
        p.parentGroup.add(m);
    });
}

function buildFlightHandrails(p) {
    const mat = handrailMat();
    const pH = 3, pSz = 0.29, rH = 0.29, rTh = 0.125, bSz = 0.125, bSp = 0.33, bOff = 0.25;
    const fLen = Math.sqrt(p.riseFt * p.riseFt + p.runFt * p.runFt);
    const angle = Math.atan2(p.riseFt, p.runFt);
    const runsX = Math.abs(p.dirX) > 0.5;
    [-1, 1].forEach(side => {
        const lat = side * p.stairWidthFt / 2;
        const lx = runsX ? p.originX : p.originX + lat;
        const lz = runsX ? p.originZ + lat : p.originZ;
        const mkPost = (px, py, pz) => {
            const pm = new THREE.Mesh(new THREE.BoxGeometry(pSz, pH, pSz), mat);
            pm.position.set(px, py, pz);
            pm.castShadow = true;
            p.parentGroup.add(pm);
        };
        const endY = p.startY - p.riseFt;
        if (runsX) mkPost(p.originX, p.startY + pH / 2, lz);
        else       mkPost(lx, p.startY + pH / 2, p.originZ);
        if (runsX) mkPost(p.originX + p.dirX * p.runFt, endY + pH / 2, lz);
        else       mkPost(lx, endY + pH / 2, p.originZ + p.dirZ * p.runFt);

        const midY = p.startY + pH - rH / 2 - p.riseFt / 2;
        const rg = new THREE.BoxGeometry(rTh, rH, fLen);
        [midY, midY - (pH - bOff - rH)].forEach(ry => {
            const rail = new THREE.Mesh(rg.clone(), mat);
            if (runsX) {
                rail.position.set(p.originX + p.dirX * p.runFt / 2, ry, lz);
                rail.rotation.z = p.dirX * angle;
                rail.rotation.y = Math.PI / 2;
            } else {
                rail.position.set(lx, ry, p.originZ + p.dirZ * p.runFt / 2);
                rail.rotation.x = p.dirZ * angle;
            }
            rail.castShadow = true;
            p.parentGroup.add(rail);
        });
        const nb = Math.floor(p.runFt / bSp);
        const bH = pH - rH - bOff - rH;
        for (let b = 1; b < nb; b++) {
            const t = b / nb, by = p.startY - t * p.riseFt + bOff + rH + bH / 2;
            const bal = new THREE.Mesh(new THREE.BoxGeometry(bSz, bH, bSz), mat);
            if (runsX) bal.position.set(p.originX + p.dirX * t * p.runFt, by, lz);
            else       bal.position.set(lx, by, p.originZ + p.dirZ * t * p.runFt);
            bal.castShadow = true;
            p.parentGroup.add(bal);
        }
    });
}

function buildLanding(p) {
    const bwf = CONFIG.boards.width / 12, btf = CONFIG.boards.thickness / 12, gf = CONFIG.boards.gap / 12;
    const pw = p.stairWidthFt + p.run2Ft, pd = Math.max(p.landingDepthFt, p.stairWidthFt);
    const ew = bwf + gf, nr = Math.ceil(pd / ew);
    const bl = selectOptimalBoardLength(pw);
    const cx = p.centerZ !== undefined ? p.turnSign * (p.run2Ft / 2) : 0;
    for (let r = 0; r < nr; r++) {
        const zo = -pd / 2 + r * ew + bwf / 2;
        const m = new THREE.Mesh(new THREE.BoxGeometry(pw, btf, bwf), createBoardMaterial(p.colorConfig, bl, false, `lp_${r}`));
        m.position.set(cx, p.landingY + btf / 2, p.centerZ + zo);
        m.castShadow = m.receiveShadow = true; p.parentGroup.add(m);
    }
    if (p.landingY <= 0) return;
    const pm = stringerMat(), pg = new THREE.BoxGeometry(0.33, p.landingY, 0.33);
    [[-pw/2,-pd/2],[pw/2,-pd/2],[pw/2,pd/2],[-pw/2,pd/2]].forEach(([fx, fz]) => {
        const post = new THREE.Mesh(pg, pm); post.position.set(cx + fx, p.landingY / 2, p.centerZ + fz); post.castShadow = true; p.parentGroup.add(post);
    });
}

function buildLandingRiser(p) {
    const btf = CONFIG.boards.thickness / 12;
    const bl  = selectOptimalBoardLength(p.stairWidthFt);
    const m   = new THREE.Mesh(new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, btf), createBoardMaterial(p.colorConfig, bl, false, 'lr'));
    m.position.set(0, p.landingY - p.risePerStep / 2 + btf, p.riserZ);
    m.castShadow = true; p.parentGroup.add(m);
}

// ============================================================
// L-shape dimension calculator
// ============================================================
function calcLShape(nr, nt, ar, td, dir, ldFt, ls) {
    const ldf   = typeof ldFt === 'number' ? ldFt : CONFIG.stairs.landingDepth;
    const split = typeof ls   === 'number' ? ls   : 0.5;
    let tbl = Math.max(1, Math.round(nt * split));
    if (tbl >= nt) tbl = nt - 1;
    const tal = nt - tbl, rbl = tbl + 1;
    return {
        treadsBeforeLanding: tbl, treadsAfterLanding: tal,
        risersBeforeLanding: rbl, risersAfterLanding: nr - rbl,
        landingDepthFeet: ldf, landingDepthInches: ldf * 12,
        run1Feet: (tbl * td) / 12, run2Feet: (tal * td) / 12,
        run1Inches: tbl * td, run2Inches: tal * td,
        heightAtLanding: rbl * ar, turnDirection: dir, landingSplit: split
    };
}
