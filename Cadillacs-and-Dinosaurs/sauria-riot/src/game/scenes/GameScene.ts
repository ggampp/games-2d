import Phaser from "phaser";
import { ENEMIES, PLAYERS, type FighterId } from "../../data/fighters.js";
import { STAGE, WAVES, type PickupKind, type WaveSpec } from "../../data/stage.js";
import { audio } from "../../audio/GameAudio.js";
import { Fighter } from "../combat/Fighter.js";
import { InputManager } from "../input.js";
import { JuiceManager } from "../juice/JuiceManager.js";

interface Pickup {
  kind: PickupKind;
  x: number;
  z: number;
  view: Phaser.GameObjects.Container;
}

export class GameScene extends Phaser.Scene {
  public inputManager!: InputManager;
  public juice!: JuiceManager;
  private player!: Fighter;
  private enemies: Fighter[] = [];
  private pickups: Pickup[] = [];
  private waveIndex = 0;
  private locking: WaveSpec | null = null;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private score = 0;
  private comboHits = 0;
  private comboTimer = 0;
  private lives = 2;
  private ended = false;
  private banner?: Phaser.GameObjects.Text;

  constructor() {
    super("GameScene");
  }

  create(): void {
    audio.unlock();
    this.ended = false;
    this.enemies = [];
    this.pickups = [];
    this.waveIndex = 0;
    this.locking = null;
    this.score = 0;
    this.comboHits = 0;
    this.lives = 2;

    this.juice = new JuiceManager(this);
    this.inputManager = new InputManager(this);
    this.physics.world.setBounds(0, 0, STAGE.width, STAGE.height);

    this.buildWorld();

    const id = (this.registry.get("fighterId") as FighterId) || "rook";
    this.player = new Fighter(this, PLAYERS[id], "player", 90, 48);
    this.player.facing = 1;

    this.cameras.main.setBounds(0, 0, STAGE.width, STAGE.height);
    this.cameras.main.startFollow(this.player, true, 0.12, 0);
    this.cameras.main.setDeadzone(70, 800);
    this.cameras.main.setFollowOffset(40, 40);

    this.banner = this.add
      .text(320, 70, "", {
        fontFamily: "Bungee, sans-serif",
        fontSize: "18px",
        color: "#ffb347",
        stroke: "#140c08",
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(800)
      .setAlpha(0);

    this.announce("DISTRITO FERRUGEM");
    this.game.events.emit("match-start");
    this.emitHud();
    this.events.emit("scene-ready");
  }

  update(_time: number, delta: number): void {
    if (this.ended || !this.player) return;
    const raw = Math.min(0.033, delta / 1000);
    const dt = this.juice.tick(raw);
    const input = this.inputManager.getState();

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboHits = 0;
    }

    const lock = this.locking
      ? { min: this.locking.lockMin, max: this.locking.lockMax }
      : undefined;

    this.player.updateFighter(dt, input, lock);
    this.tryPickup();
    this.updateWaves();
    this.updateAI(dt);
    this.resolveHits();
    this.separate();

    for (const e of this.enemies) e.updateFighter(dt, null);

    const camX = this.cameras.main.scrollX;
    this.far.tilePositionX = camX * 0.14 / this.far.tileScaleX;
    this.mid.tilePositionX = camX * 0.42 / this.mid.tileScaleX;
    this.ground.tilePositionX = camX / this.ground.tileScaleX;

    if (this.player.hp <= 0 && this.player.state === "dead") {
      this.onPlayerDown();
    }

    this.emitHud();
  }

  private buildWorld(): void {
    const w = STAGE.width;
    const sky = this.add.graphics().setScrollFactor(0).setDepth(0);
    sky.fillGradientStyle(0x3a1860, 0x3a1860, 0xe07a3a, 0xe07a3a, 1);
    sky.fillRect(0, 0, 640, 200);

    this.far = this.coverLayer("far", 0, 136, 0, 0.18);
    this.mid = this.coverLayer("mid", 70, 176, 1, "bottom");
    this.ground = this.coverLayer("ground", 186, 174, 3, 0.02);

    for (let x = 220; x < w; x += 280) {
      this.add.rectangle(x, 196, 6, 86, 0x3a3028).setDepth(5);
      this.add.circle(x, 154, 8, 0xffb347, 0.9).setDepth(5);
      this.add.circle(x, 154, 26, 0xff8a2a, 0.14).setDepth(5);
    }
    for (let i = 0; i < 8; i++) {
      const x = 420 + i * 500;
      this.add.rectangle(x, 282, 20, 26, 0x6a4a32).setStrokeStyle(2, 0x1a1008).setDepth(8);
      this.add.rectangle(x, 272, 20, 5, 0x8a6240).setDepth(8);
    }
  }

  /** One screen-wide copy, aspect preserved (no horizontal squash). */
  private coverLayer(
    key: string,
    y: number,
    h: number,
    depth: number,
    srcY: number | "bottom",
  ): Phaser.GameObjects.TileSprite {
    const loopKey = this.mirrorLoop(key);
    const src = this.textures.get(loopKey).getSourceImage() as HTMLImageElement;
    const srcH = src.height;
    const tileW = src.width / 2;
    const scale = 640 / tileW;

    const ts = this.add
      .tileSprite(0, y, 640, h, loopKey)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);
    ts.setTileScale(scale, scale);

    const visible = h / scale;
    if (srcY === "bottom") ts.tilePositionY = Math.max(0, srcH - visible);
    else ts.tilePositionY = Phaser.Math.Clamp(srcY * srcH, 0, Math.max(0, srcH - visible));
    return ts;
  }

