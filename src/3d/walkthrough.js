// ============================================================
// TrueGrain Deck Builder 2 — First-Person Walkthrough
// ============================================================
// Provides a PointerLock-based FPS walkthrough that lets the
// user walk around the ground, up/down stairs, and on the deck.
// Toggles cleanly with OrbitControls — no scene rebuild needed.
// ============================================================

import { CONFIG } from '../config.js';
import { state }  from '../state.js';
import { calculateStairDimensions } from './stairs-3d.js';

// ── Constants ────────────────────────────────────────────────
const EYE_HEIGHT_DEFAULT = 1.70;  // metres (~5'7") — starting value
const EYE_HEIGHT_MIN     = 0.91;  // ~3 ft  (child / seated view)
const EYE_HEIGHT_MAX     = 2.13;  // ~7 ft  (tall person / elevated view)
const MOVE_SPEED         = 0.07;
const GRAVITY            = 0.012;
const SNAP_THRESH        = 0.18;
const GROUND_Y           = 0.0;
const BOARD_TH           = CONFIG.boards.thickness / 12;

// Feet labels shown in the HUD — slider value is in metres * 100
const HEIGHT_LABELS = {
     91: "3'0",
    107: "3'6",
    122: "4'0",
    137: "4'6",
    152: "5'0",
    163: "5'4",
    170: "5'7",  // default
    178: "5'10",
    183: "6'0",
    198: "6'6",
    213: "7'0"
};

// ── Module state ─────────────────────────────────────────────
let _camera    = null;
let _renderer  = null;
let _controls  = null;
let _active    = false;
let _plc       = null;
let _eyeHeight = EYE_HEIGHT_DEFAULT;  // mutable — changed by height slider
let _sliderOpen = false;              // true while height slider is being dragged

const _keys  = { w: false, s: false, a: false, d: false };
let _velY    = 0;
let _surfaces = [];

// ── Public API ───────────────────────────────────────────────

export function initWalkthrough(camera, renderer, orbitControls) {
    _camera   = camera;
    _renderer = renderer;
    _controls = orbitControls;
    _buildSurfaces();
}

export function refreshWalkthroughSurfaces() {
    _buildSurfaces();
}

export function enterWalkthrough() {
    if (_active) return true;
    if (!THREE.PointerLockControls) {
        console.warn('PointerLockControls not loaded — add CDN script to index.html');
        return false;
    }
    _buildSurfaces();
    _plc = new THREE.PointerLockControls(_camera, _renderer.domElement);
    const startPos = _getStartPosition();
    _camera.position.set(startPos.x, startPos.y, startPos.z);
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

    // ── Horizontal movement ─────────────────────────────────
    if (_keys.w) _plc.moveForward(MOVE_SPEED);
    if (_keys.s) _plc.moveForward(-MOVE_SPEED);
    if (_keys.a) _plc.moveRight(-MOVE_SPEED);
    if (_keys.d) _plc.moveRight(MOVE_SPEED);

    // ── Vertical / stair / gravity ──────────────────────────
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
}

// ── Lock / Unlock handlers ─────────────────────────────────

function _onLock() {
    _active = true;
    if (_controls) _controls.enabled = false;
    _addKeyListeners();
    _showHUD(true);
}

function _onUnlock() {
    // If the slider is open (user clicked it to adjust height),
    // re-lock immediately instead of fully exiting walkthrough.
    if (_sliderOpen) {
        _sliderOpen = false;
        setTimeout(() => { if (_active && _plc) _plc.lock(); }, 80);
        return;
    }
    _active = false;
    if (_controls) _controls.enabled = true;
    _removeKeyListeners();
    _showHUD(false);
    const m = Math.max(state.deckLength, state.deckWidth);
    _camera.position.set(m * 1.4, state.deckHeight + m * 0.9, m * 1.4);
    if (_controls) {
        _controls.target.set(0, state.deckHeight / 2, 0);
        _controls.update();
    }
    _plc = null;
}

// ── Keyboard ────────────────────────────────────────────────

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

// ── Surface map ──────────────────────────────────────────────

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
        const rbl   = ld.risersBeforeLanding;
        const landY = state.deckHeight - rbl * rps;
        for (let i = 0; i < ld.treadsBeforeLanding; i++) {
            const stepY = state.deckHeight - (i + 1) * rps + BOARD_TH;
            const c = toWorld(0, -((i + 1) * tdf));
            _surfaces.push({ minX: c.x - swH, maxX: c.x + swH, minZ: c.z - tdf, maxZ: c.z + tdf, y: stepY });
        }
        const ldf = ld.landingDepthFeet;
        const cl  = toWorld(sign * ld.run2Feet / 2, -(ld.run1Feet + ldf / 2));
        const lw  = dims.stairWidthFeet + ld.run2Feet;
        _surfaces.push({ minX: cl.x - lw / 2, maxX: cl.x + lw / 2, minZ: cl.z - ldf / 2, maxZ: cl.z + ldf / 2, y: landY + BOARD_TH });
        const ox = 0, oz = -(ld.run1Feet + ldf);
        for (let i = 0; i < ld.treadsAfterLanding; i++) {
            const stepY = landY - (i + 1) * rps + BOARD_TH;
            const c2 = toWorld(ox + sign * ((i + 1) * tdf), oz);
            _surfaces.push({ minX: c2.x - swH, maxX: c2.x + swH, minZ: c2.z - swH, maxZ: c2.z + swH, y: stepY });
        }
    } else {
        for (let i = 0; i < dims.numTreads; i++) {
            const stepY = state.deckHeight - (i + 1) * rps + BOARD_TH;
            const c = toWorld(0, -((i + 1) * tdf));
            _surfaces.push({ minX: c.x - swH, maxX: c.x + swH, minZ: c.z - tdf, maxZ: c.z + tdf, y: stepY });
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
                return { x: c.x, y: dH + _eyeHeight, z: c.z };
            }
        }
    }
    return { x: 0, y: dH + _eyeHeight, z: 0 };
}

