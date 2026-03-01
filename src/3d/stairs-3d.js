// ============================================================
// TrueGrain Deck Builder 2 — Stair 3D Geometry
// Full rewrite of L-shape coordinate system.
// Stringers use PlaneGeometry pairs so UV grain runs along length.
// ============================================================
import { CONFIG }                    from '../config.js';
import { state }                     from '../state.js';
import { createBoardMaterial, materialCache } from './materials.js';
import { selectOptimalBoardLength }  from '../calc/optimizer.js';

const ST = {
    th: (CONFIG.stairs.stringerThickness ?? 1.5)  / 12,
    w:  (CONFIG.stairs.stringerWidth     ?? 9.25) / 12,
    in: (CONFIG.stairs.stringerInset     ?? 1.5)  / 12
};
const BOARD_TH    = CONFIG.boards.thickness / 12;
const EDGE_OFFSET = BOARD_TH;

// ============================================================
// PT Lumber texture — warm tan, grain lines, knots
// ============================================================
function buildPTTexture() {
    const SIZE = 512;
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#a08060';
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 120; i++) {
        const x = Math.random() * SIZE;
        ctx.strokeStyle = Math.random() > 0.5
            ? `rgba(220,200,160,${0.08 + Math.random() * 0.14})`
            : `rgba(60,40,20,${0.06 + Math.random() * 0.12})`;
        ctx.lineWidth = 0.5 + Math.random() * 1.5;
        ctx.beginPath(); ctx.moveTo(x, 0);
        for (let y = 0; y < SIZE; y += 8) ctx.lineTo(x + (Math.random() - 0.5) * 2.5, y);
        ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
        const y = Math.random() * SIZE, h = 4 + Math.random() * 12;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, 'rgba(50,30,10,0)');
        g.addColorStop(0.5, `rgba(50,30,10,${0.08 + Math.random() * 0.1})`);
        g.addColorStop(1, 'rgba(50,30,10,0)');
        ctx.fillStyle = g; ctx.fillRect(0, y, SIZE, h);
    }
    for (let k = 0; k < 1 + Math.floor(Math.random() * 2); k++) {
        const kx = SIZE*0.2 + Math.random()*SIZE*0.6, ky = SIZE*0.2 + Math.random()*SIZE*0.6, kr = 8 + Math.random()*14;
        const kg = ctx.createRadialGradient(kx,ky,kr*0.3,kx,ky,kr*1.4);
        kg.addColorStop(0,'rgba(40,25,10,0.7)'); kg.addColorStop(0.6,'rgba(40,25,10,0.3)'); kg.addColorStop(1,'rgba(40,25,10,0)');
        ctx.fillStyle=kg; ctx.beginPath(); ctx.ellipse(kx,ky,kr*1.4,kr,0,0,Math.PI*2); ctx.fill();
        const ki = ctx.createRadialGradient(kx,ky,0,kx,ky,kr*0.5);
        ki.addColorStop(0,'rgba(20,10,5,0.85)'); ki.addColorStop(1,'rgba(20,10,5,0)');
        ctx.fillStyle=ki; ctx.beginPath(); ctx.ellipse(kx,ky,kr*0.5,kr*0.35,0,0,Math.PI*2); ctx.fill();
    }
    for (let i = 0; i < 30; i++) {
        const x=Math.random()*SIZE, y=Math.random()*SIZE, r=15+Math.random()*40;
        const sg=ctx.createRadialGradient(x,y,0,x,y,r);
        sg.addColorStop(0, Math.random()>0.6 ? 'rgba(40,20,5,0.12)' : 'rgba(200,170,120,0.1)');
        sg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
}

const stringerMat = () => {
    if (!materialCache['_stringer']) {
        materialCache['_stringer'] = new THREE.MeshStandardMaterial({
            map: buildPTTexture(), color: new THREE.Color(1,1,1),
            roughness: 0.88, metalness: 0, envMapIntensity: 0.2, side: THREE.DoubleSide
        });
    }
    return materialCache['_stringer'];
};
const handrailMat = () => {
    if (!materialCache['_handrail'])
        materialCache['_handrail'] = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 });
    return materialCache['_handrail'];
};

