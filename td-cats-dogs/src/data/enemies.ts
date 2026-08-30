export type EnemyKind = "reg1" | "reg2" | "boss1";

export type EnemyDef = {
  id: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  reward: number;
  leakDamage: number;
  scale: number;
  walkAnim: string;
};

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  reg1: { id: "reg1", name: "Zumbi", hp: 28, speed: 52, reward: 12, leakDamage: 1, scale: 0.42, walkAnim: "enemy-reg-1-walk" },
  reg2: { id: "reg2", name: "Zumbi 2", hp: 44, speed: 46, reward: 18, leakDamage: 1, scale: 0.44, walkAnim: "enemy-reg-2-walk" },
  boss1: { id: "boss1", name: "Chefe", hp: 220, speed: 30, reward: 60, leakDamage: 3, scale: 0.58, walkAnim: "enemy-boss-1-walk" },
};
