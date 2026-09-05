export interface AssetDefinition {
  key: string;
  path: string;
  type: "image" | "spritesheet";
  frameWidth?: number;
  frameHeight?: number;
}

export const FOREST_ASSETS: AssetDefinition[] = [
  { key: "forest_ground", path: "/assets/forest/Ground_grass.png", type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "forest_objects", path: "/assets/forest/Objects.png", type: "image" },
  { key: "forest_water", path: "/assets/forest/Water_coasts.png", type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "tree1", path: "/assets/forest/objects/Tree1.png", type: "image" },
  { key: "tree2", path: "/assets/forest/objects/Tree2.png", type: "image" },
  { key: "tree3", path: "/assets/forest/objects/Tree3.png", type: "image" },
  { key: "tree4", path: "/assets/forest/objects/Tree4.png", type: "image" },
  { key: "tree5", path: "/assets/forest/objects/Tree5.png", type: "image" },
  { key: "bush1", path: "/assets/forest/objects/Bush1.png", type: "image" },
  { key: "bush2", path: "/assets/forest/objects/Bush2.png", type: "image" },
  { key: "bush3", path: "/assets/forest/objects/Bush3.png", type: "image" },
  { key: "stone1", path: "/assets/forest/objects/Stone1.png", type: "image" },
  { key: "stone2", path: "/assets/forest/objects/Stone2.png", type: "image" },
  { key: "mushroom1", path: "/assets/forest/objects/Mushroom1.png", type: "image" },
  { key: "mushroom2", path: "/assets/forest/objects/Mushroom2.png", type: "image" },
];

export const DUNGEON_ASSETS: AssetDefinition[] = [
  { key: "dungeon_floor", path: "/assets/dungeon/walls_floor.png", type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "dungeon_doors", path: "/assets/dungeon/doors.png", type: "image" },
  { key: "dungeon_stairs", path: "/assets/dungeon/stairs.png", type: "image" },
  { key: "dungeon_coffins", path: "/assets/dungeon/coffins.png", type: "image" },
  { key: "dungeon_torches", path: "/assets/dungeon/torches.png", type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "dungeon_objects", path: "/assets/dungeon/other_objects.png", type: "image" },
  { key: "dungeon_spikes", path: "/assets/dungeon/Spikes.png", type: "image" },
];

export const TAVERN_ASSETS: AssetDefinition[] = [
  { key: "tavern_exterior", path: "/assets/tavern/Exterior.png", type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "tavern_interior1", path: "/assets/tavern/Interior_1st_floor.png", type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "tavern_walls_street", path: "/assets/tavern/Walls_street.png", type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "tavern_walls_interior", path: "/assets/tavern/Walls_interior.png", type: "spritesheet", frameWidth: 16, frameHeight: 16 },
  { key: "tavern_door", path: "/assets/tavern/door_small.png", type: "image" },
  { key: "tavern_cracks", path: "/assets/tavern/Decorative_cracks.png", type: "image" },
];

export const ALL_CRAFTPIX_ASSETS = [...FOREST_ASSETS, ...DUNGEON_ASSETS, ...TAVERN_ASSETS];

class AssetTracker {
  private loadedAssets: Set<string> = new Set();
  private failedAssets: Set<string> = new Set();

  markLoaded(key: string): void {
    this.loadedAssets.add(key);
    this.failedAssets.delete(key);
  }

  markFailed(key: string): void {
    this.failedAssets.add(key);
    this.loadedAssets.delete(key);
  }

  isLoaded(key: string): boolean {
    return this.loadedAssets.has(key);
  }

  hasForestAssets(): boolean {
    return this.isLoaded("forest_ground") || this.isLoaded("tree1");
  }

  hasDungeonAssets(): boolean {
    return this.isLoaded("dungeon_floor");
  }

  hasTavernAssets(): boolean {
    return this.isLoaded("tavern_exterior") || this.isLoaded("tavern_walls_street");
  }

  getLoadedCount(): number {
    return this.loadedAssets.size;
  }

  reset(): void {
    this.loadedAssets.clear();
    this.failedAssets.clear();
  }
}

export const assetTracker = new AssetTracker();
