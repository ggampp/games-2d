import Phaser from "phaser";
import { PLAYERS, PLAYER_ORDER, type FighterId } from "../../data/fighters.js";
import { audio } from "../../audio/GameAudio.js";

export class SelectScene extends Phaser.Scene {
  private index = 0;
  private cards: Phaser.GameObjects.Container[] = [];

  constructor() {
    super("SelectScene");
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x0c0a10);
    if (this.textures.exists("far")) {
      this.add.image(width / 2, height / 2, "far").setDisplaySize(width, height).setAlpha(0.35);
    }

    this.add
      .text(width / 2, 28, "ESCOLHA SEU CAÇADOR", {
        fontFamily: "Bungee, sans-serif",
        fontSize: "20px",
        color: "#ffb347",
      })
      .setOrigin(0.5);

    PLAYER_ORDER.forEach((id, i) => {
      this.cards.push(this.makeCard(id, 14 + i * 156, 78));
    });

    this.add
      .text(width / 2, 338, "← →  escolher     ENTER / Z  confirmar", {
        fontFamily: "Rajdhani, sans-serif",
        fontSize: "14px",
        color: "#9aa0a8",
      })
      .setOrigin(0.5);

    this.refresh();

    this.input.keyboard?.on("keydown-LEFT", () => this.move(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.move(1));
    this.input.keyboard?.on("keydown-A", () => this.move(-1));
    this.input.keyboard?.on("keydown-D", () => this.move(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.confirm());
    this.input.keyboard?.on("keydown-Z", () => this.confirm());
    this.input.keyboard?.on("keydown-SPACE", () => this.confirm());
  }

  private makeCard(id: FighterId, x: number, y: number): Phaser.GameObjects.Container {
    const def = PLAYERS[id];
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(70, 110, 136, 220, 0x161018, 0.92).setStrokeStyle(2, 0x6a5040);
    bg.setName("bg");
    c.add(bg);
    if (this.textures.exists(id)) {
      const img = this.add.image(70, 78, id).setDisplaySize(120, 150);
      c.add(img);
    }
    c.add(
      this.add
        .text(70, 168, def.name, {
          fontFamily: "Rajdhani, sans-serif",
          fontSize: "15px",
          color: "#f2e6d4",
          fontStyle: "700",
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(70, 188, def.role, {
          fontFamily: "Rajdhani, sans-serif",
          fontSize: "13px",
          color: "#3ee0c8",
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(70, 214, def.blurb, {
          fontFamily: "Rajdhani, sans-serif",
          fontSize: "11px",
          color: "#b0a89c",
          align: "center",
          wordWrap: { width: 124 },
        })
        .setOrigin(0.5),
    );
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      this.index = PLAYER_ORDER.indexOf(id);
      this.refresh();
      this.confirm();
    });
    return c;
  }

  private move(dir: number): void {
    audio.unlock();
    audio.uiClick();
    this.index = (this.index + dir + PLAYER_ORDER.length) % PLAYER_ORDER.length;
    this.refresh();
  }

  private refresh(): void {
    this.cards.forEach((c, i) => {
      const bg = c.getByName("bg") as Phaser.GameObjects.Rectangle;
      const on = i === this.index;
      bg.setStrokeStyle(on ? 3 : 2, on ? 0xffb347 : 0x6a5040);
      c.setScale(on ? 1.04 : 1);
      c.setAlpha(on ? 1 : 0.78);
    });
  }

  private confirm(): void {
    audio.unlock();
    audio.uiConfirm();
    this.registry.set("fighterId", PLAYER_ORDER[this.index]);
    this.scene.start("GameScene");
  }
}
