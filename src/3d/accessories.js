// ============================================================
// TrueGrain Deck Builder 2 — Deck Accessories (Plants & Benches)
// Placeable 3D objects built from Three.js geometry
// ============================================================
import { CONFIG }                          from '../config.js';
import { state }                           from '../state.js';
import { createBoardMaterial, materialCache } from './materials.js';

// ============================================================
// Shared materials (lazy-init, cached)
// ============================================================
function getTerracottaMat() {
    if (!materialCache['_terracotta'])
        materialCache['_terracotta'] = new THREE.MeshStandardMaterial({
            color: 0xC2662D, roughness: 0.85, metalness: 0.0
        });
    return materialCache['_terracotta'];
}

function getDarkPotMat() {
    if (!materialCache['_darkpot'])
        materialCache['_darkpot'] = new THREE.MeshStandardMaterial({
            color: 0x3D3D3D, roughness: 0.7, metalness: 0.05
        });
    return materialCache['_darkpot'];
}

function getFoliageMat() {
    if (!materialCache['_foliage'])
        materialCache['_foliage'] = new THREE.MeshStandardMaterial({
            color: 0x2E7D32, roughness: 0.9, metalness: 0.0
        });
    return materialCache['_foliage'];
}

function getLightFoliageMat() {
    if (!materialCache['_foliage_light'])
        materialCache['_foliage_light'] = new THREE.MeshStandardMaterial({
            color: 0x4CAF50, roughness: 0.88, metalness: 0.0
        });
    return materialCache['_foliage_light'];
}

function getFlowerMat(color) {
    const key = `_flower_${color}`;
    if (!materialCache[key])
        materialCache[key] = new THREE.MeshStandardMaterial({
            color, roughness: 0.75, metalness: 0.0
        });
    return materialCache[key];
}

function getStemMat() {
    if (!materialCache['_stem'])
        materialCache['_stem'] = new THREE.MeshStandardMaterial({
            color: 0x1B5E20, roughness: 0.9, metalness: 0.0
        });
    return materialCache['_stem'];
}

function getSoilMat() {
    if (!materialCache['_soil'])
        materialCache['_soil'] = new THREE.MeshStandardMaterial({
            color: 0x3E2723, roughness: 0.95, metalness: 0.0
        });
    return materialCache['_soil'];
}

function getWoodBenchMat() {
    const colorConfig = CONFIG.colors.find(c => c.id === state.mainColor) || CONFIG.colors[0];
    return createBoardMaterial(colorConfig, 4, false, 'bench');
}

function getMetalLegMat() {
    if (!materialCache['_metalleg'])
        materialCache['_metalleg'] = new THREE.MeshStandardMaterial({
            color: 0x37474F, roughness: 0.4, metalness: 0.6
        });
    return materialCache['_metalleg'];
}

// Golden retriever materials
function getGoldenFurMat() {
    if (!materialCache['_golden_fur'])
        materialCache['_golden_fur'] = new THREE.MeshStandardMaterial({
            color: 0xDAA520, roughness: 0.92, metalness: 0.0
        });
    return materialCache['_golden_fur'];
}

function getLightFurMat() {
    if (!materialCache['_light_fur'])
        materialCache['_light_fur'] = new THREE.MeshStandardMaterial({
            color: 0xE8C55A, roughness: 0.90, metalness: 0.0
        });
    return materialCache['_light_fur'];
}

function getDarkFurMat() {
    if (!materialCache['_dark_fur'])
        materialCache['_dark_fur'] = new THREE.MeshStandardMaterial({
            color: 0xB8860B, roughness: 0.92, metalness: 0.0
        });
    return materialCache['_dark_fur'];
}

function getNoseMat() {
    if (!materialCache['_dog_nose'])
        materialCache['_dog_nose'] = new THREE.MeshStandardMaterial({
            color: 0x1A1A1A, roughness: 0.6, metalness: 0.1
        });
    return materialCache['_dog_nose'];
}

