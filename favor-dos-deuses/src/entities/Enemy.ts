import Phaser from "phaser";
import type { EnemyConfig } from "../data/enemies";
import { DEPTH } from "../data/constants";
import { assetTracker } from "../data/assets";
import type { CombatEntity } from "../systems/CombatSystem";

type EnemyState = "idle" | "patrol" | "chase" | "windup" | "recover" | "dead";

export interface EnemyUpdateResult {
  /** O inimigo acabou de desferir o golpe neste frame */
  attackLanded: boolean;
}

export class Enemy implements CombatEntity {
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  isInvincible = false;
  invincibleUntil = 0;
  faction: "enemy" = "enemy";

  readonly config: EnemyConfig;
  state: EnemyState = "idle";

  private scene: Phaser.Scene;
  private origin: Phaser.Math.Vector2;
  private patrolTarget: Phaser.Math.Vector2 | null = null;
  private patrolWaitUntil = 0;
  private stateUntil = 0;
  private lastAttackTime = -9999;
  private hpBar: Phaser.GameObjects.Graphics;
  private hpBarVisibleUntil = 0;
  private alertIcon: Phaser.GameObjects.Text;
  private usesSheet: boolean;
  private stunnedUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
    this.scene = scene;
    this.config = config;
    this.maxHp = config.hp;
    this.hp = this.maxHp;
    this.damage = config.damage;
    this.speed = config.speed;
    this.origin = new Phaser.Math.Vector2(x, y);

    const wantsSheet = !config.sprite.key.startsWith("gen_");
    this.usesSheet = wantsSheet ? assetTracker.isLoaded(config.sprite.key) : true;
    const key = this.usesSheet ? config.sprite.key : `gen_${config.id === "erebos_shade" ? "shade" : config.id}`;
    const textureKey = scene.textures.exists(key) ? key : "gen_shade";

    this.shadow = scene.add.ellipse(x, y + 1, config.bodyRadius * 2.2, config.bodyRadius, 0x000000, 0.3).setDepth(DEPTH.shadow);

    this.sprite = scene.physics.add.sprite(x, y, textureKey, 0);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDrag(600, 600);
    this.sprite.setBounce(0.1);

    const isGhost = textureKey === "ghost";
    if (isGhost) {
      // frame 64x64, fantasma ocupa o meio-baixo do frame
      this.sprite.setOrigin(0.5, 0.72);
      this.sprite.setScale(config.sprite.scale ?? 0.9);
    } else {
      this.sprite.setOrigin(0.5, 0.85);
    }
    if (config.sprite.tint) this.sprite.setTint(config.sprite.tint);

    const r = config.bodyRadius;
    const fw = this.sprite.width;
    const fh = this.sprite.height;
    const sc = this.sprite.scaleX;
    this.sprite.setCircle(r / sc, fw / 2 - r / sc, fh * this.sprite.originY - r / sc);
    this.sprite.setDepth(DEPTH.ySortBase + y);

    const anim = config.sprite.anim;
    if (anim && scene.anims.exists(anim) && (this.usesSheet || !wantsSheet)) {
      this.sprite.play({ key: anim, startFrame: Phaser.Math.Between(0, 1) });
    }

    this.hpBar = scene.add.graphics().setDepth(DEPTH.overlay - 1).setVisible(false);
    this.alertIcon = scene.add
      .text(x, y - 30, "!", { fontSize: "16px", fontStyle: "bold", color: "#ff4444", stroke: "#000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay)
      .setVisible(false);

    if (config.behavior === "patrol") this.state = "patrol";
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  update(playerX: number, playerY: number, now: number, playerAlive: boolean): EnemyUpdateResult {
    const result: EnemyUpdateResult = { attackLanded: false };
    if (this.state === "dead") return result;

    this.shadow.setPosition(this.sprite.x, this.sprite.y + 1);
    this.sprite.setDepth(DEPTH.ySortBase + this.sprite.y);
    this.alertIcon.setPosition(this.sprite.x, this.sprite.y - 30);
    this.drawHpBar(now);

    if (now < this.stunnedUntil) {
      return result;
    }

    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerX, playerY);
    const distHome = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.origin.x, this.origin.y);

    switch (this.state) {
      case "idle":
      case "patrol": {
        if (playerAlive && dist <= this.config.aggroRange) {
          this.enterChase(now);
          break;
        }
        if (this.state === "patrol") this.patrol(now);
        else this.sprite.setVelocity(0, 0);
        break;
      }
      case "chase": {
        if (!playerAlive || dist > this.config.aggroRange * 1.8 || distHome > this.config.aggroRange * 2.5) {
          this.state = this.config.behavior === "patrol" ? "patrol" : "idle";
          this.patrolTarget = null;
          break;
        }
        if (dist <= this.config.attackRange && now - this.lastAttackTime >= this.config.attackCooldown) {
          this.state = "windup";
          this.stateUntil = now + this.config.windup;
          this.sprite.setVelocity(0, 0);
          this.alertIcon.setVisible(true);
          this.sprite.setTint(0xffaaaa);
          this.scene.tweens.add({ targets: this.alertIcon, scale: { from: 0.6, to: 1.2 }, duration: 150, yoyo: true });
          break;
        }
        this.moveToward(playerX, playerY, this.speed);
        break;
      }
      case "windup": {
        this.sprite.setVelocity(0, 0);
        if (now >= this.stateUntil) {
          this.alertIcon.setVisible(false);
          this.applyBaseTint();
          this.lastAttackTime = now;
          this.state = "recover";
          this.stateUntil = now + 350;

          // avanço curto do golpe
          const a = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, playerX, playerY);
          this.sprite.setVelocity(Math.cos(a) * 150, Math.sin(a) * 150);

          if (dist <= this.config.attackRange + 14) {
            result.attackLanded = true;
          }
        }
        break;
      }
      case "recover": {
        if (now >= this.stateUntil) this.state = "chase";
        break;
      }
    }

