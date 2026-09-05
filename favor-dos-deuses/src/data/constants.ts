export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TILE_SIZE = 16;

export const PLAYER_CONFIG = {
  maxHp: 100,
  speed: 120,
  attackDamage: 15,
  attackRange: 24,
  attackCooldown: 400,
  dodgeCooldown: 800,
  dodgeSpeed: 300,
  dodgeDuration: 200,
  invincibilityDuration: 300,
};

export const COLORS = {
  grass: 0x3a5f0b,
  grassLight: 0x4a7c12,
  dirt: 0x8b6914,
  stone: 0x696969,
  stoneDark: 0x3d3d3d,
  water: 0x2980b9,
  tree: 0x1e4d2b,
  wall: 0x4a4a4a,
  hub: 0x8b7355,
  temple: 0xffd700,
  portal: 0x9b59b6,
  underworld: 0x1a0a1a,
  underworldGround: 0x2d1b2d,
};

export const UI_STRINGS = {
  title: "Favor dos Deuses",
  play: "JOGAR",
  controls: "WASD/Setas: Mover | Espaço: Atacar | Shift: Esquivar | E: Interagir | 1-4: Bestow",
  hub_name: "Setessa",
  wilds_name: "Floresta Selvagem",
  dungeon_name: "Ruínas Antigas",
  underworld_name: "Mundo Inferior",
  death_title: "Você Caiu...",
  death_text: "Sua alma despenca para o Mundo Inferior. Erebos observa com interesse.",
  escape: "Escapar (perder 20 Devoção)",
  bargain: "Barganhar com Erebos",
  bargain_result: "Erebos aceita. Você volta, mas uma sombra agora te segue...",
  offering_prompt: "Fazer oferenda?",
  offering_nylea: "Oferenda a Nylea (+15 Devoção)",
  offering_heliod: "Oferenda a Heliod (+15 Devoção)",
  bestow_unlocked: "Nova Bênção Desbloqueada!",
  jealousy_warning: "Você sente a ira divina crescendo...",
};
