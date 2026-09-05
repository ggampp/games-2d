import Phaser from "phaser";
import { BaseGameScene } from "./BaseGameScene";
import { COLORS, GAME_WIDTH, GAME_HEIGHT, UI_STRINGS } from "../../data/constants";
import { GODS } from "../../data/gods";
import { assetTracker } from "../../data/assets";

export class HubScene extends BaseGameScene {
  private locationText!: Phaser.GameObjects.Text;

  constructor() {
    super("HubScene");
  }

  create(): void {
    super.create();

    this.drawHub();
    this.createPlayer(GAME_WIDTH / 2, GAME_HEIGHT - 100, false);
    this.setupHubInteractables();

    this.locationText = this.add.text(GAME_WIDTH / 2, 30, UI_STRINGS.hub_name, {
      fontSize: "24px",
      color: "#f1c40f",
      fontStyle: "bold",
    });
    this.locationText.setOrigin(0.5);
    this.locationText.setDepth(100);

    this.showMessage("Bem-vindo a Setessa! Pressione E para interagir.");
  }

  private drawHub(): void {
    if (assetTracker.hasTavernAssets()) {
      this.drawCraftPixHub();
    } else {
      this.drawPlaceholderHub();
    }
  }

  private drawCraftPixHub(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x6b5344);

    if (assetTracker.isLoaded("tavern_exterior")) {
      for (let x = 0; x < GAME_WIDTH; x += 16) {
        for (let y = 0; y < GAME_HEIGHT; y += 16) {
          const frame = Phaser.Math.Between(0, 7);
          const tile = this.add.image(x + 8, y + 8, "tavern_exterior", frame);
          tile.setDepth(0);
        }
      }
    }

    if (assetTracker.isLoaded("tavern_walls_street")) {
      for (let x = 50; x < GAME_WIDTH - 50; x += 80) {
        const wallSection = this.add.image(x, 200, "tavern_walls_street", Phaser.Math.Between(0, 5));
        wallSection.setDepth(1);
        wallSection.setScale(2);
      }
    }

    this.drawTemple(150, 150, "nylea", GODS.nylea.color);
    this.drawTemple(GAME_WIDTH - 150, 150, "heliod", GODS.heliod.color);

    this.drawTavern();

