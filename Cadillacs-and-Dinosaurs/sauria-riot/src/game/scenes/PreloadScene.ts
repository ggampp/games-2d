import Phaser from "phaser";
import { createFighterAnims, preloadFighterSheets } from "../render/sheetAnims.js";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const box = this.add.graphics();
    box.fillStyle(0x140c08, 0.9);
    box.fillRect(width / 2 - 160, height / 2 - 16, 320, 28);
    const bar = this.add.graphics();
    const label = this.add
      .text(width / 2, height / 2 - 36, "CARREGANDO SAURIA RIOT", {
        fontFamily: "Rajdhani, sans-serif",
        fontSize: "14px",
        color: "#ffb347",
      })
      .setOrigin(0.5);

    this.load.on("progress", (v: number) => {
      bar.clear();
      bar.fillStyle(0x3ee0c8, 1);
      bar.fillRect(width / 2 - 154, height / 2 - 10, 308 * v, 16);
    });
    this.load.on("complete", () => {
      bar.destroy();
      box.destroy();
      label.destroy();
    });

    const keys = ["title", "far", "mid", "ground", "rook", "vesper", "toro", "quinn", "ashjaw"];
    for (const k of keys) this.load.image(k, `/assets/${k}.jpg`);
    preloadFighterSheets(this);
  }

  create(): void {
    createFighterAnims(this);
    this.scene.start("MenuScene");
  }
}