  private mirrorLoop(key: string): string {
    const srcKey = this.textures.exists(key) ? key : "title";
    const loopKey = `${srcKey}-loop`;
    if (this.textures.exists(loopKey)) return loopKey;
    const src = this.textures.get(srcKey).getSourceImage() as HTMLImageElement;
    const w = src.width;
    const h = src.height;
    const canvas = this.textures.createCanvas(loopKey, w * 2, h);
    if (!canvas) return srcKey;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
    ctx.save();
    ctx.translate(w * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    ctx.restore();
    canvas.refresh();
    return loopKey;
  }

  private updateWaves(): void {
    if (this.locking) {
      const living = this.enemies.filter((e) => e.alive);
      if (living.length === 0) {
        const wave = this.locking;
        this.locking = null;
        this.cameras.main.setBounds(0, 0, STAGE.width, STAGE.height);
        if (wave.pickup) this.spawnPickup(wave.pickup.kind, wave.pickup.x, wave.pickup.z);
        this.announce("ÁREA LIMPA");
        this.waveIndex += 1;
        if (wave.id === "alpha") this.victory();
      }
      return;
    }

    const next = WAVES[this.waveIndex];
    if (!next) return;
    if (this.player.wx >= next.triggerX) {
      this.locking = next;
      this.cameras.main.setBounds(next.lockMin, 0, next.lockMax - next.lockMin, STAGE.height);
      for (const spec of next.enemies) {
        const def = ENEMIES[spec.type];
        if (!def) continue;
        const foe = new Fighter(this, def, "enemy", spec.x, spec.z);
        foe.facing = -1;
        this.enemies.push(foe);
        if (def.kind === "rex") {
          audio.roar();
          this.announce("ASHJAW");
          this.juice.screenShake(0.01, 400);
        }
      }
      if (next.id !== "alpha") this.announce("LUTA");
    }
  }

  private updateAI(dt: number): void {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive || e.busy()) continue;
      e.aiTimer -= dt;
      const dx = p.wx - e.wx;
      const dz = p.wz - e.wz;
      e.facing = dx < 0 ? -1 : 1;
      const adx = Math.abs(dx);
      const adz = Math.abs(dz);
      const range = e.def.range;

      if (e.def.kind === "rex" && e.aiTimer <= 0 && adx < 240) {
        if (Math.random() < 0.4) {
          e.state = "special";
          e.stateT = 0;
          e.attackHasHit = false;
          e.vx = e.facing * 220;
          audio.roar();
          e.aiTimer = 1.4;
          continue;
        }
      }

      if (adx > range - 2) {
        e.vx = Math.sign(dx) * e.def.speed * 76;
        e.state = "walk";
      } else {
        e.vx *= 0.4;
      }
      e.vz = adz > 12 ? Math.sign(dz) * e.def.depthSpeed * 58 : 0;

      if (e.aiTimer <= 0 && adx < range + 10 && adz < 18) {
        e.startAttack(false);
        e.aiTimer = 0.55 + Math.random() * 0.7;
      }
    }
  }

  private resolveHits(): void {
    const actors = [this.player, ...this.enemies.filter((e) => e.alive)];
    for (const atk of actors) {
      const hit = atk.activeHit();
      if (!hit) continue;
      for (const tgt of actors) {
        if (tgt === atk || tgt.team === atk.team || !tgt.alive) continue;
        if (Math.abs(tgt.wz - atk.wz) > (atk.def.kind === "rex" ? 28 : 16)) continue;
        const dx = tgt.wx - atk.wx;
        const dist = Math.abs(dx);
        const gun = atk.state === "shoot";
        const facingOk = dist < 14 || dx * atk.facing > 0;
        const inRange = gun
          ? facingOk && dist < hit.range && dist > 10
          : facingOk && dist < hit.range;
        if (!inRange) continue;
        atk.consumeHit();
        const dir = (atk.facing) as 1 | -1;
        tgt.takeHit(hit.dmg, dir, hit.kb, hit.knockdown);
        this.juice.hitStop(hit.knockdown ? 70 : 42);
        this.juice.screenShake(hit.knockdown ? 0.01 : 0.004, hit.knockdown ? 140 : 70);
        this.juice.sparks(tgt.x, tgt.y - 30, dir);
        this.juice.floatText(tgt.x, tgt.y - 50, String(Math.round(hit.dmg)));
        if (atk.team === "player") {
          this.comboHits += 1;
          this.comboTimer = 1.6;
          this.score += Math.round(hit.dmg * 10 * (1 + this.comboHits * 0.05));
          if (!tgt.alive || tgt.hp <= 0) this.score += tgt.scoreValue;
        }
        if (atk.wantsThrow && tgt.hp > 0) {
          tgt.takeHit(8, dir, 240, true);
          this.juice.floatText(tgt.x, tgt.y - 70, "ARREMESSO", "#3ee0c8");
        }
        break;
      }
    }
  }

  private separate(): void {
    const all = [this.player, ...this.enemies.filter((e) => e.alive && e.grounded())];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = b.wx - a.wx;
        const dz = b.wz - a.wz;
        if (Math.abs(dx) < 26 && Math.abs(dz) < 14) {
          const push = 16;
          a.wx -= Math.sign(dx || 1) * push * 0.5;
          b.wx += Math.sign(dx || 1) * push * 0.5;
        }
      }
    }
  }

  private spawnPickup(kind: PickupKind, x: number, z: number): void {
    const y = STAGE.groundBase - z * 0.92;
    const view = this.add.container(x, y);
    const color = kind === "meat" ? 0xc04040 : kind === "pipe" ? 0x8a9aaa : 0xd4a017;
    view.add(this.add.rectangle(0, 0, 16, 12, color).setStrokeStyle(2, 0x140c08));
    view.setDepth(z + 5);
    this.tweens.add({ targets: view, y: y - 6, yoyo: true, repeat: -1, duration: 400 });
    this.pickups.push({ kind, x, z, view });
  }

  private tryPickup(): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Math.abs(this.player.wx - p.x) < 22 && Math.abs(this.player.wz - p.z) < 16) {
        const label = this.player.givePickup(p.kind);
        this.juice.floatText(this.player.x, this.player.y - 40, label, "#7dffb0");
        p.view.destroy();
        this.pickups.splice(i, 1);
      }
    }
  }

  private onPlayerDown(): void {
    if (this.ended) return;
    this.lives -= 1;
    if (this.lives < 0) {
      this.ended = true;
      this.announce("FIM DE JOGO");
      this.time.delayedCall(1600, () => this.showEnd("A Helix fica com a cidade.", false));
      return;
    }
    this.player.alive = true;
    this.player.hp = this.player.maxHp;
    this.player.state = "idle";
    this.player.stateT = 0;
    this.player.invuln = 1.5;
    this.player.wx = Math.max(80, this.player.wx - 40);
    this.announce(`RESTAM ${this.lives} VIDAS`);
  }

  private victory(): void {
    if (this.ended) return;
    this.ended = true;
    this.score += 10000;
    this.announce("CONTRATO CUMPRIDO");
    this.time.delayedCall(1800, () => this.showEnd("Ashjaw cai. Yucca Prime respira.", true));
  }

  private showEnd(msg: string, win: boolean): void {
    const { width, height } = this.scale;
    const g = this.add.rectangle(width / 2, height / 2, width, height, 0x07060a, 0.72).setScrollFactor(0).setDepth(900);
    this.add
      .text(width / 2, height / 2 - 30, win ? "VITÓRIA" : "DERROTA", {
        fontFamily: "Bungee, sans-serif",
        fontSize: "36px",
        color: win ? "#3ee0c8" : "#ff6a4a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(901);
    this.add
      .text(width / 2, height / 2 + 16, `${msg}\nPONTOS ${this.score}`, {
        fontFamily: "Rajdhani, sans-serif",
        fontSize: "16px",
        color: "#f2e6d4",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(901);
    this.add
      .text(width / 2, height / 2 + 80, "ENTER — menu", {
        fontFamily: "Rajdhani, sans-serif",
        fontSize: "14px",
        color: "#9aa0a8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(901);
    void g;
    this.input.keyboard?.once("keydown-ENTER", () => {
      this.game.events.emit("match-end");
      this.scene.start("MenuScene");
    });
  }

  private announce(text: string): void {
    if (!this.banner) return;
    this.banner.setText(text);
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 900, duration: 400 });
  }

  private emitHud(): void {
    const boss = this.enemies.find((e) => e.def.kind === "rex" && e.alive);
    this.game.events.emit("hud", {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      score: this.score,
      lives: Math.max(0, this.lives),
      combo: this.comboHits,
      name: this.player.def.name,
      special: this.player.def.specialName,
      ammo: this.player.ammo,
      weapon: this.player.weapon,
      boss: boss ? { name: boss.def.name, hp: boss.hp, max: boss.maxHp } : null,
    });
  }
}
