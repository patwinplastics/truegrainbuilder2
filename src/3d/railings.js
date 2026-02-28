// ============================================================
// TrueGrain Deck Builder 2 — Railing System
// ============================================================

export function createDetailedRailings(deckGroup, state) {
    const ph=3, ps=0.29, rh=0.29, rt=0.125, bs=0.125, bsp=0.33, bro=0.25;
    const wh  = state.deckHeight;
    const mat = new THREE.MeshStandardMaterial({color:0xFFFFFF,roughness:0.6});
    const pg  = new THREE.BoxGeometry(ps,ph,ps);
    const bh  = ph - rh - bro;
    const bg  = new THREE.BoxGeometry(bs,bh,bs);

    const posts = [
        [-state.deckLength/2,-state.deckWidth/2],
        [ state.deckLength/2,-state.deckWidth/2],
        [ state.deckLength/2, state.deckWidth/2],
        [-state.deckLength/2, state.deckWidth/2]
    ];
    for (let x=-state.deckLength/2+6; x<state.deckLength/2; x+=6)
        posts.push([x,-state.deckWidth/2],[x,state.deckWidth/2]);
    for (let z=-state.deckWidth/2+6; z<state.deckWidth/2; z+=6)
        posts.push([-state.deckLength/2,z],[state.deckLength/2,z]);

    posts.forEach(([x,z]) => {
        const p=new THREE.Mesh(pg,mat);
        p.position.set(x, wh+ph/2, z); p.castShadow=true; deckGroup.add(p);
    });

    const topY  = wh+ph-rh/2;
    const botY  = wh+bro+rh/2;
    const balY  = wh+bro+rh+bh/2;

    const sides = [
        {s:[-state.deckLength/2,-state.deckWidth/2], e:[state.deckLength/2,-state.deckWidth/2], len:state.deckLength, x:true},
        {s:[ state.deckLength/2,-state.deckWidth/2], e:[state.deckLength/2, state.deckWidth/2], len:state.deckWidth,  x:false},
        {s:[ state.deckLength/2, state.deckWidth/2], e:[-state.deckLength/2,state.deckWidth/2], len:state.deckLength, x:true},
        {s:[-state.deckLength/2, state.deckWidth/2], e:[-state.deckLength/2,-state.deckWidth/2],len:state.deckWidth,  x:false}
    ];
    sides.forEach(({s,e,len,x:isX}) => {
        const cx=(s[0]+e[0])/2, cz=(s[1]+e[1])/2;
        [topY,botY].forEach(ry => {
            const r=new THREE.Mesh(new THREE.BoxGeometry(isX?len:rt,rh,isX?rt:len),mat);
            r.position.set(cx,ry,cz); r.castShadow=true; deckGroup.add(r);
        });
        const n=Math.floor(len/bsp);
        for (let i=1;i<n;i++) {
            const t=i/n;
            const b=new THREE.Mesh(bg,mat);
            b.position.set(s[0]+t*(e[0]-s[0]), balY, s[1]+t*(e[1]-s[1]));
            b.castShadow=true; deckGroup.add(b);
        }
    });
}
