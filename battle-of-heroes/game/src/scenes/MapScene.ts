import Phaser from "phaser";
import { STAGES } from "../data/stages";
import { addButton, goldLabel, setGoldLabel, titleText, FONT } from "../ui/UiBits";
import { isStageOpen, loadSave, type SaveData } from "../save/SaveGame";
import { audio } from "../audio/AudioManager";

export class MapScene extends Phaser.Scene {
  private save!: SaveData;

  constructor() {
    super("map");
  }

  create(): void {
    this.save = loadSave();
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, "map-bg").setDisplaySize(w, h);
    titleText(this, w / 2, 40, "CAMPANHA", 48);
    const gold = goldLabel(this, w - 160, 40, this.save.gold);
    setGoldLabel(gold, this.save.gold);
    addButton(this, 90, 40, "VOLTAR", () => this.scene.start("menu"), "btn-orange", 1.4);

    STAGES.forEach((stage) => {
      const x = stage.mapX * w;
      const y = stage.mapY * h;
      const open = isStageOpen(this.save, stage.id);
      const stars = this.save.stars[stage.id - 1] ?? 0;
      const node = this.add
        .image(x, y, open ? "node-open" : "node-lock")
        .setScale(open ? 2.4 : 2.1)
        .setInteractive({ useHandCursor: open });
      if (open) {
        node.on("pointerover", () => node.setScale(2.7));
        node.on("pointerout", () => node.setScale(2.4));
        node.on("pointerup", () => {
          audio.click();
          this.scene.start("battle", { stageId: stage.id });
        });
        if (stars > 0) this.add.image(x, y - 28, `stars-${stars}`).setScale(1.6);
      }
      this.add
        .text(x, y + 28, String(stage.id), {
          fontFamily: FONT,
          fontSize: "18px",
          color: "#3b2208",
          stroke: "#ffe27a",
          strokeThickness: 4,
        })
        .setOrigin(0.5);
    });
  }
}
