import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../data/constants";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { HubScene } from "./scenes/HubScene";
import { WildsScene } from "./scenes/WildsScene";
import { DungeonScene } from "./scenes/DungeonScene";
import { UnderworldScene } from "./scenes/UnderworldScene";

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, HubScene, WildsScene, DungeonScene, UnderworldScene],
    backgroundColor: "#0a0a12",
    audio: { noAudio: true },
  });
}
