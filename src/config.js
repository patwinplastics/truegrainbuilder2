// ============================================================
// TrueGrain Deck Builder 2 — Central Configuration
// ============================================================
export const CONFIG = {
    boards: {
        availableLengths: [12, 16, 20],
        width: 5.5,
        thickness: 1,
        gap: 0.125,          // 1/8" install gap
        maxContinuousRun: 20
    },
    joists: {
        spacingOptions: [16, 12],
        defaultSpacing: 16
    },
    dimensions: {
        minLength: 8,
        maxLength: 40,
        minWidth: 8,
        maxWidth: 30,
        defaultLength: 16,
        defaultWidth: 12
    },
    deck: {
        minHeight: 0.5,
        maxHeight: 8,
        defaultHeight: 2
    },
    stairs: {
        minDeckHeightForStairs: 1,
        defaultWidth: 4,
        landingDepth: 3,
        boardsPerTread: { min: 1, max: 3, default: 2 },
        riserHeight: { target: 7, min: 4, max: 7.75 },
        treadDepth: { min: 10 },
        stringerThickness: 1.5,
        stringerWidth: 9.25,
        stringerInset: 1.5,
        centerStringerMinWidth: 3,
        doubleCenterStringerMinWidth: 6
    },
    pricing: {
        materialPerLF: { min: 5.00, max: 7.00, default: 6.00 },
        laborPerSF: { min: 10.00, max: 15.00 },
        clipsPerBox: 90,
        clipBoxPrice: 42.00,
        screwsPerBox: 350,
        screwBoxPrice: 38.00
    },
    waste: { default: 10, min: 5, max: 20 },

    // ── Asset paths ─────────────────────────────────────────
    texturePath: 'textures/',

    // Place a 2K or 4K .hdr file here for HDRI environment lighting.
    // Free outdoor HDRIs: https://polyhaven.com/hdris/outdoor
    // Recommended: 'hdri/outdoor_midday.hdr' or 'hdri/kloppenheim_06_2k.hdr'
    // If file is absent the app falls back to a procedural sky automatically.
    hdriPath: 'hdri/outdoor_midday.hdr',

    logoPath: 'images/truegrain-logo.png',
    formspreeEndpoint: 'https://formspree.io/f/meezabrg',
    formspreeCustomerEndpoint: 'https://formspree.io/f/mzdvkzwl',
    companyInfo: {
        email: 'sales@americanprobp.com',
        phone: '1-877-442-6776',
        address: '2300 E Linden Ave, Linden, NJ 07036'
    },

    // ── Color / Texture definitions ──────────────────────────
    // Each color supports optional PBR map files alongside the diffuse.
    // normalFile    — surface grain micro-detail (huge realism boost)
    // roughnessFile — varied sheen across the grain
    // aoFile        — ambient occlusion baked into the surface
    //
    // Naming convention used below: <Color>_normal.jpg, etc.
    // If a file is absent, that channel is simply skipped — no errors.
    //
    // Free PBR wood texture sets: https://polyhaven.com/textures/wood
    // Recommended workflow: download a matching wood set from PolyHaven,
    // rename to match the filenames below, place in /public/textures/.
    colors: [
        {
            id:            'aged-oak',
            name:          'Aged Oak',
            file:          'Aged-Oak.jpg',
            normalFile:    'Aged-Oak_normal.jpg',
            roughnessFile: 'Aged-Oak_roughness.jpg',
            aoFile:        'Aged-Oak_ao.jpg',
            hex:           '#9A9590'
        },
        {
            id:            'coastal-driftwood',
            name:          'Coastal Driftwood',
            file:          'Coastal-Driftwood.jpg',
            normalFile:    'Coastal-Driftwood_normal.jpg',
            roughnessFile: 'Coastal-Driftwood_roughness.jpg',
            aoFile:        'Coastal-Driftwood_ao.jpg',
            hex:           '#C4B9A0'
        },
        {
            id:            'embered-taupe',
            name:          'Embered Taupe',
            file:          'Embered-Taupe.jpg',
            normalFile:    'Embered-Taupe_normal.jpg',
            roughnessFile: 'Embered-Taupe_roughness.jpg',
            aoFile:        'Embered-Taupe_ao.jpg',
            hex:           '#8B7B6B'
        },
        {
            id:            'new-england-birch',
            name:          'New England Birch',
            file:          'New-England-Birch.jpg',
            normalFile:    'New-England-Birch_normal.jpg',
            roughnessFile: 'New-England-Birch_roughness.jpg',
            aoFile:        'New-England-Birch_ao.jpg',
            hex:           '#C9A86C'
        },
        {
            id:            'royal-ipe',
            name:          'Royal IPE / Nutmeg Oak',
            file:          'Royal-IPE.jpg',
            normalFile:    'Royal-IPE_normal.jpg',
            roughnessFile: 'Royal-IPE_roughness.jpg',
            aoFile:        'Royal-IPE_ao.jpg',
            hex:           '#6B5344'
        },
        {
            id:            'tropical-walnut',
            name:          'Tropical Walnut',
            file:          'Tropical-Walnut.jpg',
            normalFile:    'Tropical-Walnut_normal.jpg',
            roughnessFile: 'Tropical-Walnut_roughness.jpg',
            aoFile:        'Tropical-Walnut_ao.jpg',
            hex:           '#A67C52'
        }
    ],
    boardLengthColors: { 12: 0x4CAF50, 16: 0x2196F3, 20: 0x9C27B0 }
};
