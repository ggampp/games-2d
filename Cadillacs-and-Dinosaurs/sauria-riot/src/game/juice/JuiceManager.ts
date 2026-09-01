import Phaser from "phaser";

export class JuiceManager {
  public freeze = 0;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public screenShake(intensity = 0.006, duration = 110): void {
    this.scene.cameras.main.shake(duration, intensity);
  }

  public flash(color = 0xffffff, duration = 80): void {
    this.scene.cameras.main.flash(duration, (color >> 16) & 255, (color >> 8) & 255, color & 255, false);
  }

  public hitStop(durationMs = 55): void {
    this.freeze = Math.max(this.freeze, durationMs / 1000);
  }

  public tick(dt: number): number {
    if (this.freeze > 0) {
      this.freeze -= dt;
      return dt * 0.08;
    }
    return dt;
  }

  public sparks(x: number, y: number, dir: 1 | -1): void {
    for (let i = 0; i < 8; i++) {
      const g = this.scene.add.rectangle(x, y, 3, 3, i % 2 ? 0xfff2c8 : 0xff6a2a);
      g.setDepth(400);
      this.scene.tweens.add({
        targets: g,
        x: x + dir * (12 + Math.random() * 28),
        y: y - 8 - Math.random() * 22,
        alpha: 0,
        duration: 180 + Math.random() * 120,
        onComplete: () => g.destroy(),
      });
    }
  }

  public floatText(x: number, y: number, text: string, color = "#ffe07a"): void {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: "Rajdhani, sans-serif", fontSize: "14px", color, fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(500);
    this.scene.tweens.add({
      targets: t,
      y: y - 28,
      alpha: 0,
      duration: 520,
      ease: "Quad.easeOut",
      onComplete: () => t.destroy(),
    });
  }
}
