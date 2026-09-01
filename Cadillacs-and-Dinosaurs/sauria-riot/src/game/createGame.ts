import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js";
import { PreloadScene } from "./scenes/PreloadScene.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { SelectScene } from "./scenes/SelectScene.js";
import { GameScene } from "./scenes/GameScene.js";

export function createGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: 640,
    height: 360,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [BootScene, PreloadScene, MenuScene, SelectScene, GameScene],
    backgroundColor: "#0c0a10",
    input: { gamepad: true },
  };
  return new Phaser.Game(config);
}
