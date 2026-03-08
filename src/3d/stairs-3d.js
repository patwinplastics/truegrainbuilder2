// ============================================================
// TrueGrain Deck Builder 2 — Stair 3D Geometry
// v4.9 — stringer bottom is a true diagonal parallel to slope
//         bottomBackY = -(ST.w * diagLen / totalRunFt)  (~12" for 2x10)
//         back face only spans that short distance, not full rise
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
    ctx.fillStyle = '#a08060';
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 120; i++) {
        const x = Math.random() * SIZE;
        const light = Math.random() > 0.5;
        ctx.strokeStyle = light
            ? `rgba(220,200,160,${0.08 + Math.random()*0.14})`
            : `rgba(60,40,20,${0.06 + Math.random()*0.12})`;
        ctx.lineWidth = 0.5 + Math.random()*1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y < SIZE; y += 8) ctx.lineTo(x + (Math.random()-0.5)*2.5, y);
        ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
        const y = Math.random()*SIZE, h = 4 + Math.random()*12;
        const g = ctx.createLinearGradient(0,y,0,y+h);
        g.addColorStop(0,'rgba(50,30,10,0)');
        g.addColorStop(0.5,`rgba(50,30,10,${0.08+Math.random()*0.1})`);
        g.addColorStop(1,'rgba(50,30,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0,y,SIZE,h);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
}

const stringerMat = () => {
    if (!materialCache['_stringer'])
        materialCache['_stringer'] = new THREE.MeshStandardMaterial({
            map: buildPTTexture(),
            color: new THREE.Color(1,1,1),
            roughness: 0.88,
            metalness: 0.0,
            envMapIntensity: 0.2
        });
    return materialCache['_stringer'];
};

const handrailMat = () => {
    if (!materialCache['_handrail'])
        materialCache['_handrail'] = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF, roughness: 0.6
        });
    return materialCache['_handrail'];
};

// ============================================================
// Stringer position table
// ============================================================
function getStringerPositions(stairWidthFt) {
    const sideL = -stairWidthFt / 2 + ST.in;
    const sideR =  stairWidthFt / 2 - ST.in;

    if (stairWidthFt < (CONFIG.stairs.centerStringerMinWidth ?? 3))
        return [ { lat: sideL }, { lat: sideR } ];

    if (stairWidthFt < (CONFIG.stairs.doubleCenterStringerMinWidth ?? 6))
        return [ { lat: sideL }, { lat: 0 }, { lat: sideR } ];

    const t = stairWidthFt / 3;
    return [
        { lat: sideL },
        { lat: -stairWidthFt/2 + t },
        { lat: -stairWidthFt/2 + t*2 },
        { lat: sideR }
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
    const dx=x2-x1, dy=y2-y1, dz=z2-z1;
    const len = Math.sqrt(dx*dx+dy*dy+dz*dz);
    if (len < 0.01) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness,thickness,len), mat);
    mesh.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);
    mesh.lookAt(x2,y2,z2);
    mesh.castShadow = true;
    parent.add(mesh);
}

function buildRailingSegment(parent, mat, x1, z1, x2, z2, surfY) {
    const edgeLen = Math.sqrt((x2-x1)**2+(z2-z1)**2);
    if (edgeLen < 0.01) return;
    addBox(parent,mat,RAIL.POST_SZ,RAIL.H,RAIL.POST_SZ,x1,surfY+RAIL.H/2,z1);
    addBox(parent,mat,RAIL.POST_SZ,RAIL.H,RAIL.POST_SZ,x2,surfY+RAIL.H/2,z2);
    makeBar(parent,mat,x1,surfY+RAIL.H,z1,x2,surfY+RAIL.H,z2,RAIL.TH);
    makeBar(parent,mat,x1,surfY+RAIL.BOT,z1,x2,surfY+RAIL.BOT,z2,RAIL.TH);
    const balH = RAIL.H-RAIL.BOT;
    const nBal = Math.max(1,Math.floor(edgeLen/RAIL.BAL_SP));
    for (let b=1; b<nBal; b++) {
        const t=b/nBal;
        addBox(parent,mat,RAIL.BAL_SZ,balH,RAIL.BAL_SZ,
            x1+(x2-x1)*t, surfY+RAIL.BOT+balH/2, z1+(z2-z1)*t);
    }
}

