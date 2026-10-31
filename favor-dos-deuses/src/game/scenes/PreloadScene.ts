import Phaser from "phaser";
import {
  ALL_CRAFTPIX_ASSETS,
  SUB_FRAMES,
  TORCH_VARIANTS,
  TORCH_FRAME_H,
  TORCH_FRAMES,
  assetTracker,
} from "../../data/assets";
import { GAME_WIDTH, GAME_HEIGHT } from "../../data/constants";
import { BOAR, WOLF, SKELETON, HARPY, SHADE, HERO_FALLBACK, type PixelSprite } from "../../data/pixelart";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;

    const track = this.add.rectangle(w / 2, h / 2, 320, 14, 0x1b1b2a).setStrokeStyle(1, 0x8b7355);
    const fill = this.add.rectangle(w / 2 - 158, h / 2, 2, 10, 0xf1c40f).setOrigin(0, 0.5);
    const text = this.add
      .text(w / 2, h / 2 - 34, "Invocando os deuses...", { fontSize: "18px", color: "#e8dcc0" })
      .setOrigin(0.5);

    this.load.on("progress", (v: number) => (fill.width = 316 * v));
    this.load.on("complete", () => {
      track.destroy();
      fill.destroy();
      text.destroy();
    });
    this.load.on("loaderror", (file: Phaser.Loader.File) => assetTracker.markFailed(file.key));

    for (const asset of ALL_CRAFTPIX_ASSETS) {
      if (asset.type === "spritesheet" && asset.frameWidth && asset.frameHeight) {
        this.load.spritesheet(asset.key, asset.path, {
          frameWidth: asset.frameWidth,
          frameHeight: asset.frameHeight,
        });
      } else {
        this.load.image(asset.key, asset.path);
      }
    }
  }

  create(): void {
    for (const asset of ALL_CRAFTPIX_ASSETS) {
      const ok =
        this.textures.exists(asset.key) &&
        (this.textures.get(asset.key).source[0]?.width ?? 0) > 1;
      if (ok) assetTracker.markLoaded(asset.key);
      else assetTracker.markFailed(asset.key);
    }

    this.createGeneratedTextures();
    this.createSubFrames();
    this.createAnimations();

    const failed = assetTracker.getFailed();
    if (failed.length > 0) {
      console.warn(`Assets CraftPix ausentes (${failed.length}) — usando fallback:`, failed.join(", "));
    }

    this.scene.start("TitleScene");
  }

  // ---------------------------------------------------------------- sprites gerados

  private createGeneratedTextures(): void {
    this.makePixelTexture("gen_boar", BOAR);
    this.makePixelTexture("gen_wolf", WOLF);
    this.makePixelTexture("gen_skeleton", SKELETON);
    this.makePixelTexture("gen_harpy", HARPY);
    this.makePixelTexture("gen_shade", SHADE);
    this.makePixelTexture("gen_hero", HERO_FALLBACK);

    // texturas utilitárias
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 8, 8);
    g.generateTexture("px", 8, 8);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture("dot", 16, 16);
    g.destroy();
  }

  private makePixelTexture(key: string, sprite: PixelSprite): void {
    const frames = sprite.frames;
    const fw = Math.max(...frames.map((f) => Math.max(...f.map((r) => r.length))));
    const fh = Math.max(...frames.map((f) => f.length));
    const canvas = this.textures.createCanvas(key, fw * frames.length, fh);
    if (!canvas) return;
    const ctx = canvas.getContext();

    frames.forEach((rows, fi) => {
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          const color = sprite.palette[ch];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(fi * fw + x, y, 1, 1);
        }
      });
      canvas.add(fi, 0, fi * fw, 0, fw, fh);
    });
    canvas.refresh();
  }

  // ---------------------------------------------------------------- recortes

  private createSubFrames(): void {
    for (const sf of SUB_FRAMES) {
      if (!assetTracker.isLoaded(sf.texture)) continue;
      const tex = this.textures.get(sf.texture);
      if (!tex.has(sf.name)) tex.add(sf.name, 0, sf.x, sf.y, sf.w, sf.h);
    }

    if (assetTracker.isLoaded("dungeon_torches")) {
      const tex = this.textures.get("dungeon_torches");
      TORCH_VARIANTS.forEach((v, vi) => {
        for (let f = 0; f < TORCH_FRAMES; f++) {
          tex.add(`t${vi}_${f}`, 0, v.x, f * TORCH_FRAME_H, v.w, TORCH_FRAME_H);
        }
      });
    }
  }

  // ---------------------------------------------------------------- animações

  private createAnimations(): void {
    const A = this.anims;

    // herói (cavaleiro da taverna: 10 frames x 2 linhas)
    if (assetTracker.hasHero()) {
      A.create({ key: "hero_idle", frames: A.generateFrameNumbers("hero", { start: 0, end: 9 }), frameRate: 6, repeat: -1 });
      A.create({ key: "hero_walk", frames: A.generateFrameNumbers("hero", { start: 10, end: 19 }), frameRate: 14, repeat: -1 });
    }

    // inimigos gerados
    const gen = (key: string, tex: string, rate: number) =>
      A.create({ key, frames: A.generateFrameNumbers(tex, { start: 0, end: 1 }), frameRate: rate, repeat: -1 });
    gen("boar_walk", "gen_boar", 6);
    gen("wolf_walk", "gen_wolf", 8);
    gen("skeleton_walk", "gen_skeleton", 5);
    gen("harpy_fly", "gen_harpy", 7);
    gen("gen_shade_float", "gen_shade", 3);

    // sombra (fantasma do pack): frames 1..3 são o fantasma "inteiro"
    if (assetTracker.isLoaded("ghost")) {
      A.create({
        key: "shade_float",
        frames: [1, 2, 3, 2].map((f) => ({ key: "ghost", frame: f })),
        frameRate: 5,
        repeat: -1,
      });
    } else {
      A.create({ key: "shade_float", frames: A.generateFrameNumbers("gen_shade", { start: 0, end: 1 }), frameRate: 3, repeat: -1 });
    }

    // tochas
    if (assetTracker.isLoaded("dungeon_torches")) {
      TORCH_VARIANTS.forEach((_, vi) => {
        A.create({
          key: `torch${vi}`,
          frames: Array.from({ length: TORCH_FRAMES }, (_, f) => ({ key: "dungeon_torches", frame: `t${vi}_${f}` })),
          frameRate: 8,
          repeat: -1,
        });
      });
    }

    if (assetTracker.isLoaded("statue_fire")) {
      A.create({ key: "statue_fire_anim", frames: A.generateFrameNumbers("statue_fire", { start: 0, end: 5 }), frameRate: 7, repeat: -1 });
    }

    if (assetTracker.isLoaded("spikes")) {
      A.create({
        key: "spikes_cycle",
        frames: [0, 0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 4, 3, 2, 1].map((f) => ({ key: "spikes", frame: f })),
        frameRate: 6,
        repeat: -1,
      });
    }

    // NPCs da vila
    if (assetTracker.isLoaded("npc_host")) {
      A.create({ key: "npc_host_anim", frames: A.generateFrameNumbers("npc_host", { start: 0, end: 5 }), frameRate: 5, repeat: -1 });
    }
    if (assetTracker.isLoaded("npc_lute")) {
      A.create({ key: "npc_lute_anim", frames: A.generateFrameNumbers("npc_lute", { start: 0, end: 5 }), frameRate: 6, repeat: -1 });
    }
    if (assetTracker.isLoaded("npc_watcher")) {
      A.create({ key: "npc_watcher_anim", frames: A.generateFrameNumbers("npc_watcher", { start: 0, end: 11 }), frameRate: 5, repeat: -1 });
    }
  }
}
