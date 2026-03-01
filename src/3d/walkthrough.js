// ============================================================
// TrueGrain Deck Builder 2 — First-Person Walkthrough
// ============================================================
// Desktop + tablet (>= 768px). Phones blocked.
// C key / crouch button toggles crouch (3'6") vs standing (6'2").
// On touch devices a virtual joystick appears bottom-left for
// movement and a look-drag zone covers the rest of the screen.
// ============================================================

import { CONFIG } from '../config.js';
import { state }  from '../state.js';
import { calculateStairDimensions } from './stairs-3d.js';

// ── Device helpers ────────────────────────────────────────────
function _isAllowedDevice() { return window.innerWidth >= 768; }
function _isTouch()         { return window.matchMedia('(pointer: coarse)').matches; }

// ── Height constants ──────────────────────────────────────────
const EYE_STAND   = 1.88;   // 6'2"  — default standing height (metres)
const EYE_CROUCH  = 1.07;   // 3'6"  — crouched height
const CROUCH_SPEED = 0.07;  // lerp rate

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
let _plc       = null;          // PointerLockControls (desktop only)
let _crouching = false;
let _eyeHeight = EYE_STAND;

// Keyboard movement (desktop)
const _keys = { w: false, s: false, a: false, d: false };
let _velY   = 0;
let _surfaces = [];

// ── Joystick state (touch only) ───────────────────────────────
const _js = {
    active:    false,
    touchId:   null,
    baseX:     0,   baseY:     0,
    dx:        0,   dy:        0,
};
const _look = {
    touchId:   null,
    lastX:     0,   lastY:     0,
};
const _LOOK_SENS = 0.003;   // radians per pixel
const _JS_RADIUS = 55;      // px — max joystick deflection

// ── Public API ────────────────────────────────────────────────

export function initWalkthrough(camera, renderer, orbitControls) {
    _camera   = camera;
    _renderer = renderer;
    _controls = orbitControls;
    _buildSurfaces();
    _syncWalkBtnVisibility();
    window.addEventListener('resize', _syncWalkBtnVisibility);
}

export function refreshWalkthroughSurfaces() { _buildSurfaces(); }

export function enterWalkthrough() {
    if (!_isAllowedDevice()) return false;
    if (_active) return true;

    _buildSurfaces();
    _crouching = false;
    _eyeHeight = EYE_STAND;
    const sp = _getStartPosition();
    _camera.position.set(sp.x, sp.y, sp.z);

    if (_isTouch()) {
        // Touch path: no PointerLock — manual look + joystick
        _active = true;
        if (_controls) _controls.enabled = false;
        _addTouchListeners();
        _showHUD(true);
    } else {
        // Desktop path: PointerLock
        if (!THREE.PointerLockControls) {
            console.warn('PointerLockControls not loaded');
            return false;
        }
        _plc = new THREE.PointerLockControls(_camera, _renderer.domElement);
        _plc.addEventListener('lock',   _onLock);
        _plc.addEventListener('unlock', _onUnlock);
        _plc.lock();
    }
    return true;
}

export function exitWalkthrough() {
    if (!_active) return;
    if (_isTouch()) {
        _doExitTouch();
    } else {
        _plc?.unlock();
    }
}

export const isWalkthroughActive = () => _active;

export function tickWalkthrough() {
    if (!_active) return;

    if (_isTouch()) {
        _tickTouch();
    } else {
        if (!_plc?.isLocked) return;
        _tickDesktop();
    }

    // Smooth crouch lerp (both paths)
    const targetEye = _crouching ? EYE_CROUCH : EYE_STAND;
    _eyeHeight += (targetEye - _eyeHeight) * CROUCH_SPEED;
    if (Math.abs(_eyeHeight - targetEye) < 0.005) _eyeHeight = targetEye;

    // Vertical / gravity (both paths)
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
    if (_isTouch()) _updateJoystickVisual();
}

// ── Desktop tick ──────────────────────────────────────────────

