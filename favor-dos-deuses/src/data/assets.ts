/**
 * Catálogo de assets CraftPix.
 *
 * Os packs não são grades uniformes: cada sheet foi medido pixel a pixel
 * (ver README "Assets") e os frames abaixo usam as coordenadas reais.
 * Se um arquivo não existir (licença proíbe redistribuição), o jogo cai
 * em gráficos gerados por código sem quebrar.
 */

export interface AssetDefinition {
  key: string;
  path: string;
  type: "image" | "spritesheet";
  frameWidth?: number;
  frameHeight?: number;
}

export interface SubFrame {
  /** Textura de origem (já carregada) */
  texture: string;
  /** Nome do frame customizado a criar */
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const F = "/assets/forest";
const D = "/assets/dungeon";
const T = "/assets/tavern";

export const FOREST_ASSETS: AssetDefinition[] = [
  // 19 colunas x 23 linhas de 16px
  { key: "forest_ground", path: `${F}/Ground_grass.png`, type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "tree1", path: `${F}/objects/Tree1.png`, type: "image" },
  { key: "tree2", path: `${F}/objects/Tree2.png`, type: "image" },
  { key: "tree3", path: `${F}/objects/Tree3.png`, type: "image" },
  { key: "tree5", path: `${F}/objects/Tree5.png`, type: "image" },
  { key: "tree6", path: `${F}/objects/Tree6.png`, type: "image" },
  { key: "tree7", path: `${F}/objects/Tree7.png`, type: "image" },
  { key: "tree8", path: `${F}/objects/Tree8.png`, type: "image" },
  { key: "tree9", path: `${F}/objects/Tree9.png`, type: "image" },
  { key: "tree12", path: `${F}/objects/Tree12.png`, type: "image" },
  { key: "tree13", path: `${F}/objects/Tree13.png`, type: "image" },
  { key: "bush1", path: `${F}/objects/Bush1.png`, type: "image" },
  { key: "bush2", path: `${F}/objects/Bush2.png`, type: "image" },
  { key: "bush3", path: `${F}/objects/Bush3.png`, type: "image" },
  { key: "bush11", path: `${F}/objects/Bush11.png`, type: "image" },
  { key: "bush12", path: `${F}/objects/Bush12.png`, type: "image" },
  { key: "stone1", path: `${F}/objects/Light_stone_grass1.png`, type: "image" },
  { key: "stone2", path: `${F}/objects/Brown_stone_ground1.png`, type: "image" },
  { key: "stone3", path: `${F}/objects/Beige_stone_grass4.png`, type: "image" },
  { key: "stone4", path: `${F}/objects/Beige_stone_grass1.png`, type: "image" },
  { key: "stone5", path: `${F}/objects/Light_stone_grass4.png`, type: "image" },
  { key: "mushroom1", path: `${F}/objects/Red_mushroom1.png`, type: "image" },
  { key: "mushroom2", path: `${F}/objects/Brown_mushroom1.png`, type: "image" },
  { key: "mushroom3", path: `${F}/objects/Red_mushroom2.png`, type: "image" },
  { key: "broken_tree1", path: `${F}/objects/Broken_tree1.png`, type: "image" },
  { key: "broken_tree2", path: `${F}/objects/Broken_tree2.png`, type: "image" },
  { key: "broken_tree4", path: `${F}/objects/Broken_tree4.png`, type: "image" },
  { key: "reeds1", path: `${F}/objects/reeds1.png`, type: "image" },
  { key: "ruin_grass1", path: `${F}/objects/Ruin_grass1.png`, type: "image" },
  { key: "ruin_grass3", path: `${F}/objects/Ruin_grass3.png`, type: "image" },
  { key: "ruin_grass4", path: `${F}/objects/Ruin_grass4.png`, type: "image" },
  { key: "ruin_grass5", path: `${F}/objects/Ruin_grass5.png`, type: "image" },
  { key: "ruin_orange3", path: `${F}/objects/Ruin_orange3.png`, type: "image" },
];

export const DUNGEON_ASSETS: AssetDefinition[] = [
  // 14 colunas x 22 linhas de 16px
  { key: "dungeon_tiles", path: `${D}/walls_floor.png`, type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "dungeon_torches", path: `${D}/torches.png`, type: "image" },
  { key: "dungeon_objects", path: `${D}/other_objects.png`, type: "image" },
  { key: "dungeon_arches", path: `${D}/Arches_columns.png`, type: "image" },
  { key: "dungeon_coffins", path: `${D}/coffins.png`, type: "image" },
  { key: "dungeon_chest", path: `${D}/chest_lever.png`, type: "image" },
  { key: "dungeon_skull", path: `${D}/scull_bas-relief.png`, type: "image" },
  { key: "statue_fire", path: `${D}/Statue_fire.png`, type: "spritesheet", frameWidth: 80, frameHeight: 80 },
  { key: "ghost", path: `${D}/ghost_trap.png`, type: "spritesheet", frameWidth: 64, frameHeight: 64 },
  { key: "spikes", path: `${D}/Spikes.png`, type: "spritesheet", frameWidth: 48, frameHeight: 64 },
];

export const TAVERN_ASSETS: AssetDefinition[] = [
  // 21 colunas x 18 linhas de 16px
  { key: "street_tiles", path: `${T}/Walls_street.png`, type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "tavern_exterior", path: `${T}/Exterior.png`, type: "image" },
  { key: "npc_host", path: `${T}/Animation_host.png`, type: "spritesheet", frameWidth: 32, frameHeight: 32 },
  { key: "npc_lute", path: `${T}/Animation_Lute_player_full.png`, type: "spritesheet", frameWidth: 32, frameHeight: 48 },
  { key: "npc_watcher", path: `${T}/Animation_watcher.png`, type: "spritesheet", frameWidth: 32, frameHeight: 48 },
  { key: "hero", path: `${T}/Animation_knight.png`, type: "spritesheet", frameWidth: 40, frameHeight: 40 },
];

export const ALL_CRAFTPIX_ASSETS = [...FOREST_ASSETS, ...DUNGEON_ASSETS, ...TAVERN_ASSETS];

/** Recortes nomeados dentro dos sheets irregulares (medidos em pixels). */
export const SUB_FRAMES: SubFrame[] = [
  // --- Exterior.png (vila) ---
  { texture: "tavern_exterior", name: "tavern_big", x: 16, y: 16, w: 184, h: 152 },
  { texture: "tavern_exterior", name: "house_right", x: 300, y: 14, w: 140, h: 96 },
  { texture: "tavern_exterior", name: "house_small_a", x: 48, y: 340, w: 64, h: 52 },
  { texture: "tavern_exterior", name: "house_small_b", x: 128, y: 340, w: 64, h: 52 },
  { texture: "tavern_exterior", name: "fence_h", x: 192, y: 320, w: 64, h: 16 },
  { texture: "tavern_exterior", name: "fence_h2", x: 256, y: 352, w: 64, h: 16 },
  { texture: "tavern_exterior", name: "planks_h", x: 256, y: 320, w: 64, h: 16 },
  { texture: "tavern_exterior", name: "crate", x: 320, y: 320, w: 32, h: 32 },
  { texture: "tavern_exterior", name: "barrel", x: 320, y: 384, w: 32, h: 32 },
  { texture: "tavern_exterior", name: "sign_tavern", x: 368, y: 336, w: 80, h: 32 },
  { texture: "tavern_exterior", name: "stall", x: 10, y: 336, w: 38, h: 64 },
  { texture: "tavern_exterior", name: "table_round", x: 192, y: 64, w: 48, h: 48 },
  { texture: "tavern_exterior", name: "table_food", x: 48, y: 400, w: 64, h: 48 },

  // --- Arches_columns.png (ruínas): 6 arcos de 32x48 na primeira linha ---
  { texture: "dungeon_arches", name: "arch_dark", x: 0, y: 0, w: 32, h: 48 },
  { texture: "dungeon_arches", name: "arch_bars", x: 32, y: 0, w: 32, h: 48 },
  { texture: "dungeon_arches", name: "arch_wood", x: 64, y: 0, w: 32, h: 48 },
  { texture: "dungeon_arches", name: "arch_hollow", x: 96, y: 0, w: 32, h: 48 },
  { texture: "dungeon_arches", name: "alcove_altar", x: 128, y: 64, w: 56, h: 48 },
  { texture: "dungeon_arches", name: "pillar", x: 68, y: 84, w: 26, h: 44 },

  // --- other_objects.png ---
  { texture: "dungeon_objects", name: "statue_a", x: 6, y: 0, w: 21, h: 40 },
  { texture: "dungeon_objects", name: "statue_b", x: 32, y: 0, w: 17, h: 40 },
  { texture: "dungeon_objects", name: "gold_pile", x: 112, y: 52, w: 32, h: 32 },
  { texture: "dungeon_objects", name: "bones_a", x: 62, y: 168, w: 36, h: 26 },
  { texture: "dungeon_objects", name: "bones_b", x: 0, y: 208, w: 32, h: 32 },
  { texture: "dungeon_objects", name: "skull_small", x: 8, y: 328, w: 14, h: 14 },
  { texture: "dungeon_objects", name: "crystal", x: 8, y: 296, w: 16, h: 18 },

  // --- coffins.png ---
  { texture: "dungeon_coffins", name: "coffin_stone", x: 96, y: 0, w: 32, h: 64 },
  { texture: "dungeon_coffins", name: "sarcophagus", x: 14, y: 66, w: 50, h: 46 },
  { texture: "dungeon_coffins", name: "coffin_open", x: 80, y: 66, w: 48, h: 46 },
  { texture: "dungeon_coffins", name: "coffin_lid", x: 140, y: 66, w: 20, h: 44 },
  { texture: "dungeon_coffins", name: "coffin_skeleton", x: 204, y: 66, w: 20, h: 44 },
  { texture: "dungeon_coffins", name: "coffin_wood", x: 96, y: 112, w: 32, h: 48 },

  // --- chest_lever.png: 6 baús de 21px em x=6,38,70,102,134,166 ---
  { texture: "dungeon_chest", name: "chest_closed", x: 4, y: 8, w: 24, h: 26 },
  { texture: "dungeon_chest", name: "chest_open", x: 100, y: 8, w: 24, h: 26 },

  // --- scull_bas-relief.png (2 colunas de 17px, 6 linhas de 20px) ---
  { texture: "dungeon_skull", name: "skull_relief", x: 0, y: 4, w: 17, h: 20 },
];

/**
 * torches.png: 5 variantes em colunas de largura irregular, 6 frames em
 * linhas de 48px. Frame name: torch{variant}_{frame}
 */
export const TORCH_VARIANTS = [
  { x: 8, w: 48 },
  { x: 64, w: 32 },
  { x: 104, w: 32 },
  { x: 144, w: 32 },
  { x: 184, w: 32 },
];
export const TORCH_FRAME_H = 48;
export const TORCH_FRAMES = 6;

/** Índices úteis de tiles (row * cols + col). */
export const TILES = {
  forest: {
    cols: 19,
    grass: 20, // (1,1) miolo do tufo verde
    grass2: 134, // (1,7)
    grass3: 267, // (1,14)
    dirt: 77, // (1,4) miolo da mancha de terra
    // mancha de terra sobre grama: bordas (3x3 em (0..2, 3..5))
    dirtTL: 57, dirtT: 58, dirtTR: 59,
    dirtL: 76, dirtC: 77, dirtR: 78,
    dirtBL: 95, dirtB: 96, dirtBR: 97,
    // tufo verde 3x3 em (0..2, 0..2)
    tuftTL: 0, tuftT: 1, tuftTR: 2,
    tuftL: 19, tuftC: 20, tuftR: 21,
    tuftBL: 38, tuftB: 39, tuftBR: 40,
    // pedrinhas/terra escura decorativa
    rocks: [324, 325, 305],
  },
  dungeon: {
    cols: 14,
    floor: 85, // (1,6)
    floorVariants: [85, 85, 85, 85, 71, 99, 84, 86],
    // parede norte espessa: topo (ledge), face, base
    wallTopEdge: 29,
    wallFace: 43,
    wallBase: 57,
    // parede frontal vista por baixo do piso (sul)
    wallFront: 113,
    // colunas finas (paredes verticais top-down)
    thinTop: 127,
    thinMid: 141,
    thinBottom: 155,
    // parede horizontal fina (2 tiles de altura)
    hwallTop: 171,
    hwallBottom: 185,
    // laje cinza 3x3 em (5..7, 18..20)
    slab: [[257, 258, 259], [271, 272, 273], [285, 286, 287]],
    slabSmall: [[252, 253], [266, 267]],
    cracks: [261, 262, 263, 275, 276, 277, 289, 290],
  },
  street: {
    cols: 21,
    // paralelepípedo: 12 colunas x 6 linhas em (0..11, 12..17)
    cobbleRows: [12, 13, 14, 15, 16, 17],
    cobbleCols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    // pedra clara (praça dos templos) 4x3 em (14..20, 8..10)
    pale: 204, // (15,9)
    paleVariants: [204, 205, 206, 183, 184, 185],
    // folhas decorativas (13..20, 11..14)
    leaves: [244, 245, 246, 247, 265, 266, 267, 268, 286, 287, 288, 289],
    // canteiro com grama 3x3 em (3..5, 8..10)
    bed: [[171, 172, 173], [192, 193, 194], [213, 214, 215]],
    // torre de pedra (0..2, 0..5) = 48x96, muro (17..20,0..5)
  },
};

class AssetTracker {
  private loaded = new Set<string>();
  private failed = new Set<string>();

  markLoaded(key: string): void {
    this.loaded.add(key);
    this.failed.delete(key);
  }

  markFailed(key: string): void {
    this.failed.add(key);
    this.loaded.delete(key);
  }

  isLoaded(key: string): boolean {
    return this.loaded.has(key);
  }

  has(...keys: string[]): boolean {
    return keys.every((k) => this.loaded.has(k));
  }

  hasForestAssets(): boolean {
    return this.isLoaded("forest_ground");
  }

  hasDungeonAssets(): boolean {
    return this.isLoaded("dungeon_tiles");
  }

  hasTavernAssets(): boolean {
    return this.isLoaded("street_tiles") && this.isLoaded("tavern_exterior");
  }

  hasHero(): boolean {
    return this.isLoaded("hero");
  }

  getLoadedCount(): number {
    return this.loaded.size;
  }

  getFailed(): string[] {
    return [...this.failed];
  }
}

export const assetTracker = new AssetTracker();