function _clampToBounds(pos) {
    const pad = 22;
    const minX = -state.deckLength / 2 - pad, maxX = state.deckLength / 2 + pad;
    const minZ = -state.deckWidth  / 2 - pad, maxZ = state.deckWidth  / 2 + pad;
    pos.x = Math.max(minX, Math.min(maxX, pos.x));
    pos.z = Math.max(minZ, Math.min(maxZ, pos.z));
    if (pos.y < GROUND_Y + _eyeHeight) pos.y = GROUND_Y + _eyeHeight;
}

// ── HUD with height slider ─────────────────────────────────────
//
// The HUD sits at the bottom of the viewport and contains:
//   [person icon]  Height: 5'7"  [----o------]  W A S D | Mouse to look | ESC to exit
//
// Because PointerLock intercepts all mouse events on the canvas, the slider
// works by flagging _sliderOpen before mousedown so that the inevitable
// 'unlock' event from the browser knows to re-lock instead of fully exiting.

function _showHUD(visible) {
    let hud = document.getElementById('walkthroughHUD');

    if (!visible) {
        if (hud) hud.classList.add('wt-hud--hidden');
        return;
    }

    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'walkthroughHUD';
        document.body.appendChild(hud);
        _buildHUDMarkup(hud);
    }

    // Sync slider to current _eyeHeight value
    const slider = hud.querySelector('#wtHeightSlider');
    const label  = hud.querySelector('#wtHeightLabel');
    if (slider) slider.value = Math.round(_eyeHeight * 100);
    if (label)  label.textContent = _heightLabel(Math.round(_eyeHeight * 100));

    hud.classList.remove('wt-hud--hidden');
}

function _buildHUDMarkup(hud) {
    const defaultVal = Math.round(EYE_HEIGHT_DEFAULT * 100);  // 170

    hud.innerHTML = `
        <div class="wt-hud__inner">
            <div class="wt-hud__height-row">
                <svg class="wt-hud__person-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="5" r="2"></circle>
                    <path d="M12 7v6l-3 3"></path>
                    <path d="M12 13l3 3"></path>
                    <line x1="9" y1="10" x2="15" y2="10"></line>
                </svg>
                <span class="wt-hud__height-label">Height</span>
                <input
                    id="wtHeightSlider"
                    class="wt-hud__slider"
                    type="range"
                    min="${Math.round(EYE_HEIGHT_MIN * 100)}"
                    max="${Math.round(EYE_HEIGHT_MAX * 100)}"
                    step="1"
                    value="${defaultVal}"
                >
                <span id="wtHeightLabel" class="wt-hud__height-value">${_heightLabel(defaultVal)}</span>
            </div>
            <div class="wt-hud__keys-row">
                <span class="wt-hud__keys">W A S D &nbsp;&bull;&nbsp; Mouse to look &nbsp;&bull;&nbsp; ESC to exit</span>
            </div>
        </div>`;

    const slider = hud.querySelector('#wtHeightSlider');
    const label  = hud.querySelector('#wtHeightLabel');

    // mousedown: flag that slider is being used so _onUnlock re-locks
    slider.addEventListener('mousedown', () => {
        _sliderOpen = true;
        // Release pointer lock so cursor is free to drag the slider
        if (_plc?.isLocked) _plc.unlock();
    });

    // input: live-update _eyeHeight as slider moves
    slider.addEventListener('input', () => {
        const val   = parseInt(slider.value, 10);
        _eyeHeight  = val / 100;
        label.textContent = _heightLabel(val);
        // Immediately move camera Y to new height above current surface
        if (_camera) {
            const surfY = _getSurfaceY(_camera.position.x, _camera.position.z);
            _camera.position.y = surfY + _eyeHeight;
            _velY = 0;
        }
    });

    // mouseup / touchend: slider drag done — pointer lock restores via _onUnlock -> re-lock path
    slider.addEventListener('mouseup',  () => { _sliderOpen = false; if (_active && _plc) _plc.lock(); });
    slider.addEventListener('touchend', () => { _sliderOpen = false; if (_active && _plc) _plc.lock(); });

    // Prevent ESC inside slider from exiting
    slider.addEventListener('keydown', e => e.stopPropagation());
}

/**
 * Convert centimetre integer (91–213) to a foot+inch display string.
 * Falls back to a computed value if not in the label map.
 */
function _heightLabel(cm) {
    if (HEIGHT_LABELS[cm]) return HEIGHT_LABELS[cm] + '"';
    const totalInches = Math.round(cm / 2.54);
    const ft = Math.floor(totalInches / 12);
    const inch = totalInches % 12;
    return `${ft}'${inch}"`;
}
