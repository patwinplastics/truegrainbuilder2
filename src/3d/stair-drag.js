// ============================================================
// TrueGrain Deck Builder 2 — Stair Drag-and-Drop Interaction
// Allows users to drag stairs along deck edges in the 3D scene.
// Uses raycasting on an invisible deck-edge plane.
// ============================================================
import { state, updateState } from '../state.js';
import { CONFIG }             from '../config.js';

let _scene, _camera, _renderer, _controls;
let _raycaster, _mouse;
let _dragging    = null;   // { stairId, edge } while actively dragging
let _ghostMesh   = null;   // visual feedback cube during drag
let _edgePlane   = null;   // invisible plane for raycasting
let _initialized = false;

const GHOST_COLOR   = 0x4CAF50;
const GHOST_OPACITY = 0.35;

// ============================================================
// Init — call once after scene is ready
// ============================================================
export function initStairDrag(scene, camera, renderer, controls) {
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

    _initialized = true;
}

export function disposeStairDrag() {
    if (!_initialized) return;
    const canvas = _renderer?.domElement;
    if (canvas) {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup',   onPointerUp);
    }
    removeGhost();
    _initialized = false;
}

// ============================================================
// Pointer events
// ============================================================
function updateMouse(e) {
    const rect = _renderer.domElement.getBoundingClientRect();
    _mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    _mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
}

function onPointerDown(e) {
    if (!state.stairsEnabled || !state.stairs?.length) return;
    if (e.button !== 0) return; // left click only

    updateMouse(e);
    _raycaster.setFromCamera(_mouse, _camera);

    // Find if we clicked on a stair mesh
    const stairMeshes = [];
    _scene.traverse(child => {
        if (child.isMesh && child.parent?.name?.startsWith('stair_')) {
            stairMeshes.push(child);
        }
    });

    const hits = _raycaster.intersectObjects(stairMeshes);
    if (hits.length === 0) return;

    // Extract stair ID from parent group name
    let obj = hits[0].object;
    while (obj && !obj.name?.startsWith('stair_')) obj = obj.parent;
    if (!obj) return;

    const stairId = obj.name.replace('stair_', '');
    const stair = state.stairs.find(s => s.id === stairId);
    if (!stair) return;

    _dragging = { stairId, edge: stair.edge };

    // Select this stair in the UI
    updateState({ selectedStairId: stairId });

    // Create the edge plane for raycasting
    createEdgePlane(stair.edge);
    createGhost(stair);

    // Disable orbit controls during drag
    if (_controls) _controls.enabled = false;

    e.preventDefault();
    e.stopPropagation();
}

function onPointerMove(e) {
    if (!_dragging) return;

    updateMouse(e);
    _raycaster.setFromCamera(_mouse, _camera);

    if (!_edgePlane) return;
    const hits = _raycaster.intersectObject(_edgePlane);
    if (hits.length === 0) return;

    const point = hits[0].point;
    const stair = state.stairs.find(s => s.id === _dragging.stairId);
    if (!stair) return;

    // Determine nearest edge and position along it
    const result = snapToEdge(point, stair.edge);

    // Update ghost position
    if (_ghostMesh) {
        _ghostMesh.position.copy(result.worldPos);
        _ghostMesh.position.y = state.deckHeight + 0.5;
    }

    // Update stair position in state (throttled)
    updateStairPosition(_dragging.stairId, result.edge, result.position);

    e.preventDefault();
}

function onPointerUp(e) {
    if (!_dragging) return;

    removeGhost();
    removeEdgePlane();

    // Re-enable orbit controls
    if (_controls) _controls.enabled = true;

    _dragging = null;
}

// ============================================================
// Edge plane for raycasting — horizontal plane at deck height
// ============================================================
function createEdgePlane(edge) {
    removeEdgePlane();
    const size = Math.max(state.deckLength, state.deckWidth) * 3;
    const geo  = new THREE.PlaneGeometry(size, size);
    const mat  = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    _edgePlane = new THREE.Mesh(geo, mat);
    _edgePlane.rotation.x = -Math.PI / 2;
    _edgePlane.position.y = state.deckHeight;
    _scene.add(_edgePlane);
}

function removeEdgePlane() {
    if (_edgePlane) {
        _edgePlane.geometry.dispose();
        _edgePlane.material.dispose();
        _scene.remove(_edgePlane);
        _edgePlane = null;
    }
}

// ============================================================
// Ghost preview
// ============================================================
function createGhost(stair) {
    removeGhost();
    const w = stair.width || CONFIG.stairs.defaultWidth;
    const geo = new THREE.BoxGeometry(w, 0.3, 1.5);
    const mat = new THREE.MeshBasicMaterial({
        color: GHOST_COLOR, transparent: true, opacity: GHOST_OPACITY, depthWrite: false
    });
    _ghostMesh = new THREE.Mesh(geo, mat);
    _ghostMesh.position.y = state.deckHeight + 0.5;
    _scene.add(_ghostMesh);
}

function removeGhost() {
    if (_ghostMesh) {
        _ghostMesh.geometry.dispose();
        _ghostMesh.material.dispose();
        _scene.remove(_ghostMesh);
        _ghostMesh = null;
    }
}

// ============================================================
// Snap to nearest deck edge
// ============================================================
function snapToEdge(point, currentEdge) {
    const halfL = state.deckLength / 2;
    const halfW = state.deckWidth  / 2;

    // Determine which edge the point is nearest to
    const distances = {
        front: Math.abs(point.z - halfW),
        back:  Math.abs(point.z + halfW),
        left:  Math.abs(point.x + halfL),
        right: Math.abs(point.x - halfL)
    };

    // Find nearest edge
    let edge = currentEdge;
    let minDist = Infinity;
    for (const [e, d] of Object.entries(distances)) {
        if (d < minDist) { minDist = d; edge = e; }
    }

    // Calculate 0-1 position along the edge
    let position;
    const worldPos = new THREE.Vector3();

    switch (edge) {
        case 'front':
        case 'back': {
            const clampedX = Math.max(-halfL, Math.min(halfL, point.x));
            position = (clampedX / state.deckLength) + 0.5;
            worldPos.set(clampedX, 0, edge === 'front' ? halfW : -halfW);
            break;
        }
        case 'left':
        case 'right': {
            const clampedZ = Math.max(-halfW, Math.min(halfW, point.z));
            position = (clampedZ / state.deckWidth) + 0.5;
            worldPos.set(edge === 'left' ? -halfL : halfL, 0, clampedZ);
            break;
        }
    }

    // Clamp position to keep stair fully on the edge
    position = Math.max(0.05, Math.min(0.95, position));

    return { edge, position, worldPos };
}

// ============================================================
// Update state (debounced to avoid excessive rebuilds)
// ============================================================
let _updateTimer = null;
function updateStairPosition(stairId, edge, position) {
    clearTimeout(_updateTimer);
    _updateTimer = setTimeout(() => {
        const stairs = state.stairs.map(s =>
            s.id === stairId ? { ...s, edge, position } : s
        );
        updateState({ stairs });
    }, 50);
}
