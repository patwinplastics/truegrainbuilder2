// ============================================================
// TrueGrain Deck Builder 2 — Stair 3D Geometry
// v3 — fixed riser positions, baluster heights, landing geometry
// ============================================================
import { CONFIG }              from '../config.js';
import { state }               from '../state.js';
import { createBoardMaterial, materialCache } from './materials.js';
import { selectOptimalBoardLength } from '../calc/optimizer.js';

const ST = {
    th: (CONFIG.stairs.stringerThickness ?? 1.5) / 12,
    w:  (CONFIG.stairs.stringerWidth     ?? 9.25) / 12,
    in: (CONFIG.stairs.stringerInset     ?? 1.5)  / 12
};
const BOARD_TH    = CONFIG.boards.thickness / 12;
const EDGE_OFFSET = BOARD_TH;

// ============================================================
// PT lumber texture
// ============================================================
function buildPTTexture() {
    const SIZE = 512;
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#a08060'; ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 120; i++) {
        const x = Math.random() * SIZE, light = Math.random() > 0.5;
        ctx.strokeStyle = light
            ? `rgba(220,200,160,${0.08 + Math.random()*0.14})`
            : `rgba(60,40,20,${0.06 + Math.random()*0.12})`;
        ctx.lineWidth = 0.5 + Math.random()*1.5;
        ctx.beginPath(); ctx.moveTo(x, 0);
        for (let y = 0; y < SIZE; y += 8) ctx.lineTo(x + (Math.random()-0.5)*2.5, y);
        ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
        const y = Math.random()*SIZE, h = 4 + Math.random()*12;
        const g = ctx.createLinearGradient(0, y, 0, y+h);
        g.addColorStop(0, 'rgba(50,30,10,0)');
        g.addColorStop(0.5, `rgba(50,30,10,${0.08+Math.random()*0.1})`);
        g.addColorStop(1, 'rgba(50,30,10,0)');
        ctx.fillStyle = g; ctx.fillRect(0, y, SIZE, h);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
}

const stringerMat = () => {
    if (!materialCache['_stringer'])
        materialCache['_stringer'] = new THREE.MeshStandardMaterial({
            map: buildPTTexture(), color: new THREE.Color(1,1,1),
            roughness: 0.88, metalness: 0.0, envMapIntensity: 0.2
        });
    return materialCache['_stringer'];
};

const handrailMat = () => {
    if (!materialCache['_handrail'])
        materialCache['_handrail'] = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 });
    return materialCache['_handrail'];
};

function getStringerPositions(stairWidthFt) {
    const sideL = -stairWidthFt/2 + ST.in;
    const sideR =  stairWidthFt/2 - ST.in;
    const cy = -(ST.w + BOARD_TH);
    if (stairWidthFt < (CONFIG.stairs.centerStringerMinWidth ?? 3))
        return [{ lat: sideL, yOff: 0 }, { lat: sideR, yOff: 0 }];
    if (stairWidthFt < (CONFIG.stairs.doubleCenterStringerMinWidth ?? 6))
        return [{ lat: sideL, yOff: 0 }, { lat: 0, yOff: cy }, { lat: sideR, yOff: 0 }];
    const t = stairWidthFt/3;
    return [
        { lat: sideL, yOff: 0 },
        { lat: -stairWidthFt/2+t,   yOff: cy },
        { lat: -stairWidthFt/2+t*2, yOff: cy },
        { lat: sideR, yOff: 0 }
    ];
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
        if (stair.shape === 'l-shaped' && dims.lShapedData)
            buildLShapedStair(stair, dims, g, colorConfig, st);
        else
            buildStraightStair(stair, dims, g, colorConfig, st);
        positionStairGroup(g, stair, st);
        deckGroup.add(g);
    });
}

