import Phaser from "phaser";
import { BaseGameScene, type Interactable } from "./BaseGameScene";
import { COLORS, GAME_WIDTH, GAME_HEIGHT, UI_STRINGS, DEPTH } from "../../data/constants";
import { GODS } from "../../data/gods";
import { assetTracker, TILES } from "../../data/assets";
import { TileCanvas } from "../tiles";

/**
 * Setessa — vila-hub. Templos de Nylea (esq.) e Heliod (dir.), taverna
 * ao centro, portais para a Floresta (esq. inferior) e Ruínas (dir. inferior).
 */
export class HubScene extends BaseGameScene {
  protected readonly locationName = UI_STRINGS.hub_name;
  protected readonly locationColor = "#f1c40f";

  constructor() {
    super("HubScene");
  }

  create(): void {
    super.create();
    this.setWorldSize(GAME_WIDTH, GAME_HEIGHT);

    this.drawGround();
    this.buildTavern();
    this.buildTempleNylea(130, 178);
    this.buildTempleHeliod(670, 178);
    this.buildVillage();
    this.buildExits();

    const spawn = this.getSpawn();
    this.createPlayer(spawn.x, spawn.y);
    this.finishSetup();

    if (this.spawnPoint === "default") {
      this.time.delayedCall(600, () =>
        this.showMessage("Bem-vindo a Setessa. Aproxime-se dos templos e pressione E.", 4000)
      );
    }
  }

  private getSpawn(): { x: number; y: number } {
    switch (this.spawnPoint) {
      case "wilds":
        return { x: 80, y: 500 };
      case "dungeon":
        return { x: 720, y: 500 };
      default:
        return { x: 400, y: 420 };
    }
  }

  // ------------------------------------------------------------------ chão

  private drawGround(): void {
    const cols = GAME_WIDTH / 16;
    const rows = GAME_HEIGHT / 16;
    const tc = new TileCanvas(this, GAME_WIDTH, GAME_HEIGHT, DEPTH.ground);

    if (assetTracker.isLoaded("street_tiles")) {
      const S = TILES.street;
      tc.fill("street_tiles", 0, 0, cols, rows, () => {
        const r = S.cobbleRows[Phaser.Math.Between(0, S.cobbleRows.length - 1)];
        const c = S.cobbleCols[Phaser.Math.Between(0, S.cobbleCols.length - 1)];
        return r * S.cols + c;
      });

      // praça de pedra clara sob o templo de Heliod
      tc.fill("street_tiles", 37, 6, 10, 8, () => S.paleVariants[Phaser.Math.Between(0, S.paleVariants.length - 1)]);

      // folhas caídas espalhadas
      for (let i = 0; i < 60; i++) {
        const f = S.leaves[Phaser.Math.Between(0, S.leaves.length - 1)];
        tc.draw("street_tiles", f, Phaser.Math.Between(0, cols - 1), Phaser.Math.Between(12, rows - 1), 0.85);
      }
    } else {
      tc.solid(COLORS.cobble, 0, 0, cols, rows);
      for (let i = 0; i < 300; i++) {
        tc.solid(Math.random() > 0.5 ? 0xa0805f : 0xb8957a, Phaser.Math.Between(0, cols - 1), Phaser.Math.Between(0, rows - 1), 1, 1, 0.6);
      }
    }

    // jardim sob o templo de Nylea (tiles da floresta)
    if (assetTracker.isLoaded("forest_ground")) {
      const F = TILES.forest;
      tc.blob("forest_ground", [F.tuftTL, F.tuftT, F.tuftTR, F.tuftL, F.tuftC, F.tuftR, F.tuftBL, F.tuftB, F.tuftBR], 3, 6, 10, 8);
    } else {
      tc.solid(COLORS.grass, 3, 6, 10, 8);
    }
  }

  // ------------------------------------------------------------------ taverna

