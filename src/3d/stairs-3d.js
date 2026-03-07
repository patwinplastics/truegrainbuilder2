// ============================================================
// TrueGrain Deck Builder 2 — Stair 3D Geometry
// v4.4 — notched cut-stringer profile (PT lumber, not solid box)
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

const RAIL = {
    H:       3,
    BOT:     0.33,
    POST_SZ: 0.29,
    TH:      0.15,
    BAL_SZ:  0.10,
    BAL_SP:  0.33
};

// ============================================================
// PT lumber texture (warm green-treated look)
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
// Notched stringer profile builder
// Builds a Shape that traces the cut stringer outline:
// diagonal board with step notches cut into the top edge.
// rise and run are in feet. numSteps = numTreads.
// The shape is drawn in the Y-Z plane (profile), then extruded
// in X by ST.th (1.5").
// ============================================================
function buildStringerGeometry(riseFt, runFt, numSteps) {
    if (numSteps < 1 || riseFt < 0.01 || runFt < 0.01) return null;

    const stepRise = riseFt / numSteps;  // height per notch
    const stepRun  = runFt  / numSteps;  // depth  per notch
    const overallH = riseFt;
    const overallR = runFt;
    const bottomThk = ST.w * 0.55; // ~5" board below the notch line

    // Build the outline in 2D (x = run axis, y = rise axis)
    // Origin = bottom-front corner of the stringer.
    // We trace: bottom edge left → up the back → notched top → close.
    const shape = new THREE.Shape();

    // Bottom-front corner
    shape.moveTo(0, 0);

    // Bottom-back corner
    shape.lineTo(overallR, 0);

    // Back face up to bottom of top notch
    shape.lineTo(overallR, overallH);

    // Now trace the notched top edge from back to front:
    // Each step: horizontal tread cut (run), then vertical riser cut (rise).
    for (let s = numSteps; s >= 1; s--) {
        const notchX = s * stepRun;   // run position of this step
        const notchY = s * stepRise;  // rise position of this step
        // Tread cut (horizontal, going toward front)
        shape.lineTo(notchX - stepRun, notchY);
        // Riser cut (vertical, going down)
        shape.lineTo(notchX - stepRun, notchY - stepRise);
    }
    // We are now at (0, 0) — close back to start
    shape.lineTo(0, 0);

    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: ST.th,
        bevelEnabled: false
    });
    return geom;
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

function makeBar(parent, mat, x1, y1, z1, x2, y2, z2, thickness) {
    const dx = x2-x1, dy = y2-y1, dz = z2-z1;
    const len = Math.sqrt(dx*dx+dy*dy+dz*dz);
    if (len < 0.01) return;
    const geom = new THREE.BoxGeometry(thickness, thickness, len);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);
    mesh.lookAt(x2,y2,z2);
    mesh.castShadow = true;
    parent.add(mesh);
}