function positionStairGroup(g, stair, st) {
    const p = stair.position || 0.5;
    const edge = stair.edge || 'front';
    let x = 0, z = 0, rotY = 0;
    switch (edge) {
        case 'front': x=(p-0.5)*st.deckLength; z= st.deckWidth/2+EDGE_OFFSET;  rotY=Math.PI;    break;
        case 'back':  x=(p-0.5)*st.deckLength; z=-(st.deckWidth/2+EDGE_OFFSET); rotY=0;          break;
        case 'left':  x=-(st.deckLength/2+EDGE_OFFSET); z=(p-0.5)*st.deckWidth; rotY=Math.PI/2;  break;
        case 'right': x= st.deckLength/2+EDGE_OFFSET;   z=(p-0.5)*st.deckWidth; rotY=-Math.PI/2; break;
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
}

export function calculateStairDimensions(sc, st) {
    const hi = st.deckHeight * 12;
    const tgt = CONFIG.stairs.riserHeight.target;
    let nr = Math.max(1, Math.round(hi / tgt));
    let ar = hi / nr;
    if (ar > CONFIG.stairs.riserHeight.max)      { nr = Math.ceil(hi / CONFIG.stairs.riserHeight.max); ar = hi / nr; }
    else if (ar < CONFIG.stairs.riserHeight.min) { nr = Math.max(1, Math.floor(hi / CONFIG.stairs.riserHeight.min)); ar = hi / nr; }
    const nt   = nr - 1;
    const bpt  = sc.boardsPerTread || CONFIG.stairs.boardsPerTread.default;
    const td   = bpt * CONFIG.boards.width + (bpt - 1) * CONFIG.boards.gap;  // inches
    const swFt = sc.width || CONFIG.stairs.defaultWidth;
    const lsd  = sc.shape === 'l-shaped'
        ? calcLShape(nr, nt, ar, td, sc.turnDirection || 'left', sc.landingStepNumber, swFt)
        : null;
    return {
        numRisers: nr, numTreads: nt, actualRise: ar,
        treadDepth: td, totalRunFeet: (nt * td) / 12,
        stairWidthFeet: swFt, boardsPerTread: bpt,
        deckHeightInches: hi, lShapedData: lsd,
        isValid: nt >= 1 && ar >= CONFIG.stairs.riserHeight.min
    };
}

// Landing is a SQUARE pad = stairWidth x stairWidth
function calcLShape(nr, nt, ar, td, dir, landingStep, swFt) {
    let rbl = (typeof landingStep === 'number' && landingStep >= 1 && landingStep < nr)
        ? Math.round(landingStep)
        : Math.max(1, Math.round(nr / 2));
    rbl = Math.min(rbl, nr - 1);
    const tbl = rbl - 1;   // treads before landing
    const tal = nt - tbl;  // treads after landing
    return {
        treadsBeforeLanding: tbl,
        treadsAfterLanding:  tal,
        risersBeforeLanding: rbl,
        risersAfterLanding:  nr - rbl,
        landingSizeFeet:     swFt,
        run1Feet:            (tbl * td) / 12,
        run2Feet:            (tal * td) / 12,
        heightAtLanding:     rbl * ar,
        turnDirection:       dir,
        landingStepNumber:   rbl
    };
}

// ============================================================
// Straight stair
// ============================================================
function buildStraightStair(sc, dims, g, cc, st) {
    const fp = {
        stairConfig: sc, dims, colorConfig: cc, parentGroup: g,
        numTreads: dims.numTreads, risePerStep: dims.actualRise / 12,
        treadDepthFt: dims.treadDepth / 12, stairWidthFt: dims.stairWidthFeet,
        startY: st.deckHeight, dirZ: -1, dirX: 0,
        originX: 0, originZ: 0, flightLabel: 'str'
    };
    buildFlightTreads(fp);
    buildFlightStringers({
        parentGroup: g, stairWidthFt: dims.stairWidthFeet,
        riseFt: st.deckHeight, runFt: dims.totalRunFeet,
        startY: st.deckHeight, dirZ: -1, dirX: 0, originX: 0, originZ: 0
    });
    if (sc.includeHandrails)
        buildFlightHandrails({
            parentGroup: g, stairWidthFt: dims.stairWidthFeet,
            riseFt: st.deckHeight, runFt: dims.totalRunFeet,
            startY: st.deckHeight, originX: 0, originZ: 0, dirZ: -1, dirX: 0
        });
}

// ============================================================
// L-Shaped stair
//
//  Coordinate model (local group space, before positionStairGroup):
//    Origin (0,0,0) = deck edge attachment point at deck surface Y
//    Flight 1: travels in -Z
//    Landing:  square pad sw x sw, near edge at Z=-run1, far edge at Z=-(run1+sw)
//    Flight 2: starts at Z=-(run1+sw), travels in sign*X (left=-1, right=+1)
// ============================================================
function buildLShapedStair(sc, dims, g, cc, st) {
    const ld   = dims.lShapedData;
    const rps  = dims.actualRise / 12;   // rise per step (ft)
    const tdf  = dims.treadDepth / 12;   // tread depth (ft)
    const sw   = dims.stairWidthFeet;    // stair + landing width (ft)
    const sign = ld.turnDirection === 'left' ? -1 : 1;

    const rise1    = ld.risersBeforeLanding * rps;
    const rise2    = ld.risersAfterLanding  * rps;
    const landingY = st.deckHeight - rise1;

    // ---- Flight 1 ----
    buildFlightTreads({
        stairConfig: sc, dims, colorConfig: cc, parentGroup: g,
        numTreads: ld.treadsBeforeLanding, risePerStep: rps,
        treadDepthFt: tdf, stairWidthFt: sw,
        startY: st.deckHeight, dirZ: -1, dirX: 0,
        originX: 0, originZ: 0, flightLabel: 'f1'
    });
    buildFlightStringers({
        parentGroup: g, stairWidthFt: sw,
        riseFt: rise1, runFt: ld.run1Feet,
        startY: st.deckHeight, dirZ: -1, dirX: 0,
        originX: 0, originZ: 0
    });

    // ---- Landing pad ----
    // Square sw x sw. Center at X=0, Z = -(run1 + sw/2)
    const landingCenterZ = -(ld.run1Feet + sw / 2);
    buildLanding({
        parentGroup: g, colorConfig: cc,
        sizeFt: sw, landingY,
        centerX: 0, centerZ: landingCenterZ
    });
    // Riser face at the step down onto landing (front face of landing)
    buildLandingRiser({
        parentGroup: g, colorConfig: cc,
        stairWidthFt: sw, risePerStep: rps,
        landingY, riserZ: -ld.run1Feet
    });

    // ---- Flight 2 ----
    // Starts at far edge of landing: Z = -(run1 + sw)
    // Center of flight 2 in perpendicular axis (Z) = landingCenterZ
    // But flight 2 runs in X: each tread spans sw in Z direction
    // So originZ must be the CENTER of the flight in Z = landingCenterZ
    const f2originX = 0;
    const f2originZ = -(ld.run1Feet + sw);   // far edge = flight 2 top-of-stair
    buildFlightTreads({
        stairConfig: sc, dims, colorConfig: cc, parentGroup: g,
        numTreads: ld.treadsAfterLanding, risePerStep: rps,
        treadDepthFt: tdf, stairWidthFt: sw,
        startY: landingY, dirZ: 0, dirX: sign,
        originX: f2originX, originZ: f2originZ, flightLabel: 'f2'
    });
    buildFlightStringers({
        parentGroup: g, stairWidthFt: sw,
        riseFt: rise2, runFt: ld.run2Feet,
        startY: landingY, dirZ: 0, dirX: sign,
        originX: f2originX, originZ: f2originZ
    });

    if (sc.includeHandrails) {
        buildFlightHandrails({
            parentGroup: g, stairWidthFt: sw,
            riseFt: rise1, runFt: ld.run1Feet,
            startY: st.deckHeight, originX: 0, originZ: 0,
            dirZ: -1, dirX: 0
        });
        buildFlightHandrails({
            parentGroup: g, stairWidthFt: sw,
            riseFt: rise2, runFt: ld.run2Feet,
            startY: landingY, originX: f2originX, originZ: f2originZ,
            dirZ: 0, dirX: sign
        });
    }
}

// ============================================================
// buildFlightTreads
//
// runsX = flight travels along X axis (dirX != 0)
// runsZ = flight travels along Z axis (dirZ != 0)
//
// For runsZ: boards are BoxGeometry(sw, th, bw), laid out in Z.
//   tread offset along Z: originZ + dirZ * (step+1) * tdf
//   board offset within tread (back-to-front in tread depth): + dirZ * (b*(bw+gap) + bw/2)
//
// For runsX: boards are BoxGeometry(bw, th, sw), laid out in X.
//   same logic but in X axis.
//
// Riser: vertical board at the FRONT edge of the step (nose)
// ============================================================
function buildFlightTreads(p) {
    const bw  = CONFIG.boards.width     / 12;   // board width in ft
    const bth = CONFIG.boards.thickness / 12;   // board thickness in ft
    const gap = CONFIG.boards.gap       / 12;   // gap in ft
    const runsX = Math.abs(p.dirX) > 0.5;
    const bl  = selectOptimalBoardLength(p.stairWidthFt);
    const bpt = p.dims.boardsPerTread;

    for (let step = 0; step < p.numTreads; step++) {
        // Y of top surface of this tread
        const treadY = p.startY - (step + 1) * p.risePerStep;
        // Distance from origin to FRONT (nose) of this tread along travel axis
        const frontOffset = (step + 1) * p.treadDepthFt;

        // ---- Tread boards ----
        for (let b = 0; b < bpt; b++) {
            // Offset from front of tread going BACK (into the tread)
            const boardBack = b * (bw + gap) + bw / 2;
            // Position of board center along travel axis (measured from origin)
            const travelPos = frontOffset - boardBack;
            const mat = createBoardMaterial(p.colorConfig, bl, false, `tr_${p.flightLabel}_${step}_${b}`);
            let mesh;
            if (runsX) {
                mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bth, p.stairWidthFt), mat);
                mesh.position.set(
                    p.originX + p.dirX * travelPos,
                    treadY + bth / 2,
                    p.originZ
                );
            } else {
                mesh = new THREE.Mesh(new THREE.BoxGeometry(p.stairWidthFt, bth, bw), mat);
                mesh.position.set(
                    p.originX,
                    treadY + bth / 2,
                    p.originZ + p.dirZ * travelPos
                );
            }
            mesh.castShadow = mesh.receiveShadow = true;
            p.parentGroup.add(mesh);
        }

        // ---- Riser board (vertical face at front/nose of step) ----
        const riserMat = createBoardMaterial(p.colorConfig, bl, false, `rs_${p.flightLabel}_${step}`);
        // Riser Y center: midpoint between bottom of this tread and top of tread below
        const riserH   = p.risePerStep;
        const riserYc  = treadY - riserH / 2 + bth;   // sits below tread nose
        let riser;
        if (runsX) {
            riser = new THREE.Mesh(new THREE.BoxGeometry(bth, riserH, p.stairWidthFt), riserMat);
            riser.position.set(
                p.originX + p.dirX * frontOffset,
                riserYc,
                p.originZ
            );
        } else {
            riser = new THREE.Mesh(new THREE.BoxGeometry(p.stairWidthFt, riserH, bth), riserMat);
            riser.position.set(
                p.originX,
                riserYc,
                p.originZ + p.dirZ * frontOffset
            );
        }
        riser.castShadow = true;
        p.parentGroup.add(riser);
    }
}

