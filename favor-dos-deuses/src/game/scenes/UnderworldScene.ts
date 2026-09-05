import Phaser from "phaser";
import { COLORS, GAME_WIDTH, GAME_HEIGHT, UI_STRINGS, PLAYER_CONFIG } from "../../data/constants";
import { DevotionSystem } from "../../systems/DevotionSystem";
import { BestowSystem } from "../../systems/BestowSystem";

interface UnderworldSceneData {
  devotionSystem: DevotionSystem;
  bestowSystem: BestowSystem;
  returnScene: string;
}

export class UnderworldScene extends Phaser.Scene {
  private devotionSystem!: DevotionSystem;
  private bestowSystem!: BestowSystem;
  private returnScene: string = "HubScene";
  private hasChosen: boolean = false;
  private playerGhost!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("UnderworldScene");
  }

  init(data: UnderworldSceneData): void {
    this.devotionSystem = data.devotionSystem ?? new DevotionSystem();
    this.bestowSystem = data.bestowSystem ?? new BestowSystem();
    this.returnScene = data.returnScene ?? "HubScene";
    this.hasChosen = false;
  }

  create(): void {
    this.drawUnderworld();

    const titleText = this.add.text(GAME_WIDTH / 2, 80, UI_STRINGS.death_title, {
      fontSize: "48px",
      color: "#8b4513",
      fontStyle: "bold",
    });
    titleText.setOrigin(0.5);

    const descText = this.add.text(GAME_WIDTH / 2, 160, UI_STRINGS.death_text, {
      fontSize: "16px",
      color: "#b0a090",
      wordWrap: { width: 500 },
      align: "center",
    });
    descText.setOrigin(0.5);

    this.playerGhost = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 20, 28, 0x6080a0, 0.6);

    this.tweens.add({
      targets: this.playerGhost,
      y: this.playerGhost.y - 10,
      alpha: 0.3,
      yoyo: true,
      repeat: -1,
      duration: 1500,
      ease: "Sine.easeInOut",
    });

    this.createChoices();

    this.time.delayedCall(500, () => {
      this.game.events.emit("show-message", "Você está no Mundo Inferior...");
    });
  }

  private drawUnderworld(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.underworld);

    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      const size = Phaser.Math.Between(2, 6);
      const alpha = Math.random() * 0.3 + 0.1;
      const spirit = this.add.circle(x, y, size, 0x4a3f6a, alpha);

      this.tweens.add({
        targets: spirit,
        y: y - Phaser.Math.Between(20, 50),
        alpha: 0,
        duration: Phaser.Math.Between(2000, 4000),
        repeat: -1,
        yoyo: false,
        onRepeat: () => {
          spirit.y = y;
          spirit.alpha = alpha;
        },
      });
    }

    const riverY = GAME_HEIGHT - 80;
    this.add.rectangle(GAME_WIDTH / 2, riverY, GAME_WIDTH, 60, 0x1a2a4a, 0.7);
    this.add.text(GAME_WIDTH / 2, riverY, "Rio Estige", {
      fontSize: "12px",
      color: "#4a6080",
    }).setOrigin(0.5);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, 80, 100, 0x2d1b4d);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, "Erebos", {
      fontSize: "14px",
      color: "#9b59b6",
    }).setOrigin(0.5);
  }

  private createChoices(): void {
    const buttonY = GAME_HEIGHT - 150;

    const escapeBtn = this.add.rectangle(GAME_WIDTH / 2 - 120, buttonY, 180, 50, 0x1a4d1a);
    escapeBtn.setStrokeStyle(2, 0x2ecc71);
    escapeBtn.setInteractive({ useHandCursor: true });

    const escapeText = this.add.text(GAME_WIDTH / 2 - 120, buttonY, UI_STRINGS.escape, {
      fontSize: "14px",
      color: "#fff",
    });
    escapeText.setOrigin(0.5);

    escapeBtn.on("pointerover", () => escapeBtn.setFillStyle(0x2a6d2a));
    escapeBtn.on("pointerout", () => escapeBtn.setFillStyle(0x1a4d1a));
    escapeBtn.on("pointerdown", () => this.chooseEscape());

    const bargainBtn = this.add.rectangle(GAME_WIDTH / 2 + 120, buttonY, 180, 50, 0x4d1a4d);
    bargainBtn.setStrokeStyle(2, 0x9b59b6);
    bargainBtn.setInteractive({ useHandCursor: true });

    const bargainText = this.add.text(GAME_WIDTH / 2 + 120, buttonY, UI_STRINGS.bargain, {
      fontSize: "14px",
      color: "#fff",
    });
    bargainText.setOrigin(0.5);

    bargainBtn.on("pointerover", () => bargainBtn.setFillStyle(0x6d2a6d));
    bargainBtn.on("pointerout", () => bargainBtn.setFillStyle(0x4d1a4d));
    bargainBtn.on("pointerdown", () => this.chooseBargain());
  }

  private chooseEscape(): void {
    if (this.hasChosen) return;
    this.hasChosen = true;

    this.devotionSystem.removeAllDevotion(20);
    this.game.events.emit("show-message", "Você escapa, mas perde 20 de Devoção com cada deus.");

    this.cameras.main.fade(1000, 255, 255, 255);
    this.time.delayedCall(1000, () => {
      this.returnToWorld(PLAYER_CONFIG.maxHp * 0.5);
    });
  }

  private chooseBargain(): void {
    if (this.hasChosen) return;
    this.hasChosen = true;

    this.game.events.emit("show-message", UI_STRINGS.bargain_result);

    this.cameras.main.fade(1500, 0, 0, 0);
    this.time.delayedCall(1500, () => {
      this.returnToWorld(PLAYER_CONFIG.maxHp);
    });
  }

  private returnToWorld(hp: number): void {
    this.scene.start("HubScene", {
      devotionSystem: this.devotionSystem,
      bestowSystem: this.bestowSystem,
      playerHp: hp,
    });
  }
}
