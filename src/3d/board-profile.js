/**
 * TrueGrain Board Profile Geometry
 * Cross-section parsed from: Grooved-Chestnut-Decking-Wrapped.DXF
 *
 * Vertex layout:
 *   0   .. N-1   — near ring  (side walls)
 *   N   .. 2N-1  — far  ring  (side walls)
 *   2N  .. 3N-1  — near cap   (isolated)
 *   3N  .. 4N-1  — far  cap   (isolated)
 *
 * Groups: 0 = textured side walls, 1 = solid color end caps.
 *
 * THREE is a global loaded via CDN <script> tag in index.html.
 * @module board-profile
 */

const IN = 1 / 12;

export const BOARD_PROFILE = {
  widthFt:        5.5   * IN,
  thicknessFt:    1.0   * IN,
  totalHeightFt:  1.001 * IN,
  grooveDepthFt:  0.45  * IN,
  grooveHeightFt: 0.181 * IN,
};

export const BOARD_GAP_FT   = 0.125 * IN;
export const BOARD_PITCH_FT = BOARD_PROFILE.widthFt + BOARD_GAP_FT;

// ── Ear-clipping triangulator ──────────────────────────────────────────
// pts: array of [x, y] in any coordinate system.
// Returns flat [i0,i1,i2,...] index array.
// area2 sign convention: positive = CCW in standard Y-up math.
// Our profile uses Y-down (Y negative = downward), which FLIPS the sign,
// so a CW-looking profile in 3D actually has positive area2 here.
// The reflex test therefore uses >= 0 (keep CCW ears in Y-down space).
function earclip(pts) {
  const n = pts.length;
  if (n < 3) return [];

  // Determine dominant winding from signed area so we handle both orderings.
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    signedArea += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  }
  // signedArea > 0 means CW in Y-down (screen) space; we want CCW for area2 > 0 = convex.
  // If CW, reverse so ears are consistently identified.
  const ordered = signedArea > 0 ? pts.slice().reverse() : pts;

  const idx = Array.from({ length: ordered.length }, (_, i) => i);
  const tris = [];

  function area2(a, b, c) {
    return (ordered[b][0] - ordered[a][0]) * (ordered[c][1] - ordered[a][1])
         - (ordered[c][0] - ordered[a][0]) * (ordered[b][1] - ordered[a][1]);
  }

  function inTriangle(ax, ay, bx, by, cx, cy, px, py) {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }

  function isEar(i) {
    const len = idx.length;
    const prev = idx[(i - 1 + len) % len];
    const curr = idx[i];
    const next = idx[(i + 1) % len];
    if (area2(prev, curr, next) <= 0) return false; // reflex or degenerate
    const ax = ordered[prev][0], ay = ordered[prev][1];
    const bx = ordered[curr][0], by = ordered[curr][1];
    const cx = ordered[next][0], cy = ordered[next][1];
    for (let j = 0; j < len; j++) {
      const v = idx[j];
      if (v === prev || v === curr || v === next) continue;
      if (inTriangle(ax, ay, bx, by, cx, cy, ordered[v][0], ordered[v][1])) return false;
    }
    return true;
  }

  // Map ordered indices back to original pt indices if we reversed.
  const origIdx = signedArea > 0
    ? Array.from({ length: n }, (_, i) => n - 1 - i)
    : Array.from({ length: n }, (_, i) => i);

  let remaining = idx.length;
  let attempts = 0;
  let i = 0;
  while (remaining > 3) {
    if (attempts > remaining * 2) break;
    if (isEar(i % remaining)) {
      const len = idx.length;
      tris.push(
        origIdx[idx[(i - 1 + len) % len]],
        origIdx[idx[i % len]],
        origIdx[idx[(i + 1) % len]]
      );
      idx.splice(i % remaining, 1);
      remaining--;
      attempts = 0;
    } else {
      attempts++;
    }
    i++;
    if (i >= remaining) i = 0;
  }
  if (remaining === 3) tris.push(origIdx[idx[0]], origIdx[idx[1]], origIdx[idx[2]]);
  return tris;
}

