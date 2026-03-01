// ============================================================
// TrueGrain Deck Builder 2 — First-Person Walkthrough
// ============================================================
// Available on desktop and tablet. Blocked on phones (<768px).
// C key toggles crouch (3'6") vs standing (5'10").
// ============================================================

import { CONFIG } from '../config.js';
import { state }  from '../state.js';
import { calculateStairDimensions } from './stairs-3d.js';

// ── Device guard ──────────────────────────────────────────────
// Block on phones only (viewport < 768px).
// Tablets (768px+) and desktops both allowed.
function _isAllowedDevice() {
    return window.innerWidth >= 768;
}

// ── Height constants ──────────────────────────────────────────
const EYE_STAND   = 1.78;   // 5'10" — default standing height (metres)
const EYE_CROUCH  = 1.07;   // 3'6"  — crouched height
const CROUCH_SPEED = 0.06;  // lerp rate for smooth crouch transition

// ── Motion constants ──────────────────────────────────────────
const MOVE_SPEED  = 0.07;
const GRAVITY     = 0.012;
const SNAP_THRESH = 0.18;
const GROUND_Y    = 0.0;
const BOARD_TH    = CONFIG.boards.thickness / 12;

// ── Module state ──────────────────────────────────────────────
let _camera    = null;
let _renderer  = null;
let _controls  = null;
let _active    = false;
let _plc       = null;
let _crouching = false;
let _eyeHeight = EYE_STAND;

const _keys   = { w: false, s: false, a: false, d: false };
let _velY     = 0;
let _surfaces = [];

// ── Public API ────────────────────────────────────────────────

export function initWalkthrough(camera, renderer, orbitControls) {
    _camera   = camera;
    _renderer = renderer;
    _controls = orbitControls;
    _buildSurfaces();
    // Hide the Walk button entirely on phones
    _syncWalkBtnVisibility();
    window.addEventListener('resize', _syncWalkBtnVisibility);
}

export function refreshWalkthroughSurfaces() {
    _buildSurfaces();
}

/**
 * Returns false silently on phones (< 768px).
 */
export function enterWalkthrough() {
    if (!_isAllowedDevice()) return false;
    if (_active) return true;
    if (!THREE.PointerLockControls) {
        console.warn('PointerLockControls not loaded');
        return false;
    }
    _buildSurfaces();
    _crouching = false;
    _eyeHeight = EYE_STAND;
    _plc = new THREE.PointerLockControls(_camera, _renderer.domElement);
    const sp = _getStartPosition();
    _camera.position.set(sp.x, sp.y, sp.z);
    _plc.addEventListener('lock',   _onLock);
    _plc.addEventListener('unlock', _onUnlock);
    _plc.lock();
    return true;
}

export function exitWalkthrough() {
    if (!_active) return;
    _plc?.unlock();
}

export const isWalkthroughActive = () => _active;

export function tickWalkthrough() {
    if (!_active || !_plc?.isLocked) return;

    // ── Horizontal movement ──────────────────────────────────
    if (_keys.w) _plc.moveForward(MOVE_SPEED);
    if (_keys.s) _plc.moveForward(-MOVE_SPEED);
    if (_keys.a) _plc.moveRight(-MOVE_SPEED);
    if (_keys.d) _plc.moveRight(MOVE_SPEED);

    // ── Smooth crouch lerp ──────────────────────────────────
    const targetEye = _crouching ? EYE_CROUCH : EYE_STAND;
    _eyeHeight += (targetEye - _eyeHeight) * CROUCH_SPEED;
    if (Math.abs(_eyeHeight - targetEye) < 0.005) _eyeHeight = targetEye;

    // ── Vertical / stair / gravity ───────────────────────────
    const pos      = _camera.position;
    const surfaceY = _getSurfaceY(pos.x, pos.z);
    const targetY  = surfaceY + _eyeHeight;

    if (pos.y > targetY + SNAP_THRESH) {
        _velY -= GRAVITY;
        pos.y += _velY;
        if (pos.y < targetY) { pos.y = targetY; _velY = 0; }
    } else {
        pos.y += (targetY - pos.y) * 0.25;
        _velY  = 0;
    }

    _clampToBounds(pos);
    _updateCrouchHUD();
}

