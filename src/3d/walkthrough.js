// ============================================================
// TrueGrain Deck Builder 2 — First-Person Walkthrough
// ============================================================
// Provides a PointerLock-based FPS walkthrough that lets the
// user walk around the ground, up/down stairs, and on the deck.
// Toggles cleanly with OrbitControls — no scene rebuild needed.
// ============================================================

import { state } from '../state.js';
import { calculateStairDimensions } from './stairs-3d.js';

// ── Constants ────────────────────────────────────────────────
const EYE_HEIGHT  = 1.70;   // metres (~5'7") above current surface
const MOVE_SPEED  = 0.07;   // units per frame
const GRAVITY     = 0.012;  // downward pull per frame
const SNAP_THRESH = 0.18;   // snap-to-surface tolerance
const GROUND_Y    = 0.0;    // world ground level

// ── Module state ─────────────────────────────────────────────
let _camera    = null;
let _renderer  = null;
let _controls  = null;   // OrbitControls reference (disabled while walking)
let _active    = false;
let _plc       = null;   // PointerLockControls instance

const _keys  = { w: false, s: false, a: false, d: false };
let _velY    = 0;        // vertical velocity (for step-climbing smoothing)
let _surfaces = [];      // [{minX,maxX,minZ,maxZ,y,isStair,stepData}]

// ── Public API ───────────────────────────────────────────────

/**
 * Call once from scene.js after renderer/camera/controls are ready.
 */
export function initWalkthrough(camera, renderer, orbitControls) {
    _camera   = camera;
    _renderer = renderer;
    _controls = orbitControls;
    _buildSurfaces();
}

/**
 * Re-compute walkable surfaces whenever deck is rebuilt.
 */
export function refreshWalkthroughSurfaces() {
    _buildSurfaces();
}

/**
 * Enter first-person walkthrough mode.
 * Returns false if PointerLockControls are unavailable.
 */
export function enterWalkthrough() {
    if (_active) return true;
    if (!THREE.PointerLockControls) {
        console.warn('PointerLockControls not loaded — add CDN script to index.html');
        return false;
    }
    _buildSurfaces();

    _plc = new THREE.PointerLockControls(_camera, _renderer.domElement);

    // Snap camera to deck surface entry point
    const startPos = _getStartPosition();
    _camera.position.set(startPos.x, startPos.y, startPos.z);

    _plc.addEventListener('lock',   _onLock);
    _plc.addEventListener('unlock', _onUnlock);
    _plc.lock();
    return true;
}

/**
 * Exit walkthrough mode and restore OrbitControls.
 */
export function exitWalkthrough() {
    if (!_active) return;
    _plc?.unlock();
}

export const isWalkthroughActive = () => _active;

/**
 * Call inside the main animate() loop.
 * Only runs movement logic when walkthrough is active.
 */
export function tickWalkthrough() {
    if (!_active || !_plc?.isLocked) return;

    // ── Horizontal movement ──────────────────────────────────
    const speed = MOVE_SPEED;
    if (_keys.w) _plc.moveForward(speed);
    if (_keys.s) _plc.moveForward(-speed);
    if (_keys.a) _plc.moveRight(-speed);
    if (_keys.d) _plc.moveRight(speed);

    // ── Vertical / stair / gravity ───────────────────────────
    const pos       = _camera.position;
    const surfaceY  = _getSurfaceY(pos.x, pos.z);
    const targetY   = surfaceY + EYE_HEIGHT;

    if (pos.y > targetY + SNAP_THRESH) {
        // Falling / stepping down
        _velY -= GRAVITY;
        pos.y += _velY;
        if (pos.y < targetY) { pos.y = targetY; _velY = 0; }
    } else {
        // On surface — snap smoothly
        pos.y += (targetY - pos.y) * 0.25;
        _velY  = 0;
    }

    // ── Boundary clamp ───────────────────────────────────────
    _clampToBounds(pos);
}

// ── Private helpers ──────────────────────────────────────────

function _onLock() {
    _active = true;
    if (_controls) _controls.enabled = false;
    _addKeyListeners();
    _showHUD(true);
}

function _onUnlock() {
    _active = false;
    if (_controls) _controls.enabled = true;
    _removeKeyListeners();
    _showHUD(false);
    // Restore a nice orbit camera position
    const m = Math.max(state.deckLength, state.deckWidth);
    _camera.position.set(m * 1.4, state.deckHeight + m * 0.9, m * 1.4);
    if (_controls) {
        _controls.target.set(0, state.deckHeight / 2, 0);
        _controls.update();
    }
    _plc = null;
}

