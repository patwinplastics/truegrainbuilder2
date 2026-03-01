/**
 * TrueGrain Board Profile Geometry
 * Cross-section parsed from: Grooved-Chestnut-Decking-Wrapped.DXF
 *
 * Geometry uses two material groups:
 *   group 0 — side wall quads (textured, createBoardMaterial)
 *   group 1 — end caps       (solid color, createCapMaterial)
 *
 * THREE is a global loaded via CDN <script> tag in index.html.
 *
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

// Profile points (inches): X = board width, Y = 0 at top surface, negative downward.
// Points trace CW when viewed from the near end (-Z direction).
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

export function createBoardGeometry(lengthFt) {
  const zN = -lengthFt / 2;
  const zF =  lengthFt / 2;

  const positions = new Float32Array(N * 2 * 3);
  for (let i = 0; i < N; i++) {
    const [x, y] = PROFILE_FT[i];
    positions[i * 3]         = x;  positions[i * 3 + 1]         = y;  positions[i * 3 + 2]         = zN;
    positions[(N + i) * 3]   = x;  positions[(N + i) * 3 + 1]   = y;  positions[(N + i) * 3 + 2]   = zF;
  }

  const uvs = new Float32Array(N * 2 * 2);
  for (let i = 0; i < N; i++) {
    const u = (PROFILE_FT[i][0] + HALF_W) / BOARD_PROFILE.widthFt;
    uvs[i * 2]       = u;  uvs[i * 2 + 1]       = 0;
    uvs[(N+i) * 2]   = u;  uvs[(N+i) * 2 + 1]   = 1;
  }

  const sideIndices = [];
  const capIndices  = [];

  // End caps — group 1 (solid color material)
  // Profile is CW from -Z, so near cap = same order, far cap = reversed
  for (let i = 1; i < N - 1; i++) {
    capIndices.push(0,     i,     i + 1);      // near cap: faces -Z
    capIndices.push(N, N + i + 1, N + i);      // far  cap: faces +Z
  }

  // Side wall quads — group 0 (textured material)
  for (let i = 0; i < N; i++) {
    const j  = (i + 1) % N;
    const ni = i,     nj = j;
    const fi = N + i, fj = N + j;
    sideIndices.push(ni, fi, fj);
    sideIndices.push(ni, fj, nj);
  }

  // Merge into single index buffer with groups
  const allIndices = [...sideIndices, ...capIndices];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(allIndices);

  // group 0 = side walls (material index 0 = textured)
  geo.addGroup(0,                    sideIndices.length, 0);
  // group 1 = end caps  (material index 1 = solid color)
  geo.addGroup(sideIndices.length,   capIndices.length,  1);

  geo.computeVertexNormals();
  return geo;
}
