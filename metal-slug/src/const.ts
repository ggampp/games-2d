export const VW = 480;
export const VH = 270;
export const GROUND = 228;
export const GRAV = 1400;
export const JUMP = -560;
export const LEVEL_W = 5600;
export const BOSS_AT = 4920;

export type WeaponId = "blaster" | "rapid" | "spread" | "heavy";
export type FoeKind = "grunt" | "shooter" | "grenadier" | "hopper" | "heli";
export type ItemId = "rapid" | "spread" | "heavy" | "nade" | "heal";
export type Mode = "title" | "play" | "pause" | "over" | "win";

export interface Box {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** Centers. hw/hh are half extents. */
export function overlap(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh;
}

export const WEAPON_LABEL: Record<WeaponId, string> = {
  blaster: "BLASTER",
  rapid: "RAJADA",
  spread: "LEQUE",
  heavy: "CANHÃO",
};