// Profile points (inches): X = board width (centered), Y = 0 at top, negative downward.
const PROFILE_IN = [
  [-2.65,         0           ],
  [ 2.65,         0           ],
  [ 2.675882,    -0.003407    ],
  [ 2.7,         -0.013397    ],
  [ 2.720711,    -0.029289    ],
  [ 2.736603,    -0.05        ],
  [ 2.746593,    -0.074118    ],
  [ 2.75,        -0.1         ],
  [ 2.75,        -0.3595      ],
  [ 2.746194,    -0.378634    ],
  [ 2.735355,    -0.394855    ],
  [ 2.719134,    -0.405694    ],
  [ 2.7,         -0.4095      ],
  [ 2.35,        -0.4095      ],
  [ 2.330866,    -0.413306    ],
  [ 2.314645,    -0.424145    ],
  [ 2.303806,    -0.440366    ],
  [ 2.3,         -0.4595      ],
  [ 2.3,         -0.5405      ],
  [ 2.303806,    -0.559634    ],
  [ 2.314645,    -0.575855    ],
  [ 2.330866,    -0.586694    ],
  [ 2.35,        -0.5905      ],
  [ 2.7,         -0.5905      ],
  [ 2.719134,    -0.594306    ],
  [ 2.735355,    -0.605145    ],
  [ 2.746194,    -0.621366    ],
  [ 2.75,        -0.6405      ],
  [ 2.75,        -0.6829      ],
  [ 2.749039,    -0.692688    ],
  [ 2.746194,    -0.702068    ],
  [ 2.741573,    -0.710712    ],
  [ 2.735355,    -0.718289    ],
  [ 2.467633,    -0.986012    ],
  [ 2.460056,    -0.99223     ],
  [ 2.451412,    -0.99685     ],
  [ 2.442032,    -0.999696    ],
  [ 2.432278,    -1.000656    ],
  [-2.432278,    -1.000656    ],
  [-2.442032,    -0.999696    ],
  [-2.451412,    -0.99685     ],
  [-2.460056,    -0.99223     ],
  [-2.467633,    -0.986012    ],
  [-2.735355,    -0.718289    ],
  [-2.741573,    -0.710712    ],
  [-2.746194,    -0.702068    ],
  [-2.749039,    -0.692688    ],
  [-2.75,        -0.6829      ],
  [-2.75,        -0.6405      ],
  [-2.746194,    -0.621366    ],
  [-2.735355,    -0.605145    ],
  [-2.719134,    -0.594306    ],
  [-2.7,         -0.5905      ],
  [-2.35,        -0.5905      ],
  [-2.330866,    -0.586694    ],
  [-2.314645,    -0.575855    ],
  [-2.303806,    -0.559634    ],
  [-2.3,         -0.5405      ],
  [-2.3,         -0.4595      ],
  [-2.303806,    -0.440366    ],
  [-2.314645,    -0.424145    ],
  [-2.330866,    -0.413306    ],
  [-2.35,        -0.4095      ],
  [-2.7,         -0.4095      ],
  [-2.719134,    -0.405694    ],
  [-2.735355,    -0.394855    ],
  [-2.746194,    -0.378634    ],
  [-2.75,        -0.3595      ],
  [-2.75,        -0.1         ],
  [-2.746593,    -0.074118    ],
  [-2.736603,    -0.05        ],
  [-2.720711,    -0.029289    ],
  [-2.7,         -0.013397    ],
  [-2.675882,    -0.003407    ],
  [-2.65,         0           ],
];

const PROFILE_FT = PROFILE_IN.map(([x, y]) => [x * IN, y * IN]);
const N = PROFILE_FT.length;
const HALF_W = BOARD_PROFILE.widthFt / 2;

let _capTris = null;
function getCapTris() {
  if (!_capTris) _capTris = earclip(PROFILE_FT);
  return _capTris;
}

export function createBoardGeometry(lengthFt) {
  const zN = -lengthFt / 2;
  const zF =  lengthFt / 2;

  const positions = new Float32Array(N * 4 * 3);
  const uvs       = new Float32Array(N * 4 * 2);

  for (let i = 0; i < N; i++) {
    const [x, y] = PROFILE_FT[i];
    const u = (x + HALF_W) / BOARD_PROFILE.widthFt;

    positions[i*3]         = x; positions[i*3+1]         = y; positions[i*3+2]         = zN;
    uvs[i*2] = u; uvs[i*2+1] = 0;

    positions[(N+i)*3]     = x; positions[(N+i)*3+1]     = y; positions[(N+i)*3+2]     = zF;
    uvs[(N+i)*2] = u; uvs[(N+i)*2+1] = 1;

    positions[(2*N+i)*3]   = x; positions[(2*N+i)*3+1]   = y; positions[(2*N+i)*3+2]   = zN;
    uvs[(2*N+i)*2] = u; uvs[(2*N+i)*2+1] = 0;

    positions[(3*N+i)*3]   = x; positions[(3*N+i)*3+1]   = y; positions[(3*N+i)*3+2]   = zF;
    uvs[(3*N+i)*2] = u; uvs[(3*N+i)*2+1] = 1;
  }

  const sideIndices = [];
  const capIndices  = [];

  for (let i = 0; i < N; i++) {
    const j  = (i + 1) % N;
    sideIndices.push(i, N+i, N+j);
    sideIndices.push(i, N+j, j);
  }

  const tris = getCapTris();
  const NC = 2 * N;
  const FC = 3 * N;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t+1], c = tris[t+2];
    capIndices.push(NC + a, NC + b, NC + c);
    capIndices.push(FC + a, FC + c, FC + b); // reversed for far cap
  }

  const allIndices = [...sideIndices, ...capIndices];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(allIndices);
  geo.addGroup(0,                  sideIndices.length, 0);
  geo.addGroup(sideIndices.length, capIndices.length,  1);
  geo.computeVertexNormals();
  return geo;
}
