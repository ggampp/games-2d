import Phaser from "phaser";
import { COLORS, GAME_WIDTH, GAME_HEIGHT, UI_STRINGS, PLAYER_CONFIG } from "../../data/constants";
import { DevotionSystem } from "../../systems/DevotionSystem";
import { BestowSystem } from "../../systems/BestowSystem";
import { SaveSystem } from "../../systems/SaveSystem";
import { assetTracker } from "../../data/assets";

interface UnderworldSceneData {
  devotionSystem: DevotionSystem;
  bestowSystem: BestowSystem;
  returnScene: string;
}

interface Choice {
  label: string;
  desc: string;
  color: number;
  action: () => void;
}

export class UnderworldScene extends Phaser.Scene {
  private devotionSystem!: DevotionSystem;
  private bestowSystem!: BestowSystem;
  private hasChosen = false;
  private selected = 0;
  private choices: Choice[] = [];
  private cards: { bg: Phaser.GameObjects.Rectangle; title: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super("UnderworldScene");
  }

  init(data: UnderworldSceneData): void {
    this.devotionSystem = data.devotionSystem ?? new DevotionSystem();
    this.bestowSystem = data.bestowSystem ?? new BestowSystem();
    this.hasChosen = false;
    this.selected = 0;
    this.cards = [];
  }

  create(): void {
    this.game.events.emit("hud-visible", false);
    this.game.events.emit("blind", false);
    this.bestowSystem.reset();

    this.drawUnderworld();

    const title = this.add
      .text(GAME_WIDTH / 2, 70, UI_STRINGS.death_title, {
        fontFamily: "Georgia, serif",
        fontSize: "48px",
        color: "#b06a4a",
        stroke: "#1a0a20",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: 80, duration: 900, ease: "Cubic.easeOut" });

    this.add
      .text(GAME_WIDTH / 2, 138, UI_STRINGS.death_text, {
        fontSize: "15px",
        color: "#b0a090",
        wordWrap: { width: 520 },
        align: "center",
      })
      .setOrigin(0.5);

    const n = this.devotionSystem.getDevotion("nylea");
    const h = this.devotionSystem.getDevotion("heliod");
    this.add
      .text(GAME_WIDTH / 2, 176, `Devoção — Nylea ${n} · Heliod ${h}`, { fontSize: "12px", color: "#7f6f8f" })
      .setOrigin(0.5);

    this.createChoices();

    const kb = this.input.keyboard!;
    const prev = () => this.select((this.selected - 1 + this.choices.length) % this.choices.length);
    const next = () => this.select((this.selected + 1) % this.choices.length);
    kb.on("keydown-LEFT", prev);
    kb.on("keydown-A", prev);
    kb.on("keydown-RIGHT", next);
    kb.on("keydown-D", next);
    kb.on("keydown-ONE", () => this.select(0));
    kb.on("keydown-TWO", () => this.select(1));
    kb.on("keydown-ENTER", () => this.confirm());
    kb.on("keydown-SPACE", () => this.confirm());
    kb.on("keydown-E", () => this.confirm());

    this.cameras.main.fadeIn(800, 20, 5, 30);
  }

  private drawUnderworld(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(COLORS.underworld, COLORS.underworld, 0x2a1436, 0x1a0c24, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // almas flutuando
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      const s = this.add
        .image(x, y, "dot")
        .setScale(Phaser.Math.FloatBetween(0.15, 0.5))
        .setTint(0x8e7cc3)
        .setAlpha(Phaser.Math.FloatBetween(0.1, 0.4))
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: s,
        y: y - Phaser.Math.Between(30, 80),
        alpha: 0,
        duration: Phaser.Math.Between(2500, 5000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
        onRepeat: () => {
          s.y = y;
          s.alpha = Phaser.Math.FloatBetween(0.1, 0.4);
        },
      });
    }

    // Erebos
    const ex = GAME_WIDTH / 2;
    const ey = 300;
    const aura = this.add.image(ex, ey - 20, "dot").setScale(14).setTint(0x9b59b6).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: aura, scale: 16, alpha: 0.26, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    if (assetTracker.isLoaded("statue_fire")) {
      const erebos = this.add.sprite(ex, ey + 40, "statue_fire").setOrigin(0.5, 1).setScale(2).setTint(0xc9a8ff);
      erebos.play("statue_fire_anim");
    } else {
      this.add.rectangle(ex, ey, 60, 100, 0x2d1b4d);
    }
    this.add
      .text(ex, ey + 56, "Erebos, Deus dos Mortos", { fontSize: "13px", color: "#9b59b6", fontStyle: "italic" })
      .setOrigin(0.5);

