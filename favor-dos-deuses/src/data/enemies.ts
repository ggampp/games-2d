export interface EnemyConfig {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  /** Cor base (usada nos sprites gerados e no flash de dano) */
  color: number;
  /** Raio do corpo físico */
  bodyRadius: number;
  dropDevotion: { godId: string; amount: number } | null;
  behavior: "chase" | "patrol" | "stationary";
  /** Distância em que o inimigo percebe o herói */
  aggroRange: number;
  /** Distância em que inicia o golpe */
  attackRange: number;
  /** Tempo de "aviso" antes do golpe (ms) — dá chance de esquivar */
  windup: number;
  attackCooldown: number;
  /** Textura: gerada por código ("gen:*") ou sheet do pack */
  sprite: { key: string; anim?: string; scale?: number; tint?: number };
}

export const ENEMIES: Record<string, EnemyConfig> = {
  boar: {
    id: "boar",
    name: "Javali Selvagem",
    hp: 30,
    damage: 10,
    speed: 70,
    color: 0x8b4513,
    bodyRadius: 9,
    dropDevotion: { godId: "nylea", amount: 5 },
    behavior: "chase",
    aggroRange: 170,
    attackRange: 26,
    windup: 420,
    attackCooldown: 1200,
    sprite: { key: "gen_boar", anim: "boar_walk" },
  },
  wolf: {
    id: "wolf",
    name: "Lobo Cinzento",
    hp: 25,
    damage: 14,
    speed: 95,
    color: 0x7f8c8d,
    bodyRadius: 8,
    dropDevotion: { godId: "nylea", amount: 8 },
    behavior: "chase",
    aggroRange: 220,
    attackRange: 26,
    windup: 320,
    attackCooldown: 1000,
    sprite: { key: "gen_wolf", anim: "wolf_walk" },
  },
  shade: {
    id: "shade",
    name: "Sombra Errante",
    hp: 20,
    damage: 8,
    speed: 45,
    color: 0x4a3f6a,
    bodyRadius: 8,
    dropDevotion: null,
    behavior: "patrol",
    aggroRange: 130,
    attackRange: 22,
    windup: 500,
    attackCooldown: 1500,
    sprite: { key: "ghost", anim: "shade_float", tint: 0xb39ddb },
  },
  skeleton: {
    id: "skeleton",
    name: "Esqueleto Antigo",
    hp: 40,
    damage: 12,
    speed: 55,
    color: 0xd4c4a8,
    bodyRadius: 8,
    dropDevotion: { godId: "heliod", amount: 6 },
    behavior: "patrol",
    aggroRange: 150,
    attackRange: 28,
    windup: 450,
    attackCooldown: 1300,
    sprite: { key: "gen_skeleton", anim: "skeleton_walk" },
  },
  harpy: {
    id: "harpy",
    name: "Harpia",
    hp: 35,
    damage: 18,
    speed: 85,
    color: 0x9b59b6,
    bodyRadius: 9,
    dropDevotion: { godId: "heliod", amount: 10 },
    behavior: "chase",
    aggroRange: 240,
    attackRange: 30,
    windup: 380,
    attackCooldown: 1400,
    sprite: { key: "gen_harpy", anim: "harpy_fly" },
  },
  /** Sombra de Erebos: segue o herói após a barganha */
  erebos_shade: {
    id: "erebos_shade",
    name: "Sombra de Erebos",
    hp: 45,
    damage: 10,
    speed: 60,
    color: 0x2c1a3c,
    bodyRadius: 8,
    dropDevotion: null,
    behavior: "chase",
    aggroRange: 9999,
    attackRange: 22,
    windup: 550,
    attackCooldown: 1600,
    sprite: { key: "ghost", anim: "shade_float", tint: 0x7e57c2 },
  },
};

export const ENEMY_SPAWNS: Record<string, string[]> = {
  wilds: ["boar", "wolf", "boar", "shade", "wolf", "boar"],
  dungeon: ["skeleton", "shade", "skeleton", "harpy", "skeleton", "harpy", "shade"],
};
