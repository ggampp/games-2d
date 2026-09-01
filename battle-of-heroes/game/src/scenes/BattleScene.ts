import Phaser from "phaser";
import { HEROES, getHero, scaledHero, type HeroDef } from "../data/heroes";
import { BARRACKS_UPGRADE, STAGES, type StageDef } from "../data/stages";
import { heroLevel, loadSave, writeSave, type SaveData } from "../save/SaveGame";
import { audio } from "../audio/AudioManager";
import { FONT } from "../ui/UiBits";
import { Juice } from "../systems/Juice";
import { Unit } from "../systems/Unit";
import { rollDamage } from "../systems/Combat";

interface BattleData {
  stageId: number;
}

interface Projectile {
  img: Phaser.GameObjects.Image;
  vx: number;
  target: Unit | null;
  from: Unit;
  life: number;
}

export class BattleScene extends Phaser.Scene {
  private save!: SaveData;
  private stage!: StageDef;
  private juice = new Juice();
  private playerUnits: Unit[] = [];
  private enemyUnits: Unit[] = [];
  private projectiles: Projectile[] = [];
  private gold = 0;
  private enemyGold = 0;
  private playerHp = 1;
  private enemyHp = 1;
  private playerMax = 1;
  private enemyMax = 1;
  private ended = false;
  private spawnCd: number[] = [];
  private enemyCd = 0.8;
  private goldText!: Phaser.GameObjects.Text;
  private playerBar!: Phaser.GameObjects.Image;
  private enemyBar!: Phaser.GameObjects.Image;
  private playerKeep!: Phaser.GameObjects.Image;
  private enemyKeep!: Phaser.GameObjects.Image;
  private playerLv = 1;
  private enemyLv = 1;
  private ground = 575;
  private lane = 0;

  constructor() {
    super("battle");
  }