function _tickDesktop() {
    if (_keys.w) _plc.moveForward(MOVE_SPEED);
    if (_keys.s) _plc.moveForward(-MOVE_SPEED);
    if (_keys.a) _plc.moveRight(-MOVE_SPEED);
    if (_keys.d) _plc.moveRight(MOVE_SPEED);
}

// ── Touch tick ───────────────────────────────────────────────

function _tickTouch() {
    if (!_js.active) return;
    const nx = _js.dx / _JS_RADIUS;  // -1 to +1
    const nz = _js.dy / _JS_RADIUS;
    // Derive forward/right vectors from camera yaw only (ignore pitch)
    const yaw = _camera.rotation.y;
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rtX  =  Math.cos(yaw), rtZ  = -Math.sin(yaw);
    _camera.position.x += (fwdX * -nz + rtX * nx) * MOVE_SPEED;
    _camera.position.z += (fwdZ * -nz + rtZ * nx) * MOVE_SPEED;
}

// ── PointerLock callbacks (desktop) ──────────────────────────

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
    _resetCamera();
    _plc = null;
}

// ── Touch enter/exit ──────────────────────────────────────────

function _doExitTouch() {
    _active = false;
    if (_controls) _controls.enabled = true;
    _removeTouchListeners();
    _showHUD(false);
    _crouching = false;
    _eyeHeight = EYE_STAND;
    _resetCamera();
}

// ── Touch event handlers ─────────────────────────────────────
//
// Left 30% of screen = joystick zone.
// Right 70% = look drag zone.
// We handle up to 2 simultaneous touches.

function _onTouchStart(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
        const leftZone = t.clientX < window.innerWidth * 0.35;
        if (leftZone && !_js.active) {
            _js.active  = true;
            _js.touchId = t.identifier;
            _js.baseX   = t.clientX;
            _js.baseY   = t.clientY;
            _js.dx = 0; _js.dy = 0;
            // Move joystick base to touch position
            const base = document.getElementById('wtJsBase');
            if (base) { base.style.left = (t.clientX - 55) + 'px'; base.style.top = (t.clientY - 55) + 'px'; }
        } else if (!leftZone && _look.touchId === null) {
            _look.touchId = t.identifier;
            _look.lastX   = t.clientX;
            _look.lastY   = t.clientY;
        }
    }
}

function _onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
        if (t.identifier === _js.touchId) {
            _js.dx = Math.max(-_JS_RADIUS, Math.min(_JS_RADIUS, t.clientX - _js.baseX));
            _js.dy = Math.max(-_JS_RADIUS, Math.min(_JS_RADIUS, t.clientY - _js.baseY));
        } else if (t.identifier === _look.touchId) {
            const dx = t.clientX - _look.lastX;
            const dy = t.clientY - _look.lastY;
            _camera.rotation.y  -= dx * _LOOK_SENS;
            _camera.rotation.x  -= dy * _LOOK_SENS;
            // Clamp pitch to avoid flipping over
            _camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, _camera.rotation.x));
            _look.lastX = t.clientX;
            _look.lastY = t.clientY;
        }
    }
}

function _onTouchEnd(e) {
    for (const t of e.changedTouches) {
        if (t.identifier === _js.touchId) {
            _js.active = false; _js.touchId = null; _js.dx = 0; _js.dy = 0;
        } else if (t.identifier === _look.touchId) {
            _look.touchId = null;
        }
    }
}

function _addTouchListeners() {
    const el = _renderer.domElement;
    el.addEventListener('touchstart', _onTouchStart, { passive: false });
    el.addEventListener('touchmove',  _onTouchMove,  { passive: false });
    el.addEventListener('touchend',   _onTouchEnd,   { passive: false });
}
function _removeTouchListeners() {
    const el = _renderer.domElement;
    el.removeEventListener('touchstart', _onTouchStart);
    el.removeEventListener('touchmove',  _onTouchMove);
    el.removeEventListener('touchend',   _onTouchEnd);
}

// ── Joystick visual update ────────────────────────────────────

function _updateJoystickVisual() {
    const knob = document.getElementById('wtJsKnob');
    if (!knob) return;
    knob.style.transform = `translate(calc(-50% + ${_js.dx}px), calc(-50% + ${_js.dy}px))`;
}

