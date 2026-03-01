// ============================================================
// TrueGrain Deck Builder 2 — Three.js Scene Manager
// ============================================================
import { CONFIG }                                             from '../config.js';
import { state }                                              from '../state.js';
import { preloadTextures, disposeAllCaches, setMaxAnisotropy } from './materials.js';
import { createRealisticGrass, createSupportPosts,
         createJoists, createWhiteFascia }                   from './structure.js';
import { createDeckBoardsWithSegments }                       from './deck-boards.js';
import { createDetailedRailings }                             from './railings.js';
import { createAllStairs }                                    from './stairs-3d.js';
import { determinePattern }                                   from '../calc/estimator.js';

let scene, camera, renderer, controls;
let deckGroup        = null;
let sceneInitialized = false;
let isBuilding       = false;
let pendingBuild     = false;
let contextLost      = false;

export const getScene    = () => scene;
export const getCamera   = () => camera;
export const getRenderer = () => renderer;

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

    canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        contextLost = true;
        sceneInitialized = false;
    });
    canvas.addEventListener('webglcontextrestored', () => {
        contextLost = false;
        disposeAllCaches();
        sceneInitialized = false;
        initScene();
    });

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(25, 20, 25);

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Enable max anisotropic filtering for wood textures
    setMaxAnisotropy(renderer);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.05;
    controls.minPolarAngle  = 0;
    controls.maxPolarAngle  = Math.PI * 0.9;
    controls.minDistance    = 5;
    controls.maxDistance    = 150;
    controls.enablePan      = true;
    controls.enableZoom     = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(20, 30, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
    sun.shadow.bias       = -0.001;
    sun.shadow.normalBias =  0.02;
    Object.assign(sun.shadow.camera, { near: 0.5, far: 100, left: -40, right: 40, top: 40, bottom: -40 });
    scene.add(sun);

    createRealisticGrass(scene);

    deckGroup = new THREE.Group();
    scene.add(deckGroup);

    sceneInitialized = true;
    buildDeck();
    document.getElementById('sceneLoading')?.classList.add('hidden');
    animate();

    window.addEventListener('resize', debounce(onWindowResize, 250));
    window.addEventListener('beforeunload', disposeAllCaches);
}

function animate() {
    if (contextLost) return;
    requestAnimationFrame(animate);
    controls?.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}

function onWindowResize() {
    const c = document.getElementById('sceneContainer');
    if (!c || !camera || !renderer) return;
    camera.aspect = c.clientWidth / c.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(c.clientWidth, c.clientHeight);
}

const debouncedBuild = debounce(() => {
    if (isBuilding) { pendingBuild = true; return; }
    executeBuildDeck();
}, 200);

export function buildDeck() { debouncedBuild(); }

function disposeGroupChildren(group) {
    group.traverse(child => {
        if (child.isMesh) {
            child.geometry?.dispose();
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
        if (state.showRailings)                               createDetailedRailings(deckGroup, state);
        if (state.stairsEnabled && state.stairs?.length > 0)  createAllStairs(deckGroup, state);

        controls.target.set(0, state.deckHeight / 2, 0);
        const m = Math.max(state.deckLength, state.deckWidth);
        camera.position.set(m * 1.4, state.deckHeight + m * 0.9, m * 1.4);
        controls.update();
        updateBoardLegend();
    } catch (e) {
        console.error('Error building deck:', e);
    }

    isBuilding = false;
    setTimeout(() => document.getElementById('buildingSpinner')?.classList.add('hidden'), 100);
    if (pendingBuild) { pendingBuild = false; debouncedBuild(); }
}

export function setCameraView(type) {
    if (!camera || !controls) return;
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