  init(data: BattleData): void {
    this.stage = STAGES.find((s) => s.id === data.stageId) ?? STAGES[0];
    this.save = loadSave();
    this.juice = new Juice();
    this.playerUnits = [];
    this.enemyUnits = [];
    this.projectiles = [];
    this.ended = false;
    this.lane = 0;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.playerLv = this.save.barracksLevel;
    this.enemyLv = Math.min(5, 1 + Math.floor((this.stage.id - 1) / 2));
    const upgrade = BARRACKS_UPGRADE[this.playerLv - 1];
    this.playerMax = this.stage.barracksHp + (upgrade?.hpBonus ?? 0);
    this.enemyMax = Math.round(this.stage.barracksHp * 0.92);
    this.playerHp = this.playerMax;
    this.enemyHp = this.enemyMax;
    this.gold = this.stage.playerStartGold;
    this.enemyGold = this.stage.enemyStartGold;
    this.spawnCd = this.save.party.map(() => 0);

    this.add.image(w / 2, h / 2 + 8, this.stage.bg).setDisplaySize(w, h + 16);

    this.playerKeep = this.add.image(108, this.ground + 8, this.keepTex(this.playerLv, 1)).setOrigin(0.5, 1).setDepth(8).setScale(0.85);
    this.enemyKeep = this.add
      .image(w - 108, this.ground + 8, this.keepTex(this.enemyLv, 1))
      .setOrigin(0.5, 1)
      .setFlipX(true)
      .setDepth(8)
      .setScale(0.85);

    this.add.image(70, 40, "hp-green-bg").setOrigin(0, 0.5).setScale(0.38, 0.65).setDepth(60);
    this.playerBar = this.add.image(70, 40, "hp-green").setOrigin(0, 0.5).setScale(0.38, 0.65).setDepth(61);
    this.add.image(w - 70, 40, "hp-red-bg").setOrigin(1, 0.5).setScale(0.38, 0.65).setDepth(60);
    this.enemyBar = this.add.image(w - 70, 40, "hp-red").setOrigin(1, 0.5).setScale(0.38, 0.65).setDepth(61);
    this.add.image(w / 2, 42, "vs").setScale(0.5).setDepth(62);

    this.add.image(w / 2, 88, "gold-bar").setScale(0.62).setDepth(62);
    this.goldText = this.add
      .text(w / 2 - 16, 86, "0", { fontFamily: FONT, fontSize: "22px", color: "#fff4c8" })
      .setOrigin(0.5)
      .setDepth(63);

    this.add
      .text(w / 2, 68, this.stage.name, {
        fontFamily: FONT,
        fontSize: "18px",
        color: "#fff4c8",
        stroke: "#3b2208",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(62);

    this.buildDock();
    const back = this.add
      .text(24, 18, "◀", { fontFamily: FONT, fontSize: "28px", color: "#fff4c8" })
      .setDepth(80)
      .setInteractive({ useHandCursor: true });
    back.on("pointerup", () => this.scene.start("map"));
  }

  private keepTex(level: number, hpRatio: number): string {
    if (hpRatio > 0.8) return `barrack-${level}`;
    if (hpRatio > 0.6) return `barrack-${level}-d1`;
    if (hpRatio > 0.4) return `barrack-${level}-d2`;
    if (hpRatio > 0.2) return `barrack-${level}-d3`;
    return `barrack-${level}-d4`;
  }

  private buildDock(): void {
    const { width: w, height: h } = this.scale;
    const n = this.save.party.length;
    this.save.party.forEach((id, i) => {
      const hero = scaledHero(getHero(id), heroLevel(this.save, id));
      const x = w / 2 + (i - (n - 1) / 2) * 118;
      const y = h - 70;
      const slot = this.add.container(x, y).setDepth(70);
      const icon = this.add.image(0, -10, `icon-${id}`).setScale(0.58);
      const cost = this.add
        .text(0, 36, `${hero.cost}g`, {
          fontFamily: FONT,
          fontSize: "16px",
          color: "#fff4c8",
          stroke: "#3b2208",
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      const dim = this.add.rectangle(0, -6, 86, 86, 0x000000, 0.45).setVisible(false);
      slot.add([icon, dim, cost]);
      slot.setSize(96, 110);
      slot.setInteractive({ useHandCursor: true });
      slot.on("pointerup", () => this.trySpawn(i, hero, dim));
      slot.setData("dim", dim);
      slot.setData("hero", hero);
    });
    this.add
      .text(w / 2, h - 132, "TOQUE NO HERÓI PARA INVOCAR", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#fff4c8",
        stroke: "#3b2208",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(70)
      .setAlpha(0.85);
  }

  private trySpawn(index: number, hero: HeroDef, dim: Phaser.GameObjects.Rectangle): void {
    if (this.ended) return;
    if (this.spawnCd[index] > 0 || this.gold < hero.cost) {
      audio.deny();
      this.tweens.add({ targets: dim, alpha: 0.7, duration: 60, yoyo: true });
      return;
    }
    if (this.playerUnits.filter((u) => u.alive).length >= 12) {
      audio.deny();
      return;
    }
    this.gold -= hero.cost;
    this.spawnCd[index] = hero.cooldown;
    this.spawnUnit(hero, "player");
    audio.spawn();
  }

  private spawnUnit(hero: HeroDef, team: "player" | "enemy"): void {
    const y = this.ground + ((this.lane++ % 3) - 1) * 14;
    const x = team === "player" ? 190 : this.scale.width - 190;
    const unit = new Unit(this, hero, team, x, y, team === "player" ? 1 : -1);
    (team === "player" ? this.playerUnits : this.enemyUnits).push(unit);
  }

  update(_t: number, rawDt: number): void {
    const dt = this.juice.update(this, rawDt);
    if (this.ended || dt <= 0) return;
    const sec = dt / 1000;
    const incomeBonus = BARRACKS_UPGRADE[this.playerLv - 1]?.incomeBonus ?? 0;
    this.gold += (this.stage.playerIncome + incomeBonus) * sec;
    this.enemyGold += this.stage.enemyIncome * sec;
    this.goldText.setText(String(Math.floor(this.gold)));
    this.spawnCd = this.spawnCd.map((c) => Math.max(0, c - sec));
    this.enemyCd -= sec;

    this.children.list.forEach((obj) => {
      if (obj instanceof Phaser.GameObjects.Container && obj.getData("hero")) {
        const hero = obj.getData("hero") as HeroDef;
        const dim = obj.getData("dim") as Phaser.GameObjects.Rectangle;
        const i = this.save.party.indexOf(hero.id);
        const blocked = this.gold < hero.cost || (this.spawnCd[i] ?? 0) > 0;
        dim.setVisible(blocked);
      }
    });

    if (this.enemyCd <= 0) {
      this.enemyThink();
      this.enemyCd = 0.9 + Math.random() * 0.5;
    }

    const spawnProj = (from: Unit, tx: number, ty: number) => this.fire(from, tx, ty);
    const hitEnemyBase = (d: number, crit: boolean) => this.hurtBase("enemy", d, crit);
    const hitPlayerBase = (d: number, crit: boolean) => this.hurtBase("player", d, crit);

    this.playerUnits.forEach((u) =>
      u.update(dt, this.playerUnits, this.enemyUnits, this.scale.width - 130, hitEnemyBase, this.juice, this, spawnProj),
    );
    this.enemyUnits.forEach((u) =>
      u.update(dt, this.enemyUnits, this.playerUnits, 130, hitPlayerBase, this.juice, this, spawnProj),
    );
    this.updateProjectiles(dt);
    this.playerUnits = this.playerUnits.filter((u) => u.alive || u.sprite.active);
    this.enemyUnits = this.enemyUnits.filter((u) => u.alive || u.sprite.active);
    this.refreshKeep();
  }

  private fire(from: Unit, tx: number, ty: number): void {
    const id = from.hero.projectile ?? 4;
    const img = this.add.image(from.x + from.dir * 30, from.y - 78, `proj-${id}`).setDepth(22).setScale(0.55);
    const dx = tx - img.x;
    const dy = ty - img.y;
    const len = Math.hypot(dx, dy) || 1;
    img.setRotation(Math.atan2(dy, dx));
    this.projectiles.push({
      img,
      vx: (dx / len) * 420,
      target: from.team === "player" ? this.closest(this.enemyUnits, tx) : this.closest(this.playerUnits, tx),
      from,
      life: 1.4,
    });
  }

  private closest(list: Unit[], x: number): Unit | null {
    let best: Unit | null = null;
    let d = 9999;
    for (const u of list) {
      if (!u.alive) continue;
      const dd = Math.abs(u.x - x);
      if (dd < d) {
        d = dd;
        best = u;
      }
    }
    return best;
  }

  private updateProjectiles(dt: number): void {
    const sec = dt / 1000;
    this.projectiles = this.projectiles.filter((p) => {
      p.life -= sec;
      p.img.x += (p.from.dir > 0 ? 1 : -1) * 420 * sec;
      const foes = p.from.team === "player" ? this.enemyUnits : this.playerUnits;
      const hit = foes.find((u) => u.alive && Math.abs(u.x - p.img.x) < 36 && Math.abs(u.y - 70 - p.img.y) < 90);
      if (hit) {
        const { damage, crit } = rollDamage(p.from.hero.atk, hit.hero.def);
        hit.applyProjectile(damage, crit, this.juice, this, p.from.hero.damageType);
        this.juice.flash(this, p.img.x, p.img.y);
        p.img.destroy();
        return false;
      }
      if (p.life <= 0 || p.img.x < 0 || p.img.x > this.scale.width) {
        p.img.destroy();
        return false;
      }
      return true;
    });
  }

  private enemyThink(): void {
    if (this.enemyUnits.filter((u) => u.alive).length >= 12) return;
    const roster = this.stage.enemyIds.map((id) => scaledHero(getHero(id), Math.max(1, Math.ceil(this.stage.id / 3))));
    const affordable = roster.filter((h) => h.cost <= this.enemyGold);
    if (!affordable.length) return;
    const playerRoles = this.playerUnits.filter((u) => u.alive).map((u) => u.hero.role);
    let best = affordable[0];
    let bestScore = -999;
    for (const h of affordable) {
      let score = Math.random() * 8;
      score += this.enemyGold > h.cost * 2 ? h.atk * 0.2 : 12 - h.cost * 0.05;
      if (playerRoles.includes("ranged") && h.role === "melee") score += 6;
      if (playerRoles.filter((r) => r === "swarm").length > 2 && h.role === "tank") score += 8;
      if (h.role === "ranged" && this.playerUnits.some((u) => u.alive && u.hero.role === "tank")) score += 4;
      if (score > bestScore) {
        bestScore = score;
        best = h;
      }
    }
    this.enemyGold -= best.cost;
    this.spawnUnit(best, "enemy");
  }

  private hurtBase(which: "player" | "enemy", dmg: number, crit: boolean): void {
    if (which === "player") this.playerHp = Math.max(0, this.playerHp - dmg);
    else this.enemyHp = Math.max(0, this.enemyHp - dmg);
    this.juice.shake(crit ? 180 : 90, crit ? 8 : 4);
    if (crit) this.juice.hitStop(40);
    this.refreshKeep();
    if (!this.ended && (this.playerHp <= 0 || this.enemyHp <= 0)) this.finish(this.enemyHp <= 0);
  }

  private refreshKeep(): void {
    const pr = this.playerHp / this.playerMax;
    const er = this.enemyHp / this.enemyMax;
    this.playerKeep.setTexture(this.keepTex(this.playerLv, pr));
    this.enemyKeep.setTexture(this.keepTex(this.enemyLv, er));
    this.playerBar.setCrop(0, 0, Math.max(4, 480 * pr), 62);
    this.enemyBar.setCrop(480 - Math.max(4, 480 * er), 0, Math.max(4, 480 * er), 62);
  }

  private finish(won: boolean): void {
    this.ended = true;
    if (won) audio.win();
    else audio.lose();
    this.juice.shake(320, 10);
    const { width: w, height: h } = this.scale;
    this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.45).setDepth(90);
    const box = this.add.image(w / 2, h / 2, "upgrade-box").setDisplaySize(520, 340).setDepth(91);
    const stars = won ? (this.playerHp / this.playerMax > 0.66 ? 3 : this.playerHp / this.playerMax > 0.33 ? 2 : 1) : 0;
    const reward = won ? 70 + this.stage.id * 22 + stars * 18 : 18;
    if (won) {
      this.save.stars[this.stage.id - 1] = Math.max(this.save.stars[this.stage.id - 1] ?? 0, stars);
      for (const hero of HEROES) {
        if (hero.unlockStage <= this.stage.id + 1 && !this.save.unlocked.includes(hero.id) && hero.shopCost === 0) {
          this.save.unlocked.push(hero.id);
        }
      }
    }
    this.save.gold += reward;
    writeSave(this.save);
    this.add
      .text(w / 2, h / 2 - 90, won ? "VITÓRIA" : "DERROTA", {
        fontFamily: FONT,
        fontSize: "48px",
        color: won ? "#ffe27a" : "#ff8a6a",
        stroke: "#3b2208",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(92);
    if (won) this.add.image(w / 2, h / 2 - 20, `stars-${stars}`).setScale(2.4).setDepth(92);
    this.add
      .text(w / 2, h / 2 + 40, `+${reward} ouro`, {
        fontFamily: FONT,
        fontSize: "26px",
        color: "#fff4c8",
        stroke: "#3b2208",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(92);
    const go = this.add
      .image(w / 2, h / 2 + 110, "btn-orange")
      .setScale(2)
      .setDepth(92)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(w / 2, h / 2 + 108, "MAPA", {
        fontFamily: FONT,
        fontSize: "24px",
        color: "#3b2208",
      })
      .setOrigin(0.5)
      .setDepth(93);
    go.on("pointerup", () => this.scene.start("map"));
    void box;
  }
}