function buildRailingSegment(parent, mat, x1, z1, x2, z2, surfY) {
    const edgeLen = Math.sqrt((x2-x1)**2+(z2-z1)**2);
    if (edgeLen < 0.01) return;
    addBox(parent, mat, RAIL.POST_SZ, RAIL.H, RAIL.POST_SZ, x1, surfY+RAIL.H/2, z1);
    addBox(parent, mat, RAIL.POST_SZ, RAIL.H, RAIL.POST_SZ, x2, surfY+RAIL.H/2, z2);
    makeBar(parent, mat, x1, surfY+RAIL.H, z1, x2, surfY+RAIL.H, z2, RAIL.TH);
    makeBar(parent, mat, x1, surfY+RAIL.BOT, z1, x2, surfY+RAIL.BOT, z2, RAIL.TH);
    const balH = RAIL.H-RAIL.BOT;
    const nBal = Math.max(1, Math.floor(edgeLen/RAIL.BAL_SP));
    for (let b = 1; b < nBal; b++) {
        const t = b/nBal;
        addBox(parent, mat, RAIL.BAL_SZ, balH, RAIL.BAL_SZ,
               x1+(x2-x1)*t, surfY+RAIL.BOT+balH/2, z1+(z2-z1)*t);
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
        numSteps: dims.numTreads,
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
    const landingCenterZ = -(ld.run1Feet + sw / 2);

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
        numSteps: ld.treadsBeforeLanding,
        startY: st.deckHeight, dirZ: -1, dirX: 0,
        originX: 0, originZ: 0
    });

    // Landing pad
    buildLanding({
        parentGroup: g, colorConfig: cc,
        sizeFt: sw, landingY,
        centerX: 0, centerZ: landingCenterZ
    });

    // Risers at landing edges
    buildLandingRiser({
        parentGroup: g, colorConfig: cc,
        stairWidthFt: sw, risePerStep: rps,
        landingY, riserZ: -ld.run1Feet
    });
    buildLandingSideRiser({
        parentGroup: g, colorConfig: cc,
        stairWidthFt: sw, risePerStep: rps,
        landingY, landingCenterZ,
        riserX: sign * sw / 2
    });

    // Flight 2
    const f2originX = sign * sw / 2;
    const f2originZ = landingCenterZ;
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
        numSteps: ld.treadsAfterLanding,
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
        buildLandingRailings({
            parentGroup: g, landingY, sw,
            run1Feet: ld.run1Feet, sign
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
                mesh.position.set(p.originX + p.dirX * travelPos, treadY + bth/2, p.originZ);
            } else {
                mesh = new THREE.Mesh(new THREE.BoxGeometry(p.stairWidthFt, bth, bw), mat);
                mesh.position.set(p.originX, treadY + bth/2, p.originZ + p.dirZ * travelPos);
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
            riser.position.set(p.originX + p.dirX * frontOffset, riserYc, p.originZ);
        } else {
            riser = new THREE.Mesh(new THREE.BoxGeometry(p.stairWidthFt, riserH, bth), riserMat);
            riser.position.set(p.originX, riserYc, p.originZ + p.dirZ * frontOffset);
        }
        riser.castShadow = true;
        p.parentGroup.add(riser);
    }
}

// ============================================================
// buildFlightStringers
// Renders proper notched PT-lumber stringers using ExtrudeGeometry.
// The profile is drawn in the XY plane (run = X, rise = Y) then
// rotated/translated into the correct world position per stringer.
// ============================================================
function buildFlightStringers(p) {
    if (p.numSteps < 1 || p.riseFt < 0.01 || p.runFt < 0.01) return;
    const mat    = stringerMat();
    const runsX  = Math.abs(p.dirX) > 0.5;
    const geom   = buildStringerGeometry(p.riseFt, p.runFt, p.numSteps);
    if (!geom) return;

    getStringerPositions(p.stairWidthFt).forEach(({ lat, yOff }) => {
        const mesh = new THREE.Mesh(geom, mat);

        // The Shape was built with:
        //   X = run direction (0 → runFt, front → back)
        //   Y = rise direction (0 → riseFt, bottom → top)
        //   Z = extruded by ST.th
        // We need to rotate so the stringer lies in the correct plane.

        if (runsX) {
            // Flight runs along world X
            // Rotate shape: shape-X becomes world-X (run), shape-Y becomes world-Y (rise)
            // Extrude depth (shape-Z) becomes world-Z (lateral)
            mesh.rotation.set(0, 0, 0);
            mesh.position.set(
                p.originX + p.dirX * 0,   // shape origin is front of stair
                p.startY - p.riseFt + yOff,
                p.originZ + lat
            );
            // dirX may be +1 or -1; mirror if going negative
            if (p.dirX < 0) {
                mesh.scale.x = -1;
                mesh.position.x = p.originX;
            }
        } else {
            // Flight runs along world Z (most common: front/back edges)
            // Rotate shape so run axis aligns with world Z:
            //   shape-X (run) → world-Z, shape-Y (rise) → world-Y
            mesh.rotation.set(0, -Math.PI / 2, 0);
            // After that rotation the extrude (shape-Z) becomes world-X (lateral)
            mesh.position.set(
                p.originX + lat,
                p.startY - p.riseFt + yOff,
                p.originZ + p.dirZ * 0
            );
            if (p.dirZ < 0) {
                mesh.scale.z = -1;
            } else {
                mesh.position.z = p.originZ;
            }
        }

        // Center the extrude thickness so stringer is centered on lat position
        // The extruded depth goes 0..ST.th in local Z after rotation.
        // Offset by -ST.th/2 so it is centered.
        if (runsX) {
            mesh.position.z -= ST.th / 2;
        } else {
            mesh.position.x -= ST.th / 2;
        }

        mesh.castShadow = true;
        p.parentGroup.add(mesh);
    });
}