function getEyeMat() {
    if (!materialCache['_dog_eye'])
        materialCache['_dog_eye'] = new THREE.MeshStandardMaterial({
            color: 0x2B1810, roughness: 0.4, metalness: 0.15
        });
    return materialCache['_dog_eye'];
}

function getTongueMat() {
    if (!materialCache['_dog_tongue'])
        materialCache['_dog_tongue'] = new THREE.MeshStandardMaterial({
            color: 0xE8838A, roughness: 0.7, metalness: 0.0
        });
    return materialCache['_dog_tongue'];
}

// ============================================================
// Plant types
// ============================================================

/**
 * Potted Plant — terracotta pot with rounded foliage bush
 * ~1.5ft pot + ~2ft foliage = ~3.5ft total height
 */
function createPottedPlant() {
    const group = new THREE.Group();

    // Pot (tapered cylinder)
    const potGeo = new THREE.CylinderGeometry(0.4, 0.3, 0.8, 12);
    const pot = new THREE.Mesh(potGeo, getTerracottaMat());
    pot.position.y = 0.4;
    pot.castShadow = true;
    group.add(pot);

    // Pot rim
    const rimGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.06, 12);
    const rim = new THREE.Mesh(rimGeo, getTerracottaMat());
    rim.position.y = 0.8;
    rim.castShadow = true;
    group.add(rim);

    // Soil disk
    const soilGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.04, 12);
    const soil = new THREE.Mesh(soilGeo, getSoilMat());
    soil.position.y = 0.78;
    group.add(soil);

    // Foliage — cluster of spheres
    const mainLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), getFoliageMat());
    mainLeaf.position.set(0, 1.5, 0);
    mainLeaf.castShadow = true;
    group.add(mainLeaf);

    const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), getLightFoliageMat());
    leaf2.position.set(0.3, 1.7, 0.15);
    leaf2.castShadow = true;
    group.add(leaf2);

    const leaf3 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), getFoliageMat());
    leaf3.position.set(-0.2, 1.8, -0.2);
    leaf3.castShadow = true;
    group.add(leaf3);

    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.7, 6);
    const stem = new THREE.Mesh(stemGeo, getStemMat());
    stem.position.y = 1.0;
    group.add(stem);

    group.userData.accessoryType = 'potted-plant';
    group.userData.label = 'Potted Plant';
    return group;
}

/**
 * Tall Planter — rectangular dark planter with multiple tall shrubs
 * Good for edges/corners of the deck
 */
function createTallPlanter() {
    const group = new THREE.Group();

    // Rectangular planter box
    const boxGeo = new THREE.BoxGeometry(1.2, 1.0, 0.5);
    const box = new THREE.Mesh(boxGeo, getDarkPotMat());
    box.position.y = 0.5;
    box.castShadow = true;
    group.add(box);

    // Soil surface
    const soilGeo = new THREE.BoxGeometry(1.1, 0.04, 0.4);
    const soil = new THREE.Mesh(soilGeo, getSoilMat());
    soil.position.y = 0.98;
    group.add(soil);

    // Multiple foliage cones (like cypress or ornamental grass)
    const positions = [[-0.35, 0], [0, 0], [0.35, 0]];
    positions.forEach(([x, z], i) => {
        const h = 1.6 + Math.sin(i * 1.5) * 0.3;
        const coneGeo = new THREE.ConeGeometry(0.22, h, 8);
        const mat = i % 2 === 0 ? getFoliageMat() : getLightFoliageMat();
        const cone = new THREE.Mesh(coneGeo, mat);
        cone.position.set(x, 1.0 + h / 2, z);
        cone.castShadow = true;
        group.add(cone);

        // Stem
        const stemGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.3, 5);
        const stem = new THREE.Mesh(stemGeo, getStemMat());
        stem.position.set(x, 1.1, z);
        group.add(stem);
    });

    group.userData.accessoryType = 'tall-planter';
    group.userData.label = 'Tall Planter';
    return group;
}

/**
 * Flower Box — low, wide planter with colorful flowers
 * Good for railings or table tops
 */
