import Phaser from "phaser";
import type { FighterDef, Team } from "../../data/fighters.js";
import { STAGE } from "../../data/stage.js";
import { canvasSize, drawFighter, type Anim } from "../render/pixelDraw.js";
import { FIGHTER_SHEETS, fighterSheetKey, isLoopingSheet } from "../render/sheetAnims.js";
import { audio } from "../../audio/GameAudio.js";
import type { InputState } from "../input.js";

export type FightState =
  | "idle"
  | "walk"
  | "jump"
  | "attack"
  | "jumpAttack"
  | "special"
  | "shoot"
  | "hurt"
  | "down"
  | "getup"
  | "dead";

let texSeq = 0;

export class Fighter extends Phaser.GameObjects.Container {
  public wx: number;
  public wy = 0;
  public wz: number;
  public vx = 0;
  public vy = 0;
  public vz = 0;
  public facing: 1 | -1 = 1;
  public hp: number;
  public maxHp: number;
  public team: Team;
  public def: FighterDef;
  public state: FightState = "idle";
  public stateT = 0;
  public combo = 0;
  public invuln = 0;
  public hitFlash = 0;
  public ammo = 6;
  public weapon: "none" | "pipe" | "gun" = "none";
  public weaponHits = 0;
  public alive = true;
  public scoreValue: number;
  public attackHasHit = false;
  public aiTimer = 0;
  public wantsThrow = false;

  private sprite: Phaser.GameObjects.Image;
  private sheet: Phaser.GameObjects.Sprite | null = null;
  private texKey: string;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private attackQueue = false;
  private animTime = 0;

  constructor(scene: Phaser.Scene, def: FighterDef, team: Team, x: number, z: number) {
    super(scene, x, 0);
    this.def = def;
    this.team = team;
    this.wx = x;
    this.wz = z;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.scoreValue = def.kind === "rex" ? 5000 : def.kind === "brute" ? 800 : def.kind === "raptor" ? 500 : 300;
    if (def.id === "quinn") this.weapon = "gun";

    const size = canvasSize(def.kind);
    this.texKey = `ftr-${def.id}-${texSeq++}`;
    const tex = scene.textures.createCanvas(this.texKey, size.w, size.h);
    if (!tex) throw new Error("canvas texture failed");
    this.canvas = tex.getCanvas();
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2d ctx");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this.sprite = scene.add.image(0, 0, this.texKey);
    this.sprite.setOrigin(0.5, 1);
    const viewScale = def.kind === "rex" ? 1.65 : def.kind === "raptor" ? 2.15 : 2.4;
    this.sprite.setScale(viewScale);
    this.add(this.sprite);

    const pack = FIGHTER_SHEETS[def.id];
    const idleKey = `${def.id}-idle`;
    if (pack && scene.textures.exists(idleKey)) {
      this.sheet = scene.add.sprite(0, 0, idleKey);
      this.sheet.setOrigin(0.5, 1);
      this.sheet.setScale(pack.scale);
      this.add(this.sheet);
      this.sprite.setVisible(false);
    }

    scene.add.existing(this);
    this.setSize(size.w, size.h);
    this.redraw();
    this.syncScreen();
  }

  public busy(): boolean {
    return (
      this.state === "attack" ||
      this.state === "jumpAttack" ||
      this.state === "special" ||
      this.state === "shoot" ||
      this.state === "hurt" ||
      this.state === "down" ||
      this.state === "getup" ||
      this.state === "dead"
    );
  }

  public grounded(): boolean {
    return this.wy <= 0;
  }

  public updateFighter(dt: number, input: InputState | null, locked?: { min: number; max: number }): void {
    if (!this.alive && this.state === "dead") {
      this.animTime += dt;
      this.syncScreen();
      this.redraw();
      return;
    }

    this.animTime += dt;
    this.stateT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    if (this.team === "player" && input && this.state !== "dead") {
      this.control(dt, input, locked);
    }

    this.physics(dt);
    this.advanceState();
    this.syncScreen();
    this.redraw();
  }

  private control(dt: number, input: InputState, locked?: { min: number; max: number }): void {
    if (this.state === "hurt" || this.state === "down" || this.state === "getup") return;

    if (this.state === "attack" || this.state === "jumpAttack" || this.state === "special" || this.state === "shoot") {
      if (input.punchJustPressed) this.attackQueue = true;
      return;
    }

    if (input.left) this.facing = -1;
    else if (input.right) this.facing = 1;

    if (this.grounded()) {
      const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const mz = (input.up ? 1 : 0) - (input.down ? 1 : 0);
      this.vx = mx * this.def.speed * 78;
      this.vz = mz * this.def.depthSpeed * 62;
      this.state = mx !== 0 || mz !== 0 ? "walk" : "idle";

      if (input.jumpJustPressed) {
        this.vy = this.def.jump * 52;
        this.state = "jump";
        this.stateT = 0;
        audio.jump();
      } else if (input.specialJustPressed) {
        this.startSpecial();
      } else if (input.punchJustPressed) {
        this.startAttack(false);
      }
    } else {
      const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.vx += mx * 120 * dt;
      this.vx = Phaser.Math.Clamp(this.vx, -160, 160);
      if (input.punchJustPressed || input.specialJustPressed) {
        this.state = "jumpAttack";
        this.stateT = 0;
        this.attackHasHit = false;
        audio.punch(true);
      }
    }

    if (locked) {
      this.wx = Phaser.Math.Clamp(this.wx, locked.min + 28, locked.max - 28);
    }
  }

