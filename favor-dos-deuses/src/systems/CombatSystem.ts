import Phaser from "phaser";
import { DEPTH } from "../data/constants";
import type { BestowSystem } from "./BestowSystem";

export interface CombatEntity {
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  isInvincible: boolean;
  invincibleUntil: number;
  faction: "player" | "enemy";
}

export interface AttackResult {
  hit: boolean;
  damage: number;
  killed: boolean;
  blocked: boolean;
}

/**
 * Efeitos visuais e regras de dano compartilhadas.
 * Mantém o "game feel": hit-stop curto, números de dano, flash, knockback.
 */
export class CombatSystem {
  private scene: Phaser.Scene;
  private bestowSystem: BestowSystem | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setBestowSystem(bestowSystem: BestowSystem): void {
    this.bestowSystem = bestowSystem;
  }

  applyDamage(
    target: CombatEntity,
    rawDamage: number,
    now: number,
    invincibilityMs: number,
    source?: { x: number; y: number; knockback?: number }
  ): AttackResult {
    if (target.hp <= 0) return { hit: false, damage: 0, killed: false, blocked: false };
    if (target.isInvincible || now < target.invincibleUntil) {
      return { hit: false, damage: 0, killed: false, blocked: false };
    }

    let actualDamage = Math.round(rawDamage);
    let blocked = false;

    if (target.faction === "player" && this.bestowSystem) {
      const shield = this.bestowSystem.consumeShield(actualDamage);
      if (shield.absorbed > 0) {
        blocked = true;
        actualDamage = shield.remaining;
        this.showFloatingText(target.sprite.x, target.sprite.y - 24, "BLOQUEADO", "#f1c40f");
        this.createShieldBurst(target.sprite.x, target.sprite.y);
      }
    }

    target.hp = Math.max(0, target.hp - actualDamage);

    if (actualDamage > 0) {
      this.flashDamage(target.sprite);
      this.showFloatingText(
        target.sprite.x,
        target.sprite.y - 20,
        `-${actualDamage}`,
        target.faction === "player" ? "#ff6b6b" : "#ffffff"
      );
    }

    if (source && source.knockback && target.sprite.body) {
      const angle = Phaser.Math.Angle.Between(source.x, source.y, target.sprite.x, target.sprite.y);
      target.sprite.setVelocity(Math.cos(angle) * source.knockback, Math.sin(angle) * source.knockback);
    }

    if (invincibilityMs > 0) {
      target.invincibleUntil = now + invincibilityMs;
    }

    return { hit: true, damage: actualDamage, killed: target.hp <= 0, blocked };
  }

  heal(target: CombatEntity, amount: number): number {
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const healed = target.hp - before;
    if (healed > 0) {
      this.showFloatingText(target.sprite.x, target.sprite.y - 24, `+${healed}`, "#2ecc71");
      this.createHealBurst(target.sprite.x, target.sprite.y);
    }
    return healed;
  }

  private flashDamage(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      if (sprite.active) sprite.clearTint();
    });
  }

  /** Pausa o mundo por alguns ms — o "peso" do golpe */
  hitStop(ms: number = 45): void {
    const world = this.scene.physics.world;
    if (world.isPaused) return;
    world.pause();
    this.scene.time.delayedCall(ms, () => {
      if (this.scene.scene.isActive()) world.resume();
    });
  }

  showFloatingText(x: number, y: number, text: string, color: string): void {
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay);

    this.scene.tweens.add({
      targets: t,
      y: y - 26,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  createHitEffect(x: number, y: number, color: number = 0xffffff): void {
    const circle = this.scene.add.circle(x, y, 6, color, 0.9).setDepth(DEPTH.overlay);
    this.scene.tweens.add({
      targets: circle,
      scale: 2.4,
      alpha: 0,
      duration: 180,
      onComplete: () => circle.destroy(),
    });

    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = this.scene.add.rectangle(x, y, 3, 3, color).setDepth(DEPTH.overlay);
      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(a) * (14 + Math.random() * 14),
        y: y + Math.sin(a) * (14 + Math.random() * 14),
        alpha: 0,
        duration: 260,
        ease: "Cubic.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Arco do golpe do herói */
  createSlash(x: number, y: number, angle: number, range: number, color: number = 0xffffff): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.overlay);
    g.lineStyle(3, color, 0.9);
    g.beginPath();
    g.arc(x, y, range - 6, angle - 1.1, angle + 1.1, false);
    g.strokePath();
    g.lineStyle(1, color, 0.5);
    g.beginPath();
    g.arc(x, y, range - 12, angle - 0.9, angle + 0.9, false);
    g.strokePath();

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 140,
      onComplete: () => g.destroy(),
    });
  }

  private createShieldBurst(x: number, y: number): void {
    const ring = this.scene.add.circle(x, y, 14).setStrokeStyle(3, 0xf1c40f, 1).setDepth(DEPTH.overlay);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 350,
      onComplete: () => ring.destroy(),
    });
  }

  private createHealBurst(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const p = this.scene.add.circle(x + (Math.random() - 0.5) * 20, y + 10, 2, 0x2ecc71).setDepth(DEPTH.overlay);
      this.scene.tweens.add({
        targets: p,
        y: y - 20 - Math.random() * 12,
        alpha: 0,
        duration: 600 + Math.random() * 200,
        delay: i * 40,
        onComplete: () => p.destroy(),
      });
    }
  }
}
