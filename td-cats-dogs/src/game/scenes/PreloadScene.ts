import Phaser from "phaser";
import { allSliceFrames, SLICE_CATS, UI } from "../../data/kit.ts";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor("#101018");
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2, height / 2, 40, 18, 0x8fd15a).setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      bar.width = 80 + 420 * value;
    });

    this.load.image("area", UI.area);
    this.load.image("landing", UI.landing);
    this.load.image("logo", UI.logo);
    this.load.image("coin-icon", UI.coin);
    this.load.image("btn-green", UI.btnGreen);
    this.load.image("bullet", UI.bullet);
    for (const frame of allSliceFrames()) {
      this.load.image(frame.key, frame.url);
    }
  }

  create(): void {
    for (const id of SLICE_CATS) {
      this.anims.create({
        key: `c${id}-idle`,
        frames: Array.from({ length: 20 }, (_, i) => ({ key: `c${id}-idle-${i}` })),
        frameRate: 12,
        repeat: -1,
      });
      this.anims.create({
        key: `c${id}-shoot`,
        frames: Array.from({ length: 10 }, (_, i) => ({ key: `c${id}-shoot-${i}` })),
        frameRate: 18,
        repeat: 0,
      });
    }
    this.anims.create({
      key: "enemy-reg-1-walk",
      frames: Array.from({ length: 35 }, (_, i) => ({ key: `enemy-reg-1-walk-${i}` })),
      frameRate: 20,
      repeat: -1,
    });
    this.anims.create({
      key: "enemy-reg-2-walk",
      frames: Array.from({ length: 35 }, (_, i) => ({ key: `enemy-reg-2-walk-${i}` })),
      frameRate: 20,
      repeat: -1,
    });
    this.anims.create({
      key: "enemy-boss-1-walk",
      frames: Array.from({ length: 35 }, (_, i) => ({ key: `enemy-boss-1-walk-${i}` })),
      frameRate: 18,
      repeat: -1,
    });
    this.anims.create({
      key: "muzzle-play",
      frames: Array.from({ length: 15 }, (_, i) => ({ key: `muzzle-${i}` })),
      frameRate: 28,
      repeat: 0,
    });
    this.anims.create({
      key: "boom-play",
      frames: Array.from({ length: 20 }, (_, i) => ({ key: `boom-${i}` })),
      frameRate: 24,
      repeat: 0,
    });
    this.scene.start("TitleScene");
  }
}
