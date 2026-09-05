import Phaser from "phaser";
import type { EnemyConfig } from "../data/enemies";
import type { CombatEntity } from "../systems/CombatSystem";

export class Enemy implements CombatEntity {
  sprite: Phaser.GameObjects.Rectangle;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  lastAttackTime: number = 0;
  isInvincible: boolean = false;
  invincibleUntil: number = 0;
  faction: "enemy" = "enemy";

  readonly config: EnemyConfig;
  private scene: Phaser.Scene;
  private patrolTarget: Phaser.Math.Vector2 | null = null;
  private patrolOrigin: Phaser.Math.Vector2;
  private attackCooldown: number = 1000;
  private aggroRange: number = 150;
  private attackRange: number = 20;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
    this.scene = scene;
    this.config = config;
    this.maxHp = config.hp;
    this.hp = this.maxHp;
    this.damage = config.damage;
    this.speed = config.speed;
    this.patrolOrigin = new Phaser.Math.Vector2(x, y);

    this.sprite = scene.add.rectangle(x, y, config.size, config.size, config.color);
    this.sprite.setDepth(5);
  }

  update(
    playerX: number,
    playerY: number,
    delta: number,
    now: number
  ): { shouldAttack: boolean } {
    if (this.hp <= 0) {
      return { shouldAttack: false };
    }

    const distToPlayer = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      playerX,
      playerY
    );

    if (this.config.behavior === "stationary") {
      return { shouldAttack: distToPlayer <= this.attackRange && this.canAttack(now) };
    }

    if (this.config.behavior === "chase" || (this.config.behavior === "patrol" && distToPlayer < this.aggroRange)) {
      this.moveToward(playerX, playerY, delta);

      if (distToPlayer <= this.attackRange && this.canAttack(now)) {
        this.lastAttackTime = now;
        return { shouldAttack: true };
      }
    } else if (this.config.behavior === "patrol") {
      this.patrol(delta);
    }

    return { shouldAttack: false };
  }

  private moveToward(targetX: number, targetY: number, delta: number): void {
    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      targetX,
      targetY
    );

    const dx = Math.cos(angle) * this.speed * (delta / 1000);
    const dy = Math.sin(angle) * this.speed * (delta / 1000);

    this.sprite.x += dx;
    this.sprite.y += dy;
  }

  private patrol(delta: number): void {
    if (!this.patrolTarget || this.reachedPatrolTarget()) {
      this.pickNewPatrolTarget();
    }

    if (this.patrolTarget) {
      this.moveToward(this.patrolTarget.x, this.patrolTarget.y, delta);
    }
  }

  private reachedPatrolTarget(): boolean {
    if (!this.patrolTarget) return true;
    const dist = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      this.patrolTarget.x,
      this.patrolTarget.y
    );
    return dist < 10;
  }

  private pickNewPatrolTarget(): void {
    const range = 80;
    this.patrolTarget = new Phaser.Math.Vector2(
      this.patrolOrigin.x + Phaser.Math.Between(-range, range),
      this.patrolOrigin.y + Phaser.Math.Between(-range, range)
    );
  }

  private canAttack(now: number): boolean {
    return now - this.lastAttackTime >= this.attackCooldown;
  }

  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);

    this.sprite.setFillStyle(0xff0000);
    this.scene.time.delayedCall(100, () => {
      if (this.hp > 0) {
        this.sprite.setFillStyle(this.config.color);
      }
    });

    return this.hp <= 0;
  }

  die(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scale: 0.5,
      duration: 300,
      onComplete: () => this.sprite.destroy(),
    });
  }

  getPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
