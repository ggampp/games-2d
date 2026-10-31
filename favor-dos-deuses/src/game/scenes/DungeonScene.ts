import Phaser from "phaser";
import { BaseGameScene, type Interactable } from "./BaseGameScene";
import { COLORS, UI_STRINGS, DEPTH, PLAYER_CONFIG } from "../../data/constants";
import { ENEMY_SPAWNS } from "../../data/enemies";
import { GODS } from "../../data/gods";
import { assetTracker, TILES } from "../../data/assets";
import { TileCanvas } from "../tiles";
import type { Enemy } from "../../entities/Enemy";

const COLS = 70;
const ROWS = 46;
const WORLD_W = COLS * 16;
const WORLD_H = ROWS * 16;

/** Salas e corredores em coordenadas de tile (inclusivas) */
const ROOMS: { c0: number; c1: number; r0: number; r1: number; name: string }[] = [
  { c0: 4, c1: 18, r0: 30, r1: 42, name: "entrada" },
  { c0: 19, c1: 29, r0: 34, r1: 37, name: "corredor1" },
  { c0: 30, c1: 46, r0: 26, r1: 42, name: "central" },
  { c0: 36, c1: 40, r0: 14, r1: 25, name: "corredor2" },
  { c0: 26, c1: 50, r0: 4, r1: 13, name: "altar" },
  { c0: 47, c1: 55, r0: 32, r1: 35, name: "corredor3" },
  { c0: 56, c1: 66, r0: 26, r1: 40, name: "tesouro" },
];

export class DungeonScene extends BaseGameScene {
  protected readonly locationName = UI_STRINGS.dungeon_name;
  protected readonly locationColor = "#f1c40f";

