import type { FoeKind, ItemId } from "./const";

export interface WaveGroup {
  kind: FoeKind;
  n: number;
}

export interface Wave {
  at: number;
  groups: WaveGroup[];
}

export interface CrateDef {
  x: number;
  item: ItemId;
}

export interface Plat {
  x: number;
  y: number;
  w: number;
}

export const WAVES: Wave[] = [
  { at: 700, groups: [{ kind: "grunt", n: 3 }] },
  { at: 1400, groups: [{ kind: "grunt", n: 2 }, { kind: "shooter", n: 2 }] },
  {
    at: 2050,
    groups: [
      { kind: "hopper", n: 2 },
      { kind: "grunt", n: 2 },
      { kind: "grenadier", n: 1 },
    ],
  },
  {
    at: 2750,
    groups: [
      { kind: "heli", n: 1 },
      { kind: "shooter", n: 2 },
      { kind: "grunt", n: 2 },
    ],
  },
  {
    at: 3450,
    groups: [
      { kind: "grenadier", n: 2 },
      { kind: "hopper", n: 2 },
      { kind: "shooter", n: 1 },
    ],
  },
  {
    at: 4200,
    groups: [
      { kind: "heli", n: 1 },
      { kind: "grunt", n: 3 },
      { kind: "shooter", n: 2 },
    ],
  },
];

export const PLACED: { x: number; kind: FoeKind }[] = [
  { x: 500, kind: "grunt" },
  { x: 560, kind: "grunt" },
  { x: 980, kind: "shooter" },
  { x: 1060, kind: "grunt" },
  { x: 1620, kind: "hopper" },
  { x: 1700, kind: "grunt" },
  { x: 2320, kind: "grenadier" },
  { x: 2400, kind: "grunt" },
  { x: 3120, kind: "shooter" },
  { x: 3200, kind: "shooter" },
  { x: 3920, kind: "hopper" },
  { x: 4000, kind: "grunt" },
  { x: 4580, kind: "grenadier" },
  { x: 4660, kind: "grunt" },
];

export const CRATES: CrateDef[] = [
  { x: 340, item: "rapid" },
  { x: 1280, item: "spread" },
  { x: 2140, item: "heal" },
  { x: 3000, item: "heavy" },
  { x: 3720, item: "nade" },
  { x: 4520, item: "heal" },
];

export const BARRELS: number[] = [260, 530, 1100, 1560, 1980, 2460, 3160, 3680, 4080, 4620];

export const PLATFORMS: Plat[] = [
  { x: 900, y: 172, w: 96 },
  { x: 1760, y: 164, w: 112 },
  { x: 2680, y: 170, w: 90 },
  { x: 3560, y: 160, w: 120 },
  { x: 4380, y: 168, w: 100 },
];

export const CHECKS = [90, 980, 1800, 2600, 3400, 4100, 4700];

export const FLAGS = [200, 760, 1500, 2240, 2920, 3600, 4440, 5080];