function getStringerPositions(stairWidthFt) {
    const sideL = -stairWidthFt / 2 + ST.in;
    const sideR =  stairWidthFt / 2 - ST.in;
    const minCenter = CONFIG.stairs.centerStringerMinWidth  ?? 3;
    const minDouble = CONFIG.stairs.doubleCenterStringerMinWidth ?? 6;
    if (stairWidthFt < minCenter) return [{lat:sideL,yOff:0},{lat:sideR,yOff:0}];
    if (stairWidthFt < minDouble) return [{lat:sideL,yOff:0},{lat:0,yOff:-(ST.w+BOARD_TH)},{lat:sideR,yOff:0}];
    const t=stairWidthFt/3;
    return [{lat:sideL,yOff:0},{lat:-stairWidthFt/2+t,yOff:-(ST.w+BOARD_TH)},{lat:-stairWidthFt/2+t*2,yOff:-(ST.w+BOARD_TH)},{lat:sideR,yOff:0}];
}

// ============================================================
// Stringer geometry: two PlaneGeometry quads (face + back)
// so UVs run naturally along the stringer length.
// The stringer sits so its TOP edge is flush with the
// underside of the treads, angled at the stair pitch.
// ============================================================
function addStringer(group, mat, sLen, angle, cx, cy, cz, rotY) {
    // We represent the stringer as a flat board (width = ST.w, length = sLen)
    // rendered as a double-sided plane so grain runs the full diagonal length.
    const geo = new THREE.PlaneGeometry(sLen, ST.w);
    // Front face
    const mf = new THREE.Mesh(geo, mat);
    mf.position.set(cx, cy, cz);
    // Rotate: first tilt to stair angle, then orient along travel axis
    mf.rotation.order = 'YXZ';
    mf.rotation.y = rotY;
    mf.rotation.x = -angle;   // pitch the board along slope
    mf.castShadow = true;
    group.add(mf);
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
    let x=0, z=0, rotY=0;
    switch (edge) {
        case 'front': x=(p-0.5)*st.deckLength; z= st.deckWidth/2+EDGE_OFFSET;  rotY=Math.PI;   break;
        case 'back':  x=(p-0.5)*st.deckLength; z=-(st.deckWidth/2+EDGE_OFFSET); rotY=0;         break;
        case 'left':  x=-(st.deckLength/2+EDGE_OFFSET); z=(p-0.5)*st.deckWidth; rotY=Math.PI/2; break;
        case 'right': x= st.deckLength/2+EDGE_OFFSET;   z=(p-0.5)*st.deckWidth; rotY=-Math.PI/2;break;
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
}

export function calculateStairDimensions(sc, st) {
    const hi  = st.deckHeight * 12;
    const tgt = CONFIG.stairs.riserHeight.target;
    let nr = Math.max(1, Math.round(hi / tgt));
    let ar = hi / nr;
    if (ar > CONFIG.stairs.riserHeight.max)      { nr = Math.ceil(hi  / CONFIG.stairs.riserHeight.max); ar = hi / nr; }
    else if (ar < CONFIG.stairs.riserHeight.min) { nr = Math.max(1, Math.floor(hi / CONFIG.stairs.riserHeight.min)); ar = hi / nr; }
    const nt   = nr - 1;
    const bpt  = sc.boardsPerTread || CONFIG.stairs.boardsPerTread.default;
    const td   = bpt * CONFIG.boards.width + (bpt - 1) * CONFIG.boards.gap;  // inches
    const swFt = sc.width || CONFIG.stairs.defaultWidth;
    const lsd  = sc.shape === 'l-shaped' ? calcLShape(nr, nt, ar, td, sc.turnDirection || 'left', sc.landingDepth, sc.landingSplit) : null;
    return { numRisers:nr, numTreads:nt, actualRise:ar, treadDepth:td,
             totalRunFeet:(nt*td)/12, stairWidthFeet:swFt, boardsPerTread:bpt,
             deckHeightInches:hi, lShapedData:lsd,
             isValid: nt>=1 && ar>=CONFIG.stairs.riserHeight.min };
}

// ============================================================
// Straight stair
// ============================================================
function buildStraightStair(sc, dims, g, cc, st) {
    const fp = {
        stairConfig:sc, dims, colorConfig:cc, parentGroup:g,
        numTreads:dims.numTreads, risePerStep:dims.actualRise/12,
        treadDepthFt:dims.treadDepth/12, stairWidthFt:dims.stairWidthFeet,
        startY:st.deckHeight, dirZ:-1, dirX:0,
        originX:0, originZ:0, flightLabel:'str'
    };
    buildFlightTreads(fp);
    buildFlightStringers({
        parentGroup:g, stairWidthFt:dims.stairWidthFeet,
        riseFt:st.deckHeight, runFt:dims.totalRunFeet,
        startY:st.deckHeight, dirZ:-1, dirX:0, originX:0, originZ:0
    });
    if (sc.includeHandrails)
        buildFlightHandrails({
            parentGroup:g, stairWidthFt:dims.stairWidthFeet,
            riseFt:st.deckHeight, runFt:dims.totalRunFeet,
            startY:st.deckHeight, originX:0, originZ:0, dirZ:-1, dirX:0
        });
}

// ============================================================
// L-shaped stair — clean world-space coordinate system
//
// Local coordinate system (before positionStairGroup rotates it):
//   Flight 1 travels in -Z direction from origin
//   Landing sits at end of flight 1
//   Flight 2 turns 90° left (−X) or right (+X) from landing
//
// All origins are the bottom-front-center of each flight's
// first tread so treads/stringers share the same anchor.
// ============================================================
function buildLShapedStair(sc, dims, g, cc, st) {
    const ld   = dims.lShapedData;
    const rps  = dims.actualRise / 12;          // rise per step in ft
    const tdf  = dims.treadDepth / 12;          // tread depth in ft
    const sw   = dims.stairWidthFeet;
    const sign = ld.turnDirection === 'right' ? 1 : -1;  // +X = right, −X = left

    // Heights
    const rise1   = ld.risersBeforeLanding * rps;
    const rise2   = ld.risersAfterLanding  * rps;
    const landingY = st.deckHeight - rise1;

    // ── Flight 1: travels in −Z ─────────────────────────────
    const f1 = {
        stairConfig:sc, dims, colorConfig:cc, parentGroup:g,
        numTreads:ld.treadsBeforeLanding, risePerStep:rps, treadDepthFt:tdf,
        stairWidthFt:sw, startY:st.deckHeight,
        dirZ:-1, dirX:0, originX:0, originZ:0, flightLabel:'f1'
    };
    buildFlightTreads(f1);
    buildFlightStringers({
        parentGroup:g, stairWidthFt:sw,
        riseFt:rise1, runFt:ld.run1Feet,
        startY:st.deckHeight, dirZ:-1, dirX:0, originX:0, originZ:0
    });

    // ── Landing ─────────────────────────────────────────────
    // Landing center: Z = −run1 − landingDepth/2
    // Landing extends in X by sw (straight-through) + run2 (turned direction)
    const landCenterZ = -(ld.run1Feet + ld.landingDepthFeet / 2);
    // The landing needs to cover the stair width plus the turned-flight width
    // Center X is offset by half of run2 in the turn direction
    const landCenterX = sign * sw / 2;
    buildLanding({
        parentGroup:g, colorConfig:cc,
        stairWidthFt:sw, run2Ft:ld.run2Feet,
        landingDepthFt:ld.landingDepthFeet,
        landingY, centerX:landCenterX, centerZ:landCenterZ,
        turnSign:sign
    });
    // Riser at the front edge of the landing (the step down onto the landing)
    buildLandingRiser({
        parentGroup:g, colorConfig:cc,
        stairWidthFt:sw, risePerStep:rps,
        landingY, riserZ:-ld.run1Feet
    });

    // ── Flight 2: turns 90° — travels in ±X ────────────────
    // Origin: the corner where landing ends and flight 2 begins.
    // Z = −run1 − landingDepth  (far edge of landing)
    // X = 0 (flight 2 starts at the stair centre-line, turns outward)
    const f2OriginZ = -(ld.run1Feet + ld.landingDepthFeet);
    const f2OriginX = 0;
    const f2 = {
        stairConfig:sc, dims, colorConfig:cc, parentGroup:g,
        numTreads:ld.treadsAfterLanding, risePerStep:rps, treadDepthFt:tdf,
        stairWidthFt:sw, startY:landingY,
        dirZ:0, dirX:sign, originX:f2OriginX, originZ:f2OriginZ, flightLabel:'f2'
    };
    buildFlightTreads(f2);
    buildFlightStringers({
        parentGroup:g, stairWidthFt:sw,
        riseFt:rise2, runFt:ld.run2Feet,
        startY:landingY, dirZ:0, dirX:sign,
        originX:f2OriginX, originZ:f2OriginZ
    });

    if (sc.includeHandrails) {
        buildFlightHandrails({ parentGroup:g, stairWidthFt:sw, riseFt:rise1, runFt:ld.run1Feet, startY:st.deckHeight, originX:0, originZ:0, dirZ:-1, dirX:0 });
        buildFlightHandrails({ parentGroup:g, stairWidthFt:sw, riseFt:rise2, runFt:ld.run2Feet, startY:landingY, originX:f2OriginX, originZ:f2OriginZ, dirZ:0, dirX:sign });
    }
}

// ============================================================
// Tread + riser boards for one flight
// ============================================================
function buildFlightTreads(p) {
    const bwf = CONFIG.boards.width / 12;
    const btf = CONFIG.boards.thickness / 12;
    const gf  = CONFIG.boards.gap / 12;
    const runsX = Math.abs(p.dirX) > 0.5;
    const bl  = selectOptimalBoardLength(p.stairWidthFt);

    for (let step = 0; step < p.numTreads; step++) {
        const sY = p.startY - (step + 1) * p.risePerStep;
        const ro = (step + 1) * p.treadDepthFt;

        // Centre of this tread step along travel axis
        const stepCX = p.originX + p.dirX * (ro - p.treadDepthFt / 2);
        const stepCZ = p.originZ + p.dirZ * (ro - p.treadDepthFt / 2);

        for (let b = 0; b < p.dims.boardsPerTread; b++) {
            const bo = -p.treadDepthFt / 2 + b * (bwf + gf) + bwf / 2;
            const mat  = createBoardMaterial(p.colorConfig, bl, false, `tr_${p.flightLabel}_${step}_${b}`);
            const geom = runsX
                ? new THREE.BoxGeometry(bwf, btf, p.stairWidthFt)
                : new THREE.BoxGeometry(p.stairWidthFt, btf, bwf);
            const m = new THREE.Mesh(geom, mat);
            m.position.set(
                stepCX + p.dirX * bo,
                sY + btf / 2,
                stepCZ + p.dirZ * bo
            );
            m.castShadow = m.receiveShadow = true;
            p.parentGroup.add(m);
        }

        // Riser (vertical face at the front edge of the tread)
        const riserX = p.originX + p.dirX * ro;
        const riserZ = p.originZ + p.dirZ * ro;
        const rg = runsX
            ? new THREE.BoxGeometry(btf, p.risePerStep, p.stairWidthFt)
            : new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, btf);
        const rm = new THREE.Mesh(rg, createBoardMaterial(p.colorConfig, bl, false, `rs_${p.flightLabel}_${step}`));
        rm.position.set(riserX, sY - p.risePerStep / 2 + btf, riserZ);
        rm.castShadow = true;
        p.parentGroup.add(rm);
    }
}

