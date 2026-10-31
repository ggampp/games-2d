import Phaser from "phaser";
import { PLAYER_CONFIG, DEPTH } from "../data/constants";
import { assetTracker } from "../data/assets";
import type { CombatEntity } from "../systems/CombatSystem";

export interface MoveInput {
  x: number;
  y: number;
}

export class Player implements CombatEntity {
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  isInvincible = false;
  invincibleUntil = 0;
  faction: "player" = "player";

  facing = new Phaser.Math.Vector2(0, 1);
  private lastAttackTime = -9999;
  private bufferedAttackAt = -9999;
  private isDodging = false;
  private dodgeEndTime = 0;
  private lastDodgeTime = -9999;
  private dodgeDir = new Phaser.Math.Vector2(0, 1);
  private scene: Phaser.Scene;
  private usesSheet: boolean;
  /** Bloqueio de controle (diálogos, transições) */
  controlsLocked = false;
  /** Efeito de cegueira/maldição ativo (só informativo para o HUD) */
  statusEffect: string | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.maxHp = PLAYER_CONFIG.maxHp;
    this.hp = this.maxHp;
    this.damage = PLAYER_CONFIG.attackDamage;
    this.speed = PLAYER_CONFIG.speed;
    this.usesSheet = assetTracker.hasHero();

    this.shadow = scene.add.ellipse(x, y + 1, 18, 8, 0x000000, 0.35).setDepth(DEPTH.shadow);

    const key = this.usesSheet ? "hero" : "gen_hero";
    this.sprite = scene.physics.add.sprite(x, y, key, 0);
    this.sprite.setOrigin(0.5, this.usesSheet ? 0.76 : 0.9);
    this.sprite.setDepth(DEPTH.ySortBase + y);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDrag(900, 900);
    this.sprite.setMaxVelocity(PLAYER_CONFIG.dodgeSpeed * 1.2);

    const r = PLAYER_CONFIG.bodyRadius;
    const fw = this.sprite.width;
    const fh = this.sprite.height;
    // corpo circular nos pés
    this.sprite.setCircle(r, fw / 2 - r, fh * this.sprite.originY - r);

    if (this.usesSheet) {
      this.sprite.play("hero_idle");
    }
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  update(input: MoveInput, now: number, speedMult: number): void {
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 1);
    this.sprite.setDepth(DEPTH.ySortBase + this.sprite.y);

    if (this.isInvincible && now >= this.invincibleUntil && !this.isDodging) {
      this.isInvincible = false;
    }

    // piscar durante invencibilidade pós-dano
    if (!this.isDodging && now < this.invincibleUntil) {
      this.sprite.setAlpha(Math.floor(now / 60) % 2 === 0 ? 0.45 : 1);
    } else if (!this.isDodging) {
      this.sprite.setAlpha(1);
    }

    if (this.isDodging) {
      if (now >= this.dodgeEndTime) {
        this.isDodging = false;
        this.isInvincible = false;
        this.sprite.setAlpha(1);
      } else {
        const v = PLAYER_CONFIG.dodgeSpeed;
        this.sprite.setVelocity(this.dodgeDir.x * v, this.dodgeDir.y * v);
        return;
      }
    }

    if (this.controlsLocked) {
      this.sprite.setVelocity(0, 0);
      this.playAnim("hero_idle");
      return;
    }

    const len = Math.hypot(input.x, input.y);
    if (len > 0) {
      const nx = input.x / len;
      const ny = input.y / len;
      this.facing.set(nx, ny);
      const v = this.speed * speedMult;
      this.sprite.setVelocity(nx * v, ny * v);
      if (nx !== 0) this.sprite.setFlipX(nx < 0);
      this.playAnim("hero_walk");
      if (!this.usesSheet) this.sprite.setScale(1, 1 + Math.sin(now / 60) * 0.06);
    } else {
      // deixa o drag frear (knockback continua suave)
      const b = this.sprite.body as Phaser.Physics.Arcade.Body;
      if (Math.abs(b.velocity.x) < 20 && Math.abs(b.velocity.y) < 20) {
        this.sprite.setVelocity(0, 0);
      }
      this.playAnim("hero_idle");
      if (!this.usesSheet) this.sprite.setScale(1, 1);
    }
  }

  private playAnim(key: string): void {
    if (!this.usesSheet) return;
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key, true);
  }

  /** Registra intenção de atacar; a cena decide quando executar (com buffer) */
  requestAttack(now: number): void {
    this.bufferedAttackAt = now;
  }

  wantsAttack(now: number): boolean {
    return now - this.bufferedAttackAt <= PLAYER_CONFIG.inputBuffer && !this.isDodging && !this.controlsLocked;
  }

  faceToward(x: number, y: number): void {
    const dx = x - this.sprite.x;
    const dy = y - this.sprite.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    this.facing.set(dx / len, dy / len);
    if (Math.abs(dx) > 2) this.sprite.setFlipX(dx < 0);
  }

  consumeAttack(now: number): boolean {
    const wantsAttack = now - this.bufferedAttackAt <= PLAYER_CONFIG.inputBuffer;
    if (!wantsAttack || this.isDodging || this.controlsLocked) return false;
    if (now - this.lastAttackTime < PLAYER_CONFIG.attackCooldown) return false;
    this.lastAttackTime = now;
    this.bufferedAttackAt = -9999;

    // pequeno impulso na direção do golpe
    this.sprite.setVelocity(this.facing.x * 60, this.facing.y * 60);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.sprite.flipX ? -1.12 : 1.12,
      scaleY: 0.92,
      duration: 60,
      yoyo: true,
      onComplete: () => this.sprite.setScale(1, 1),
    });
    return true;
  }

  startDodge(now: number, input: MoveInput): boolean {
    if (this.isDodging || this.controlsLocked) return false;
    if (now - this.lastDodgeTime < PLAYER_CONFIG.dodgeCooldown) return false;

    this.isDodging = true;
    this.lastDodgeTime = now;
    this.dodgeEndTime = now + PLAYER_CONFIG.dodgeDuration;
    this.isInvincible = true;
    this.invincibleUntil = now + PLAYER_CONFIG.dodgeDuration;

    const len = Math.hypot(input.x, input.y);
    if (len > 0) this.dodgeDir.set(input.x / len, input.y / len);
    else this.dodgeDir.copy(this.facing);

    this.sprite.setAlpha(0.55);

    // rastro
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 60, () => {
        if (!this.sprite.active) return;
        const ghost = this.scene.add
          .image(this.sprite.x, this.sprite.y, this.sprite.texture.key, this.sprite.frame.name)
          .setOrigin(this.sprite.originX, this.sprite.originY)
          .setFlipX(this.sprite.flipX)
          .setAlpha(0.35)
          .setTint(0x9fd8ff)
          .setDepth(this.sprite.depth - 1);
        this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
      });
    }
    return true;
  }

  getDodgeCooldownFraction(now: number): number {
    return Math.max(0, 1 - (now - this.lastDodgeTime) / PLAYER_CONFIG.dodgeCooldown);
  }

  getAttackAngle(): number {
    return Math.atan2(this.facing.y, this.facing.x);
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.shadow.setPosition(x, y + 1);
  }

  getPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