// ============================================================
// Notched stringer
//
// 2D shape coordinate system:
//   u (local X) = run direction, positive away from deck
//   v (local Y) = vertical, positive up / negative down
//   origin (0,0) = top-back corner at deck surface
//
// Top edge (notched):
//   (0,0) → initial plumb cut → seat+plumb per tread → foot (totalRunFt, -totalRiseFt)
//
// Bottom edge (DIAGONAL, parallel to slope):
//   The board has width ST.w (e.g. 9.25" for 2x10), measured perpendicular
//   to the stringer's slope. Projecting that onto the vertical back face gives:
//
//     bottomBackY = -(ST.w * diagLen / totalRunFt)
//                 = -(ST.w / cos(slopeAngle))
//
//   For a typical 7" rise / 10" run stair this is about -11.7" — one board
//   width below the origin. The bottom edge is then a single diagonal line
//   from the foot (totalRunFt, -totalRiseFt) back to (0, bottomBackY).
//   The back face closes vertically from (0, bottomBackY) up to (0, 0).
//
//   This produces a proper notched-board silhouette with NO filled wedge
//   and NO solid slab reaching the ground.
// ============================================================
function buildNotchedStringer(
    parent, mat,
    originX, originZ, startY,
    lat,
    numTreads, risePerStepFt, treadDepthFt,
    dirX, dirZ
) {
    const totalRiseFt = (numTreads + 1) * risePerStepFt;
    const totalRunFt  = numTreads * treadDepthFt;
    const runsX = Math.abs(dirX) > 0.5;

    // Diagonal length of the stringer (hypotenuse of rise/run triangle)
    const diagLen     = Math.sqrt(totalRunFt * totalRunFt + totalRiseFt * totalRiseFt);
    // Vertical distance from origin to board bottom on the back face
    // = board width (ST.w) divided by cos(slope) = ST.w * diagLen / totalRunFt
    const bottomBackY = -(ST.w * diagLen / totalRunFt);

    // ---- 2D notched top profile ----------------------------
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);                       // top-back corner
    shape.lineTo(0, -risePerStepFt);          // initial plumb cut

    for (let i = 0; i < numTreads; i++) {
        const u = (i + 1) * treadDepthFt;
        const v = -(i + 1) * risePerStepFt;
        shape.lineTo(u, v);               // seat cut (horizontal)
        shape.lineTo(u, v - risePerStepFt); // plumb cut (vertical)
    }
    // Now at foot: (totalRunFt, -totalRiseFt)

    // ---- Bottom edge: diagonal from foot back to back face -
    // This line is parallel to the overall stringer slope.
    // It represents the underside of the board — NOT the ground.
    shape.lineTo(0, bottomBackY);             // diagonal bottom (one board-width deep)
    shape.lineTo(0, 0);                       // back face (short: only ~12" for 2x10)

    // ---- Extrude laterally (thickness = ST.th = 1.5") ------
    const geom = new THREE.ExtrudeGeometry(shape, { depth: ST.th, bevelEnabled: false });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;

    // ---- Rotate so shape-X aligns with run direction -------
    if (runsX) {
        if (dirX < 0) mesh.rotation.y = Math.PI;
    } else {
        mesh.rotation.y = (dirZ < 0) ? Math.PI / 2 : -Math.PI / 2;
    }

    // ---- World position ------------------------------------
    if (runsX) {
        mesh.position.set(
            originX,
            startY,
            originZ + lat - ST.th / 2
        );
    } else {
        mesh.position.set(
            originX + lat - ST.th / 2,
            startY,
            originZ
        );
    }

    parent.add(mesh);
}