// ============================================================
// Stringer boards for one flight
// Uses PlaneGeometry (double-sided) so the wood-grain UV
// runs continuously along the full diagonal length rather
// than tiling across the face of a BoxGeometry.
// ============================================================
function buildFlightStringers(p) {
    const sLen  = Math.sqrt(p.riseFt * p.riseFt + p.runFt * p.runFt);
    const pitch = Math.atan2(p.riseFt, p.runFt);   // slope angle
    const runsX = Math.abs(p.dirX) > 0.5;
    const mat   = stringerMat();

    // Mid-point along the travel axis
    const midRun = p.runFt / 2;
    // Y centre of the stringer: starts at startY, ends at startY−riseFt
    const midY = p.startY - p.riseFt / 2;

    getStringerPositions(p.stairWidthFt).forEach(({ lat, yOff }) => {
        // PlaneGeometry: width = sLen (along slope), height = ST.w (board depth)
        const geo = new THREE.PlaneGeometry(sLen, ST.w);
        const mesh = new THREE.Mesh(geo, mat);

        if (runsX) {
            // Flight runs along X axis
            mesh.position.set(
                p.originX + p.dirX * midRun,
                midY + yOff,
                p.originZ + lat
            );
            // Face the plane perpendicular to Z, then tilt by pitch
            mesh.rotation.order = 'YXZ';
            mesh.rotation.y = p.dirX > 0 ? -Math.PI / 2 : Math.PI / 2;
            mesh.rotation.x = p.dirX * pitch;
        } else {
            // Flight runs along Z axis
            mesh.position.set(
                p.originX + lat,
                midY + yOff,
                p.originZ + p.dirZ * midRun
            );
            mesh.rotation.order = 'YXZ';
            mesh.rotation.y = p.dirZ > 0 ? 0 : Math.PI;
            mesh.rotation.x = -pitch;   // always positive slope away from deck
        }

        mesh.castShadow = true;
        p.parentGroup.add(mesh);
    });
}

