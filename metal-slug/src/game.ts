import { AudioBus } from "./audio";
import {
  BOSS_AT,
  GRAV,
  GROUND,
  JUMP,
  LEVEL_W,
  VH,
  VW,
  WEAPON_LABEL,
  clamp,
  overlap,
  type Box,
  type FoeKind,
  type ItemId,
  type Mode,
  type WeaponId,
} from "./const";
import {
  drawBackdrop,
  drawBarrel,
  drawBoss,
  drawBullet,
  drawCar,
  drawCrate,
  drawFlag,
  drawFoe,
  drawGround,
  drawNade,
  drawPickup,
  drawPlatform,
  drawPlayer,
  drawPopup,
  motionBob,
  muzzlePoint,
} from "./draw";
import { Input } from "./input";
import { BARRELS, CHECKS, CRATES, FLAGS, PLACED, PLATFORMS, WAVES } from "./level";

export interface Snapshot {
  mode: Mode;
  score: number;
  lives: number;
  hp: number;
  hpMax: number;
  grenades: number;
  weapon: string;
  combo: number;
  banner: string;
  boss: number;
  time: number;
  kills: number;
  deaths: number;
  rank: string;
  muted: boolean;
}

interface Actor extends Box {
  vx: number;
  vy: number;
}

interface Player extends Actor {
  facing: number;
  hp: number;
  aimX: number;
  aimY: number;
  weapon: WeaponId;
  cool: number;
  bite: number;
  biting: number;
  biteUsed: boolean;
  grenades: number;
  nadeCool: number;
  iframe: number;
  flash: number;
  grounded: boolean;
  crouch: boolean;
  coyote: number;
  jumpBuf: number;
  drop: number;
  anim: "idle" | "run" | "jump";
}

interface Foe extends Actor {
  kind: FoeKind;
  facing: number;
  hp: number;
  max: number;
  atk: number;
  wind: number;
  touch: number;
  variant: number;
  waveId: number;
  alive: boolean;
  hurt: number;
  grounded: boolean;
  sleep: boolean;
  lunge: number;
  phase: number;
  speed: number;
}

interface Boss extends Actor {
  facing: number;
  hp: number;
  max: number;
  atk: number;
  wind: number;
  mode: "walk" | "windcharge" | "charge";
  queued: "single" | "spread";
  chargeHit: boolean;
  hurt: number;
  alive: boolean;
  summon: number;
}

interface Bullet extends Box {
  vx: number;
  vy: number;
  dmg: number;
  life: number;
  team: "player" | "enemy";
  style: WeaponId | "foe";
  pierce: number;
}

interface Nade {
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: "player" | "enemy";
  dmg: number;
  radius: number;
  age: number;
}

interface Pickup {
  x: number;
  y: number;
  kind: ItemId;
}

interface Crate {
  x: number;
  y: number;
  hw: number;
  hh: number;
  item: ItemId;
  opened: boolean;
}

interface Barrel {
  x: number;
  y: number;
  hw: number;
  hh: number;
  live: boolean;
}

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  g: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  life: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

interface Corpse {
  kind: FoeKind | "boss";
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  facing: number;
  variant: number;
}

const HP_MAX = 100;
const SCORE: Record<FoeKind, number> = {
  grunt: 100,
  shooter: 200,
  grenadier: 250,
  hopper: 150,
  heli: 500,
};

const GUN: Record<WeaponId, { rate: number; dmg: number; speed: number; pierce: number; spread: number }> = {
  blaster: { rate: 0.15, dmg: 18, speed: 520, pierce: 0, spread: 1 },
  rapid: { rate: 0.07, dmg: 9, speed: 560, pierce: 0, spread: 1 },
  spread: { rate: 0.2, dmg: 14, speed: 480, pierce: 0, spread: 3 },
  heavy: { rate: 0.42, dmg: 48, speed: 360, pierce: 2, spread: 1 },
};

export class Game {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private mode: Mode = "title";
  private time = 0;
  private clock = 0;
  private player: Player | null = null;
  private foes: Foe[] = [];
  private boss: Boss | null = null;
  private bullets: Bullet[] = [];
  private nades: Nade[] = [];
  private pickups: Pickup[] = [];
  private crates: Crate[] = [];
  private barrels: Barrel[] = [];
  private parts: Part[] = [];
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  private corpses: Corpse[] = [];
  private cam = 0;
  private shake = 0;
  private shakeX = 0;
  private shakeY = 0;
  private hitStop = 0;
  private score = 0;
  private lives = 3;
  private deaths = 0;
  private kills = 0;
  private combo = 0;
  private lastKill = -10;
  private nextLife = 20000;
  private banner = "";
  private bannerT = 0;
  private waveIndex = 0;
  private waveLock: number | null = null;
  private waveNeed = 0;
  private waveKills = 0;
  private waveT = 0;
  private bossStarted = false;
  private finaleT = 0;
  private finaleX = 0;
  private finaleY = 0;
  private deadT = 0;
  private checkpoint = 90;
  private rank = "C";
  onHud: ((s: Snapshot) => void) | null = null;
  onMode: ((m: Mode, s: Snapshot) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private audio: AudioBus,
    private input: Input,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponível");
    this.ctx = ctx;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  start(): void {
    this.audio.unlock();
    this.reset();
    this.say("Z PULA   ·   X ATIRA   ·   ↑ MIRA", 3.2);
    this.setMode("play");
  }

  resume(): void {
    if (this.mode === "pause") this.setMode("play");
  }

  toggleMute(): boolean {
    return this.audio.toggle();
  }

  snapshot(): Snapshot {
    const p = this.player;
    return {
      mode: this.mode,
      score: this.score,
      lives: this.lives,
      hp: p ? Math.max(0, p.hp) : HP_MAX,
      hpMax: HP_MAX,
      grenades: p ? p.grenades : 5,
      weapon: p ? WEAPON_LABEL[p.weapon] : "BLASTER",
      combo: this.combo,
      banner: this.bannerT > 0 ? this.banner : "",
      boss: this.boss?.alive ? this.boss.hp / this.boss.max : this.finaleT > 0 ? 0 : -1,
      time: this.clock,
      kills: this.kills,
      deaths: this.deaths,
      rank: this.rank,
      muted: this.audio.muted,
    };
  }

  private loop = (now: number): void => {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.input.beginFrame();
    try {
      this.step(dt);
      this.draw();
    } catch (err) {
      console.error(err);
    }
    this.input.consume();
    this.onHud?.(this.snapshot());
    this.raf = requestAnimationFrame(this.loop);
  };

  private step(dt: number): void {
    if (this.input.pressed("mute")) this.audio.toggle();
    if (this.mode === "title") {
      if (this.input.pressed("ok") || this.input.pressed("jump") || this.input.pressed("shoot")) this.start();
      return;
    }
    if (this.mode === "pause") {
      if (this.input.pressed("pause") || this.input.pressed("ok")) this.setMode("play");
      return;
    }
    if (this.mode === "over" || this.mode === "win") {
      if (this.input.pressed("ok")) this.start();
      return;
    }
    if (this.input.pressed("pause")) {
      this.setMode("pause");
      return;
    }
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.decayShake(dt);
      return;
    }
    this.simulate(dt);
  }

