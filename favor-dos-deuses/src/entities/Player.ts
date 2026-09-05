import Phaser from "phaser";
import { PLAYER_CONFIG, TILE_SIZE } from "../data/constants";
import type { CombatEntity } from "../systems/CombatSystem";

export class Player implements CombatEntity {
  sprite: Phaser.GameObjects.Rectangle;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  lastAttackTime: number = 0;
  isInvincible: boolean = false;
  invincibleUntil: number = 0;
  faction: "player" = "player";

  private scene: Phaser.Scene;
  private isDodging: boolean = false;
  private dodgeDirection: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
  private dodgeEndTime: number = 0;
  private lastDodgeTime: number = 0;
  private facingAngle: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.maxHp = PLAYER_CONFIG.maxHp;
    this.hp = this.maxHp;
    this.damage = PLAYER_CONFIG.attackDamage;
    this.speed = PLAYER_CONFIG.speed;

    this.sprite = scene.add.rectangle(x, y, TILE_SIZE, TILE_SIZE * 1.2, 0x3498db);
    this.sprite.setDepth(10);
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: any, delta: number, now: number): void {
    if (this.isDodging) {
      this.updateDodge(delta, now);
      return;
    }

    let dx = 0;
    let dy = 0;

    if (cursors.left.isDown || wasd.A.isDown) dx -= 1;
    if (cursors.right.isDown || wasd.D.isDown) dx += 1;
    if (cursors.up.isDown || wasd.W.isDown) dy -= 1;
    if (cursors.down.isDown || wasd.S.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;

      this.facingAngle = Math.atan2(dy, dx);

      this.sprite.x += dx * this.speed * (delta / 1000);
      this.sprite.y += dy * this.speed * (delta / 1000);
    }
  }

  startDodge(now: number): boolean {
    if (now - this.lastDodgeTime < PLAYER_CONFIG.dodgeCooldown) {
      return false;
    }

    this.isDodging = true;
    this.lastDodgeTime = now;
    this.dodgeEndTime = now + PLAYER_CONFIG.dodgeDuration;
    this.isInvincible = true;
    this.invincibleUntil = now + PLAYER_CONFIG.dodgeDuration;

    this.dodgeDirection.set(
      Math.cos(this.facingAngle),
      Math.sin(this.facingAngle)
    );

    this.sprite.setAlpha(0.5);
    return true;
  }

  private updateDodge(delta: number, now: number): void {
    if (now >= this.dodgeEndTime) {
      this.isDodging = false;
      this.isInvincible = false;
      this.sprite.setAlpha(1);
      return;
    }

    const speed = PLAYER_CONFIG.dodgeSpeed;
    this.sprite.x += this.dodgeDirection.x * speed * (delta / 1000);
    this.sprite.y += this.dodgeDirection.y * speed * (delta / 1000);
  }

  canAttack(now: number): boolean {
    return now - this.lastAttackTime >= PLAYER_CONFIG.attackCooldown;
  }

  performAttack(now: number): void {
    this.lastAttackTime = now;

    const attackX = this.sprite.x + Math.cos(this.facingAngle) * PLAYER_CONFIG.attackRange;
    const attackY = this.sprite.y + Math.sin(this.facingAngle) * PLAYER_CONFIG.attackRange;

    const slash = this.scene.add.arc(attackX, attackY, 12, 0, 360, false, 0xffffff, 0.6);
    this.scene.tweens.add({
      targets: slash,
      scale: 1.5,
      alpha: 0,
      duration: 150,
      onComplete: () => slash.destroy(),
    });
  }

  getAttackPosition(): { x: number; y: number } {
    return {
      x: this.sprite.x + Math.cos(this.facingAngle) * PLAYER_CONFIG.attackRange,
      y: this.sprite.y + Math.sin(this.facingAngle) * PLAYER_CONFIG.attackRange,
    };
  }

  setPosition(x: number, y: number): void {
    this.sprite.x = x;
    this.sprite.y = y;
  }

  getPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  reset(): void {
    this.hp = this.maxHp;
    this.isDodging = false;
    this.isInvincible = false;
    this.sprite.setAlpha(1);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
