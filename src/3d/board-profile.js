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
 * End caps triangulated via THREE.ShapeUtils.triangulateShape (built-in
 * earcut in r128). Handles non-convex profile with groove notches.
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

// Lazily triangulate the profile cross-section using Three.js built-in earcut.
// Cached after first call. Indices reference PROFILE_FT[0..N-2] (closing dup removed).
let _capTris = null;
function getCapTris() {
  if (!_capTris) {
    // Build contour as Vector2 array, removing closing duplicate vertex
    const contour = [];
    for (let i = 0; i < N; i++) {
      if (i === N - 1) {
        const dx = Math.abs(PROFILE_FT[i][0] - PROFILE_FT[0][0]);
        const dy = Math.abs(PROFILE_FT[i][1] - PROFILE_FT[0][1]);
        if (dx < 1e-10 && dy < 1e-10) continue; // skip closing duplicate
      }
      contour.push(new THREE.Vector2(PROFILE_FT[i][0], PROFILE_FT[i][1]));
    }
    // triangulateShape returns [[a,b,c], ...] with indices into contour
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    _capTris = [];
    for (let f = 0; f < faces.length; f++) {
      _capTris.push(faces[f][0], faces[f][1], faces[f][2]);
    }
  }
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

    // near-side ring (0..N-1)
    positions[i*3]         = x; positions[i*3+1]         = y; positions[i*3+2]         = zN;
    uvs[i*2] = u; uvs[i*2+1] = 0;

    // far-side ring (N..2N-1)
    positions[(N+i)*3]     = x; positions[(N+i)*3+1]     = y; positions[(N+i)*3+2]     = zF;
    uvs[(N+i)*2] = u; uvs[(N+i)*2+1] = 1;

    // near-cap isolated (2N..3N-1)
    positions[(2*N+i)*3]   = x; positions[(2*N+i)*3+1]   = y; positions[(2*N+i)*3+2]   = zN;
    uvs[(2*N+i)*2] = u; uvs[(2*N+i)*2+1] = 0;

    // far-cap isolated (3N..4N-1)
    positions[(3*N+i)*3]   = x; positions[(3*N+i)*3+1]   = y; positions[(3*N+i)*3+2]   = zF;
    uvs[(3*N+i)*2] = u; uvs[(3*N+i)*2+1] = 1;
  }

  const sideIndices = [];
  const capIndices  = [];

  // Side wall quads
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    sideIndices.push(i, N+i, N+j);
    sideIndices.push(i, N+j, j);
  }

  // End caps from ShapeUtils triangulation
  // ShapeUtils produces CCW triangles viewed from +Z (Three.js XY plane convention).
  // Near cap (z = -len/2) needs to face -Z: reverse winding.
  // Far  cap (z = +len/2) needs to face +Z: keep winding.
  const tris = getCapTris();
  const NC = 2 * N;
  const FC = 3 * N;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t+1], c = tris[t+2];
    capIndices.push(NC + a, NC + c, NC + b); // near: reversed to face -Z
    capIndices.push(FC + a, FC + b, FC + c); // far:  as-is to face +Z
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
