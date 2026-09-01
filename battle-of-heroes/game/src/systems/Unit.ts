import Phaser from "phaser";
import type { HeroDef } from "../data/heroes";
import { rollDamage } from "./Combat";
import type { Juice } from "./Juice";
import { audio } from "../audio/AudioManager";

export type Team = "player" | "enemy";
export type UnitState = "walk" | "attack" | "hit" | "die";

export class Unit {
  sprite: Phaser.GameObjects.Sprite;
  barBg: Phaser.GameObjects.Rectangle;
  bar: Phaser.GameObjects.Rectangle;
  hero: HeroDef;
  team: Team;
  hp: number;
  maxHp: number;
  state: UnitState = "walk";
  poison = 0;
  freeze = 0;
  laneY: number;
  private attackCd = 0;
  private hitLock = 0;
  alive = true;
  private struck = false;

  constructor(
    scene: Phaser.Scene,
    hero: HeroDef,
    team: Team,
    x: number,
    y: number,
    public readonly dir: number,
  ) {
    this.hero = hero;
    this.team = team;
    this.maxHp = hero.hp;
    this.hp = hero.hp;
    this.laneY = y;
    this.sprite = scene.add.sprite(x, y, hero.charKey, "walk_00").setOrigin(0.5, 1).setDepth(20 + y * 0.01);
    this.sprite.setFlipX(team === "enemy");
    const scale = hero.role === "tank" ? 0.92 : hero.role === "swarm" ? 0.72 : 0.82;
    this.sprite.setScale(scale);
    this.play("walk");
    this.barBg = scene.add.rectangle(x, y - 150 * scale, 46, 6, 0x2a1a10).setDepth(30);
    this.bar = scene.add.rectangle(x, y - 150 * scale, 44, 4, team === "player" ? 0x6adf4a : 0xe24a4a).setDepth(31);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  play(anim: "idle" | "walk" | "attack" | "hit" | "death"): void {
    const key = `${this.hero.charKey}-${anim}`;
    if (this.sprite.anims.currentAnim?.key === key) return;
    if (this.sprite.anims.animationManager.exists(key)) this.sprite.play(key, true);
  }

  update(
    dt: number,
    allies: Unit[],
    foes: Unit[],
    enemyBaseX: number,
    onHitBase: (dmg: number, crit: boolean) => void,
    juice: Juice,
    scene: Phaser.Scene,
    spawnProj: (from: Unit, targetX: number, targetY: number) => void,
  ): void {
    if (!this.alive) return;
    const sec = dt / 1000;
    this.attackCd = Math.max(0, this.attackCd - sec);
    this.hitLock = Math.max(0, this.hitLock - sec);

    if (this.freeze > 0) {
      this.freeze -= sec;
      this.sprite.setTint(0x88ddff);
      return;
    }

    if (this.poison > 0) {
      this.poison -= sec;
      this.sprite.setTint(0x88ee66);
      if (Math.random() < 0.02) this.takeDamage(2, false, juice, scene);
    } else if (this.state !== "hit") {
      this.sprite.clearTint();
    }

    if (this.state === "die") return;
    if (this.state === "hit") {
      if (this.hitLock <= 0) {
        this.state = "walk";
        this.play("walk");
      }
      this.syncBars();
      return;
    }

    const target = this.nearest(foes);
    const reachBase = this.dir > 0 ? this.x + this.hero.range >= enemyBaseX : this.x - this.hero.range <= enemyBaseX;
    const canHitUnit = target && Math.abs(target.x - this.x) <= this.hero.range + 8;

    if (canHitUnit && target) {
      this.tryAttack(target, juice, scene, spawnProj);
    } else if (!target && reachBase) {
      this.tryAttackBase(onHitBase, juice, scene);
    } else {
      this.state = "walk";
      this.play("walk");
      const blocked = this.frontAlly(allies);
      const speed = blocked ? this.hero.speed * 0.15 : this.hero.speed;
      this.sprite.x += this.dir * speed * sec;
    }
    this.syncBars();
  }

  private tryAttack(
    target: Unit,
    juice: Juice,
    scene: Phaser.Scene,
    spawnProj: (from: Unit, targetX: number, targetY: number) => void,
  ): void {
    if (this.state !== "attack") {
      this.state = "attack";
      this.play("attack");
      this.struck = false;
    }
    const progress = this.sprite.anims.getProgress();
    if (!this.struck && progress >= 0.45) {
      this.struck = true;
      if (this.hero.projectile) {
        spawnProj(this, target.x, target.y - 70);
        audio.projectile();
      } else {
        const { damage, crit } = rollDamage(this.hero.atk, target.hero.def);
        target.takeDamage(damage, crit, juice, scene, this.hero.damageType);
        audio.hit();
      }
    }
    if (!this.sprite.anims.isPlaying) {
      this.state = "walk";
      this.play("walk");
    }
  }

  private tryAttackBase(onHitBase: (dmg: number, crit: boolean) => void, juice: Juice, scene: Phaser.Scene): void {
    if (this.state !== "attack") {
      this.state = "attack";
      this.play("attack");
      this.struck = false;
    }
    const progress = this.sprite.anims.getProgress();
    if (!this.struck && progress >= 0.45) {
      this.struck = true;
      const { damage, crit } = rollDamage(this.hero.atk, 8);
      onHitBase(damage, crit);
      juice.flash(scene, this.dir > 0 ? this.x + 40 : this.x - 40, this.y - 80, crit ? 0xffee88 : 0xffffff);
      audio.hit();
    }
    if (!this.sprite.anims.isPlaying) {
      this.state = "walk";
      this.play("walk");
    }
  }

  takeDamage(amount: number, crit: boolean, juice: Juice, scene: Phaser.Scene, type: HeroDef["damageType"] = "physical"): void {
    if (!this.alive) return;
    this.hp -= amount;
    juice.floatText(scene, this.x, this.y - 130, crit ? `${amount}!` : String(amount), crit ? "#ffd24a" : "#fff");
    if (type === "poison") this.poison = Math.max(this.poison, 3.2);
    if (this.hp <= 0) {
      this.die(juice, scene);
      return;
    }
    this.state = "hit";
    this.hitLock = 0.16;
    this.play("hit");
    this.sprite.setTintFill(0xffe0e0);
    scene.time.delayedCall(70, () => {
      if (this.alive) this.sprite.clearTint();
    });
  }

  applyProjectile(amount: number, crit: boolean, juice: Juice, scene: Phaser.Scene, type: HeroDef["damageType"]): void {
    this.takeDamage(amount, crit, juice, scene, type);
  }

  private die(juice: Juice, scene: Phaser.Scene): void {
    this.alive = false;
    this.state = "die";
    this.play("death");
    audio.death();
    juice.shake(120, 4);
    const fxKey = this.hero.role === "ranged" ? "fx02" : this.hero.role === "tank" ? "fx03" : "fx01";
    const fx = scene.add.sprite(this.x, this.y - 60, fxKey).setDepth(25).setScale(0.9);
    fx.play(`${fxKey}-boom`);
    fx.once("animationcomplete", () => fx.destroy());
    scene.time.delayedCall(700, () => this.destroy());
  }

  private nearest(foes: Unit[]): Unit | null {
    let best: Unit | null = null;
    let bestD = 99999;
    for (const f of foes) {
      if (!f.alive) continue;
      const ahead = this.dir > 0 ? f.x >= this.x - 10 : f.x <= this.x + 10;
      if (!ahead) continue;
      const d = Math.abs(f.x - this.x);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  private frontAlly(allies: Unit[]): boolean {
    const gap = 42;
    for (const a of allies) {
      if (a === this || !a.alive) continue;
      const dx = (a.x - this.x) * this.dir;
      if (dx > 0 && dx < gap && Math.abs(a.laneY - this.laneY) < 18) return true;
    }
    return false;
  }

  private syncBars(): void {
    const scale = this.sprite.scale;
    const y = this.sprite.y - 150 * scale;
    this.barBg.setPosition(this.sprite.x, y);
    this.bar.setPosition(this.sprite.x - 22 + 22 * (this.hp / this.maxHp), y);
    this.bar.width = 44 * Math.max(0, this.hp / this.maxHp);
    this.sprite.setDepth(20 + this.sprite.y * 0.01);
  }

  destroy(): void {
    this.sprite.destroy();
    this.bar.destroy();
    this.barBg.destroy();
  }
}
