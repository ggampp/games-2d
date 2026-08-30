export type CatTier = {
  id: number;
  name: string;
  damage: number;
  fireRate: number;
  range: number;
  placeCost: number;
  upgradeCost: number;
  anim: string;
};

export const CAT_TIERS: CatTier[] = [
  { id: 1, name: "Nível 1", damage: 8, fireRate: 900, range: 720, placeCost: 50, upgradeCost: 70, anim: "c1" },
  { id: 2, name: "Nível 2", damage: 14, fireRate: 750, range: 780, placeCost: 0, upgradeCost: 110, anim: "c2" },
  { id: 3, name: "Nível 3", damage: 22, fireRate: 620, range: 860, placeCost: 0, upgradeCost: 0, anim: "c3" },
];

export const MAX_SLICE_TIER = 3;
export const REPAIR_COST = 40;
export const REPAIR_HP = 4;

export function getTier(id: number): CatTier {
  const tier = CAT_TIERS.find((c) => c.id === id);
  if (!tier) throw new Error(`Unknown cat tier ${id}`);
  return tier;
}
