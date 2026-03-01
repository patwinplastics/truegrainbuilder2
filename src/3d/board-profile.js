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
 * Applied to: straight boards, breaker boards, picture frame FILL boards
 * NOT applied to: picture frame border boards (mitered), stair treads
 *
 * THREE is expected as a global (loaded via <script> tag in index.html).
 *
 * @module board-profile
 */

// No import — THREE is a global in this codebase

// Inches to feet conversion factor
const IN = 1 / 12;

/**
 * 75-point profile traced CCW from top-left.
 * Coordinates in inches, centered at X=0.
 * Y=0 is approximately mid-height; top=+0.5", bottom=-0.5007"
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
 * Scales each point from inches to feet (÷12) for scene units.
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
 * Create an extruded board geometry from the DXF cross-section profile.
 *
 * The shape sits in the XY plane and is extruded along +Z (board length).
 * After creation the geometry is translated so that:
 *   - X is centered at 0 (board width centered)
 *   - Y=0 is the TOP surface of the board (so mesh.position.y = deckHeight)
 *   - Z is centered at 0 (board length centered)
 *
 * Rotate the mesh 90° around Y if the board runs along X instead of Z.
 *
 * @param {number} lengthFt - Board length in feet
 * @returns {THREE.ExtrudeGeometry}
 */
export function createBoardGeometry(lengthFt) {
  const shape = buildBoardProfileShape();

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps:        1,
    depth:        lengthFt,
    bevelEnabled: false,
  });

  // Shift so Y=0 is the top surface and board is centered on X and Z.
  // Profile top is at +0.5" = +0.5*IN ft. Shift down by that amount.
  geo.translate(0, -0.5 * IN, -lengthFt / 2);

  return geo;
}

/**
 * Board profile constants (in feet) for layout and positioning math.
 */
export const BOARD_PROFILE = {
  widthFt:        5.5   * IN,   // 0.45833 ft
  thicknessFt:    1.0   * IN,   // 0.08333 ft  (top surface nominal)
  totalHeightFt:  1.001 * IN,   // 0.08342 ft  (top to bottom flange)
  grooveDepthFt:  0.45  * IN,   // hidden clip channel depth from side
  grooveHeightFt: 0.181 * IN,   // hidden clip channel height
};

/**
 * Install gap between adjacent board faces: 1/8" = 0.125"
 * Matches CONFIG.boards.gap
 */
export const BOARD_GAP_FT = 0.125 * IN;

/**
 * Center-to-center board pitch for layout loops.
 */
export const BOARD_PITCH_FT = BOARD_PROFILE.widthFt + BOARD_GAP_FT;
