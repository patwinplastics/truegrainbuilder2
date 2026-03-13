// ============================================================
// TrueGrain Deck Builder 2 — Three.js Scene Manager
// Ultra-Realistic Rendering Edition
// No external sky/HDRI assets required.
// ============================================================
import { CONFIG }                                             from '../config.js';
import { state }                                              from '../state.js';
import { preloadTextures, disposeAllCaches, setMaxAnisotropy } from './materials.js';
import { createRealisticGrass, createSupportPosts,
         createJoists, createWhiteFascia }                   from './structure.js';
import { createDeckBoardsWithSegments }                       from './deck-boards.js';
import { createDetailedRailings }                             from './railings.js';
import { createAllStairs }                                    from './stairs-3d.js';
import { createAllAccessories }                               from './accessories.js';
import { initStairDrag, disposeStairDrag }                     from './stair-drag.js';
import { initAccessoryDrag, disposeAccessoryDrag }             from './accessory-drag.js';
import { determinePattern }                                   from '../calc/estimator.js';
import {
    initWalkthrough,
    refreshWalkthroughSurfaces,
    enterWalkthrough,
    exitWalkthrough,
    tickWalkthrough,
    isWalkthroughActive
} from './walkthrough.js';

let scene, camera, renderer, controls, composer;
let deckGroup        = null;
let sceneInitialized = false;
let isBuilding       = false;
let pendingBuild     = false;
let contextLost      = false;
let _listenersAttached = false;

export const getScene    = () => scene;
export const getCamera   = () => camera;
export const getRenderer = () => renderer;

// ============================================================
// Post-Processing (SSAO)
// Only activates if EffectComposer CDN scripts are present.
// ============================================================
function setupPostProcessing() {
    if (typeof THREE.EffectComposer === 'undefined' ||
        typeof THREE.RenderPass     === 'undefined' ||
        typeof THREE.SSAOPass       === 'undefined') {
        composer = null;
        return;
    }
    const container = document.getElementById('sceneContainer');
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const ssao = new THREE.SSAOPass(scene, camera, container.clientWidth, container.clientHeight);
    ssao.kernelRadius = 10;
    ssao.minDistance  = 0.001;
    ssao.maxDistance  = 0.12;
    composer.addPass(ssao);
}

// ============================================================
// initScene — deferred until container has real dimensions
// ============================================================
export function initScene() {
    const container = document.getElementById('sceneContainer');
    const canvas    = document.getElementById('deckCanvas');
    if (!container || !canvas) return;

    if (container.clientWidth < 10 || container.clientHeight < 10) {
        requestAnimationFrame(initScene);
        return;
    }

    if (!_listenersAttached) {
        canvas.addEventListener('webglcontextlost', e => {
            e.preventDefault();
            contextLost = true;
            sceneInitialized = false;
            disposeStairDrag();
            disposeAccessoryDrag();
            exitWalkthrough();
        });
        canvas.addEventListener('webglcontextrestored', () => {
            contextLost = false;
            disposeAllCaches();
            sceneInitialized = false;
            initScene();
        });
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0xC8DCF0, 0.008);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(25, 20, 25);

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias:             true,
        preserveDrawingBuffer: true,
        powerPreference:       'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));

    // ── Tone mapping ───────────────────────────────────────────
    // LinearToneMapping keeps texture colors faithful to the source JPGs.
    // ACES was blowing out the wood colors relative to the actual files.
    renderer.toneMapping         = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace    = THREE.SRGBColorSpace;

    // ── Shadows ─────────────────────────────────────────────
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.VSMShadowMap;

    setMaxAnisotropy(renderer);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI * 0.9;
    controls.minDistance   = 5;
    controls.maxDistance   = 150;
    controls.enablePan     = true;
    controls.enableZoom    = true;

    // ── Lighting ─────────────────────────────────────────────
    // All intensities calibrated for LinearToneMapping with sRGB textures.
    // Rule of thumb: total diffuse contribution should sum to ~1.0–1.2.

    // Ambient — fills shadows, keeps them readable not black
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    // Primary sun — warm afternoon, moderate intensity
    const sun = new THREE.DirectionalLight(0xFFF8F0, 0.85);
    sun.position.set(30, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width  = 4096;
    sun.shadow.mapSize.height = 4096;
    sun.shadow.bias       = -0.0005;
    sun.shadow.normalBias =  0.02;
    Object.assign(sun.shadow.camera, { near: 0.5, far: 120, left: -50, right: 50, top: 50, bottom: -50 });
    scene.add(sun);
    scene.userData.sun = sun;

    // Sky bounce fill — soft cool blue from opposite side
    const fill = new THREE.DirectionalLight(0xC8DCEF, 0.25);
    fill.position.set(-20, 15, -15);
    scene.add(fill);

    // Hemisphere — sky/ground gradient for natural indirect light
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x8B7355, 0.3);
    scene.add(hemi);

    createRealisticGrass(scene);

    deckGroup = new THREE.Group();
    scene.add(deckGroup);

    sceneInitialized = true;
    preloadTextures();
    buildDeck();
    document.getElementById('sceneLoading')?.classList.add('hidden');

    setupPostProcessing();
    animate();

    initWalkthrough(camera, renderer, controls);
    initStairDrag(scene, camera, renderer, controls);
    initAccessoryDrag(scene, camera, renderer, controls);

    if (!_listenersAttached) {
        _bindWalkButton();
        window.addEventListener('resize', debounce(onWindowResize, 250));
        window.addEventListener('beforeunload', disposeAllCaches);
        _listenersAttached = true;
    }
}

