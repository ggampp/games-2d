import Phaser from "phaser";
import { audio } from "../../audio/GameAudio.js";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create(): void {
    const { width, height } = this.scale;
    if (this.textures.exists("title")) {
      this.add.image(width / 2, height / 2, "title").setDisplaySize(width, height).setAlpha(0.85);
    }
    this.add.rectangle(width / 2, height / 2, width, height, 0x07060a, 0.45);

    this.add
      .text(width / 2, 58, "SAURIA RIOT", {
        fontFamily: "Bungee, Impact, sans-serif",
        fontSize: "42px",
        color: "#ffb347",
        stroke: "#1a0c08",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 102, "FERRO E PRESAS", {
        fontFamily: "Rajdhani, sans-serif",
        fontSize: "18px",
        color: "#3ee0c8",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        168,
        "Yucca Prime, 2194. A Helix Dominion abriu o cofre errado.\nSaurianos de laboratório tomaram o cinturão de ferrugem.\nQuatro caçadores aceitam o contrato.",
        {
          fontFamily: "Rajdhani, sans-serif",
          fontSize: "15px",
          color: "#d7d0c4",
          align: "center",
          lineSpacing: 4,
        },
      )
      .setOrigin(0.5);

    const btn = this.add
      .text(width / 2, 248, "▶  SELECIONAR EQUIPE", {
        fontFamily: "Bungee, sans-serif",
        fontSize: "16px",
        color: "#140c08",
        backgroundColor: "#ffb347",
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on("pointerover", () => btn.setColor("#3ee0c8"));
    btn.on("pointerout", () => btn.setColor("#140c08"));
    btn.on("pointerdown", () => this.go());

    this.add
      .text(width / 2, 312, "Z / J  soco    X / K / Espaço  pulo    C / L / Shift  especial\nSetas ou WASD  mover (cima/baixo = profundidade)    Gamepad ok", {
        fontFamily: "Rajdhani, sans-serif",
        fontSize: "13px",
        color: "#9aa0a8",
        align: "center",
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown-ENTER", () => this.go());
    this.input.keyboard?.once("keydown-SPACE", () => this.go());
    this.game.events.emit("hud-hide");
  }

  private go(): void {
    audio.unlock();
    audio.uiConfirm();
    this.scene.start("SelectScene");
  }
}
