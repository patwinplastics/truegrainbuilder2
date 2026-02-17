// ============================================================================
// STAIR DATA MODEL PATCH - Step 2
// ============================================================================
// This patch file updates three functions to support per-stair landing config
// and enable L-shaped stairs in the 3D view.
//
// Load this AFTER app.js via a <script> tag:
//   <script src="stair-data-model-patch.js"></script>
// ============================================================================

(function () {
    'use strict';

    // ========================================================================
    // PATCH 1: addStair() - Add landingDepth and landingSplit to new stairs
    // ========================================================================
    const originalAddStair = window.stairFunctions.addStair;

    function patchedAddStair(edge) {
        // Check if deck height is sufficient
        if (state.deckHeight < CONFIG.stairs.minDeckHeightForStairs) {
            console.warn('Deck height too low for stairs');
            return null;
        }

        const newStair = {
            id: window.stairFunctions.generateStairId(),
            enabled: true,
            edge: edge,                             // 'front', 'back', 'left', 'right'
            position: 0.5,                          // 0-1 along edge (0.5 = center)
            width: CONFIG.stairs.defaultWidth,
            boardsPerTread: CONFIG.stairs.boardsPerTread.default,
            shape: 'straight',                      // 'straight' or 'l-shaped'
            turnDirection: 'left',                   // 'left' or 'right' (for l-shaped)
            includeHandrails: true,
            landingDepth: CONFIG.stairs.landingDepth, // feet (default 3), used by L-shaped
            landingSplit: 0.5                         // 0-1, fraction of treads before landing
        };

        // Record for undo
        if (window.historyManager) {
            window.historyManager.recordAction('ADD_STAIR', { stair: newStair });
        }

        const updatedStairs = [...state.stairs, newStair];
        updateState({
            stairs: updatedStairs,
            selectedStairId: newStair.id,
            stairsEnabled: true
        });

        return newStair;
    }

    // Replace on both the global function and the exported object
    window.stairFunctions.addStair = patchedAddStair;
    // Also replace the global addStair if it exists at window scope
    if (typeof window.addStair === 'function') {
        window.addStair = patchedAddStair;
    }

    // ========================================================================
    // PATCH 2: calculateLShapedDimensions() - Use per-stair landingDepth
    //          and landingSplit instead of hardcoded values
    // ========================================================================

    // We replace the global function directly
    window.calculateLShapedDimensions = function (
        numRisers, numTreads, actualRise, treadDepth, turnDirection,
        perStairLandingDepth, perStairLandingSplit
    ) {
        // Use per-stair values, falling back to CONFIG defaults
        var landingDepthFeet = (typeof perStairLandingDepth === 'number')
            ? perStairLandingDepth
            : CONFIG.stairs.landingDepth;
        var landingSplit = (typeof perStairLandingSplit === 'number')
            ? perStairLandingSplit
            : 0.5;

        // Split treads according to landingSplit
        var treadsBeforeLanding = Math.max(1, Math.round(numTreads * landingSplit));
        // Ensure at least 1 tread after landing too
        if (treadsBeforeLanding >= numTreads) {
            treadsBeforeLanding = numTreads - 1;
        }
        var treadsAfterLanding = numTreads - treadsBeforeLanding;

        var landingDepthInches = landingDepthFeet * 12;

        // Run for each flight
        var run1Inches = treadsBeforeLanding * treadDepth;
        var run2Inches = treadsAfterLanding * treadDepth;

        // Height at landing
        var risersBeforeLanding = treadsBeforeLanding + 1; // +1 because landing counts as a step
        var heightAtLanding = risersBeforeLanding * actualRise;

        return {
            treadsBeforeLanding: treadsBeforeLanding,
            treadsAfterLanding: treadsAfterLanding,
            risersBeforeLanding: risersBeforeLanding,
            risersAfterLanding: numRisers - risersBeforeLanding,
            landingDepthInches: landingDepthInches,
            landingDepthFeet: landingDepthFeet,
            run1Inches: run1Inches,
            run2Inches: run2Inches,
            run1Feet: run1Inches / 12,
            run2Feet: run2Inches / 12,
            heightAtLanding: heightAtLanding,
            turnDirection: turnDirection,
            landingSplit: landingSplit
        };
    };

    // Also make it available as a plain global for existing callers
    calculateLShapedDimensions = window.calculateLShapedDimensions;

    // ========================================================================
    // PATCH 3: calculateStairDimensions() - Thread per-stair landing config
    //          into calculateLShapedDimensions()
    // ========================================================================

    window.stairFunctions.calculateStairDimensions = function (stairConfig) {
        var deckHeightInches = state.deckHeight * 12;
        var targetRise = CONFIG.stairs.riserHeight.target;

        // Calculate number of risers
        var numRisers = Math.round(deckHeightInches / targetRise);
        numRisers = Math.max(1, numRisers);

        // Calculate actual rise per step
        var actualRise = deckHeightInches / numRisers;

        // Ensure rise is within code limits
        if (actualRise > CONFIG.stairs.riserHeight.max) {
            numRisers = Math.ceil(deckHeightInches / CONFIG.stairs.riserHeight.max);
            actualRise = deckHeightInches / numRisers;
        } else if (actualRise < CONFIG.stairs.riserHeight.min) {
            numRisers = Math.floor(deckHeightInches / CONFIG.stairs.riserHeight.min);
            numRisers = Math.max(1, numRisers);
            actualRise = deckHeightInches / numRisers;
        }

        var numTreads = numRisers - 1;

        // Tread depth
        var boardWidthInches = CONFIG.boards.width;
        var gapInches = CONFIG.boards.gap;
        var boardsPerTread = stairConfig.boardsPerTread || CONFIG.stairs.boardsPerTread.default;
        var treadDepth = (boardsPerTread * boardWidthInches) + ((boardsPerTread - 1) * gapInches);

        // Total run
        var totalRunInches = numTreads * treadDepth;
        var totalRunFeet = totalRunInches / 12;

        // Stair width
        var stairWidthFeet = stairConfig.width || CONFIG.stairs.defaultWidth;
        var stairWidthInches = stairWidthFeet * 12;

        // L-shaped calculations - NOW uses per-stair landingDepth and landingSplit
        var lShapedData = null;
        if (stairConfig.shape === 'l-shaped') {
            lShapedData = calculateLShapedDimensions(
                numRisers,
                numTreads,
                actualRise,
                treadDepth,
                stairConfig.turnDirection || 'left',
                stairConfig.landingDepth,     // per-stair landing depth
                stairConfig.landingSplit       // per-stair landing split
            );
        }

        return {
            numRisers: numRisers,
            numTreads: numTreads,
            actualRise: actualRise,
            treadDepth: treadDepth,
            totalRunInches: totalRunInches,
            totalRunFeet: totalRunFeet,
            stairWidthFeet: stairWidthFeet,
            stairWidthInches: stairWidthInches,
            boardsPerTread: boardsPerTread,
            deckHeightInches: deckHeightInches,
            lShapedData: lShapedData,
            isValid: numTreads >= 1 && actualRise >= CONFIG.stairs.riserHeight.min
        };
    };

    // ========================================================================
    // NOTE: PATCH 4 (createStairs override) has been REMOVED.
    // The L-shape-aware createStairs() lives in stair-3d-lshape-patch.js
    // which loads AFTER this file and correctly dispatches between straight
    // and L-shaped rendering. The previous PATCH 4 here was overwriting
    // that dispatcher with a straight-only renderer, preventing L-shape
    // stairs from ever rendering.
    // ========================================================================

    // ========================================================================
    // PATCH 5: Backfill existing stairs in state that lack the new fields
    // ========================================================================
    if (state.stairs && state.stairs.length > 0) {
        var patched = false;
        state.stairs.forEach(function (s) {
            if (typeof s.landingDepth === 'undefined') {
                s.landingDepth = CONFIG.stairs.landingDepth;
                patched = true;
            }
            if (typeof s.landingSplit === 'undefined') {
                s.landingSplit = 0.5;
                patched = true;
            }
        });
        if (patched) {
            console.log('Stair data model patch: backfilled landingDepth/landingSplit on existing stairs');
        }
    }

    console.log('Stair data model patch loaded (Step 2): landingDepth, landingSplit, L-shape enabled');

})();
