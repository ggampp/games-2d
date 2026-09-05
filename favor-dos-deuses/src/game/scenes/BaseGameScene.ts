import Phaser from "phaser";
import { Player } from "../../entities/Player";
import { Enemy } from "../../entities/Enemy";
import { ENEMIES, type EnemyConfig } from "../../data/enemies";
import { PLAYER_CONFIG, GAME_WIDTH, GAME_HEIGHT } from "../../data/constants";
import { DevotionSystem } from "../../systems/DevotionSystem";
import { BestowSystem } from "../../systems/BestowSystem";
import { CombatSystem } from "../../systems/CombatSystem";
import { BESTOWS } from "../../data/bestows";

export abstract class BaseGameScene extends Phaser.Scene {
  protected player!: Player;
  protected enemies: Enemy[] = [];
  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  protected wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  protected attackKey!: Phaser.Input.Keyboard.Key;
  protected dodgeKey!: Phaser.Input.Keyboard.Key;
  protected interactKey!: Phaser.Input.Keyboard.Key;
  protected bestowKeys!: Phaser.Input.Keyboard.Key[];

  protected devotionSystem!: DevotionSystem;
  protected bestowSystem!: BestowSystem;
  protected combatSystem!: CombatSystem;

  protected interactables: { sprite: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc; type: string; data?: any }[] = [];

  init(data: { devotionSystem?: DevotionSystem; bestowSystem?: BestowSystem; playerHp?: number }): void {
    this.devotionSystem = data.devotionSystem ?? new DevotionSystem();
    this.bestowSystem = data.bestowSystem ?? new BestowSystem();

    if (data.playerHp !== undefined && this.player) {
      this.player.hp = data.playerHp;
    }
  }

