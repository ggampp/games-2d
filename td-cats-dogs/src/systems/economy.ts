import { getTier, MAX_SLICE_TIER, REPAIR_COST, REPAIR_HP } from "../data/cats.ts";
import { BASE_HP } from "../data/waves.ts";

export type SlotState = {
  id: number;
  occupied: boolean;
};

export type EconomyState = {
  coins: number;
  catLevel: number;
  wallHp: number;
  slots: SlotState[];
};

export function canPlace(state: EconomyState, slot: SlotState): boolean {
  return !slot.occupied && state.coins >= getTier(1).placeCost;
}

export function placeCat(state: EconomyState, slot: SlotState): boolean {
  if (!canPlace(state, slot)) return false;
  state.coins -= getTier(1).placeCost;
  slot.occupied = true;
  return true;
}

export function canUpgrade(state: EconomyState): boolean {
  if (state.catLevel < 1 || state.catLevel >= MAX_SLICE_TIER) return false;
  if (!state.slots.some((s) => s.occupied)) return false;
  return state.coins >= getTier(state.catLevel).upgradeCost;
}

export function upgradeCats(state: EconomyState): boolean {
  if (!canUpgrade(state)) return false;
  state.coins -= getTier(state.catLevel).upgradeCost;
  state.catLevel += 1;
  return true;
}

export function canRepair(state: EconomyState): boolean {
  return state.wallHp < BASE_HP && state.coins >= REPAIR_COST;
}

export function repairWall(state: EconomyState): boolean {
  if (!canRepair(state)) return false;
  state.coins -= REPAIR_COST;
  state.wallHp = Math.min(BASE_HP, state.wallHp + REPAIR_HP);
  return true;
}

export function addCoins(state: EconomyState, amount: number): void {
  state.coins += amount;
}

export function placeCost(): number {
  return getTier(1).placeCost;
}

export function upgradeCost(state: EconomyState): number {
  if (state.catLevel >= MAX_SLICE_TIER) return 0;
  return getTier(state.catLevel).upgradeCost;
}