// ============================================================
// Render loop
// ============================================================
function animate() {
    if (contextLost) return;
    requestAnimationFrame(animate);
    if (isWalkthroughActive()) {
        tickWalkthrough();
    } else {
        controls?.update();
    }
    if (renderer && scene && camera) {
        if (composer) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
    }
}

function onWindowResize() {
    const c = document.getElementById('sceneContainer');
    if (!c || !camera || !renderer) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer?.setSize(w, h);
}

// ============================================================
// Deck build
// ============================================================
const debouncedBuild = debounce(() => {
    if (isBuilding) { pendingBuild = true; return; }
    executeBuildDeck();
}, 200);

export function buildDeck() { debouncedBuild(); }

function disposeGroupChildren(group) {
    group.traverse(child => {
        if (child.isMesh) {
            child.geometry?.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }
    });
    while (group.children.length > 0) group.remove(group.children[0]);
}

function executeBuildDeck() {
    if (!deckGroup || !sceneInitialized || contextLost) return;
    document.getElementById('buildingSpinner')?.classList.remove('hidden');
    isBuilding = true;

    disposeGroupChildren(deckGroup);

    const colorConfig = CONFIG.colors.find(c => c.id === state.mainColor) || CONFIG.colors[0];
    try {
        createSupportPosts(deckGroup, state);
        createJoists(deckGroup, state);
        createDeckBoardsWithSegments(deckGroup, state, determinePattern(state), colorConfig);
        createWhiteFascia(deckGroup, state);
        if (state.showRailings)                              createDetailedRailings(deckGroup, state);
        if (state.stairsEnabled && state.stairs?.length > 0) createAllStairs(deckGroup, state);
        if (state.accessories?.length > 0) createAllAccessories(deckGroup, state);

        // Tighten shadow frustum to deck bounds for maximum shadow resolution
        const sun = scene?.userData.sun;
        if (sun) {
            const pad   = 6;
            const halfL = state.deckLength / 2 + pad;
            const halfW = state.deckWidth  / 2 + pad;
            Object.assign(sun.shadow.camera, {
                left: -halfL, right: halfL,
                top:   halfW, bottom: -halfW,
                near: 0.5,    far: state.deckHeight + 60
            });
            sun.shadow.camera.updateProjectionMatrix();
        }

        controls.target.set(0, state.deckHeight / 2, 0);
        const m = Math.max(state.deckLength, state.deckWidth);
        camera.position.set(m * 1.4, state.deckHeight + m * 0.9, m * 1.4);
        controls.update();
        updateBoardLegend();
        refreshWalkthroughSurfaces();
    } catch (e) {
        console.error('Error building deck:', e);
    }

    isBuilding = false;
    setTimeout(() => document.getElementById('buildingSpinner')?.classList.add('hidden'), 100);
    if (pendingBuild) { pendingBuild = false; debouncedBuild(); }
}

export function setCameraView(type) {
    if (!camera || !controls) return;
    if (isWalkthroughActive()) exitWalkthrough();
    const m = Math.max(state.deckLength, state.deckWidth);
    if (type === 'top') {
        camera.position.set(0, m * 1.8, 0.01);
        controls.target.set(0, 0, 0);
    } else {
        camera.position.set(m * 1.4, state.deckHeight + m * 0.9, m * 1.4);
        controls.target.set(0, state.deckHeight / 2, 0);
    }
    controls.update();
}

export function zoomCamera(factor) {
    if (!camera || !controls) return;
    camera.position.multiplyScalar(factor);
    controls.update();
}

// ============================================================
// Walk button wiring
// ============================================================
function _bindWalkButton() {
    const btn = document.getElementById('walkBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (isWalkthroughActive()) {
            exitWalkthrough();
        } else {
            const ok = enterWalkthrough();
            if (!ok) alert('Walkthrough requires PointerLockControls. Please ensure the CDN script is loaded.');
        }
    });
}

function updateBoardLegend() {
    const legend = document.getElementById('boardLegend');
    if (!legend || !state.boardLayout) return;
    const items = legend.querySelector('.board-legend__items');
    if (!items) return;
    items.innerHTML = '';
    [12, 16, 20].forEach(len => {
        const count = state.boardLayout.boardsByLength?.[len] || state.boardLayout.boardByLength?.[len];
        if (count > 0) {
            const el = document.createElement('div');
            el.className = 'board-legend__item';
            el.innerHTML = `<span class="board-legend__color len-${len}"></span><span>${len}' (${count})</span>`;
            items.appendChild(el);
        }
    });
}

function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