// ============================================================
// buildFlightStringers
// ============================================================
function buildFlightStringers(p) {
    const sLen  = Math.sqrt(p.riseFt * p.riseFt + p.runFt * p.runFt);
    const angle = Math.atan2(p.riseFt, p.runFt);
    const runsX = Math.abs(p.dirX) > 0.5;
    const mat   = stringerMat();
    getStringerPositions(p.stairWidthFt).forEach(({ lat, yOff }) => {
        const geom = new THREE.BoxGeometry(ST.th, ST.w, sLen);
        const m    = new THREE.Mesh(geom, mat);
        const cy   = p.startY - p.riseFt / 2 + yOff;
        const rH   = p.runFt / 2;
        if (runsX) {
            // lat offsets along Z (perpendicular to X travel)
            m.position.set(p.originX + p.dirX * rH, cy, p.originZ + lat);
            m.rotation.z = p.dirX * angle;
            m.rotation.y = Math.PI / 2;
        } else {
            // lat offsets along X (perpendicular to Z travel)
            m.position.set(p.originX + lat, cy, p.originZ + p.dirZ * rH);
            m.rotation.x = p.dirZ * angle;
        }
        m.castShadow = true;
        p.parentGroup.add(m);
    });
}

// ============================================================
// buildFlightHandrails
// Fixed: baluster height is computed per-step from step surface Y.
// ============================================================
function buildFlightHandrails(p) {
    const mat = handrailMat();
    const RAIL_H  = 3;       // handrail height above step surface (ft)
    const POST_SZ = 0.29;    // post cross-section (ft)
    const RAIL_TH = 0.125;   // rail cross-section (ft)
    const BAL_SZ  = 0.10;    // baluster cross-section (ft)
    const BAL_SP  = 0.33;    // baluster spacing (ft)
    const runsX   = Math.abs(p.dirX) > 0.5;

    // Diagonal length of handrail
    const fLen  = Math.sqrt(p.riseFt * p.riseFt + p.runFt * p.runFt);
    const angle = Math.atan2(p.riseFt, p.runFt);

    [-1, 1].forEach(side => {
        const lat = side * p.stairWidthFt / 2;

        // Helper: add post at given world position
        const addPost = (wx, wy, wz, h) => {
            const pm = new THREE.Mesh(new THREE.BoxGeometry(POST_SZ, h, POST_SZ), mat);
            pm.position.set(wx, wy + h / 2, wz);
            pm.castShadow = true; p.parentGroup.add(pm);
        };

        // Top post (at deck edge) and bottom post (at ground)
        const endY = p.startY - p.riseFt;
        if (runsX) {
            addPost(p.originX,                 p.startY, p.originZ + lat, RAIL_H);
            addPost(p.originX + p.dirX * p.runFt, endY, p.originZ + lat, RAIL_H);
        } else {
            addPost(p.originX + lat, p.startY, p.originZ,                RAIL_H);
            addPost(p.originX + lat, endY,     p.originZ + p.dirZ * p.runFt, RAIL_H);
        }

        // Top rail (runs diagonally along slope)
        const topRailY  = p.startY + RAIL_H - p.riseFt / 2;
        const topRailCX = runsX ? p.originX + p.dirX * p.runFt / 2 : p.originX + lat;
        const topRailCZ = runsX ? p.originZ + lat : p.originZ + p.dirZ * p.runFt / 2;
        const topRail   = new THREE.Mesh(new THREE.BoxGeometry(RAIL_TH, RAIL_TH, fLen), mat);
        topRail.position.set(topRailCX, topRailY, topRailCZ);
        if (runsX) { topRail.rotation.z = p.dirX * angle; topRail.rotation.y = Math.PI / 2; }
        else         topRail.rotation.x = p.dirZ * angle;
        topRail.castShadow = true; p.parentGroup.add(topRail);

        // Balusters: evenly spaced along the run, height from step surface to handrail
        const nBal = Math.max(1, Math.floor(p.runFt / BAL_SP));
        for (let b = 1; b < nBal; b++) {
            const t  = b / nBal;
            // Surface Y at this point along the stair slope
            const surfY = p.startY - t * p.riseFt;
            // Handrail Y at this t (linear interpolation along diagonal)
            const railY = topRailY + (t - 0.5) * p.riseFt;  // slope offset
            const balH  = Math.max(0.1, railY - surfY);
            const balYc = surfY + balH / 2;

            const bal = new THREE.Mesh(new THREE.BoxGeometry(BAL_SZ, balH, BAL_SZ), mat);
            if (runsX)
                bal.position.set(p.originX + p.dirX * t * p.runFt, balYc, p.originZ + lat);
            else
                bal.position.set(p.originX + lat, balYc, p.originZ + p.dirZ * t * p.runFt);
            bal.castShadow = true; p.parentGroup.add(bal);
        }
    });
}