    if (assetTracker.isLoaded("tree1") || assetTracker.isLoaded("bush1")) {
      this.addDecorations();
    } else {
      for (let i = 0; i < 10; i++) {
        const x = Phaser.Math.Between(50, GAME_WIDTH - 50);
        const y = Phaser.Math.Between(250, GAME_HEIGHT - 150);
        this.add.rectangle(x, y, 20, 28, COLORS.tree).setDepth(0);
      }
    }
  }

  private drawPlaceholderHub(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.hub);

    for (let i = 0; i < 15; i++) {
      const x = Phaser.Math.Between(50, GAME_WIDTH - 50);
      const y = Phaser.Math.Between(50, GAME_HEIGHT - 150);
      this.add.rectangle(x, y, 24, 32, COLORS.tree).setDepth(0);
    }

    this.add.rectangle(150, 150, 64, 48, COLORS.temple);
    this.add.text(150, 115, "Templo de", { fontSize: "10px", color: "#fff" }).setOrigin(0.5);
    this.add.text(150, 125, "Nylea", { fontSize: "12px", color: GODS.nylea.colorHex }).setOrigin(0.5);

    this.add.rectangle(GAME_WIDTH - 150, 150, 64, 48, COLORS.temple);
    this.add.text(GAME_WIDTH - 150, 115, "Templo de", { fontSize: "10px", color: "#fff" }).setOrigin(0.5);
    this.add.text(GAME_WIDTH - 150, 125, "Heliod", { fontSize: "12px", color: GODS.heliod.colorHex }).setOrigin(0.5);

    this.add.rectangle(GAME_WIDTH / 2, 80, 80, 60, 0x4a3728);
    this.add.text(GAME_WIDTH / 2, 60, "Taverna", { fontSize: "12px", color: "#fff" }).setOrigin(0.5);
  }

  private drawTemple(x: number, y: number, godId: string, color: number): void {
    const god = GODS[godId];

    if (assetTracker.isLoaded("tavern_exterior")) {
      const base = this.add.rectangle(x, y, 72, 56, 0x8b7355);
      base.setDepth(1);

      const roof = this.add.triangle(x, y - 40, 0, 30, 40, -20, 80, 30, color);
      roof.setDepth(2);

      const pillarLeft = this.add.rectangle(x - 25, y + 10, 8, 40, 0xd4c4a8);
      pillarLeft.setDepth(2);
      const pillarRight = this.add.rectangle(x + 25, y + 10, 8, 40, 0xd4c4a8);
      pillarRight.setDepth(2);

      const altar = this.add.rectangle(x, y + 5, 20, 20, color);
      altar.setDepth(2);
    } else {
      this.add.rectangle(x, y, 64, 48, COLORS.temple);
    }

    this.add.text(x, y - 55, "Templo de", { fontSize: "10px", color: "#fff" }).setOrigin(0.5).setDepth(10);
    this.add.text(x, y - 43, god.name, { fontSize: "12px", color: god.colorHex }).setOrigin(0.5).setDepth(10);
  }

  private drawTavern(): void {
    const tavernX = GAME_WIDTH / 2;
    const tavernY = 85;

    if (assetTracker.isLoaded("tavern_exterior") || assetTracker.isLoaded("tavern_interior1")) {
      const building = this.add.rectangle(tavernX, tavernY, 100, 70, 0x5d4037);
      building.setDepth(1);
      building.setStrokeStyle(2, 0x3e2723);

      const roof = this.add.rectangle(tavernX, tavernY - 40, 110, 16, 0x8d6e63);
      roof.setDepth(2);

      if (assetTracker.isLoaded("tavern_door")) {
        const door = this.add.image(tavernX, tavernY + 20, "tavern_door");
        door.setDepth(2);
        door.setScale(1.5);
      } else {
        const door = this.add.rectangle(tavernX, tavernY + 20, 20, 30, 0x3e2723);
        door.setDepth(2);
      }

      const windowLeft = this.add.rectangle(tavernX - 30, tavernY - 5, 16, 16, 0xffeb3b, 0.6);
      windowLeft.setDepth(2);
      const windowRight = this.add.rectangle(tavernX + 30, tavernY - 5, 16, 16, 0xffeb3b, 0.6);
      windowRight.setDepth(2);

      const sign = this.add.rectangle(tavernX + 55, tavernY - 20, 30, 20, 0x4e342e);
      sign.setDepth(2);
    } else {
      this.add.rectangle(tavernX, tavernY, 80, 60, 0x4a3728);
    }

    this.add.text(tavernX, tavernY - 55, "Taverna", { fontSize: "12px", color: "#fff" }).setOrigin(0.5).setDepth(10);
  }

  private addDecorations(): void {
    const treeKeys = ["tree1", "tree2", "tree3"].filter(k => assetTracker.isLoaded(k));
    const bushKeys = ["bush1", "bush2"].filter(k => assetTracker.isLoaded(k));

    const treePositions = [
      { x: 40, y: 300 }, { x: 760, y: 320 },
      { x: 60, y: 450 }, { x: 740, y: 470 },
      { x: 200, y: 280 }, { x: 600, y: 290 },
    ];

    for (const pos of treePositions) {
      if (treeKeys.length > 0) {
        const key = treeKeys[Phaser.Math.Between(0, treeKeys.length - 1)];
        const tree = this.add.image(pos.x, pos.y, key);
        tree.setDepth(1);
        tree.setScale(0.7 + Math.random() * 0.3);
      } else {
        this.add.rectangle(pos.x, pos.y, 20, 28, COLORS.tree).setDepth(1);
      }
    }

    for (let i = 0; i < 8; i++) {
      const x = Phaser.Math.Between(80, GAME_WIDTH - 80);
      const y = Phaser.Math.Between(220, GAME_HEIGHT - 130);
      if (bushKeys.length > 0) {
        const key = bushKeys[Phaser.Math.Between(0, bushKeys.length - 1)];
        const bush = this.add.image(x, y, key);
        bush.setDepth(0);
        bush.setScale(0.5 + Math.random() * 0.3);
      }
    }
  }

  private setupHubInteractables(): void {
    this.addInteractable(150, 150, GODS.nylea.color, "temple_nylea", 32, { godId: "nylea" });
    this.addInteractable(GAME_WIDTH - 150, 150, GODS.heliod.color, "temple_heliod", 32, { godId: "heliod" });

    this.addPortal(100, GAME_HEIGHT - 50, "WildsScene", { spawnPoint: "hub" });
    this.add.text(100, GAME_HEIGHT - 30, "Floresta", { fontSize: "10px", color: "#fff" }).setOrigin(0.5);

    this.addPortal(GAME_WIDTH - 100, GAME_HEIGHT - 50, "DungeonScene", { spawnPoint: "hub" });
    this.add.text(GAME_WIDTH - 100, GAME_HEIGHT - 30, "Ruínas", { fontSize: "10px", color: "#fff" }).setOrigin(0.5);

    this.addInteractable(GAME_WIDTH / 2, 85, 0x8b6914, "tavern", 50);
  }

  protected handleInteraction(type: string, data?: any): void {
    if (type === "temple_nylea" || type === "temple_heliod") {
      this.showOfferingDialog(data.godId);
    } else if (type === "portal" && data?.targetScene) {
      this.goToScene(data.targetScene, data);
    } else if (type === "tavern") {
      this.showMessage("A taverna está vazia... por enquanto.");
    }
  }

  private showOfferingDialog(godId: string): void {
    const god = GODS[godId];

    this.game.events.emit("show-dialog", {
      speaker: god.name,
      text: god.greeting,
      options: [
        {
          text: `Fazer oferenda (+15 Devoção)`,
          callback: () => {
            this.devotionSystem.addDevotion(godId, 15);
            this.showMessage(`Sua devoção a ${god.name} aumentou!`);
            this.game.events.emit("hide-dialog");

            if (this.devotionSystem.isJealousyPending()) {
              this.time.delayedCall(1500, () => {
                this.devotionSystem.triggerJealousyEvent();
              });
            }
          },
        },
        {
          text: "Apenas rezar",
          callback: () => {
            this.showMessage(god.greeting);
            this.game.events.emit("hide-dialog");
          },
        },
        {
          text: "Sair",
          callback: () => {
            this.game.events.emit("hide-dialog");
          },
        },
      ],
    });
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
