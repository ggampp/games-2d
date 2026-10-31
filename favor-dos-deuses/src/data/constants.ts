export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TILE_SIZE = 16;

export const PLAYER_CONFIG = {
  maxHp: 100,
  speed: 130,
  attackDamage: 15,
  /** Alcance do golpe a partir do centro do herói */
  attackRange: 34,
  /** Meio-ângulo do arco do golpe (graus) */
  attackArc: 70,
  attackCooldown: 380,
  /** Janela de buffer: apertar atacar um pouco antes do cooldown acabar ainda vale */
  inputBuffer: 150,
  dodgeCooldown: 700,
  dodgeSpeed: 330,
  dodgeDuration: 220,
  invincibilityDuration: 500,
  knockback: 180,
  /** Raio do corpo físico */
  bodyRadius: 8,
};

/** Profundidades de render (y-sorting acontece entre GROUND e OVERLAY) */
export const DEPTH = {
  ground: 0,
  groundDecor: 1,
  shadow: 2,
  /** objetos e personagens são ordenados por y a partir daqui */
  ySortBase: 10,
  overlay: 5000,
  ui: 9000,
};

export const COLORS = {
  grass: 0x649b51,
  dirt: 0x967e5d,
  cobble: 0xad8b70,
  dungeonVoid: 0x181619,
  dungeonFloor: 0x665e55,
  underworld: 0x120a18,
  nylea: 0x2ecc71,
  heliod: 0xf1c40f,
  erebos: 0x9b59b6,
};

export const SAVE_KEY = "favor-dos-deuses.save.v1";

export const UI_STRINGS = {
  title: "Favor dos Deuses",
  subtitle: "Um action-RPG nas terras de Theros",
  play: "Nova Jornada",
  continue: "Continuar",
  controls: "WASD / Setas: mover   •   Espaço ou J: atacar   •   Shift ou K: esquivar   •   E: interagir   •   1-4: bênçãos   •   Esc: pausar",
  hub_name: "Setessa",
  wilds_name: "Floresta Selvagem",
  dungeon_name: "Ruínas Antigas",
  underworld_name: "Mundo Inferior",
  death_title: "Você Caiu...",
  death_text: "Sua alma despenca para o Mundo Inferior. Erebos observa com interesse.",
  escape: "Escapar (-20 Devoção)",
  bargain: "Barganhar com Erebos",
  bargain_result: "Erebos aceita. Você volta com vida plena, mas uma sombra agora te segue...",
  offering_prompt: "Fazer oferenda?",
  bestow_unlocked: "Nova Bênção Desbloqueada!",
  jealousy_warning: "Você sente a ira divina crescendo...",
  paused: "Pausado",
};