// ============================================================
// buildFlightStringers
// ============================================================
function buildFlightStringers(p) {
    const mat = stringerMat();
    getStringerPositions(p.stairWidthFt).forEach(({ lat }) => {
        buildNotchedStringer(
            p.parentGroup, mat,
            p.originX, p.originZ,
            p.startY,
            lat,
            p.numTreads,
            p.risePerStepFt,
            p.runFt / p.numTreads,
            p.dirX, p.dirZ
        );
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
    const p    = stair.position || 0.5;
    const edge = stair.edge || 'front';
    let x=0, z=0, rotY=0;
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
    const hi  = st.deckHeight * 12;
    const tgt = CONFIG.stairs.riserHeight.target;
    let nr = Math.max(1, Math.round(hi/tgt));
    let ar = hi/nr;
    if (ar > CONFIG.stairs.riserHeight.max)      { nr=Math.ceil(hi/CONFIG.stairs.riserHeight.max); ar=hi/nr; }
    else if (ar < CONFIG.stairs.riserHeight.min) { nr=Math.max(1,Math.floor(hi/CONFIG.stairs.riserHeight.min)); ar=hi/nr; }
    const nt   = nr - 1;
    const bpt  = sc.boardsPerTread || CONFIG.stairs.boardsPerTread.default;
    const td   = bpt*CONFIG.boards.width + (bpt-1)*CONFIG.boards.gap;
    const swFt = sc.width || CONFIG.stairs.defaultWidth;
    const lsd  = sc.shape === 'l-shaped'
        ? calcLShape(nr,nt,ar,td,sc.turnDirection||'left',sc.landingStepNumber,swFt)
        : null;
    return {
        numRisers: nr, numTreads: nt, actualRise: ar,
        treadDepth: td, totalRunFeet: (nt*td)/12,
        stairWidthFeet: swFt, boardsPerTread: bpt,
        deckHeightInches: hi, lShapedData: lsd,
        isValid: nt>=1 && ar>=CONFIG.stairs.riserHeight.min
    };
}

function calcLShape(nr, nt, ar, td, dir, landingStep, swFt) {
    let rbl=(typeof landingStep==='number' && landingStep>=1 && landingStep<nr)
        ? Math.round(landingStep)
        : Math.max(1,Math.round(nr/2));
    rbl=Math.min(rbl,nr-1);
    const tbl=rbl-1, tal=nt-tbl;
    return {
        treadsBeforeLanding:tbl, treadsAfterLanding:tal,
        risersBeforeLanding:rbl, risersAfterLanding:nr-rbl,
        landingSizeFeet:swFt,
        run1Feet:(tbl*td)/12, run2Feet:(tal*td)/12,
        heightAtLanding:rbl*ar,
        turnDirection:dir, landingStepNumber:rbl
    };
}

// ============================================================
// Straight stair
// ============================================================
function buildStraightStair(sc, dims, g, cc, st) {
    const fp = {
        stairConfig:sc, dims, colorConfig:cc, parentGroup:g,
        numTreads:dims.numTreads,
        risePerStep: dims.actualRise/12,
        treadDepthFt:dims.treadDepth/12,
        stairWidthFt:dims.stairWidthFeet,
        startY:st.deckHeight, dirZ:-1, dirX:0,
        originX:0, originZ:0, flightLabel:'str'
    };
    buildFlightTreads(fp);
    buildFlightStringers({
        parentGroup:g,
        stairWidthFt:dims.stairWidthFeet,
        numTreads:dims.numTreads,
        risePerStepFt: dims.actualRise/12,
        runFt:dims.totalRunFeet,
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
// L-Shaped stair
// ============================================================
function buildLShapedStair(sc, dims, g, cc, st) {
    const ld   = dims.lShapedData;
    const rps  = dims.actualRise/12;
    const tdf  = dims.treadDepth/12;
    const sw   = dims.stairWidthFeet;
    const sign = ld.turnDirection==='left' ? -1 : 1;
    const rise1 = ld.risersBeforeLanding * rps;
    const rise2 = ld.risersAfterLanding  * rps;
    const landingY       = st.deckHeight - rise1;
    const landingCenterZ = -(ld.run1Feet + sw/2);

    buildFlightTreads({
        stairConfig:sc, dims, colorConfig:cc, parentGroup:g,
        numTreads:ld.treadsBeforeLanding, risePerStep:rps,
        treadDepthFt:tdf, stairWidthFt:sw,
        startY:st.deckHeight, dirZ:-1, dirX:0,
        originX:0, originZ:0, flightLabel:'f1'
    });
    buildFlightStringers({
        parentGroup:g, stairWidthFt:sw,
        numTreads:ld.treadsBeforeLanding,
        risePerStepFt:rps,
        runFt:ld.run1Feet,
        startY:st.deckHeight, dirZ:-1, dirX:0, originX:0, originZ:0
    });

    buildLanding({parentGroup:g,colorConfig:cc,sizeFt:sw,landingY,centerX:0,centerZ:landingCenterZ});
    buildLandingRiser({parentGroup:g,colorConfig:cc,stairWidthFt:sw,risePerStep:rps,landingY,riserZ:-ld.run1Feet});
    buildLandingSideRiser({parentGroup:g,colorConfig:cc,stairWidthFt:sw,risePerStep:rps,landingY,landingCenterZ,riserX:sign*sw/2});

    const f2originX=sign*sw/2, f2originZ=landingCenterZ;
    buildFlightTreads({
        stairConfig:sc, dims, colorConfig:cc, parentGroup:g,
        numTreads:ld.treadsAfterLanding, risePerStep:rps,
        treadDepthFt:tdf, stairWidthFt:sw,
        startY:landingY, dirZ:0, dirX:sign,
        originX:f2originX, originZ:f2originZ, flightLabel:'f2'
    });
    buildFlightStringers({
        parentGroup:g, stairWidthFt:sw,
        numTreads:ld.treadsAfterLanding,
        risePerStepFt:rps,
        runFt:ld.run2Feet,
        startY:landingY, dirZ:0, dirX:sign,
        originX:f2originX, originZ:f2originZ
    });

    if (sc.includeHandrails) {
        buildFlightHandrails({parentGroup:g,stairWidthFt:sw,riseFt:rise1,runFt:ld.run1Feet,startY:st.deckHeight,originX:0,originZ:0,dirZ:-1,dirX:0});
        buildFlightHandrails({parentGroup:g,stairWidthFt:sw,riseFt:rise2,runFt:ld.run2Feet,startY:landingY,originX:f2originX,originZ:f2originZ,dirZ:0,dirX:sign});
        buildLandingRailings({parentGroup:g,landingY,sw,run1Feet:ld.run1Feet,sign});
    }
}

// ============================================================
// buildFlightTreads
// ============================================================
function buildFlightTreads(p) {
    const bw    = CONFIG.boards.width    /12;
    const bth   = CONFIG.boards.thickness/12;
    const gap   = CONFIG.boards.gap      /12;
    const runsX = Math.abs(p.dirX)>0.5;
    const bl    = selectOptimalBoardLength(p.stairWidthFt);
    const bpt   = p.dims.boardsPerTread;

    for (let step=0; step<p.numTreads; step++) {
        const treadY      = p.startY - (step+1)*p.risePerStep;
        const frontOffset = (step+1)*p.treadDepthFt;

        for (let b=0; b<bpt; b++) {
            const boardBack = b*(bw+gap)+bw/2;
            const travelPos = frontOffset-boardBack;
            const mat = createBoardMaterial(p.colorConfig,bl,false,`tr_${p.flightLabel}_${step}_${b}`);
            let mesh;
            if (runsX) {
                mesh = new THREE.Mesh(new THREE.BoxGeometry(bw,bth,p.stairWidthFt),mat);
                mesh.position.set(p.originX+p.dirX*travelPos, treadY+bth/2, p.originZ);
            } else {
                mesh = new THREE.Mesh(new THREE.BoxGeometry(p.stairWidthFt,bth,bw),mat);
                mesh.position.set(p.originX, treadY+bth/2, p.originZ+p.dirZ*travelPos);
            }
            mesh.castShadow = mesh.receiveShadow = true;
            p.parentGroup.add(mesh);
        }

        const riserMat = createBoardMaterial(p.colorConfig,bl,false,`rs_${p.flightLabel}_${step}`);
        const riserYc  = treadY - p.risePerStep/2 + bth;
        let riser;
        if (runsX) {
            riser = new THREE.Mesh(new THREE.BoxGeometry(bth,p.risePerStep,p.stairWidthFt),riserMat);
            riser.position.set(p.originX+p.dirX*frontOffset, riserYc, p.originZ);
        } else {
            riser = new THREE.Mesh(new THREE.BoxGeometry(p.stairWidthFt,p.risePerStep,bth),riserMat);
            riser.position.set(p.originX, riserYc, p.originZ+p.dirZ*frontOffset);
        }
        riser.castShadow = true;
        p.parentGroup.add(riser);
    }
}

// ============================================================
// buildFlightHandrails
// ============================================================
function buildFlightHandrails(p) {
    const mat   = handrailMat();
    const runsX = Math.abs(p.dirX)>0.5;
    const endY  = p.startY-p.riseFt;
    [-1,1].forEach(side => {
        const lat=side*p.stairWidthFt/2;
        let topX,topZ,botX,botZ;
        if (runsX) {
            topX=p.originX;                   topZ=p.originZ+lat;
            botX=p.originX+p.dirX*p.runFt;   botZ=p.originZ+lat;
        } else {
            topX=p.originX+lat; topZ=p.originZ;
            botX=p.originX+lat; botZ=p.originZ+p.dirZ*p.runFt;
        }
        addBox(p.parentGroup,mat,RAIL.POST_SZ,RAIL.H,RAIL.POST_SZ,topX,p.startY+RAIL.H/2,topZ);
        addBox(p.parentGroup,mat,RAIL.POST_SZ,RAIL.H,RAIL.POST_SZ,botX,endY+RAIL.H/2,botZ);
        makeBar(p.parentGroup,mat,topX,p.startY+RAIL.H,topZ,botX,endY+RAIL.H,botZ,RAIL.TH);
        makeBar(p.parentGroup,mat,topX,p.startY+RAIL.BOT,topZ,botX,endY+RAIL.BOT,botZ,RAIL.TH);
        const balH=RAIL.H-RAIL.BOT;
        const nBal=Math.max(1,Math.floor(p.runFt/RAIL.BAL_SP));
        for (let b=1; b<nBal; b++) {
            const t=b/nBal;
            const surfY=p.startY-t*p.riseFt;
            addBox(p.parentGroup,mat,RAIL.BAL_SZ,balH,RAIL.BAL_SZ,
                topX+(botX-topX)*t, surfY+RAIL.BOT+balH/2, topZ+(botZ-topZ)*t);
        }
    });
}

// ============================================================
// buildLandingRailings
// ============================================================
function buildLandingRailings(p) {
    const mat=handrailMat(), half=p.sw/2;
    buildRailingSegment(p.parentGroup,mat,-half,-(p.run1Feet+p.sw),half,-(p.run1Feet+p.sw),p.landingY);
    buildRailingSegment(p.parentGroup,mat,-p.sign*half,-p.run1Feet,-p.sign*half,-(p.run1Feet+p.sw),p.landingY);
}

// ============================================================
// buildLanding
// ============================================================
function buildLanding(p) {
    const bw  = CONFIG.boards.width    /12;
    const bth = CONFIG.boards.thickness/12;
    const gap = CONFIG.boards.gap      /12;
    const ew=bw+gap, nr=Math.ceil(p.sizeFt/ew);
    const bl=selectOptimalBoardLength(p.sizeFt);
    for (let r=0; r<nr; r++) {
        const zo=-p.sizeFt/2+r*ew+bw/2;
        const m=new THREE.Mesh(
            new THREE.BoxGeometry(p.sizeFt,bth,bw),
            createBoardMaterial(p.colorConfig,bl,false,`lp_${r}`)
        );
        m.position.set(p.centerX, p.landingY+bth/2, p.centerZ+zo);
        m.castShadow=m.receiveShadow=true;
        p.parentGroup.add(m);
    }
    if (p.landingY<=0.01) return;
    const pm=stringerMat(), half=p.sizeFt/2;
    [[-half,-half],[half,-half],[half,half],[-half,half]].forEach(([fx,fz]) => {
        const post=new THREE.Mesh(new THREE.BoxGeometry(0.33,p.landingY,0.33),pm);
        post.position.set(p.centerX+fx,p.landingY/2,p.centerZ+fz);
        post.castShadow=true;
        p.parentGroup.add(post);
    });
}

// ============================================================
// buildLandingRiser
// ============================================================
function buildLandingRiser(p) {
    const bth=CONFIG.boards.thickness/12;
    const bl=selectOptimalBoardLength(p.stairWidthFt);
    const m=new THREE.Mesh(
        new THREE.BoxGeometry(p.stairWidthFt,p.risePerStep,bth),
        createBoardMaterial(p.colorConfig,bl,false,'lr')
    );
    m.position.set(0,p.landingY-p.risePerStep/2+bth,p.riserZ);
    m.castShadow=true;
    p.parentGroup.add(m);
}

// ============================================================
// buildLandingSideRiser
// ============================================================
function buildLandingSideRiser(p) {
    const bth=CONFIG.boards.thickness/12;
    const bl=selectOptimalBoardLength(p.stairWidthFt);
    const m=new THREE.Mesh(
        new THREE.BoxGeometry(bth,p.risePerStep,p.stairWidthFt),
        createBoardMaterial(p.colorConfig,bl,false,'lr_side')
    );
    m.position.set(p.riserX,p.landingY-p.risePerStep/2+bth,p.landingCenterZ);
    m.castShadow=true;
    p.parentGroup.add(m);
}
