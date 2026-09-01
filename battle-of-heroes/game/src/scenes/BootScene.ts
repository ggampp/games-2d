import Phaser from "phaser";
import { HEROES } from "../data/heroes";
import { audio } from "../audio/AudioManager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const barBg = this.add.rectangle(w / 2, h / 2, 420, 24, 0x3b2208);
    const bar = this.add.rectangle(w / 2 - 204, h / 2, 8, 16, 0xf2a33a).setOrigin(0, 0.5);
    this.add
      .text(w / 2, h / 2 - 48, "BATTLE OF HEROES", {
        fontFamily: "Passion One, Impact, sans-serif",
        fontSize: "42px",
        color: "#ffe27a",
      })
      .setOrigin(0.5);
    this.load.on("progress", (p: number) => {
      bar.width = 408 * p;
    });

    this.load.image("menu-bg", "assets/ui/Background-Screen-01.png");
    this.load.image("menu-bg-2", "assets/ui/Background-Screen-02.png");
    this.load.image("menu-bg-3", "assets/ui/Background-Screen-03.png");
    this.load.image("btn-orange", "assets/ui/Orange_btn.png");
    this.load.image("btn-orange-2", "assets/ui/Orange_btn2.png");
    this.load.image("btn-green", "assets/ui/Green_Btn1.png");
    this.load.image("btn-green-2", "assets/ui/Green_Btn2.png");
    this.load.image("close", "assets/ui/Close_btn.png");
    this.load.image("gold-bar", "assets/ui/GoldBar.png");
    this.load.image("gold-1", "assets/ui/Gold01.png");
    this.load.image("party-box", "assets/ui/Party_box.png");
    this.load.image("shop-box", "assets/ui/Shopping_Box.png");
    this.load.image("options-box", "assets/ui/Options_box.png");
    this.load.image("upgrade-box", "assets/ui/Upgrade_popUp_box.png");
    this.load.image("status-box", "assets/ui/Text_Status_box.png");
    this.load.image("empty-hero", "assets/ui/Heroes_empty_images.png");
    this.load.image("icon-heroes", "assets/ui/Heroes_icon.png");
    this.load.image("icon-map", "assets/ui/Map_icon.png");
    this.load.image("icon-shop", "assets/ui/Shop_icon.png");
    this.load.image("icon-opt", "assets/ui/Option_icon.png");
    this.load.image("icon-arena", "assets/ui/Arena_icon.png");
    this.load.image("vs", "assets/ui/Vs.png");
    this.load.image("hp-green", "assets/ui/Green_Bar.png");
    this.load.image("hp-green-bg", "assets/ui/Green_Bar_Bg.png");
    this.load.image("hp-red", "assets/ui/Red_Bar.png");
    this.load.image("hp-red-bg", "assets/ui/Red_Bar_Bg.png");
    this.load.image("map-bg", "assets/ui/LvlMap01.png");
    this.load.image("node-open", "assets/ui/LvlMapAvailable.png");
    this.load.image("node-lock", "assets/ui/LvlMapLock.png");
    this.load.image("stars-0", "assets/ui/LvlMap0Star.png");
    this.load.image("stars-1", "assets/ui/LvlMap1Star.png");
    this.load.image("stars-2", "assets/ui/LvlMap2Star.png");
    this.load.image("stars-3", "assets/ui/LvlMap3Star.png");

    for (let i = 1; i <= 5; i++) {
      this.load.image(`barrack-${i}`, `assets/barracks/Lvl${i}_ori.png`);
      for (let b = 1; b <= 4; b++) {
        const broken = i === 2 ? "Broken" : "broken";
        this.load.image(`barrack-${i}-d${b}`, `assets/barracks/Lvl${i}_${broken}${b}.png`);
      }
    }

    for (let i = 1; i <= 9; i++) {
      const id = String(i).padStart(2, "0");
      this.load.image(`bg${id}`, `assets/bg/bg${id}.png`);
      this.load.image(`sky${id}`, `assets/bg/sky${id}.png`);
    }

    for (const hero of HEROES) {
      this.load.atlas(hero.charKey, `assets/chars/${hero.charKey}.png`, `assets/chars/${hero.charKey}.json`);
      this.load.image(`icon-${hero.id}`, `assets/icons/${hero.iconFile}`);
    }

    for (let i = 1; i <= 4; i++) this.load.image(`proj-${i}`, `assets/projectiles/${i}.png`);
    this.load.atlas("fx01", "assets/fx/fx01.png", "assets/fx/fx01.json");
    this.load.atlas("fx02", "assets/fx/fx02.png", "assets/fx/fx02.json");
    this.load.atlas("fx03", "assets/fx/fx03.png", "assets/fx/fx03.json");
  }

  create(): void {
    audio.init();
    const make = (key: string, anim: string, count: number, fps: number, repeat: number) => {
      if (this.anims.exists(`${key}-${anim}`)) return;
      const frames = this.anims.generateFrameNames(key, {
        prefix: `${anim}_`,
        start: 0,
        end: Math.max(0, count - 1),
        zeroPad: 2,
      });
      if (!frames.length) return;
      this.anims.create({ key: `${key}-${anim}`, frames, frameRate: fps, repeat });
    };

    for (const hero of HEROES) {
      const tex = this.textures.get(hero.charKey);
      const names = tex.getFrameNames();
      const count = (prefix: string) => names.filter((n) => n.startsWith(`${prefix}_`)).length;
      make(hero.charKey, "idle", count("idle"), 10, -1);
      make(hero.charKey, "walk", count("walk"), 14, -1);
      make(hero.charKey, "attack", count("attack"), 16, 0);
      make(hero.charKey, "hit", count("hit"), 16, 0);
      make(hero.charKey, "death", count("death"), 14, 0);
    }

    for (const fx of ["fx01", "fx02", "fx03"] as const) {
      const names = this.textures.get(fx).getFrameNames();
      const n = names.filter((f) => f.startsWith("fx_")).length;
      this.anims.create({
        key: `${fx}-boom`,
        frames: this.anims.generateFrameNames(fx, { prefix: "fx_", start: 0, end: Math.max(0, n - 1), zeroPad: 2 }),
        frameRate: 18,
        repeat: 0,
      });
    }

    this.scene.start("menu");
  }
}
