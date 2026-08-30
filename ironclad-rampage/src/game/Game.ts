import * as THREE from 'three';
import { loadBackgroundTexture } from '../assets/loadSprite';
import { loadCharacterAtlas, type SpriteAtlas } from '../assets/spriteAtlas';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { Fighter, type FighterKind } from '../entities/Fighter';
import { AudioSystem } from '../systems/AudioSystem';
import { Hud, type HudState } from '../systems/Hud';
import { ScrollingBackground } from '../systems/ScrollingBackground';
import { depthPresentation, HERO_MAX_HP, isInMeleeRange, PATH_BOUNDS as PATH, WAVES } from './gameRules';

/** Orthographic vertical span (world units). Background fills this exactly. */
const VIEW_H = 9;

/**
 * Playable path band (feet Y). Matches painted dirt road in lower ~40% of stage art.
 * VIEW bottom = -VIEW_H/2 = -4.5; path bottom ~ -4.2, path top ~ -1.0
 */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly input: InputController;
  private readonly audio = new AudioSystem();
  private readonly hud = new Hud();
  private readonly loop: Loop;
  private readonly move = new THREE.Vector2();

  private atlases: Partial<Record<FighterKind, SpriteAtlas>> = {};
  private bgTexture: THREE.Texture | null = null;
  private scrolling: ScrollingBackground | null = null;
  private player: Fighter | null = null;
  private enemies: Fighter[] = [];

  private mode: HudState['mode'] = 'title';
  private score = 0;
  private waveIndex = 0;
  private waveBanner = 0;
  private specialCd = 0;
  private elapsed = 0;
  private frame = 0;
  private ready = false;
  private status = 'Loading art...';
  private cameraX = 6;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    // Match sky of stage art (no more empty blue void under the scene)
    this.renderer.setClearColor('#5eb8f5', 1);

    const aspect = Math.max(0.5, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    const halfH = VIEW_H * 0.5;
    const halfW = halfH * aspect;
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 80);

    const stick = this.el('#touch-stick');
    const knob = this.el('#touch-knob');
    const attackBtn = this.el('#attack-button');
    const specialBtn = this.el('#special-button');
    this.input = new InputController(stick, knob, attackBtn, specialBtn);

    this.el('#start-button').addEventListener('click', () => {
      if (this.mode !== 'playing') this.beginRun();
    });

    this.loop = new Loop(
      (delta, elapsed) => this.update(delta, elapsed),
      () => this.render(),
    );

    this.camera.position.set(6, 0, 20);
    this.camera.lookAt(6, 0, 0);

    void this.bootstrap();
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.audio.dispose();
    this.player?.dispose();
    for (const e of this.enemies) e.dispose();
    this.scrolling?.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
  }

  private async bootstrap(): Promise<void> {
    try {
      const [hero, bandit, skeleton, boss, bg] = await Promise.all([
        loadCharacterAtlas('hero'),
        loadCharacterAtlas('bandit'),
        loadCharacterAtlas('skeleton'),
        loadCharacterAtlas('boss'),
        loadBackgroundTexture('/art/background.jpg'),
      ]);
      this.atlases = { hero, bandit, skeleton, boss };
      this.bgTexture = bg;
      this.buildWorld();
      this.ready = true;
      this.status = 'Press Enter to start';
      this.pushHud();
    } catch (err) {
      console.error(err);
      this.status = 'Failed to load art assets';
      this.pushHud();
    }
  }

  private buildWorld(): void {
    while (this.scene.children.length) {
      this.scene.remove(this.scene.children[0]);
    }

    // Soft ambient only — sprites use unlit materials
    const amb = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(amb);

    this.scrolling?.dispose();
    this.scrolling = new ScrollingBackground(this.bgTexture!, VIEW_H, 6);
    this.scene.add(this.scrolling.group);
    this.scrolling.update(this.cameraX);
  }

  private beginRun(): void {
    if (!this.ready || !this.atlases.hero) return;

    if (this.player) {
      this.scene.remove(this.player.group);
      this.player.dispose();
    }
    for (const e of this.enemies) {
      this.scene.remove(e.group);
      e.dispose();
    }
    this.enemies = [];

    this.player = new Fighter('hero', this.atlases.hero, true, true);
    // Feet on the painted road (not floating on empty green)
    this.player.position.set(3.5, -2.6, 0);
    this.player.setFacing(1);
    // Brief spawn protection so first hits don't ruin the opening
    this.player.invuln = 1.6;
    this.scene.add(this.player.group);

    this.score = 0;
    this.waveIndex = 0;
    this.specialCd = 0;
    this.elapsed = 0;
    this.mode = 'playing';
    this.cameraX = 6;
    this.spawnWave(0);
    this.audio.attack();
    this.pushHud();
  }

  private spawnWave(index: number): void {
    const wave = WAVES[index];
    if (!wave) return;
    this.waveBanner = 2.4;
    this.status = wave.label;
    for (const spawn of wave.spawns) {
      const atlas = this.atlases[spawn.kind];
      if (!atlas) continue;
      const foe = new Fighter(spawn.kind, atlas, false, false);
      foe.position.set(spawn.x, spawn.y, 0);
      foe.setFacing(-1);
      this.enemies.push(foe);
      this.scene.add(foe.group);
    }
  }

  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    resizeRenderer(this.renderer, this.camera, 2, VIEW_H);

    if (this.input.consumeStart() && this.mode !== 'playing' && this.ready) {
      this.beginRun();
    }

    if (this.mode === 'playing' && this.player) {
      this.elapsed += delta;
      if (this.specialCd > 0) this.specialCd -= delta;
      if (this.waveBanner > 0) this.waveBanner -= delta;

      this.updatePlayer(delta, elapsed);
      this.updateEnemies(delta, elapsed);
      this.resolveCombat();
      this.cleanupDead();
      this.checkWaveProgress();
      this.updateCamera(delta);

      if (this.player.hp <= 0 || !this.player.alive) {
        this.mode = 'gameover';
        this.status = 'Sir Clankalot has fallen';
        this.audio.lose();
      }
    } else {
      // Title: slow scenic scroll over full-screen stage
      this.cameraX = 6 + elapsed * 0.55;
      this.camera.position.x = this.cameraX;
      this.camera.position.y = 0;
      this.camera.lookAt(this.cameraX, 0, 0);
    }

    this.scrolling?.update(this.cameraX);
    this.pushHud();
    this.publishDiagnostics();
  }

  private updatePlayer(delta: number, elapsed: number): void {
    const player = this.player!;
    let moving = false;

    if (player.alive && player.stun <= 0 && !player.attacking) {
      this.input.readMovement(this.move);
      const speed = player.stats.moveSpeed;
      // X = along road, Y = lane depth on the path (screen up/down)
      player.position.x += this.move.x * speed * delta;
      player.position.y += -this.move.y * speed * 0.55 * delta;
      if (Math.abs(this.move.x) > 0.15) player.setFacing(this.move.x);
      moving = this.move.lengthSq() > 0.04;
    }

    player.position.x = THREE.MathUtils.clamp(player.position.x, PATH.minX, PATH.maxX);
    player.position.y = THREE.MathUtils.clamp(player.position.y, PATH.minY, PATH.maxY);
    player.position.z = 0;

    if (player.alive && this.input.consumeAttack()) {
      if (player.beginAttack()) this.audio.attack();
    }

    if (
      player.alive &&
      this.input.consumeSpecial() &&
      this.specialCd <= 0 &&
      player.stun <= 0
    ) {
      this.doSpecial();
    }

    player.updateVisual(delta, elapsed, moving);
    this.sortDepth(player);
  }

  private doSpecial(): void {
    const player = this.player!;
    if (!player.alive) return;
    this.specialCd = 4.5;
    player.beginAttack();
    this.audio.special();

    for (const foe of this.enemies) {
      if (!foe.alive) continue;
      const dx = foe.position.x - player.position.x;
      const dy = foe.position.y - player.position.y;
      const inFront = dx * player.facing >= -0.2;
      const dist = Math.hypot(dx, dy * 1.5);
      if (inFront && dist < 2.8) {
        if (foe.takeDamage(34, player.position.x)) {
          this.audio.hit();
          if (!foe.alive) this.score += foe.stats.scoreValue;
        }
      }
    }
  }

  private updateEnemies(delta: number, elapsed: number): void {
    const player = this.player!;
    for (const foe of this.enemies) {
      let moving = false;

      if (foe.alive && foe.stun <= 0 && !foe.attacking) {
        const dx = player.position.x - foe.position.x;
        const dy = player.position.y - foe.position.y;
        const dist = Math.hypot(dx, dy);
        foe.setFacing(dx);

        const stopRange = foe.stats.attackRange * 0.72;
        if (dist > stopRange) {
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);
          foe.position.x += nx * foe.stats.moveSpeed * delta;
          foe.position.y += ny * foe.stats.moveSpeed * 0.55 * delta;
          moving = true;
        } else if (foe.cooldown <= 0) {
          foe.beginAttack();
        }
      }

      foe.position.x = THREE.MathUtils.clamp(foe.position.x, PATH.minX, PATH.maxX + 2);
      foe.position.y = THREE.MathUtils.clamp(foe.position.y, PATH.minY, PATH.maxY);
      foe.position.z = 0;
      foe.updateVisual(delta, elapsed, moving);
      this.sortDepth(foe);
    }
  }

  private resolveCombat(): void {
    const player = this.player!;
    if (!player.alive) return;

    if (player.hitboxActive()) {
      let hitSomeone = false;
      for (const foe of this.enemies) {
        if (!foe.alive) continue;
        if (isInMeleeRange(player.position.x, player.position.y, player.facing, foe.position.x, foe.position.y, foe.stats.radius, player.stats.attackRange)) {
          if (foe.takeDamage(player.stats.attackDamage, player.position.x)) {
            hitSomeone = true;
            if (!foe.alive) this.score += foe.stats.scoreValue;
          }
        }
      }
      if (hitSomeone) {
        player.markHitApplied();
        this.audio.hit();
      }
    }

    for (const foe of this.enemies) {
      if (!foe.alive || !foe.hitboxActive()) continue;
      if (isInMeleeRange(foe.position.x, foe.position.y, foe.facing, player.position.x, player.position.y, player.stats.radius, foe.stats.attackRange)) {
        if (player.takeDamage(foe.stats.attackDamage, foe.position.x)) {
          foe.markHitApplied();
          this.audio.hurt();
        }
      }
    }
  }

  private cleanupDead(): void {
    const keep: Fighter[] = [];
    for (const foe of this.enemies) {
      if (!foe.alive && foe.opacity < 0.05) {
        this.scene.remove(foe.group);
        foe.dispose();
      } else {
        keep.push(foe);
      }
    }
    this.enemies = keep;
  }

  private checkWaveProgress(): void {
    const living = this.enemies.some((e) => e.alive);
    if (living) return;

    const fading = this.enemies.some((e) => !e.alive && e.opacity > 0.2);
    if (fading) return;

    if (this.waveIndex >= WAVES.length - 1) {
      this.mode = 'victory';
      this.status = 'The road is clear!';
      this.audio.win();
      return;
    }

    this.waveIndex += 1;
    this.spawnWave(this.waveIndex);
  }

  private updateCamera(delta: number): void {
    const player = this.player!;
    const targetX = THREE.MathUtils.clamp(player.position.x + 1.8, 5, PATH.maxX - 4);
    this.cameraX = THREE.MathUtils.damp(this.cameraX, targetX, 5, delta);
    this.camera.position.x = this.cameraX;
    this.camera.position.y = 0;
    this.camera.position.z = 20;
    this.camera.lookAt(this.cameraX, 0, 0);
  }

  private sortDepth(fighter: Fighter): void {
    const presentation = depthPresentation(fighter.position.y);
    fighter.group.renderOrder = presentation.renderOrder;
    fighter.group.position.z = presentation.z;
  }

  private pushHud(): void {
    const player = this.player;
    this.hud.update({
      mode: this.mode,
      hp: player?.hp ?? HERO_MAX_HP,
      maxHp: player?.stats.maxHp ?? HERO_MAX_HP,
      score: this.score,
      wave: Math.min(this.waveIndex + 1, WAVES.length),
      waveTotal: WAVES.length,
      status:
        this.mode === 'playing' && this.waveBanner > 0
          ? this.status
          : this.mode === 'playing'
            ? `Wave ${this.waveIndex + 1} · Special ${this.specialCd > 0 ? `${this.specialCd.toFixed(1)}s` : 'READY'}`
            : this.status,
      specialReady: this.specialCd <= 0 && this.mode === 'playing',
    });
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      score: this.score,
      targetScore: 0,
      complete: this.mode === 'victory',
      player: {
        position: {
          x: this.player?.position.x ?? 0,
          y: this.player?.position.y ?? 0,
          z: this.player?.position.z ?? 0,
        },
        speed: 0,
        displaySize: this.player?.displaySize ?? null,
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      },
    };
  }

  private el(selector: string): HTMLElement {
    const node = document.querySelector<HTMLElement>(selector);
    if (!node) throw new Error(`Missing ${selector}`);
    return node;
  }
}