function createFlowerBox() {
    const group = new THREE.Group();

    // Low rectangular planter
    const boxGeo = new THREE.BoxGeometry(1.5, 0.5, 0.4);
    const box = new THREE.Mesh(boxGeo, getTerracottaMat());
    box.position.y = 0.25;
    box.castShadow = true;
    group.add(box);

    // Soil
    const soilGeo = new THREE.BoxGeometry(1.4, 0.04, 0.3);
    const soil = new THREE.Mesh(soilGeo, getSoilMat());
    soil.position.y = 0.48;
    group.add(soil);

    // Flowers — small spheres on stems in a row
    const flowerColors = [0xFF4081, 0xFFEB3B, 0xFF4081, 0x7C4DFF, 0xFFEB3B];
    flowerColors.forEach((color, i) => {
        const x = -0.5 + i * 0.25;
        const z = (Math.random() - 0.5) * 0.15;

        // Stem
        const stemH = 0.3 + Math.random() * 0.2;
        const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, stemH, 5);
        const stem = new THREE.Mesh(stemGeo, getStemMat());
        stem.position.set(x, 0.5 + stemH / 2, z);
        group.add(stem);

        // Flower head
        const flowerGeo = new THREE.SphereGeometry(0.08, 6, 4);
        const flower = new THREE.Mesh(flowerGeo, getFlowerMat(color));
        flower.position.set(x, 0.5 + stemH + 0.05, z);
        flower.castShadow = true;
        group.add(flower);

        // Leaves at base
        const leafGeo = new THREE.SphereGeometry(0.12, 6, 4);
        leafGeo.scale(1, 0.5, 1);
        const leaf = new THREE.Mesh(leafGeo, getFoliageMat());
        leaf.position.set(x, 0.55, z);
        group.add(leaf);
    });

    group.userData.accessoryType = 'flower-box';
    group.userData.label = 'Flower Box';
    return group;
}

// ============================================================
// Bench types
// ============================================================

/**
 * Simple Backless Bench — 4ft bench with plank seat and metal legs
 * Uses deck wood material for seat
 */
function createBacklessBench() {
    const group = new THREE.Group();
    const woodMat = getWoodBenchMat();
    const legMat = getMetalLegMat();

    const seatW = 3.0;    // 3ft wide
    const seatD = 1.2;    // 1.2ft deep
    const seatH = 1.5;    // 1.5ft seat height
    const plankTh = 1 / 12; // 1" thick boards

    // Seat planks (3 boards side by side)
    for (let i = 0; i < 3; i++) {
        const z = -seatD / 2 + (i + 0.5) * (seatD / 3);
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(seatW, plankTh, seatD / 3 - 0.02),
            woodMat
        );
        plank.position.set(0, seatH, z);
        plank.castShadow = true;
        plank.receiveShadow = true;
        group.add(plank);
    }

    // Cross supports under seat (2)
    [-seatW / 2 + 0.3, seatW / 2 - 0.3].forEach(x => {
        const support = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.08, seatD - 0.1),
            legMat
        );
        support.position.set(x, seatH - plankTh / 2 - 0.04, 0);
        support.castShadow = true;
        group.add(support);
    });

    // 4 legs
    const legW = 0.08;
    [[-seatW / 2 + 0.2, -seatD / 2 + 0.15],
     [-seatW / 2 + 0.2,  seatD / 2 - 0.15],
     [ seatW / 2 - 0.2, -seatD / 2 + 0.15],
     [ seatW / 2 - 0.2,  seatD / 2 - 0.15]
    ].forEach(([x, z]) => {
        const leg = new THREE.Mesh(
            new THREE.BoxGeometry(legW, seatH, legW),
            legMat
        );
        leg.position.set(x, seatH / 2, z);
        leg.castShadow = true;
        group.add(leg);
    });

    group.userData.accessoryType = 'backless-bench';
    group.userData.label = 'Backless Bench';
    return group;
}

/**
 * Bench with Back — 4ft bench with backrest, uses deck wood material
 */