// ── Keyboard (desktop) ────────────────────────────────────────

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

// ── Walk button ───────────────────────────────────────────────

function _syncWalkBtnVisibility() {
    const btn = document.getElementById('walkBtn');
    if (!btn) return;
    btn.style.display = _isAllowedDevice() ? '' : 'none';
}

// ── Camera reset ──────────────────────────────────────────────

function _resetCamera() {
    const m = Math.max(state.deckLength, state.deckWidth);
    _camera.position.set(m * 1.4, state.deckHeight + m * 0.9, m * 1.4);
    _camera.rotation.set(0, 0, 0);
    if (_controls) {
        _controls.target.set(0, state.deckHeight / 2, 0);
        _controls.update();
    }
}

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
    const edge    = sc.edge || 'front';
    const pos     = sc.pos  || sc.position || 0.5;
    const swH     = dims.stairWidthFeet / 2;
    const tdf     = dims.treadDepth / 12;
    const rps     = dims.actualRise / 12;
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
// Desktop: WASD hint + C to crouch + ESC hint
// Touch:   Joystick ring/knob bottom-left + crouch button + close button

function _showHUD(visible) {
    let hud = document.getElementById('walkthroughHUD');

    if (!visible) {
        if (hud) hud.classList.add('wt-hud--hidden');
        _destroyJoystick();
        return;
    }

    // Build HUD once
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'walkthroughHUD';
        if (_isTouch()) {
            hud.innerHTML = `
                <div class="wt-hud__inner wt-hud__inner--touch">
                    <div class="wt-hud__crouch-row">
                        <button id="wtCrouchBtn" class="wt-hud__crouch-btn">Crouch</button>
                        <span class="wt-hud__crouch-label" id="wtCrouchLabel">Standing  6'2"</span>
                        <button id="wtExitBtn" class="wt-hud__exit-btn">Exit</button>
                    </div>
                </div>`;
        } else {
            hud.innerHTML = `
                <div class="wt-hud__inner">
                    <div class="wt-hud__keys-row">
                        <span class="wt-hud__keys">W A S D &nbsp;&bull;&nbsp; Mouse to look &nbsp;&bull;&nbsp; C to crouch &nbsp;&bull;&nbsp; ESC to exit</span>
                    </div>
                    <div class="wt-hud__crouch-row">
                        <span class="wt-hud__crouch-label" id="wtCrouchLabel">Standing  6'2"</span>
                    </div>
                </div>`;
        }
        document.body.appendChild(hud);

        // Wire touch buttons
        if (_isTouch()) {
            document.getElementById('wtCrouchBtn')?.addEventListener('click', () => {
                _crouching = !_crouching;
                _updateCrouchHUD();
            });
            document.getElementById('wtExitBtn')?.addEventListener('click', () => exitWalkthrough());
        }
    }

    hud.classList.remove('wt-hud--hidden');
    _updateCrouchHUD();

    // Build joystick for touch
    if (_isTouch()) _buildJoystick();
}

function _buildJoystick() {
    if (document.getElementById('wtJoystick')) return;
    const joy = document.createElement('div');
    joy.id = 'wtJoystick';
    joy.innerHTML = `<div id="wtJsBase"><div id="wtJsKnob"></div></div>`;
    document.body.appendChild(joy);
}

function _destroyJoystick() {
    document.getElementById('wtJoystick')?.remove();
    _js.active = false; _js.touchId = null; _js.dx = 0; _js.dy = 0;
    _look.touchId = null;
}

function _updateCrouchHUD() {
    const el  = document.getElementById('wtCrouchLabel');
    const btn = document.getElementById('wtCrouchBtn');
    if (!el) return;
    if (_crouching) {
        el.textContent = "Crouching  3'6\"";
        el.classList.add('wt-hud__crouch-label--active');
        if (btn) btn.textContent = 'Stand Up';
    } else {
        el.textContent = "Standing  6'2\"";
        el.classList.remove('wt-hud__crouch-label--active');
        if (btn) btn.textContent = 'Crouch';
    }
}