  create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.dodgeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.bestowKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
    ];

    this.combatSystem = new CombatSystem(this);
    this.combatSystem.setBestowSystem(this.bestowSystem);

    this.setupDevotionListeners();
  }

  private setupDevotionListeners(): void {
    this.devotionSystem.on((event) => {
      if (event.type === "bestow_unlocked" && event.bestow) {
        this.showMessage(`Bênção Desbloqueada: ${event.bestow.name}!`);

        const slots = this.bestowSystem.getEquippedSlots();
        const emptySlot = slots.findIndex((s) => s === null);
        if (emptySlot >= 0) {
          this.bestowSystem.equipBestow(emptySlot, event.bestow);
        }
      } else if (event.type === "jealousy_warning" && event.message) {
        this.showMessage(event.message);
      }
    });
  }

  protected createPlayer(x: number, y: number, preserveHp: boolean = false): void {
    const prevHp = this.player?.hp;
    if (this.player) {
      this.player.destroy();
    }
    this.player = new Player(this, x, y);
    if (preserveHp && prevHp !== undefined) {
      this.player.hp = prevHp;
    }
  }

  protected spawnEnemy(x: number, y: number, configId: string): Enemy {
    const config = ENEMIES[configId];
    if (!config) {
      console.warn(`Unknown enemy config: ${configId}`);
      return this.spawnEnemy(x, y, "boar");
    }
    const enemy = new Enemy(this, x, y, config);
    this.enemies.push(enemy);
    return enemy;
  }

  protected clearEnemies(): void {
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];
  }

  update(time: number, delta: number): void {
    if (!this.player) return;

    const now = time;

    this.player.update(this.cursors, this.wasd, delta, now);
    this.bestowSystem.update(now);

    if (Phaser.Input.Keyboard.JustDown(this.attackKey) && this.player.canAttack(now)) {
      this.player.performAttack(now);
      this.handlePlayerAttack(now);
    }

    if (Phaser.Input.Keyboard.JustDown(this.dodgeKey)) {
      this.player.startDodge(now);
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.checkInteractions();
    }

    for (let i = 0; i < this.bestowKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.bestowKeys[i])) {
        this.activateBestow(i, now);
      }
    }

    this.updateEnemies(delta, now);
    this.constrainPlayer();

    const healAmount = this.bestowSystem.getHealAmount();
    if (healAmount > 0) {
      this.combatSystem.heal(this.player, healAmount);
      this.showMessage(`+${healAmount} HP`);
    }

    this.emitHudUpdate();
  }

  private handlePlayerAttack(now: number): void {
    const pos = this.player.getAttackPosition();

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;

      const dist = Phaser.Math.Distance.Between(
        pos.x,
        pos.y,
        enemy.sprite.x,
        enemy.sprite.y
      );

      if (dist <= PLAYER_CONFIG.attackRange + enemy.config.size / 2) {
        let damage = this.player.damage;
        damage *= this.bestowSystem.getDamageMultiplier();

        const killed = enemy.takeDamage(damage);
        this.combatSystem.createHitEffect(enemy.sprite.x, enemy.sprite.y);

        if (killed) {
          this.onEnemyKilled(enemy);
        }
      }
    }
  }

  protected onEnemyKilled(enemy: Enemy): void {
    enemy.die();

    if (enemy.config.dropDevotion) {
      const { godId, amount } = enemy.config.dropDevotion;
      this.devotionSystem.addDevotion(godId, amount);
      this.showMessage(`+${amount} Devoção (${godId === "nylea" ? "Nylea" : "Heliod"})`);
    }

    const idx = this.enemies.indexOf(enemy);
    if (idx >= 0) {
      this.enemies.splice(idx, 1);
    }
  }

  private updateEnemies(delta: number, now: number): void {
    const playerPos = this.player.getPosition();

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;

      const result = enemy.update(playerPos.x, playerPos.y, delta, now);

      if (result.shouldAttack) {
        const attackResult = this.combatSystem.applyDamage(this.player, enemy.damage, now);

        if (attackResult.hit) {
          this.combatSystem.createHitEffect(this.player.sprite.x, this.player.sprite.y);

          if (this.player.hp <= 0) {
            this.onPlayerDeath();
          }
        }
      }
    }
  }

  protected onPlayerDeath(): void {
    this.scene.start("UnderworldScene", {
      devotionSystem: this.devotionSystem,
      bestowSystem: this.bestowSystem,
      returnScene: this.scene.key,
    });
  }

  private activateBestow(slot: number, now: number): void {
    const bestow = this.bestowSystem.getEquippedBestow(slot);
    if (!bestow) return;

    if (this.bestowSystem.canActivate(bestow, now)) {
      this.bestowSystem.activate(bestow, now);
      this.showMessage(`${bestow.name} ativado!`);
    } else {
      const remaining = Math.ceil(this.bestowSystem.getCooldownRemaining(bestow.id, now) / 1000);
      this.showMessage(`Aguarde ${remaining}s`);
    }
  }

  protected checkInteractions(): void {
    const playerPos = this.player.getPosition();

    for (const interactable of this.interactables) {
      const dist = Phaser.Math.Distance.Between(
        playerPos.x,
        playerPos.y,
        interactable.sprite.x,
        interactable.sprite.y
      );

      if (dist <= 40) {
        this.handleInteraction(interactable.type, interactable.data);
        return;
      }
    }
  }

  protected handleInteraction(type: string, data?: any): void {
  }

  protected constrainPlayer(): void {
    const margin = 16;
    this.player.sprite.x = Phaser.Math.Clamp(this.player.sprite.x, margin, GAME_WIDTH - margin);
    this.player.sprite.y = Phaser.Math.Clamp(this.player.sprite.y, margin, GAME_HEIGHT - margin);
  }

  protected showMessage(text: string): void {
    this.game.events.emit("show-message", text);
  }

  protected emitHudUpdate(): void {
    this.game.events.emit("hud-update", {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      nylea: this.devotionSystem.getDevotion("nylea"),
      heliod: this.devotionSystem.getDevotion("heliod"),
      bestows: this.bestowSystem.getEquippedSlots(),
      activeBestows: this.bestowSystem
        .getEquippedSlots()
        .map((b) => (b ? this.bestowSystem.isActive(b.id) : false)),
    });
  }

  protected addInteractable(
    x: number,
    y: number,
    color: number,
    type: string,
    size: number = 24,
    data?: any
  ): Phaser.GameObjects.Rectangle {
    const sprite = this.add.rectangle(x, y, size, size, color);
    sprite.setDepth(1);
    this.interactables.push({ sprite, type, data });
    return sprite;
  }

  protected addPortal(
    x: number,
    y: number,
    targetScene: string,
    portalData?: any
  ): void {
    const portal = this.add.circle(x, y, 16, 0x9b59b6, 0.8);
    portal.setDepth(1);

    this.tweens.add({
      targets: portal,
      scale: 1.2,
      alpha: 0.5,
      yoyo: true,
      repeat: -1,
      duration: 800,
    });

    this.interactables.push({
      sprite: portal,
      type: "portal",
      data: { targetScene, ...portalData },
    });
  }
}