function createBenchWithBack() {
    const group = new THREE.Group();
    const woodMat = getWoodBenchMat();
    const legMat = getMetalLegMat();

    const seatW = 3.0;
    const seatD = 1.4;
    const seatH = 1.5;
    const backH = 1.5;     // backrest height above seat
    const plankTh = 1 / 12;

    // Seat planks (3 boards)
    for (let i = 0; i < 3; i++) {
        const z = -seatD / 2 + (i + 0.5) * (seatD / 3);
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(seatW, plankTh, seatD / 3 - 0.02),
            woodMat
        );
        plank.position.set(0, seatH, z);
        plank.castShadow = true;
        plank.receiveShadow = true;
        group.add(plank);
    }

    // Backrest planks (2 horizontal boards)
    for (let i = 0; i < 2; i++) {
        const y = seatH + 0.4 + i * 0.55;
        const plank = new THREE.Mesh(
            new THREE.BoxGeometry(seatW, 0.4, plankTh),
            woodMat
        );
        plank.position.set(0, y, -seatD / 2);
        plank.castShadow = true;
        group.add(plank);
    }

    // Back support posts (2)
    [-seatW / 2 + 0.2, seatW / 2 - 0.2].forEach(x => {
        const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, seatH + backH, 0.1),
            legMat
        );
        post.position.set(x, (seatH + backH) / 2, -seatD / 2 + 0.05);
        post.castShadow = true;
        group.add(post);
    });

    // Front legs (2)
    [-seatW / 2 + 0.2, seatW / 2 - 0.2].forEach(x => {
        const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, seatH, 0.08),
            legMat
        );
        leg.position.set(x, seatH / 2, seatD / 2 - 0.15);
        leg.castShadow = true;
        group.add(leg);
    });

    // Cross supports under seat
    [-seatW / 2 + 0.3, seatW / 2 - 0.3].forEach(x => {
        const support = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.08, seatD - 0.1),
            legMat
        );
        support.position.set(x, seatH - plankTh / 2 - 0.04, 0);
        support.castShadow = true;
        group.add(support);
    });

    group.userData.accessoryType = 'bench-with-back';
    group.userData.label = 'Bench with Back';
    return group;
}

// ============================================================
// Golden Retriever
// ============================================================

/**
 * Golden Retriever — whimsical low-poly dog built from basic geometry
 * ~2ft long, ~1.5ft tall at head
 */
