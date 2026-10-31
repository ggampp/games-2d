import Phaser from "phaser";
import { Player } from "../../entities/Player";
import { Enemy } from "../../entities/Enemy";
import { ENEMIES } from "../../data/enemies";
import { PLAYER_CONFIG, DEPTH, GAME_WIDTH, GAME_HEIGHT } from "../../data/constants";
import { GODS, OFFERING_AMOUNT } from "../../data/gods";
import { DevotionSystem } from "../../systems/DevotionSystem";
import { BestowSystem } from "../../systems/BestowSystem";
import { CombatSystem } from "../../systems/CombatSystem";
import { SaveSystem } from "../../systems/SaveSystem";
import type { DialogData, DialogOption } from "../../ui/Dialog";
import type { HudState } from "../../ui/Hud";

export interface SceneData {
  devotionSystem?: DevotionSystem;
  bestowSystem?: BestowSystem;
  playerHp?: number;
  spawnPoint?: string;
}

export interface Interactable {
  x: number;
  y: number;
  type: string;
  label: string;
  radius: number;
  data?: any;
  /** objeto visual opcional (para efeitos ao interagir) */
  visual?: Phaser.GameObjects.GameObject;
  enabled: boolean;
}

interface PlaceOptions {
  originX?: number;
  originY?: number;
  depth?: number;
  scale?: number;
  flipX?: boolean;
  /** Corpo estático que bloqueia movimento (centrado em x, base em y) */
  block?: { w: number; h: number; offsetY?: number };
  tint?: number;
  alpha?: number;
}

export abstract class BaseGameScene extends Phaser.Scene {
  protected player!: Player;
  protected enemies: Enemy[] = [];
  protected obstacles!: Phaser.Physics.Arcade.StaticGroup;
  protected enemyGroup!: Phaser.Physics.Arcade.Group;
  protected interactables: Interactable[] = [];

  protected devotionSystem!: DevotionSystem;
  protected bestowSystem!: BestowSystem;
  protected combat!: CombatSystem;

  protected spawnPoint = "default";
  protected worldW = GAME_WIDTH;
  protected worldH = GAME_HEIGHT;
  protected dialogOpen = false;
  protected transitioning = false;
  protected abstract readonly locationName: string;
  protected abstract readonly locationColor: string;

  /**
   * Teclas "acabou de apertar" capturadas por evento (não por polling):
   * um toque rápido entre dois frames nunca se perde, mesmo com FPS baixo.
   */
  private pressedCodes = new Set<string>();
  private keys!: {
    up: Phaser.Input.Keyboard.Key[];
    down: Phaser.Input.Keyboard.Key[];
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
    attack: Phaser.Input.Keyboard.Key[];
    dodge: Phaser.Input.Keyboard.Key[];
    interact: Phaser.Input.Keyboard.Key[];
    pause: Phaser.Input.Keyboard.Key[];
    bestows: Phaser.Input.Keyboard.Key[];
  };
  private prompt!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Rectangle;
  private unsubscribeDevotion: (() => void) | null = null;
  private pendingHp: number | undefined;
  private curseTimer: Phaser.Time.TimerEvent | null = null;
  private lowHpWarned = false;

  init(data: SceneData): void {
    this.devotionSystem = data.devotionSystem ?? new DevotionSystem();
    this.bestowSystem = data.bestowSystem ?? new BestowSystem();
    this.pendingHp = data.playerHp;
    this.spawnPoint = data.spawnPoint ?? "default";
    this.dialogOpen = false;
    this.transitioning = false;
    this.enemies = [];
    this.interactables = [];
    this.curseTimer = null;
    this.lowHpWarned = false;
  }

