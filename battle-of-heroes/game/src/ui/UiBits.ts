import Phaser from "phaser";
import { audio } from "../audio/AudioManager";

export const FONT = "Passion One, Impact, sans-serif";
export const FONT_UI = "Squada One, Passion One, sans-serif";

export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  texture = "btn-orange",
  scale = 1.8,
): Phaser.GameObjects.Container {
  const img = scene.add.image(0, 0, texture).setScale(scale);
  const text = scene.add
    .text(0, -2, label, {
      fontFamily: FONT,
      fontSize: `${Math.round(22 * Math.min(scale, 2))}px`,
      color: "#3b2208",
    })
    .setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, img.displayWidth, img.displayHeight, 0x000000, 0).setInteractive({ useHandCursor: true });
  const c = scene.add.container(x, y, [img, text, hit]);
  hit.on("pointerover", () => img.setTint(0xffe0a0));
  hit.on("pointerout", () => img.clearTint());
  hit.on("pointerdown", () => {
    img.setTint(0xccaa66);
    scene.tweens.add({ targets: c, scale: 0.96, duration: 60, yoyo: true });
  });
  hit.on("pointerup", () => {
    img.clearTint();
    audio.click();
    onClick();
  });
  return c;
}

export function goldLabel(scene: Phaser.Scene, x: number, y: number, amount: number): Phaser.GameObjects.Container {
  const bar = scene.add.image(0, 0, "gold-bar").setScale(0.85);
  const text = scene.add
    .text(-28, -2, String(amount), {
      fontFamily: FONT,
      fontSize: "26px",
      color: "#fff4c8",
    })
    .setOrigin(0.5);
  text.setName("gold");
  return scene.add.container(x, y, [bar, text]);
}

export function setGoldLabel(c: Phaser.GameObjects.Container, amount: number): void {
  const t = c.getByName("gold") as Phaser.GameObjects.Text | null;
  if (t) t.setText(String(Math.floor(amount)));
}

export function titleText(scene: Phaser.Scene, x: number, y: number, text: string, size = 64): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: "#ffe27a",
      stroke: "#3b2208",
      strokeThickness: 8,
    })
    .setOrigin(0.5);
}