  private enemiesKilled = 0;
  private readonly enemiesRequired = 4;
  private altarUsed = false;
  private chestOpened = false;
  private grid: Uint8Array = new Uint8Array(COLS * ROWS);
  private spikes: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super("DungeonScene");
  }

  create(): void {
    super.create();
    this.setWorldSize(WORLD_W, WORLD_H);
    this.enemiesKilled = 0;
    this.altarUsed = false;
    this.chestOpened = false;
    this.spikes = [];

    this.cameras.main.setBackgroundColor(COLORS.dungeonVoid);
    this.buildGrid();
    this.drawTiles();
    this.decorate();
    this.buildAltar();
    this.spawnDungeonEnemies();

    const entryX = 11 * 16 + 8;
    const entryY = 30 * 16;
    if (assetTracker.isLoaded("dungeon_arches")) {
      this.placeObject("dungeon_arches", "arch_dark", entryX, entryY + 2, { depth: DEPTH.groundDecor + 2 });
    }
    this.addPortal(entryX, entryY + 34, "HubScene", "Setessa", "dungeon", 0xf1c40f);

    this.createPlayer(entryX, entryY + 70);
    this.finishSetup();

    this.time.delayedCall(700, () =>
      this.showMessage(`Purifique ${this.enemiesRequired} mortos-vivos e leve a oferenda ao altar de Heliod.`, 4500)
    );
  }

  // ------------------------------------------------------------------ grid

  private isFloor(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
    return this.grid[r * COLS + c] === 1;
  }

  private buildGrid(): void {
    this.grid.fill(0);
    for (const room of ROOMS) {
      for (let r = room.r0; r <= room.r1; r++) {
        for (let c = room.c0; c <= room.c1; c++) this.grid[r * COLS + c] = 1;
      }
    }
  }

  private drawTiles(): void {
    const tc = new TileCanvas(this, WORLD_W, WORLD_H, DEPTH.ground);
    const D = TILES.dungeon;
    const hasTiles = assetTracker.isLoaded("dungeon_tiles");
    const wallCells = new Set<number>();
    const mark = (c: number, r: number) => {
      if (c >= 0 && r >= 0 && c < COLS && r < ROWS) wallCells.add(r * COLS + c);
    };

    // piso
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!this.isFloor(c, r)) continue;
        if (hasTiles) tc.draw("dungeon_tiles", D.floorVariants[Phaser.Math.Between(0, D.floorVariants.length - 1)], c, r);
        else tc.solid(COLORS.dungeonFloor, c, r, 1, 1);
      }
    }

    // rachaduras
    if (hasTiles) {
      for (let i = 0; i < 40; i++) {
        const room = ROOMS[Phaser.Math.Between(0, ROOMS.length - 1)];
        const c = Phaser.Math.Between(room.c0, room.c1);
        const r = Phaser.Math.Between(room.r0, room.r1);
        tc.draw("dungeon_tiles", D.cracks[Phaser.Math.Between(0, D.cracks.length - 1)], c, r, 0.7);
      }
    }

    // paredes
    const drawWall = (frame: number, c: number, r: number) => {
      if (this.isFloor(c, r)) return;
      if (hasTiles) tc.draw("dungeon_tiles", frame, c, r);
      else tc.solid(0x3a3542, c, r, 1, 1);
      mark(c, r);
    };

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!this.isFloor(c, r)) continue;
        // norte: parede espessa (3 tiles) — estende 1 tile nos cantos
        if (!this.isFloor(c, r - 1)) {
          for (const dc of [-1, 0, 1]) {
            if (dc !== 0 && this.isFloor(c + dc, r)) continue;
            if (dc !== 0 && this.isFloor(c + dc, r - 1)) continue;
            drawWall(D.wallBase, c + dc, r - 1);
            drawWall(D.wallFace, c + dc, r - 2);
            drawWall(D.wallTopEdge, c + dc, r - 3);
          }
        }
        // sul: frente da parede (1 tile) — estende nos cantos
        if (!this.isFloor(c, r + 1)) {
          for (const dc of [-1, 0, 1]) {
            if (dc !== 0 && this.isFloor(c + dc, r)) continue;
            if (dc !== 0 && this.isFloor(c + dc, r + 1)) continue;
            drawWall(D.wallFront, c + dc, r + 1);
          }
        }
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!this.isFloor(c, r)) continue;
        // leste/oeste: colunas finas (só onde ainda não há parede)
        for (const dc of [-1, 1]) {
          const wc = c + dc;
          if (this.isFloor(wc, r) || wallCells.has(r * COLS + wc)) continue;
          const up = wallCells.has((r - 1) * COLS + wc) || this.isFloor(wc, r - 1);
          const down = wallCells.has((r + 1) * COLS + wc) || this.isFloor(wc, r + 1) || !this.isFloor(c, r + 1);
          const frame = !up ? D.thinTop : !down ? D.thinBottom : D.thinMid;
          drawWall(frame, wc, r);
        }
      }
    }

    // colisores: mescla células de parede por linha
    for (let r = 0; r < ROWS; r++) {
      let start = -1;
      for (let c = 0; c <= COLS; c++) {
        const isWall = c < COLS && wallCells.has(r * COLS + c);
        if (isWall && start < 0) start = c;
        if (!isWall && start >= 0) {
          const w = (c - start) * 16;
          this.addBlocker(start * 16 + w / 2, r * 16 + 8, w, 16);
          start = -1;
        }
      }
    }
  }

  // ------------------------------------------------------------------ decoração

  private decorate(): void {
    const has = assetTracker.isLoaded("dungeon_objects");
    const px = (c: number) => c * 16 + 8;
    const py = (r: number) => r * 16;

    // tochas nas paredes norte de cada sala
    const torchAt = (c: number, r0: number, tint = 0xffffff) => {
      const x = px(c);
      const y = py(r0) - 4;
      const s = this.placeAnimated("dungeon_torches", "torch1", x, y, { depth: DEPTH.groundDecor + 3, tint });
      if (s) this.addGlow(x, y - 20, 24, tint === 0xffffff ? 0x7fe0d0 : tint, 0.14);
      else this.addGlow(x, y - 12, 30, 0xffa040, 0.25);
    };
    torchAt(6, 30);
    torchAt(16, 30);
    torchAt(32, 26);
    torchAt(44, 26);
    torchAt(58, 26);
    torchAt(64, 26);
    torchAt(38, 14);

    if (!has) return;

    // sala de entrada
    this.placeObject("dungeon_objects", "bones_b", px(6), py(40), {});
    this.placeObject("dungeon_objects", "skull_small", px(15), py(38), {});
    this.placeObject("dungeon_coffins", "coffin_lid", px(5), py(33), { block: { w: 18, h: 10 } });

    // sala central
    this.placeObject("dungeon_coffins", "sarcophagus", px(38), py(35), { block: { w: 48, h: 22 } });
    this.placeObject("dungeon_coffins", "coffin_stone", px(31), py(30), { block: { w: 26, h: 14 } });
    this.placeObject("dungeon_coffins", "coffin_skeleton", px(45), py(30), { block: { w: 18, h: 10 } });
    this.placeObject("dungeon_objects", "bones_a", px(34), py(41), {});
    this.placeObject("dungeon_objects", "skull_small", px(42), py(39), {});
    this.placeObject("dungeon_objects", "crystal", px(31), py(41), {});
    this.addGlow(px(31), py(41) - 8, 18, 0x7fe0d0, 0.25);
    if (assetTracker.isLoaded("dungeon_arches")) {
      this.placeObject("dungeon_arches", "pillar", px(33), py(29), { block: { w: 18, h: 10 } });
      this.placeObject("dungeon_arches", "pillar", px(43), py(29), { block: { w: 18, h: 10 } });
    }
    if (assetTracker.isLoaded("dungeon_skull")) {
      this.placeObject("dungeon_skull", "skull_relief", px(38), py(26) - 12, { depth: DEPTH.groundDecor + 3 });
    }

    // sala do tesouro
    this.placeObject("dungeon_objects", "gold_pile", px(64), py(38), {});
    this.placeObject("dungeon_objects", "gold_pile", px(58), py(29), {});
    this.placeObject("dungeon_coffins", "coffin_open", px(62), py(30), { block: { w: 40, h: 18 } });
    this.placeObject("dungeon_coffins", "coffin_wood", px(57), py(35), { block: { w: 24, h: 12 } });

    const chest = this.placeObject("dungeon_chest", "chest_closed", px(61), py(37), { block: { w: 22, h: 10 } });
    this.addInteractable(px(61), py(37) - 6, "chest", "Abrir baú", undefined, 40, chest);

    // armadilhas de espinhos
    this.placeSpikes(px(51), py(33) + 8);
    this.placeSpikes(px(60), py(33) + 8);
    this.placeSpikes(px(24), py(35) + 8);
  }

  private placeSpikes(x: number, y: number): void {
    const s = this.placeAnimated("spikes", "spikes_cycle", x, y, { originY: 0.5, depth: DEPTH.groundDecor + 1 });
    if (!s) return;
    this.spikes.push(s);
  }

  // ------------------------------------------------------------------ altar

  private buildAltar(): void {
    const god = GODS.heliod;
    const x = 38 * 16 + 8;
    const yTop = 4 * 16;

    if (assetTracker.isLoaded("dungeon_arches")) {
      this.placeObject("dungeon_arches", "alcove_altar", x, yTop + 18, { depth: DEPTH.groundDecor + 3 });
      this.addBlocker(x, yTop + 8, 52, 16);
      this.placeObject("dungeon_objects", "statue_b", x - 48, yTop + 30, { block: { w: 14, h: 8 } });
      this.placeObject("dungeon_objects", "statue_b", x + 48, yTop + 30, { block: { w: 14, h: 8 }, flipX: true });
      this.placeObject("dungeon_arches", "pillar", 28 * 16, yTop + 40, { block: { w: 18, h: 10 } });
      this.placeObject("dungeon_arches", "pillar", 49 * 16, yTop + 40, { block: { w: 18, h: 10 } });
    } else {
      this.placeObject("px", undefined, x, yTop + 20, { scale: 4, tint: 0xd4c4a8, block: { w: 32, h: 16 } });
    }

    if (assetTracker.isLoaded("dungeon_tiles")) {
      const tc = new TileCanvas(this, WORLD_W, WORLD_H, DEPTH.groundDecor);
      const slab = TILES.dungeon.slab;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tc.draw("dungeon_tiles", slab[r][c], 37 + c, 5 + r);
    }

    const torch = (tx: number) => {
      const s = this.placeAnimated("dungeon_torches", "torch0", tx, yTop + 48, { tint: 0xffd166 });
      if (s) this.addGlow(tx, yTop + 26, 30, 0xf1c40f, 0.3);
    };
    torch(x - 30);
    torch(x + 30);
    this.addGlow(x, yTop + 20, 70, god.color, 0.18);

    // caixões ao longo da parede norte da sala do altar
    if (assetTracker.isLoaded("dungeon_coffins")) {
      for (const c of [28, 31, 45, 48]) {
        this.placeObject("dungeon_coffins", "coffin_lid", c * 16 + 8, yTop + 30, { block: { w: 18, h: 10 } });
      }
    }

    this.add
      .text(x, yTop - 10, "Altar de Heliod", { fontSize: "12px", color: god.colorHex, stroke: "#000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay - 2);

    this.addInteractable(x, yTop + 34, "altar", "Altar de Heliod", { godId: "heliod" }, 50);
  }

  // ------------------------------------------------------------------ inimigos

  private spawnDungeonEnemies(): void {
    const types = ENEMY_SPAWNS.dungeon;
    const spots = [
      { c: 15, r: 40 },
      { c: 24, r: 36 },
      { c: 34, r: 38 },
      { c: 42, r: 33 },
      { c: 38, r: 20 },
      { c: 32, r: 9 },
      { c: 46, r: 10 },
      { c: 60, r: 34 },
      { c: 64, r: 30 },
    ];
    spots.forEach((p, i) => this.spawnEnemy(p.c * 16 + 8, p.r * 16 + 8, types[i % types.length]));
  }

  protected onEnemyKilled(enemy: Enemy): void {
    super.onEnemyKilled(enemy);
    if (enemy.config.id === "erebos_shade") return;

    this.enemiesKilled++;
    if (this.enemiesKilled < this.enemiesRequired) {
      this.showMessage(`Purificados: ${this.enemiesKilled}/${this.enemiesRequired}`);
    } else if (this.enemiesKilled === this.enemiesRequired) {
      this.showMessage("A luz de Heliod brilha sobre você! Leve a oferenda ao altar.", 4500);
    }
  }

  protected getShadeSpawnPoint(): { x: number; y: number } {
    return { x: 26 * 16, y: 36 * 16 };
  }

  update(time: number): void {
    super.update(time);
    if (!this.player || this.transitioning || this.dialogOpen) return;

    // espinhos ferem quando estendidos
    for (const s of this.spikes) {
      const idx = s.anims.currentFrame?.index ?? 0;
      if (idx < 6) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y + 8);
      if (d < 18) {
        const r = this.combat.applyDamage(this.player, 8, time, PLAYER_CONFIG.invincibilityDuration, { x: s.x, y: s.y + 30, knockback: 120 });
        if (r.hit && r.damage > 0) {
          this.cameras.main.shake(100, 0.005);
          this.game.events.emit("player-hit");
          if (this.player.hp <= 0) this.onPlayerDeath();
        }
      }
    }
  }

  // ------------------------------------------------------------------ interação

  protected handleInteraction(it: Interactable): void {
    if (it.type === "chest") {
      if (this.chestOpened) {
        this.showMessage("O baú está vazio.");
        return;
      }
      this.chestOpened = true;
      it.enabled = false;
      (it.visual as Phaser.GameObjects.Image | undefined)?.setFrame("chest_open");
      const healed = this.combat.heal(this.player, 35);
      this.showMessage(healed > 0 ? `Você encontra um elixir. +${healed} de vida.` : "Você encontra um elixir, mas já está saudável.");
      this.cameras.main.flash(200, 255, 220, 120);
      return;
    }

    if (it.type !== "altar") return;
    if (this.altarUsed) {
      this.showMessage("O altar já recebeu sua oferenda nesta incursão.");
      return;
    }
    if (this.enemiesKilled < this.enemiesRequired) {
      this.showMessage(`Purifique mais ${this.enemiesRequired - this.enemiesKilled} morto(s)-vivo(s) antes da oferenda.`);
      return;
    }
    this.showOfferingDialog("heliod", "Altar de Heliod", "Você trouxe justiça aos mortos-vivos. Heliod abençoa você.", () => {
      this.altarUsed = true;
    });
  }
}
