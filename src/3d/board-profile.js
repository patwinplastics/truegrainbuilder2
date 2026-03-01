/**
 * TrueGrain Board Profile Geometry
 * Cross-section parsed from: Grooved-Chestnut-Decking-Wrapped.DXF
 *
 * Profile features (all dims in inches, converted to feet for scene units):
 *   - Total width:  5.500" / 12 = 0.45833 ft
 *   - Total height: 1.001" / 12 = 0.08342 ft
 *   - Top corner radius: 0.100"
 *   - Hidden fastener grooves on each side: 0.450" deep x 0.181" tall
 *   - 45° chamfer transition to narrower bottom flange
 *
 * THREE is loaded globally via CDN <script> tag in index.html.
 * Do NOT import from 'three' — use the global THREE object.
 *
 * UV NOTE:
 *   ExtrudeGeometry UVs do not match BoxGeometry top-face UVs.
 *   remapBoardUVs() reprojects all vertex UVs using a top-down
 *   planar projection (U = x/width, V = z/length) so that
 *   createBoardMaterial()'s tex.rotation logic works unchanged.
 *
 * Applied to: straight boards, breaker boards, picture frame FILL boards
 * NOT applied to: picture frame border boards (mitered), stair treads
 *
 * @module board-profile
 */

// Inches to feet conversion factor
const IN = 1 / 12;

const BOARD_WIDTH_FT = 5.5 * IN;   // 0.45833 ft

/**
 * 75-point profile traced CCW from top-left.
 * Coordinates in inches, centered at X=0.
 * Top = +0.5", bottom = -0.5007"
 */
const PROFILE_POINTS_IN = [
  [-2.65,         0.5          ],
  [ 2.65,         0.5          ],
  [ 2.675882,     0.496593     ],
  [ 2.7,          0.486603     ],
  [ 2.720711,     0.470711     ],
  [ 2.736603,     0.45         ],
  [ 2.746593,     0.425882     ],
  [ 2.75,         0.4          ],
  [ 2.75,         0.1405       ],
  [ 2.746194,     0.121366     ],
  [ 2.735355,     0.105145     ],
  [ 2.719134,     0.094306     ],
  [ 2.7,          0.0905       ],
  [ 2.35,         0.0905       ],
  [ 2.330866,     0.086694     ],
  [ 2.314645,     0.075855     ],
  [ 2.303806,     0.059634     ],
  [ 2.3,          0.0405       ],
  [ 2.3,         -0.0405       ],
  [ 2.303806,    -0.059634     ],
  [ 2.314645,    -0.075855     ],
  [ 2.330866,    -0.086694     ],
  [ 2.35,        -0.0905       ],
  [ 2.7,         -0.0905       ],
  [ 2.719134,    -0.094306     ],
  [ 2.735355,    -0.105145     ],
  [ 2.746194,    -0.121366     ],
  [ 2.75,        -0.1405       ],
  [ 2.75,        -0.1829339828 ],
  [ 2.749039,    -0.192688     ],
  [ 2.746194,    -0.202068     ],
  [ 2.741573,    -0.210712     ],
  [ 2.735355,    -0.218289     ],
  [ 2.4676330114,-0.4860116495 ],
  [ 2.460056,    -0.49223      ],
  [ 2.451412,    -0.49685      ],
  [ 2.442032,    -0.499696     ],
  [ 2.432278,    -0.500656     ],
  [-2.432278,    -0.500656     ],
  [-2.442032,    -0.499696     ],
  [-2.451412,    -0.49685      ],
  [-2.460056,    -0.49223      ],
  [-2.467633,    -0.486012     ],
  [-2.7353553391,-0.2182893219 ],
  [-2.741573,    -0.210712     ],
  [-2.746194,    -0.202068     ],
  [-2.749039,    -0.192688     ],
  [-2.75,        -0.182934     ],
  [-2.75,        -0.1405       ],
  [-2.746194,    -0.121366     ],
  [-2.735355,    -0.105145     ],
  [-2.719134,    -0.094306     ],
  [-2.7,         -0.0905       ],
  [-2.35,        -0.0905       ],
  [-2.330866,    -0.086694     ],
  [-2.314645,    -0.075855     ],
  [-2.303806,    -0.059634     ],
  [-2.3,         -0.0405       ],
  [-2.3,          0.0405       ],
  [-2.303806,     0.059634     ],
  [-2.314645,     0.075855     ],
  [-2.330866,     0.086694     ],
  [-2.35,         0.0905       ],
  [-2.7,          0.0905       ],
  [-2.719134,     0.094306     ],
  [-2.735355,     0.105145     ],
  [-2.746194,     0.121366     ],
  [-2.75,         0.1405       ],
  [-2.75,         0.4          ],
  [-2.746593,     0.425882     ],
  [-2.736603,     0.45         ],
  [-2.720711,     0.470711     ],
  [-2.7,          0.486603     ],
  [-2.675882,     0.496593     ],
  [-2.65,         0.5          ],
];

