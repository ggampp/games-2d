import Phaser from "phaser";
import { getTier } from "../../data/cats.ts";
import { ENEMIES, type EnemyKind } from "../../data/enemies.ts";
import { CELL, createGrid, WALL_BAR, type GridCell } from "../../data/layout.ts";
import { BASE_HP, START_COINS, WAVES } from "../../data/waves.ts";
import {
  addCoins,
  canRepair,
  canUpgrade,
  placeCat,
  placeCost,
  repairWall,
  upgradeCats,
  upgradeCost,
  type EconomyState,
} from "../../systems/economy.ts";
import { applyDamage, pickTarget, type CombatEnemy } from "../../systems/combat.ts";
import { advanceT, createLanes, pointOnPath, type Lane } from "../../systems/path.ts";

type BattleEnemy = CombatEnemy & {
  kind: EnemyKind;
  sprite: Phaser.GameObjects.Sprite;
  bar: Phaser.GameObjects.Rectangle;
  barBg: Phaser.GameObjects.Rectangle;
};

type SlotView = {
  cell: GridCell;
  occupied: boolean;
  pad: Phaser.GameObjects.Rectangle;
  cat?: Phaser.GameObjects.Sprite;
  cooldown: number;
};

export class BattleScene extends Phaser.Scene {
  private economy!: EconomyState;
  private lanes: Lane[] = [];
  private slots: SlotView[] = [];
  private enemies: BattleEnemy[] = [];
  private nextEnemyId = 1;
  private waveIndex = 0;
  private waveTime = 0;
  private spawned = new Set<string>();
  private ended = false;
  private shake = 0;
  private wallFill!: Phaser.GameObjects.Rectangle;

