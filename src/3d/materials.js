// ============================================================
// TrueGrain Deck Builder 2 — Material & Texture Library
// ============================================================
import { CONFIG } from '../config.js';

export const textureCache  = {};
export const materialCache = {};
export const geometryCache = {};

export function preloadTextures() {
    const loader = new THREE.TextureLoader();
    CONFIG.colors.forEach(color => {
        if (textureCache[color.id]) return;
        loader.load(
            CONFIG.texturePath + color.file,
            tex => {
                tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;
                textureCache[color.id] = tex;
            },
            undefined,
            () => console.warn(`Texture load failed: ${color.file}`)
        );
    });
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
 * Texture grain runs vertically in the source image.
 * BoxGeometry top face UV: U -> world X, V -> world Z.
 *
 * Boards along deck LENGTH (X-axis): rotate PI/2 so grain aligns with X.
 * Boards along deck WIDTH  (Z-axis): no rotation, grain already aligns with Z.
 *
 * Texture is stretched once across the full board (no tiling, no seams).
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

    const applyTex = (src) => {
        const tex = src.clone();
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        // Single stretch across the entire board face
        tex.repeat.set(1, 1);
        tex.offset.set(0, 0);
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
            src.wrapS = src.wrapT = THREE.ClampToEdgeWrapping;
            src.minFilter = THREE.LinearFilter;
            src.magFilter = THREE.LinearFilter;
            textureCache[colorConfig.id] = src;
            applyTex(src);
        });
    }

    materialCache[key] = mat;
    return mat;
}
