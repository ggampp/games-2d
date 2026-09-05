import Phaser from "phaser";
import { PLAYER_CONFIG } from "../data/constants";
import type { BestowSystem } from "./BestowSystem";

export interface CombatEntity {
  sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  lastAttackTime: number;
  isInvincible: boolean;
  invincibleUntil: number;
  faction: "player" | "enemy";
}

export interface AttackResult {
  hit: boolean;
  damage: number;
  killed: boolean;
  target: CombatEntity;
}

export class CombatSystem {
  private scene: Phaser.Scene;
  private bestowSystem: BestowSystem | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setBestowSystem(bestowSystem: BestowSystem): void {
    this.bestowSystem = bestowSystem;
  }

  canAttack(entity: CombatEntity, now: number, cooldown: number): boolean {
    return now - entity.lastAttackTime >= cooldown;
  }

  performAttack(
    attacker: CombatEntity,
    targets: CombatEntity[],
    range: number,
    now: number
  ): AttackResult[] {
    const results: AttackResult[] = [];
    const attackerPos = attacker.sprite.getCenter();

    let baseDamage = attacker.damage;
    if (attacker.faction === "player" && this.bestowSystem) {
      baseDamage *= this.bestowSystem.getDamageMultiplier();
    }

    for (const target of targets) {
      if (target.faction === attacker.faction) continue;
      if (target.hp <= 0) continue;

      const targetPos = target.sprite.getCenter();
      const dist = Phaser.Math.Distance.Between(
        attackerPos.x,
        attackerPos.y,
        targetPos.x,
        targetPos.y
      );

      if (dist <= range) {
        const result = this.applyDamage(target, baseDamage, now);
        results.push(result);
      }
    }

    attacker.lastAttackTime = now;
    return results;
  }

  applyDamage(target: CombatEntity, rawDamage: number, now: number): AttackResult {
    if (target.isInvincible || now < target.invincibleUntil) {
      return { hit: false, damage: 0, killed: false, target };
    }

    let actualDamage = rawDamage;

    if (target.faction === "player" && this.bestowSystem) {
      const shield = this.bestowSystem.consumeShield(rawDamage);
      actualDamage = shield.remaining;
    }

    target.hp = Math.max(0, target.hp - actualDamage);

    this.flashDamage(target.sprite);

    if (target.faction === "player") {
      target.invincibleUntil = now + PLAYER_CONFIG.invincibilityDuration;
    }

    return {
      hit: true,
      damage: actualDamage,
      killed: target.hp <= 0,
      target,
    };
  }

  heal(target: CombatEntity, amount: number): void {
    target.hp = Math.min(target.maxHp, target.hp + amount);
  }

  private flashDamage(sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite): void {
    if ("setFillStyle" in sprite) {
      const rect = sprite as Phaser.GameObjects.Rectangle;
      const originalColor = (rect as any).fillColor ?? 0xffffff;
      rect.setFillStyle(0xff0000);
      this.scene.time.delayedCall(100, () => {
        rect.setFillStyle(originalColor);
      });
    } else if ("setTint" in sprite) {
      const spr = sprite as Phaser.GameObjects.Sprite;
      spr.setTint(0xff0000);
      this.scene.time.delayedCall(100, () => {
        spr.clearTint();
      });
    }
  }

  createHitEffect(x: number, y: number): void {
    const circle = this.scene.add.circle(x, y, 8, 0xffffff, 0.8);

    this.scene.tweens.add({
      targets: circle,
      scale: 2,
      alpha: 0,
      duration: 200,
      onComplete: () => circle.destroy(),
    });
  }

  checkCollision(
    entity: CombatEntity,
    others: CombatEntity[],
    radius: number
  ): CombatEntity | null {
    const pos = entity.sprite.getCenter();

    for (const other of others) {
      if (other === entity) continue;
      if (other.hp <= 0) continue;

      const otherPos = other.sprite.getCenter();
      const dist = Phaser.Math.Distance.Between(pos.x, pos.y, otherPos.x, otherPos.y);

      if (dist <= radius) {
        return other;
      }
    }

    return null;
  }

  moveToward(
    entity: CombatEntity,
    targetX: number,
    targetY: number,
    delta: number
  ): void {
    const pos = entity.sprite.getCenter();
    const angle = Phaser.Math.Angle.Between(pos.x, pos.y, targetX, targetY);

    let speed = entity.speed;
    if (entity.faction === "player" && this.bestowSystem) {
      speed *= this.bestowSystem.getSpeedMultiplier();
    }

    const dx = Math.cos(angle) * speed * (delta / 1000);
    const dy = Math.sin(angle) * speed * (delta / 1000);

    entity.sprite.x += dx;
    entity.sprite.y += dy;
  }
}
