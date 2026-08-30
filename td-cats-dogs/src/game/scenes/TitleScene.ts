import Phaser from "phaser";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, "landing").setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x101018, 0.28);
    this.add.image(width / 2, height * 0.34, "logo").setScale(0.55);
    this.add.text(width / 2, height * 0.78, "Gatos armados seguram a linha", {
      fontFamily: '"Passion One", Impact, sans-serif',
      fontSize: "28px",
      color: "#fff4d6",
      stroke: "#2b1a10",
      strokeThickness: 5,
    }).setOrigin(0.5);
  }
}
