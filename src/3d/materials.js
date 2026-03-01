// ============================================================
// TrueGrain Deck Builder 2 — Material & Texture Library
// Ultra-Realistic PBR Edition
// ============================================================
import { CONFIG } from '../config.js';

export const textureCache  = {};
export const materialCache = {};
export const geometryCache = {};

// Raised from 1024 — 2K gives visible grain detail on close inspection
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

/**
 * Load a texture with standard PBR defaults.
 * colorSpace: pass THREE.SRGBColorSpace for diffuse maps, leave undefined for
 *             data maps (normal, roughness, AO) which must stay linear.
 */
function loadTex(file, colorSpace) {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(
        file,
        (t) => {
            downsampleTexture(t, MAX_TEXTURE_SIZE);
            t.anisotropy  = maxAniso;
            t.needsUpdate = true;
        },
        undefined,
        () => console.warn(`Texture load failed: ${file}`)
    );
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (colorSpace) tex.colorSpace = colorSpace;
    return tex;
}

// ============================================================
// Public API
// ============================================================

export function preloadTextures() {
    CONFIG.colors.forEach(color => {
        if (textureCache[color.id]) return;
        const path = CONFIG.texturePath;
        textureCache[color.id] = {
            diffuse:   loadTex(path + color.file,         THREE.SRGBColorSpace),
            normal:    color.normalFile    ? loadTex(path + color.normalFile)    : null,
            roughness: color.roughnessFile ? loadTex(path + color.roughnessFile) : null,
            ao:        color.aoFile        ? loadTex(path + color.aoFile)        : null,
        };
    });
}

export function setMaxAnisotropy(renderer) {
    maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 1;
    // Apply to all already-loaded textures
    Object.values(textureCache).forEach(bundle => {
        if (!bundle || typeof bundle !== 'object') return;
        Object.values(bundle).forEach(t => {
            if (t && t.isTexture) { t.anisotropy = maxAniso; t.needsUpdate = true; }
        });
    });
}

export function disposeAllCaches() {
    Object.keys(geometryCache).forEach(k => { geometryCache[k]?.dispose(); delete geometryCache[k]; });
    Object.keys(materialCache).forEach(k => {
        if (materialCache[k]) {
            const m = materialCache[k];
            ['map','normalMap','roughnessMap','aoMap','displacementMap'].forEach(ch => m[ch]?.dispose());
            m.dispose();
        }
        delete materialCache[k];
    });
    Object.keys(textureCache).forEach(k => {
        const bundle = textureCache[k];
        if (bundle && typeof bundle === 'object') {
            Object.values(bundle).forEach(t => t?.dispose?.());
        }
        delete textureCache[k];
    });
}

/**
 * Create (or return cached) full-PBR board material.
 * Uses diffuse + normal + roughness + AO maps when available,
 * gracefully falls back to color-only when PBR maps are absent.
 */
export function createBoardMaterial(colorConfig, boardLengthFt, boardRunsAlongWidth, uniqueId = '') {
    const rotation = boardRunsAlongWidth ? 0 : Math.PI / 2;
    const key = `board_${colorConfig.id}_${rotation.toFixed(2)}`;
    if (materialCache[key]) return materialCache[key];

    const mat = new THREE.MeshStandardMaterial({
        color:     new THREE.Color(colorConfig.hex),
        roughness: 0.85,    // overridden by roughnessMap when present
        metalness: 0.0,
        envMapIntensity: 0.6,
    });

    const applyBundle = (bundle) => {
        const applyTex = (src, channel, colorSpace) => {
            if (!src) return;
            const tex = src.clone ? src.clone() : src;
            tex.wrapS    = tex.wrapT = THREE.RepeatWrapping;
            tex.anisotropy = maxAniso;
            // Boards are narrow (~5.5") — tile the texture every board-width
            tex.repeat.set(1, 1);
            tex.center.set(0.5, 0.5);
            tex.rotation  = rotation;
            if (colorSpace) tex.colorSpace = colorSpace;
            tex.needsUpdate = true;
            return tex;
        };

        if (bundle.diffuse) {
            mat.map   = applyTex(bundle.diffuse, 'map', THREE.SRGBColorSpace);
            mat.color.setHex(0xFFFFFF); // let texture drive color
        }
        if (bundle.normal) {
            mat.normalMap   = applyTex(bundle.normal);
            mat.normalScale = new THREE.Vector2(1.2, 1.2);
        }
        if (bundle.roughness) {
            mat.roughnessMap = applyTex(bundle.roughness);
            mat.roughness    = 1.0; // fully driven by map
        }
        if (bundle.ao) {
            mat.aoMap          = applyTex(bundle.ao);
            mat.aoMapIntensity = 1.0;
        }
        mat.needsUpdate = true;
    };

    // Use cached bundle if available, otherwise load on-demand
    if (textureCache[colorConfig.id]) {
        applyBundle(textureCache[colorConfig.id]);
    } else {
        // Lazy-load diffuse only (PBR maps loaded via preloadTextures)
        const path = CONFIG.texturePath;
        const bundle = {
            diffuse:   loadTex(path + colorConfig.file,         THREE.SRGBColorSpace),
            normal:    colorConfig.normalFile    ? loadTex(path + colorConfig.normalFile)    : null,
            roughness: colorConfig.roughnessFile ? loadTex(path + colorConfig.roughnessFile) : null,
            ao:        colorConfig.aoFile        ? loadTex(path + colorConfig.aoFile)        : null,
        };
        textureCache[colorConfig.id] = bundle;
        // Apply after diffuse loads (others may be null/loading)
        bundle.diffuse.addEventListener?.('loaded', () => applyBundle(bundle));
        applyBundle(bundle); // also apply synchronously for any already-resolved textures
    }

    materialCache[key] = mat;
    return mat;
}

/**
 * Create (or return cached) solid-color end-cap material.
 * Slightly darker and more matte than face to simulate a cut composite edge.
 */
export function createCapMaterial(colorConfig) {
    const key = `cap_${colorConfig.id}`;
    if (materialCache[key]) return materialCache[key];
    const mat = new THREE.MeshStandardMaterial({
        color:     new THREE.Color(colorConfig.hex).multiplyScalar(0.82),
        roughness: 0.92,
        metalness: 0.0,
        envMapIntensity: 0.2,
    });
    materialCache[key] = mat;
    return mat;
}