  public startAttack(queuedCombo: boolean): void {
    if (!this.grounded()) return;
    this.combo = queuedCombo ? Math.min(2, this.combo + 1) : 0;
    this.state = "attack";
    this.stateT = 0;
    this.attackHasHit = false;
    this.attackQueue = false;
    this.vx *= 0.2;
    audio.punch(this.combo === 2 || this.weapon === "pipe");
  }

  private startSpecial(): void {
    this.stateT = 0;
    this.attackHasHit = false;
    this.vx *= 0.15;
    if (this.def.id === "quinn") {
      if (this.ammo <= 0) {
        this.startAttack(false);
        return;
      }
      this.ammo -= 1;
      this.state = "shoot";
      audio.gun();
      return;
    }
    this.state = "special";
    if (this.def.id === "vesper") {
      this.invuln = 0.18;
      this.vx = this.facing * 280;
    }
    if (this.def.id === "rook") {
      this.vx = this.facing * 40;
    }
    if (this.def.id === "toro") {
      this.wantsThrow = true;
    }
    audio.punch(true);
  }

  private physics(dt: number): void {
    this.wx += this.vx * dt;
    this.wz += this.vz * dt;
    this.wy += this.vy * dt;
    this.vy -= 420 * dt;
    if (this.wy < 0) {
      this.wy = 0;
      this.vy = 0;
      this.vz *= 0.4;
      if (this.state === "jump" || this.state === "jumpAttack") {
        this.state = "idle";
        this.stateT = 0;
      }
    }
    this.wz = Phaser.Math.Clamp(this.wz, STAGE.zMin, STAGE.zMax);
    this.wx = Phaser.Math.Clamp(this.wx, 40, STAGE.width - 40);

    if (this.state === "hurt") {
      this.vx *= Math.pow(0.15, dt);
    } else if (this.state !== "walk" && this.state !== "jump" && this.state !== "special") {
      this.vx *= Math.pow(0.04, dt);
      this.vz *= Math.pow(0.04, dt);
    } else if (this.state === "special" && this.def.id !== "vesper") {
      this.vx *= Math.pow(0.2, dt);
    }
  }

  private advanceState(): void {
    const dur = this.stateDuration();
    if (this.state === "attack" && this.attackQueue && this.stateT > dur * 0.45) {
      this.startAttack(true);
      return;
    }
    if (dur > 0 && this.stateT >= dur) {
      if (this.state === "dead") return;
      if (this.state === "down") {
        if (this.hp <= 0) {
          this.die();
          return;
        }
        this.state = "getup";
        this.stateT = 0;
        this.invuln = 0.35;
        return;
      }
      this.state = this.grounded() ? "idle" : "jump";
      this.stateT = 0;
      this.combo = 0;
      this.wantsThrow = false;
    }
  }

  private stateDuration(): number {
    if (this.sheet) {
      if (this.state === "attack") return 0.54;
      if (this.state === "shoot") return 0.64;
      if (this.state === "special") return 0.54;
      if (this.state === "jumpAttack") return 0.45;
    }
    switch (this.state) {
      case "attack":
        return this.combo === 2 ? 0.42 : 0.28;
      case "jumpAttack":
        return 0.32;
      case "special":
        return this.def.id === "vesper" ? 0.28 : 0.4;
      case "shoot":
        return 0.3;
      case "hurt":
        return 0.28;
      case "down":
        return this.def.kind === "rex" ? 0.7 : 0.55;
      case "getup":
        return 0.28;
      default:
        return 0;
    }
  }

  public activeHit(): { dmg: number; kb: number; stun: number; knockdown: boolean; range: number } | null {
    if (this.attackHasHit) return null;
    const t = this.stateT;
    if (this.state === "attack") {
      const start = 0.08;
      const end = 0.18;
      if (t < start || t > end) return null;
      const pipe = this.weapon === "pipe";
      const dmg = this.def.damage * (this.combo === 2 ? 1.45 : 1) * (pipe ? 1.35 : 1);
      return {
        dmg,
        kb: 60 + this.combo * 30,
        stun: 0.18,
        knockdown: this.combo === 2 || pipe,
        range: this.def.range + (pipe ? 10 : 0) + this.combo * 4,
      };
    }
    if (this.state === "jumpAttack" && t > 0.05 && t < 0.22) {
      return { dmg: this.def.damage * 1.2, kb: 90, stun: 0.2, knockdown: true, range: this.def.range + 8 };
    }
    if (this.state === "special" && t > 0.06 && t < 0.2) {
      const dmg = this.def.id === "rook" ? this.def.damage * 1.8 : this.def.damage * 1.4;
      return { dmg, kb: 140, stun: 0.25, knockdown: true, range: this.def.range + 16 };
    }
    if (this.state === "shoot" && t > 0.06 && t < 0.14) {
      return { dmg: 22, kb: 80, stun: 0.15, knockdown: false, range: 220 };
    }
    return null;
  }

