// ============================================================
// TrueGrain Deck Builder 2 — Material & Texture Library
// ============================================================
import { CONFIG } from '../config.js';

export const textureCache  = {};
export const materialCache = {};
export const geometryCache = {};

let maxAniso = 1;

export function preloadTextures() {
    const loader = new THREE.TextureLoader();
    CONFIG.colors.forEach(color => {
        if (textureCache[color.id]) return;
        loader.load(
            CONFIG.texturePath + color.file,
            tex => {
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.anisotropy = maxAniso;
                textureCache[color.id] = tex;
            },
            undefined,
            () => console.warn(`Texture load failed: ${color.file}`)
        );
    });
}

export function setMaxAnisotropy(renderer) {
    maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 1;
    Object.values(textureCache).forEach(t => { t.anisotropy = maxAniso; t.needsUpdate = true; });
}

export function disposeAllCaches() {
    Object.keys(geometryCache).forEach(k => { geometryCache[k]?.dispose(); delete geometryCache[k]; });
    Object.keys(materialCache).forEach(k => {
        if (materialCache[k]) { materialCache[k].map?.dispose(); materialCache[k].dispose(); }
        delete materialCache[k];
    });
    Object.keys(textureCache).forEach(k => { textureCache[k]?.dispose(); delete textureCache[k]; });
}

/**
 * Create (or return cached) board material.
 *
 * Source textures: grain runs VERTICALLY (along image Y axis).
 * BoxGeometry top face UV: U -> world X, V -> world Z.
 *
 * Boards along X (boardRunsAlongWidth=false):
 *   Rotate PI/2 so image-Y (grain) aligns with world X.
 *   After rotation, repeat.x -> along-board (X), repeat.y -> across-board (Z).
 *   So: repeat.set(boardLengthFt / 4, 1)
 *
 * Boards along Z (boardRunsAlongWidth=true):
 *   No rotation. Image-Y grain naturally aligns with Z via V.
 *   repeat.x -> across-board (X), repeat.y -> along-board (Z).
 *   So: repeat.set(1, boardLengthFt / 4)
 */
export function createBoardMaterial(colorConfig, boardLengthFt, boardRunsAlongWidth, uniqueId = '') {
    const rotation = boardRunsAlongWidth ? 0 : Math.PI / 2;
    const key = `board_${colorConfig.id}_${rotation.toFixed(2)}_${boardLengthFt}`;
    if (materialCache[key]) return materialCache[key];

    const mat = new THREE.MeshStandardMaterial({
        color:     new THREE.Color(colorConfig.hex),
        roughness: 0.75,
        metalness: 0.0
    });

    const alongBoard = boardLengthFt / 4;

    const applyTex = (src) => {
        const tex = src.clone();
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = maxAniso;

        if (boardRunsAlongWidth) {
            // No rotation: U=X(across), V=Z(along)
            tex.repeat.set(1, alongBoard);
        } else {
            // PI/2 rotation: U=X(along), V=Z(across) after rotation swap
            tex.repeat.set(alongBoard, 1);
        }

        tex.center.set(0.5, 0.5);
        tex.rotation = rotation;
        tex.needsUpdate = true;
        mat.map = tex;
        mat.color.setHex(0xFFFFFF);
        mat.needsUpdate = true;
    };

    if (textureCache[colorConfig.id]) {
        applyTex(textureCache[colorConfig.id]);
    } else {
        new THREE.TextureLoader().load(CONFIG.texturePath + colorConfig.file, src => {
            src.wrapS = src.wrapT = THREE.RepeatWrapping;
            src.anisotropy = maxAniso;
            textureCache[colorConfig.id] = src;
            applyTex(src);
        });
    }

    materialCache[key] = mat;
    return mat;
}
