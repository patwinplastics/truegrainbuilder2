// ============================================================
// TrueGrain Deck Builder 2 — Central Configuration
// ============================================================
export const CONFIG = {
    boards: {
        availableLengths: [12, 16, 20],
        width: 5.5,
        thickness: 1,
        gap: 0.1875,
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
        treadDepth: { min: 10 }
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
    texturePath: 'textures/',
    logoPath: 'images/truegrain-logo.png',
    formspreeEndpoint: 'https://formspree.io/f/meezabrg',
    formspreeCustomerEndpoint: 'https://formspree.io/f/mzdvkzwl',
    companyInfo: {
        email: 'sales@americanprobp.com',
        phone: '1-877-442-6776',
        address: '2300 E Linden Ave, Linden, NJ 07036'
    },
    colors: [
        { id: 'aged-oak',          name: 'Aged Oak',              file: 'Aged-Oak.jpg',          hex: '#9A9590' },
        { id: 'coastal-driftwood', name: 'Coastal Driftwood',     file: 'Coastal-Driftwood.jpg', hex: '#C4B9A0' },
        { id: 'embered-taupe',     name: 'Embered Taupe',         file: 'Embered-Taupe.jpg',     hex: '#8B7B6B' },
        { id: 'new-england-birch', name: 'New England Birch',     file: 'New-England-Birch.jpg', hex: '#C9A86C' },
        { id: 'royal-ipe',         name: 'Royal IPE / Nutmeg Oak',file: 'Royal-IPE.jpg',         hex: '#6B5344' },
        { id: 'tropical-walnut',   name: 'Tropical Walnut',       file: 'Tropical-Walnut.jpg',   hex: '#A67C52' }
    ],
    boardLengthColors: { 12: 0x4CAF50, 16: 0x2196F3, 20: 0x9C27B0 }
};
