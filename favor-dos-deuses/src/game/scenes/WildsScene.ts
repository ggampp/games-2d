import Phaser from "phaser";
import { BaseGameScene, type Interactable } from "./BaseGameScene";
import { COLORS, UI_STRINGS, DEPTH } from "../../data/constants";
import { ENEMY_SPAWNS } from "../../data/enemies";
import { GODS } from "../../data/gods";
import { assetTracker, TILES } from "../../data/assets";
import { TileCanvas } from "../tiles";
import type { Enemy } from "../../entities/Enemy";

const WORLD_W = 1200;
const WORLD_H = 900;

/** Caminho de terra da entrada até o altar */
const PATH: { x: number; y: number }[] = [
  { x: 110, y: 830 },
  { x: 260, y: 760 },
  { x: 420, y: 690 },
  { x: 520, y: 560 },
  { x: 560, y: 420 },
  { x: 700, y: 330 },
  { x: 860, y: 300 },
  { x: 980, y: 330 },
];

export class WildsScene extends BaseGameScene {
  protected readonly locationName = UI_STRINGS.wilds_name;
  protected readonly locationColor = "#2ecc71";

  private enemiesKilled = 0;
  private readonly enemiesRequired = 3;
  private altarUsed = false;

  constructor() {
    super("WildsScene");
  }

  create(): void {
    super.create();
    this.setWorldSize(WORLD_W, WORLD_H);
    this.enemiesKilled = 0;
    this.altarUsed = false;

    this.drawGround();
    this.buildForest();
    this.buildAltar(1000, 300);
    this.spawnWildsEnemies();

    this.addPortal(90, 845, "HubScene", "Setessa", "wilds", 0xf1c40f);
    this.createPlayer(130, 800);
    this.finishSetup();

    this.time.delayedCall(700, () =>
      this.showMessage(`Cace ${this.enemiesRequired} criaturas e leve a oferenda ao altar de Nylea.`, 4500)
    );
  }

  // ------------------------------------------------------------------ chão

  private drawGround(): void {
    const cols = WORLD_W / 16;
    const rows = WORLD_H / 16;
    const tc = new TileCanvas(this, WORLD_W, WORLD_H, DEPTH.ground);
    const F = TILES.forest;
    const hasTiles = assetTracker.isLoaded("forest_ground");

    if (hasTiles) {
      tc.fill("forest_ground", 0, 0, cols, rows, () => {
        const r = Math.random();
        return r < 0.85 ? F.grass : r < 0.93 ? F.grass2 : F.grass3;
      });
    } else {
      tc.solid(COLORS.grass, 0, 0, cols, rows);
      for (let i = 0; i < 700; i++) {
        tc.solid(0x5a8f48, Phaser.Math.Between(0, cols - 1), Phaser.Math.Between(0, rows - 1), 1, 1, 0.5);
      }
    }

    // caminho de terra: manchas 3x3 ao longo dos segmentos
    const dirt9 = [F.dirtTL, F.dirtT, F.dirtTR, F.dirtL, F.dirtC, F.dirtR, F.dirtBL, F.dirtB, F.dirtBR];
    for (let i = 0; i < PATH.length - 1; i++) {
      const a = PATH[i];
      const b = PATH[i + 1];
      const len = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const steps = Math.ceil(len / 12);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 14;
        const y = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 14;
        const size = s % 2 === 0 ? 3 : 4;
        const c = Math.round(x / 16) - Math.floor(size / 2);
        const r = Math.round(y / 16) - Math.floor(size / 2);
        if (hasTiles) tc.blob("forest_ground", dirt9, c, r, size, size);
        else tc.solid(COLORS.dirt, c, r, size, size, 0.9);
      }
    }

    // clareira do altar
    if (hasTiles) tc.blob("forest_ground", dirt9, 58, 15, 10, 7);
    else tc.solid(COLORS.dirt, 58, 15, 10, 7);

