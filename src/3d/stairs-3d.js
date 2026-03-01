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

const BOARD_TH    = CONFIG.boards.thickness / 12;
const EDGE_OFFSET = BOARD_TH;

// ============================================================
// Procedural PT lumber texture for stringers
// ============================================================
function buildPTTexture() {
    const SIZE = 512;
    const c   = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#a08060';
    ctx.fillRect(0, 0, SIZE, SIZE);

    for (let i = 0; i < 120; i++) {
        const x     = Math.random() * SIZE;
        const light = Math.random() > 0.5;
        ctx.strokeStyle = light
            ? `rgba(220,200,160,${0.08 + Math.random() * 0.14})`
            : `rgba(60,40,20,${0.06 + Math.random() * 0.12})`;
        ctx.lineWidth = 0.5 + Math.random() * 1.5;
        ctx.beginPath(); ctx.moveTo(x, 0);
        for (let y = 0; y < SIZE; y += 8)
            ctx.lineTo(x + (Math.random() - 0.5) * 2.5, y);
        ctx.stroke();
    }

    for (let i = 0; i < 8; i++) {
        const y = Math.random() * SIZE, h = 4 + Math.random() * 12;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0,   'rgba(50,30,10,0)');
        g.addColorStop(0.5, `rgba(50,30,10,${0.08 + Math.random() * 0.1})`);
        g.addColorStop(1,   'rgba(50,30,10,0)');
        ctx.fillStyle = g; ctx.fillRect(0, y, SIZE, h);
    }

    const numKnots = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < numKnots; k++) {
        const kx = SIZE * 0.2 + Math.random() * SIZE * 0.6;
        const ky = SIZE * 0.2 + Math.random() * SIZE * 0.6;
        const kr = 8 + Math.random() * 14;
        const kg = ctx.createRadialGradient(kx, ky, kr*0.3, kx, ky, kr*1.4);
        kg.addColorStop(0,   'rgba(40,25,10,0.7)');
        kg.addColorStop(0.6, 'rgba(40,25,10,0.3)');
        kg.addColorStop(1,   'rgba(40,25,10,0)');
        ctx.fillStyle = kg;
        ctx.beginPath(); ctx.ellipse(kx, ky, kr*1.4, kr, 0, 0, Math.PI*2); ctx.fill();
        const ki = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr*0.5);
        ki.addColorStop(0, 'rgba(20,10,5,0.85)');
        ki.addColorStop(1, 'rgba(20,10,5,0)');
        ctx.fillStyle = ki;
        ctx.beginPath(); ctx.ellipse(kx, ky, kr*0.5, kr*0.35, 0, 0, Math.PI*2); ctx.fill();
        for (let r = 0; r < 20; r++) {
            const angle = (r / 20) * Math.PI * 2;
            const rx = kx + Math.cos(angle) * (kr*1.8);
            const ry = ky + Math.sin(angle) * (kr*0.9);
            ctx.strokeStyle = 'rgba(30,15,5,0.12)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(rx, 0);
            ctx.quadraticCurveTo(kx + Math.cos(angle)*kr, ky, rx, SIZE);
            ctx.stroke();
        }
    }

    for (let i = 0; i < 30; i++) {
        const x = Math.random()*SIZE, y = Math.random()*SIZE, r = 15+Math.random()*40;
        const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
        const dark = Math.random() > 0.6;
        sg.addColorStop(0, dark ? 'rgba(40,20,5,0.12)' : 'rgba(200,170,120,0.1)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
}

const stringerMat = () => {
    if (!materialCache['_stringer']) {
        materialCache['_stringer'] = new THREE.MeshStandardMaterial({
            map:             buildPTTexture(),
            color:           new THREE.Color(1, 1, 1),
            roughness:       0.88,
            metalness:       0.0,
            envMapIntensity: 0.2,
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
    const minCenter = CONFIG.stairs.centerStringerMinWidth ?? 3;
    const minDouble = CONFIG.stairs.doubleCenterStringerMinWidth ?? 6;
    const sideL = -stairWidthFt / 2 + ST.in;
    const sideR =  stairWidthFt / 2 - ST.in;
    const centerYOffset = -(ST.w + BOARD_TH);
    if (stairWidthFt < minCenter) {
        return [{ lat: sideL, yOffset: 0 }, { lat: sideR, yOffset: 0 }];
    } else if (stairWidthFt < minDouble) {
        return [{ lat: sideL, yOffset: 0 }, { lat: 0, yOffset: centerYOffset }, { lat: sideR, yOffset: 0 }];
    } else {
        const third = stairWidthFt / 3;
        const c1 = -stairWidthFt/2 + third, c2 = -stairWidthFt/2 + third*2;
        return [{ lat: sideL, yOffset: 0 }, { lat: c1, yOffset: centerYOffset }, { lat: c2, yOffset: centerYOffset }, { lat: sideR, yOffset: 0 }];
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
    if (ar > CONFIG.stairs.riserHeight.max) { nr = Math.ceil(hi / CONFIG.stairs.riserHeight.max); ar = hi / nr; }
    else if (ar < CONFIG.stairs.riserHeight.min) { nr = Math.max(1, Math.floor(hi / CONFIG.stairs.riserHeight.min)); ar = hi / nr; }
    const nt  = nr - 1;
    const bpt = sc.boardsPerTread || CONFIG.stairs.boardsPerTread.default;
    const td  = bpt * CONFIG.boards.width + (bpt - 1) * CONFIG.boards.gap;
    const swFt = sc.width || CONFIG.stairs.defaultWidth;
    const lsd = sc.shape === 'l-shaped' ? calcLShape(nr, nt, ar, td, sc.turnDirection || 'left', sc.landingDepth, sc.landingSplit) : null;
    return { numRisers: nr, numTreads: nt, actualRise: ar, treadDepth: td, totalRunFeet: (nt*td)/12, stairWidthFeet: swFt, boardsPerTread: bpt, deckHeightInches: hi, lShapedData: lsd, isValid: nt >= 1 && ar >= CONFIG.stairs.riserHeight.min };
}

function buildStraightStair(sc, dims, g, cc, st) {
    const rF = st.deckHeight, rnF = dims.totalRunFeet;
    const fp = { stairConfig: sc, dims, colorConfig: cc, parentGroup: g, numTreads: dims.numTreads, numRisers: dims.numRisers, risePerStep: dims.actualRise/12, treadDepthFt: dims.treadDepth/12, stairWidthFt: dims.stairWidthFeet, startY: st.deckHeight, dirZ: -1, dirX: 0, originX: 0, originZ: 0, flightLabel: 'str' };
    buildFlightTreads(fp);
    buildFlightStringers({ parentGroup: g, stairWidthFt: dims.stairWidthFeet, riseFt: rF, runFt: rnF, startY: st.deckHeight, dirZ: -1, dirX: 0, originX: 0, originZ: 0, flightLabel: 'str' });
    if (sc.includeHandrails) buildFlightHandrails({ parentGroup: g, stairWidthFt: dims.stairWidthFeet, riseFt: rF, runFt: rnF, startY: st.deckHeight, originX: 0, originZ: 0, dirZ: -1, dirX: 0, flightLabel: 'str' });
}

function buildLShapedStair(sc, dims, g, cc, st) {
    const ld = dims.lShapedData;
    const rps = dims.actualRise/12, tdf = dims.treadDepth/12, sw = dims.stairWidthFeet;
    const sign = ld.turnDirection === 'left' ? -1 : 1;
    const rise1 = ld.risersBeforeLanding * rps;
    const rise2 = (dims.numRisers - ld.risersBeforeLanding) * rps;
    const landingY = st.deckHeight - rise1;

    // Flight 1: runs in -Z direction from origin
    buildFlightTreads({
        stairConfig: sc, dims, colorConfig: cc, parentGroup: g,
        numTreads: ld.treadsBeforeLanding, numRisers: ld.risersBeforeLanding,
        risePerStep: rps, treadDepthFt: tdf, stairWidthFt: sw,
        startY: st.deckHeight, dirZ: -1, dirX: 0, originX: 0, originZ: 0, flightLabel: 'f1'
    });
    buildFlightStringers({
        parentGroup: g, stairWidthFt: sw, riseFt: rise1, runFt: ld.run1Feet,
        startY: st.deckHeight, dirZ: -1, dirX: 0, originX: 0, originZ: 0, flightLabel: 'f1'
    });

    // Landing: centered at Z = -(run1 + landingDepth/2), X = 0
    const landingCenterZ = -(ld.run1Feet + ld.landingDepthFeet / 2);
    buildLanding({
        parentGroup: g, colorConfig: cc,
        stairWidthFt: sw,
        landingDepthFt: ld.landingDepthFeet,
        landingY,
        centerZ: landingCenterZ,
        turnSign: sign,
        run2Ft: ld.run2Feet
    });
    buildLandingRiser({
        parentGroup: g, colorConfig: cc,
        stairWidthFt: sw, risePerStep: rps,
        landingY, riserZ: -ld.run1Feet
    });

    // Flight 2: runs in sign*X direction from the far edge of the landing
    const ox = 0, oz = -(ld.run1Feet + ld.landingDepthFeet);
    buildFlightTreads({
        stairConfig: sc, dims, colorConfig: cc, parentGroup: g,
        numTreads: ld.treadsAfterLanding,
        numRisers: dims.numRisers - ld.risersBeforeLanding,
        risePerStep: rps, treadDepthFt: tdf, stairWidthFt: sw,
        startY: landingY, dirZ: 0, dirX: sign, originX: ox, originZ: oz, flightLabel: 'f2'
    });
    buildFlightStringers({
        parentGroup: g, stairWidthFt: sw, riseFt: rise2, runFt: ld.run2Feet,
        startY: landingY, dirZ: 0, dirX: sign, originX: ox, originZ: oz, flightLabel: 'f2'
    });

    if (sc.includeHandrails) {
        buildFlightHandrails({
            parentGroup: g, stairWidthFt: sw, riseFt: rise1, runFt: ld.run1Feet,
            startY: st.deckHeight, originX: 0, originZ: 0, dirZ: -1, dirX: 0, flightLabel: 'f1'
        });
        buildFlightHandrails({
            parentGroup: g, stairWidthFt: sw, riseFt: rise2, runFt: ld.run2Feet,
            startY: landingY, originX: ox, originZ: oz, dirZ: 0, dirX: sign, flightLabel: 'f2'
        });
    }
}

function buildFlightTreads(p) {
    const bwf = CONFIG.boards.width/12, btf = CONFIG.boards.thickness/12, gf = CONFIG.boards.gap/12;
    const runsX = Math.abs(p.dirX) > 0.5;
    const bl = selectOptimalBoardLength(p.stairWidthFt);
    for (let step = 0; step < p.numTreads; step++) {
        const sY = p.startY - (step+1) * p.risePerStep;
        const ro = (step+1) * p.treadDepthFt;
        const cx = p.originX + p.dirX * (ro - p.treadDepthFt/2);
        const cz = p.originZ + p.dirZ * (ro - p.treadDepthFt/2);
        for (let b = 0; b < p.dims.boardsPerTread; b++) {
            const bo = -p.treadDepthFt/2 + b*(bwf+gf) + bwf/2;
            const mat = createBoardMaterial(p.colorConfig, bl, false, `tr_${p.flightLabel}_${step}_${b}`);
            const geom = runsX
                ? new THREE.BoxGeometry(bwf, btf, p.stairWidthFt)
                : new THREE.BoxGeometry(p.stairWidthFt, btf, bwf);
            const m = new THREE.Mesh(geom, mat);
            m.position.set(cx + p.dirX*bo, sY + btf/2, cz + p.dirZ*bo);
            m.castShadow = m.receiveShadow = true;
            p.parentGroup.add(m);
        }
        const rx = p.originX + p.dirX * ro, rz = p.originZ + p.dirZ * ro;
        const rg = runsX
            ? new THREE.BoxGeometry(btf, p.risePerStep, p.stairWidthFt)
            : new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, btf);
        const rm = new THREE.Mesh(rg, createBoardMaterial(p.colorConfig, bl, false, `rs_${p.flightLabel}_${step}`));
        rm.position.set(rx, sY - p.risePerStep/2 + btf, rz);
        rm.castShadow = true;
        p.parentGroup.add(rm);
    }
}

function buildFlightStringers(p) {
    const sLen  = Math.sqrt(p.riseFt*p.riseFt + p.runFt*p.runFt);
    const angle = Math.atan2(p.riseFt, p.runFt);
    const runsX = Math.abs(p.dirX) > 0.5;
    const mat   = stringerMat();
    getStringerPositions(p.stairWidthFt).forEach(({ lat, yOffset }) => {
        const g = new THREE.BoxGeometry(ST.th, ST.w, sLen);
        const m = new THREE.Mesh(g, mat);
        const cy = p.startY - p.riseFt/2 + yOffset;
        const rH = p.runFt/2;
        if (runsX) {
            // lat offsets Z for runsX flights
            m.position.set(p.originX + p.dirX*rH, cy, p.originZ + lat);
            m.rotation.z = p.dirX * angle;
            m.rotation.y = Math.PI/2;
        } else {
            // lat offsets X for runsZ flights
            m.position.set(p.originX + lat, cy, p.originZ + p.dirZ*rH);
            m.rotation.x = p.dirZ * angle;
        }
        m.castShadow = true;
        p.parentGroup.add(m);
    });
}

function buildFlightHandrails(p) {
    const mat = handrailMat();
    const pH=3, pSz=0.29, rH=0.29, rTh=0.125, bSz=0.125, bSp=0.33, bOff=0.25;
    const fLen  = Math.sqrt(p.riseFt*p.riseFt + p.runFt*p.runFt);
    const angle = Math.atan2(p.riseFt, p.runFt);
    const runsX = Math.abs(p.dirX) > 0.5;

    [-1, 1].forEach(side => {
        const lat = side * p.stairWidthFt / 2;
        // lat always offsets the axis perpendicular to travel:
        // runsX flights travel in X => perpendicular is Z => lat goes to Z
        // runsZ flights travel in Z => perpendicular is X => lat goes to X
        const lx = runsX ? p.originX       : p.originX + lat;
        const lz = runsX ? p.originZ + lat : p.originZ;

        const mkPost = (px, py, pz) => {
            const pm = new THREE.Mesh(new THREE.BoxGeometry(pSz, pH, pSz), mat);
            pm.position.set(px, py, pz);
            pm.castShadow = true;
            p.parentGroup.add(pm);
        };

        const endY = p.startY - p.riseFt;
        if (runsX) {
            mkPost(p.originX,                    p.startY + pH/2, lz);
            mkPost(p.originX + p.dirX*p.runFt,   endY    + pH/2, lz);
        } else {
            mkPost(lx, p.startY + pH/2, p.originZ);
            mkPost(lx, endY    + pH/2, p.originZ + p.dirZ*p.runFt);
        }

        const midY = p.startY + pH - rH/2 - p.riseFt/2;
        const rg = new THREE.BoxGeometry(rTh, rH, fLen);
        [midY, midY - (pH - bOff - rH)].forEach(ry => {
            const rail = new THREE.Mesh(rg.clone(), mat);
            if (runsX) {
                rail.position.set(p.originX + p.dirX*p.runFt/2, ry, lz);
                rail.rotation.z = p.dirX * angle;
                rail.rotation.y = Math.PI/2;
            } else {
                rail.position.set(lx, ry, p.originZ + p.dirZ*p.runFt/2);
                rail.rotation.x = p.dirZ * angle;
            }
            rail.castShadow = true;
            p.parentGroup.add(rail);
        });

        const nb = Math.floor(p.runFt / bSp);
        const bH = pH - rH - bOff - rH;
        for (let b = 1; b < nb; b++) {
            const t  = b / nb;
            const by = p.startY - t*p.riseFt + bOff + rH + bH/2;
            const bal = new THREE.Mesh(new THREE.BoxGeometry(bSz, bH, bSz), mat);
            if (runsX) bal.position.set(p.originX + p.dirX*t*p.runFt, by, lz);
            else       bal.position.set(lx, by, p.originZ + p.dirZ*t*p.runFt);
            bal.castShadow = true;
            p.parentGroup.add(bal);
        }
    });
}

function buildLanding(p) {
    const bwf = CONFIG.boards.width/12, btf = CONFIG.boards.thickness/12, gf = CONFIG.boards.gap/12;
    // Landing width = stair width only; depth = configured landing depth
    const pw = p.stairWidthFt;
    const pd = p.landingDepthFt;
    const ew = bwf + gf;
    const nr = Math.ceil(pd / ew);
    const bl = selectOptimalBoardLength(pw);

    for (let r = 0; r < nr; r++) {
        const zo = -pd/2 + r*ew + bwf/2;
        const m = new THREE.Mesh(
            new THREE.BoxGeometry(pw, btf, bwf),
            createBoardMaterial(p.colorConfig, bl, false, `lp_${r}`)
        );
        // Landing boards are centered at X=0, positioned along Z
        m.position.set(0, p.landingY + btf/2, p.centerZ + zo);
        m.castShadow = m.receiveShadow = true;
        p.parentGroup.add(m);
    }

    if (p.landingY <= 0) return;
    const pm = stringerMat(), pg = new THREE.BoxGeometry(0.33, p.landingY, 0.33);
    [
        [-pw/2, -pd/2],
        [ pw/2, -pd/2],
        [ pw/2,  pd/2],
        [-pw/2,  pd/2]
    ].forEach(([fx, fz]) => {
        const post = new THREE.Mesh(pg, pm);
        post.position.set(fx, p.landingY/2, p.centerZ + fz);
        post.castShadow = true;
        p.parentGroup.add(post);
    });
}

function buildLandingRiser(p) {
    const btf = CONFIG.boards.thickness/12;
    const bl  = selectOptimalBoardLength(p.stairWidthFt);
    const m   = new THREE.Mesh(
        new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, btf),
        createBoardMaterial(p.colorConfig, bl, false, 'lr')
    );
    m.position.set(0, p.landingY - p.risePerStep/2 + btf, p.riserZ);
    m.castShadow = true;
    p.parentGroup.add(m);
}

function calcLShape(nr, nt, ar, td, dir, ldFt, ls) {
    const ldf   = typeof ldFt === 'number' ? ldFt : CONFIG.stairs.landingDepth;
    const split = typeof ls   === 'number' ? ls   : 0.5;
    let tbl = Math.max(1, Math.round(nt * split));
    if (tbl >= nt) tbl = nt - 1;
    const tal = nt - tbl, rbl = tbl + 1;
    return {
        treadsBeforeLanding:  tbl,
        treadsAfterLanding:   tal,
        risersBeforeLanding:  rbl,
        risersAfterLanding:   nr - rbl,
        landingDepthFeet:     ldf,
        landingDepthInches:   ldf * 12,
        run1Feet:             (tbl * td) / 12,
        run2Feet:             (tal * td) / 12,
        run1Inches:           tbl * td,
        run2Inches:           tal * td,
        heightAtLanding:      rbl * ar,
        turnDirection:        dir,
        landingSplit:         split
    };
}
