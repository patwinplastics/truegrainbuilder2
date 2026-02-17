// ============================================================================
// STAIR UI WIRING PATCH - Step 3
// ============================================================================
// Wires the L-shape UI controls (shape radio, turn direction, landing depth,
// landing split) to the patched stair data model from Step 2.
//
// Load order: app.js -> stair-data-model-patch.js -> this file -> init.js
//   <script src="stair-ui-wiring-patch.js"></script>
// ============================================================================

(function () {
    'use strict';

    // ========================================================================
    // CONSTANTS: Map between HTML radio values and data model values
    // ========================================================================
    var SHAPE_HTML_TO_MODEL = {
        'straight': 'straight',
        'l-shape': 'l-shaped'
    };
    var SHAPE_MODEL_TO_HTML = {
        'straight': 'straight',
        'l-shaped': 'l-shape'
    };

    // ========================================================================
    // HELPER: Get the currently selected stair from state
    // ========================================================================
    function getSelectedStair() {
        if (!state.selectedStairId) return null;
        return state.stairs.find(function (s) { return s.id === state.selectedStairId; });
    }

    // ========================================================================
    // HELPER: Update L-shape info card with calculated dimensions
    // ========================================================================
    function updateLShapeInfoCard(stair) {
        if (!stair || stair.shape !== 'l-shaped') return;

        var dims = window.stairFunctions.calculateStairDimensions(stair);
        if (!dims || !dims.lShapedData) return;

        var ld = dims.lShapedData;

        var lowerStepsEl = document.getElementById('lShapeLowerSteps');
        var upperStepsEl = document.getElementById('lShapeUpperSteps');
        var landingHeightEl = document.getElementById('lShapeLandingHeight');
        var lowerRunEl = document.getElementById('lShapeLowerRun');
        var upperRunEl = document.getElementById('lShapeUpperRun');

        if (lowerStepsEl) lowerStepsEl.textContent = ld.treadsBeforeLanding;
        if (upperStepsEl) upperStepsEl.textContent = ld.treadsAfterLanding;
        if (landingHeightEl) {
            var heightFt = (ld.heightAtLanding / 12).toFixed(1);
            landingHeightEl.textContent = heightFt + ' ft (' + Math.round(ld.heightAtLanding) + '")';
        }
        if (lowerRunEl) lowerRunEl.textContent = ld.run1Feet.toFixed(1) + ' ft';
        if (upperRunEl) upperRunEl.textContent = ld.run2Feet.toFixed(1) + ' ft';
    }

    // ========================================================================
    // HELPER: Update the main stair info card (step count, total run, rise)
    // ========================================================================
    function updateStairInfoCard(stair) {
        if (!stair) return;

        var dims = window.stairFunctions.calculateStairDimensions(stair);
        if (!dims) return;

        var stepCountEl = document.getElementById('stairStepCount');
        var totalRunEl = document.getElementById('stairTotalRun');
        var risePerStepEl = document.getElementById('stairRisePerStep');

        if (stepCountEl) stepCountEl.textContent = dims.numTreads;
        if (totalRunEl) totalRunEl.textContent = dims.totalRunFeet.toFixed(1) + ' ft';
        if (risePerStepEl) risePerStepEl.textContent = dims.actualRise.toFixed(1) + '"';
    }

    // ========================================================================
    // HELPER: Update tread depth display
    // ========================================================================
    function updateTreadDepthDisplay(stair) {
        if (!stair) return;
        var dims = window.stairFunctions.calculateStairDimensions(stair);
        if (!dims) return;

        var treadDepthEl = document.getElementById('treadDepthDisplay');
        if (treadDepthEl) treadDepthEl.textContent = dims.treadDepth.toFixed(1) + '"';
    }

    // ========================================================================
    // POPULATE: Fill all L-shape controls from a stair's current state
    // Called whenever the stair editor is opened or stair selection changes.
    // ========================================================================
    function populateLShapeControls(stair) {
        if (!stair) return;

        // --- Shape radio ---
        var htmlShapeValue = SHAPE_MODEL_TO_HTML[stair.shape] || 'straight';
        document.querySelectorAll('input[name="stairShape"]').forEach(function (radio) {
            var isMatch = radio.value === htmlShapeValue;
            radio.checked = isMatch;
            var card = radio.closest('.radio-card');
            if (card) {
                if (isMatch) {
                    card.classList.add('selected');
                } else {
                    card.classList.remove('selected');
                }
            }
        });

        // --- L-shape options panel visibility ---
        var lShapeOptions = document.getElementById('lShapeOptions');
        if (lShapeOptions) {
            if (stair.shape === 'l-shaped') {
                lShapeOptions.classList.remove('hidden');
            } else {
                lShapeOptions.classList.add('hidden');
            }
        }

        // --- Turn direction radio ---
        var turnDir = stair.turnDirection || 'left';
        document.querySelectorAll('input[name="stairTurnDirection"]').forEach(function (radio) {
            var isMatch = radio.value === turnDir;
            radio.checked = isMatch;
            var card = radio.closest('.radio-card');
            if (card) {
                if (isMatch) {
                    card.classList.add('selected');
                } else {
                    card.classList.remove('selected');
                }
            }
        });

        // --- Landing depth slider/input ---
        var landingDepthVal = stair.landingDepth;
        if (typeof landingDepthVal !== 'number') {
            landingDepthVal = CONFIG.stairs.landingDepth;
        }
        var ldSlider = document.getElementById('landingDepthSlider');
        var ldInput = document.getElementById('landingDepthInput');
        if (ldSlider) ldSlider.value = landingDepthVal;
        if (ldInput) ldInput.value = landingDepthVal;

        // --- Landing split slider/input (model is 0-1, UI is 25-75%) ---
        var landingSplitVal = stair.landingSplit;
        if (typeof landingSplitVal !== 'number') {
            landingSplitVal = 0.5;
        }
        var splitPercent = Math.round(landingSplitVal * 100);
        var lsSlider = document.getElementById('landingSplitSlider');
        var lsInput = document.getElementById('landingSplitInput');
        if (lsSlider) lsSlider.value = splitPercent;
        if (lsInput) lsInput.value = splitPercent;

        // --- Update info cards ---
        updateLShapeInfoCard(stair);
        updateStairInfoCard(stair);
        updateTreadDepthDisplay(stair);
    }

    // ========================================================================
    // EVENT WIRING: Shape radio (straight vs l-shape)
    // ========================================================================
    document.querySelectorAll('input[name="stairShape"]').forEach(function (radio) {
        radio.addEventListener('change', function (e) {
            // Update radio card selected state
            document.querySelectorAll('input[name="stairShape"]').forEach(function (r) {
                var card = r.closest('.radio-card');
                if (card) card.classList.remove('selected');
            });
            var selectedCard = e.target.closest('.radio-card');
            if (selectedCard) selectedCard.classList.add('selected');

            // Map HTML value to model value
            var modelShape = SHAPE_HTML_TO_MODEL[e.target.value] || 'straight';

            // Toggle L-shape options panel
            var lShapeOptions = document.getElementById('lShapeOptions');
            if (lShapeOptions) {
                if (modelShape === 'l-shaped') {
                    lShapeOptions.classList.remove('hidden');
                } else {
                    lShapeOptions.classList.add('hidden');
                }
            }

            // Update the selected stair in state
            var stair = getSelectedStair();
            if (stair) {
                updateStair(stair.id, { shape: modelShape });

                // Refresh info cards
                var updated = getSelectedStair();
                updateLShapeInfoCard(updated);
                updateStairInfoCard(updated);
            }
        });
    });

    // ========================================================================
    // EVENT WIRING: Turn direction radio (left vs right)
    // ========================================================================
    document.querySelectorAll('input[name="stairTurnDirection"]').forEach(function (radio) {
        radio.addEventListener('change', function (e) {
            // Update radio card selected state
            document.querySelectorAll('input[name="stairTurnDirection"]').forEach(function (r) {
                var card = r.closest('.radio-card');
                if (card) card.classList.remove('selected');
            });
            var selectedCard = e.target.closest('.radio-card');
            if (selectedCard) selectedCard.classList.add('selected');

            // Update stair
            var stair = getSelectedStair();
            if (stair) {
                updateStair(stair.id, { turnDirection: e.target.value });

                // Refresh info card (turn direction affects L-shape geometry)
                var updated = getSelectedStair();
                updateLShapeInfoCard(updated);
            }
        });
    });

    // ========================================================================
    // EVENT WIRING: Landing depth slider + number input
    // ========================================================================
    var landingDepthSlider = document.getElementById('landingDepthSlider');
    var landingDepthInput = document.getElementById('landingDepthInput');

    if (landingDepthSlider && landingDepthInput) {
        landingDepthSlider.addEventListener('input', function (e) {
            var val = parseFloat(e.target.value);
            landingDepthInput.value = val;

            var stair = getSelectedStair();
            if (stair) {
                updateStair(stair.id, { landingDepth: val });
                var updated = getSelectedStair();
                updateLShapeInfoCard(updated);
                updateStairInfoCard(updated);
            }
        });

        landingDepthInput.addEventListener('change', function (e) {
            var val = parseFloat(e.target.value);
            // Clamp to min 3, max 6
            val = Math.max(3, Math.min(6, isNaN(val) ? 3 : val));
            e.target.value = val;
            landingDepthSlider.value = val;

            var stair = getSelectedStair();
            if (stair) {
                updateStair(stair.id, { landingDepth: val });
                var updated = getSelectedStair();
                updateLShapeInfoCard(updated);
                updateStairInfoCard(updated);
            }
        });
    }

    // ========================================================================
    // EVENT WIRING: Landing split slider + number input (UI: 25-75%, model: 0-1)
    // ========================================================================
    var landingSplitSlider = document.getElementById('landingSplitSlider');
    var landingSplitInput = document.getElementById('landingSplitInput');

    if (landingSplitSlider && landingSplitInput) {
        landingSplitSlider.addEventListener('input', function (e) {
            var pct = parseInt(e.target.value, 10);
            landingSplitInput.value = pct;

            var stair = getSelectedStair();
            if (stair) {
                updateStair(stair.id, { landingSplit: pct / 100 });
                var updated = getSelectedStair();
                updateLShapeInfoCard(updated);
                updateStairInfoCard(updated);
            }
        });

        landingSplitInput.addEventListener('change', function (e) {
            var pct = parseInt(e.target.value, 10);
            // Clamp to 25-75
            pct = Math.max(25, Math.min(75, isNaN(pct) ? 50 : pct));
            e.target.value = pct;
            landingSplitSlider.value = pct;

            var stair = getSelectedStair();
            if (stair) {
                updateStair(stair.id, { landingSplit: pct / 100 });
                var updated = getSelectedStair();
                updateLShapeInfoCard(updated);
                updateStairInfoCard(updated);
            }
        });
    }

    // ========================================================================
    // HOOK: Patch the stair editor open flow to populate L-shape controls
    // ========================================================================
    // The existing stair system calls selectStair() and then shows the editor.
    // We hook into state changes to detect when selectedStairId changes,
    // and populate our L-shape controls accordingly.
    // ========================================================================

    var lastSelectedStairId = state.selectedStairId;

    subscribe(function () {
        // Only act when selected stair changes
        if (state.selectedStairId !== lastSelectedStairId) {
            lastSelectedStairId = state.selectedStairId;

            var stair = getSelectedStair();
            if (stair) {
                populateLShapeControls(stair);
            }
        }

        // Also refresh info cards on any state change (deck height changes
        // affect stair calculations even without changing selected stair)
        var currentStair = getSelectedStair();
        if (currentStair) {
            updateStairInfoCard(currentStair);
            updateTreadDepthDisplay(currentStair);
            if (currentStair.shape === 'l-shaped') {
                updateLShapeInfoCard(currentStair);
            }
        }
    });

    // ========================================================================
    // HOOK: Patch the existing stair editor populateStairEditor function
    // (if it exists) to also call our populateLShapeControls
    // ========================================================================
    if (typeof window.populateStairEditor === 'function') {
        var originalPopulateStairEditor = window.populateStairEditor;
        window.populateStairEditor = function (stair) {
            originalPopulateStairEditor(stair);
            populateLShapeControls(stair);
        };
    }

    // Also check if openStairEditor exists and patch it
    if (typeof window.openStairEditor === 'function') {
        var originalOpenStairEditor = window.openStairEditor;
        window.openStairEditor = function (stair) {
            originalOpenStairEditor(stair);
            populateLShapeControls(stair);
        };
    }

    // ========================================================================
    // INITIAL POPULATE: If a stair is already selected on page load
    // ========================================================================
    var initialStair = getSelectedStair();
    if (initialStair) {
        populateLShapeControls(initialStair);
    }

    // ========================================================================
    // EXPORT: Make functions available for other patches/debugging
    // ========================================================================
    window.stairUIWiring = {
        populateLShapeControls: populateLShapeControls,
        updateLShapeInfoCard: updateLShapeInfoCard,
        updateStairInfoCard: updateStairInfoCard,
        updateTreadDepthDisplay: updateTreadDepthDisplay,
        SHAPE_HTML_TO_MODEL: SHAPE_HTML_TO_MODEL,
        SHAPE_MODEL_TO_HTML: SHAPE_MODEL_TO_HTML
    };

    console.log('Stair UI wiring patch loaded (Step 3): shape, turn direction, landing depth, landing split');

})();
