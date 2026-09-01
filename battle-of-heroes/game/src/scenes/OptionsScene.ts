import Phaser from "phaser";
import { addButton, titleText, FONT } from "../ui/UiBits";
import { loadSave, resetSave, writeSave, type SaveData } from "../save/SaveGame";
import { audio } from "../audio/AudioManager";

export class OptionsScene extends Phaser.Scene {
  private save!: SaveData;

  constructor() {
    super("options");
  }

  create(): void {
    this.save = loadSave();
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, "menu-bg").setDisplaySize(w, h);
    this.add.image(w / 2, h / 2, "options-box").setDisplaySize(640, 420);
    titleText(this, w / 2, 180, "OPÇÕES", 48);
    addButton(this, 90, 40, "VOLTAR", () => this.scene.start("menu"), "btn-orange", 1.4);

    this.slider(w / 2 - 160, 280, "MÚSICA", this.save.music, (v) => {
      this.save.music = v;
      audio.setMusic(v);
      writeSave(this.save);
    });
    this.slider(w / 2 - 160, 350, "EFEITOS", this.save.sfx, (v) => {
      this.save.sfx = v;
      audio.setSfx(v);
      writeSave(this.save);
    });

    addButton(this, w / 2, 460, "NOVO JOGO", () => {
      this.save = resetSave();
      audio.setMusic(this.save.music);
      audio.setSfx(this.save.sfx);
      this.scene.start("menu");
    }, "btn-orange-2", 2);
  }

  private slider(x: number, y: number, label: string, value: number, onChange: (v: number) => void): void {
    this.add.text(x, y - 28, label, { fontFamily: FONT, fontSize: "22px", color: "#fff4c8" });
    const track = this.add.rectangle(x + 160, y, 280, 12, 0x3b2208).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    const fill = this.add.rectangle(x + 160, y, 280 * value, 12, 0xf2a33a).setOrigin(0, 0.5);
    const apply = (pointer: Phaser.Input.Pointer) => {
      const local = Phaser.Math.Clamp((pointer.worldX - (x + 160)) / 280, 0, 1);
      fill.width = 280 * local;
      onChange(local);
      audio.click();
    };
    track.on("pointerdown", apply);
    track.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown) apply(p);
    });
  }
}
