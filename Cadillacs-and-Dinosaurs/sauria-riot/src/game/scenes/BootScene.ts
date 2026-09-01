import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    // Assets needed for the loading bar can be loaded here
  }

  create(): void {
    this.scene.start("PreloadScene");
  }
}
