import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { MapScene } from "./scenes/MapScene";
import { HeroesScene } from "./scenes/HeroesScene";
import { ShopScene } from "./scenes/ShopScene";
import { OptionsScene } from "./scenes/OptionsScene";
import { BattleScene } from "./scenes/BattleScene";
import { audio } from "./audio/AudioManager";
import { loadSave } from "./save/SaveGame";

const save = loadSave();
audio.init();
audio.setMusic(save.music);
audio.setSfx(save.sfx);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1a120c",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  fps: { target: 60 },
  render: { pixelArt: false, antialias: true, roundPixels: false },
  scene: [BootScene, MenuScene, MapScene, HeroesScene, ShopScene, OptionsScene, BattleScene],
};

void new Phaser.Game(config);
