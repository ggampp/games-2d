import * as THREE from 'three';
import type { AnimName, SpriteAtlas } from '../assets/spriteAtlas';

export type FighterKind = 'hero' | 'bandit' | 'skeleton' | 'boss';

export type FighterStats = {
  maxHp: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  attackDuration: number;
  hitStun: number;
  radius: number;
  height: number;
  scoreValue: number;
  walkFps: number;
};

export const FIGHTER_STATS: Record<FighterKind, FighterStats> = {
  hero: {
    maxHp: 120,
    moveSpeed: 4.6,
    attackDamage: 20,
    attackRange: 1.65,
    attackCooldown: 0.42,
    attackDuration: 0.42,
    hitStun: 0.28,
    radius: 0.55,
    height: 2.55,
    scoreValue: 0,
    walkFps: 9,
  },
  bandit: {
    maxHp: 42,
    moveSpeed: 3.0,
    attackDamage: 9,
    attackRange: 1.25,
    attackCooldown: 1.05,
    attackDuration: 0.4,
    hitStun: 0.35,
    radius: 0.48,
    height: 2.15,
    scoreValue: 100,
    walkFps: 8,
  },
  skeleton: {
    maxHp: 58,
    moveSpeed: 2.45,
    attackDamage: 12,
    attackRange: 1.4,
    attackCooldown: 1.15,
    attackDuration: 0.42,
    hitStun: 0.38,
    radius: 0.5,
    height: 2.3,
    scoreValue: 150,
    walkFps: 8,
  },
  boss: {
    maxHp: 240,
    moveSpeed: 1.9,
    attackDamage: 18,
    attackRange: 1.8,
    attackCooldown: 1.0,
    attackDuration: 0.5,
    hitStun: 0.28,
    radius: 0.75,
    height: 3.0,
    scoreValue: 1000,
    walkFps: 7,
  },
};

export class Fighter {
  readonly group = new THREE.Group();
  readonly kind: FighterKind;
  readonly stats: FighterStats;
  readonly isPlayer: boolean;

  hp: number;
  facing = 1;
  alive = true;
  attacking = false;
  attackTimer = 0;
  cooldown = 0;
  stun = 0;
  /** Public so Game can grant spawn protection. */
  invuln = 0;
  flash = 0;
  attackHitApplied = false;
  moving = false;
  knockVel = 0;

  private anim: AnimName = 'idle';
  private animTime = 0;
  private frameIndex = 0;
  private readonly atlas: SpriteAtlas;
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly shadow: THREE.Mesh;
  private readonly artFacing: number;
  private planeWidth: number;
  private planeHeight: number;
  private downTimer = 0;

