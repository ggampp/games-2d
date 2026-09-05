export interface EnemyConfig {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  color: number;
  size: number;
  dropDevotion: { godId: string; amount: number } | null;
  behavior: "chase" | "patrol" | "stationary";
}

export const ENEMIES: Record<string, EnemyConfig> = {
  boar: {
    id: "boar",
    name: "Javali Selvagem",
    hp: 30,
    damage: 10,
    speed: 60,
    color: 0x8b4513,
    size: 14,
    dropDevotion: { godId: "nylea", amount: 5 },
    behavior: "chase",
  },
  wolf: {
    id: "wolf",
    name: "Lobo Cinzento",
    hp: 25,
    damage: 15,
    speed: 80,
    color: 0x696969,
    size: 12,
    dropDevotion: { godId: "nylea", amount: 8 },
    behavior: "chase",
  },
  shade: {
    id: "shade",
    name: "Sombra Errante",
    hp: 20,
    damage: 8,
    speed: 40,
    color: 0x2c2c54,
    size: 10,
    dropDevotion: null,
    behavior: "patrol",
  },
  skeleton: {
    id: "skeleton",
    name: "Esqueleto Antigo",
    hp: 40,
    damage: 12,
    speed: 50,
    color: 0xd4c4a8,
    size: 14,
    dropDevotion: { godId: "heliod", amount: 6 },
    behavior: "patrol",
  },
  harpy: {
    id: "harpy",
    name: "Harpia",
    hp: 35,
    damage: 18,
    speed: 70,
    color: 0x9b59b6,
    size: 12,
    dropDevotion: { godId: "heliod", amount: 10 },
    behavior: "chase",
  },
};

export const ENEMY_SPAWNS: Record<string, string[]> = {
  wilds: ["boar", "wolf", "shade"],
  dungeon: ["skeleton", "shade", "harpy"],
};
