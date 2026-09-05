import Phaser from "phaser";
import { ALL_CRAFTPIX_ASSETS, assetTracker, type AssetDefinition } from "../../data/assets";

export class PreloadScene extends Phaser.Scene {
  private loadAttempts: Map<string, boolean> = new Map();

  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    const { width, height } = this.scale;

    const progressBar = this.add.rectangle(width / 2, height / 2, 300, 20, 0x222222);
    const progressFill = this.add.rectangle(
      width / 2 - 148,
      height / 2,
      4,
      16,
      0x3498db
    );
    progressFill.setOrigin(0, 0.5);

    const loadingText = this.add.text(width / 2, height / 2 - 40, "Carregando...", {
      fontSize: "20px",
      color: "#ffffff",
    });
    loadingText.setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      progressFill.width = 296 * value;
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressFill.destroy();
      loadingText.destroy();
    });

    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      assetTracker.markFailed(file.key);
    });

    this.createPlaceholderAssets();

    this.loadCraftPixAssets();
  }

  private loadCraftPixAssets(): void {
    for (const asset of ALL_CRAFTPIX_ASSETS) {
      this.loadAttempts.set(asset.key, false);

      if (asset.type === "spritesheet" && asset.frameWidth && asset.frameHeight) {
        this.load.spritesheet(asset.key, asset.path, {
          frameWidth: asset.frameWidth,
          frameHeight: asset.frameHeight,
        });
      } else {
        this.load.image(asset.key, asset.path);
      }
    }
  }

  private createPlaceholderAssets(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });

    graphics.fillStyle(0x3498db);
    graphics.fillRect(0, 0, 16, 20);
    graphics.generateTexture("player", 16, 20);

    graphics.clear();
    graphics.fillStyle(0x8b4513);
    graphics.fillRect(0, 0, 14, 14);
    graphics.generateTexture("boar", 14, 14);

    graphics.clear();
    graphics.fillStyle(0x696969);
    graphics.fillRect(0, 0, 12, 12);
    graphics.generateTexture("wolf", 12, 12);

    graphics.clear();
    graphics.fillStyle(0x3a5f0b);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture("grass", 16, 16);

    graphics.clear();
    graphics.fillStyle(0x4a7c12);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture("grass_light", 16, 16);

    graphics.clear();
    graphics.fillStyle(0x8b7355);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture("stone_floor", 16, 16);

    graphics.clear();
    graphics.fillStyle(0x3d3d3d);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture("dungeon_tile", 16, 16);

    graphics.clear();
    graphics.fillStyle(0x1e4d2b);
    graphics.fillRect(0, 0, 16, 24);
    graphics.generateTexture("tree_placeholder", 16, 24);

    graphics.clear();
    graphics.fillStyle(0x2d5a1e);
    graphics.fillRect(0, 0, 12, 12);
    graphics.generateTexture("bush_placeholder", 12, 12);

    graphics.clear();
    graphics.fillStyle(0x666666);
    graphics.fillRect(0, 0, 10, 8);
    graphics.generateTexture("stone_placeholder", 10, 8);

    graphics.clear();
    graphics.fillStyle(0xffd700);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture("temple", 32, 32);

    graphics.clear();
    graphics.fillStyle(0x9b59b6);
    graphics.fillRect(0, 0, 24, 24);
    graphics.generateTexture("portal", 24, 24);

    graphics.clear();
    graphics.fillStyle(0x4a4a4a);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture("wall_placeholder", 16, 16);

    graphics.clear();
    graphics.fillStyle(0x5d4037);
    graphics.fillRect(0, 0, 48, 48);
    graphics.generateTexture("building_placeholder", 48, 48);

    graphics.clear();
    graphics.fillStyle(0x8b6914);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture("dirt", 16, 16);

    graphics.destroy();
  }

  create(): void {
    for (const asset of ALL_CRAFTPIX_ASSETS) {
      if (this.textures.exists(asset.key)) {
        const texture = this.textures.get(asset.key);
        const source = texture.source[0];
        if (source && source.width > 1 && source.height > 1) {
          assetTracker.markLoaded(asset.key);
        } else {
          assetTracker.markFailed(asset.key);
        }
      } else {
        assetTracker.markFailed(asset.key);
      }
    }

    const loaded = assetTracker.getLoadedCount();
    if (loaded > 0) {
      console.log(`CraftPix assets loaded: ${loaded}/${ALL_CRAFTPIX_ASSETS.length}`);
    } else {
      console.log("No CraftPix assets found - using placeholder graphics");
    }

    this.scene.start("HubScene");
  }
}