// ============================================================
// Handrails for one flight
// ============================================================
function buildFlightHandrails(p) {
    const mat = handrailMat();
    const pH=3, pSz=0.29, rH=0.29, rTh=0.125, bSz=0.125, bSp=0.33, bOff=0.25;
    const fLen  = Math.sqrt(p.riseFt * p.riseFt + p.runFt * p.runFt);
    const angle = Math.atan2(p.riseFt, p.runFt);
    const runsX = Math.abs(p.dirX) > 0.5;

    [-1, 1].forEach(side => {
        const lat = side * p.stairWidthFt / 2;
        const lx = runsX ? p.originX             : p.originX + lat;
        const lz = runsX ? p.originZ + lat : p.originZ;

        const endY = p.startY - p.riseFt;
        const mkPost = (px, py, pz) => {
            const pm = new THREE.Mesh(new THREE.BoxGeometry(pSz, pH, pSz), mat);
            pm.position.set(px, py, pz); pm.castShadow = true; p.parentGroup.add(pm);
        };
        if (runsX) {
            mkPost(p.originX,                   p.startY + pH/2, lz);
            mkPost(p.originX + p.dirX*p.runFt,  endY    + pH/2, lz);
        } else {
            mkPost(lx, p.startY + pH/2, p.originZ);
            mkPost(lx, endY    + pH/2,  p.originZ + p.dirZ*p.runFt);
        }

        const midY = p.startY + pH - rH/2 - p.riseFt/2;
        const rg = new THREE.BoxGeometry(rTh, rH, fLen);
        [midY, midY - (pH - bOff - rH)].forEach(ry => {
            const rail = new THREE.Mesh(rg.clone(), mat);
            if (runsX) {
                rail.position.set(p.originX + p.dirX*p.runFt/2, ry, lz);
                rail.rotation.z = p.dirX * angle;
                rail.rotation.y = Math.PI / 2;
            } else {
                rail.position.set(lx, ry, p.originZ + p.dirZ*p.runFt/2);
                rail.rotation.x = p.dirZ * angle;
            }
            rail.castShadow = true; p.parentGroup.add(rail);
        });

        const nb = Math.floor(p.runFt / bSp);
        const bH = pH - rH - bOff - rH;
        for (let b = 1; b < nb; b++) {
            const t  = b / nb;
            const by = p.startY - t * p.riseFt + bOff + rH + bH / 2;
            const bal = new THREE.Mesh(new THREE.BoxGeometry(bSz, bH, bSz), mat);
            if (runsX) bal.position.set(p.originX + p.dirX*t*p.runFt, by, lz);
            else       bal.position.set(lx, by, p.originZ + p.dirZ*t*p.runFt);
            bal.castShadow = true; p.parentGroup.add(bal);
        }
    });
}

