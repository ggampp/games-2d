import Phaser from "phaser";
import { addButton, goldLabel, setGoldLabel, titleText, FONT } from "../ui/UiBits";
import { loadSave, type SaveData } from "../save/SaveGame";
import { audio } from "../audio/AudioManager";

export class MenuScene extends Phaser.Scene {
  private save!: SaveData;

  constructor() {
    super("menu");
  }

  create(): void {
    this.save = loadSave();
    audio.init();
    audio.startMusic();
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, "menu-bg").setDisplaySize(w, h);

    titleText(this, w / 2, 92, "BATTLE OF HEROES", 70);
    this.add
      .text(w / 2, 148, "Escolha seu pelotão e derrube o quartel inimigo", {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#3b2208",
      })
      .setOrigin(0.5);

    const gold = goldLabel(this, w - 160, 48, this.save.gold);
    setGoldLabel(gold, this.save.gold);

    const items: { label: string; icon: string; go: string }[] = [
      { label: "CAMPANHA", icon: "icon-map", go: "map" },
      { label: "HERÓIS", icon: "icon-heroes", go: "heroes" },
      { label: "LOJA", icon: "icon-shop", go: "shop" },
      { label: "OPÇÕES", icon: "icon-opt", go: "options" },
    ];

    items.forEach((item, i) => {
      const x = w / 2 + ((i % 2) - 0.5) * 340;
      const y = 280 + Math.floor(i / 2) * 150;
      const icon = this.add.image(x, y - 18, item.icon).setScale(0.9);
      this.tweens.add({ targets: icon, y: y - 28, duration: 1400 + i * 120, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      addButton(this, x, y + 58, item.label, () => this.scene.start(item.go), "btn-orange", 2.1);
    });

    this.add
      .text(w / 2, h - 28, "Clique nos heróis na batalha para invocá-los  •  destrua o quartel", {
        fontFamily: FONT,
        fontSize: "18px",
        color: "#fff4c8",
        stroke: "#3b2208",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
  }
}
