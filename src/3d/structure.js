// ============================================================
// TrueGrain Deck Builder 2 — Structural Elements
// Ground, support posts, joists, fascia
// Joists/posts use a procedural PT lumber texture — no assets needed.
// ============================================================
import { BOARD_PROFILE } from './board-profile.js';

// ============================================================
// Procedural PT Lumber Texture
// Baked once to a canvas, cached as a THREE.CanvasTexture.
// Simulates the greenish-gray weathered look of pressure-treated
// 2x8 framing lumber with visible grain lines and occasional knots.
// ============================================================
let _ptTexture = null;

function getPTTexture() {
    if (_ptTexture) return _ptTexture;

    const SIZE = 512;
    const c   = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d');

    // ── Base color: weathered PT green-gray ────────────────────
    ctx.fillStyle = '#7a8c6a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ── Grain lines running along the length ─────────────────
    // Fine parallel lines with slight waviness = wood grain
    for (let i = 0; i < 120; i++) {
        const x     = Math.random() * SIZE;
        const light = Math.random() > 0.5;
        ctx.strokeStyle = light
            ? `rgba(200,210,175,${0.08 + Math.random() * 0.14})`
            : `rgba(40,55,30,${0.06 + Math.random() * 0.12})`;
        ctx.lineWidth = 0.5 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        // Slight wave along the grain
        for (let y = 0; y < SIZE; y += 8) {
            ctx.lineTo(x + (Math.random() - 0.5) * 2.5, y);
        }
        ctx.stroke();
    }

    // ── Growth ring bands ────────────────────────────────
    // Slightly darker horizontal bands spaced like annual rings
    for (let i = 0; i < 8; i++) {
        const y = Math.random() * SIZE;
        const h = 4 + Math.random() * 12;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, 'rgba(30,45,20,0)');
        g.addColorStop(0.5, `rgba(30,45,20,${0.08 + Math.random() * 0.1})`);
        g.addColorStop(1, 'rgba(30,45,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y, SIZE, h);
    }

    // ── Knots (1–3 per board face) ─────────────────────────
    const numKnots = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < numKnots; k++) {
        const kx = SIZE * 0.2 + Math.random() * SIZE * 0.6;
        const ky = SIZE * 0.2 + Math.random() * SIZE * 0.6;
        const kr = 8 + Math.random() * 14;

        // Outer dark ring
        const kg = ctx.createRadialGradient(kx, ky, kr * 0.3, kx, ky, kr * 1.4);
        kg.addColorStop(0, 'rgba(50,35,20,0.7)');
        kg.addColorStop(0.6, 'rgba(50,35,20,0.3)');
        kg.addColorStop(1, 'rgba(50,35,20,0)');
        ctx.fillStyle = kg;
        ctx.beginPath();
        ctx.ellipse(kx, ky, kr * 1.4, kr, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner dark center
        const ki = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr * 0.5);
        ki.addColorStop(0, 'rgba(30,20,10,0.85)');
        ki.addColorStop(1, 'rgba(30,20,10,0)');
        ctx.fillStyle = ki;
        ctx.beginPath();
        ctx.ellipse(kx, ky, kr * 0.5, kr * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Grain lines bending around knot
        for (let r = 0; r < 20; r++) {
            const angle = (r / 20) * Math.PI * 2;
            const rx = kx + Math.cos(angle) * (kr * 1.8);
            const ry = ky + Math.sin(angle) * (kr * 0.9);
            ctx.strokeStyle = 'rgba(30,20,10,0.12)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(rx, 0);
            ctx.quadraticCurveTo(kx + Math.cos(angle) * kr, ky, rx, SIZE);
            ctx.stroke();
        }
    }

    // ── Surface variation / slight moisture staining ───────────
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * SIZE, y = Math.random() * SIZE;
        const r = 15 + Math.random() * 40;
        const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
        const dark = Math.random() > 0.6;
        sg.addColorStop(0, dark ? 'rgba(20,35,15,0.12)' : 'rgba(160,185,130,0.1)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4; // improved sharpness before renderer sets max
    _ptTexture = tex;
    return tex;
}

// ============================================================
// PT Lumber material — shared across all structural members
// ============================================================
let _ptMat = null;

function getPTMaterial() {
    if (_ptMat) return _ptMat;
    _ptMat = new THREE.MeshStandardMaterial({
        map:      getPTTexture(),
        color:    new THREE.Color(1, 1, 1), // let texture drive color
        roughness: 0.88,
        metalness: 0.0,
        envMapIntensity: 0.2,
    });
    return _ptMat;
}

// ============================================================
// Scene elements
// ============================================================

export function createRealisticGrass(scene) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4a7c23';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 15000; i++) {
        const x = Math.random()*512, y = Math.random()*512, l = 3+Math.random()*8;
        ctx.strokeStyle = `hsl(${80+Math.random()*40},60%,${25+Math.random()*25}%)`;
        ctx.lineWidth = 0.5 + Math.random();
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(Math.random()-.5)*3,y-l); ctx.stroke();
    }
    for (let i = 0; i < 90; i++) {
        const x=Math.random()*512,y=Math.random()*512,r=10+Math.random()*30,dark=i<50;
        const g = ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0, dark?'rgba(30,60,15,.3)':'rgba(120,180,60,.25)');
        g.addColorStop(1, dark?'rgba(30,60,15,0)' :'rgba(120,180,60,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8,8);
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(150,150),
        new THREE.MeshStandardMaterial({map:tex,roughness:0.9,metalness:0})
    );
    ground.rotation.x = -Math.PI/2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);
}

