import { LevelDefinition } from './types.ts';

export const LEVELS: LevelDefinition[] = [
  // Level 1: Introduction to Mirror
  {
    id: 1,
    name: "first bounce",
    par: 1,
    description: "Use a flat mirror to reflect the lunar beam toward the ruby target.",
    inventory: { prism: 0, green: 0, lens: 0, mirror: 2 },
    emitter: {
      x: 180,
      y: 180,
      angle: 0.78, // ~45 deg
      beamWidth: 32,
      intensity: 1.0
    },
    targets: [
      { id: "t-red-1", x: 700, y: 500, radius: 36, colorType: "red", isLit: false, lightIntensity: 0 }
    ],
    blackHoles: [],
    walls: [
      { x: 380, y: 280, width: 30, height: 300 }
    ]
  },

  // Level 2: The Newton Prism
  {
    id: 2,
    name: "spectrum division",
    par: 1,
    description: "Place a triangular glass prism to disperse white light into colors.",
    inventory: { prism: 1, green: 0, lens: 0, mirror: 1 },
    emitter: {
      x: 180,
      y: 220,
      angle: 0.45,
      beamWidth: 32,
      intensity: 1.0
    },
    targets: [
      { id: "t-red-2", x: 740, y: 380, radius: 36, colorType: "red", isLit: false, lightIntensity: 0 },
      { id: "t-blue-2", x: 740, y: 580, radius: 36, colorType: "blue", isLit: false, lightIntensity: 0 }
    ],
    blackHoles: [],
    walls: []
  },

  // Level 3: Dichroic Separation
  {
    id: 3,
    name: "selective green",
    par: 2,
    description: "Split the spectrum and reflect the green band to the emerald beacon.",
    inventory: { prism: 1, green: 1, lens: 0, mirror: 1 },
    emitter: {
      x: 180,
      y: 240,
      angle: 0.52,
      beamWidth: 32,
      intensity: 1.0
    },
    targets: [
      { id: "t-green-3", x: 710, y: 200, radius: 36, colorType: "green", isLit: false, lightIntensity: 0 },
      { id: "t-red-3", x: 730, y: 550, radius: 36, colorType: "red", isLit: false, lightIntensity: 0 }
    ],
    blackHoles: [],
    walls: []
  },

  // Level 4: Convex Focusing
  {
    id: 4,
    name: "focal convergence",
    par: 2,
    description: "A narrow target requires a convex lens to converge diverging rays.",
    inventory: { prism: 0, green: 0, lens: 1, mirror: 2 },
    emitter: {
      x: 180,
      y: 180,
      angle: 0.65,
      beamWidth: 34,
      intensity: 1.0
    },
    targets: [
      { id: "t-blue-4", x: 720, y: 680, radius: 36, colorType: "blue", isLit: false, lightIntensity: 0 },
      { id: "t-white-4", x: 200, y: 500, radius: 36, colorType: "white", isLit: false, lightIntensity: 0 }
    ],
    blackHoles: [],
    walls: [
      { x: 120, y: 350, width: 180, height: 26 }
    ]
  },

  // Level 5: Gravitational Deflection
  {
    id: 5,
    name: "event horizon",
    par: 2,
    description: "Harness the gravitational lensing of a black hole to curve light around barriers.",
    inventory: { prism: 0, green: 0, lens: 1, mirror: 2 },
    emitter: {
      x: 180,
      y: 200,
      angle: 0.60,
      beamWidth: 32,
      intensity: 1.0
    },
    targets: [
      { id: "t-red-5", x: 720, y: 650, radius: 36, colorType: "red", isLit: false, lightIntensity: 0 }
    ],
    blackHoles: [
      { x: 450, y: 460, mass: 110, eventHorizonRadius: 24, accretionRadius: 65 }
    ],
    walls: [
      { x: 620, y: 300, width: 26, height: 260 }
    ]
  },

  // Level 70: THE ASSAY (The iconic puzzle from the video!)
  {
    id: 70,
    name: "the assay",
    par: 5,
    description: "The definitive optics crucible. Replicate the masterpiece solution.",
    inventory: { prism: 1, green: 1, lens: 1, mirror: 2 },
    emitter: {
      x: 185,
      y: 185,
      angle: 0.785, // 45 degrees towards center
      beamWidth: 36,
      intensity: 1.0
    },
    targets: [
      // Top Right: Emerald Green Orb
      { id: "t-green-70", x: 710, y: 175, radius: 36, colorType: "green", isLit: false, lightIntensity: 0 },
      // Mid Right: Ruby Red Orb
      { id: "t-red-70", x: 705, y: 535, radius: 36, colorType: "red", isLit: false, lightIntensity: 0 },
      // Bottom Right: Sapphire Deep Blue Orb
      { id: "t-blue-70", x: 705, y: 735, radius: 36, colorType: "blue", isLit: false, lightIntensity: 0 },
      // Mid Left: Dusty Moon / Golden Orb
      { id: "t-white-70", x: 180, y: 465, radius: 38, colorType: "white", isLit: false, lightIntensity: 0 }
    ],
    blackHoles: [
      // Central Black Hole with accretion disk & gravitational lensing
      { x: 500, y: 505, mass: 120, eventHorizonRadius: 24, accretionRadius: 68 }
    ],
    walls: [
      // Wall barrier between emitter and dusty moon
      { x: 120, y: 362, width: 182, height: 26 }
    ]
  },

  // Sandbox / Free Play
  {
    id: 999,
    name: "free play sandbox",
    par: 0,
    description: "Unlimited optical pieces and black holes. Build your own optical laboratory.",
    inventory: { prism: 9, green: 9, lens: 9, mirror: 9 },
    emitter: {
      x: 185,
      y: 185,
      angle: 0.785,
      beamWidth: 36,
      intensity: 1.0
    },
    targets: [
      { id: "sb-green", x: 710, y: 175, radius: 36, colorType: "green", isLit: false, lightIntensity: 0 },
      { id: "sb-red", x: 705, y: 535, radius: 36, colorType: "red", isLit: false, lightIntensity: 0 },
      { id: "sb-blue", x: 705, y: 735, radius: 36, colorType: "blue", isLit: false, lightIntensity: 0 },
      { id: "sb-white", x: 180, y: 465, radius: 38, colorType: "white", isLit: false, lightIntensity: 0 }
    ],
    blackHoles: [
      { x: 500, y: 505, mass: 120, eventHorizonRadius: 24, accretionRadius: 68 }
    ],
    walls: [
      { x: 120, y: 362, width: 182, height: 26 }
    ]
  }
];
