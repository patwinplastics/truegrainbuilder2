// ============================================================
// TrueGrain Deck Builder 2 — Structural Elements
// Ground, support posts, joists, fascia
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
    const mat  = new THREE.MeshStandardMaterial({color:0x8B7355,roughness:0.9});
    const geom = new THREE.BoxGeometry(ps,ph,ps);
    const pos  = [
        [-state.deckLength/2+ps/2,-state.deckWidth/2+ps/2],
        [ state.deckLength/2-ps/2,-state.deckWidth/2+ps/2],
        [ state.deckLength/2-ps/2, state.deckWidth/2-ps/2],
        [-state.deckLength/2+ps/2, state.deckWidth/2-ps/2]
    ];
    for (let i=1;i<Math.floor(state.deckLength/6);i++) {
        const x=-state.deckLength/2+i*6;
        pos.push([x,-state.deckWidth/2+ps/2],[x,state.deckWidth/2-ps/2]);
    }
    for (let i=1;i<Math.floor(state.deckWidth/6);i++) {
        const z=-state.deckWidth/2+i*6;
        pos.push([-state.deckLength/2+ps/2,z],[state.deckLength/2-ps/2,z]);
    }
    pos.forEach(([x,z]) => {
        const m=new THREE.Mesh(geom,mat);
        m.position.set(x,ph/2,z); m.castShadow=true; m.receiveShadow=true;
        deckGroup.add(m);
    });
}

export function createJoists(deckGroup, state) {
    const jw=1.5/12, jh=7.5/12, sp=state.joistSpacing/12;
    const byLen  = state.boardDirection==='length';
    const jLen   = byLen ? state.deckWidth  : state.deckLength;
    const jSpan  = byLen ? state.deckLength : state.deckWidth;
    const mat    = new THREE.MeshStandardMaterial({color:0x8B7355,roughness:0.9});
    const geom   = new THREE.BoxGeometry(byLen?jw:jLen, jh, byLen?jLen:jw);
    const jY     = state.deckHeight - jh/2;
    const n      = Math.floor(jSpan/sp)+1;
    for (let i=0;i<n;i++) {
        const p=(i*sp)-jSpan/2;
        const j=new THREE.Mesh(geom,mat);
        j.position.set(byLen?p:0, jY, byLen?0:p);
        j.castShadow=true; deckGroup.add(j);
    }
    const rimG = new THREE.BoxGeometry(byLen?jw:state.deckLength, jh, byLen?state.deckWidth:jw);
    [-1,1].forEach(s => {
        const r=new THREE.Mesh(rimG,mat);
        r.position.set(byLen?s*jSpan/2:0, jY, byLen?0:s*jSpan/2);
        r.castShadow=true; deckGroup.add(r);
    });
}

export function createWhiteFascia(deckGroup, state) {
    const h=7.5/12, t=1/12, y=state.deckHeight-h/2;
    const mat=new THREE.MeshStandardMaterial({color:0xFFFFFF,roughness:0.6});
    [
        [state.deckLength,h,t,          0,y,-state.deckWidth/2-t/2],
        [state.deckLength,h,t,          0,y, state.deckWidth/2+t/2],
        [t,h,state.deckWidth+t*2, -state.deckLength/2-t/2,y,0],
        [t,h,state.deckWidth+t*2,  state.deckLength/2+t/2,y,0]
    ].forEach(([w,ht,d,x,fy,z]) => {
        const m=new THREE.Mesh(new THREE.BoxGeometry(w,ht,d),mat);
        m.position.set(x,fy,z); m.castShadow=true; deckGroup.add(m);
    });
}
