import Phaser from "phaser";
import { BaseGameScene } from "./BaseGameScene";
import { COLORS, GAME_WIDTH, GAME_HEIGHT, UI_STRINGS } from "../../data/constants";
import { ENEMY_SPAWNS } from "../../data/enemies";
import { assetTracker } from "../../data/assets";

export class WildsScene extends BaseGameScene {
  private locationText!: Phaser.GameObjects.Text;
  private enemiesKilled: number = 0;
  private readonly enemiesRequired: number = 3;

  constructor() {
    super("WildsScene");
  }

  create(): void {
    super.create();

    this.enemiesKilled = 0;

    this.drawWilds();
    this.createPlayer(100, GAME_HEIGHT - 100, true);
    this.spawnWildsEnemies();
    this.setupWildsInteractables();

    this.locationText = this.add.text(GAME_WIDTH / 2, 30, UI_STRINGS.wilds_name, {
      fontSize: "24px",
      color: "#2ecc71",
      fontStyle: "bold",
    });
    this.locationText.setOrigin(0.5);
    this.locationText.setDepth(100);

    this.showMessage("Cuidado! A floresta está repleta de criaturas.");
  }

  private drawWilds(): void {
    if (assetTracker.hasForestAssets()) {
      this.drawCraftPixForest();
    } else {
      this.drawPlaceholderForest();
    }
  }

  private drawCraftPixForest(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.grass);

    if (assetTracker.isLoaded("forest_ground")) {
      for (let x = 0; x < GAME_WIDTH; x += 16) {
        for (let y = 0; y < GAME_HEIGHT; y += 16) {
          const frame = Phaser.Math.Between(0, 3);
          const tile = this.add.image(x + 8, y + 8, "forest_ground", frame);
          tile.setDepth(0);
        }
      }
    }

    const treeKeys = ["tree1", "tree2", "tree3", "tree4", "tree5"].filter(k => assetTracker.isLoaded(k));
    const bushKeys = ["bush1", "bush2", "bush3"].filter(k => assetTracker.isLoaded(k));
    const stoneKeys = ["stone1", "stone2"].filter(k => assetTracker.isLoaded(k));

    const treePositions = [
      { x: 50, y: 80 }, { x: 150, y: 40 }, { x: 300, y: 60 },
      { x: 500, y: 50 }, { x: 650, y: 80 }, { x: 750, y: 40 },
      { x: 30, y: 280 }, { x: 770, y: 330 },
      { x: 80, y: 480 }, { x: 720, y: 460 },
    ];

