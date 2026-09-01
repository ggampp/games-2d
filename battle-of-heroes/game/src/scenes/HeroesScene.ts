import Phaser from "phaser";
import { HEROES, getHero } from "../data/heroes";
import { addButton, goldLabel, setGoldLabel, titleText, FONT } from "../ui/UiBits";
import { heroLevel, loadSave, writeSave, type SaveData } from "../save/SaveGame";
import { audio } from "../audio/AudioManager";

export class HeroesScene extends Phaser.Scene {
  private save!: SaveData;
  private preview?: Phaser.GameObjects.Sprite;
  private info?: Phaser.GameObjects.Text;
  private partyIcons: Phaser.GameObjects.Image[] = [];

  constructor() {
    super("heroes");
  }

  create(): void {
    this.save = loadSave();
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, "menu-bg-2").setDisplaySize(w, h);
    titleText(this, w / 2, 36, "HERÓIS", 46);
    addButton(this, 90, 36, "VOLTAR", () => this.scene.start("menu"), "btn-orange", 1.4);
    const gold = goldLabel(this, w - 160, 36, this.save.gold);
    setGoldLabel(gold, this.save.gold);

    this.add.image(210, 400, "party-box").setDisplaySize(280, 500).setAlpha(0.95);
    this.add
      .text(210, 168, "PELOTÃO", { fontFamily: FONT, fontSize: "26px", color: "#fff4c8" })
      .setOrigin(0.5);

    HEROES.forEach((hero, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 520 + col * 140;
      const y = 150 + row * 130;
      const unlocked = this.save.unlocked.includes(hero.id);
      const icon = this.add
        .image(x, y, `icon-${hero.id}`)
        .setScale(0.72)
        .setInteractive({ useHandCursor: true });
      if (!unlocked) icon.setTint(0x444444);
      const inParty = this.save.party.includes(hero.id);
      const ring = this.add.circle(x, y, 54, inParty ? 0xf2a33a : 0x000000, inParty ? 0.35 : 0);
      icon.on("pointerup", () => this.onHero(hero.id, ring, icon));
      this.add
        .text(x, y + 48, hero.name, {
          fontFamily: FONT,
          fontSize: "16px",
          color: "#fff4c8",
          stroke: "#3b2208",
          strokeThickness: 4,
        })
        .setOrigin(0.5);
    });

    this.preview = this.add.sprite(210, 500, "char14", "idle_00").setScale(1.05).setOrigin(0.5, 1);
    this.preview.play("char14-idle");
    this.info = this.add
      .text(210, 518, "", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#fff4c8",
        align: "center",
        wordWrap: { width: 240 },
      })
      .setOrigin(0.5, 0);
    this.refreshParty();
    this.showHero(this.save.party[0] ?? 14);
  }

  private onHero(id: number, ring: Phaser.GameObjects.Arc, icon: Phaser.GameObjects.Image): void {
    audio.click();
    const unlocked = this.save.unlocked.includes(id);
    this.showHero(id);
    if (!unlocked) {
      audio.deny();
      return;
    }
    const idx = this.save.party.indexOf(id);
    if (idx >= 0) {
      if (this.save.party.length <= 1) return;
      this.save.party.splice(idx, 1);
      ring.setFillStyle(0x000000, 0);
    } else if (this.save.party.length < 5) {
      this.save.party.push(id);
      ring.setFillStyle(0xf2a33a, 0.35);
    } else {
      this.save.party[4] = id;
    }
    writeSave(this.save);
    this.refreshParty();
    icon.setScale(0.82);
    this.tweens.add({ targets: icon, scale: 0.72, duration: 120 });
  }

  private showHero(id: number): void {
    const hero = getHero(id);
    const lv = heroLevel(this.save, id);
    if (this.preview) {
      this.preview.setTexture(hero.charKey);
      this.preview.play(`${hero.charKey}-idle`);
    }
    if (this.info) {
      this.info.setText(
        `${hero.name}  Nv.${lv}\n${hero.title}\n${hero.role.toUpperCase()}  ${hero.cost}g\nHP ${hero.hp}  ATK ${hero.atk}  DEF ${hero.def}`,
      );
    }
  }

  private refreshParty(): void {
    this.partyIcons.forEach((i) => i.destroy());
    this.partyIcons = [];
    for (let i = 0; i < 5; i++) {
      const id = this.save.party[i];
      const img = this.add.image(114 + i * 48, 214, id ? `icon-${id}` : "empty-hero").setScale(0.34);
      this.partyIcons.push(img);
    }
  }
}