// ── Walk button visibility ──────────────────────────────────────

function _syncWalkBtnVisibility() {
    const btn = document.getElementById('walkBtn');
    if (!btn) return;
    btn.style.display = _isAllowedDevice() ? '' : 'none';
}

// ── Lock / Unlock ─────────────────────────────────────────────

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
    _crouching = false;
    _eyeHeight = EYE_STAND;
    const m = Math.max(state.deckLength, state.deckWidth);
    _camera.position.set(m * 1.4, state.deckHeight + m * 0.9, m * 1.4);
    if (_controls) {
        _controls.target.set(0, state.deckHeight / 2, 0);
        _controls.update();
    }
    _plc = null;
}

// ── Keyboard ──────────────────────────────────────────────────

function _keyDown(e) {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup')    _keys.w = true;
    if (k === 's' || k === 'arrowdown')  _keys.s = true;
    if (k === 'a' || k === 'arrowleft')  _keys.a = true;
    if (k === 'd' || k === 'arrowright') _keys.d = true;
    if (k === 'c') { _crouching = !_crouching; _updateCrouchHUD(); }
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

// ── Surface map ───────────────────────────────────────────────

function _buildSurfaces() {
    _surfaces = [];
    const dH = state.deckHeight, dL = state.deckLength / 2, dW = state.deckWidth / 2;
    _surfaces.push({ minX: -dL, maxX: dL, minZ: -dW, maxZ: dW, y: dH });
    _surfaces.push({ minX: -200, maxX: 200, minZ: -200, maxZ: 200, y: GROUND_Y });
    if (state.stairsEnabled && state.stairs?.length) {
        state.stairs.forEach(sc => {
            if (!sc.enabled) return;
            const dims = calculateStairDimensions(sc, state);
            if (!dims?.isValid) return;
            _addStairSurfaces(sc, dims);
        });
    }
}

function _addStairSurfaces(sc, dims) {
    const edge  = sc.edge || 'front';
    const pos   = sc.pos  || sc.position || 0.5;
    const swH   = dims.stairWidthFeet / 2;
    const tdf   = dims.treadDepth / 12;
    const rps   = dims.actualRise / 12;
    const toWorld = _makeEdgeTransform(edge, pos, state);

    if (sc.shape === 'l-shaped' && dims.lShapedData) {
        const ld    = dims.lShapedData;
        const sign  = ld.turnDirection === 'left' ? -1 : 1;
        const landY = state.deckHeight - ld.risersBeforeLanding * rps;
        for (let i = 0; i < ld.treadsBeforeLanding; i++) {
            const c = toWorld(0, -((i + 1) * tdf));
            _surfaces.push({ minX: c.x - swH, maxX: c.x + swH, minZ: c.z - tdf, maxZ: c.z + tdf, y: state.deckHeight - (i + 1) * rps + BOARD_TH });
        }
        const ldf = ld.landingDepthFeet;
        const cl  = toWorld(sign * ld.run2Feet / 2, -(ld.run1Feet + ldf / 2));
        const lw  = dims.stairWidthFeet + ld.run2Feet;
        _surfaces.push({ minX: cl.x - lw / 2, maxX: cl.x + lw / 2, minZ: cl.z - ldf / 2, maxZ: cl.z + ldf / 2, y: landY + BOARD_TH });
        const oz = -(ld.run1Feet + ldf);
        for (let i = 0; i < ld.treadsAfterLanding; i++) {
            const c2 = toWorld(sign * ((i + 1) * tdf), oz);
            _surfaces.push({ minX: c2.x - swH, maxX: c2.x + swH, minZ: c2.z - swH, maxZ: c2.z + swH, y: landY - (i + 1) * rps + BOARD_TH });
        }
    } else {
        for (let i = 0; i < dims.numTreads; i++) {
            const c = toWorld(0, -((i + 1) * tdf));
            _surfaces.push({ minX: c.x - swH, maxX: c.x + swH, minZ: c.z - tdf, maxZ: c.z + tdf, y: state.deckHeight - (i + 1) * rps + BOARD_TH });
        }
    }
}

function _makeEdgeTransform(edge, posNorm, st) {
    const EO = BOARD_TH;
    let ox = 0, oz = 0;
    switch (edge) {
        case 'front': ox = (posNorm - 0.5) * st.deckLength; oz =  st.deckWidth  / 2 + EO; break;
        case 'back':  ox = (posNorm - 0.5) * st.deckLength; oz = -(st.deckWidth  / 2 + EO); break;
        case 'left':  ox = -(st.deckLength / 2 + EO); oz = (posNorm - 0.5) * st.deckWidth; break;
        case 'right': ox =   st.deckLength / 2 + EO;  oz = (posNorm - 0.5) * st.deckWidth; break;
    }
    return (lx, lz) => {
        switch (edge) {
            case 'front': return { x: ox + lx, z: oz - lz };
            case 'back':  return { x: ox + lx, z: oz + lz };
            case 'left':  return { x: ox + lz, z: oz + lx };
            case 'right': return { x: ox - lz, z: oz + lx };
        }
    };
}

function _getSurfaceY(x, z) {
    let best = GROUND_Y;
    const sorted = [..._surfaces].sort((a, b) => b.y - a.y);
    for (const s of sorted) {
        if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) { best = s.y; break; }
    }
    return best;
}