  private simulate(dt: number): void {
    const p = this.player;
    if (!p) return;
    this.audio.tick();
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.banner = "";
    }
    this.decayShake(dt);

    if (this.finaleT > 0) {
      this.finaleT -= dt;
      if (Math.random() < 0.45) this.fx(this.finaleX + (Math.random() - 0.5) * 90, this.finaleY - Math.random() * 36, 30);
      if (this.finaleT <= 0) this.finish();
      this.simParts(dt);
      return;
    }

    if (this.deadT > 0) {
      this.deadT -= dt;
      p.vy += GRAV * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y + p.hh > GROUND) {
        p.y = GROUND - p.hh;
        p.vy *= -0.25;
      }
      this.simParts(dt);
      if (this.deadT <= 0) {
        if (this.lives > 1) {
          this.lives -= 1;
          this.respawn();
        } else {
          this.lives = 0;
          this.rank = "C";
          this.audio.lose();
          this.setMode("over");
        }
      }
      return;
    }

    this.clock += dt;
    this.control(dt);
    this.updateFoes(dt);
    this.updateBoss(dt);
    this.updateBullets(dt);
    this.updateNades(dt);
    this.updatePickups();
    this.touchFoes();
    this.foes = this.foes.filter((f) => f.alive);
    this.corpses = this.corpses.filter((c) => c.life > 0);
    for (const c of this.corpses) {
      c.life -= dt;
      c.vy += GRAV * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      if (c.y > GROUND - 8) {
        c.y = GROUND - 8;
        c.vy *= -0.3;
        c.vx *= 0.8;
      }
    }
    if (this.waveLock !== null && this.waveKills >= this.waveNeed) this.clearWave();
    if (this.waveLock !== null) {
      this.waveT += dt;
      if (this.waveT > 32) this.clearWave();
    }
    this.maybeWave();
    this.maybeBoss();
    this.updateCam(dt);
    this.clampPlayer();
    if (this.waveLock === null && !this.bossStarted) {
      for (const mark of CHECKS) if (p.x > mark) this.checkpoint = mark;
    }
    if (Math.random() < 0.35) {
      this.parts.push({
        x: this.cam + Math.random() * VW,
        y: VH - 8,
        vx: -12,
        vy: -18 - Math.random() * 28,
        life: 1.1,
        max: 1.1,
        color: Math.random() < 0.5 ? "#ffb15a" : "#ff6a3a",
        size: 1.4,
        g: -8,
      });
    }
    this.simParts(dt);
    if (p.iframe > 0) p.iframe -= dt;
    if (p.flash > 0) p.flash -= dt;
    if (p.cool > 0) p.cool -= dt;
    if (p.bite > 0) p.bite -= dt;
    if (p.biting > 0) p.biting -= dt;
    if (p.nadeCool > 0) p.nadeCool -= dt;
    if (p.drop > 0) p.drop -= dt;
  }

  private control(dt: number): void {
    const p = this.player;
    if (!p) return;
    const left = this.input.held("left");
    const right = this.input.held("right");
    const down = this.input.held("down");
    let move = 0;
    if (left) move -= 1;
    if (right) move += 1;
    const onPlat = p.grounded && p.y + p.hh < GROUND - 3;
    p.crouch = p.grounded && down && !this.input.held("up");
    const nextH = p.crouch ? 16 : 26;
    if (nextH !== p.hh) {
      const feet = p.y + p.hh;
      p.hh = nextH;
      p.y = feet - p.hh;
    }
    const speed = p.crouch ? 62 : 175;
    p.vx = move * speed;
    if (move !== 0) p.facing = move;
    this.aim();

    if (onPlat && p.crouch && this.input.pressed("jump")) {
      p.drop = 0.18;
      p.grounded = false;
      p.coyote = 0;
    } else if (this.input.pressed("jump")) {
      p.jumpBuf = 0.12;
    }
    if (!this.input.held("jump") && p.vy < -160) p.vy *= 0.48;
    if (p.jumpBuf > 0 && p.coyote > 0 && p.drop <= 0) {
      p.vy = JUMP;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuf = 0;
      this.audio.jump();
    }

    const prevFeet = p.y + p.hh;
    const falling = p.vy;
    p.vy = Math.min(860, p.vy + GRAV * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const was = p.grounded;
    p.grounded = this.land(p, prevFeet);
    if (p.grounded) p.coyote = 0.11;
    else p.coyote -= dt;
    p.jumpBuf -= dt;
    if (p.grounded && !was && falling > 320) this.dust(p.x, p.y + p.hh);
    p.anim = !p.grounded ? "jump" : Math.abs(move) > 0 ? "run" : "idle";

    if (this.input.held("shoot")) this.shoot();
    if (this.input.held("bite") && p.bite <= 0 && p.biting <= 0) {
      p.biting = 0.16;
      p.bite = 0.48;
      p.biteUsed = false;
      this.audio.bite();
    }
    if (p.biting > 0 && !p.biteUsed) this.doBite();
    if (this.input.pressed("grenade")) this.toss();
    if (p.grounded && p.anim === "run" && Math.random() < 0.4) this.dust(p.x - p.facing * 10, p.y + p.hh);
  }

  private aim(): void {
    const p = this.player;
    if (!p) return;
    const up = this.input.held("up");
    const down = this.input.held("down");
    const moving = this.input.held("left") || this.input.held("right");
    const onPlat = p.grounded && p.y + p.hh < GROUND - 3;
    let vertical = 0;
    if (up) vertical = -1;
    else if (down && (!p.grounded || onPlat)) vertical = 1;
    else if (this.input.mouseHot && !this.input.touch) {
      const dy = this.input.mouseY - p.y;
      if (dy < -34) vertical = -1;
      else if (dy > 40) vertical = 1;
    }
    if (vertical === 0) {
      p.aimX = p.facing;
      p.aimY = 0;
      return;
    }
    if (!moving && vertical < 0) {
      const dx = this.input.mouseHot ? this.input.mouseX - (p.x - this.cam) : 0;
      if (!this.input.mouseHot || Math.abs(dx) < 56) {
        p.aimX = 0;
        p.aimY = -1;
        return;
      }
    }
    const ax = p.facing * 0.8;
    const ay = vertical * 0.8;
    const len = Math.hypot(ax, ay) || 1;
    p.aimX = ax / len;
    p.aimY = ay / len;
  }

  private land(body: Actor, prevFeet: number): boolean {
    let grounded = false;
    const feet = body.y + body.hh;
    const dropping = body === this.player && this.player.drop > 0;
    if (body.vy >= 0 && !dropping) {
      for (const plat of PLATFORMS) {
        if (body.x + body.hw > plat.x && body.x - body.hw < plat.x + plat.w) {
          if (prevFeet <= plat.y + 3 && feet >= plat.y) {
            body.y = plat.y - body.hh;
            body.vy = 0;
            grounded = true;
          }
        }
      }
    }
    if (!grounded && body.y + body.hh >= GROUND) {
      body.y = GROUND - body.hh;
      body.vy = 0;
      grounded = true;
    }
    return grounded;
  }

  private shoot(): void {
    const p = this.player;
    if (!p || p.cool > 0) return;
    const gun = GUN[p.weapon];
    p.cool = gun.rate;
    p.flash = 0.05;
    const bob = motionBob(p.anim, Math.floor(this.time * 12), this.time);
    const origin = muzzlePoint(p.x, p.y + p.hh, p.facing, p.aimX, p.aimY, bob, p.crouch, true);
    const ang0 = Math.atan2(p.aimY, Math.abs(p.aimX) < 0.05 ? 0 : p.aimX);
    for (let i = 0; i < gun.spread; i += 1) {
      const ang = ang0 + (i - (gun.spread - 1) / 2) * 0.18;
      this.bullets.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(ang) * gun.speed,
        vy: Math.sin(ang) * gun.speed,
        hw: p.weapon === "heavy" ? 8 : 6,
        hh: p.weapon === "heavy" ? 8 : 8,
        dmg: gun.dmg,
        life: 0.85,
        team: "player",
        style: p.weapon,
        pierce: gun.pierce,
      });
    }
    this.audio.shoot(p.weapon);
    this.burst(origin.x, origin.y, "#e2b6ff", 4, 80, 0.12);
  }

  private doBite(): void {
    const p = this.player;
    if (!p) return;
    const box: Box = { x: p.x + p.facing * 34, y: p.y + 4, hw: 24, hh: 22 };
    let hit = false;
    for (const f of this.foes) {
      if (!f.alive || f.kind === "heli") continue;
      if (!overlap(box, f)) continue;
      this.damageFoe(f, 40, p.x);
      hit = true;
    }
    if (this.boss?.alive && overlap(box, this.boss)) {
      this.damageBoss(28);
      hit = true;
    }
    if (hit) {
      p.biteUsed = true;
      this.hitStop = 0.045;
      this.shake = Math.min(7, this.shake + 3);
      this.popup(p.x + p.facing * 30, p.y - 30, "POW", "#ffe14a");
    }
  }

  private toss(): void {
    const p = this.player;
    if (!p || p.grenades <= 0 || p.nadeCool > 0) return;
    p.grenades -= 1;
    p.nadeCool = 0.4;
    const ang = Math.atan2(p.aimY, Math.abs(p.aimX) < 0.05 ? p.facing : p.aimX);
    this.nades.push({
      x: p.x + p.facing * 12,
      y: p.y - 8,
      vx: Math.cos(ang) * 170,
      vy: Math.sin(ang) * 170 - 260,
      team: "player",
      dmg: 62,
      radius: 48,
      age: 0,
    });
  }

  private updateFoes(dt: number): void {
    const p = this.player;
    if (!p) return;
    for (const f of this.foes) {
      if (!f.alive) continue;
      f.hurt = Math.max(0, f.hurt - dt);
      f.atk -= dt;
      f.touch = Math.max(0, f.touch - dt);
      f.lunge = Math.max(0, f.lunge - dt);
      if (f.sleep) {
        if (p.x > f.x - 390) f.sleep = false;
        else continue;
      }
      f.facing = Math.sign(p.x - f.x) || f.facing;
      if (f.kind === "heli") {
        this.updateHeli(f, dt);
        continue;
      }
      if (f.kind === "hopper") {
        const prev = f.y + f.hh;
        if (f.grounded && f.atk <= 0) {
          f.vy = -430;
          f.vx = f.facing * 150;
          f.atk = 1.05 + Math.random() * 0.35;
          f.grounded = false;
        }
        f.vy = Math.min(860, f.vy + GRAV * dt);
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.grounded = this.land(f, prev);
        if (f.grounded) f.vx *= 0.8;
      } else {
        const dist = Math.abs(p.x - f.x);
        let dir = f.facing;
        if (f.kind === "shooter") {
          if (dist > 210) f.x += dir * f.speed * dt;
          else if (dist < 130) f.x -= dir * f.speed * dt;
          if (f.wind > 0) {
            f.wind -= dt;
            if (f.wind <= 0) {
              f.wind = 0;
              this.enemyShot(f, false);
              f.atk = 1.25;
            }
          } else if (f.atk <= 0 && dist < 340) {
            f.wind = 0.24;
          }
        } else if (f.kind === "grenadier") {
          if (dist > 240) f.x += dir * f.speed * dt;
          else if (dist < 140) f.x -= dir * f.speed * dt;
          if (f.atk <= 0 && dist < 360) {
            f.atk = 1.8;
            this.nades.push({
              x: f.x + f.facing * 8,
              y: f.y - 4,
              vx: f.facing * 110,
              vy: -240,
              team: "enemy",
              dmg: 14,
              radius: 34,
              age: 0,
            });
          }
        } else if (dist > 28) {
          f.x += dir * f.speed * dt;
        }
        f.y = GROUND - f.hh;
        f.grounded = true;
      }
      if (this.waveLock !== null && f.waveId === this.waveIndex) {
        f.x = clamp(f.x, this.cam + 18, this.cam + VW - 18);
      }
      if (f.waveId < 0 && f.x < this.cam - 320) f.alive = false;
    }
  }

  private updateHeli(f: Foe, dt: number): void {
    const p = this.player;
    if (!p) return;
    const home = 150;
    f.y += (home + Math.sin(this.time * 2 + f.phase) * 8 - f.y) * Math.min(1, dt * 3);
    const dist = p.x - f.x;
    f.facing = Math.sign(dist) || f.facing;
    if (Math.abs(dist) > 40) f.x += f.facing * f.speed * dt;
    if (f.atk <= 0 && Math.abs(dist) < 180) {
      f.atk = 1.55;
      this.nades.push({
        x: f.x,
        y: f.y + f.hh,
        vx: 20 * f.facing,
        vy: 40,
        team: "enemy",
        dmg: 13,
        radius: 32,
        age: 0,
      });
    }
  }

  private enemyShot(f: Foe, up: boolean): void {
    const p = this.player;
    if (!p) return;
    const x = f.x + f.facing * 18;
    const y = f.y - 4;
    let vx = f.facing * 200;
    let vy = up ? 160 : clamp(p.y - y, -30, 40);
    const len = Math.hypot(vx, vy) || 1;
    vx = (vx / len) * 200;
    vy = (vy / len) * 200;
    this.bullets.push({
      x,
      y,
      vx,
      vy,
      hw: 4,
      hh: 3,
      dmg: 11,
      life: 2.2,
      team: "enemy",
      style: "foe",
      pierce: 0,
    });
  }

  private updateBoss(dt: number): void {
    const boss = this.boss;
    const p = this.player;
    if (!boss || !boss.alive || !p) return;
    boss.hurt = Math.max(0, boss.hurt - dt);
    boss.atk -= dt;
    boss.summon -= dt;
    const left = this.cam + 56;
    const right = this.cam + VW - 56;
    boss.facing = Math.sign(p.x - boss.x) || boss.facing;
    if (boss.mode === "windcharge") {
      boss.wind -= dt;
      this.shake = Math.max(this.shake, 1.2);
      if (boss.wind <= 0) {
        boss.mode = "charge";
        boss.vx = boss.facing * 280;
        boss.atk = 0.75;
        boss.chargeHit = false;
      }
      return;
    }
    if (boss.mode === "charge") {
      boss.x += boss.vx * dt;
      if (boss.x < left || boss.x > right) {
        boss.x = clamp(boss.x, left, right);
        boss.mode = "walk";
        boss.vx = 0;
        this.dust(boss.x, boss.y + boss.hh);
      }
      boss.atk -= dt;
      if (boss.atk <= 0) {
        boss.mode = "walk";
        boss.vx = 0;
      }
      if (!boss.chargeHit && overlap(boss, p)) {
        boss.chargeHit = true;
        this.hurt(18, Math.sign(boss.vx) * 160, -140);
      }
      return;
    }
    const dist = Math.abs(p.x - boss.x);
    if (dist > 170) boss.x += boss.facing * 32 * dt;
    else if (dist < 80) boss.x -= boss.facing * 24 * dt;
    boss.x = clamp(boss.x, left, right);
    const phase = boss.hp / boss.max;
    if (boss.wind > 0) {
      boss.wind -= dt;
      if (boss.wind <= 0) {
        boss.wind = 0;
        this.fireBoss(boss.queued);
      }
    } else if (boss.atk <= 0) {
      if (phase < 0.55 && Math.random() < 0.34) {
        boss.mode = "windcharge";
        boss.wind = 0.55;
        boss.atk = 2.2;
        this.popup(boss.x, boss.y - boss.hh - 10, "!", "#ffe14a");
      } else {
        boss.queued = phase < 0.75 && Math.random() < 0.5 ? "spread" : "single";
        boss.wind = 0.26;
        boss.atk = phase < 0.4 ? 0.95 : 1.45;
      }
    }
    if (phase < 0.7 && boss.summon <= 0 && this.foes.length < 4) {
      boss.summon = 6.5;
      this.foes.push(this.makeFoe("grunt", boss.x - 40, -2));
      this.foes.push(this.makeFoe("grunt", boss.x + 40, -2));
      this.say("REFORÇO!", 1);
    }
  }

  private fireBoss(kind: "single" | "spread"): void {
    const boss = this.boss;
    const p = this.player;
    if (!boss || !p) return;
    const origin = { x: boss.x + boss.facing * 40, y: boss.y - 16 };
    const base = Math.atan2(p.y - origin.y, p.x - origin.x);
    const count = kind === "spread" ? 5 : 1;
    for (let i = 0; i < count; i += 1) {
      const ang = base + (i - (count - 1) / 2) * 0.22;
      this.bullets.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(ang) * 175,
        vy: Math.sin(ang) * 175,
        hw: 5,
        hh: 4,
        dmg: 12,
        life: 2.4,
        team: "enemy",
        style: "foe",
        pierce: 0,
      });
    }
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const x0 = b.x;
      const y0 = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y >= GROUND && y0 < GROUND) {
        b.life = 0;
        continue;
      }
      const hit: Box = {
        x: (x0 + b.x) / 2,
        y: (y0 + b.y) / 2,
        hw: b.hw + Math.abs(b.x - x0) / 2,
        hh: b.hh + Math.abs(b.y - y0) / 2,
      };
      if (b.team === "player") {
        let spent = false;
        for (const c of this.crates) {
          if (c.opened) continue;
          if (overlap(hit, c)) {
            this.openCrate(c);
            spent = true;
            break;
          }
        }
        if (!spent) {
          for (const bar of this.barrels) {
            if (!bar.live) continue;
            if (overlap(hit, bar)) {
              bar.live = false;
              this.blast(bar.x, bar.y, 54, 70, "all");
              spent = true;
              break;
            }
          }
        }
        if (!spent) {
          for (const f of this.foes) {
            if (!f.alive) continue;
            if (!overlap(hit, f)) continue;
            this.damageFoe(f, b.dmg, b.x);
            this.burst(b.x, b.y, "#ffe08a", 3, 60, 0.15);
            if (b.style === "heavy") this.hitStop = Math.max(this.hitStop, 0.03);
            if (b.pierce > 0) b.pierce -= 1;
            else spent = true;
            break;
          }
        }
        if (!spent && this.boss?.alive && overlap(hit, this.boss)) {
          this.damageBoss(b.dmg);
          this.burst(b.x, b.y, "#ffe08a", 4, 70, 0.16);
          if (b.style === "heavy") this.hitStop = Math.max(this.hitStop, 0.04);
          if (b.pierce > 0) b.pierce -= 1;
          else spent = true;
        }
        if (spent) b.life = 0;
      } else if (this.player && this.player.iframe <= 0 && overlap(hit, this.player)) {
        this.hurt(b.dmg, Math.sign(b.vx) * 100, -90);
        b.life = 0;
      }
    }
    this.bullets = this.bullets.filter(
      (b) => b.life > 0 && b.x > this.cam - 80 && b.x < this.cam + VW + 80 && b.y > -40 && b.y < VH + 20,
    );
  }

  private updateNades(dt: number): void {
    const keep: Nade[] = [];
    for (const n of this.nades) {
      n.age += dt;
      const prev = n.y;
      n.vy += GRAV * dt;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      let boom = n.age > 1.35;
      if (n.age > 0.16 && n.vy > 0 && n.y >= GROUND - 6 && prev <= GROUND) boom = true;
      if (n.age > 0.16 && n.vy > 0) {
        for (const plat of PLATFORMS) {
          if (n.x > plat.x && n.x < plat.x + plat.w && prev <= plat.y && n.y >= plat.y) boom = true;
        }
      }
      if (boom) this.blast(n.x, Math.min(n.y, GROUND - 4), n.radius, n.dmg, n.team === "player" ? "player" : "enemy");
      else keep.push(n);
    }
    this.nades = keep;
  }

  private updatePickups(): void {
    const p = this.player;
    if (!p) return;
    this.pickups = this.pickups.filter((item) => {
      if (Math.hypot(item.x - p.x, item.y - p.y) > 28) return true;
      if (item.kind === "heal") {
        if (p.hp >= HP_MAX) this.addScore(500, item.x, item.y);
        else {
          p.hp = Math.min(HP_MAX, p.hp + 45);
          this.popup(item.x, item.y - 10, "+CURA", "#7dff9a");
        }
      } else if (item.kind === "nade") {
        p.grenades = Math.min(9, p.grenades + 4);
        this.say("+ GRANADAS", 1.1);
      } else {
        p.weapon = item.kind;
        this.say(WEAPON_LABEL[item.kind], 1.2);
      }
      this.audio.pickup();
      return false;
    });
  }

  private touchFoes(): void {
    const p = this.player;
    if (!p || p.iframe > 0) return;
    for (const f of this.foes) {
      if (!f.alive || f.sleep || f.kind === "heli") continue;
      if (!overlap(p, f)) continue;
      if (f.kind === "grunt") {
        if (f.atk <= 0) {
          f.atk = 0.75;
          f.lunge = 0.14;
          this.hurt(12, f.facing * 120, -80);
        }
      } else if (f.touch <= 0) {
        f.touch = 0.65;
        this.hurt(f.kind === "hopper" ? 10 : 8, Math.sign(p.x - f.x) * 90, -70);
      }
    }
  }

  private hurt(dmg: number, kx: number, ky: number): void {
    const p = this.player;
    if (!p || p.iframe > 0 || this.deadT > 0 || this.finaleT > 0 || this.mode !== "play") return;
    p.hp -= dmg;
    p.iframe = 1.05;
    p.vx = kx;
    p.vy = Math.min(p.vy, ky);
    this.shake = Math.min(8, this.shake + 3.5);
    this.audio.hurt();
    this.popup(p.x, p.y - 28, `-${Math.round(dmg)}`, "#ff6a6a");
    if (p.hp <= 0) this.down();
  }

  private down(): void {
    const p = this.player;
    if (!p) return;
    this.deaths += 1;
    p.hp = 0;
    this.deadT = 0.85;
    p.vy = -300;
    p.vx = -p.facing * 90;
    this.audio.die();
    this.shake = 6;
    this.combo = 0;
  }

  private respawn(): void {
    const p = this.player;
    if (!p) return;
    p.hp = HP_MAX;
    p.x = this.respawnX();
    p.hh = 26;
    p.y = GROUND - p.hh;
    p.vx = 0;
    p.vy = 0;
    p.iframe = 1.7;
    p.grounded = true;
    this.deadT = 0;
    this.cam = clamp(p.x - VW * 0.36, 0, LEVEL_W - VW);
    this.bullets = this.bullets.filter((b) => b.team !== "enemy");
    this.nades = this.nades.filter((n) => n.team !== "enemy");
  }

  private respawnX(): number {
    if (this.bossStarted) return this.cam + 70;
    if (this.waveLock !== null) return this.cam + 54;
    return this.checkpoint;
  }

  private damageFoe(f: Foe, dmg: number, srcX: number): void {
    if (!f.alive || dmg <= 0) return;
    f.hp -= dmg;
    f.hurt = 0.1;
    f.x += Math.sign(f.x - srcX) * 5;
    if (f.hp <= 0) this.killFoe(f, srcX);
  }

  private killFoe(f: Foe, srcX: number): void {
    if (!f.alive) return;
    f.alive = false;
    this.kills += 1;
    this.addScore(SCORE[f.kind], f.x, f.y - f.hh);
    this.corpses.push({
      kind: f.kind,
      x: f.x,
      y: f.y,
      vx: Math.sign(f.x - srcX) * 170 || 80,
      vy: -260,
      rot: 0,
      vr: Math.sign(f.x - srcX) * 6 || 4,
      life: 0.8,
      facing: f.facing,
      variant: f.variant,
    });
    if (this.corpses.length > 14) this.corpses.shift();
    if (f.waveId === this.waveIndex && this.waveLock !== null) this.waveKills += 1;
    this.audio.pop();
    this.shake = Math.min(5, this.shake + 1.4);
  }

  private damageBoss(dmg: number): void {
    const boss = this.boss;
    if (!boss || !boss.alive || dmg <= 0) return;
    boss.hp -= dmg;
    boss.hurt = 0.08;
    if (boss.hp <= 0) {
      boss.alive = false;
      this.addScore(5000, boss.x, boss.y - 40);
      this.finaleT = 1.7;
      this.finaleX = boss.x;
      this.finaleY = boss.y;
      this.fx(boss.x, boss.y, 70);
      this.say("CHEFE FORA!", 1.4);
      this.corpses.push({
        kind: "boss",
        x: boss.x,
        y: boss.y,
        vx: 40,
        vy: -80,
        rot: 0,
        vr: 1,
        life: 1.6,
        facing: boss.facing,
        variant: 0,
      });
    }
  }

  private blast(x: number, y: number, radius: number, dmg: number, who: "player" | "enemy" | "all"): void {
    this.fx(x, y, radius);
    const p = this.player;
    if ((who === "all" || who === "enemy") && p) {
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < radius + p.hw) this.hurt(who === "all" ? 18 : dmg, Math.sign(p.x - x) * 140, -160);
    }
    if (who !== "enemy") {
      for (const f of this.foes) {
        if (!f.alive) continue;
        const dist = Math.hypot(f.x - x, f.y - y);
        if (dist < radius + f.hw) this.damageFoe(f, dmg * (1 - dist / (radius + 30)), x);
      }
      if (this.boss?.alive) {
        const dist = Math.hypot(this.boss.x - x, this.boss.y - y);
        if (dist < radius + this.boss.hw) this.damageBoss(dmg * 0.85);
      }
    }
    for (const bar of this.barrels) {
      if (!bar.live) continue;
      if (Math.hypot(bar.x - x, bar.y - y) < radius + 10) {
        bar.live = false;
        this.blast(bar.x, bar.y, 50, 64, "all");
      }
    }
    for (const c of this.crates) {
      if (!c.opened && Math.hypot(c.x - x, c.y - y) < radius) this.openCrate(c);
    }
  }

  private fx(x: number, y: number, radius: number): void {
    if (radius > 24) this.audio.boom();
    else this.audio.pop();
    this.shake = Math.min(8, this.shake + radius / 16);
    if (radius > 24) this.hitStop = Math.max(this.hitStop, 0.028);
    this.burst(x, y, "#ffe08a", 14, 160, 0.4);
    this.burst(x, y, "#ff6a2a", 10, 110, 0.5);
    this.burst(x, y, "#6a6a6a", 6, 60, 0.55);
    this.rings.push({ x, y, r: 6, life: 0.28 });
  }

  private burst(x: number, y: number, color: string, n: number, speed: number, life: number): void {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random());
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        life,
        max: life,
        color,
        size: 2 + Math.random() * 2,
        g: 500,
      });
    }
    if (this.parts.length > 260) this.parts.splice(0, this.parts.length - 260);
  }

  private dust(x: number, y: number): void {
    this.burst(x, y, "#c2a078", 5, 40, 0.28);
  }

  private simParts(dt: number): void {
    for (const part of this.parts) {
      part.life -= dt;
      part.vy += part.g * dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
    }
    this.parts = this.parts.filter((part) => part.life > 0);
    for (const ring of this.rings) {
      ring.life -= dt;
      ring.r += dt * 160;
    }
    this.rings = this.rings.filter((ring) => ring.life > 0);
    for (const pop of this.popups) {
      pop.life -= dt;
      pop.y -= 18 * dt;
    }
    this.popups = this.popups.filter((pop) => pop.life > 0);
  }

  private maybeWave(): void {
    if (!this.player || this.waveLock !== null || this.bossStarted) return;
    if (this.waveIndex >= WAVES.length) return;
    const wave = WAVES[this.waveIndex];
    if (this.player.x < wave.at) return;
    let spawned = 0;
    let i = 0;
    for (const group of wave.groups) {
      for (let n = 0; n < group.n; n += 1) {
        const fromLeft = i % 5 === 4 && group.kind !== "heli";
        const x =
          group.kind === "heli"
            ? this.cam + VW - 80
            : fromLeft
              ? this.cam + 24 + n * 22
              : this.cam + VW - 24 - i * 24;
        const foe = this.makeFoe(group.kind, x, this.waveIndex);
        foe.sleep = false;
        this.foes.push(foe);
        spawned += 1;
        i += 1;
      }
    }
    this.waveNeed = spawned;
    this.waveKills = 0;
    this.waveLock = this.cam;
    this.waveT = 0;
    const heli = wave.groups.some((g) => g.kind === "heli");
    this.say(heli ? "HELICÓPTERO — MIRE ↑" : `ONDA ${this.waveIndex + 1} / ${WAVES.length}`, heli ? 2.1 : 1.4);
    this.audio.wave();
  }

  private clearWave(): void {
    this.waveLock = null;
    this.waveIndex += 1;
    this.say("ÁREA LIMPA", 1);
    this.audio.pickup();
  }

  private maybeBoss(): void {
    if (!this.player || this.bossStarted || this.waveLock !== null) return;
    if (this.waveIndex < WAVES.length) return;
    if (this.player.x < BOSS_AT) return;
    this.bossStarted = true;
    this.boss = {
      x: this.cam + VW - 78,
      y: GROUND - 32,
      vx: 0,
      vy: 0,
      hw: 46,
      hh: 32,
      facing: -1,
      hp: 560,
      max: 560,
      atk: 0.8,
      wind: 0,
      mode: "walk",
      queued: "single",
      chargeHit: false,
      hurt: 0,
      alive: true,
      summon: 4,
    };
    this.say("CHEFE DA PRAÇA", 2);
    this.audio.boss();
    this.shake = 5;
  }

  private finish(): void {
    this.rank = this.deaths === 0 && this.clock < 210 ? "S" : this.deaths === 0 ? "A" : this.deaths <= 2 ? "B" : "C";
    this.audio.fanfare();
    this.setMode("win");
  }

  private updateCam(dt: number): void {
    const p = this.player;
    if (!p) return;
    if (this.bossStarted) return;
    let maxCam = LEVEL_W - VW;
    if (this.waveLock !== null) maxCam = Math.min(maxCam, this.waveLock);
    const target = clamp(p.x - VW * 0.36 + p.facing * 24, 0, Math.max(0, maxCam));
    const k = 1 - Math.pow(0.0015, dt);
    this.cam += (target - this.cam) * k;
    this.cam = clamp(this.cam, 0, Math.max(0, maxCam));
  }

  private clampPlayer(): void {
    const p = this.player;
    if (!p) return;
    const minX = this.cam + 18;
    const maxX = this.cam + VW - 28;
    if (p.x < minX) p.x = minX;
    if (p.x > maxX) p.x = maxX;
  }

  private openCrate(c: Crate): void {
    if (c.opened) return;
    c.opened = true;
    this.pickups.push({ x: c.x, y: c.y - 16, kind: c.item });
    this.fx(c.x, c.y, 12);
  }

  private addScore(base: number, x: number, y: number): void {
    if (this.time - this.lastKill < 2.2) this.combo += 1;
    else this.combo = 1;
    this.lastKill = this.time;
    const mult = Math.min(4, 1 + Math.floor((this.combo - 1) / 3));
    const gain = base * mult;
    this.score += gain;
    this.popup(x, y, mult > 1 ? `${gain} x${mult}` : `${gain}`, "#ffe14a");
    if (this.score >= this.nextLife && this.lives < 6) {
      this.lives += 1;
      this.nextLife += 20000;
      this.say("1UP", 1.2);
      this.audio.pickup();
    }
  }

  private popup(x: number, y: number, text: string, color: string): void {
    this.popups.push({ x, y, text, life: 0.7, color });
  }

  private say(text: string, t: number): void {
    this.banner = text;
    this.bannerT = t;
  }

  private setMode(mode: Mode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.onMode?.(mode, this.snapshot());
  }

  private reset(): void {
    this.player = {
      x: 90,
      y: GROUND - 26,
      vx: 0,
      vy: 0,
      hw: 16,
      hh: 26,
      facing: 1,
      hp: HP_MAX,
      aimX: 1,
      aimY: 0,
      weapon: "blaster",
      cool: 0,
      bite: 0,
      biting: 0,
      biteUsed: false,
      grenades: 5,
      nadeCool: 0,
      iframe: 0,
      flash: 0,
      grounded: true,
      crouch: false,
      coyote: 0.1,
      jumpBuf: 0,
      drop: 0,
      anim: "idle",
    };
    this.foes = PLACED.map((p) => this.makeFoe(p.kind, p.x, -1));
    this.boss = null;
    this.bullets = [];
    this.nades = [];
    this.pickups = [];
    this.crates = CRATES.map((c) => ({
      x: c.x,
      y: GROUND - 20,
      hw: 16,
      hh: 20,
      item: c.item,
      opened: false,
    }));
    this.barrels = BARRELS.map((x) => ({
      x,
      y: GROUND - 18,
      hw: 14,
      hh: 18,
      live: true,
    }));
    this.parts = [];
    this.rings = [];
    this.popups = [];
    this.corpses = [];
    this.cam = 0;
    this.shake = 0;
    this.score = 0;
    this.lives = 3;
    this.deaths = 0;
    this.kills = 0;
    this.combo = 0;
    this.lastKill = -10;
    this.nextLife = 20000;
    this.banner = "";
    this.bannerT = 0;
    this.waveIndex = 0;
    this.waveLock = null;
    this.waveNeed = 0;
    this.waveKills = 0;
    this.waveT = 0;
    this.bossStarted = false;
    this.finaleT = 0;
    this.deadT = 0;
    this.checkpoint = 90;
    this.clock = 0;
    this.rank = "C";
    this.hitStop = 0;
  }

  private makeFoe(kind: FoeKind, x: number, waveId: number): Foe {
    const stats = {
      grunt: { hp: 34, hw: 12, hh: 23, speed: 48 },
      shooter: { hp: 28, hw: 12, hh: 23, speed: 34 },
      grenadier: { hp: 42, hw: 13, hh: 24, speed: 28 },
      hopper: { hp: 24, hw: 12, hh: 20, speed: 70 },
      heli: { hp: 96, hw: 26, hh: 14, speed: 42 },
    }[kind];
    const hh = stats.hh;
    return {
      kind,
      x,
      y: kind === "heli" ? 150 : GROUND - hh,
      vx: 0,
      vy: 0,
      hw: stats.hw,
      hh,
      facing: -1,
      hp: stats.hp,
      max: stats.hp,
      atk: 0.35 + Math.random() * 0.4,
      wind: 0,
      touch: 0,
      variant: (Math.random() * 4) | 0,
      waveId,
      alive: true,
      hurt: 0,
      grounded: kind !== "heli",
      sleep: waveId < 0,
      lunge: 0,
      phase: Math.random() * 6,
      speed: stats.speed,
    };
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VW, VH);
    this.shakeX = (Math.random() - 0.5) * this.shake * 2;
    this.shakeY = (Math.random() - 0.5) * this.shake * 2;
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);
    const cam = Math.round(this.cam);
    drawBackdrop(ctx, cam, this.time);
    ctx.save();
    ctx.translate(-cam, 0);
    drawGround(ctx, cam);
    for (const x of FLAGS) if (x > cam - 40 && x < cam + VW + 40) drawFlag(ctx, x, this.time);
    for (let i = 0; i < 8; i += 1) {
      const x = 280 + i * 640;
      if (x > cam - 60 && x < cam + VW + 20) drawCar(ctx, x);
    }
    for (const plat of PLATFORMS) {
      if (plat.x + plat.w > cam - 10 && plat.x < cam + VW + 10) drawPlatform(ctx, plat.x, plat.y, plat.w);
    }
    for (const bar of this.barrels) if (bar.live) drawBarrel(ctx, bar.x, GROUND);
    for (const c of this.crates) drawCrate(ctx, c.x, GROUND, c.opened, this.time);
    for (const item of this.pickups) {
      const bob = Math.sin(this.time * 4 + item.x) * 3;
      drawPickup(ctx, item.x, item.y + bob, item.kind);
    }
    for (const c of this.corpses) {
      ctx.save();
      ctx.translate(Math.round(c.x), Math.round(c.y + 20));
      ctx.rotate(c.rot);
      if (c.facing < 0) ctx.scale(-1, 1);
      ctx.globalAlpha = Math.max(0, c.life);
      if (c.kind === "boss") drawBoss(ctx, 0, false, this.time);
      else drawFoe(ctx, c.kind, c.variant, 0, 0, 0, this.time);
      ctx.restore();
    }
    const actors: { y: number; draw: () => void }[] = [];
    for (const f of this.foes) {
      if (!f.alive) continue;
      actors.push({
        y: f.y,
        draw: () => {
          ctx.save();
          ctx.translate(Math.round(f.x), Math.round(f.y + f.hh));
          if (f.facing < 0) ctx.scale(-1, 1);
          if (f.hurt > 0) ctx.globalAlpha = 0.65;
          drawFoe(ctx, f.kind, f.variant, Math.floor(this.time * 10), f.wind, f.lunge > 0 ? 6 : 0, this.time);
          ctx.restore();
          if (f.kind !== "heli" && f.wind > 0) drawPopup(ctx, f.x, f.y - f.hh - 8, "!", "#ffe14a");
        },
      });
    }
    if (this.boss?.alive) {
      const boss = this.boss;
      actors.push({
        y: boss.y,
        draw: () => {
          ctx.save();
          ctx.translate(Math.round(boss.x), Math.round(boss.y + boss.hh));
          if (boss.facing < 0) ctx.scale(-1, 1);
          if (boss.hurt > 0) ctx.globalAlpha = 0.7;
          drawBoss(ctx, Math.floor(this.time * 12), boss.mode !== "walk" || boss.wind > 0, this.time);
          ctx.restore();
          const ratio = Math.max(0, boss.hp / boss.max);
          ctx.fillStyle = "#2a1010";
          ctx.fillRect(boss.x - 36, boss.y - boss.hh - 14, 72, 5);
          ctx.fillStyle = "#ff4040";
          ctx.fillRect(boss.x - 36, boss.y - boss.hh - 14, 72 * ratio, 5);
        },
      });
    }
    if (this.player && !(this.player.iframe > 0 && ((this.time * 22) | 0) % 2 === 0)) {
      const p = this.player;
      actors.push({
        y: p.y,
        draw: () => {
          const feet = p.y + p.hh;
          const lift = Math.max(0, GROUND - feet);
          ctx.fillStyle = `rgba(0,0,0,${clamp(0.32 - lift / 400, 0.08, 0.32)})`;
          ctx.beginPath();
          ctx.ellipse(p.x, lift > 4 ? GROUND : feet, 26 - lift * 0.05, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.save();
          ctx.translate(Math.round(p.x), Math.round(feet));
          if (p.facing < 0) ctx.scale(-1, 1);
          drawPlayer(
            ctx,
            p.anim,
            Math.floor(this.time * 12),
            p.aimX * p.facing,
            p.aimY,
            p.biting > 0,
            p.crouch,
            p.flash > 0,
            this.time,
          );
          ctx.restore();
        },
      });
    }
    actors.sort((a, b) => a.y - b.y);
    for (const actor of actors) actor.draw();
    for (const n of this.nades) drawNade(ctx, n.x, n.y, n.team === "enemy");
    for (const b of this.bullets) drawBullet(ctx, b.x, b.y, b.style);
    for (const ring of this.rings) {
      ctx.strokeStyle = `rgba(255, 190, 70, ${Math.max(0, ring.life * 3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const part of this.parts) {
      ctx.globalAlpha = Math.max(0, part.life / part.max);
      ctx.fillStyle = part.color;
      ctx.fillRect(part.x, part.y, part.size, part.size);
    }
    ctx.globalAlpha = 1;
    for (const pop of this.popups) drawPopup(ctx, pop.x, pop.y, pop.text, pop.color);
    if (this.bossStarted && this.finaleT <= 0) {
      ctx.fillStyle = "#6a5030";
      ctx.fillRect(this.cam + 4, GROUND - 36, 10, 36);
      ctx.fillRect(this.cam + VW - 14, GROUND - 36, 10, 36);
    }
    ctx.restore();
    ctx.restore();
    if (this.player && this.player.hp < 35 && this.player.hp > 0 && this.mode === "play") {
      ctx.fillStyle = "rgba(140, 0, 0, 0.16)";
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  private decayShake(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 16);
  }
}
