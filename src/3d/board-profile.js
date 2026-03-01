/**
 * TrueGrain Board Profile Geometry
 * Cross-section parsed from: Grooved-Chestnut-Decking-Wrapped.DXF
 *
 * Strategy: sweep the 75-point profile along the Z axis using a
 * BufferGeometry. Profile X = board width, profile Y = board thickness
 * (downward from top surface), board length = Z axis.
 *
 * Coordinate convention (matches the rest of the codebase):
 *   - mesh.position.y = state.deckHeight + BOARD_PROFILE.thicknessFt
 *     (top surface sits at deckHeight, geometry hangs downward)
 *   - Board runs along Z by default. For X-running boards,
 *     caller sets mesh.rotation.y = Math.PI / 2.
 *
 * THREE is expected as a global (loaded via <script> tag in index.html).
 *
 * @module board-profile
 */

const IN = 1 / 12; // inches to feet

// ── Profile dimensions ───────────────────────────────────────────────────────
export const BOARD_PROFILE = {
  widthFt:        5.5   * IN,   // 0.45833 ft
  thicknessFt:    1.0   * IN,   // 0.08333 ft  (nominal top-surface height)
  totalHeightFt:  1.001 * IN,   // 0.08342 ft  (top to bottom flange)
  grooveDepthFt:  0.45  * IN,
  grooveHeightFt: 0.181 * IN,
};

export const BOARD_GAP_FT   = 0.125 * IN;           // 1/8" gap
export const BOARD_PITCH_FT = BOARD_PROFILE.widthFt + BOARD_GAP_FT;

// ── Raw DXF profile points (inches) ─────────────────────────────────────────
// Traced CCW viewed from the end of the board.
// X = width (centered at 0, ±2.75" max)
// Y = height (0 = top surface, negative = downward into board)
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

// Convert to feet, close the loop
const PROFILE_FT = PROFILE_IN.map(([x, y]) => [x * IN, y * IN]);

/**
 * Triangulate a closed 2-D polygon using a simple fan from centroid.
 * Returns flat array of [i0, i1, i2, ...] indices into pts.
 * Works correctly for convex polygons and reasonably well for
 * our near-convex board profile.
 */
function fanTriangulate(pts) {
  const indices = [];
  // Use index 0 as the fan origin
  for (let i = 1; i < pts.length - 1; i++) {
    indices.push(0, i, i + 1);
  }
  return indices;
}

/**
 * Build a THREE.BufferGeometry for one board.
 *
 * The geometry is built with:
 *   - width along X  (±2.75" / 12)
 *   - thickness along Y  (0 at top, negative downward)
 *   - length along Z  (-halfLen to +halfLen)
 *
 * Place the mesh at:
 *   mesh.position.y = state.deckHeight + BOARD_PROFILE.thicknessFt
 *
 * For boards running along the deck LENGTH axis (X), set:
 *   mesh.rotation.y = Math.PI / 2
 * For boards running along the deck WIDTH axis (Z), no rotation.
 *
 * @param {number} lengthFt
 * @returns {THREE.BufferGeometry}
 */
export function createBoardGeometry(lengthFt) {
  const n   = PROFILE_FT.length;
  const zN  = -lengthFt / 2;  // near end
  const zF  =  lengthFt / 2;  // far end

  // Build positions: near-cap verts (z=zN) then far-cap verts (z=zF)
  const positions = [];
  for (const [x, y] of PROFILE_FT) positions.push(x, y, zN);
  for (const [x, y] of PROFILE_FT) positions.push(x, y, zF);

  const indices = [];

  // ── End caps ────────────────────────────────────────────────────────────
  const nearFan = fanTriangulate(PROFILE_FT);
  // Near cap: CCW when looking from -Z  → reverse winding for correct normals
  for (let i = 0; i < nearFan.length; i += 3) {
    indices.push(nearFan[i], nearFan[i + 2], nearFan[i + 1]);
  }
  // Far cap: CCW when looking from +Z
  for (let i = 0; i < nearFan.length; i += 3) {
    indices.push(n + nearFan[i], n + nearFan[i + 1], n + nearFan[i + 2]);
  }

  // ── Side quads ──────────────────────────────────────────────────────────
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // quad: nearI, nearJ, farJ, farI
    const ni = i, nj = j;
    const fi = n + i, fj = n + j;
    indices.push(ni, fj, fi);   // tri 1
    indices.push(ni, nj, fj);   // tri 2
  }

  // ── UVs ─────────────────────────────────────────────────────────────────
  // Top face is the side quad running along Z between the two topmost
  // profile points (index 0 and n-1, both at y=0).
  // We assign UV u = (x + halfWidth) / width, v = z / length + 0.5
  // for all vertices so the texture stretches over the full top face.
  const halfW = BOARD_PROFILE.widthFt / 2;
  const uvs = [];
  for (const [x] of PROFILE_FT) uvs.push((x + halfW) / BOARD_PROFILE.widthFt, 0);
  for (const [x] of PROFILE_FT) uvs.push((x + halfW) / BOARD_PROFILE.widthFt, 1);

  // ── Assemble ─────────────────────────────────────────────────────────────
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}
