/**
 * TrueGrain Board Profile Geometry
 * Cross-section parsed from: Grooved-Chestnut-Decking-Wrapped.DXF
 *
 * Geometry strategy: manual BufferGeometry sweep.
 * The 75 profile points define the cross-section in the XZ plane:
 *   profile X  -> world X  (board width, centered at 0)
 *   profile Y  -> world Y  (depth, 0 = top surface, negative = downward)
 * The profile is swept along world Z (board length).
 *
 * Place mesh at:  mesh.position.y = state.deckHeight + BOARD_PROFILE.thicknessFt
 * For X-running:  mesh.rotation.y = Math.PI / 2
 * For Z-running:  no rotation needed
 *
 * THREE is a global loaded via CDN <script> tag in index.html.
 *
 * @module board-profile
 */

const IN = 1 / 12;

// ── Profile constants ────────────────────────────────────────────────────────
export const BOARD_PROFILE = {
  widthFt:        5.5   * IN,
  thicknessFt:    1.0   * IN,
  totalHeightFt:  1.001 * IN,
  grooveDepthFt:  0.45  * IN,
  grooveHeightFt: 0.181 * IN,
};

export const BOARD_GAP_FT   = 0.125 * IN;
export const BOARD_PITCH_FT = BOARD_PROFILE.widthFt + BOARD_GAP_FT;

// ── DXF profile points (inches) ──────────────────────────────────────────────
// X = board width (centered at 0, ±2.75" max)
// Y = 0 at top surface, negative = downward into board
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

/**
 * Build a BufferGeometry for one board by sweeping the DXF profile along Z.
 *
 * @param {number} lengthFt
 * @returns {THREE.BufferGeometry}
 */
export function createBoardGeometry(lengthFt) {
  const zN = -lengthFt / 2;
  const zF =  lengthFt / 2;

  // ── Positions: near ring (z=zN) then far ring (z=zF) ──────────────────────
  const positions = new Float32Array(N * 2 * 3);
  for (let i = 0; i < N; i++) {
    const [x, y] = PROFILE_FT[i];
    positions[i * 3]     = x;  positions[i * 3 + 1] = y;  positions[i * 3 + 2] = zN;
    positions[(N + i) * 3]     = x;
    positions[(N + i) * 3 + 1] = y;
    positions[(N + i) * 3 + 2] = zF;
  }

  // ── UVs: top-down planar projection ────────────────────────────────────────
  // U = x across board width (0..1), V = z along board length (0..1)
  // Matches BoxGeometry top-face UV convention so materials.js tex.rotation works.
  const uvs = new Float32Array(N * 2 * 2);
  for (let i = 0; i < N; i++) {
    const [x] = PROFILE_FT[i];
    const u = (x + HALF_W) / BOARD_PROFILE.widthFt;
    uvs[i * 2]         = u;  uvs[i * 2 + 1]         = 0; // near end V=0
    uvs[(N + i) * 2]   = u;  uvs[(N + i) * 2 + 1]   = 1; // far  end V=1
  }

  // ── Indices ─────────────────────────────────────────────────────────────────
  const maxTris = (N - 2) * 2 + N * 2; // end caps + side quads
  const indices = [];

  // End caps — fan triangulation from vertex 0
  for (let i = 1; i < N - 1; i++) {
    indices.push(0, i + 1, i);         // near cap (CW from +Z = correct outward normal)
    indices.push(N, N + i, N + i + 1); // far  cap (CCW from +Z)
  }

  // Side quads — one quad per profile edge
  for (let i = 0; i < N; i++) {
    const j  = (i + 1) % N;
    const ni = i,     nj = j;
    const fi = N + i, fj = N + j;
    indices.push(ni, fi, fj);  // tri 1
    indices.push(ni, fj, nj);  // tri 2
  }

  // ── Assemble ─────────────────────────────────────────────────────────────────
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
