import type { FighterKind } from '../entities/Fighter';

export const PATH_BOUNDS = {
  minX: 0,
  maxX: 56,
  minY: -3.55,
  maxY: -1.55,
} as const;

export type WaveDefinition = {
  label: string;
  spawns: { kind: Exclude<FighterKind, 'hero'>; x: number; y: number }[];
};

export const WAVES: WaveDefinition[] = [
  { label: 'Bandits on the road', spawns: [{ kind: 'bandit', x: 14, y: -2.4 }, { kind: 'bandit', x: 16.5, y: -2.9 }] },
  { label: 'Bone patrol', spawns: [{ kind: 'skeleton', x: 24, y: -2.2 }, { kind: 'skeleton', x: 26.5, y: -3.1 }, { kind: 'bandit', x: 27.5, y: -2.6 }] },
  { label: 'Gate guardians', spawns: [{ kind: 'bandit', x: 36, y: -3.0 }, { kind: 'skeleton', x: 37.5, y: -2.1 }, { kind: 'skeleton', x: 39, y: -2.7 }] },
  { label: 'Sir Malice', spawns: [{ kind: 'boss', x: 48, y: -2.5 }] },
];

export const HERO_MAX_HP = 120;

export function isInMeleeRange(
  attackerX: number,
  attackerY: number,
  facing: number,
  targetX: number,
  targetY: number,
  targetRadius: number,
  range: number,
): boolean {
  const dx = targetX - attackerX;
  const dy = targetY - attackerY;
  const facingOk = dx * facing >= -0.35 || Math.abs(dx) < 0.45;
  return facingOk && Math.hypot(dx, dy * 1.45) <= range + targetRadius * 0.4;
}

export function depthPresentation(y: number): { renderOrder: number; z: number } {
  return {
    renderOrder: Math.round((-y + 5) * 20),
    z: (PATH_BOUNDS.maxY - y) * 0.02,
  };
}
