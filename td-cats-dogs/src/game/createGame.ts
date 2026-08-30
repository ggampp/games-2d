import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../systems/path.ts";
import { BootScene } from "./scenes/BootScene.ts";
import { PreloadScene } from "./scenes/PreloadScene.ts";
import { TitleScene } from "./scenes/TitleScene.ts";
import { BattleScene } from "./scenes/BattleScene.ts";

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, TitleScene, BattleScene],
    backgroundColor: "#1b140f",
    audio: { noAudio: false },
  });
}