export function createSupportPosts(deckGroup, state) {
    const ps = 0.33, ph = state.deckHeight;
    if (ph <= 0) return;
    const mat  = getPTMaterial();
    const geom = new THREE.BoxGeometry(ps, ph, ps);
    const pos  = [
        [-state.deckLength/2+ps/2, -state.deckWidth/2+ps/2],
        [ state.deckLength/2-ps/2, -state.deckWidth/2+ps/2],
        [ state.deckLength/2-ps/2,  state.deckWidth/2-ps/2],
        [-state.deckLength/2+ps/2,  state.deckWidth/2-ps/2]
    ];
    for (let i=1; i<Math.floor(state.deckLength/6); i++) {
        const x = -state.deckLength/2 + i*6;
        pos.push([x, -state.deckWidth/2+ps/2], [x, state.deckWidth/2-ps/2]);
    }
    for (let i=1; i<Math.floor(state.deckWidth/6); i++) {
        const z = -state.deckWidth/2 + i*6;
        pos.push([-state.deckLength/2+ps/2, z], [state.deckLength/2-ps/2, z]);
    }
    pos.forEach(([x, z]) => {
        const m = new THREE.Mesh(geom, mat);
        m.position.set(x, ph/2, z);
        m.castShadow    = true;
        m.receiveShadow = true;
        deckGroup.add(m);
    });
}

export function createJoists(deckGroup, state) {
    const jw   = 1.5/12, jh = 7.5/12, sp = state.joistSpacing/12;
    const byLen = state.boardDirection === 'length';
    const jLen  = byLen ? state.deckWidth  : state.deckLength;
    const jSpan = byLen ? state.deckLength : state.deckWidth;
    const mat   = getPTMaterial();
    const geom  = new THREE.BoxGeometry(byLen ? jw : jLen, jh, byLen ? jLen : jw);
    const jY    = state.deckHeight - jh/2;
    const n     = Math.floor(jSpan / sp) + 1;

    for (let i = 0; i < n; i++) {
        const p = (i * sp) - jSpan/2;
        const j = new THREE.Mesh(geom, mat);
        j.position.set(byLen ? p : 0, jY, byLen ? 0 : p);
        j.castShadow    = true;
        j.receiveShadow = true;
        deckGroup.add(j);
    }

    // Rim joists
    const rimG = new THREE.BoxGeometry(
        byLen ? jw : state.deckLength,
        jh,
        byLen ? state.deckWidth : jw
    );
    [-1, 1].forEach(s => {
        const r = new THREE.Mesh(rimG, mat);
        r.position.set(byLen ? s*jSpan/2 : 0, jY, byLen ? 0 : s*jSpan/2);
        r.castShadow    = true;
        r.receiveShadow = true;
        deckGroup.add(r);
    });
}

export function createWhiteFascia(deckGroup, state) {
    const bt  = BOARD_PROFILE.thicknessFt;
    const h   = 7.5/12 + bt;
    const t   = 1/12;
    const y   = state.deckHeight + bt - h/2;
    const mat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 });
    [
        [state.deckLength, h, t,                    0, y, -state.deckWidth/2 - t/2],
        [state.deckLength, h, t,                    0, y,  state.deckWidth/2 + t/2],
        [t, h, state.deckWidth+t*2,  -state.deckLength/2 - t/2, y, 0],
        [t, h, state.deckWidth+t*2,   state.deckLength/2 + t/2, y, 0]
    ].forEach(([w, ht, d, x, fy, z]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), mat);
        m.position.set(x, fy, z);
        m.castShadow = true;
        deckGroup.add(m);
    });
}