/**
 * Build the THREE.Shape for the board cross-section.
 * @returns {THREE.Shape}
 */
function buildBoardProfileShape() {
  const shape = new THREE.Shape();
  const [sx, sy] = PROFILE_POINTS_IN[0];
  shape.moveTo(sx * IN, sy * IN);
  for (let i = 1; i < PROFILE_POINTS_IN.length; i++) {
    const [x, y] = PROFILE_POINTS_IN[i];
    shape.lineTo(x * IN, y * IN);
  }
  shape.closePath();
  return shape;
}

/**
 * Remap UV attribute of an ExtrudeGeometry using top-down planar projection.
 *
 * ExtrudeGeometry's built-in UVs map the cross-section profile onto cap faces
 * and sweep 0-1 along the extrusion on side walls. Neither matches the
 * BoxGeometry top-face convention that createBoardMaterial() expects.
 *
 * This replaces every UV with:
 *   U = (vertex.x + halfWidth) / boardWidth    -> 0..1 across board width
 *   V = (vertex.z + halfLength) / boardLength  -> 0..1 along board length
 *
 * That is identical to BoxGeometry's top-face UV layout, so tex.rotation
 * in materials.js continues to work without any changes.
 *
 * @param {THREE.BufferGeometry} geo
 * @param {number} lengthFt
 */
function remapBoardUVs(geo, lengthFt) {
  const pos = geo.attributes.position;
  const uv  = geo.attributes.uv;
  const halfW = BOARD_WIDTH_FT / 2;
  const halfL = lengthFt / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(
      i,
      (x + halfW) / BOARD_WIDTH_FT,   // U: 0 at left edge, 1 at right edge
      (z + halfL) / lengthFt           // V: 0 at near end,  1 at far end
    );
  }
  uv.needsUpdate = true;
}

/**
 * Create an extruded board geometry from the DXF cross-section profile
 * with UVs remapped to match BoxGeometry top-face convention.
 *
 * Extrudes along +Z. Translate so:
 *   Y=0  = top surface (set mesh.position.y = state.deckHeight)
 *   X=0  = board center
 *   Z=0  = board center
 *
 * Rotate mesh 90° around Y when board runs along X instead of Z.
 *
 * @param {number} lengthFt
 * @returns {THREE.BufferGeometry}
 */
export function createBoardGeometry(lengthFt) {
  const shape = buildBoardProfileShape();

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps:        1,
    depth:        lengthFt,
    bevelEnabled: false,
  });

  // Center and seat: Y=0 is top surface, board centered on X and Z
  geo.translate(0, -0.5 * IN, -lengthFt / 2);

  // Remap UVs to top-down planar projection (matches BoxGeometry top face)
  remapBoardUVs(geo, lengthFt);

  return geo;
}

/**
 * Board profile constants in feet.
 */
export const BOARD_PROFILE = {
  widthFt:        5.5   * IN,
  thicknessFt:    1.0   * IN,
  totalHeightFt:  1.001 * IN,
  grooveDepthFt:  0.45  * IN,
  grooveHeightFt: 0.181 * IN,
};

/** 1/8" install gap between board faces. Matches CONFIG.boards.gap */
export const BOARD_GAP_FT = 0.125 * IN;

/** Center-to-center board pitch for layout loops. */
export const BOARD_PITCH_FT = BOARD_PROFILE.widthFt + BOARD_GAP_FT;
