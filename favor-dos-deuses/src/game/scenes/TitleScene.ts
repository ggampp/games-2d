import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, UI_STRINGS } from "../../data/constants";
import { assetTracker } from "../../data/assets";
import { DevotionSystem } from "../../systems/DevotionSystem";
import { BestowSystem } from "../../systems/BestowSystem";
import { SaveSystem } from "../../systems/SaveSystem";

interface MenuItem {
  label: string;
  hint: string;
  action: () => void;
}

export class TitleScene extends Phaser.Scene {
  private items: MenuItem[] = [];
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private selected = 0;
  private starting = false;

  constructor() {
    super("TitleScene");
  }

  create(): void {
    this.starting = false;
    this.game.events.emit("hud-visible", false);
    this.game.events.emit("hide-dialog");

    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;

    // fundo: céu noturno com brasas de devoção subindo
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a18, 0x0a0a18, 0x1c1030, 0x24143a, 1);
    bg.fillRect(0, 0, w, h);

    for (let i = 0; i < 40; i++) {
      const gold = Math.random() > 0.5;
      const p = this.add
        .image(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h), "dot")
        .setScale(Phaser.Math.FloatBetween(0.12, 0.3))
        .setTint(gold ? 0xf1c40f : 0x2ecc71)
        .setAlpha(Phaser.Math.FloatBetween(0.15, 0.5))
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: p,
        y: p.y - Phaser.Math.Between(60, 160),
        alpha: 0,
        duration: Phaser.Math.Between(4000, 9000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 4000),
        onRepeat: () => {
          p.y = h + 10;
          p.x = Phaser.Math.Between(0, w);
          p.alpha = Phaser.Math.FloatBetween(0.15, 0.5);
        },
      });
    }

    // sol de Heliod e lua/floresta de Nylea (composição simples)
    const sun = this.add.image(w * 0.78, 120, "dot").setScale(9).setTint(0xf1c40f).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: sun, scale: 10, alpha: 0.24, duration: 3000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const leaf = this.add.image(w * 0.22, 130, "dot").setScale(8).setTint(0x2ecc71).setAlpha(0.14).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: leaf, scale: 9, alpha: 0.2, duration: 3600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    this.add
      .text(w / 2, 110, UI_STRINGS.title.toUpperCase(), {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "52px",
        color: "#f5e6c8",
        stroke: "#3a2a10",
        strokeThickness: 8,
        letterSpacing: 6,
      })
      .setOrigin(0.5)
      .setShadow(0, 6, "#000", 12, true, true);

    this.add
      .text(w / 2, 158, UI_STRINGS.subtitle, { fontSize: "16px", color: "#b8a98a", fontStyle: "italic" })
      .setOrigin(0.5);

    // herói
    const heroY = 250;
    this.add.ellipse(w / 2, heroY + 2, 26, 10, 0x000000, 0.4);
    if (assetTracker.hasHero()) {
      const hero = this.add.sprite(w / 2, heroY, "hero").setOrigin(0.5, 0.76).setScale(2);
      hero.play("hero_idle");
    } else {
      this.add.image(w / 2, heroY, "gen_hero").setOrigin(0.5, 0.9).setScale(2);
    }

    // menu
    const hasSave = SaveSystem.exists();
    this.items = [];
    if (hasSave) {
      this.items.push({
        label: UI_STRINGS.continue,
        hint: "Retoma a devoção e as bênçãos salvas",
        action: () => this.startGame(true),
      });
    }
    this.items.push({
      label: UI_STRINGS.play,
      hint: hasSave ? "Apaga o progresso salvo e recomeça" : "Começa em Setessa, sem favor divino",
      action: () => this.startGame(false),
    });

    const menuY = 330;
    this.itemTexts = this.items.map((item, i) => {
      const t = this.add
        .text(w / 2, menuY + i * 44, item.label, {
          fontFamily: "Georgia, serif",
          fontSize: "26px",
          color: "#e8dcc0",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on("pointerover", () => this.select(i));
      t.on("pointerdown", () => this.confirm());
      return t;
    });

    const hint = this.add
      .text(w / 2, menuY + this.items.length * 44 + 4, "", { fontSize: "12px", color: "#8f8570" })
      .setOrigin(0.5);
    this.events.on("select-changed", () => hint.setText(this.items[this.selected].hint));

    this.add
      .text(w / 2, h - 86, UI_STRINGS.controls, {
        fontSize: "12px",
        color: "#9a9080",
        align: "center",
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h - 44, "↑↓ escolher  ·  Enter confirmar", { fontSize: "13px", color: "#c9b98a" })
      .setOrigin(0.5);

    const loaded = assetTracker.getLoadedCount();
    this.add
      .text(w - 8, h - 8, loaded > 0 ? "Arte: CraftPix.net (Forest, Tavern, Dungeon packs)" : "Modo sem assets: gráficos gerados", {
        fontSize: "10px",
        color: "#5f5848",
      })
      .setOrigin(1, 1);

    this.select(0);

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.select((this.selected - 1 + this.items.length) % this.items.length));
    kb.on("keydown-W", () => this.select((this.selected - 1 + this.items.length) % this.items.length));
    kb.on("keydown-DOWN", () => this.select((this.selected + 1) % this.items.length));
    kb.on("keydown-S", () => this.select((this.selected + 1) % this.items.length));
    kb.on("keydown-ENTER", () => this.confirm());
    kb.on("keydown-SPACE", () => this.confirm());
    kb.on("keydown-E", () => this.confirm());

    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  private select(i: number): void {
    this.selected = i;
    this.itemTexts.forEach((t, j) => {
      const on = j === i;
      t.setColor(on ? "#f1c40f" : "#e8dcc0");
      t.setText((on ? "»  " : "") + this.items[j].label + (on ? "  «" : ""));
      t.setScale(on ? 1.08 : 1);
    });
    this.events.emit("select-changed");
  }

  private confirm(): void {
    if (this.starting) return;
    this.items[this.selected].action();
  }

  private startGame(continueSave: boolean): void {
    this.starting = true;
    const devotion = new DevotionSystem();
    const bestows = new BestowSystem();
    let playerHp: number | undefined;

    if (continueSave) {
      const save = SaveSystem.load();
      if (save) {
        devotion.deserialize(save.devotion);
        bestows.restoreEquipped(save.equipped);
        playerHp = save.playerHp;
      }
    } else {
      SaveSystem.clear();
    }

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(520, () => {
      this.scene.start("HubScene", { devotionSystem: devotion, bestowSystem: bestows, playerHp, spawnPoint: "default" });
    });
  }
}