  private buildTavern(): void {
    const x = 400;
    const y = 190;
    const hasArt = assetTracker.isLoaded("tavern_exterior");

    if (hasArt) {
      this.placeObject("tavern_exterior", "tavern_big", x, y, { block: { w: 176, h: 104 } });
      this.addGlow(x - 60, y - 60, 22, 0xffb347, 0.18);
      this.addGlow(x + 42, y - 60, 22, 0xffb347, 0.18);

      this.placeObject("tavern_exterior", "table_food", 262, 252, { block: { w: 40, h: 16 } });
      this.placeObject("tavern_exterior", "table_round", 560, 252, { block: { w: 30, h: 16 } });
      this.placeObject("tavern_exterior", "barrel", 500, 190, { block: { w: 24, h: 12 } });
      this.placeObject("tavern_exterior", "crate", 318, 190, { block: { w: 26, h: 14 } });

      this.placeAnimated("npc_host", "npc_host_anim", 436, 200);
      this.placeAnimated("npc_lute", "npc_lute_anim", 606, 254);
    } else {
      this.placeObject("px", undefined, x, y, { scale: 12, tint: 0x5d4037, block: { w: 96, h: 60 } });
      this.add.text(x, y - 100, "Taverna", { fontSize: "12px", color: "#fff" }).setOrigin(0.5).setDepth(DEPTH.overlay - 2);
    }

    this.addInteractable(x, y + 6, "tavern", "Entrar na taverna", undefined, 44);
  }

  // ------------------------------------------------------------------ templos