function _keyDown(e) {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup')    _keys.w = true;
    if (k === 's' || k === 'arrowdown')  _keys.s = true;
    if (k === 'a' || k === 'arrowleft')  _keys.a = true;
    if (k === 'd' || k === 'arrowright') _keys.d = true;
    if (k === 'escape') exitWalkthrough();
}
function _keyUp(e) {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup')    _keys.w = false;
    if (k === 's' || k === 'arrowdown')  _keys.s = false;
    if (k === 'a' || k === 'arrowleft')  _keys.a = false;
    if (k === 'd' || k === 'arrowright') _keys.d = false;
}
function _addKeyListeners()    { window.addEventListener('keydown', _keyDown); window.addEventListener('keyup', _keyUp); }
function _removeKeyListeners() { window.removeEventListener('keydown', _keyDown); window.removeEventListener('keyup', _keyUp); Object.keys(_keys).forEach(k => _keys[k] = false); }

// ── Surface map builder ──────────────────────────────────────

/**
 * Builds a flat list of axis-aligned walkable surface boxes:
 *   deck platform, each stair tread, each landing.
 * Stair surfaces form a ramp-like cascade so the camera
 * smoothly steps up/down via the gravity/snap system.
 */
function _buildSurfaces() {
    _surfaces = [];

    const dH  = state.deckHeight;
    const dL  = state.deckLength / 2;
    const dW  = state.deckWidth  / 2;

    // Deck platform surface
    _surfaces.push({ minX: -dL, maxX: dL, minZ: -dW, maxZ: dW, y: dH });

    // Ground plane (fallback — very large)
    _surfaces.push({ minX: -200, maxX: 200, minZ: -200, maxZ: 200, y: GROUND_Y });

    // Stairs
    if (state.stairsEnabled && state.stairs?.length) {
        state.stairs.forEach(sc => {
            if (!sc.enabled) return;
            const dims = calculateStairDimensions(sc, state);
            if (!dims?.isValid) return;
            _addStairSurfaces(sc, dims);
        });
    }
}

/**
 * Converts a stair config + dims into per-tread surface entries.
 * Each tread is a thin horizontal slab the player can stand on.
 * Positions must match positionStairGroup() rotation logic from stairs-3d.js.
 */
function _addStairSurfaces(sc, dims) {
    const edge  = sc.edge   || 'front';
    const pos   = sc.pos    || sc.position || 0.5;
    const swH   = dims.stairWidthFeet / 2;
    const tdf   = dims.treadDepth / 12;
    const rps   = dims.actualRise / 12;
    const bpt   = CONFIG?.boards?.thickness / 12 || (1 / 12);

    // Translate stair local coords → world coords based on edge
    const toWorld = _makeEdgeTransform(edge, pos, state);

    if (sc.shape === 'l-shaped' && dims.lShapedData) {
        const ld     = dims.lShapedData;
        const sign   = ld.turnDirection === 'left' ? -1 : 1;
        const rbl    = ld.risersBeforeLanding;
        const landY  = state.deckHeight - rbl * rps;

        // Flight 1 treads (dirZ = -1, dirX = 0 in local space)
        for (let i = 0; i < ld.treadsBeforeLanding; i++) {
            const stepY  = state.deckHeight - (i + 1) * rps + bpt;
            const localZ = -((i + 1) * tdf);
            const localX = 0;
            const c      = toWorld(localX, localZ);
            _surfaces.push({
                minX: c.x - swH, maxX: c.x + swH,
                minZ: c.z - tdf, maxZ: c.z + tdf,
                y:    stepY
            });
        }

        // Landing
        const ldf      = ld.landingDepthFeet;
        const landRunZ = -(ld.run1Feet + ldf / 2);
        const cl       = toWorld(sign * ld.run2Feet / 2, landRunZ);
        const lw       = dims.stairWidthFeet + ld.run2Feet;
        _surfaces.push({
            minX: cl.x - lw / 2, maxX: cl.x + lw / 2,
            minZ: cl.z - ldf / 2, maxZ: cl.z + ldf / 2,
            y:    landY + bpt
        });

        // Flight 2 treads (dirX = sign, dirZ = 0)
        const ox = 0, oz = -(ld.run1Feet + ldf);
        for (let i = 0; i < ld.treadsAfterLanding; i++) {
            const stepY   = landY - (i + 1) * rps + bpt;
            const localX2 = sign * ((i + 1) * tdf);
            const c2      = toWorld(ox + localX2, oz);
            _surfaces.push({
                minX: c2.x - swH, maxX: c2.x + swH,
                minZ: c2.z - swH, maxZ: c2.z + swH,
                y:    stepY
            });
        }
    } else {
        // Straight stair — dirZ = -1 in local space (away from deck)
        for (let i = 0; i < dims.numTreads; i++) {
            const stepY  = state.deckHeight - (i + 1) * rps + bpt;
            const localZ = -((i + 1) * tdf);
            const c      = toWorld(0, localZ);
            _surfaces.push({
                minX: c.x - swH, maxX: c.x + swH,
                minZ: c.z - tdf, maxZ: c.z + tdf,
                y:    stepY
            });
        }
    }
}

