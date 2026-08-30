import { getTier } from "../data/cats.ts";
import { remainingDistance, type Point } from "./path.ts";

export type CombatCat = {
  slotId: number;
  tier: number;
  x: number;
  y: number;
  cooldown: number;
};

export type CombatEnemy = {
  id: number;
  kind: string;
  hp: number;
  maxHp: number;
  t: number;
  x: number;
  y: number;
  points: Point[];
  alive: boolean;
};

export function pickTarget(cat: CombatCat, enemies: CombatEnemy[]): CombatEnemy | null {
  const range = getTier(cat.tier).range;
  let best: CombatEnemy | null = null;
  let bestRemain = Infinity;
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.hp <= 0) continue;
    const dist = Math.hypot(enemy.x - cat.x, enemy.y - cat.y);
    if (dist > range) continue;
    const remain = remainingDistance(enemy.points, enemy.t);
    if (remain < bestRemain) {
      bestRemain = remain;
      best = enemy;
    }
  }
  return best;
}

export function applyDamage(enemy: CombatEnemy, amount: number): boolean {
  enemy.hp = Math.max(0, enemy.hp - amount);
  if (enemy.hp === 0) {
    enemy.alive = false;
    return true;
  }
  return false;
}