    // vira para o lado que anda
    const vx = (this.sprite.body as Phaser.Physics.Arcade.Body).velocity.x;
    if (Math.abs(vx) > 5) this.sprite.setFlipX(vx < 0);

    return result;
  }

  private enterChase(now: number): void {
    this.state = "chase";
    this.alertIcon.setVisible(true);
    this.scene.time.delayedCall(400, () => {
      if (this.state !== "windup") this.alertIcon.setVisible(false);
    });
    this.hpBarVisibleUntil = now + 1500;
  }

  private moveToward(tx: number, ty: number, speed: number): void {
    const a = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, tx, ty);
    this.sprite.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
  }

  private patrol(now: number): void {
    if (now < this.patrolWaitUntil) {
      this.sprite.setVelocity(0, 0);
      return;
    }
    if (!this.patrolTarget) {
      const range = 70;
      this.patrolTarget = new Phaser.Math.Vector2(
        this.origin.x + Phaser.Math.Between(-range, range),
        this.origin.y + Phaser.Math.Between(-range, range)
      );
    }
    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.patrolTarget.x, this.patrolTarget.y);
    if (d < 8) {
      this.patrolTarget = null;
      this.patrolWaitUntil = now + Phaser.Math.Between(600, 1800);
      this.sprite.setVelocity(0, 0);
      return;
    }
    this.moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.6);
  }

  private applyBaseTint(): void {
    if (this.config.sprite.tint) this.sprite.setTint(this.config.sprite.tint);
    else this.sprite.clearTint();
  }

  /** Chamado após dano: cancela windup, atordoa brevemente e mostra a barra */
  onHit(now: number): void {
    if (this.state === "dead") return;
    this.hpBarVisibleUntil = now + 2500;
    this.stunnedUntil = now + 120;
    if (this.state === "windup") {
      this.alertIcon.setVisible(false);
      this.state = "chase";
    }
    if (this.state === "idle" || this.state === "patrol") this.enterChase(now);
    this.scene.time.delayedCall(80, () => {
      if (this.state !== "dead" && this.state !== "windup") this.applyBaseTint();
    });
  }

  private drawHpBar(now: number): void {
    if (now > this.hpBarVisibleUntil || this.hp >= this.maxHp) {
      this.hpBar.setVisible(false);
      return;
    }
    this.hpBar.setVisible(true);
    this.hpBar.clear();
    const w = 26;
    const x = this.sprite.x - w / 2;
    const y = this.sprite.y - 26 * (this.sprite.scaleY || 1) - 4;
    this.hpBar.fillStyle(0x000000, 0.7);
    this.hpBar.fillRect(x - 1, y - 1, w + 2, 5);
    this.hpBar.fillStyle(0xe74c3c, 1);
    this.hpBar.fillRect(x, y, w * (this.hp / this.maxHp), 3);
  }

  die(onDone?: () => void): void {
    this.state = "dead";
    this.hp = 0;
    this.alertIcon.setVisible(false);
    this.hpBar.setVisible(false);
    if (this.sprite.body) (this.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.sprite.setVelocity(0, 0);

    this.scene.tweens.add({
      targets: [this.sprite, this.shadow],
      alpha: 0,
      scaleX: this.sprite.scaleX * 0.4,
      scaleY: this.sprite.scaleY * 0.4,
      angle: this.sprite.flipX ? -60 : 60,
      duration: 320,
      ease: "Cubic.easeIn",
      onComplete: () => {
        this.destroy();
        onDone?.();
      },
    });
  }

  getPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.hpBar.destroy();
    this.alertIcon.destroy();
  }
}