  constructor() {
    super("BattleScene");
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, "area").setDisplaySize(width, height).setDepth(0);
    this.lanes = createLanes();
    this.economy = {
      coins: START_COINS,
      catLevel: 1,
      wallHp: BASE_HP,
      slots: createGrid().map((cell) => ({ id: cell.id, occupied: false })),
    };
    this.slots = createGrid().map((cell) => this.makeSlot(cell));
    this.makeWallBar();
    this.emitHud();
    this.game.events.on("hud-upgrade", this.onUpgrade, this);
    this.game.events.on("hud-repair", this.onRepair, this);
    this.events.on("shutdown", () => {
      this.game.events.off("hud-upgrade", this.onUpgrade, this);
      this.game.events.off("hud-repair", this.onRepair, this);
      this.game.events.emit("battle-hud", null);
    });
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;
    this.waveTime += delta;
    this.spawnDue();
    this.tickEnemies(delta);
    this.tickCats(delta);
    this.applyShake();
    this.checkEnd();
  }

  private makeSlot(cell: GridCell): SlotView {
    const pad = this.add.rectangle(cell.x, cell.y, CELL.w - 10, CELL.h - 16, 0x2a3340, 0.22)
      .setStrokeStyle(2, 0xffffff, 0.28)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });
    const view: SlotView = { cell, occupied: false, pad, cooldown: 0 };
    pad.on("pointerdown", () => this.onSlot(view));
    return view;
  }

  private makeWallBar(): void {
    this.add.rectangle(WALL_BAR.x, WALL_BAR.y + WALL_BAR.h / 2, WALL_BAR.w + 8, WALL_BAR.h + 10, 0x3a3f48).setDepth(8);
    this.wallFill = this.add.rectangle(WALL_BAR.x, WALL_BAR.y + WALL_BAR.h, WALL_BAR.w, WALL_BAR.h, 0x7dce5a)
      .setOrigin(0.5, 1)
      .setDepth(9);
    this.syncWall();
  }

  private syncWall(): void {
    this.wallFill.height = WALL_BAR.h * (this.economy.wallHp / BASE_HP);
    this.wallFill.setFillStyle(this.economy.wallHp > 4 ? 0x7dce5a : 0xe35b4a);
  }

  private onSlot(view: SlotView): void {
    if (this.ended) return;
    const slot = this.economy.slots[view.cell.id];
    if (!placeCat(this.economy, slot)) return;
    view.occupied = true;
    this.spawnCat(view);
    this.emitHud();
    this.beep(520, 0.07);
  }

  private spawnCat(view: SlotView): void {
    const anim = getTier(this.economy.catLevel).anim;
    const sprite = this.add.sprite(view.cell.x, view.cell.y - 8, `${anim}-idle-0`)
      .setScale(0.36)
      .setDepth(5);
    sprite.play(`${anim}-idle`);
    this.tweens.add({ targets: sprite, scale: 0.46, duration: 240, ease: "Back.easeOut" });
    view.cat = sprite;
  }

  private refreshCats(): void {
    const anim = getTier(this.economy.catLevel).anim;
    for (const slot of this.slots) {
      if (!slot.cat) continue;
      slot.cat.play(`${anim}-idle`);
    }
  }

  private onUpgrade = (): void => {
    if (this.ended || !upgradeCats(this.economy)) return;
    this.refreshCats();
    this.emitHud();
    this.beep(700, 0.08);
  };

  private onRepair = (): void => {
    if (this.ended || !repairWall(this.economy)) return;
    this.syncWall();
    this.emitHud();
    this.beep(420, 0.07);
  };

  private spawnDue(): void {
    if (this.waveIndex >= WAVES.length) return;
    const wave = WAVES[this.waveIndex];
    for (let i = 0; i < wave.spawns.length; i++) {
      const key = `${wave.id}-${i}`;
      const spawn = wave.spawns[i];
      if (this.spawned.has(key) || this.waveTime < spawn.delay) continue;
      this.spawned.add(key);
      this.spawnEnemy(spawn.kind, spawn.lane);
    }
  }

  private spawnEnemy(kind: EnemyKind, laneId: number): void {
    const def = ENEMIES[kind];
    const lane = this.lanes[laneId] ?? this.lanes[0];
    const pos = pointOnPath(lane.points, 0);
    const sprite = this.add.sprite(pos.x, pos.y, `${def.walkAnim}-0`)
      .setScale(def.scale)
      .setDepth(6 + laneId);
    sprite.play(def.walkAnim);
    const barBg = this.add.rectangle(pos.x, pos.y - 58, 56, 8, 0x2b2118).setDepth(10);
    const bar = this.add.rectangle(pos.x, pos.y - 58, 52, 5, 0x7dce5a).setDepth(11);
    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      hp: def.hp,
      maxHp: def.hp,
      t: 0,
      x: pos.x,
      y: pos.y,
      points: lane.points,
      alive: true,
      sprite,
      bar,
      barBg,
    });
  }

  private tickEnemies(delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const def = ENEMIES[enemy.kind];
      enemy.t = advanceT(enemy.points, enemy.t, (def.speed * delta) / 1000);
      const pos = pointOnPath(enemy.points, enemy.t);
      enemy.x = pos.x;
      enemy.y = pos.y;
      enemy.sprite.setPosition(pos.x, pos.y);
      enemy.bar.setPosition(pos.x, pos.y - 58);
      enemy.barBg.setPosition(pos.x, pos.y - 58);
      enemy.bar.width = 52 * (enemy.hp / enemy.maxHp);
      if (enemy.t >= 1) this.leak(enemy);
    }
  }

  private tickCats(delta: number): void {
    const tier = getTier(this.economy.catLevel);
    for (const slot of this.slots) {
      if (!slot.occupied || !slot.cat) continue;
      slot.cooldown = Math.max(0, slot.cooldown - delta);
      if (slot.cooldown > 0) continue;
      const target = pickTarget({
        slotId: slot.cell.id,
        tier: this.economy.catLevel,
        x: slot.cell.x,
        y: slot.cell.y,
        cooldown: slot.cooldown,
      }, this.enemies);
      if (!target) continue;
      slot.cooldown = tier.fireRate;
      this.shoot(slot, target as BattleEnemy);
    }
  }

  private shoot(slot: SlotView, enemy: BattleEnemy): void {
    const tier = getTier(this.economy.catLevel);
    if (slot.cat) {
      const anim = `${tier.anim}-shoot`;
      slot.cat.play(anim);
      slot.cat.once("animationcomplete", () => {
        if (slot.cat) slot.cat.play(`${tier.anim}-idle`);
      });
    }
    const flash = this.add.sprite(slot.cell.x + 54, slot.cell.y - 10, "muzzle-0").setScale(0.35).setDepth(7);
    flash.play("muzzle-play");
    flash.once("animationcomplete", () => flash.destroy());
    const dead = applyDamage(enemy, tier.damage);
    this.floatText(enemy.x, enemy.y - 70, `-${tier.damage}`, "#fff4d6");
    enemy.sprite.setTintFill(0xffffff);
    this.time.delayedCall(70, () => enemy.sprite.clearTint());
    if (dead) this.kill(enemy);
    this.beep(880, 0.035);
  }

  private kill(enemy: BattleEnemy): void {
    addCoins(this.economy, ENEMIES[enemy.kind].reward);
    const boom = this.add.sprite(enemy.x, enemy.y, "boom-0").setScale(0.55).setDepth(12);
    boom.play("boom-play");
    boom.once("animationcomplete", () => boom.destroy());
    enemy.sprite.destroy();
    enemy.bar.destroy();
    enemy.barBg.destroy();
    this.floatText(enemy.x, enemy.y - 36, `+${ENEMIES[enemy.kind].reward}`, "#ffe27a");
    this.emitHud();
    if (enemy.kind === "boss1") this.shake = 10;
  }

  private leak(enemy: BattleEnemy): void {
    enemy.alive = false;
    this.economy.wallHp = Math.max(0, this.economy.wallHp - ENEMIES[enemy.kind].leakDamage);
    enemy.sprite.destroy();
    enemy.bar.destroy();
    enemy.barBg.destroy();
    this.syncWall();
    this.shake = 12;
    this.emitHud();
    this.beep(180, 0.12);
  }

  private checkEnd(): void {
    if (this.economy.wallHp <= 0) {
      this.finish(false);
      return;
    }
    const wave = WAVES[this.waveIndex];
    const waveDone = wave && this.spawned.size >= this.spawnedCountUpTo(this.waveIndex) && this.enemies.every((e) => !e.alive);
    if (waveDone && this.waveIndex < WAVES.length - 1) {
      this.waveIndex += 1;
      this.waveTime = 0;
      this.emitHud();
      return;
    }
    if (this.waveIndex === WAVES.length - 1 && waveDone) this.finish(true);
  }

  private spawnedCountUpTo(index: number): number {
    let n = 0;
    for (let i = 0; i <= index; i++) n += WAVES[i].spawns.length;
    return n;
  }

  private finish(won: boolean): void {
    this.ended = true;
    this.game.events.emit("battle-end", { won, coins: this.economy.coins, hp: this.economy.wallHp });
  }

  private emitHud(): void {
    this.game.events.emit("battle-hud", {
      coins: this.economy.coins,
      hp: this.economy.wallHp,
      wave: Math.min(this.waveIndex + 1, WAVES.length),
      maxWave: WAVES.length,
      catLevel: this.economy.catLevel,
      place: placeCost(),
      upgrade: upgradeCost(this.economy),
      canUpgrade: canUpgrade(this.economy),
      canRepair: canRepair(this.economy),
    });
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, {
      fontFamily: '"Passion One", Impact, sans-serif',
      fontSize: "22px",
      color,
      stroke: "#2b1a10",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(14);
    this.tweens.add({ targets: label, y: y - 40, alpha: 0, duration: 480, onComplete: () => label.destroy() });
  }

  private applyShake(): void {
    if (this.shake <= 0) {
      this.cameras.main.setScroll(0, 0);
      return;
    }
    this.cameras.main.setScroll((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.shake *= 0.86;
    if (this.shake < 0.4) this.shake = 0;
  }

  private beep(freq: number, duration: number): void {
    try {
      const sound = this.sound as Phaser.Sound.WebAudioSoundManager;
      const ctx = sound.context;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "square";
      gain.gain.value = 0.035;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // locked audio
    }
  }
}
