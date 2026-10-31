import type { Level, Piece, Target } from './types.ts';

const planet = (id: string, color: Target['color'], x: number, y: number): Target =>
  ({ id, kind: 'planet', color, x, y, radius: 26 });
const flower = (id: string, color: Target['color'], x: number, y: number): Target =>
  ({ id, kind: 'flower', color, x, y, radius: 26 });
const flag = (id: string, x: number, y: number): Target =>
  ({ id, kind: 'flag', color: 'any', x, y, radius: 22 });

const fixed = (id: string, type: Piece['type'], x: number, y: number, angle: number, link?: string): Piece =>
  ({ id, type, x, y, angle, fixed: true, link });

const D = Math.PI / 180;

export const LEVELS: Level[] = [
  {
    id: 1, name: 'first light', par: 1,
    hint: 'drag the mirror onto the beam, then turn it with the orange handle',
    inventory: { mirror: 1 },
    emitters: [{ id: 'sun', kind: 'sun', x: 120, y: 450, angle: 0, width: 26 }],
    targets: [flag('t1', 700, 200)]
  },
  {
    id: 2, name: 'the corner', par: 2,
    inventory: { mirror: 2 },
    emitters: [{ id: 'moon', kind: 'moon', x: 130, y: 450, angle: 0, width: 26 }],
    targets: [planet('t1', 'white', 450, 780)],
    walls: [{ x: 300, y: 600, w: 420, h: 30 }]
  },
  {
    id: 3, name: 'the split', par: 1,
    hint: 'a prism fans white light into its colours',
    inventory: { prism: 1 },
    emitters: [{ id: 'moon', kind: 'moon', x: 130, y: 380, angle: 0, width: 26 }],
    targets: [planet('r', 'red', 760, 620), planet('g', 'green', 760, 665), planet('b', 'blue', 760, 725)]
  },
  {
    id: 4, name: 'green only', par: 1,
    inventory: { filter: 1 },
    emitters: [{ id: 'sun', kind: 'sun', x: 130, y: 700, angle: -45 * D, width: 26 }],
    targets: [flower('g', 'green', 650, 180)]
  },
  {
    id: 5, name: 'dichroic', par: 2,
    hint: 'the dichroic filter reflects red and lets the rest through',
    inventory: { dichroic: 1, filter: 1 },
    emitters: [{ id: 'moon', kind: 'moon', x: 130, y: 450, angle: 0, width: 26 }],
    targets: [planet('r', 'red', 450, 200), flower('g', 'green', 780, 450)]
  },
  {
    id: 6, name: 'focus', par: 1,
    hint: 'a lens bends light that passes off its centre',
    inventory: { lens: 1 },
    emitters: [{ id: 'moon', kind: 'moon', x: 130, y: 450, angle: 0, width: 26 }],
    targets: [planet('w', 'white', 780, 490)]
  },
  {
    id: 7, name: 'the orb', par: 1,
    inventory: { orb: 1 },
    emitters: [{ id: 'moon', kind: 'moon', x: 130, y: 450, angle: 0, width: 26 }],
    targets: [planet('r', 'red', 800, 662), planet('b', 'blue', 800, 696)]
  },
  {
    id: 8, name: 'gravity', par: 1,
    hint: 'light falls around a black hole',
    inventory: { mirror: 1 },
    emitters: [{ id: 'sun', kind: 'sun', x: 130, y: 150, angle: 0, width: 26 }],
    targets: [flag('t', 150, 700)],
    blackHoles: [{ id: 'bh', x: 450, y: 450, horizon: 16, influence: 260, mass: 40 }]
  },
  {
    id: 9, name: 'portals', par: 1,
    inventory: { mirror: 1 },
    emitters: [{ id: 'moon', kind: 'moon', x: 130, y: 450, angle: 0, width: 26 }],
    targets: [flag('t', 700, 760)],
    walls: [
      { x: 580, y: 580, w: 240, h: 20 }, { x: 580, y: 800, w: 240, h: 20 },
      { x: 580, y: 580, w: 20, h: 240 }, { x: 800, y: 580, w: 20, h: 240 }
    ],
    pieces: [fixed('pa', 'portal', 450, 300, 0, 'pb'), fixed('pb', 'portal', 700, 640, 0, 'pa')]
  },
  {
    id: 10, name: 'the river', par: 1,
    inventory: { mirror: 1 },
    emitters: [{ id: 'moon', kind: 'moon', x: 130, y: 200, angle: 35 * D, width: 26 }],
    hint: 'water bends the light that crosses it',
    targets: [flower('w', 'white', 250, 330)],
    rivers: [{ id: 'river', y0: 480, y1: 560 }]
  },
  {
    id: 11, name: 'eclipse', par: 1,
    hint: 'a planet swallows the light that hits it',
    inventory: { mirror: 1 },
    emitters: [
      { id: 'sun', kind: 'sun', x: 130, y: 450, angle: 0, width: 26 },
      { id: 'moon', kind: 'moon', x: 700, y: 130, angle: 90 * D, width: 26 }
    ],
    targets: [flower('r', 'red', 780, 450), flag('t', 450, 780)],
    planets: [{ id: 'earth', x: 450, y: 450, radius: 40 }],
    pieces: [fixed('df', 'dichroic', 700, 450, 45 * D)]
  },
  {
    id: 12, name: 'greenhouse', par: 2,
    inventory: { prism: 1, mirror: 1 },
    emitters: [
      { id: 'sun', kind: 'sun', x: 130, y: 250, angle: 0, width: 26 },
      { id: 'moon', kind: 'moon', x: 130, y: 650, angle: 0, width: 26 }
    ],
    targets: [
      flower('w', 'white', 780, 150),
      flower('r', 'red', 760, 420), flower('g', 'green', 760, 378), flower('b', 'blue', 760, 320)
    ]
  },
  {
    id: 13, name: 'orbit', par: 1,
    hint: 'gravity bends every colour by a different path',
    inventory: { prism: 1 },
    emitters: [{ id: 'moon', kind: 'moon', x: 130, y: 300, angle: 0, width: 26 }],
    targets: [planet('r', 'red', 800, 410), planet('g', 'green', 800, 600), planet('b', 'blue', 800, 690)],
    blackHoles: [{ id: 'bh', x: 720, y: 480, horizon: 16, influence: 260, mass: 40 }]
  },
  {
    id: 70, name: 'the assay', par: 6,
    hint: 'everything at once',
    inventory: { mirror: 2, prism: 1, lens: 1, dichroic: 1, orb: 1 },
    emitters: [
      { id: 'moon', kind: 'moon', x: 150, y: 150, angle: 45 * D, width: 26 },
      { id: 'sun', kind: 'sun', x: 110, y: 520, angle: 0, width: 26 }
    ],
    targets: [
      planet('pw', 'white', 470, 410), flower('fw', 'white', 530, 456),
      planet('pb', 'blue', 563, 820), flower('fb', 'blue', 600, 820), flower('fg', 'green', 636, 820), flower('fr', 'red', 666, 820),
      planet('pr', 'red', 720, 100), flag('flag', 778, 62),
      planet('pg', 'green', 760, 448)
    ],
    walls: [
      { x: 620, y: 40, w: 16, h: 170 }, { x: 804, y: 40, w: 16, h: 170 }, { x: 620, y: 194, w: 200, h: 16 },
      { x: 130, y: 372, w: 120, h: 20 }
    ],
    blackHoles: [{ id: 'bh', x: 480, y: 700, horizon: 16, influence: 200, mass: 24 }],
    rivers: [{ id: 'river', y0: 660, y1: 720 }],
    planets: [{ id: 'earth', x: 520, y: 520, radius: 34 }],
    pieces: [
      fixed('pa', 'portal', 250, 600, 0, 'pb'), fixed('pb', 'portal', 720, 150, 0, 'pa'),
      fixed('gf', 'filter', 700, 425, 90 * D)
    ]
  },
  {
    id: 999, name: 'free play', par: 0, sandbox: true,
    inventory: { mirror: 6, prism: 3, lens: 2, dichroic: 2, filter: 2, orb: 2, portal: 2 },
    emitters: [
      { id: 'moon', kind: 'moon', x: 160, y: 160, angle: 45 * D, width: 26 },
      { id: 'sun', kind: 'sun', x: 120, y: 620, angle: 0, width: 26 }
    ],
    targets: [
      planet('pr', 'red', 760, 200), planet('pg', 'green', 760, 300), planet('pb', 'blue', 760, 400),
      flower('fw', 'white', 760, 560), flower('fr', 'red', 760, 660), flag('flag', 760, 780)
    ],
    blackHoles: [{ id: 'bh', x: 480, y: 460, horizon: 14, influence: 200, mass: 30 }],
    rivers: [{ id: 'river', y0: 720, y1: 770 }],
    planets: [{ id: 'earth', x: 400, y: 200, radius: 34 }]
  }
];

export const PLAYABLE = LEVELS.filter((l) => !l.sandbox);
export const SANDBOX = LEVELS.find((l) => l.sandbox)!;
export const levelById = (id: number) => LEVELS.find((l) => l.id === id);