/**
 * Returns a function (localX, localZ) => {x, z} that mirrors
 * positionStairGroup() from stairs-3d.js.
 */
function _makeEdgeTransform(edge, posNorm, st) {
    const EDGE_OFFSET = (1 / 12); // matches BOARD_TH offset in stairs-3d.js
    let ox = 0, oz = 0;
    switch (edge) {
        case 'front': ox = (posNorm - 0.5) * st.deckLength; oz = st.deckWidth / 2 + EDGE_OFFSET; break;
        case 'back':  ox = (posNorm - 0.5) * st.deckLength; oz = -(st.deckWidth / 2 + EDGE_OFFSET); break;
        case 'left':  ox = -(st.deckLength / 2 + EDGE_OFFSET); oz = (posNorm - 0.5) * st.deckWidth; break;
        case 'right': ox = st.deckLength / 2 + EDGE_OFFSET;   oz = (posNorm - 0.5) * st.deckWidth; break;
    }
    return (lx, lz) => {
        // Rotate local → world based on edge (matches rotY in stairs-3d.js)
        switch (edge) {
            case 'front': return { x: ox + lx,  z: oz - lz };  // rotY = PI
            case 'back':  return { x: ox + lx,  z: oz + lz };  // rotY = 0
            case 'left':  return { x: ox + lz,  z: oz + lx };  // rotY = PI/2
            case 'right': return { x: ox - lz,  z: oz + lx };  // rotY = -PI/2
        }
    };
}

/**
 * Returns the highest walkable surface Y at world position (x, z).
 * Checks surfaces sorted from highest to lowest.
 */
function _getSurfaceY(x, z) {
    let best = GROUND_Y;
    // Sort descending by y so we get the highest matching surface
    const sorted = [..._surfaces].sort((a, b) => b.y - a.y);
    for (const s of sorted) {
        if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
            if (s.y > best || best === GROUND_Y) best = s.y;
            break;
        }
    }
    return best;
}

/**
 * Determine a good starting position — top of first stair if
 * stairs exist, otherwise center of deck surface.
 */
function _getStartPosition() {
    const dH = state.deckHeight;
    if (state.stairsEnabled && state.stairs?.length) {
        const sc = state.stairs.find(s => s.enabled);
        if (sc) {
            const dims = calculateStairDimensions(sc, state);
            if (dims?.isValid) {
                const edge = sc.edge || 'front';
                const pos  = sc.pos || sc.position || 0.5;
                const fn   = _makeEdgeTransform(edge, pos, state);
                const c    = fn(0, -(dims.treadDepth / 12 * 0.5));
                return { x: c.x, y: dH + EYE_HEIGHT, z: c.z };
            }
        }
    }
    return { x: 0, y: dH + EYE_HEIGHT, z: 0 };
}

/**
 * Keep player within a generous bounding box around the whole deck area,
 * including stair run-out zones.
 */
function _clampToBounds(pos) {
    const maxStairRun = 20; // maximum possible stair run in feet
    const pad = 2;
    const minX = -state.deckLength / 2 - maxStairRun - pad;
    const maxX =  state.deckLength / 2 + maxStairRun + pad;
    const minZ = -state.deckWidth  / 2 - maxStairRun - pad;
    const maxZ =  state.deckWidth  / 2 + maxStairRun + pad;
    pos.x = Math.max(minX, Math.min(maxX, pos.x));
    pos.z = Math.max(minZ, Math.min(maxZ, pos.z));
    if (pos.y < GROUND_Y + EYE_HEIGHT) pos.y = GROUND_Y + EYE_HEIGHT;
}

// ── HUD ──────────────────────────────────────────────────────

function _showHUD(visible) {
    let hud = document.getElementById('walkthroughHUD');
    if (visible) {
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'walkthroughHUD';
            hud.innerHTML = `
                <div class="wt-hud__inner">
                    <span class="wt-hud__keys">W A S D &nbsp;|&nbsp; Mouse to look &nbsp;|&nbsp; ESC to exit</span>
                </div>`;
            document.body.appendChild(hud);
        }
        hud.classList.remove('wt-hud--hidden');
    } else if (hud) {
        hud.classList.add('wt-hud--hidden');
    }
}