function _getStartPosition() {
    const dH = state.deckHeight;
    if (state.stairsEnabled && state.stairs?.length) {
        const sc = state.stairs.find(s => s.enabled);
        if (sc) {
            const dims = calculateStairDimensions(sc, state);
            if (dims?.isValid) {
                const fn = _makeEdgeTransform(sc.edge || 'front', sc.pos || sc.position || 0.5, state);
                const c  = fn(0, -(dims.treadDepth / 12 * 0.5));
                return { x: c.x, y: dH + EYE_STAND, z: c.z };
            }
        }
    }
    return { x: 0, y: dH + EYE_STAND, z: 0 };
}

function _clampToBounds(pos) {
    const pad = 22;
    const minX = -state.deckLength / 2 - pad, maxX = state.deckLength / 2 + pad;
    const minZ = -state.deckWidth  / 2 - pad, maxZ = state.deckWidth  / 2 + pad;
    pos.x = Math.max(minX, Math.min(maxX, pos.x));
    pos.z = Math.max(minZ, Math.min(maxZ, pos.z));
    if (pos.y < GROUND_Y + _eyeHeight) pos.y = GROUND_Y + _eyeHeight;
}

// ── HUD ───────────────────────────────────────────────────────

function _showHUD(visible) {
    let hud = document.getElementById('walkthroughHUD');
    if (!visible) {
        if (hud) hud.classList.add('wt-hud--hidden');
        return;
    }
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'walkthroughHUD';
        hud.innerHTML = `
            <div class="wt-hud__inner">
                <div class="wt-hud__keys-row">
                    <span class="wt-hud__keys">W A S D &nbsp;&bull;&nbsp; Mouse to look &nbsp;&bull;&nbsp; C to crouch &nbsp;&bull;&nbsp; ESC to exit</span>
                </div>
                <div class="wt-hud__crouch-row">
                    <span class="wt-hud__crouch-label" id="wtCrouchLabel">Standing &nbsp;5'10"</span>
                </div>
            </div>`;
        document.body.appendChild(hud);
    }
    hud.classList.remove('wt-hud--hidden');
    _updateCrouchHUD();
}

function _updateCrouchHUD() {
    const el = document.getElementById('wtCrouchLabel');
    if (!el) return;
    if (_crouching) {
        el.textContent = "Crouching  3'6\"";
        el.classList.add('wt-hud__crouch-label--active');
    } else {
        el.textContent = "Standing  5'10\"";
        el.classList.remove('wt-hud__crouch-label--active');
    }
}
