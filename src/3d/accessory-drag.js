// ============================================================
// TrueGrain Deck Builder 2 — Accessory Drag-and-Drop
// Allows users to drag accessories on the 3D deck surface.
// Uses raycasting on an invisible horizontal plane at deck height.
// ============================================================
import { state, updateState } from '../state.js';
import { CONFIG }             from '../config.js';

let _scene, _camera, _renderer, _controls;
let _raycaster, _mouse;
let _dragging     = null;   // { accId, offset } while actively dragging
let _dragPlane    = null;   // invisible horizontal plane for raycasting
let _hoveredAcc   = null;   // currently hovered accessory group
let _initialized  = false;

// Store original emissive values so we can restore them
let _origEmissive = new Map();

// Pointer tracking for distinguishing tap vs drag
let _pointerStart = null;
const DRAG_THRESHOLD = 5; // px — must move this far before it's a drag

// ============================================================
// Init — call once after scene is ready
// ============================================================
export function initAccessoryDrag(scene, camera, renderer, controls) {
    if (_initialized) disposeAccessoryDrag();

    _scene    = scene;
    _camera   = camera;
    _renderer = renderer;
    _controls = controls;

    _raycaster = new THREE.Raycaster();
    _mouse     = new THREE.Vector2();

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup',   onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    _initialized = true;
}

export function disposeAccessoryDrag() {
    if (!_initialized) return;
    const canvas = _renderer?.domElement;
    if (canvas) {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup',   onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
    }
    removeDragPlane();
    clearHover();
    _dragging    = null;
    _initialized = false;
}

// ============================================================
// Coordinate helpers
// ============================================================
function updateMouse(e) {
    const rect = _renderer.domElement.getBoundingClientRect();
    _mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    _mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
}

function getDeckY() {
    return state.deckHeight + (CONFIG.boards.thickness / 12);
}

// ============================================================
// Hit-test helpers
// ============================================================
function findAccessoryMeshes() {
    const meshes = [];
    _scene.traverse(child => {
        if (child.isMesh && child.userData.accessoryId) {
            meshes.push(child);
        }
    });
    return meshes;
}

function findAccessoryGroup(mesh) {
    let obj = mesh;
    while (obj) {
        if (obj.name?.startsWith('accessory_')) return obj;
        obj = obj.parent;
    }
    return null;
}

function getAccIdFromGroup(group) {
    return group.name.replace('accessory_', '');
}

// ============================================================
// Hover highlight
// ============================================================
function setHover(group) {
    if (_hoveredAcc === group) return;
    clearHover();
    _hoveredAcc = group;
    group.traverse(child => {
        if (child.isMesh && child.material) {
            const mat = child.material;
            if (mat.emissive) {
                _origEmissive.set(child, mat.emissive.clone());
                mat.emissive.set(0x335599);
                mat.emissiveIntensity = 0.15;
            }
        }
    });
    _renderer.domElement.style.cursor = 'grab';
}

function clearHover() {
    if (!_hoveredAcc) return;
    _hoveredAcc.traverse(child => {
        if (child.isMesh && child.material?.emissive) {
            const orig = _origEmissive.get(child);
            if (orig) {
                child.material.emissive.copy(orig);
                child.material.emissiveIntensity = 0;
            }
        }
    });
    _origEmissive.clear();
    _hoveredAcc = null;
    if (!_dragging) {
        _renderer.domElement.style.cursor = '';
    }
}

// ============================================================
// Drag plane — horizontal invisible plane at deck surface
// ============================================================
function createDragPlane() {
    removeDragPlane();
    const size = Math.max(state.deckLength, state.deckWidth) * 4;
    const geo  = new THREE.PlaneGeometry(size, size);
    const mat  = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    _dragPlane = new THREE.Mesh(geo, mat);
    _dragPlane.rotation.x = -Math.PI / 2;
    _dragPlane.position.y = getDeckY();
    _scene.add(_dragPlane);
}

function removeDragPlane() {
    if (_dragPlane) {
        _dragPlane.geometry.dispose();
        _dragPlane.material.dispose();
        _scene.remove(_dragPlane);
        _dragPlane = null;
    }
}

// ============================================================
// Clamp to deck bounds (with padding so accessories stay on surface)
// ============================================================
function clampToDeck(x, z) {
    const pad   = 0.3;
    const halfL = state.deckLength / 2 - pad;
    const halfW = state.deckWidth  / 2 - pad;
    return {
        x: Math.max(-halfL, Math.min(halfL, x)),
        z: Math.max(-halfW, Math.min(halfW, z))
    };
}

// ============================================================
// Pointer events
// ============================================================
function onPointerDown(e) {
    if (!state.accessories?.length) return;
    // Only primary pointer (left click / first touch)
    if (e.button !== 0 && e.button !== undefined) return;

    updateMouse(e);
    _raycaster.setFromCamera(_mouse, _camera);

    const meshes = findAccessoryMeshes();
    const hits = _raycaster.intersectObjects(meshes);
    if (hits.length === 0) return;

    const group = findAccessoryGroup(hits[0].object);
    if (!group) return;

    const accId = getAccIdFromGroup(group);
    const acc = state.accessories.find(a => a.id === accId);
    if (!acc) return;

    // Record start position for tap-vs-drag detection
    _pointerStart = { x: e.clientX, y: e.clientY, accId, group };

    e.preventDefault();
    e.stopPropagation();
}

function onPointerMove(e) {
    updateMouse(e);
    _raycaster.setFromCamera(_mouse, _camera);

    // If we have a pointerStart but haven't started dragging yet, check threshold
    if (_pointerStart && !_dragging) {
        const dx = e.clientX - _pointerStart.x;
        const dy = e.clientY - _pointerStart.y;
        if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
            // Start the drag
            _dragging = { accId: _pointerStart.accId, group: _pointerStart.group };
            createDragPlane();
            if (_controls) _controls.enabled = false;
            _renderer.domElement.style.cursor = 'grabbing';
            setHover(_pointerStart.group);
        } else {
            return; // Haven't moved enough yet
        }
    }

    if (_dragging) {
        // Move the accessory
        if (!_dragPlane) return;
        const planeHits = _raycaster.intersectObject(_dragPlane);
        if (planeHits.length === 0) return;

        const point = planeHits[0].point;
        const clamped = clampToDeck(point.x, point.z);

        _dragging.group.position.x = clamped.x;
        _dragging.group.position.z = clamped.z;

        e.preventDefault();
    } else {
        // Hover detection (only when not dragging)
        const meshes = findAccessoryMeshes();
        const hits = _raycaster.intersectObjects(meshes);
        if (hits.length > 0) {
            const group = findAccessoryGroup(hits[0].object);
            if (group) {
                setHover(group);
            } else {
                clearHover();
            }
        } else {
            clearHover();
        }
    }
}

function onPointerUp(e) {
    if (_dragging) {
        // Commit position to state
        const accId = _dragging.accId;
        const group = _dragging.group;
        const clamped = clampToDeck(group.position.x, group.position.z);

        const accessories = state.accessories.map(a =>
            a.id === accId ? { ...a, x: clamped.x, z: clamped.z } : a
        );

        // Use a debounced update to avoid a full rebuild flicker
        clearTimeout(_updateTimer);
        _updateTimer = setTimeout(() => {
            updateState({ accessories });
        }, 100);

        removeDragPlane();
        clearHover();
        if (_controls) _controls.enabled = true;
        _renderer.domElement.style.cursor = '';
        _dragging = null;
    }

    _pointerStart = null;
}

let _updateTimer = null;