  public consumeHit(): void {
    this.attackHasHit = true;
    if (this.weapon === "pipe") {
      this.weaponHits -= 1;
      if (this.weaponHits <= 0) this.weapon = this.def.id === "quinn" ? "gun" : "none";
    }
  }

  public takeHit(dmg: number, dir: 1 | -1, kb: number, knockdown: boolean): void {
    if (this.invuln > 0 || this.state === "dead") return;
    this.hp = Math.max(0, this.hp - dmg);
    this.hitFlash = 0.08;
    this.facing = dir < 0 ? 1 : -1;
    this.vx = dir * (kb / this.def.mass);
    this.attackQueue = false;
    this.wantsThrow = false;
    audio.hit();
    if (knockdown || this.hp <= 0) {
      this.state = "down";
      this.stateT = 0;
      this.vy = 70;
      this.invuln = 0.4;
    } else {
      this.state = "hurt";
      this.stateT = 0;
      this.invuln = 0.12;
    }
  }

  public die(): void {
    this.alive = false;
    this.state = "dead";
    this.hp = 0;
    this.vx = 0;
    this.vz = 0;
    audio.death();
  }

  public givePickup(kind: "meat" | "pipe" | "clip"): string {
    if (kind === "meat") {
      this.hp = Math.min(this.maxHp, this.hp + 48);
      audio.pickup();
      return "CARNE +48";
    }
    if (kind === "pipe") {
      this.weapon = "pipe";
      this.weaponHits = 9;
      audio.pickup();
      return "CANO";
    }
    this.ammo = Math.min(12, this.ammo + 6);
    audio.pickup();
    return "MUNIÇÃO";
  }

  public toScreenY(): number {
    return STAGE.groundBase - this.wz * 0.92 - this.wy;
  }

  private syncScreen(): void {
    this.x = this.wx;
    this.y = this.toScreenY();
    this.depth = this.wz + (this.state === "dead" ? -20 : 0);
    const pack = FIGHTER_SHEETS[this.def.id];
    const base = this.sheet ? pack?.scale ?? 1.1 : this.def.kind === "rex" ? 1.65 : this.def.kind === "raptor" ? 2.15 : 2.4;
    const squish = this.state === "attack" || this.state === "special" ? 1.06 : this.state === "hurt" ? 0.94 : 1;
    const target = this.sheet ?? this.sprite;
    target.setScale(base * squish, base * (this.state === "hurt" ? 1.05 : 1));
    if (this.sheet) {
      this.sheet.setFlipX(this.facing < 0);
      this.sheet.setTint(this.hitFlash > 0 ? 0xff6670 : 0xffffff);
    }
  }

  private playSheet(): void {
    if (!this.sheet) return;
    const key = fighterSheetKey(this.def.id, this.state, this.combo);
    const looping = isLoopingSheet(key);
    const restart = this.stateT < 0.04;
    if (this.sheet.anims.currentAnim?.key === key && looping && !restart) return;
    this.sheet.play(key, looping && !restart);
  }

  private redraw(): void {
    if (this.sheet) {
      this.playSheet();
      return;
    }
    const anim = this.currentAnim();
    drawFighter(this.ctx, {
      kind: this.def.kind,
      id: this.def.id,
      palette: this.def.palette,
      anim,
      t: this.animTime,
      facing: this.facing,
      air: 0,
      weapon: this.weapon === "pipe" ? "pipe" : this.weapon === "gun" || this.state === "shoot" ? "gun" : "none",
      flash: this.hitFlash > 0,
    });
    (this.scene.textures.get(this.texKey) as Phaser.Textures.CanvasTexture).refresh();
  }

  private currentAnim(): Anim {
    if (this.state === "dead" || this.state === "down") return "down";
    if (this.state === "hurt" || this.state === "getup") return "hurt";
    if (this.state === "shoot") return "shoot";
    if (this.state === "special") return "special";
    if (this.state === "jumpAttack") return "kick";
    if (this.state === "jump") return "jump";
    if (this.state === "attack") {
      if (this.combo === 2) return "kick";
      if (this.combo === 1) return "punch2";
      return "punch";
    }
    if (this.state === "walk") return "walk";
    return "idle";
  }

  public destroy(fromScene?: boolean): void {
    if (this.scene?.textures.exists(this.texKey)) {
      this.scene.textures.remove(this.texKey);
    }
    super.destroy(fromScene);
  }
}
