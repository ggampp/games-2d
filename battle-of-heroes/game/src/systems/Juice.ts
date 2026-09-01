import Phaser from "phaser";

export class Juice {
  private freezeMs = 0;
  private shakeMs = 0;
  private shakeMag = 0;

  hitStop(ms = 45): void {
    this.freezeMs = Math.max(this.freezeMs, ms);
  }

  shake(ms = 160, mag = 6): void {
    this.shakeMs = Math.max(this.shakeMs, ms);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  update(scene: Phaser.Scene, dt: number): number {
    const cam = scene.cameras.main;
    if (this.shakeMs > 0) {
      this.shakeMs -= dt;
      const t = Math.max(0, this.shakeMs / 160);
      cam.setScroll((Math.random() - 0.5) * this.shakeMag * t, (Math.random() - 0.5) * this.shakeMag * t);
      if (this.shakeMs <= 0) cam.setScroll(0, 0);
    }
    if (this.freezeMs > 0) {
      this.freezeMs -= dt;
      return 0;
    }
    return dt;
  }

  flash(scene: Phaser.Scene, x: number, y: number, color = 0xffee88): void {
    const g = scene.add.circle(x, y, 10, color, 0.9).setDepth(40);
    scene.tweens.add({
      targets: g,
      scale: 2.4,
      alpha: 0,
      duration: 180,
      onComplete: () => g.destroy(),
    });
  }

  floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = "#ffe27a"): void {
    const t = scene.add
      .text(x, y, text, {
        fontFamily: "Passion One, Impact, sans-serif",
        fontSize: "22px",
        color,
        stroke: "#3b2208",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(50);
    scene.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 520,
      onComplete: () => t.destroy(),
    });
  }
}
