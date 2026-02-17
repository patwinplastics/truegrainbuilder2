#!/usr/bin/env node
/**
 * Auto-patch script for app.js
 * Applies 4 targeted find/replace patches to fix stair 3D exports,
 * L-shaped rendering, and executeBuildDeck routing.
 *
 * Usage:  node apply-stair-patches.js
 *
 * After running, delete this script and commit the updated app.js.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'app.js');

// ---------------------------------------------------------------
// PATCHES  (order matters: 1 must run before 2)
// ---------------------------------------------------------------
const patches = [
  {
    name: 'PATCH 1: Remove premature window.stair3DFunctions export block',
    find: [
      '// Make functions globally accessible',
      'window.stair3DFunctions = {',
      '    initStairGroup,',
      '    disposeStairGroup,',
      '    createStairs,',
      '    createStraightStair: createStairs,',
      '    getStairWorldPosition,',
      '    getStairRotation,',
      '    stairMeshes: () => stairMeshes,',
      '    stairGroup: () => stairGroup',
      '};',
      '',
      "console.log('Straight Stair 3D Geometry loaded');",
      '',
      '// ===========================================',
      '// HIGHLIGHT/SELECTION VISUAL FEEDBACK',
      '// ==========================================='
    ].join('\n'),
    replace: [
      '// ===========================================',
      '// HIGHLIGHT/SELECTION VISUAL FEEDBACK',
      '// ==========================================='
    ].join('\n')
  },
  {
    name: 'PATCH 2: Add complete stair3DFunctions export (with highlight + dragPreview)',
    find: [
      '// ===========================================',
      '// EXPORTS / GLOBAL ACCESS',
      '// ===========================================',
      '',
      '',
      '// ============================================================================',
      '// AGENT 3: DRAG INTERACTION & RAILING INTEGRATION'
    ].join('\n'),
    replace: [
      '// ===========================================',
      '// EXPORTS / GLOBAL ACCESS',
      '// ===========================================',
      '',
      '// Make functions globally accessible (including highlight/drag preview)',
      'window.stair3DFunctions = {',
      '    initStairGroup,',
      '    disposeStairGroup,',
      '    createStairs,',
      '    createStraightStair: createStairs,',
      '    getStairWorldPosition,',
      '    getStairRotation,',
      '    highlightStair,',
      '    showStairDragPreview,',
      '    stairMeshes: () => stairMeshes,',
      '    stairGroup: () => stairGroup',
      '};',
      '',
      "console.log('Straight Stair 3D Geometry loaded');",
      '',
      '',
      '// ============================================================================',
      '// AGENT 3: DRAG INTERACTION & RAILING INTEGRATION'
    ].join('\n')
  },
  {
    name: 'PATCH 3: Remove force-straight override in createStairs',
    find: '        // Force straight shape for now\n        const stairConfig = { ...stair, shape: \'straight\' };',
    replace: '        // Use the stair\'s actual shape (l-shaped patch handles dispatch)\n        const stairConfig = { ...stair };'
  },
  {
    name: 'PATCH 4: Fix executeBuildDeck to route through window.stair3DFunctions',
    find: [
      '                // Create stairs if enabled',
      '        if (state.stairsEnabled && state.stairs && state.stairs.length > 0) {',
      '            // Ensure stair group is initialized first',
      '            if (typeof initStairGroup === \'function\') {',
      '                initStairGroup();',
      '            } else if (window.stair3DFunctions && window.stair3DFunctions.initStairGroup) {',
      '                window.stair3DFunctions.initStairGroup();',
      '            }',
      '            ',
      '            // Now create the stairs',
      '            if (typeof createStairs === \'function\') {',
      '                createStairs();',
      '            } else if (window.stair3DFunctions && window.stair3DFunctions.createStairs) {',
      '                window.stair3DFunctions.createStairs();',
      '            }',
      '        }'
    ].join('\n'),
    replace: [
      '                // Create stairs if enabled',
      '        if (state.stairsEnabled && state.stairs && state.stairs.length > 0) {',
      '            // Always route through window.stair3DFunctions so the L-shape patch is respected',
      '            if (window.stair3DFunctions) {',
      '                window.stair3DFunctions.initStairGroup();',
      '                window.stair3DFunctions.createStairs();',
      '            } else {',
      '                initStairGroup();',
      '                createStairs();',
      '            }',
      '        }'
    ].join('\n')
  }
];

// ---------------------------------------------------------------
// RUNNER
// ---------------------------------------------------------------
console.log('Reading', FILE, '...');
let src = fs.readFileSync(FILE, 'utf8');
const originalLength = src.length;
let applied = 0;

for (const patch of patches) {
  const idx = src.indexOf(patch.find);
  if (idx === -1) {
    console.error('  SKIP  ' + patch.name);
    console.error('         Could not locate search string (already applied or file changed).');
    continue;
  }
  src = src.slice(0, idx) + patch.replace + src.slice(idx + patch.find.length);
  applied++;
  console.log('  OK    ' + patch.name);
}

if (applied === 0) {
  console.log('\nNo patches applied. File unchanged.');
  process.exit(1);
}

fs.writeFileSync(FILE, src, 'utf8');
console.log(`\nDone. ${applied}/${patches.length} patches applied.`);
console.log(`File size: ${originalLength} -> ${src.length} bytes`);
console.log('\nNext steps:');
console.log('  1. Review the changes in app.js');
console.log('  2. Delete this script: rm apply-stair-patches.js');
console.log('  3. Commit: git add app.js && git commit -m "fix: stair 3D exports and L-shape support"');