    // alma do herói
    const soulKey = assetTracker.isLoaded("ghost") ? "ghost" : "gen_shade";
    const soul = this.add.image(ex - 140, ey + 20, soulKey, assetTracker.isLoaded("ghost") ? 2 : 0).setTint(0xbfe3ff).setAlpha(0.8);
    this.tweens.add({ targets: soul, y: soul.y - 10, alpha: 0.5, yoyo: true, repeat: -1, duration: 1500, ease: "Sine.easeInOut" });

    // rio Estige
    const riverY = GAME_HEIGHT - 60;
    this.add.rectangle(GAME_WIDTH / 2, riverY, GAME_WIDTH, 60, 0x101a34, 0.8);
    for (let i = 0; i < 14; i++) {
      const w = this.add.rectangle(Phaser.Math.Between(0, GAME_WIDTH), riverY + Phaser.Math.Between(-20, 20), 40, 1, 0x3a4a7a, 0.6);
      this.tweens.add({ targets: w, x: w.x + 120, alpha: 0, duration: Phaser.Math.Between(2000, 4000), repeat: -1 });
    }
    this.add.text(GAME_WIDTH / 2, riverY, "Rio Estige", { fontSize: "11px", color: "#4a6080" }).setOrigin(0.5);
  }

  private createChoices(): void {
    this.choices = [
      {
        label: UI_STRINGS.escape,
        desc: "Volta a Setessa com metade da vida.\nPerde 20 de Devoção com cada deus.",
        color: 0x2ecc71,
        action: () => this.chooseEscape(),
      },
      {
        label: UI_STRINGS.bargain,
        desc: "Volta com a vida cheia e a Devoção intacta.\nUma sombra de Erebos passará a te caçar.",
        color: 0x9b59b6,
        action: () => this.chooseBargain(),
      },
    ];

    const y = 440;
    const w = 300;
    this.choices.forEach((ch, i) => {
      const x = GAME_WIDTH / 2 + (i === 0 ? -170 : 170);
      const bg = this.add.rectangle(x, y, w, 96, 0x150a1e, 0.9).setStrokeStyle(2, ch.color, 0.6);
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => this.select(i));
      bg.on("pointerdown", () => this.confirm());
      const title = this.add.text(x, y - 26, ch.label, { fontSize: "16px", color: "#fff", fontStyle: "bold" }).setOrigin(0.5);
      const desc = this.add.text(x, y + 14, ch.desc, { fontSize: "11px", color: "#a89cb8", align: "center" }).setOrigin(0.5);
      this.cards.push({ bg, title, desc });
    });

    this.add
      .text(GAME_WIDTH / 2, y + 74, "← → escolher · Enter confirmar", { fontSize: "12px", color: "#6f6480" })
      .setOrigin(0.5);

    this.select(0);
  }

  private select(i: number): void {
    this.selected = i;
    this.cards.forEach((c, j) => {
      const on = j === i;
      c.bg.setStrokeStyle(on ? 3 : 2, this.choices[j].color, on ? 1 : 0.5);
      c.bg.setFillStyle(on ? 0x231536 : 0x150a1e, 0.92);
      c.bg.setScale(on ? 1.04 : 1);
      c.title.setColor(on ? "#f5e6c8" : "#ffffff");
    });
  }

  private confirm(): void {
    if (this.hasChosen) return;
    this.choices[this.selected].action();
  }

  private chooseEscape(): void {
    this.hasChosen = true;
    this.devotionSystem.removeAllDevotion(20);
    this.game.events.emit("show-message", { text: "Você escapa, mas perde 20 de Devoção com cada deus.", duration: 4000 });
    this.cameras.main.fade(1000, 255, 255, 255);
    this.time.delayedCall(1000, () => this.returnToWorld(PLAYER_CONFIG.maxHp * 0.5));
  }

  private chooseBargain(): void {
    this.hasChosen = true;
    this.devotionSystem.setBargained(true);
    this.game.events.emit("show-message", { text: UI_STRINGS.bargain_result, duration: 5000 });
    this.cameras.main.shake(400, 0.01);
    this.cameras.main.fade(1500, 0, 0, 0);
    this.time.delayedCall(1500, () => this.returnToWorld(PLAYER_CONFIG.maxHp));
  }

  private returnToWorld(hp: number): void {
    SaveSystem.save({
      devotion: this.devotionSystem.serialize(),
      equipped: this.bestowSystem.serializeEquipped(),
      playerHp: hp,
      bargained: this.devotionSystem.hasBargained(),
    });
    this.scene.start("HubScene", {
      devotionSystem: this.devotionSystem,
      bestowSystem: this.bestowSystem,
      playerHp: hp,
      spawnPoint: "default",
    });
  }
}
