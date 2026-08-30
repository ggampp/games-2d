import type { EnemyKind } from "./enemies.ts";

export type WaveSpawn = {
  kind: EnemyKind;
  delay: number;
  lane: number;
};

export type WaveDef = {
  id: number;
  name: string;
  spawns: WaveSpawn[];
};

function stagger(kind: EnemyKind, count: number, interval: number, lanes: number, start = 0): WaveSpawn[] {
  return Array.from({ length: count }, (_, i) => ({
    kind,
    delay: start + i * interval,
    lane: i % lanes,
  }));
}

export const WAVES: WaveDef[] = [
  { id: 1, name: "Onda 1", spawns: stagger("reg1", 6, 1100, 1) },
  {
    id: 2,
    name: "Onda 2",
    spawns: [...stagger("reg1", 5, 900, 2), ...stagger("reg2", 3, 1200, 2, 800)],
  },
  {
    id: 3,
    name: "Onda 3",
    spawns: [...stagger("reg2", 4, 1000, 2), { kind: "boss1", delay: 4500, lane: 0 }],
  },
];

export const START_COINS = 80;
export const BASE_HP = 10;
export const SLOT_COUNT = 8;
