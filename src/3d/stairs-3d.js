// ============================================================
// TrueGrain Deck Builder 2 — Stair 3D Geometry
// v4.4 — notched center stringer, solid side stringers,
//         correct orientation for all 4 deck edges
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

// ============================================================
// Stringer position table
// isCenter flags which entries get the notched profile
// ============================================================
function getStringerPositions(stairWidthFt) {
    const sideL = -stairWidthFt / 2 + ST.in;
    const sideR =  stairWidthFt / 2 - ST.in;
    const cy    = -(ST.w + BOARD_TH);   // vertical offset so notch top aligns under tread

    if (stairWidthFt < (CONFIG.stairs.centerStringerMinWidth ?? 3))
        return [
            { lat: sideL, yOff: 0,  isCenter: false },
            { lat: sideR, yOff: 0,  isCenter: false }
        ];

    if (stairWidthFt < (CONFIG.stairs.doubleCenterStringerMinWidth ?? 6))
        return [
            { lat: sideL, yOff: 0,  isCenter: false },
            { lat: 0,     yOff: cy, isCenter: true  },
            { lat: sideR, yOff: 0,  isCenter: false }
        ];

    const t = stairWidthFt / 3;
    return [
        { lat: sideL,                  yOff: 0,  isCenter: false },
        { lat: -stairWidthFt / 2 + t,  yOff: cy, isCenter: true  },
        { lat: -stairWidthFt / 2 + t*2,yOff: cy, isCenter: true  },
        { lat: sideR,                  yOff: 0,  isCenter: false }
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

function buildRailingSegment(parent, mat, x1, z1, x2, z2, surfY) {
    const edgeLen = Math.sqrt((x2-x1)**2 + (z2-z1)**2);
    if (edgeLen < 0.01) return;

    addBox(parent, mat, RAIL.POST_SZ, RAIL.H, RAIL.POST_SZ,
           x1, surfY + RAIL.H / 2, z1);
    addBox(parent, mat, RAIL.POST_SZ, RAIL.H, RAIL.POST_SZ,
           x2, surfY + RAIL.H / 2, z2);

    makeBar(parent, mat,
        x1, surfY + RAIL.H, z1,
        x2, surfY + RAIL.H, z2,
        RAIL.TH
    );

    makeBar(parent, mat,
        x1, surfY + RAIL.BOT, z1,
        x2, surfY + RAIL.BOT, z2,
        RAIL.TH
    );

    const balH = RAIL.H - RAIL.BOT;
    const nBal = Math.max(1, Math.floor(edgeLen / RAIL.BAL_SP));
    for (let b = 1; b < nBal; b++) {
        const t = b / nBal;
        const bx = x1 + (x2 - x1) * t;
        const bz = z1 + (z2 - z1) * t;
        const balYc = surfY + RAIL.BOT + balH / 2;
        addBox(parent, mat, RAIL.BAL_SZ, balH, RAIL.BAL_SZ, bx, balYc, bz);
    }
}

// ============================================================
// Notched (sawtooth) center stringer via ExtrudeGeometry
//
// Profile is built in a 2D plane where:
//   +u  = travel direction (run, away from deck)
//   +v  = up
//
// The shape traces the cut face of the stringer exactly as
// shown in the reference photo — horizontal seat cuts and
// vertical plumb cuts at every step, top cut flush with the
// deck, bottom cut level with grade.
//
// The extrusion depth is ST.th (1.5" in feet).
// After creation the mesh is rotated so the extrude axis
// (originally Three.js Z) points laterally across the stair
// width — X-axis for front/back stairs, Z-axis for left/right.
// ============================================================
function buildNotchedStringer(parent, mat, p, numTreads, risePerStepFt, treadDepthFt, startY) {
    const runFt  = numTreads * treadDepthFt;
    const riseFt = numTreads * risePerStepFt;

    // ---- 2D profile (u = run axis, v = height axis) --------
    // Origin of the shape is the top-left corner of the stringer
    // (at the deck edge, full stringer height above bottom-of-cut).
    const shape = new THREE.Shape();

    // Top-left: where stringer meets deck header
    shape.moveTo(0, 0);

    // Walk down each step: at each step, cut a horizontal seat
    // then a vertical plumb cut
    for (let i = 0; i < numTreads; i++) {
        const u = i * treadDepthFt;
        const v = -i * risePerStepFt;
        // Horizontal seat (tread nosing cut)
        shape.lineTo(u + treadDepthFt, v);
        // Vertical plumb cut (riser cut)
        shape.lineTo(u + treadDepthFt, v - risePerStepFt);
    }

    // Bottom-right corner (at grade, end of run)
    // already at (runFt, -riseFt) from last step

    // Bottom edge back to origin column
    shape.lineTo(0, -riseFt);

    // Close back up the back face of the stringer
    shape.lineTo(0, 0);

    // ---- Extrude by stringer thickness ---------------------
    const geom = new THREE.ExtrudeGeometry(shape, {
        depth:           ST.th,
        bevelEnabled:    false
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;

    // ---- Orient and position the mesh ----------------------
    // ExtrudeGeometry extrudes along local +Z.
    // We want the extrude axis to be the lateral (width) axis.
    // The profile u-axis must align with the travel direction,
    // v-axis must align with world +Y.
    //
    // runsX = true  → stair travels along world X (left/right edges)
    //   profile u → world X (scaled by dirX sign)
    //   extrude Z → world Z (lateral)
    //   no extra rotation needed on the mesh itself;
    //   we place it and let the parent group's rotY handle it.
    //
    // runsX = false → stair travels along world Z (front/back edges)
    //   profile u → world Z (scaled by dirZ sign, which is -1 for front)
    //   extrude Z → world X (lateral)
    //   rotate mesh -90° around Y so local X becomes world Z travel.

    const runsX = Math.abs(p.dirX) > 0.5;

    if (runsX) {
        // profile u aligns with dirX; extrude (local Z) aligns with world Z
        // dirX = +1 (right edge): no flip needed
        // dirX = -1 (left edge):  flip u-axis by rotating 180° around Y
        if (p.dirX < 0) {
            mesh.rotation.y = Math.PI;
        }
        // Center the extrude thickness around lat-Z
        // Position: lat is already in Z when runsX
        mesh.position.set(
            p.originX + p.dirX * 0,     // u=0 starts at origin
            startY,                      // top of stringer at startY
            p.originZ + p.lat - ST.th / 2
        );
    } else {
        // profile u must run along world -Z (front stairs: dirZ=-1)
        // Rotate mesh 90° around Y so local +X → world -Z
        // Then if dirZ = -1 (front) the profile naturally runs away.
        // dirZ = +1 (back): flip by adding another 180°.
        mesh.rotation.y = (p.dirZ > 0) ? -Math.PI / 2 : Math.PI / 2;
        mesh.position.set(
            p.originX + p.lat - ST.th / 2,
            startY,
            p.originZ + p.dirZ * 0
        );
    }

    parent.add(mesh);
}

// ============================================================
// Solid (angled box) side stringer — unchanged from v4.3
// ============================================================
function buildSolidStringer(parent, mat, p, lat, yOff) {
    const runsX = Math.abs(p.dirX) > 0.5;
    let x1, y1, z1, x2, y2, z2;
    const topY = p.startY + yOff;
    const botY = p.startY - p.riseFt + yOff;

    if (runsX) {
        x1 = p.originX;                     z1 = p.originZ + lat;
        x2 = p.originX + p.dirX * p.runFt;  z2 = p.originZ + lat;
    } else {
        x1 = p.originX + lat; z1 = p.originZ;
        x2 = p.originX + lat; z2 = p.originZ + p.dirZ * p.runFt;
    }
    y1 = topY;
    y2 = botY;

    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (len < 0.01) return;

    const geom = new THREE.BoxGeometry(ST.th, ST.w, len);
    const m = new THREE.Mesh(geom, mat);
    m.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);

    // Orient along the diagonal run vector
    // lookAt aligns local -Z toward target; we want local Z toward (x2,y2,z2)
    // so point away from origin
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    m.quaternion.copy(quaternion);

    m.castShadow = true;
    parent.add(m);
}

// ============================================================
// buildFlightStringers — routes each stringer to the right builder
// ============================================================
function buildFlightStringers(p) {
    const mat = stringerMat();

    getStringerPositions(p.stairWidthFt).forEach(({ lat, yOff, isCenter }) => {
        if (isCenter) {
            // Pass all flight params plus this stringer's lateral position
            buildNotchedStringer(
                p.parentGroup,
                mat,
                { ...p, lat },
                p.numTreads,
                p.riseFt / p.numTreads,
                p.runFt  / p.numTreads,
                p.startY + yOff
            );
        } else {
            buildSolidStringer(p.parentGroup, mat, p, lat, yOff);
        }
    });
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
        numTreads: dims.numTreads,
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
        numTreads: ld.treadsBeforeLanding,
        riseFt: rise1, runFt: ld.run1Feet,
        startY: st.deckHeight, dirZ: -1, dirX: 0,
        originX: 0, originZ: 0
    });

    // Landing
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
        numTreads: ld.treadsAfterLanding,
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

        addBox(p.parentGroup, mat, RAIL.POST_SZ, RAIL.H, RAIL.POST_SZ,
               topX, p.startY + RAIL.H / 2, topZ);
        addBox(p.parentGroup, mat, RAIL.POST_SZ, RAIL.H, RAIL.POST_SZ,
               botX, endY + RAIL.H / 2, botZ);

        makeBar(p.parentGroup, mat,
            topX, p.startY + RAIL.H, topZ,
            botX, endY     + RAIL.H, botZ,
            RAIL.TH
        );

        makeBar(p.parentGroup, mat,
            topX, p.startY + RAIL.BOT, topZ,
            botX, endY     + RAIL.BOT, botZ,
            RAIL.TH
        );

        const balH  = RAIL.H - RAIL.BOT;
        const nBal  = Math.max(1, Math.floor(p.runFt / RAIL.BAL_SP));
        for (let b = 1; b < nBal; b++) {
            const t = b / nBal;
            const bx = topX + (botX - topX) * t;
            const bz = topZ + (botZ - topZ) * t;
            const surfY = p.startY - t * p.riseFt;
            const balYc = surfY + RAIL.BOT + balH / 2;
            addBox(p.parentGroup, mat, RAIL.BAL_SZ, balH, RAIL.BAL_SZ, bx, balYc, bz);
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

    buildRailingSegment(p.parentGroup, mat,
        -half, farZ,  half, farZ,  p.landingY);

    buildRailingSegment(p.parentGroup, mat,
        oppX, nearZ,  oppX, farZ,  p.landingY);
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
// buildLandingRiser  (near edge, facing Z)
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
    m.position.set(
        p.riserX,
        p.landingY - p.risePerStep / 2 + bth,
        p.landingCenterZ
    );
    m.castShadow = true;
    p.parentGroup.add(m);
}
