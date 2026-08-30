/**
 * The Long Spectrum - Level Definitions & Puzzle Data
 * Features 15 handcrafted levels including the featured Level 13 prototype,
 * plus a full Free Play sandbox.
 */

const LEVELS = [
    {
        id: 1,
        title: "FIRST REFLECTION",
        hint: "DRAG A MIRROR ONTO THE BOARD AND ROTATE IT TO 45° TO BOUNCE THE BEAM",
        par: 1,
        inventory: { mirrors: 1, prisms: 0 },
        emitters: [
            { x: 100, y: 200, rotation: 0, beamWidth: 28 }
        ],
        walls: [
            { x: 300, y: 300, width: 400, height: 24 }
        ],
        targets: [
            { x: 500, y: 700, color: 'white', radius: 30, allowWhite: true }
        ]
    },
    {
        id: 2,
        title: "DOUBLE BOUNCE",
        hint: "USE TWO MIRRORS TO GUIDE THE BEAM AROUND THE CENTER WALL",
        par: 2,
        inventory: { mirrors: 2, prisms: 0 },
        emitters: [
            { x: 100, y: 150, rotation: 0, beamWidth: 28 }
        ],
        walls: [
            { x: 350, y: 100, width: 24, height: 600 }
        ],
        targets: [
            { x: 150, y: 750, color: 'white', radius: 30, allowWhite: true }
        ]
    },
    {
        id: 3,
        title: "PRISM DISPERSION",
        hint: "PLACE THE PRISM IN THE LIGHT PATH TO SPLIT WHITE LIGHT INTO COLORS",
        par: 1,
        inventory: { mirrors: 0, prisms: 1 },
        emitters: [
            { x: 100, y: 400, rotation: 0, beamWidth: 28 }
        ],
        walls: [],
        targets: [
            { x: 750, y: 650, color: 'blue', radius: 30 }
        ]
    },
    {
        id: 4,
        title: "DUAL WAVELENGTH",
        hint: "DISPERSE THE SPECTRUM AND USE A MIRROR TO DIRECT THE ORANGE BEAM",
        par: 2,
        inventory: { mirrors: 1, prisms: 1 },
        emitters: [
            { x: 100, y: 300, rotation: 0, beamWidth: 28 }
        ],
        walls: [
            { x: 550, y: 450, width: 24, height: 400 }
        ],
        targets: [
            { x: 450, y: 750, color: 'blue', radius: 30 },
            { x: 750, y: 350, color: 'orange', radius: 30 }
        ]
    },
    {
        id: 5,
        title: "SPECTRUM TRIAD",
        hint: "ALIGN THE PRISM SO THE RAINBOW HITS ALL THREE COLOR FLAGS IN SEQUENCE",
        par: 1,
        inventory: { mirrors: 0, prisms: 1 },
        emitters: [
            { x: 100, y: 300, rotation: 0, beamWidth: 28 }
        ],
        walls: [],
        targets: [
            { x: 620, y: 680, color: 'blue', radius: 28 },
            { x: 710, y: 650, color: 'green', radius: 28 },
            { x: 800, y: 620, color: 'orange', radius: 28 }
        ]
    },
    {
        id: 6,
        title: "THE CHICANE",
        hint: "THREE TURNS TO NAVIGATE THE CORRIDOR AND ACTIVATE THE EMERALD BEACON",
        par: 3,
        inventory: { mirrors: 2, prisms: 1 },
        emitters: [
            { x: 100, y: 150, rotation: 0, beamWidth: 28 }
        ],
        walls: [
            { x: 24, y: 320, width: 680, height: 24 },
            { x: 300, y: 550, width: 676, height: 24 }
        ],
        targets: [
            { x: 150, y: 780, color: 'green', radius: 30 }
        ]
    },
    {
        id: 7,
        title: "REFRACTION ANGLE",
        hint: "DISPERSE THE LIGHT FIRST, THEN BOUNCE BLUE TO THE BOTTOM AND RED TO THE TOP",
        par: 3,
        inventory: { mirrors: 2, prisms: 1 },
        emitters: [
            { x: 100, y: 450, rotation: 0, beamWidth: 28 }
        ],
        walls: [
            { x: 500, y: 300, width: 300, height: 24 }
        ],
        targets: [
            { x: 750, y: 180, color: 'orange', radius: 28 },
            { x: 750, y: 780, color: 'blue', radius: 28 }
        ]
    },
    {
        id: 8,
        title: "THE PERISCOPE",
        hint: "FOUR MIRRORS AROUND MULTIPLE BAFFLE WALLS",
        par: 4,
        inventory: { mirrors: 4, prisms: 0 },
        emitters: [
            { x: 100, y: 150, rotation: 0, beamWidth: 28 }
        ],
        walls: [
            { x: 250, y: 24, width: 24, height: 450 },
            { x: 500, y: 400, width: 24, height: 576 },
            { x: 750, y: 24, width: 24, height: 450 }
        ],
        targets: [
            { x: 880, y: 780, color: 'white', radius: 30, allowWhite: true }
        ]
    },
    {
        id: 9,
        title: "INTERNAL REFLECTION",
        hint: "PRISMS CAN BOTH REFRACT AND TOTALLY INTERNALLY REFLECT LIGHT AT HIGH ANGLES",
        par: 3,
        inventory: { mirrors: 2, prisms: 1 },
        emitters: [
            { x: 100, y: 200, rotation: 0.3, beamWidth: 28 }
        ],
        walls: [
            { x: 450, y: 150, width: 24, height: 500 }
        ],
        targets: [
            { x: 250, y: 800, color: 'blue', radius: 28 },
            { x: 750, y: 750, color: 'green', radius: 28 }
        ]
    },
    {
        id: 10,
        title: "CORNER POCKET",
        hint: "GUIDE LIGHT THROUGH THE NARROW ALLEYWAY INTO THE PRISM CHAMBER",
        par: 4,
        inventory: { mirrors: 3, prisms: 1 },
        emitters: [
            { x: 100, y: 120, rotation: 0, beamWidth: 28 }
        ],
        walls: [
            { x: 24, y: 240, width: 750, height: 24 },
            { x: 220, y: 480, width: 756, height: 24 },
            { x: 24, y: 720, width: 500, height: 24 }
        ],
        targets: [
            { x: 650, y: 850, color: 'blue', radius: 28 },
            { x: 800, y: 850, color: 'orange', radius: 28 }
        ]
    },
    {
        id: 11,
        title: "SPECTRUM CROSSING",
        hint: "USE TWO PRISMS TO FEED DISTINCT SPECTRAL PATHS",
        par: 4,
        inventory: { mirrors: 2, prisms: 2 },
        emitters: [
            { x: 100, y: 200, rotation: 0, beamWidth: 28 }
        ],
        walls: [
            { x: 450, y: 200, width: 24, height: 400 },
            { x: 300, y: 600, width: 400, height: 24 }
        ],
        targets: [
            { x: 180, y: 820, color: 'orange', radius: 28 },
            { x: 820, y: 150, color: 'green', radius: 28 },
            { x: 820, y: 820, color: 'blue', radius: 28 }
        ]
    },
    {
        id: 12,
        title: "LABYRINTH OF GLASS",
        hint: "NAVIGATE 4 REFLECTIONS AND SPLIT LIGHT PRECISELY BETWEEN OBSTACLES",
        par: 5,
        inventory: { mirrors: 4, prisms: 1 },
        emitters: [
            { x: 100, y: 150, rotation: 0, beamWidth: 28 }
        ],
        walls: [
            { x: 24, y: 280, width: 650, height: 24 },
            { x: 350, y: 480, width: 626, height: 24 },
            { x: 24, y: 680, width: 450, height: 24 }
        ],
        targets: [
            { x: 600, y: 840, color: 'blue', radius: 28 },
            { x: 720, y: 840, color: 'green', radius: 28 },
            { x: 840, y: 840, color: 'orange', radius: 28 }
        ]
    },
    {
        id: 13,
        title: "THE LONG SPECTRUM",
        hint: "FOUR TURNS TO REACH THE FLOOR - THE PRISM GOES IN THE LAST STRAIGHT",
        par: 5,
        inventory: { mirrors: 4, prisms: 1 },
        emitters: [
            { x: 95, y: 190, rotation: 0, beamWidth: 32 }
        ],
        walls: [
            { x: 24, y: 285, width: 690, height: 24 },
            { x: 315, y: 450, width: 661, height: 24 }
        ],
        targets: [
            { x: 635, y: 825, color: 'blue', radius: 28 },
            { x: 710, y: 825, color: 'green', radius: 28 },
            { x: 785, y: 825, color: 'orange', radius: 28 }
        ]
    },
    {
        id: 14,
        title: "CHROMATIC GAUNTLET",
        hint: "COMPLEX MULTI-PATH SPLITTING ACROSS A 4-CHAMBER FACILITY",
        par: 6,
        inventory: { mirrors: 4, prisms: 2 },
        emitters: [
            { x: 100, y: 120, rotation: 0, beamWidth: 28 }
        ],
        walls: [
            { x: 24, y: 250, width: 600, height: 24 },
            { x: 400, y: 480, width: 576, height: 24 },
            { x: 24, y: 700, width: 650, height: 24 },
            { x: 500, y: 250, width: 24, height: 230 }
        ],
        targets: [
            { x: 200, y: 840, color: 'blue', radius: 28 },
            { x: 500, y: 840, color: 'green', radius: 28 },
            { x: 800, y: 840, color: 'orange', radius: 28 }
        ]
    },
    {
        id: 15,
        title: "GRAND SPECTRUM",
        hint: "THE ULTIMATE TEST: SPLIT AND RE-DIRECT 4 DISTINCT SPECTRAL WAVELENGTHS",
        par: 7,
        inventory: { mirrors: 5, prisms: 2 },
        emitters: [
            { x: 95, y: 140, rotation: 0, beamWidth: 30 }
        ],
        walls: [
            { x: 24, y: 260, width: 720, height: 24 },
            { x: 250, y: 470, width: 726, height: 24 },
            { x: 24, y: 690, width: 700, height: 24 }
        ],
        targets: [
            { x: 120, y: 850, color: 'red', radius: 26 },
            { x: 380, y: 850, color: 'orange', radius: 26 },
            { x: 620, y: 850, color: 'green', radius: 26 },
            { x: 840, y: 850, color: 'blue', radius: 26 }
        ]
    }
];

// Free Play preset with unlimited inventory and empty or customizable board
const FREE_PLAY_CONFIG = {
    id: 'free',
    title: "FREE PLAY SANDBOX",
    hint: "PLACE UNLIMITED MIRRORS AND PRISMS TO EXPERIMENT WITH LIGHT AND DISPERSION",
    par: 99,
    inventory: { mirrors: 99, prisms: 99 },
    emitters: [
        { x: 100, y: 300, rotation: 0, beamWidth: 30 }
    ],
    walls: [],
    targets: [
        { x: 700, y: 700, color: 'blue', radius: 28 },
        { x: 780, y: 700, color: 'green', radius: 28 },
        { x: 860, y: 700, color: 'orange', radius: 28 }
    ]
};

window.LEVELS = LEVELS;
window.FREE_PLAY_CONFIG = FREE_PLAY_CONFIG;