  private buildTempleNylea(x: number, y: number): void {
    const god = GODS.nylea;
    const hasForest = assetTracker.isLoaded("tree9");

    if (assetTracker.isLoaded("ruin_orange3")) {
      this.placeObject("ruin_orange3", undefined, x, y + 14, { block: { w: 36, h: 22 } });
    } else {
      this.placeObject("px", undefined, x, y + 14, { scale: 5, tint: 0x8b7355, block: { w: 36, h: 22 } });
    }

    if (hasForest) {
      this.placeObject("tree9", undefined, x - 62, y - 10, { block: { w: 18, h: 12 } });
      this.placeObject("tree12", undefined, x + 62, y - 6, { block: { w: 18, h: 12 } });
      this.placeObject("bush12", undefined, x - 40, y + 40, {});
      this.placeObject("bush2", undefined, x + 44, y + 42, {});
      this.placeObject("mushroom1", undefined, x - 20, y + 48, {});
    }

    this.placeTorch(x - 34, y + 30, 0x7dffb3);
    this.placeTorch(x + 34, y + 30, 0x7dffb3);
    this.addGlow(x, y, 46, god.color, 0.16);

    this.add
      .text(x, y - 78, "Templo de Nylea", { fontSize: "12px", color: god.colorHex, stroke: "#000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay - 2);

    this.addInteractable(x, y + 10, "temple", "Altar de Nylea", { godId: "nylea" }, 50);
  }

  private buildTempleHeliod(x: number, y: number): void {
    const god = GODS.heliod;
    const hasDungeon = assetTracker.isLoaded("dungeon_objects");

    if (assetTracker.isLoaded("dungeon_tiles")) {
      const tc = new TileCanvas(this, GAME_WIDTH, GAME_HEIGHT, DEPTH.groundDecor);
      const slab = TILES.dungeon.slab;
      const c0 = Math.round(x / 16) - 1;
      const r0 = Math.round(y / 16) - 2;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tc.draw("dungeon_tiles", slab[r][c], c0 + c, r0 + r);
    }

    if (hasDungeon) {
      this.placeObject("dungeon_objects", "statue_a", x, y + 8, { block: { w: 20, h: 14 } });
      if (assetTracker.isLoaded("dungeon_arches")) {
        this.placeObject("dungeon_arches", "pillar", x - 56, y + 12, { block: { w: 18, h: 12 } });
        this.placeObject("dungeon_arches", "pillar", x + 56, y + 12, { block: { w: 18, h: 12 } });
      }
    } else {
      this.placeObject("px", undefined, x, y + 8, { scale: 4, tint: 0xd4c4a8, block: { w: 20, h: 14 } });
    }

    this.placeTorch(x - 30, y + 34, 0xffd166);
    this.placeTorch(x + 30, y + 34, 0xffd166);
    this.addGlow(x, y - 10, 50, god.color, 0.2);

    this.add
      .text(x, y - 78, "Templo de Heliod", { fontSize: "12px", color: god.colorHex, stroke: "#000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay - 2);

    this.addInteractable(x, y + 10, "temple", "Altar de Heliod", { godId: "heliod" }, 50);
  }

  /** Tocha animada com tint (variante 1 = tocha de parede 32x48) */
  private placeTorch(x: number, y: number, tint: number): void {
    const s = this.placeAnimated("dungeon_torches", "torch1", x, y, { tint });
    if (s) {
      this.addGlow(x, y - 26, 20, tint, 0.28);
    } else {
      const f = this.add.circle(x, y - 10, 4, tint).setDepth(DEPTH.ySortBase + y);
      this.tweens.add({ targets: f, scale: 1.3, alpha: 0.7, yoyo: true, repeat: -1, duration: 300 });
    }
  }

  // ------------------------------------------------------------------ vila

  private buildVillage(): void {
    if (!assetTracker.isLoaded("tavern_exterior")) return;

    this.placeObject("tavern_exterior", "house_small_a", 70, 350, { block: { w: 56, h: 26 } });
    this.placeObject("tavern_exterior", "house_right", 715, 380, { block: { w: 130, h: 50 } });
    this.placeObject("tavern_exterior", "stall", 208, 348, { block: { w: 34, h: 18 } });
    this.placeObject("tavern_exterior", "crate", 246, 346, { block: { w: 26, h: 12 } });
    this.placeObject("tavern_exterior", "barrel", 278, 342, { block: { w: 22, h: 12 } });

    // cerca inferior com aberturas para os portais
    for (let x = 156; x <= 640; x += 64) {
      this.placeObject("tavern_exterior", "fence_h2", x + 32, 548, { block: { w: 64, h: 8 } });
    }

    // guarda perto das ruínas
    this.placeAnimated("npc_watcher", "npc_watcher_anim", 662, 545);

    if (assetTracker.isLoaded("bush1")) {
      this.placeObject("bush1", undefined, 40, 456, {});
      this.placeObject("bush11", undefined, 760, 470, {});
    }
  }

  // ------------------------------------------------------------------ saídas

  private buildExits(): void {
    // Floresta (esq. inferior): borda de árvores
    if (assetTracker.isLoaded("tree1")) {
      this.placeObject("tree12", undefined, 146, 606, { block: { w: 18, h: 12 } });
      this.placeObject("tree9", undefined, 22, 612, { block: { w: 18, h: 12 } });
      this.placeObject("bush3", undefined, 26, 520, {});
    }
    this.addPortal(80, 556, "WildsScene", "Floresta Selvagem", "hub", 0x2ecc71);

    // Ruínas (dir. inferior): arco de pedra
    if (assetTracker.isLoaded("dungeon_arches")) {
      this.placeObject("dungeon_arches", "arch_dark", 720, 600, { scale: 2, depth: DEPTH.ySortBase + 600 });
      this.addBlocker(690, 580, 12, 40);
      this.addBlocker(750, 580, 12, 40);
      this.addBlocker(720, 598, 60, 6);
      this.addGlow(720, 570, 26, 0x9b59b6, 0.16);
    }
    this.addPortal(720, 556, "DungeonScene", "Ruínas Antigas", "hub", 0x9b59b6);
  }

  // ------------------------------------------------------------------ interação

  protected handleInteraction(it: Interactable): void {
    if (it.type === "temple") {
      const god = GODS[it.data.godId];
      this.showOfferingDialog(it.data.godId, `Templo de ${god.name}`, god.greeting);
    } else if (it.type === "tavern") {
      this.showTavernDialog();
    }
  }

  private showTavernDialog(): void {
    const hpMissing = this.player.maxHp - this.player.hp;
    this.showDialog({
      speaker: "Taverneiro",
      text:
        hpMissing > 0
          ? `Você parece cansado da estrada, herói. Um descanso cura suas feridas (${Math.round(this.player.hp)}/${this.player.maxHp}).`
          : "Bem-vindo! A caneca está cheia e as histórias também.",
      options: [
        {
          text: "Descansar (recupera toda a vida)",
          callback: () => {
            if (hpMissing > 0) {
              this.cameras.main.fadeOut(300, 0, 0, 0);
              this.time.delayedCall(320, () => {
                this.combat.heal(this.player, this.player.maxHp);
                this.cameras.main.fadeIn(400, 0, 0, 0);
                this.showMessage("Você descansou. Vida restaurada!");
                this.persist();
              });
            } else {
              this.showMessage("Você já está com a vida cheia.");
            }
          },
        },
        {
          text: "Ouvir rumores",
          callback: () => {
            const tips = [
              "Nylea recompensa quem caça na floresta; Heliod, quem purifica as ruínas.",
              "Com 25 de Devoção o deus concede uma bênção. Com 50, outra.",
              "Dizem que os deuses são ciumentos: subir demais com um enquanto o outro está alto... irrita.",
              "Se cair em combate, Erebos oferece uma barganha. Ela nunca é de graça.",
              "A esquiva (Shift) te deixa invulnerável por um instante. Use quando vir o '!' vermelho.",
            ];
            this.showDialog({
              speaker: "Taverneiro",
              text: tips[Phaser.Math.Between(0, tips.length - 1)],
              options: [{ text: "Entendi", callback: () => {} }],
            });
          },
        },
        { text: "Sair", callback: () => {} },
      ],
    });
  }
}