    for (const pos of treePositions) {
      if (treeKeys.length > 0) {
        const key = treeKeys[Phaser.Math.Between(0, treeKeys.length - 1)];
        const tree = this.add.image(pos.x, pos.y, key);
        tree.setDepth(2);
        tree.setScale(0.8 + Math.random() * 0.4);
      } else {
        this.add.rectangle(pos.x, pos.y, 24, 40, COLORS.tree).setDepth(2);
      }
    }

    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(60, GAME_WIDTH - 60);
      const y = Phaser.Math.Between(100, GAME_HEIGHT - 120);
      if (bushKeys.length > 0) {
        const key = bushKeys[Phaser.Math.Between(0, bushKeys.length - 1)];
        const bush = this.add.image(x, y, key);
        bush.setDepth(1);
        bush.setScale(0.6 + Math.random() * 0.3);
      }
    }

    for (let i = 0; i < 6; i++) {
      const x = Phaser.Math.Between(80, GAME_WIDTH - 80);
      const y = Phaser.Math.Between(120, GAME_HEIGHT - 100);
      if (stoneKeys.length > 0) {
        const key = stoneKeys[Phaser.Math.Between(0, stoneKeys.length - 1)];
        const stone = this.add.image(x, y, key);
        stone.setDepth(1);
        stone.setScale(0.5 + Math.random() * 0.3);
      }
    }

    this.add.rectangle(GAME_WIDTH / 2, 150, 48, 48, 0x5d4037);
    this.add.text(GAME_WIDTH / 2, 110, "Altar de Nylea", { fontSize: "10px", color: "#2ecc71" }).setOrigin(0.5);
  }

  private drawPlaceholderForest(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.grass);

    for (let x = 0; x < GAME_WIDTH; x += 48) {
      for (let y = 0; y < GAME_HEIGHT; y += 48) {
        if (Math.random() > 0.7) {
          const shade = Math.random() > 0.5 ? COLORS.grass : COLORS.grassLight;
          this.add.rectangle(x + Math.random() * 24, y + Math.random() * 24, 8, 8, shade).setDepth(0);
        }
      }
    }

    const treePositions = [
      { x: 50, y: 100 }, { x: 150, y: 50 }, { x: 300, y: 80 },
      { x: 500, y: 60 }, { x: 650, y: 100 }, { x: 750, y: 50 },
      { x: 30, y: 300 }, { x: 770, y: 350 },
      { x: 100, y: 500 }, { x: 700, y: 480 },
    ];

    for (const pos of treePositions) {
      this.add.rectangle(pos.x, pos.y, 24, 40, COLORS.tree).setDepth(2);
    }

    this.add.rectangle(GAME_WIDTH / 2, 150, 48, 48, 0x5d4037);
    this.add.text(GAME_WIDTH / 2, 110, "Altar de Nylea", { fontSize: "10px", color: "#2ecc71" }).setOrigin(0.5);
  }

  private spawnWildsEnemies(): void {
    const spawnTypes = ENEMY_SPAWNS.wilds;

    const spawnPositions = [
      { x: 250, y: 200 },
      { x: 550, y: 250 },
      { x: 400, y: 400 },
      { x: 200, y: 350 },
      { x: 600, y: 380 },
    ];

    for (let i = 0; i < 5; i++) {
      const pos = spawnPositions[i];
      const type = spawnTypes[i % spawnTypes.length];
      this.spawnEnemy(pos.x, pos.y, type);
    }
  }

  private setupWildsInteractables(): void {
    this.addPortal(50, GAME_HEIGHT - 50, "HubScene", { spawnPoint: "wilds" });
    this.add.text(50, GAME_HEIGHT - 30, "Setessa", { fontSize: "10px", color: "#fff" }).setOrigin(0.5);

    this.addInteractable(GAME_WIDTH / 2, 150, 0x2ecc71, "altar_nylea", 24, { godId: "nylea" });
  }

  protected onEnemyKilled(enemy: import("../../entities/Enemy").Enemy): void {
    super.onEnemyKilled(enemy);
    this.enemiesKilled++;

    if (this.enemiesKilled === this.enemiesRequired) {
      this.showMessage("Você provou seu valor na caça! Vá ao altar.");
    }
  }

  protected handleInteraction(type: string, data?: any): void {
    if (type === "portal" && data?.targetScene) {
      this.goToScene(data.targetScene, data);
    } else if (type === "altar_nylea") {
      if (this.enemiesKilled >= this.enemiesRequired) {
        this.game.events.emit("show-dialog", {
          speaker: "Altar de Nylea",
          text: "Você honrou a caça. Nylea sorri para você.",
          options: [
            {
              text: "Fazer oferenda (+15 Devoção)",
              callback: () => {
                this.devotionSystem.addDevotion("nylea", 15);
                this.showMessage("Sua devoção a Nylea cresce!");
                this.game.events.emit("hide-dialog");

                if (this.devotionSystem.isJealousyPending()) {
                  this.time.delayedCall(1500, () => {
                    this.devotionSystem.triggerJealousyEvent();
                  });
                }
              },
            },
            {
              text: "Partir",
              callback: () => {
                this.game.events.emit("hide-dialog");
              },
            },
          ],
        });
      } else {
        this.showMessage(`Derrote mais ${this.enemiesRequired - this.enemiesKilled} criatura(s) para provar seu valor.`);
      }
    }
  }

  private goToScene(targetScene: string, data: any): void {
    this.scene.start(targetScene, {
      devotionSystem: this.devotionSystem,
      bestowSystem: this.bestowSystem,
      playerHp: this.player.hp,
      ...data,
    });
  }
}
