// ============================================================================
// L-SHAPED STAIR 3D GEOMETRY PATCH
// File: stair-3d-lshape-patch.js
// Purpose: Adds L-shaped stair rendering with landing platform (same deck
//          board material/color as treads) and stringers that follow the turn.
// Dependencies: app.js (Agent 1 calculations, Agent 2 straight-stair 3D)
// Integration: Load this script AFTER app.js. It monkey-patches createStairs()
//              to dispatch to createLShapedStair() when shape === 'l-shaped'.
// ============================================================================

(function () {
    'use strict';

    // ========================================================================
    // CONSTANTS (pulled from CONFIG at call-time so hot-reloads work)
    // ========================================================================
    function cfg() {
        return {
            boardWidthFt:     CONFIG.boards.width / 12,
            boardThicknessFt: CONFIG.boards.thickness / 12,
            gapFt:            CONFIG.boards.gap / 12,
            stringerThickness: CONFIG.stairs.stringerThickness / 12,
            stringerWidth:     CONFIG.stairs.stringerWidth / 12,
            stringerInset:     CONFIG.stairs.stringerInset / 12,
        };
    }

    // ========================================================================
    // PATCHED createStairs  ---- removes the "force straight" override
    // ========================================================================
    const _originalCreateStairs = createStairs;   // keep ref in case we need it

    function createStairsPatched() {
        // --- group management (identical to original) ---
        if (!stairGroup) {
            initStairGroup();
        } else {
            disposeStairGroup();
            stairGroup = new THREE.Group();
            stairGroup.name = 'stairGroup';
            scene.add(stairGroup);
        }

        if (!state.stairsEnabled || state.stairs.length === 0) return;

        var colorConfig =
            CONFIG.colors.find(function (c) { return c.id === state.mainColor; }) ||
            CONFIG.colors[0];

        for (var i = 0; i < state.stairs.length; i++) {
            var stair = state.stairs[i];

            // ---- KEY CHANGE: honour the actual shape ----
            var dims = window.stairFunctions.calculateStairDimensions(stair);
            if (!dims.isValid) continue;

            var stairMeshGroup = new THREE.Group();
            stairMeshGroup.name  = 'stair_' + stair.id;
            stairMeshGroup.userData = { stairId: stair.id, type: 'stair' };

            if (stair.shape === 'l-shaped' && dims.lShapedData) {
                buildLShapedStair(stair, dims, stairMeshGroup, colorConfig);
            } else {
                // straight (unchanged logic)
                createStairStringers(stair, dims, stairMeshGroup);
                createStairTreadsAndRisers(stair, dims, stairMeshGroup, colorConfig);
                if (stair.includeHandrails) {
                    createStairHandrails(stair, dims, stairMeshGroup);
                }
            }

            // Position + rotate onto correct deck edge
            var worldPos = getStairWorldPosition(stair, dims);
            var rotation = getStairRotation(stair.edge);

            stairMeshGroup.position.set(worldPos.x, 0, worldPos.z);
            stairMeshGroup.rotation.y = rotation;

            stairGroup.add(stairMeshGroup);
            stairMeshes[stair.id] = stairMeshGroup;
        }
    }

    // Replace the global
    window.createStairs = createStairsPatched;
    if (window.stair3DFunctions) {
        window.stair3DFunctions.createStairs = createStairsPatched;
        window.stair3DFunctions.createStraightStair = createStairsPatched;
    }

    // ========================================================================
    // buildLShapedStair  ---- orchestrator for one L-shaped stair
    // ========================================================================
    function buildLShapedStair(stairConfig, dims, parentGroup, colorConfig) {
        var ld = dims.lShapedData;
        if (!ld) return;

        var c = cfg();
        var stairW        = dims.stairWidthFeet;
        var risePerStep   = dims.actualRise / 12;          // feet
        var treadDepthFt  = dims.treadDepth / 12;          // feet
        var landingDepthFt = ld.landingDepthFeet;           // feet (default 3)
        var turnDir       = ld.turnDirection;               // 'left' | 'right'
        var sign          = (turnDir === 'left') ? -1 : 1; // X multiplier

        // ---- flight geometry ----
        var run1Ft   = ld.run1Feet;
        var run2Ft   = ld.run2Feet;
        var rise1Ft  = ld.risersBeforeLanding * risePerStep;
        var rise2Ft  = ld.risersAfterLanding  * risePerStep;
        var landingY = state.deckHeight - rise1Ft;          // Y of landing surface

        // ================================================================
        // 1.  FLIGHT 1  ---- treads, risers, stringers  (deck down to landing)
        // ================================================================
        buildFlightTreadsAndRisers({
            stairConfig:   stairConfig,
            dims:          dims,
            colorConfig:   colorConfig,
            parentGroup:   parentGroup,
            numTreads:     ld.treadsBeforeLanding,
            numRisers:     ld.risersBeforeLanding,
            risePerStep:   risePerStep,
            treadDepthFt:  treadDepthFt,
            stairWidthFt:  stairW,
            startY:        state.deckHeight,
            startZ:        0,
            dirZ:          -1,     // treads march in -Z
            dirX:          0,
            originX:       0,
            originZ:       0,
            flightLabel:   'f1'
        });

        buildFlightStringers({
            parentGroup:   parentGroup,
            stairWidthFt:  stairW,
            riseFt:        rise1Ft,
            runFt:         run1Ft,
            startY:        state.deckHeight,
            startZ:        0,
            dirZ:          -1,
            dirX:          0,
            originX:       0,
            originZ:       0,
            flightLabel:   'f1'
        });

        // ================================================================
        // 2.  LANDING PLATFORM  ---- same deck board material/color
        // ================================================================
        var landingCenterZ = -run1Ft - landingDepthFt / 2;

        buildLandingPlatform({
            parentGroup:    parentGroup,
            colorConfig:    colorConfig,
            stairWidthFt:   stairW,
            landingDepthFt: landingDepthFt,
            landingY:       landingY,
            centerX:        0,
            centerZ:        landingCenterZ,
            turnSign:       sign,
            run2Ft:         run2Ft,
            flightLabel:    'landing'
        });

        // Landing riser (face at top of flight-1 landing edge)
        buildLandingRiser({
            parentGroup:   parentGroup,
            colorConfig:   colorConfig,
            stairWidthFt:  stairW,
            risePerStep:   risePerStep,
            landingY:      landingY,
            riserZ:        -run1Ft,
            flightLabel:   'landing_riser'
        });

        // ================================================================
        // 3.  FLIGHT 2  ---- treads, risers, stringers  (landing down to ground)
        //     Flight 2 exits perpendicular to Flight 1 (left or right).
        //     In local stair space: flight 2 marches along +X or -X.
        // ================================================================
        var f2OriginX = 0;
        var f2OriginZ = -run1Ft - landingDepthFt;

        buildFlightTreadsAndRisers({
            stairConfig:   stairConfig,
            dims:          dims,
            colorConfig:   colorConfig,
            parentGroup:   parentGroup,
            numTreads:     ld.treadsAfterLanding,
            numRisers:     ld.risersAfterLanding,
            risePerStep:   risePerStep,
            treadDepthFt:  treadDepthFt,
            stairWidthFt:  stairW,
            startY:        landingY,
            startZ:        0,
            dirZ:          0,
            dirX:          sign,
            originX:       f2OriginX,
            originZ:       f2OriginZ,
            flightLabel:   'f2'
        });

        buildFlightStringers({
            parentGroup:   parentGroup,
            stairWidthFt:  stairW,
            riseFt:        rise2Ft,
            runFt:         run2Ft,
            startY:        landingY,
            startZ:        0,
            dirZ:          0,
            dirX:          sign,
            originX:       f2OriginX,
            originZ:       f2OriginZ,
            flightLabel:   'f2'
        });

        // ================================================================
        // 4.  HANDRAILS  (optional, both flights)
        // ================================================================
        if (stairConfig.includeHandrails) {
            buildFlightHandrails({
                parentGroup:  parentGroup,
                stairWidthFt: stairW,
                riseFt:       rise1Ft,
                runFt:        run1Ft,
                startY:       state.deckHeight,
                originX:      0,
                originZ:      0,
                dirZ:         -1,
                dirX:         0,
                flightLabel:  'f1'
            });
            buildFlightHandrails({
                parentGroup:  parentGroup,
                stairWidthFt: stairW,
                riseFt:       rise2Ft,
                runFt:        run2Ft,
                startY:       landingY,
                originX:      f2OriginX,
                originZ:      f2OriginZ,
                dirZ:         0,
                dirX:         sign,
                flightLabel:  'f2'
            });
        }
    }

    // ========================================================================
    // buildFlightTreadsAndRisers
    //   Generic: works for any direction by using (dirX, dirZ) unit vector.
    //   The "depth" axis of each tread is always perpendicular to (dirX,dirZ).
    // ========================================================================
    function buildFlightTreadsAndRisers(p) {
        var c = cfg();
        var boardLength = selectOptimalBoardLength(p.stairWidthFt);

        for (var step = 0; step < p.numTreads; step++) {
            var stepY = p.startY - (step + 1) * p.risePerStep;

            // How far along the run direction this step sits
            var runOffset = (step + 1) * p.treadDepthFt;

            // Center of tread cluster along run
            var cx = p.originX + p.dirX * (runOffset - p.treadDepthFt / 2);
            var cz = p.originZ + p.dirZ * (runOffset - p.treadDepthFt / 2);

            // Determine geometry orientation
            // If flight runs along Z, treads are wide in X (normal)
            // If flight runs along X, treads are wide in Z
            var runsAlongX = Math.abs(p.dirX) > 0.5;

            for (var board = 0; board < p.dims.boardsPerTread; board++) {
                // Offset each board within the tread depth
                var boardOff = -p.treadDepthFt / 2
                    + board * (c.boardWidthFt + c.gapFt)
                    + c.boardWidthFt / 2;

                var bx = cx + p.dirX * boardOff;
                var bz = cz + p.dirZ * boardOff;

                var mat = createBoardMaterial(
                    p.colorConfig, boardLength, false,
                    'lt_' + p.flightLabel + '_' + step + '_' + board
                );

                var geom;
                if (runsAlongX) {
                    // Flight along X: tread board long axis = Z
                    geom = new THREE.BoxGeometry(c.boardWidthFt, c.boardThicknessFt, p.stairWidthFt);
                } else {
                    // Flight along Z: tread board long axis = X
                    geom = new THREE.BoxGeometry(p.stairWidthFt, c.boardThicknessFt, c.boardWidthFt);
                }

                var mesh = new THREE.Mesh(geom, mat);
                mesh.position.set(bx, stepY + c.boardThicknessFt / 2, bz);
                mesh.castShadow    = true;
                mesh.receiveShadow = true;
                mesh.userData = {
                    type: 'tread', stairId: p.stairConfig.id,
                    step: step, board: board, flight: p.flightLabel
                };
                p.parentGroup.add(mesh);
            }

            // ---- riser ----
            var riserRunOff = (step + 1) * p.treadDepthFt;
            var rx = p.originX + p.dirX * (riserRunOff - p.treadDepthFt);
            var rz = p.originZ + p.dirZ * (riserRunOff - p.treadDepthFt);
            var ry = stepY - p.risePerStep / 2 + c.boardThicknessFt;

            var riserMat = createBoardMaterial(
                p.colorConfig, boardLength, false,
                'lr_' + p.flightLabel + '_' + step
            );

            var riserGeom;
            if (runsAlongX) {
                riserGeom = new THREE.BoxGeometry(c.boardThicknessFt, p.risePerStep, p.stairWidthFt);
            } else {
                riserGeom = new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, c.boardThicknessFt);
            }

            var riserMesh = new THREE.Mesh(riserGeom, riserMat);
            riserMesh.position.set(rx, ry, rz);
            riserMesh.castShadow    = true;
            riserMesh.receiveShadow = true;
            riserMesh.userData = {
                type: 'riser', stairId: p.stairConfig.id,
                step: step, flight: p.flightLabel
            };
            p.parentGroup.add(riserMesh);
        }

        // ---- top riser (at flight start / deck edge or landing edge) ----
        var topRiserMat = createBoardMaterial(
            p.colorConfig, boardLength, false,
            'lr_' + p.flightLabel + '_top'
        );
        var runsAlongX2 = Math.abs(p.dirX) > 0.5;
        var topRiserGeom;
        if (runsAlongX2) {
            topRiserGeom = new THREE.BoxGeometry(c.boardThicknessFt, p.risePerStep, p.stairWidthFt);
        } else {
            topRiserGeom = new THREE.BoxGeometry(p.stairWidthFt, p.risePerStep, c.boardThicknessFt);
        }
        var topRiser = new THREE.Mesh(topRiserGeom, topRiserMat);
        topRiser.position.set(p.originX, p.startY - p.risePerStep / 2, p.originZ);
        topRiser.castShadow    = true;
        topRiser.receiveShadow = true;
        topRiser.userData = { type: 'riser', stairId: p.stairConfig.id, step: 'top', flight: p.flightLabel };
        p.parentGroup.add(topRiser);
    }

    // ========================================================================
    // buildFlightStringers
    //   Creates two (or three) stringers per flight that actually follow the
    //   stair angle.  For each stringer we build a tilted box along the run
    //   direction.  The stringers are placed at the outer edges + optional
    //   center for wide stairs.
    // ========================================================================
    function buildFlightStringers(p) {
        var c = cfg();
        var stringerLen = Math.sqrt(p.riseFt * p.riseFt + p.runFt * p.runFt);
        var angle       = Math.atan2(p.riseFt, p.runFt);

        var halfW   = p.stairWidthFt / 2;
        var inset   = c.stringerInset;

        // Stringer lateral positions (perpendicular to run direction)
        var positions = [-halfW + inset, halfW - inset];
        if (p.stairWidthFt > 6) {
            positions.push(0); // center stringer for wide stairs
        }

        var runsAlongX = Math.abs(p.dirX) > 0.5;
        var stringerMat = createStringerMaterial();

        for (var i = 0; i < positions.length; i++) {
            var lateralOff = positions[i];

            // Stringer geometry: thickness x height x length
            var geom = new THREE.BoxGeometry(
                c.stringerThickness,
                c.stringerWidth,
                stringerLen
            );

            var mesh = new THREE.Mesh(geom, stringerMat);

            // Center point of the stringer (mid-rise, mid-run)
            var cy = p.startY - p.riseFt / 2;
            var runHalf = p.runFt / 2;

            if (runsAlongX) {
                // Flight runs along X: stringer long axis = X
                mesh.position.set(
                    p.originX + p.dirX * runHalf,
                    cy,
                    p.originZ + lateralOff
                );
                // Rotate so the box tilts along X
                mesh.rotation.z = p.dirX * angle;  // tilt upward toward origin
                mesh.rotation.y = Math.PI / 2;      // align long axis with X
            } else {
                // Flight runs along Z: stringer long axis = Z
                mesh.position.set(
                    p.originX + lateralOff,
                    cy,
                    p.originZ + p.dirZ * runHalf
                );
                mesh.rotation.x = p.dirZ * angle;   // negative dirZ => positive tilt
            }

            mesh.castShadow    = true;
            mesh.receiveShadow = true;
            mesh.userData = {
                type: 'stringer', stairId: 'lshape',
                flight: p.flightLabel, index: i
            };
            p.parentGroup.add(mesh);
        }
    }

    // ========================================================================
    // buildLandingPlatform
    //   Deck boards laid on the landing using the SAME material/color as the
    //   main deck surface (colorConfig from state.mainColor).
    //   The landing extends in the Z direction and also stretches sideways
    //   (in the turn direction) enough to meet Flight 2.
    // ========================================================================
    function buildLandingPlatform(p) {
        var c = cfg();

        // Landing footprint:
        //   Depth along Z = landingDepthFt (continues straight from flight 1)
        //   Width along X = stairWidthFt + run2 extent on the turn side
        //   We keep it simple: a rectangular platform wide enough for both flights.
        var platformWidthX  = p.stairWidthFt + p.run2Ft;
        var platformDepthZ  = Math.max(p.landingDepthFt, p.stairWidthFt);

        // Boards run along X (perpendicular to flight-1 direction) for visual
        // contrast and so they match the deck board "widthwise" look.
        var effectiveWidth = c.boardWidthFt + c.gapFt;
        var numRows = Math.ceil(platformDepthZ / effectiveWidth);
        var boardLength = selectOptimalBoardLength(platformWidthX);

        // Landing origin: the center shifts toward the turn side by half of run2
        var landingCenterX = p.centerX + p.turnSign * (p.run2Ft / 2);
        var landingCenterZ = p.centerZ;

        for (var row = 0; row < numRows; row++) {
            var zOff = -platformDepthZ / 2
                + row * effectiveWidth
                + c.boardWidthFt / 2;

            var mat = createBoardMaterial(
                p.colorConfig, boardLength, false,
                'lp_' + p.flightLabel + '_' + row
            );

            var geom = new THREE.BoxGeometry(
                platformWidthX,
                c.boardThicknessFt,
                c.boardWidthFt
            );

            var mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(
                landingCenterX,
                p.landingY + c.boardThicknessFt / 2,
                landingCenterZ + zOff
            );
            mesh.castShadow    = true;
            mesh.receiveShadow = true;
            mesh.userData = { type: 'landing_board', flight: p.flightLabel, row: row };
            p.parentGroup.add(mesh);
        }

        // ---- landing support posts (4 corners) ----
        var postMat  = createStringerMaterial();
        var postSize = 0.33;
        var postH    = p.landingY;
        if (postH <= 0) return;

        var postGeom = new THREE.BoxGeometry(postSize, postH, postSize);
        var corners  = [
            [ landingCenterX - platformWidthX / 2, landingCenterZ - platformDepthZ / 2 ],
            [ landingCenterX + platformWidthX / 2, landingCenterZ - platformDepthZ / 2 ],
            [ landingCenterX + platformWidthX / 2, landingCenterZ + platformDepthZ / 2 ],
            [ landingCenterX - platformWidthX / 2, landingCenterZ + platformDepthZ / 2 ]
        ];

        for (var j = 0; j < corners.length; j++) {
            var post = new THREE.Mesh(postGeom, postMat);
            post.position.set(corners[j][0], postH / 2, corners[j][1]);
            post.castShadow = true;
            post.userData = { type: 'landing_post' };
            p.parentGroup.add(post);
        }
    }

    // ========================================================================
    // buildLandingRiser
    //   A single riser board across the front edge of the landing (top of
    //   the last step of flight 1).
    // ========================================================================
    function buildLandingRiser(p) {
        var c = cfg();
        var boardLength = selectOptimalBoardLength(p.stairWidthFt);

        var mat = createBoardMaterial(
            p.colorConfig, boardLength, false,
            'lr_' + p.flightLabel
        );
        var geom = new THREE.BoxGeometry(
            p.stairWidthFt,
            p.risePerStep,
            c.boardThicknessFt
        );

        var mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(
            0,
            p.landingY - p.risePerStep / 2 + c.boardThicknessFt,
            p.riserZ
        );
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        mesh.userData = { type: 'riser', flight: p.flightLabel };
        p.parentGroup.add(mesh);
    }

    // ========================================================================
    // buildFlightHandrails
    //   Generalized handrails that follow the flight direction vector.
    //   Posts at top/bottom + angled top rail + bottom rail + balusters.
    // ========================================================================
    function buildFlightHandrails(p) {
        var railMat = createHandrailMaterial();
        var postH   = 3;
        var postSz  = 0.29;
        var railH   = 0.29;
        var railTh  = 0.125;
        var balSz   = 0.125;
        var balSpc  = 0.33;
        var bottomOff = 0.25;

        var halfW     = p.stairWidthFt / 2;
        var angle     = Math.atan2(p.riseFt, p.runFt);
        var flightLen = Math.sqrt(p.riseFt * p.riseFt + p.runFt * p.runFt);

        var runsAlongX = Math.abs(p.dirX) > 0.5;

        // Two sides
        var sides = [-1, 1];
        for (var s = 0; s < sides.length; s++) {
            var side = sides[s];

            // Lateral position of this handrail
            var lx, lz;
            if (runsAlongX) {
                lx = 0;
                lz = p.originZ + side * halfW;
            } else {
                lx = p.originX + side * halfW;
                lz = 0;
            }

            // ---- top post (at flight start, deck/landing level) ----
            var topPostGeom = new THREE.BoxGeometry(postSz, postH, postSz);
            var topPost = new THREE.Mesh(topPostGeom, railMat);
            if (runsAlongX) {
                topPost.position.set(p.originX, p.startY + postH / 2, lz);
            } else {
                topPost.position.set(lx, p.startY + postH / 2, p.originZ);
            }
            topPost.castShadow = true;
            p.parentGroup.add(topPost);

            // ---- bottom post (at flight end, ground/landing level) ----
            var endY = p.startY - p.riseFt;
            var botPost = new THREE.Mesh(topPostGeom.clone(), railMat);
            if (runsAlongX) {
                botPost.position.set(
                    p.originX + p.dirX * p.runFt,
                    endY + postH / 2,
                    lz
                );
            } else {
                botPost.position.set(
                    lx,
                    endY + postH / 2,
                    p.originZ + p.dirZ * p.runFt
                );
            }
            botPost.castShadow = true;
            p.parentGroup.add(botPost);

            // ---- top rail (angled) ----
            var railGeom = new THREE.BoxGeometry(railTh, railH, flightLen);
            var topRail  = new THREE.Mesh(railGeom, railMat);
            var midY     = p.startY + postH - railH / 2 - p.riseFt / 2;

            if (runsAlongX) {
                topRail.position.set(
                    p.originX + p.dirX * p.runFt / 2,
                    midY,
                    lz
                );
                topRail.rotation.z = p.dirX * angle;
                topRail.rotation.y = Math.PI / 2;
            } else {
                topRail.position.set(
                    lx,
                    midY,
                    p.originZ + p.dirZ * p.runFt / 2
                );
                topRail.rotation.x = p.dirZ * angle;
            }
            topRail.castShadow = true;
            p.parentGroup.add(topRail);

            // ---- bottom rail (angled) ----
            var botRailGeom = new THREE.BoxGeometry(railTh, railH, flightLen);
            var botRail     = new THREE.Mesh(botRailGeom, railMat);
            var botMidY     = midY - (postH - bottomOff - railH);

            if (runsAlongX) {
                botRail.position.set(
                    p.originX + p.dirX * p.runFt / 2,
                    botMidY,
                    lz
                );
                botRail.rotation.z = p.dirX * angle;
                botRail.rotation.y = Math.PI / 2;
            } else {
                botRail.position.set(
                    lx,
                    botMidY,
                    p.originZ + p.dirZ * p.runFt / 2
                );
                botRail.rotation.x = p.dirZ * angle;
            }
            botRail.castShadow = true;
            p.parentGroup.add(botRail);

            // ---- balusters ----
            var numBal   = Math.floor(p.runFt / balSpc);
            var balH     = postH - railH - bottomOff - railH;
            var balGeom  = new THREE.BoxGeometry(balSz, balH, balSz);

            for (var b = 1; b < numBal; b++) {
                var t = b / numBal;
                var bal = new THREE.Mesh(balGeom, railMat);
                var by  = p.startY - t * p.riseFt + bottomOff + railH + balH / 2;

                if (runsAlongX) {
                    bal.position.set(
                        p.originX + p.dirX * t * p.runFt,
                        by,
                        lz
                    );
                } else {
                    bal.position.set(
                        lx,
                        by,
                        p.originZ + p.dirZ * t * p.runFt
                    );
                }
                bal.castShadow = true;
                p.parentGroup.add(bal);
            }
        }
    }

    // ========================================================================
    console.log('L-Shaped Stair 3D Geometry Patch loaded');
})();
