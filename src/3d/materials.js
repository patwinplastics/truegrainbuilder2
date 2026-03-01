// ============================================================
// TrueGrain Deck Builder 2 — Material & Texture Library
// Ultra-Realistic Rendering Edition
// Uses existing diffuse textures only.
// ============================================================
import { CONFIG } from '../config.js';

export const textureCache  = {};
export const materialCache = {};
export const geometryCache = {};

// 2K cap — sharper grain on close inspection vs old 1024 cap
const MAX_TEXTURE_SIZE = 2048;
let maxAniso = 1;

// ============================================================
// Internal helpers
// ============================================================

function downsampleTexture(texture, maxSize) {
    if (!maxSize) maxSize = MAX_TEXTURE_SIZE;
    const image = texture.image;
    if (!image || (image.width <= maxSize && image.height <= maxSize)) return texture;

    const scale = maxSize / Math.max(image.width, image.height);
    const w = Math.round(image.width  * scale);
    const h = Math.round(image.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, w, h);

    texture.image = canvas;
    texture.needsUpdate = true;
    return texture;
}

// ============================================================
// Public API
// ============================================================

export function preloadTextures() {
    const loader = new THREE.TextureLoader();
    CONFIG.colors.forEach(color => {
        if (textureCache[color.id]) return;
        loader.load(
            CONFIG.texturePath + color.file,
            tex => {
                downsampleTexture(tex, MAX_TEXTURE_SIZE);
                // No colorSpace override — let Three.js use the texture as-is
                // so rendered colors stay faithful to the source JPG files.
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
    Object.values(textureCache).forEach(t => {
        if (t && t.isTexture) { t.anisotropy = maxAniso; t.needsUpdate = true; }
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
 * Board face material — uses existing diffuse texture with
 * calibrated PBR roughness/metalness and envMapIntensity.
 */
export function createBoardMaterial(colorConfig, boardLengthFt, boardRunsAlongWidth, uniqueId = '') {
    const rotation = boardRunsAlongWidth ? 0 : Math.PI / 2;
    const key = `board_${colorConfig.id}_${rotation.toFixed(2)}`;
    if (materialCache[key]) return materialCache[key];

    const mat = new THREE.MeshStandardMaterial({
        color:           new THREE.Color(colorConfig.hex),
        roughness:       0.82,
        metalness:       0.0,
        envMapIntensity: 0.4,
    });

    const applyTex = (src) => {
        const tex = src.clone();
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy  = maxAniso;
        tex.repeat.set(1, 1);
        tex.offset.set(0, 0);
        tex.center.set(0.5, 0.5);
        tex.rotation    = rotation;
        tex.needsUpdate = true;
        mat.map = tex;
        mat.color.setHex(0xFFFFFF);
        mat.needsUpdate = true;
    };

    if (textureCache[colorConfig.id]) {
        applyTex(textureCache[colorConfig.id]);
    } else {
        new THREE.TextureLoader().load(
            CONFIG.texturePath + colorConfig.file,
            src => {
                downsampleTexture(src, MAX_TEXTURE_SIZE);
                src.wrapS = src.wrapT = THREE.RepeatWrapping;
                src.anisotropy = maxAniso;
                textureCache[colorConfig.id] = src;
                applyTex(src);
            }
        );
    }

    materialCache[key] = mat;
    return mat;
}

/**
 * End-cap material — slightly darker and more matte than the face.
 */
export function createCapMaterial(colorConfig) {
    const key = `cap_${colorConfig.id}`;
    if (materialCache[key]) return materialCache[key];
    const mat = new THREE.MeshStandardMaterial({
        color:           new THREE.Color(colorConfig.hex).multiplyScalar(0.80),
        roughness:       0.94,
        metalness:       0.0,
        envMapIntensity: 0.1,
    });
    materialCache[key] = mat;
    return mat;
}
