// ============================================================
// TrueGrain Deck Builder 2 — Railing System
// Realistic wood balusters: tapered cylinders, wood texture,
// matching deck color on posts, balusters, and rails.
// ============================================================
import { CONFIG }        from '../config.js';
import { BOARD_PROFILE } from './board-profile.js';
import { createBoardMaterial } from './materials.js';

// Shared geometry cache for railing elements
const _geoCache = {};

function getBalusterGeo(bh) {
    const key = `bal_${bh.toFixed(3)}`;
    if (_geoCache[key]) return _geoCache[key];
    // Tapered cylinder: slightly wider at base (0.055ft) than top (0.04ft)
    // 8 radial segments = octagonal cross-section like a real routed baluster
    const geo = new THREE.CylinderGeometry(0.04, 0.055, bh, 8);
    _geoCache[key] = geo;
    return geo;
}

function getPostGeo(ph, ps) {
    const key = `post_${ph.toFixed(3)}_${ps.toFixed(3)}`;
    if (_geoCache[key]) return _geoCache[key];
    // Posts stay square but with enough segments for smooth shadow edges
    const geo = new THREE.BoxGeometry(ps, ph, ps);
    _geoCache[key] = geo;
    return geo;
}

function getRailGeo(len, rh, rt, isX) {
    // Rails are unique per segment length — not cached
    return new THREE.BoxGeometry(
        isX ? len : rt,
        rh,
        isX ? rt : len
    );
}

export function createDetailedRailings(deckGroup, state) {
    const ph = 3, ps = 0.29, rh = 0.29, rt = 0.125, bsp = 0.33, bro = 0.25;
    const wh  = state.deckHeight + BOARD_PROFILE.thicknessFt;

    // ── Materials ─────────────────────────────────────────────
    // Posts and rails: same wood texture as the deck boards
    const colorConfig = CONFIG.colors.find(c => c.id === state.mainColor) || CONFIG.colors[0];
    const woodMat = createBoardMaterial(colorConfig, 4, true);

    // Balusters: slightly lighter tint of the same color to differentiate
    // from the heavier post/rail members, matching a real painted-wood look
    const balMat = new THREE.MeshStandardMaterial({
        color:     new THREE.Color(colorConfig.hex).multiplyScalar(0.95),
        roughness: 0.80,
        metalness: 0.0,
    });
    // Share the same diffuse texture as the board material if loaded
    if (woodMat.map) {
        balMat.map = woodMat.map;
        balMat.color.setHex(0xFFFFFF);
    }

    const topY  = wh + ph - rh / 2;
    const botY  = wh + bro + rh / 2;
    const bh    = ph - rh - bro;          // baluster clear height
    const balY  = wh + bro + rh + bh / 2; // baluster center Y

    const balGeo  = getBalusterGeo(bh);
    const postGeo = getPostGeo(ph, ps);

    // Build stair gap info per edge
    const gaps = buildStairGaps(state);

    const hL = state.deckLength / 2, hW = state.deckWidth / 2;
    const edges = [
        { name: 'back',  s: [-hL, -hW], e: [hL, -hW],  len: state.deckLength, isX: true  },
        { name: 'right', s: [hL, -hW],  e: [hL, hW],   len: state.deckWidth,  isX: false },
        { name: 'front', s: [hL, hW],   e: [-hL, hW],  len: state.deckLength, isX: true  },
        { name: 'left',  s: [-hL, hW],  e: [-hL, -hW], len: state.deckWidth,  isX: false }
    ];

    edges.forEach(edge => {
        const edgeGaps = gaps.filter(g => g.edge === edge.name);
        const segments = splitEdgeByGaps(edge, edgeGaps);

        segments.forEach(seg => {
            const dx     = seg.e[0] - seg.s[0];
            const dz     = seg.e[1] - seg.s[1];
            const segLen = Math.sqrt(dx * dx + dz * dz);
            if (segLen < 0.5) return;

            // ── Corner posts ───────────────────────────────────────
            [seg.s, seg.e].forEach(([px, pz]) => {
                const post = new THREE.Mesh(postGeo, woodMat);
                post.position.set(px, wh + ph / 2, pz);
                post.castShadow    = true;
                post.receiveShadow = true;
                deckGroup.add(post);
            });

            // ── Intermediate posts every 6ft ─────────────────────
            const numPosts = Math.floor(segLen / 6);
            for (let i = 1; i <= numPosts; i++) {
                const t = (i * 6) / segLen;
                if (t >= 1) break;
                const ip = new THREE.Mesh(postGeo, woodMat);
                ip.position.set(seg.s[0] + dx * t, wh + ph / 2, seg.s[1] + dz * t);
                ip.castShadow    = true;
                ip.receiveShadow = true;
                deckGroup.add(ip);
            }

            // ── Top and bottom rails ───────────────────────────
            const cx = (seg.s[0] + seg.e[0]) / 2;
            const cz = (seg.s[1] + seg.e[1]) / 2;
            [topY, botY].forEach(ry => {
                const rail = new THREE.Mesh(getRailGeo(segLen, rh, rt, edge.isX), woodMat);
                rail.position.set(cx, ry, cz);
                rail.castShadow    = true;
                rail.receiveShadow = true;
                deckGroup.add(rail);
            });

            // ── Balusters ─────────────────────────────────────
            const numBals = Math.floor(segLen / bsp);
            // Rotation so cylinder's axis aligns along the rail run direction
            const balRotY = edge.isX ? 0 : 0; // cylinders are already vertical
            for (let i = 1; i < numBals; i++) {
                const t = i / numBals;
                const bal = new THREE.Mesh(balGeo, balMat);
                bal.position.set(
                    seg.s[0] + dx * t,
                    balY,
                    seg.s[1] + dz * t
                );
                bal.castShadow    = true;
                bal.receiveShadow = true;
                deckGroup.add(bal);
            }
        });
    });
}

// ============================================================
// Stair gap helpers (unchanged)
// ============================================================
function buildStairGaps(state) {
    if (!state.stairsEnabled || !state.stairs?.length) return [];
    const gaps   = [];
    const margin = 0.25;
    state.stairs.forEach(stair => {
        if (!stair.enabled) return;
        const sw  = (stair.width || CONFIG.stairs.defaultWidth) + margin * 2;
        const pos = stair.position || 0.5;
        const edge = stair.edge || 'front';
        let center;
        switch (edge) {
            case 'front': case 'back':  center = (pos - 0.5) * state.deckLength; break;
            case 'left':  case 'right': center = (pos - 0.5) * state.deckWidth;  break;
        }
        gaps.push({ edge, center, halfWidth: sw / 2 });
    });
    return gaps;
}

function splitEdgeByGaps(edge, edgeGaps) {
    if (!edgeGaps.length) return [{ s: [...edge.s], e: [...edge.e] }];

    const dx = edge.e[0] - edge.s[0];
    const dz = edge.e[1] - edge.s[1];
    const edgeLen = Math.sqrt(dx * dx + dz * dz);
    if (edgeLen < 0.01) return [];

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

    const merged = [];
    tRanges.forEach(r => {
        if (merged.length && r.lo <= merged[merged.length - 1].hi) {
            merged[merged.length - 1].hi = Math.max(merged[merged.length - 1].hi, r.hi);
        } else {
            merged.push({ ...r });
        }
    });

    const segments = [];
    let cursor = 0;
    merged.forEach(range => {
        if (range.lo > cursor + 0.01) {
            segments.push({
                s: [edge.s[0] + dx * cursor,    edge.s[1] + dz * cursor],
                e: [edge.s[0] + dx * range.lo,  edge.s[1] + dz * range.lo]
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