// ============================================================
// Landing platform
// The landing is a rectangle that bridges flight 1 end and
// flight 2 start. It is centred correctly in world space.
//
// Layout (turn = left/−X example):
//   Flight 1 ends at Z = −run1  (stair width centred on X=0)
//   Flight 2 starts at Z = −run1−landingDepth, runs in −X
//   Landing: X spans [−sw/2 .. sw/2] union [−sw .. 0] in turn dir
//            Z spans [−run1−landingDepth .. −run1]
//
// We simplify to a single rectangle:
//   Width  = sw (covers both flights' width)
//   Depth  = landingDepth (along Z)
//   Offset X by (sign * sw/2) to align with the turned flight
// ============================================================
function buildLanding(p) {
    const bwf = CONFIG.boards.width / 12;
    const btf = CONFIG.boards.thickness / 12;
    const gf  = CONFIG.boards.gap / 12;
    const landW = p.stairWidthFt;                      // boards run across width
    const landD = Math.max(p.landingDepthFt, p.stairWidthFt); // depth along Z
    const ew    = bwf + gf;
    const nr    = Math.ceil(landD / ew);
    const bl    = selectOptimalBoardLength(landW);

    for (let r = 0; r < nr; r++) {
        const zo = -landD / 2 + r * ew + bwf / 2;
        const mat = createBoardMaterial(p.colorConfig, bl, false, `lnd_${r}`);
        const m = new THREE.Mesh(new THREE.BoxGeometry(landW, btf, bwf), mat);
        m.position.set(p.centerX, p.landingY + btf / 2, p.centerZ + zo);
        m.castShadow = m.receiveShadow = true;
        p.parentGroup.add(m);
    }

    // Landing support posts
    if (p.landingY > 0.01) {
        const pm = stringerMat();
        const pg = new THREE.BoxGeometry(0.33, p.landingY, 0.33);
        const hW = landW / 2, hD = landD / 2;
        [[-hW,-hD],[hW,-hD],[hW,hD],[-hW,hD]].forEach(([fx, fz]) => {
            const post = new THREE.Mesh(pg, pm);
            post.position.set(p.centerX + fx, p.landingY / 2, p.centerZ + fz);
            post.castShadow = true;
            p.parentGroup.add(post);
        });
    }
}