// ============================================================
// buildFlightHandrails
// ============================================================
function buildFlightHandrails(p) {
    const mat  = handrailMat();
    const runsX = Math.abs(p.dirX) > 0.5;
    const endY  = p.startY - p.riseFt;

    [-1, 1].forEach(side => {
        const lat = side * p.stairWidthFt / 2;
        let topX, topZ, botX, botZ;
        if (runsX) {
            topX = p.originX;                    topZ = p.originZ + lat;
            botX = p.originX + p.dirX * p.runFt; botZ = p.originZ + lat;
        } else {
            topX = p.originX + lat; topZ = p.originZ;
            botX = p.originX + lat; botZ = p.originZ + p.dirZ * p.runFt;
        }
        addBox(p.parentGroup, mat, RAIL.POST_SZ, RAIL.H, RAIL.POST_SZ, topX, p.startY+RAIL.H/2, topZ);
        addBox(p.parentGroup, mat, RAIL.POST_SZ, RAIL.H, RAIL.POST_SZ, botX, endY+RAIL.H/2, botZ);
        makeBar(p.parentGroup, mat, topX, p.startY+RAIL.H, topZ, botX, endY+RAIL.H, botZ, RAIL.TH);
        makeBar(p.parentGroup, mat, topX, p.startY+RAIL.BOT, topZ, botX, endY+RAIL.BOT, botZ, RAIL.TH);
        const balH  = RAIL.H - RAIL.BOT;
        const nBal  = Math.max(1, Math.floor(p.runFt / RAIL.BAL_SP));
        for (let b = 1; b < nBal; b++) {
            const t = b / nBal;
            const bx = topX + (botX-topX)*t;
            const bz = topZ + (botZ-topZ)*t;
            const surfY = p.startY - t * p.riseFt;
            addBox(p.parentGroup, mat, RAIL.BAL_SZ, balH, RAIL.BAL_SZ, bx, surfY+RAIL.BOT+balH/2, bz);
        }
    });
}

// ============================================================
// buildLandingRailings
// ============================================================
function buildLandingRailings(p) {
    const mat  = handrailMat();
    const half = p.sw / 2;
    const nearZ = -p.run1Feet;
    const farZ  = -(p.run1Feet + p.sw);
    const oppX  = -p.sign * half;
    buildRailingSegment(p.parentGroup, mat, -half, farZ,  half, farZ,  p.landingY);
    buildRailingSegment(p.parentGroup, mat, oppX,  nearZ, oppX, farZ,  p.landingY);
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
        const zo = -sz/2 + r*ew + bw/2;
        const m  = new THREE.Mesh(
            new THREE.BoxGeometry(sz, bth, bw),
            createBoardMaterial(p.colorConfig, bl, false, `lp_${r}`)
        );
        m.position.set(p.centerX, p.landingY+bth/2, p.centerZ+zo);
        m.castShadow = m.receiveShadow = true;
        p.parentGroup.add(m);
    }

    if (p.landingY <= 0.01) return;
    const pm   = stringerMat();
    const half = sz / 2;
    [[-half,-half],[half,-half],[half,half],[-half,half]].forEach(([fx, fz]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.33, p.landingY, 0.33), pm);
        post.position.set(p.centerX+fx, p.landingY/2, p.centerZ+fz);
        post.castShadow = true;
        p.parentGroup.add(post);
    });
}

// ============================================================
// buildLandingRiser  (near edge, facing Z)
// ============================================================
function buildLandingRiser(p) {
    const bth = CONFIG.boards.thickness / 12;
    const bl  = selectOptimalBoardLength(p.stairWidthFt);
    const m   = new THREE.Mesh(
        new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, bth),
        createBoardMaterial(p.colorConfig, bl, false, 'lr')
    );
    m.position.set(0, p.landingY - p.risePerStep/2 + bth, p.riserZ);
    m.castShadow = true;
    p.parentGroup.add(m);
}

// ============================================================
// buildLandingSideRiser  (side edge, facing X)
// ============================================================
function buildLandingSideRiser(p) {
    const bth = CONFIG.boards.thickness / 12;
    const bl  = selectOptimalBoardLength(p.stairWidthFt);
    const m   = new THREE.Mesh(
        new THREE.BoxGeometry(bth, p.risePerStep, p.stairWidthFt),
        createBoardMaterial(p.colorConfig, bl, false, 'lr_side')
    );
    m.position.set(p.riserX, p.landingY - p.risePerStep/2 + bth, p.landingCenterZ);
    m.castShadow = true;
    p.parentGroup.add(m);
}