  constructor(
    kind: FighterKind,
    atlas: SpriteAtlas,
    isPlayer: boolean,
    artFacesRight = true,
  ) {
    this.kind = kind;
    this.atlas = atlas;
    this.stats = FIGHTER_STATS[kind];
    this.isPlayer = isPlayer;
    this.artFacing = artFacesRight ? 1 : -1;
    this.hp = this.stats.maxHp;

    const startTex =
      atlas.frames.idle[0] ??
      atlas.frames.walk[0] ??
      Object.values(atlas.frames).flat()[0];
    if (!startTex) throw new Error(`No textures for ${kind}`);

    this.material = new THREE.MeshBasicMaterial({
      map: startTex,
      transparent: true,
      alphaTest: 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Fixed display size for ALL frames — never resize on frame swap.
    // Width follows the sheet cell aspect (equal cells → same aspect forever).
    this.planeHeight = this.stats.height;
    const aspect = this.aspectOf(startTex);
    this.planeWidth = this.planeHeight * aspect;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.planeWidth, this.planeHeight),
      this.material,
    );
    this.mesh.position.y = this.planeHeight * 0.5;
    this.group.add(this.mesh);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(this.stats.radius * 1.1, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.group.add(this.shadow);

    this.group.userData.fighter = this;
    this.setFacing(artFacesRight ? 1 : -1);
    this.play('idle', true);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  get opacity(): number {
    return this.material.opacity;
  }

  /** Fixed world-space size (for tests / diagnostics). */
  get displaySize(): { width: number; height: number; anim: string } {
    return {
      width: this.planeWidth,
      height: this.planeHeight,
      anim: this.anim,
    };
  }

  setFacing(dir: number): void {
    if (dir === 0) return;
    this.facing = dir > 0 ? 1 : -1;
    this.applyFacingScale();
  }

  beginAttack(): boolean {
    if (!this.alive || this.attacking || this.cooldown > 0 || this.stun > 0) return false;
    this.attacking = true;
    this.attackTimer = this.stats.attackDuration;
    this.cooldown = this.stats.attackCooldown;
    this.attackHitApplied = false;
    this.play('attack', true);
    return true;
  }

  takeDamage(amount: number, fromX: number): boolean {
    if (!this.alive || this.invuln > 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.stun = this.stats.hitStun;
    this.flash = 0.14;
    this.invuln = this.isPlayer ? 0.45 : 0.14;
    this.attacking = false;
    this.attackTimer = 0;

    const dir = this.position.x < fromX ? -1 : 1;
    this.knockVel = dir * (this.isPlayer ? 3.2 : 5.5);
    this.position.x += dir * (this.isPlayer ? 0.25 : 0.4);

    if (this.hp <= 0) {
      this.alive = false;
      this.attacking = false;
      this.downTimer = 0;
      this.play('down', true);
    } else {
      this.play('hurt', true);
    }
    return true;
  }

  /** Call each frame with movement intent flag for walk/idle. */
  updateVisual(delta: number, elapsed: number, isMoving = false): void {
    this.moving = isMoving;

    if (this.cooldown > 0) this.cooldown -= delta;
    if (this.stun > 0) this.stun -= delta;
    if (this.invuln > 0) this.invuln -= delta;
    if (this.flash > 0) this.flash -= delta;

    // knockback decay
    if (Math.abs(this.knockVel) > 0.05) {
      this.position.x += this.knockVel * delta;
      this.knockVel *= Math.exp(-8 * delta);
    } else {
      this.knockVel = 0;
    }

    if (!this.alive) {
      this.updateDown(delta);
      return;
    }

    if (this.attacking) {
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) {
        this.attacking = false;
        this.mesh.rotation.z = 0;
      }
    }

    // Pick animation state (priority)
    if (this.attacking) {
      // stay on attack
    } else if (this.stun > 0) {
      this.play('hurt');
    } else if (isMoving) {
      this.play('walk');
    } else {
      this.play('idle');
    }

    this.advanceFrames(delta);
    this.applyFacingScale();

    // Standing: feet stay at group.position.y (path), sprite rises by half height
    this.mesh.position.y = this.planeHeight * 0.5;
    this.mesh.rotation.z = 0;
    this.shadow.scale.setScalar(1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.28;
    this.material.opacity = 1;

    if (this.invuln > 0 && this.isPlayer) {
      // Keep readable while blinking (was 0.35 and looked "tiny"/ghosty)
      this.material.opacity = Math.sin(elapsed * 30) > 0 ? 1 : 0.62;
    }
    if (this.flash > 0) {
      this.material.color.setHex(0xff8888);
    } else {
      this.material.color.setHex(0xffffff);
    }
  }

  hitboxActive(): boolean {
    if (!this.attacking || this.attackHitApplied) return false;
    const t = this.attackTimer / this.stats.attackDuration;
    return t < 0.72 && t > 0.22;
  }

  markHitApplied(): void {
    this.attackHitApplied = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    // textures owned by atlas/game — do not dispose maps here
    this.material.map = null;
    this.material.dispose();
  }

  private updateDown(delta: number): void {
    this.play('down');
    this.advanceFrames(delta);
    this.material.color.setHex(0xffffff);

    // Same fixed plane size; lower sprite slightly so fallen pose sits on the road
    this.mesh.position.y = this.planeHeight * 0.42;
    this.mesh.rotation.z = 0;
    this.shadow.scale.set(1.35, 0.75, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.2;

    this.downTimer += delta;
    this.material.opacity = 1;
    if (!this.isPlayer && this.downTimer > 1.35) {
      this.material.opacity = Math.max(0, 1 - (this.downTimer - 1.35) * 0.9);
    }
    this.applyFacingScale();
  }

  private play(name: AnimName, force = false): void {
    if (!force && this.anim === name) return;
    if (!this.atlas.frames[name]?.length) return;
    this.anim = name;
    this.animTime = 0;
    this.frameIndex = 0;
    this.applyFrame(0);
  }

  private advanceFrames(delta: number): void {
    const list = this.atlas.frames[this.anim];
    if (!list || list.length === 0) return;

    if (list.length === 1) {
      this.applyFrame(0);
      return;
    }

    this.animTime += delta;
    let fps = this.stats.walkFps;
    if (this.anim === 'attack') {
      fps = Math.max(6, list.length / Math.max(0.2, this.stats.attackDuration));
    }
    if (this.anim === 'hurt') fps = 8;
    if (this.anim === 'down') fps = 1;

    const frameDur = 1 / fps;
    while (this.animTime >= frameDur) {
      this.animTime -= frameDur;
      if (this.anim === 'walk' || this.anim === 'idle') {
        this.frameIndex = (this.frameIndex + 1) % list.length;
      } else {
        this.frameIndex = Math.min(this.frameIndex + 1, list.length - 1);
      }
    }
    this.applyFrame(this.frameIndex);
  }

  private applyFrame(index: number): void {
    const list = this.atlas.frames[this.anim];
    const tex = list[Math.min(index, list.length - 1)];
    if (!tex) return;
    if (this.material.map !== tex) {
      this.material.map = tex;
      this.material.needsUpdate = true;
    }
    // Geometry size is fixed at construct time — no per-frame resize.
  }

  private aspectOf(tex: THREE.Texture): number {
    const img = tex.image as { width?: number; height?: number } | undefined;
    if (img?.width && img?.height && img.height > 0) {
      // Clamp so ultra-wide strips still look like a character
      return Math.min(1.35, Math.max(0.55, img.width / img.height));
    }
    return 1;
  }

  private applyFacingScale(): void {
    const sx = this.facing * this.artFacing;
    this.mesh.scale.x = sx;
    this.mesh.scale.y = 1;
  }
}