// Riser board at the front edge of the landing (the step down from deck to landing)
function buildLandingRiser(p) {
    const btf = CONFIG.boards.thickness / 12;
    const bl  = selectOptimalBoardLength(p.stairWidthFt);
    const mat = createBoardMaterial(p.colorConfig, bl, false, 'lr');
    const m   = new THREE.Mesh(new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, btf), mat);
    m.position.set(0, p.landingY - p.risePerStep / 2 + btf, p.riserZ);
    m.castShadow = true;
    p.parentGroup.add(m);
}

// ============================================================
// L-shape dimension calculator
// ============================================================
function calcLShape(nr, nt, ar, td, dir, ldFt, ls) {
    const ldf   = typeof ldFt === 'number' ? ldFt : (CONFIG.stairs.landingDepth ?? 3);
    const split = typeof ls   === 'number' ? ls   : 0.5;
    let tbl = Math.max(1, Math.round(nt * split));
    if (tbl >= nt) tbl = nt - 1;
    const tal = nt - tbl;
    const rbl = tbl + 1;   // risers before landing = treads before + 1
    const ral = nr - rbl;  // risers after landing
    return {
        treadsBeforeLanding: tbl,  treadsAfterLanding: tal,
        risersBeforeLanding: rbl,  risersAfterLanding: ral,
        landingDepthFeet: ldf,
        run1Feet: (tbl * td) / 12,
        run2Feet: (tal * td) / 12,
        heightAtLanding: rbl * (ar / 12),
        turnDirection: dir,
        landingSplit: split
    };
}
