import Phaser from "phaser";

export interface SheetClip {
  key: string;
  path: string;
  frames: number;
  fps: number;
  loop: boolean;
}

export interface SheetPack {
  id: string;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  clips: SheetClip[];
}

export const FIGHTER_SHEETS: Record<string, SheetPack> = {
  quinn: {
    id: "quinn",
    frameWidth: 128,
    frameHeight: 160,
    scale: 1.12,
    clips: [
      { key: "quinn-idle", path: "/assets/quinn/idle.png", frames: 8, fps: 8, loop: true },
      { key: "quinn-walk", path: "/assets/quinn/walk.png", frames: 10, fps: 10, loop: true },
      { key: "quinn-jump", path: "/assets/quinn/jump.png", frames: 8, fps: 12, loop: false },
      { key: "quinn-punch", path: "/assets/quinn/punch.png", frames: 8, fps: 14, loop: false },
      { key: "quinn-shoot", path: "/assets/quinn/shoot.png", frames: 8, fps: 12, loop: false },
      { key: "quinn-down", path: "/assets/quinn/down.png", frames: 1, fps: 1, loop: false },
    ],
  },
  rook: {
    id: "rook",
    frameWidth: 144,
    frameHeight: 176,
    scale: 1.05,
    clips: [
      { key: "rook-idle", path: "/assets/rook/idle.png", frames: 8, fps: 8, loop: true },
      { key: "rook-walk", path: "/assets/rook/walk.png", frames: 10, fps: 10, loop: true },
      { key: "rook-run", path: "/assets/rook/run.png", frames: 8, fps: 12, loop: true },
      { key: "rook-jump", path: "/assets/rook/jump.png", frames: 6, fps: 12, loop: false },
      { key: "rook-punch", path: "/assets/rook/punch.png", frames: 8, fps: 14, loop: false },
      { key: "rook-punch2", path: "/assets/rook/punch2.png", frames: 8, fps: 14, loop: false },
      { key: "rook-down", path: "/assets/rook/down.png", frames: 1, fps: 1, loop: false },
    ],
  },
};

export function preloadFighterSheets(scene: Phaser.Scene): void {
  for (const pack of Object.values(FIGHTER_SHEETS)) {
    for (const clip of pack.clips) {
      scene.load.spritesheet(clip.key, clip.path, {
        frameWidth: pack.frameWidth,
        frameHeight: pack.frameHeight,
      });
    }
  }
}

export function createFighterAnims(scene: Phaser.Scene): void {
  for (const pack of Object.values(FIGHTER_SHEETS)) {
    for (const clip of pack.clips) {
      if (scene.anims.exists(clip.key)) continue;
      scene.anims.create({
        key: clip.key,
        frames: scene.anims.generateFrameNumbers(clip.key, { start: 0, end: clip.frames - 1 }),
        frameRate: clip.fps,
        repeat: clip.loop ? -1 : 0,
      });
    }
  }
}

export function fighterSheetKey(id: string, state: string, combo = 0): string {
  const p = `${id}-`;
  switch (state) {
    case "walk":
      return `${p}walk`;
    case "jump":
    case "jumpAttack":
      return `${p}jump`;
    case "attack":
      if (combo >= 1 && id === "rook") return `${p}punch2`;
      return `${p}punch`;
    case "special":
      return id === "quinn" ? `${p}shoot` : id === "rook" ? `${p}punch2` : `${p}punch`;
    case "shoot":
      return id === "quinn" ? `${p}shoot` : `${p}punch`;
    case "down":
    case "dead":
      return `${p}down`;
    default:
      return `${p}idle`;
  }
}

export function isLoopingSheet(key: string): boolean {
  return key.endsWith("-idle") || key.endsWith("-walk") || key.endsWith("-run");
}
