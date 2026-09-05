import Phaser from "phaser";
import { BaseGameScene } from "./BaseGameScene";
import { COLORS, GAME_WIDTH, GAME_HEIGHT, UI_STRINGS } from "../../data/constants";
import { GODS } from "../../data/gods";

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

  private setupHubInteractables(): void {
    this.addInteractable(150, 150, GODS.nylea.color, "temple_nylea", 32, { godId: "nylea" });
    this.addInteractable(GAME_WIDTH - 150, 150, GODS.heliod.color, "temple_heliod", 32, { godId: "heliod" });

    this.addPortal(100, GAME_HEIGHT - 50, "WildsScene", { spawnPoint: "hub" });
    this.add.text(100, GAME_HEIGHT - 30, "Floresta", { fontSize: "10px", color: "#fff" }).setOrigin(0.5);

    this.addPortal(GAME_WIDTH - 100, GAME_HEIGHT - 50, "DungeonScene", { spawnPoint: "hub" });
    this.add.text(GAME_WIDTH - 100, GAME_HEIGHT - 30, "Ruínas", { fontSize: "10px", color: "#fff" }).setOrigin(0.5);

    this.addInteractable(GAME_WIDTH / 2, 80, 0x8b6914, "tavern", 40);
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
    const currentDevotion = this.devotionSystem.getDevotion(godId);

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