    // pedrinhas
    if (hasTiles) {
      for (let i = 0; i < 24; i++) {
        tc.draw("forest_ground", F.rocks[Phaser.Math.Between(0, F.rocks.length - 1)], Phaser.Math.Between(0, cols - 1), Phaser.Math.Between(0, rows - 1), 0.9);
      }
    }
  }

  // ------------------------------------------------------------------ floresta

  private buildForest(): void {
    const has = assetTracker.isLoaded("tree1");
    const bigTrees = ["tree1", "tree2", "tree3", "tree5", "tree6"];
    const smallTrees = ["tree7", "tree8", "tree9", "tree12", "tree13"];
    const bushes = ["bush1", "bush2", "bush3", "bush11", "bush12"];
    const pick = (arr: string[]) => arr[Phaser.Math.Between(0, arr.length - 1)];

    const tree = (x: number, y: number, big = Math.random() > 0.4) => {
      if (has) {
        const key = pick(big ? bigTrees : smallTrees);
        this.placeObject(key, undefined, x, y, { block: big ? { w: 26, h: 16 } : { w: 18, h: 12 } });
      } else {
        this.placeObject("px", undefined, x, y, { scale: big ? 4 : 3, tint: 0x1e4d2b, block: { w: 20, h: 12 } });
      }
    };

    // muralha de árvores nas bordas (várias fileiras, deslocadas)
    for (let x = 20; x <= WORLD_W; x += 64) {
      tree(x + Phaser.Math.Between(-10, 10), 70 + Phaser.Math.Between(-20, 20), true);
      tree(x + 32 + Phaser.Math.Between(-10, 10), 20 + Phaser.Math.Between(-10, 10), true);
      tree(x + Phaser.Math.Between(-10, 10), WORLD_H + 40 + Phaser.Math.Between(-20, 10), true);
    }
    for (let y = 100; y <= WORLD_H; y += 64) {
      tree(20 + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-10, 10), true);
      tree(WORLD_W - 20 + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-10, 10), true);
    }

    // bosques internos (deixam o caminho livre)
    const groves = [
      { x: 250, y: 300, n: 7, r: 90 },
      { x: 780, y: 620, n: 8, r: 110 },
      { x: 1000, y: 780, n: 5, r: 80 },
      { x: 320, y: 560, n: 4, r: 60 },
      { x: 700, y: 160, n: 5, r: 70 },
      { x: 1050, y: 520, n: 4, r: 60 },
    ];
    for (const g of groves) {
      for (let i = 0; i < g.n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * g.r;
        tree(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d);
      }
    }

    if (!has) return;

    for (let i = 0; i < 30; i++) {
      this.placeObject(pick(bushes), undefined, Phaser.Math.Between(60, WORLD_W - 60), Phaser.Math.Between(110, WORLD_H - 60), {});
    }
    for (let i = 0; i < 16; i++) {
      const keys = ["mushroom1", "mushroom2", "mushroom3", "reeds1"];
      this.placeObject(pick(keys), undefined, Phaser.Math.Between(60, WORLD_W - 60), Phaser.Math.Between(110, WORLD_H - 60), {});
    }

    const stones: [string, number, number, number, number][] = [
      ["stone1", 640, 500, 40, 22],
      ["stone2", 380, 420, 36, 20],
      ["stone3", 860, 460, 30, 18],
      ["stone4", 200, 640, 18, 10],
      ["stone5", 560, 260, 16, 10],
      ["stone2", 1100, 700, 36, 20],
      ["stone4", 480, 800, 18, 10],
    ];
    for (const [k, x, y, w, h] of stones) this.placeObject(k, undefined, x, y, { block: { w, h } });

    this.placeObject("broken_tree1", undefined, 430, 250, { block: { w: 60, h: 16 } });
    this.placeObject("broken_tree2", undefined, 900, 700, { block: { w: 30, h: 14 } });
    this.placeObject("broken_tree4", undefined, 150, 500, { block: { w: 16, h: 10 } });
  }

  // ------------------------------------------------------------------ altar

  private buildAltar(x: number, y: number): void {
    const god = GODS.nylea;

    if (assetTracker.isLoaded("ruin_grass1")) {
      this.placeObject("ruin_grass1", undefined, x, y - 20, { block: { w: 70, h: 30 } });
      this.placeObject("ruin_grass4", undefined, x - 90, y + 10, { block: { w: 26, h: 16 } });
      this.placeObject("ruin_grass5", undefined, x + 90, y + 14, { block: { w: 26, h: 14 } });
      this.placeObject("ruin_grass3", undefined, x + 150, y - 60, { block: { w: 40, h: 24 } });
    } else {
      this.placeObject("px", undefined, x, y - 20, { scale: 6, tint: 0x8b7355, block: { w: 48, h: 30 } });
    }

    const torch = (tx: number, ty: number) => {
      const s = this.placeAnimated("dungeon_torches", "torch0", tx, ty, { tint: 0x9dffc0 });
      if (s) this.addGlow(tx, ty - 22, 26, 0x2ecc71, 0.28);
    };
    torch(x - 44, y + 40);
    torch(x + 44, y + 40);
    this.addGlow(x, y, 60, god.color, 0.14);

    this.add
      .text(x, y - 150, "Altar de Nylea", { fontSize: "12px", color: god.colorHex, stroke: "#000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay - 2);

    this.addInteractable(x, y + 10, "altar", "Altar de Nylea", { godId: "nylea" }, 54);
  }

  // ------------------------------------------------------------------ inimigos

  private spawnWildsEnemies(): void {
    const types = ENEMY_SPAWNS.wilds;
    const spots = [
      { x: 330, y: 700 },
      { x: 500, y: 520 },
      { x: 620, y: 380 },
      { x: 250, y: 420 },
      { x: 820, y: 560 },
      { x: 900, y: 240 },
      { x: 1050, y: 620 },
    ];
    spots.forEach((p, i) => this.spawnEnemy(p.x, p.y, types[i % types.length]));
  }

  protected onEnemyKilled(enemy: Enemy): void {
    super.onEnemyKilled(enemy);
    if (enemy.config.id === "erebos_shade") return;

    this.enemiesKilled++;
    if (this.enemiesKilled < this.enemiesRequired) {
      this.showMessage(`Caça: ${this.enemiesKilled}/${this.enemiesRequired}`);
    } else if (this.enemiesKilled === this.enemiesRequired) {
      this.showMessage("Você provou seu valor na caça! Leve a oferenda ao altar de Nylea.", 4500);
    }
  }

  protected getShadeSpawnPoint(): { x: number; y: number } {
    return { x: 420, y: 700 };
  }

  // ------------------------------------------------------------------ interação

  protected handleInteraction(it: Interactable): void {
    if (it.type !== "altar") return;

    if (this.altarUsed) {
      this.showMessage("O altar já recebeu sua oferenda nesta caçada.");
      return;
    }
    if (this.enemiesKilled < this.enemiesRequired) {
      this.showMessage(`Derrote mais ${this.enemiesRequired - this.enemiesKilled} criatura(s) antes de fazer a oferenda.`);
      return;
    }

    this.showOfferingDialog("nylea", "Altar de Nylea", "Você honrou a caça. Nylea sorri para você.", () => {
      this.altarUsed = true;
    });
  }
}
