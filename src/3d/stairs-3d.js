// ============================================================
// TrueGrain Deck Builder 2 — Stair 3D Geometry
// v4 — handrails rewritten with endpoint lookAt (no Euler bugs)
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
// Geometry helpers
// ============================================================
function addBox(parent, mat, w, h, d, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
}

// Create a bar (thin box) connecting two 3D points using lookAt
// BoxGeometry depth (Z) = length, so lookAt aligns the bar correctly
function makeBar(parent, mat, x1, y1, z1, x2, y2, z2, thickness) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 0.01) return;
    const geom = new THREE.BoxGeometry(thickness, thickness, len);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
    mesh.lookAt(x2, y2, z2);
    mesh.castShadow = true;
    parent.add(mesh);
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
    const td   = bpt * CONFIG.boards.width + (bpt - 1) * CONFIG.boards.gap;
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

function calcLShape(nr, nt, ar, td, dir, landingStep, swFt) {
    let rbl = (typeof landingStep === 'number' && landingStep >= 1 && landingStep < nr)
        ? Math.round(landingStep)
        : Math.max(1, Math.round(nr / 2));
    rbl = Math.min(rbl, nr - 1);
    const tbl = rbl - 1;
    const tal = nt - tbl;
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
// ============================================================
function buildLShapedStair(sc, dims, g, cc, st) {
    const ld   = dims.lShapedData;
    const rps  = dims.actualRise / 12;
    const tdf  = dims.treadDepth / 12;
    const sw   = dims.stairWidthFeet;
    const sign = ld.turnDirection === 'left' ? -1 : 1;

    const rise1    = ld.risersBeforeLanding * rps;
    const rise2    = ld.risersAfterLanding  * rps;
    const landingY = st.deckHeight - rise1;

    // Flight 1
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

    // Landing pad
    const landingCenterZ = -(ld.run1Feet + sw / 2);
    buildLanding({
        parentGroup: g, colorConfig: cc,
        sizeFt: sw, landingY,
        centerX: 0, centerZ: landingCenterZ
    });
    buildLandingRiser({
        parentGroup: g, colorConfig: cc,
        stairWidthFt: sw, risePerStep: rps,
        landingY, riserZ: -ld.run1Feet
    });

    // Flight 2
    const f2originX = 0;
    const f2originZ = -(ld.run1Feet + sw);
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
// ============================================================
function buildFlightTreads(p) {
    const bw  = CONFIG.boards.width     / 12;
    const bth = CONFIG.boards.thickness / 12;
    const gap = CONFIG.boards.gap       / 12;
    const runsX = Math.abs(p.dirX) > 0.5;
    const bl  = selectOptimalBoardLength(p.stairWidthFt);
    const bpt = p.dims.boardsPerTread;

    for (let step = 0; step < p.numTreads; step++) {
        const treadY = p.startY - (step + 1) * p.risePerStep;
        const frontOffset = (step + 1) * p.treadDepthFt;

        for (let b = 0; b < bpt; b++) {
            const boardBack = b * (bw + gap) + bw / 2;
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

        const riserMat = createBoardMaterial(p.colorConfig, bl, false, `rs_${p.flightLabel}_${step}`);
        const riserH   = p.risePerStep;
        const riserYc  = treadY - riserH / 2 + bth;
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
    const runsX = Math.abs(p.dirX) > 0.5;
    const mat   = stringerMat();

    getStringerPositions(p.stairWidthFt).forEach(({ lat, yOff }) => {
        // Compute start (top) and end (bottom) positions for this stringer
        let x1, y1, z1, x2, y2, z2;
        const topY = p.startY + yOff;
        const botY = p.startY - p.riseFt + yOff;

        if (runsX) {
            x1 = p.originX;                    z1 = p.originZ + lat;
            x2 = p.originX + p.dirX * p.runFt; z2 = p.originZ + lat;
        } else {
            x1 = p.originX + lat; z1 = p.originZ;
            x2 = p.originX + lat; z2 = p.originZ + p.dirZ * p.runFt;
        }
        y1 = topY;
        y2 = botY;

        // Use makeBar for stringers too (wider cross section)
        const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (len < 0.01) return;
        const geom = new THREE.BoxGeometry(ST.th, ST.w, len);
        const m = new THREE.Mesh(geom, mat);
        m.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
        m.lookAt(x2, y2, z2);
        m.castShadow = true;
        p.parentGroup.add(m);
    });
}

// ============================================================
// buildFlightHandrails (v4 rewrite)
//
// Uses explicit endpoint coordinates + lookAt for all diagonal
// elements. No Euler rotation math. Guarantees correct geometry
// for both runsZ and runsX flights.
//
// Components per side:
//   - Top post (at deck/landing edge)
//   - Bottom post (at ground/lower end)
//   - Top rail (diagonal bar connecting post tops)
//   - Bottom rail (diagonal bar ~4" above step surface)
//   - Balusters (vertical, evenly spaced, constant height)
// ============================================================
function buildFlightHandrails(p) {
    const mat = handrailMat();
    const RAIL_H   = 3;       // handrail height above step surface (ft)
    const BOT_RAIL = 0.33;    // bottom rail height above step surface (ft)
    const POST_SZ  = 0.29;    // post cross-section (ft)
    const RAIL_TH  = 0.15;    // rail bar thickness (ft)
    const BAL_SZ   = 0.10;    // baluster cross-section (ft)
    const BAL_SP   = 0.33;    // baluster spacing along run (ft)
    const runsX    = Math.abs(p.dirX) > 0.5;
    const endY     = p.startY - p.riseFt;

    [-1, 1].forEach(side => {
        const lat = side * p.stairWidthFt / 2;

        // World positions of the top-of-stair and bottom-of-stair for this side
        let topX, topZ, botX, botZ;
        if (runsX) {
            topX = p.originX;                    topZ = p.originZ + lat;
            botX = p.originX + p.dirX * p.runFt; botZ = p.originZ + lat;
        } else {
            topX = p.originX + lat; topZ = p.originZ;
            botX = p.originX + lat; botZ = p.originZ + p.dirZ * p.runFt;
        }

        // ---- Posts (vertical boxes) ----
        addBox(p.parentGroup, mat, POST_SZ, RAIL_H, POST_SZ,
               topX, p.startY + RAIL_H / 2, topZ);
        addBox(p.parentGroup, mat, POST_SZ, RAIL_H, POST_SZ,
               botX, endY + RAIL_H / 2, botZ);

        // ---- Top rail (connects tops of posts diagonally) ----
        makeBar(p.parentGroup, mat,
            topX, p.startY + RAIL_H, topZ,
            botX, endY     + RAIL_H, botZ,
            RAIL_TH
        );

        // ---- Bottom rail (follows slope, BOT_RAIL above step surface) ----
        makeBar(p.parentGroup, mat,
            topX, p.startY + BOT_RAIL, topZ,
            botX, endY     + BOT_RAIL, botZ,
            RAIL_TH
        );

        // ---- Balusters (vertical, evenly spaced) ----
        // Since top rail and step surface have the same slope,
        // every baluster is exactly (RAIL_H - BOT_RAIL) tall.
        const balH  = RAIL_H - BOT_RAIL;
        const nBal  = Math.max(1, Math.floor(p.runFt / BAL_SP));
        for (let b = 1; b < nBal; b++) {
            const t = b / nBal;
            const bx = topX + (botX - topX) * t;
            const bz = topZ + (botZ - topZ) * t;
            const surfY = p.startY - t * p.riseFt;
            const balYc = surfY + BOT_RAIL + balH / 2;
            addBox(p.parentGroup, mat, BAL_SZ, balH, BAL_SZ, bx, balYc, bz);
        }
    });
}

// ============================================================
// buildLanding
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
// buildLandingRiser
// ============================================================
function buildLandingRiser(p) {
    const bth = CONFIG.boards.thickness / 12;
    const bl  = selectOptimalBoardLength(p.stairWidthFt);
    const m   = new THREE.Mesh(
        new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, bth),
        createBoardMaterial(p.colorConfig, bl, false, 'lr')
    );
    m.position.set(0, p.landingY - p.risePerStep / 2 + bth, p.riserZ);
    m.castShadow = true;
    p.parentGroup.add(m);
}
