export const STAGE = {
  width: 4400,
  height: 360,
  zMin: 8,
  zMax: 96,
  groundBase: 304,
};

export type PickupKind = "meat" | "pipe" | "clip";

export interface WaveSpec {
  id: string;
  triggerX: number;
  lockMin: number;
  lockMax: number;
  enemies: { type: string; x: number; z: number }[];
  pickup?: { kind: PickupKind; x: number; z: number };
}

export const WAVES: WaveSpec[] = [
  {
    id: "alley",
    triggerX: 420,
    lockMin: 280,
    lockMax: 760,
    enemies: [
      { type: "grunt", x: 620, z: 40 },
      { type: "grunt", x: 700, z: 70 },
      { type: "grunt", x: 660, z: 22 },
    ],
    pickup: { kind: "meat", x: 690, z: 50 },
  },
  {
    id: "overpass",
    triggerX: 980,
    lockMin: 860,
    lockMax: 1380,
    enemies: [
      { type: "grunt", x: 1180, z: 30 },
      { type: "raptor", x: 1280, z: 64 },
      { type: "grunt", x: 1220, z: 80 },
    ],
    pickup: { kind: "pipe", x: 1260, z: 48 },
  },
  {
    id: "yard",
    triggerX: 1600,
    lockMin: 1480,
    lockMax: 2040,
    enemies: [
      { type: "brute", x: 1860, z: 50 },
      { type: "grunt", x: 1760, z: 24 },
      { type: "grunt", x: 1920, z: 78 },
    ],
    pickup: { kind: "meat", x: 1880, z: 44 },
  },
  {
    id: "jungle",
    triggerX: 2280,
    lockMin: 2160,
    lockMax: 2720,
    enemies: [
      { type: "raptor", x: 2480, z: 28 },
      { type: "raptor", x: 2580, z: 72 },
      { type: "grunt", x: 2520, z: 50 },
    ],
    pickup: { kind: "clip", x: 2560, z: 40 },
  },
  {
    id: "gate",
    triggerX: 3000,
    lockMin: 2880,
    lockMax: 3480,
    enemies: [
      { type: "brute", x: 3260, z: 44 },
      { type: "raptor", x: 3380, z: 70 },
      { type: "grunt", x: 3180, z: 22 },
      { type: "grunt", x: 3340, z: 86 },
    ],
    pickup: { kind: "meat", x: 3320, z: 50 },
  },
  {
    id: "alpha",
    triggerX: 3720,
    lockMin: 3580,
    lockMax: 4320,
    enemies: [{ type: "ashjaw", x: 4040, z: 48 }],
  },
];
