import Phaser from "phaser";
import { UI_STRINGS } from "../../data/constants";

export class PreloadScene extends Phaser.Scene {
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

    this.createPlaceholderAssets();
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
    graphics.fillStyle(0x8b7355);
    graphics.fillRect(0, 0, 16, 16);
    graphics.generateTexture("stone_floor", 16, 16);

    graphics.clear();
    graphics.fillStyle(0x1e4d2b);
    graphics.fillRect(0, 0, 16, 24);
    graphics.generateTexture("tree", 16, 24);

    graphics.clear();
    graphics.fillStyle(0xffd700);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture("temple", 32, 32);

    graphics.clear();
    graphics.fillStyle(0x9b59b6);
    graphics.fillRect(0, 0, 24, 24);
    graphics.generateTexture("portal", 24, 24);

    graphics.destroy();
  }

  create(): void {
    this.scene.start("HubScene");
  }
}