// ============================================================
// buildLanding — square pad (sizeFt x sizeFt)
// Boards run parallel to X, laid out along Z
// ============================================================
function buildLanding(p) {
    const bw  = CONFIG.boards.width     / 12;
    const bth = CONFIG.boards.thickness / 12;
    const gap = CONFIG.boards.gap       / 12;
    const sz  = p.sizeFt;
    const ew  = bw + gap;
    const nr  = Math.ceil(sz / ew);
    const bl  = selectOptimalBoardLength(sz);

    for (let r = 0; r < nr; r++) {
        const zo = -sz / 2 + r * ew + bw / 2;
        const m  = new THREE.Mesh(
            new THREE.BoxGeometry(sz, bth, bw),
            createBoardMaterial(p.colorConfig, bl, false, `lp_${r}`)
        );
        m.position.set(p.centerX, p.landingY + bth / 2, p.centerZ + zo);
        m.castShadow = m.receiveShadow = true;
        p.parentGroup.add(m);
    }

    // Corner support posts
    if (p.landingY <= 0.01) return;
    const pm = stringerMat();
    const half = sz / 2;
    [[-half,-half],[half,-half],[half,half],[-half,half]].forEach(([fx, fz]) => {
        const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.33, p.landingY, 0.33), pm
        );
        post.position.set(p.centerX + fx, p.landingY / 2, p.centerZ + fz);
        post.castShadow = true;
        p.parentGroup.add(post);
    });
}

// ============================================================
// buildLandingRiser — vertical riser at flight 1 / landing junction
// ============================================================
function buildLandingRiser(p) {
    const bth = CONFIG.boards.thickness / 12;
    const bl  = selectOptimalBoardLength(p.stairWidthFt);
    const m   = new THREE.Mesh(
        new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, bth),
        createBoardMaterial(p.colorConfig, bl, false, 'lr')
    );
    // Riser sits at Z = riserZ, Y center = landingY - risePerStep/2 + bth
    m.position.set(0, p.landingY - p.risePerStep / 2 + bth, p.riserZ);
    m.castShadow = true;
    p.parentGroup.add(m);
}
