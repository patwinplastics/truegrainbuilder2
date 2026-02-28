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
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
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
 * Boards along deck LENGTH (X-axis): boardRunsAlongWidth = false
 *   Rotate texture PI/2 so image-vertical (grain) aligns with X.
 *   After rotation: repeat.x controls across-board, repeat.y controls along-board.
 *
 * Boards along deck WIDTH (Z-axis): boardRunsAlongWidth = true
 *   No rotation needed. Image-vertical (grain) naturally aligns with Z via V.
 *   repeat.x controls along-board, repeat.y controls across-board.
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
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

        // Grain tiles along board length; 1 tile across board width
        // (seam at board edge, hidden by gap)
        if (boardRunsAlongWidth) {
            // No rotation: U=X(across), V=Z(along)
            tex.repeat.set(1, boardLengthFt / 4);
        } else {
            // PI/2 rotation: after rotation, texture-X becomes along-board
            tex.repeat.set(boardLengthFt / 4, 1);
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
            textureCache[colorConfig.id] = src;
            applyTex(src);
        });
    }

    materialCache[key] = mat;
    return mat;
}