function createGoldenRetriever() {
    const group = new THREE.Group();
    const fur     = getGoldenFurMat();
    const light   = getLightFurMat();
    const dark    = getDarkFurMat();
    const noseMat = getNoseMat();
    const eyeMat  = getEyeMat();
    const tongue  = getTongueMat();

    // Body — elongated ellipsoid (scaled sphere)
    const bodyGeo = new THREE.SphereGeometry(0.45, 12, 10);
    bodyGeo.scale(1.8, 1, 1);       // elongate along X
    const body = new THREE.Mesh(bodyGeo, fur);
    body.position.set(0, 0.65, 0);
    body.castShadow = true;
    group.add(body);

    // Chest — slightly lighter, forward bulge
    const chestGeo = new THREE.SphereGeometry(0.38, 10, 8);
    chestGeo.scale(1, 1.05, 1);
    const chest = new THREE.Mesh(chestGeo, light);
    chest.position.set(0.5, 0.6, 0);
    chest.castShadow = true;
    group.add(chest);

    // Head — sphere
    const headGeo = new THREE.SphereGeometry(0.32, 10, 8);
    const head = new THREE.Mesh(headGeo, fur);
    head.position.set(0.85, 1.0, 0);
    head.castShadow = true;
    group.add(head);

    // Snout — small elongated box
    const snoutGeo = new THREE.BoxGeometry(0.28, 0.16, 0.2);
    const snout = new THREE.Mesh(snoutGeo, light);
    snout.position.set(1.12, 0.92, 0);
    snout.castShadow = true;
    group.add(snout);

    // Nose — tiny sphere at tip of snout
    const noseGeo = new THREE.SphereGeometry(0.055, 6, 5);
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(1.27, 0.95, 0);
    group.add(nose);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.045, 6, 5);
    [-0.12, 0.12].forEach(z => {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(1.08, 1.08, z);
        group.add(eye);
    });

    // Ears — flattened spheres, drooping
    const earGeo = new THREE.SphereGeometry(0.16, 7, 6);
    earGeo.scale(0.6, 1, 0.8);
    [-0.28, 0.28].forEach(z => {
        const ear = new THREE.Mesh(earGeo, dark);
        ear.position.set(0.72, 0.95, z);
        ear.rotation.x = z > 0 ? 0.3 : -0.3;
        ear.rotation.z = z > 0 ? -0.2 : 0.2;
        ear.castShadow = true;
        group.add(ear);
    });

    // Legs — 4 cylinders
    const legGeo = new THREE.CylinderGeometry(0.07, 0.065, 0.5, 7);
    const legPositions = [
        [ 0.5, 0.25,  0.18],   // front-right
        [ 0.5, 0.25, -0.18],   // front-left
        [-0.45, 0.25,  0.18],  // back-right
        [-0.45, 0.25, -0.18],  // back-left
    ];
    legPositions.forEach(([x, y, z]) => {
        const leg = new THREE.Mesh(legGeo, fur);
        leg.position.set(x, y, z);
        leg.castShadow = true;
        group.add(leg);
    });

    // Paws — small flattened spheres at leg bottoms
    const pawGeo = new THREE.SphereGeometry(0.08, 6, 5);
    pawGeo.scale(1.1, 0.5, 1);
    legPositions.forEach(([x, , z]) => {
        const paw = new THREE.Mesh(pawGeo, dark);
        paw.position.set(x, 0.03, z);
        group.add(paw);
    });

    // Tail — tapered cone, slightly raised and curved
    const tailGeo = new THREE.ConeGeometry(0.07, 0.55, 6);
    const tail = new THREE.Mesh(tailGeo, fur);
    tail.position.set(-0.9, 0.95, 0);
    tail.rotation.z = Math.PI / 3;   // angled upward
    tail.castShadow = true;
    group.add(tail);

    // Tongue — tiny flat box sticking out below snout
    const tongueGeo = new THREE.BoxGeometry(0.1, 0.025, 0.07);
    const tongueM = new THREE.Mesh(tongueGeo, tongue);
    tongueM.position.set(1.2, 0.83, 0);
    group.add(tongueM);

    group.userData.accessoryType = 'golden-retriever';
    group.userData.label = 'Golden Retriever';
    return group;
}

// ============================================================
// Registry of accessory types
// ============================================================
export const ACCESSORY_TYPES = {
    'potted-plant':   { label: 'Potted Plant',   category: 'plant', create: createPottedPlant },
    'tall-planter':   { label: 'Tall Planter',   category: 'plant', create: createTallPlanter },
    'flower-box':     { label: 'Flower Box',     category: 'plant', create: createFlowerBox },
    'backless-bench': { label: 'Backless Bench', category: 'bench', create: createBacklessBench },
    'bench-with-back':{ label: 'Bench with Back',category: 'bench', create: createBenchWithBack },
    'golden-retriever':{ label: 'Golden Retriever', category: 'dog', create: createGoldenRetriever },
};

// ============================================================
// Public API — called from scene.js during deck build
// ============================================================

/**
 * Create all accessories from state.accessories array and add to deckGroup.
 * Each accessory in state: { id, type, x, z, rotation }
 * x/z are world coords on deck surface.
 */
export function createAllAccessories(deckGroup, st) {
    if (!st.accessories?.length) return;
    const deckY = st.deckHeight + (CONFIG.boards.thickness / 12);

    st.accessories.forEach(acc => {
        const reg = ACCESSORY_TYPES[acc.type];
        if (!reg) return;

        const obj = reg.create();
        obj.name = `accessory_${acc.id}`;
        obj.position.set(acc.x || 0, deckY, acc.z || 0);
        obj.rotation.y = acc.rotation || 0;

        // Tag all children as accessory for raycasting
        obj.traverse(child => {
            if (child.isMesh) {
                child.userData.accessoryId = acc.id;
                child.receiveShadow = true;
            }
        });

        deckGroup.add(obj);
    });
}
