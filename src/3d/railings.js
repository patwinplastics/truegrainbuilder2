// ============================================================
// TrueGrain Deck Builder 2 — Railing System
// Creates railings on all 4 deck edges with gaps for stairs.
// ============================================================
import { CONFIG } from '../config.js';
import { BOARD_PROFILE } from './board-profile.js';

export function createDetailedRailings(deckGroup, state) {
    const ph = 3, ps = 0.29, rh = 0.29, rt = 0.125, bs = 0.125, bsp = 0.33, bro = 0.25;
    // Base Y from deck surface (top of boards), not joist level
    const wh  = state.deckHeight + BOARD_PROFILE.thicknessFt;
    const mat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.6 });
    const pg  = new THREE.BoxGeometry(ps, ph, ps);
    const bh  = ph - rh - bro;
    const bg  = new THREE.BoxGeometry(bs, bh, bs);
    const topY = wh + ph - rh / 2;
    const botY = wh + bro + rh / 2;
    const balY = wh + bro + rh + bh / 2;

    // Build stair gap info per edge
    const gaps = buildStairGaps(state);

    // Define the 4 edges
    const hL = state.deckLength / 2, hW = state.deckWidth / 2;
    const edges = [
        { name: 'back',  s: [-hL, -hW], e: [hL, -hW], len: state.deckLength, isX: true },
        { name: 'right', s: [hL, -hW],  e: [hL, hW],  len: state.deckWidth,  isX: false },
        { name: 'front', s: [hL, hW],   e: [-hL, hW], len: state.deckLength, isX: true },
        { name: 'left',  s: [-hL, hW],  e: [-hL, -hW], len: state.deckWidth, isX: false }
    ];

    edges.forEach(edge => {
        const edgeGaps = gaps.filter(g => g.edge === edge.name);
        const segments = splitEdgeByGaps(edge, edgeGaps);

        segments.forEach(seg => {
            // Corner posts at segment endpoints
            [seg.s, seg.e].forEach(([px, pz]) => {
                const post = new THREE.Mesh(pg, mat);
                post.position.set(px, wh + ph / 2, pz);
                post.castShadow = true;
                deckGroup.add(post);
            });

            // Intermediate posts every 6ft
            const segLen = Math.sqrt((seg.e[0] - seg.s[0]) ** 2 + (seg.e[1] - seg.s[1]) ** 2);
            if (segLen < 0.5) return; // skip tiny segments

            const dx = seg.e[0] - seg.s[0], dz = seg.e[1] - seg.s[1];
            const numPosts = Math.floor(segLen / 6);
            for (let i = 1; i <= numPosts; i++) {
                const t = (i * 6) / segLen;
                if (t >= 1) break;
                const ip = new THREE.Mesh(pg, mat);
                ip.position.set(seg.s[0] + dx * t, wh + ph / 2, seg.s[1] + dz * t);
                ip.castShadow = true;
                deckGroup.add(ip);
            }

            // Top and bottom rails
            const cx = (seg.s[0] + seg.e[0]) / 2, cz = (seg.s[1] + seg.e[1]) / 2;
            [topY, botY].forEach(ry => {
                const rail = new THREE.Mesh(
                    new THREE.BoxGeometry(edge.isX ? segLen : rt, rh, edge.isX ? rt : segLen),
                    mat
                );
                rail.position.set(cx, ry, cz);
                rail.castShadow = true;
                deckGroup.add(rail);
            });

            // Balusters
            const numBals = Math.floor(segLen / bsp);
            for (let i = 1; i < numBals; i++) {
                const t = i / numBals;
                const bal = new THREE.Mesh(bg, mat);
                bal.position.set(
                    seg.s[0] + dx * t,
                    balY,
                    seg.s[1] + dz * t
                );
                bal.castShadow = true;
                deckGroup.add(bal);
            }
        });
    });
}

// Build gap definitions from stair data
function buildStairGaps(state) {
    if (!state.stairsEnabled || !state.stairs?.length) return [];
    const gaps = [];
    const margin = 0.25; // extra gap on each side of stair width
    state.stairs.forEach(stair => {
        if (!stair.enabled) return;
        const sw = (stair.width || CONFIG.stairs.defaultWidth) + margin * 2;
        const pos = stair.position || 0.5;
        const edge = stair.edge || 'front';
        let center;
        switch (edge) {
            case 'front': case 'back':
                center = (pos - 0.5) * state.deckLength;
                break;
            case 'left': case 'right':
                center = (pos - 0.5) * state.deckWidth;
                break;
        }
        gaps.push({ edge, center, halfWidth: sw / 2 });
    });
    return gaps;
}

// Split an edge into segments around stair gaps
function splitEdgeByGaps(edge, edgeGaps) {
    if (!edgeGaps.length) {
        return [{ s: [...edge.s], e: [...edge.e] }];
    }

    // Parameterize the edge: t=0 at start, t=1 at end
    const dx = edge.e[0] - edge.s[0];
    const dz = edge.e[1] - edge.s[1];
    const edgeLen = Math.sqrt(dx * dx + dz * dz);
    if (edgeLen < 0.01) return [];

    // Convert gaps to t-ranges along the edge
    const tRanges = edgeGaps.map(gap => {
        let tCenter;
        if (edge.isX) {
            tCenter = (gap.center - edge.s[0]) / dx;
        } else {
            tCenter = (gap.center - edge.s[1]) / dz;
        }
        const tHalf = gap.halfWidth / edgeLen;
        return { lo: Math.max(0, tCenter - tHalf), hi: Math.min(1, tCenter + tHalf) };
    }).sort((a, b) => a.lo - b.lo);

    // Merge overlapping ranges
    const merged = [];
    tRanges.forEach(r => {
        if (merged.length && r.lo <= merged[merged.length - 1].hi) {
            merged[merged.length - 1].hi = Math.max(merged[merged.length - 1].hi, r.hi);
        } else {
            merged.push({ ...r });
        }
    });

    // Build segments from the gaps between the ranges
    const segments = [];
    let cursor = 0;
    merged.forEach(range => {
        if (range.lo > cursor + 0.01) {
            segments.push({
                s: [edge.s[0] + dx * cursor, edge.s[1] + dz * cursor],
                e: [edge.s[0] + dx * range.lo, edge.s[1] + dz * range.lo]
            });
        }
        cursor = range.hi;
    });
    if (cursor < 0.99) {
        segments.push({
            s: [edge.s[0] + dx * cursor, edge.s[1] + dz * cursor],
            e: [...edge.e]
        });
    }

    return segments;
}
