import Phaser from "phaser";
import { BaseGameScene } from "./BaseGameScene";
import { COLORS, GAME_WIDTH, GAME_HEIGHT, UI_STRINGS } from "../../data/constants";
import { ENEMY_SPAWNS } from "../../data/enemies";
import { assetTracker } from "../../data/assets";

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
    if (assetTracker.hasDungeonAssets()) {
      this.drawCraftPixDungeon();
    } else {
      this.drawPlaceholderDungeon();
    }
  }

  private drawCraftPixDungeon(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.stoneDark);

    if (assetTracker.isLoaded("dungeon_floor")) {
      for (let x = 0; x < GAME_WIDTH; x += 16) {
        for (let y = 0; y < GAME_HEIGHT; y += 16) {
          const frame = Phaser.Math.Between(0, 15);
          const tile = this.add.image(x + 8, y + 8, "dungeon_floor", frame);
          tile.setDepth(0);
        }
      }
    }

    this.drawDungeonWalls(true);

    if (assetTracker.isLoaded("dungeon_torches")) {
      const torchPositions = [
        { x: 100, y: 100 }, { x: 700, y: 100 },
        { x: 100, y: 400 }, { x: 700, y: 400 },
        { x: 400, y: 200 },
      ];
      for (const pos of torchPositions) {
        const torch = this.add.image(pos.x, pos.y, "dungeon_torches", 0);
        torch.setDepth(3);
      }
    }

    if (assetTracker.isLoaded("dungeon_coffins")) {
      const coffin = this.add.image(150, 250, "dungeon_coffins");
      coffin.setDepth(1);
      coffin.setScale(0.8);
    }

    if (assetTracker.isLoaded("dungeon_objects")) {
      for (let i = 0; i < 5; i++) {
        const x = Phaser.Math.Between(100, GAME_WIDTH - 100);
        const y = Phaser.Math.Between(150, GAME_HEIGHT - 150);
        const obj = this.add.image(x, y, "dungeon_objects");
        obj.setDepth(1);
        obj.setScale(0.4 + Math.random() * 0.3);
        obj.setCrop(0, 0, 32, 32);
      }
    }

    this.add.rectangle(GAME_WIDTH / 2, 100, 48, 48, 0xffd700);
    this.add.text(GAME_WIDTH / 2, 60, "Altar de Heliod", { fontSize: "10px", color: "#f1c40f" }).setOrigin(0.5);
  }

  private drawPlaceholderDungeon(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.stoneDark);

    for (let x = 0; x < GAME_WIDTH; x += 32) {
      for (let y = 0; y < GAME_HEIGHT; y += 32) {
        const shade = Math.random() > 0.5 ? COLORS.stone : COLORS.stoneDark;
        this.add.rectangle(x + 16, y + 16, 30, 30, shade).setDepth(0);
      }
    }

    this.drawDungeonWalls(false);

    this.add.rectangle(GAME_WIDTH / 2, 100, 48, 48, 0xffd700);
    this.add.text(GAME_WIDTH / 2, 60, "Altar de Heliod", { fontSize: "10px", color: "#f1c40f" }).setOrigin(0.5);
  }

  private drawDungeonWalls(useCraftPix: boolean): void {
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
      if (useCraftPix && assetTracker.isLoaded("dungeon_floor")) {
        const wallRect = this.add.rectangle(wall.x, wall.y, wall.w, wall.h, 0x2a2a3a);
        wallRect.setDepth(3);
        wallRect.setStrokeStyle(2, 0x1a1a2a);
      } else {
        this.add.rectangle(wall.x, wall.y, wall.w, wall.h, COLORS.wall).setDepth(3);
      }
    }
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