  create(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const add = (...codes: number[]) => codes.map((c) => kb.addKey(c));
    this.keys = {
      up: add(K.W, K.UP),
      down: add(K.S, K.DOWN),
      left: add(K.A, K.LEFT),
      right: add(K.D, K.RIGHT),
      attack: add(K.SPACE, K.J),
      dodge: add(K.SHIFT, K.K),
      interact: add(K.E, K.ENTER),
      pause: add(K.ESC, K.P),
      bestows: add(K.ONE, K.TWO, K.THREE, K.FOUR),
    };

    this.pressedCodes.clear();
    kb.on("keydown", (ev: KeyboardEvent) => {
      if (!ev.repeat) this.pressedCodes.add(ev.code);
    });

    this.obstacles = this.physics.add.staticGroup();
    this.enemyGroup = this.physics.add.group();
    this.combat = new CombatSystem(this);
    this.combat.setBestowSystem(this.bestowSystem);

    this.setupDevotionListeners();

    this.prompt = this.buildPrompt();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeDevotion?.();
      this.unsubscribeDevotion = null;
      this.curseTimer?.remove();
      this.game.events.emit("hide-dialog");
      this.game.events.emit("blind", false);
    });
  }

  // ------------------------------------------------------------------ setup helpers

  protected setWorldSize(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
    this.physics.world.setBounds(0, 0, w, h);
    this.cameras.main.setBounds(0, 0, w, h);
  }

  protected createPlayer(x: number, y: number): void {
    this.player = new Player(this, x, y);
    if (this.pendingHp !== undefined) {
      this.player.hp = Phaser.Math.Clamp(this.pendingHp, 1, this.player.maxHp);
    }
  }

  /** Chamar no fim do create() da cena: colisões, câmera, transição, HUD. */
  protected finishSetup(): void {
    this.physics.add.collider(this.player.sprite, this.obstacles);
    this.physics.add.collider(this.enemyGroup, this.obstacles);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.collider(this.player.sprite, this.enemyGroup);

    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    if (this.worldW > GAME_WIDTH || this.worldH > GAME_HEIGHT) {
      cam.startFollow(this.player.sprite, true, 0.15, 0.15);
    } else {
      cam.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    }
    cam.fadeIn(450, 0, 0, 0);

    if (this.devotionSystem.hasBargained()) this.spawnErebosShade();

    this.game.events.emit("show-location", { name: this.locationName, color: this.locationColor });
    this.emitHudUpdate(this.time.now);
  }

  protected addBlocker(cx: number, cy: number, w: number, h: number): void {
    const r = this.add.rectangle(cx, cy, w, h, 0x000000, 0).setVisible(false);
    this.physics.add.existing(r, true);
    this.obstacles.add(r);
  }

  protected placeObject(
    key: string,
    frame: string | number | undefined,
    x: number,
    y: number,
    opts: PlaceOptions = {}
  ): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, key, frame);
    img.setOrigin(opts.originX ?? 0.5, opts.originY ?? 1);
    if (opts.scale) img.setScale(opts.scale);
    if (opts.flipX) img.setFlipX(true);
    if (opts.tint !== undefined) img.setTint(opts.tint);
    if (opts.alpha !== undefined) img.setAlpha(opts.alpha);
    img.setDepth(opts.depth ?? DEPTH.ySortBase + y);
    if (opts.block) {
      const b = opts.block;
      this.addBlocker(x, y - b.h / 2 + (b.offsetY ?? 0), b.w, b.h);
    }
    return img;
  }

  protected placeAnimated(
    key: string,
    anim: string,
    x: number,
    y: number,
    opts: PlaceOptions = {}
  ): Phaser.GameObjects.Sprite | null {
    if (!this.textures.exists(key) || !this.anims.exists(anim)) return null;
    const s = this.add.sprite(x, y, key);
    s.setOrigin(opts.originX ?? 0.5, opts.originY ?? 1);
    if (opts.scale) s.setScale(opts.scale);
    if (opts.flipX) s.setFlipX(true);
    if (opts.tint !== undefined) s.setTint(opts.tint);
    if (opts.alpha !== undefined) s.setAlpha(opts.alpha);
    s.setDepth(opts.depth ?? DEPTH.ySortBase + y);
    s.play({ key: anim, startFrame: Phaser.Math.Between(0, 3) });
    if (opts.block) {
      const b = opts.block;
      this.addBlocker(x, y - b.h / 2 + (b.offsetY ?? 0), b.w, b.h);
    }
    return s;
  }

  /** Luz suave (círculo aditivo) para tochas/altares */
  protected addGlow(x: number, y: number, radius: number, color: number, alpha = 0.25): Phaser.GameObjects.Image {
    const glow = this.add.image(x, y, "dot").setScale(radius / 8).setTint(color).setAlpha(alpha);
    glow.setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.groundDecor);
    this.tweens.add({
      targets: glow,
      alpha: alpha * 0.6,
      scale: (radius / 8) * 0.9,
      duration: 700 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    return glow;
  }

  protected addInteractable(
    x: number,
    y: number,
    type: string,
    label: string,
    data?: any,
    radius = 46,
    visual?: Phaser.GameObjects.GameObject
  ): Interactable {
    const it: Interactable = { x, y, type, label, data, radius, visual, enabled: true };
    this.interactables.push(it);
    return it;
  }

  /** Portal: círculo de partículas rodando + rótulo */
  protected addPortal(x: number, y: number, targetScene: string, label: string, spawnPoint: string, color = 0x9b59b6): void {
    const ring = this.add.circle(x, y, 18, color, 0.18).setDepth(DEPTH.groundDecor);
    ring.setStrokeStyle(2, color, 0.8);
    this.tweens.add({ targets: ring, scale: 1.15, alpha: 0.6, yoyo: true, repeat: -1, duration: 900, ease: "Sine.easeInOut" });

    for (let i = 0; i < 6; i++) {
      const p = this.add.image(x, y, "dot").setScale(0.35).setTint(color).setDepth(DEPTH.groundDecor + 1);
      p.setBlendMode(Phaser.BlendModes.ADD);
      const a0 = (i / 6) * Math.PI * 2;
      this.tweens.addCounter({
        from: 0,
        to: Math.PI * 2,
        duration: 2400,
        repeat: -1,
        onUpdate: (tw) => {
          const a = a0 + (tw.getValue() ?? 0);
          p.setPosition(x + Math.cos(a) * 14, y + Math.sin(a) * 7 - 4 + Math.sin(a * 2) * 2);
          p.setAlpha(0.5 + Math.sin(a) * 0.4);
        },
      });
    }

    this.add
      .text(x, y + 24, label, { fontSize: "11px", color: "#ffffff", stroke: "#000", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay - 2);

    this.addInteractable(x, y, "portal", `Ir para ${label}`, { targetScene, spawnPoint }, 40, ring);
  }

  protected spawnEnemy(x: number, y: number, configId: string): Enemy {
    const config = ENEMIES[configId] ?? ENEMIES.boar;
    const enemy = new Enemy(this, x, y, config);
    this.enemies.push(enemy);
    this.enemyGroup.add(enemy.sprite);
    return enemy;
  }

  protected spawnErebosShade(): void {
    const p = this.getShadeSpawnPoint();
    const shade = this.spawnEnemy(p.x, p.y, "erebos_shade");
    shade.sprite.setAlpha(0);
    this.tweens.add({ targets: shade.sprite, alpha: 0.9, duration: 1200 });
    this.time.delayedCall(800, () => this.showMessage("A sombra de Erebos te encontrou..."));
  }

  /** Ponto onde a sombra de Erebos aparece (longe do herói) */
  protected getShadeSpawnPoint(): { x: number; y: number } {
    const px = this.player.x;
    const py = this.player.y;
    const x = px < this.worldW / 2 ? this.worldW - 120 : 120;
    const y = py < this.worldH / 2 ? this.worldH - 120 : 120;
    return { x, y };
  }

  // ------------------------------------------------------------------ loop

  update(time: number): void {
    if (!this.player || this.transitioning) return;
    const now = time;

    if (this.justPressed("Escape", "KeyP")) {
      this.pressedCodes.clear();
      this.pauseGame();
      return;
    }

    if (this.dialogOpen) {
      this.pressedCodes.clear();
      this.player.controlsLocked = true;
      this.player.update({ x: 0, y: 0 }, now, 1);
      for (const e of this.enemies) e.sprite.setVelocity(0, 0);
      return;
    }
    this.player.controlsLocked = false;

    const input = {
      x: (this.anyDown(this.keys.right) ? 1 : 0) - (this.anyDown(this.keys.left) ? 1 : 0),
      y: (this.anyDown(this.keys.down) ? 1 : 0) - (this.anyDown(this.keys.up) ? 1 : 0),
    };

    this.bestowSystem.update(now);
    this.player.update(input, now, this.bestowSystem.getSpeedMultiplier());

    if (this.justPressed("Space", "KeyJ")) this.player.requestAttack(now);
    if (this.player.wantsAttack(now)) this.autoAim(input);
    if (this.player.consumeAttack(now)) this.resolvePlayerAttack(now);

    if (this.justPressed("ShiftLeft", "ShiftRight", "KeyK")) this.player.startDodge(now, input);

    ["Digit1", "Digit2", "Digit3", "Digit4"].forEach((code, i) => {
      if (this.justPressed(code)) this.activateBestow(i, now);
    });

    const heal = this.bestowSystem.takePendingHeal();
    if (heal > 0) this.combat.heal(this.player, heal);

    this.updateEnemies(now);
    this.updatePrompt();

    if (this.justPressed("KeyE", "Enter", "NumpadEnter")) this.tryInteract();

    if (this.player.hp <= 25 && !this.lowHpWarned) {
      this.lowHpWarned = true;
      this.showMessage("Vida baixa! Use ☀️ Raio Solar (se tiver) ou volte à taverna.");
    }
    if (this.player.hp > 40) this.lowHpWarned = false;

    if (this.player.statusEffect === "Cego") {
      const cam = this.cameras.main;
      this.game.events.emit("blind-pos", { x: this.player.x - cam.scrollX, y: this.player.y - 10 - cam.scrollY });
    }

    this.emitHudUpdate(now);
    this.pressedCodes.clear();
  }

  private justPressed(...codes: string[]): boolean {
    return codes.some((c) => this.pressedCodes.has(c));
  }

  private anyDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
    return keys.some((k) => k.isDown);
  }

  /** Parado (sem input de direção), o golpe vira para o inimigo mais próximo ao alcance */
  private autoAim(input: { x: number; y: number }): void {
    if (input.x !== 0 || input.y !== 0) return;
    const maxDist = PLAYER_CONFIG.attackRange * 1.6;
    let best: Enemy | null = null;
    let bestDist = maxDist;
    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    if (best) this.player.faceToward(best.x, best.y);
  }

  private resolvePlayerAttack(now: number): void {
    const angle = this.player.getAttackAngle();
    const range = PLAYER_CONFIG.attackRange;
    const arc = Phaser.Math.DegToRad(PLAYER_CONFIG.attackArc);
    const px = this.player.x;
    const py = this.player.y;
    const boosted = this.bestowSystem.getDamageMultiplier() > 1;

    this.combat.createSlash(px, py - 6, angle, range, boosted ? 0x7dffb3 : 0xffffff);

    let anyHit = false;
    for (const enemy of [...this.enemies]) {
      if (enemy.state === "dead") continue;
      const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
      if (dist > range + enemy.config.bodyRadius) continue;
      const a = Phaser.Math.Angle.Between(px, py, enemy.x, enemy.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(a - angle)) > arc && dist > enemy.config.bodyRadius + 6) continue;

      const damage = this.player.damage * this.bestowSystem.getDamageMultiplier();
      const res = this.combat.applyDamage(enemy, damage, now, 0, { x: px, y: py, knockback: PLAYER_CONFIG.knockback });
      if (!res.hit) continue;
      anyHit = true;
      this.combat.createHitEffect(enemy.x, enemy.y - 8, boosted ? 0x7dffb3 : 0xffffff);
      enemy.onHit(now);
      if (res.killed) this.onEnemyKilled(enemy);
    }

    if (anyHit) {
      this.combat.hitStop(40);
      this.cameras.main.shake(60, 0.002);
    }
  }

  protected onEnemyKilled(enemy: Enemy): void {
    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.enemyGroup.remove(enemy.sprite);
    enemy.die();

    if (enemy.config.id === "erebos_shade") {
      this.devotionSystem.setBargained(false);
      this.showMessage("A sombra de Erebos se dissipa. Você está livre da barganha.");
      this.persist();
      return;
    }

    if (enemy.config.dropDevotion) {
      const { godId, amount } = enemy.config.dropDevotion;
      const god = GODS[godId];
      this.devotionSystem.addDevotion(godId, amount);
      this.combat.showFloatingText(enemy.x, enemy.y - 34, `+${amount} ${god.name}`, god.colorHex);
      this.spawnDevotionMotes(enemy.x, enemy.y, god.color);
    }
  }

  private spawnDevotionMotes(x: number, y: number, color: number): void {
    for (let i = 0; i < 5; i++) {
      const m = this.add.image(x, y - 6, "dot").setScale(0.3).setTint(color).setDepth(DEPTH.overlay);
      m.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: m,
        x: x + (Math.random() - 0.5) * 30,
        y: y - 40 - Math.random() * 20,
        alpha: 0,
        scale: 0.1,
        duration: 700 + Math.random() * 300,
        delay: i * 50,
        ease: "Cubic.easeOut",
        onComplete: () => m.destroy(),
      });
    }
  }

  private updateEnemies(now: number): void {
    const px = this.player.x;
    const py = this.player.y;
    const alive = this.player.hp > 0;

    for (const enemy of [...this.enemies]) {
      const res = enemy.update(px, py, now, alive);
      if (!res.attackLanded || !alive) continue;

      const dist = Phaser.Math.Distance.Between(px, py, enemy.x, enemy.y);
      if (dist > enemy.config.attackRange + 14) continue;

      const r = this.combat.applyDamage(this.player, enemy.damage, now, PLAYER_CONFIG.invincibilityDuration, {
        x: enemy.x,
        y: enemy.y,
        knockback: 140,
      });
      if (r.hit && r.damage > 0) {
        this.combat.createHitEffect(px, py - 8, 0xff6b6b);
        this.cameras.main.shake(120, 0.006);
        this.game.events.emit("player-hit");
        if (this.player.hp <= 0) this.onPlayerDeath();
      }
    }
  }

  protected onPlayerDeath(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.controlsLocked = true;
    this.player.sprite.setVelocity(0, 0);
    this.game.events.emit("hide-dialog");

    this.tweens.add({ targets: this.player.sprite, alpha: 0, angle: 90, y: this.player.y + 6, duration: 700 });
    this.cameras.main.fade(900, 20, 5, 30);
    this.time.delayedCall(950, () => {
      this.scene.start("UnderworldScene", {
        devotionSystem: this.devotionSystem,
        bestowSystem: this.bestowSystem,
        returnScene: this.scene.key,
      });
    });
  }

  private activateBestow(slot: number, now: number): void {
    const bestow = this.bestowSystem.getEquippedBestow(slot);
    if (!bestow) {
      this.showMessage(`Slot ${slot + 1} vazio — ganhe Devoção para desbloquear bênçãos.`);
      return;
    }
    if (this.bestowSystem.canActivate(bestow, now)) {
      this.bestowSystem.activate(bestow, now);
      const god = GODS[bestow.godId];
      this.showMessage(`${bestow.icon} ${bestow.name}!`);
      this.combat.showFloatingText(this.player.x, this.player.y - 30, bestow.name, god.colorHex);
      const ring = this.add.circle(this.player.x, this.player.y, 10).setStrokeStyle(2, god.color).setDepth(DEPTH.overlay);
      this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
    } else if (this.bestowSystem.isActive(bestow.id)) {
      this.showMessage(`${bestow.name} já está ativa.`);
    } else {
      const remaining = Math.ceil(this.bestowSystem.getCooldownRemaining(bestow.id, now) / 1000);
      this.showMessage(`${bestow.name}: aguarde ${remaining}s`);
    }
  }

  // ------------------------------------------------------------------ interação

  private buildPrompt(): Phaser.GameObjects.Container {
    this.promptBg = this.add.rectangle(0, 0, 10, 20, 0x000000, 0.75).setStrokeStyle(1, 0xf1c40f, 0.9);
    this.promptText = this.add.text(0, 0, "", { fontSize: "11px", color: "#ffffff" }).setOrigin(0.5);
    const c = this.add.container(0, 0, [this.promptBg, this.promptText]);
    c.setDepth(DEPTH.overlay).setVisible(false);
    return c;
  }

  private findNearestInteractable(): Interactable | null {
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const it of this.interactables) {
      if (!it.enabled) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (d <= it.radius && d < bestDist) {
        best = it;
        bestDist = d;
      }
    }
    return best;
  }

  private updatePrompt(): void {
    const it = this.findNearestInteractable();
    if (!it) {
      this.prompt.setVisible(false);
      return;
    }
    const label = `[E] ${it.label}`;
    if (this.promptText.text !== label) {
      this.promptText.setText(label);
      this.promptBg.setSize(this.promptText.width + 14, 20);
    }
    this.prompt.setPosition(this.player.x, this.player.y - 44);
    this.prompt.setVisible(true);
  }

  private tryInteract(): void {
    const it = this.findNearestInteractable();
    if (!it) return;
    if (it.type === "portal") {
      this.goToScene(it.data.targetScene, it.data.spawnPoint);
      return;
    }
    this.handleInteraction(it);
  }

  protected handleInteraction(_it: Interactable): void {}

  // ------------------------------------------------------------------ diálogo

  protected showDialog(data: DialogData): void {
    this.dialogOpen = true;
    this.player.sprite.setVelocity(0, 0);
    const wrapped: DialogOption[] = (data.options ?? []).map((o) => ({
      text: o.text,
      callback: () => {
        this.closeDialog();
        o.callback();
      },
    }));
    this.game.events.emit("show-dialog", { ...data, options: wrapped });
  }

  protected closeDialog(): void {
    this.dialogOpen = false;
    this.game.events.emit("hide-dialog");
    // evita que o Enter/E que fechou o diálogo reabra na mesma tecla
    this.pressedCodes.clear();
  }

  /** Diálogo padrão de oferenda em templo/altar */
  protected showOfferingDialog(godId: string, speaker: string, text: string, onDone?: () => void): void {
    const god = GODS[godId];
    const current = this.devotionSystem.getDevotion(godId);
    const next = this.devotionSystem.getNextMilestone(godId);
    const hint = next ? ` — próxima bênção em ${next}` : " — favor máximo";

    this.showDialog({
      speaker,
      text: `${text}\n\nDevoção a ${god.name}: ${current}/100${hint}`,
      options: [
        {
          text: `Fazer oferenda (+${OFFERING_AMOUNT} Devoção)`,
          callback: () => {
            this.devotionSystem.addDevotion(godId, OFFERING_AMOUNT);
            this.combat.showFloatingText(this.player.x, this.player.y - 30, `+${OFFERING_AMOUNT} ${god.name}`, god.colorHex);
            this.spawnDevotionMotes(this.player.x, this.player.y, god.color);
            this.afterOffering();
            this.persist();
            onDone?.();
          },
        },
        { text: "Apenas rezar", callback: () => this.showMessage(god.greeting) },
        { text: "Sair", callback: () => {} },
      ],
    });
  }

  protected afterOffering(): void {
    if (this.devotionSystem.isJealousyPending()) {
      this.time.delayedCall(1500, () => this.devotionSystem.triggerJealousyEvent());
    }
  }

  private setupDevotionListeners(): void {
    this.devotionSystem.clearListeners();
    this.unsubscribeDevotion = this.devotionSystem.on((event) => {
      if (event.type === "bestow_unlocked" && event.bestow) {
        const slot = this.bestowSystem.autoEquip(event.bestow);
        const key = slot >= 0 ? ` (tecla ${slot + 1})` : "";
        this.showMessage(`✨ Bênção desbloqueada: ${event.bestow.icon} ${event.bestow.name}${key}`, 4500);
        this.cameras.main.flash(300, 255, 240, 180);
        this.persist();
      } else if (event.type === "jealousy_warning" && event.message) {
        this.showMessage(`⚡ ${event.message}`, 4500);
        this.cameras.main.shake(200, 0.004);
      } else if (event.type === "jealousy_event" && event.godId) {
        this.applyJealousyEffect(event.godId, event.message ?? "");
      }
    });
  }

  private applyJealousyEffect(godId: string, message: string): void {
    this.showMessage(`☠ ${message}`, 5000);
    this.cameras.main.shake(350, 0.008);

    if (godId === "nylea") {
      // maldição de espinhos: dano ao longo do tempo
      let ticks = 4;
      this.player.statusEffect = "Espinhos";
      this.curseTimer = this.time.addEvent({
        delay: 900,
        repeat: ticks - 1,
        callback: () => {
          ticks--;
          if (this.player.hp <= 0) return;
          this.player.hp = Math.max(1, this.player.hp - 4);
          this.combat.showFloatingText(this.player.x, this.player.y - 22, "-4 🌿", "#2ecc71");
          for (let i = 0; i < 4; i++) {
            const t = this.add.rectangle(this.player.x + (Math.random() - 0.5) * 20, this.player.y - Math.random() * 20, 2, 6, 0x2ecc71)
              .setDepth(DEPTH.overlay)
              .setAngle(Math.random() * 360);
            this.tweens.add({ targets: t, alpha: 0, y: t.y - 12, duration: 500, onComplete: () => t.destroy() });
          }
          if (ticks <= 0) this.player.statusEffect = null;
        },
      });
    } else {
      // cegueira: escurece a visão por alguns segundos
      this.player.statusEffect = "Cego";
      this.game.events.emit("blind", true);
      this.time.delayedCall(4500, () => {
        this.game.events.emit("blind", false);
        this.player.statusEffect = null;
      });
    }
    this.devotionSystem.clearJealousy();
  }

  // ------------------------------------------------------------------ fluxo

  protected goToScene(targetScene: string, spawnPoint: string): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.controlsLocked = true;
    this.player.sprite.setVelocity(0, 0);
    this.prompt.setVisible(false);
    this.persist();

    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.time.delayedCall(360, () => {
      this.scene.start(targetScene, {
        devotionSystem: this.devotionSystem,
        bestowSystem: this.bestowSystem,
        playerHp: this.player.hp,
        spawnPoint,
      });
    });
  }

  protected pauseGame(): void {
    if (this.dialogOpen) return;
    this.game.events.emit("paused", this.scene.key);
    this.scene.pause();
  }

  protected persist(): void {
    SaveSystem.save({
      devotion: this.devotionSystem.serialize(),
      equipped: this.bestowSystem.serializeEquipped(),
      playerHp: this.player?.hp ?? PLAYER_CONFIG.maxHp,
      bargained: this.devotionSystem.hasBargained(),
    });
  }

  protected showMessage(text: string, duration = 3000): void {
    this.game.events.emit("show-message", { text, duration });
  }

  protected emitHudUpdate(now: number): void {
    const slots = this.bestowSystem.getEquippedSlots();
    const state: HudState = {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      nylea: this.devotionSystem.getDevotion("nylea"),
      heliod: this.devotionSystem.getDevotion("heliod"),
      nextNylea: this.devotionSystem.getNextMilestone("nylea"),
      nextHeliod: this.devotionSystem.getNextMilestone("heliod"),
      bestows: slots.map((b) =>
        b
          ? {
              bestow: b,
              active: this.bestowSystem.isActive(b.id),
              cooldown: this.bestowSystem.getCooldownFraction(b, now),
              activeFraction: this.bestowSystem.getActiveFraction(b, now),
            }
          : null
      ),
      dodgeCooldown: this.player.getDodgeCooldownFraction(now),
      shield: this.bestowSystem.hasShield(),
      status: this.player.statusEffect,
      bargained: this.devotionSystem.hasBargained(),
    };
    this.game.events.emit("hud-update", state);
  }
}
