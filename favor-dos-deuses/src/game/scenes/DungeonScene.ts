import Phaser from "phaser";
import { BaseGameScene } from "./BaseGameScene";
import { COLORS, GAME_WIDTH, GAME_HEIGHT, UI_STRINGS } from "../../data/constants";
import { ENEMY_SPAWNS } from "../../data/enemies";

export class DungeonScene extends BaseGameScene {
  private locationText!: Phaser.GameObjects.Text;
  private enemiesKilled: number = 0;
  private readonly enemiesRequired: number = 4;

  constructor() {
    super("DungeonScene");
  }

  create(): void {
    super.create();

    this.enemiesKilled = 0;

    this.drawDungeon();
    this.createPlayer(GAME_WIDTH - 100, GAME_HEIGHT - 100, true);
    this.spawnDungeonEnemies();
    this.setupDungeonInteractables();

    this.locationText = this.add.text(GAME_WIDTH / 2, 30, UI_STRINGS.dungeon_name, {
      fontSize: "24px",
      color: "#f1c40f",
      fontStyle: "bold",
    });
    this.locationText.setOrigin(0.5);
    this.locationText.setDepth(100);

    this.showMessage("As ruínas antigas guardam segredos... e perigos.");
  }

  private drawDungeon(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.stoneDark);

    for (let x = 0; x < GAME_WIDTH; x += 32) {
      for (let y = 0; y < GAME_HEIGHT; y += 32) {
        const shade = Math.random() > 0.5 ? COLORS.stone : COLORS.stoneDark;
        this.add.rectangle(x + 16, y + 16, 30, 30, shade).setDepth(0);
      }
    }

    const wallPositions = [
      { x: 0, y: GAME_HEIGHT / 2, w: 20, h: GAME_HEIGHT },
      { x: GAME_WIDTH, y: GAME_HEIGHT / 2, w: 20, h: GAME_HEIGHT },
      { x: GAME_WIDTH / 2, y: 0, w: GAME_WIDTH, h: 20 },

      { x: 200, y: 150, w: 80, h: 20 },
      { x: 600, y: 150, w: 80, h: 20 },
      { x: 300, y: 300, w: 20, h: 120 },
      { x: 500, y: 300, w: 20, h: 120 },
      { x: 400, y: 450, w: 200, h: 20 },
    ];

    for (const wall of wallPositions) {
      this.add.rectangle(wall.x, wall.y, wall.w, wall.h, COLORS.wall).setDepth(3);
    }

    this.add.rectangle(GAME_WIDTH / 2, 100, 48, 48, 0xffd700);
    this.add.text(GAME_WIDTH / 2, 60, "Altar de Heliod", { fontSize: "10px", color: "#f1c40f" }).setOrigin(0.5);
  }

  private spawnDungeonEnemies(): void {
    const spawnTypes = ENEMY_SPAWNS.dungeon;

    const spawnPositions = [
      { x: 150, y: 250 },
      { x: 650, y: 250 },
      { x: 400, y: 350 },
      { x: 200, y: 450 },
      { x: 600, y: 450 },
      { x: 400, y: 200 },
    ];

    for (let i = 0; i < 6; i++) {
      const pos = spawnPositions[i];
      const type = spawnTypes[i % spawnTypes.length];
      this.spawnEnemy(pos.x, pos.y, type);
    }
  }

  private setupDungeonInteractables(): void {
    this.addPortal(GAME_WIDTH - 50, GAME_HEIGHT - 50, "HubScene", { spawnPoint: "dungeon" });
    this.add.text(GAME_WIDTH - 50, GAME_HEIGHT - 30, "Setessa", { fontSize: "10px", color: "#fff" }).setOrigin(0.5);

    this.addInteractable(GAME_WIDTH / 2, 100, 0xffd700, "altar_heliod", 24, { godId: "heliod" });
  }

  protected onEnemyKilled(enemy: import("../../entities/Enemy").Enemy): void {
    super.onEnemyKilled(enemy);
    this.enemiesKilled++;

    if (this.enemiesKilled === this.enemiesRequired) {
      this.showMessage("A luz de Heliod brilha sobre você! Vá ao altar.");
    }
  }

  protected handleInteraction(type: string, data?: any): void {
    if (type === "portal" && data?.targetScene) {
      this.goToScene(data.targetScene, data);
    } else if (type === "altar_heliod") {
      if (this.enemiesKilled >= this.enemiesRequired) {
        this.game.events.emit("show-dialog", {
          speaker: "Altar de Heliod",
          text: "Você trouxe justiça aos mortos-vivos. Heliod abençoa você.",
          options: [
            {
              text: "Fazer oferenda (+15 Devoção)",
              callback: () => {
                this.devotionSystem.addDevotion("heliod", 15);
                this.showMessage("Sua devoção a Heliod cresce!");
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
        this.showMessage(`Derrote mais ${this.enemiesRequired - this.enemiesKilled} inimigo(s) para provar seu valor.`);
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
