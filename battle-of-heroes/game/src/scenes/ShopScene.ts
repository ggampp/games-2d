import Phaser from "phaser";
import { HEROES, getHero } from "../data/heroes";
import { BARRACKS_UPGRADE } from "../data/stages";
import { addButton, goldLabel, setGoldLabel, titleText, FONT } from "../ui/UiBits";
import { heroLevel, loadSave, writeSave, type SaveData } from "../save/SaveGame";
import { audio } from "../audio/AudioManager";

export class ShopScene extends Phaser.Scene {
  private save!: SaveData;
  private goldUi!: Phaser.GameObjects.Container;
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super("shop");
  }

  create(): void {
    this.save = loadSave();
    const { width: w, height: h } = this.scale;
    this.add.image(w / 2, h / 2, "menu-bg-3").setDisplaySize(w, h);
    titleText(this, w / 2, 36, "LOJA", 46);
    addButton(this, 90, 36, "VOLTAR", () => this.scene.start("menu"), "btn-orange", 1.4);
    this.goldUi = goldLabel(this, w - 160, 36, this.save.gold);
    this.add.image(w / 2, 150, "shop-box").setDisplaySize(820, 150).setAlpha(0.92);

    this.status = this.add
      .text(w / 2, 148, this.barracksText(), {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#3b2208",
        align: "center",
      })
      .setOrigin(0.5);

    addButton(this, w / 2 + 280, 150, "MELHORAR", () => this.upgradeBarracks(), "btn-green", 1.6);

    this.add
      .text(w / 2, 250, "Contratar heróis e treinar o pelotão", {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#3b2208",
      })
      .setOrigin(0.5);

    HEROES.forEach((hero, i) => {
      const col = i % 10;
      const row = Math.floor(i / 10);
      const x = 90 + col * 120;
      const y = 330 + row * 170;
      const unlocked = this.save.unlocked.includes(hero.id);
      const icon = this.add.image(x, y, `icon-${hero.id}`).setScale(0.62).setInteractive({ useHandCursor: true });
      if (!unlocked) icon.setTint(0x555555);
      const lv = heroLevel(this.save, hero.id);
      const label = unlocked ? `Nv.${lv}  ${80 * lv}g` : `${hero.shopCost || 0}g`;
      this.add
        .text(x, y + 48, hero.name, {
          fontFamily: FONT,
          fontSize: "14px",
          color: "#fff4c8",
          stroke: "#3b2208",
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      const btn = addButton(
        this,
        x,
        y + 82,
        unlocked ? "TREINAR" : "CONTRATAR",
        () => this.buyHero(hero.id, icon),
        unlocked ? "btn-green" : "btn-orange",
        1.15,
      );
      if (unlocked && hero.shopCost === 0 && lv >= 8) btn.setAlpha(0.5);
      this.add.text(x, y + 108, label, { fontFamily: FONT, fontSize: "14px", color: "#3b2208" }).setOrigin(0.5);
    });
  }

  private barracksText(): string {
    const next = BARRACKS_UPGRADE[this.save.barracksLevel];
    if (!next) return `Quartel Nv.${this.save.barracksLevel}  (máximo)`;
    return `Quartel Nv.${this.save.barracksLevel}  →  Nv.${next.level}   ${next.cost}g`;
  }

  private upgradeBarracks(): void {
    const next = BARRACKS_UPGRADE[this.save.barracksLevel];
    if (!next) {
      audio.deny();
      return;
    }
    if (this.save.gold < next.cost) {
      audio.deny();
      return;
    }
    this.save.gold -= next.cost;
    this.save.barracksLevel = next.level;
    writeSave(this.save);
    setGoldLabel(this.goldUi, this.save.gold);
    this.status.setText(this.barracksText());
    audio.spawn();
  }

  private buyHero(id: number, icon: Phaser.GameObjects.Image): void {
    const hero = getHero(id);
    const unlocked = this.save.unlocked.includes(id);
    if (!unlocked) {
      if (hero.shopCost <= 0) return;
      if (this.save.gold < hero.shopCost) {
        audio.deny();
        return;
      }
      this.save.gold -= hero.shopCost;
      this.save.unlocked.push(id);
      icon.clearTint();
    } else {
      const lv = heroLevel(this.save, id);
      const cost = 80 * lv;
      if (lv >= 8 || this.save.gold < cost) {
        audio.deny();
        return;
      }
      this.save.gold -= cost;
      this.save.heroLevels[String(id)] = lv + 1;
    }
    writeSave(this.save);
    setGoldLabel(this.goldUi, this.save.gold);
    audio.spawn();
    this.tweens.add({ targets: icon, scale: 0.75, duration: 80, yoyo: true });
  }
}
