import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VH } from "../const";
import type { Input } from "../input";
import { Sfx } from "./audio";

const HEIGHT = 4.2;
const YAW = 0;
const GUN = new THREE.Vector3(1.45, 3.25, 0.2);
const GOAL = 8;
const SPAWNS = [12, 17.5, 23, 29, 36, 43, 51, 60];

export type Mode = "title" | "play" | "pause" | "over" | "win";

type Phase = "foe" | "vanish" | "appear" | "friend";

type Actor = {
  phase: Phase;
  x: number;
  face: number;
  pop: number;
  t: number;
  seed: number;
  shoot: number;
  mesh: THREE.Mesh;
  w: number;
  h: number;
};

type Bolt = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  friendly: boolean;
  life: number;
  mesh: THREE.Mesh;
};

type Spark = {
  mesh: THREE.Mesh;
  v: THREE.Vector3;
  life: number;
  age: number;
};

type Ring = {
  mesh: THREE.Mesh;
  age: number;
};

export class Game {
  mode: Mode = "title";
  score = 0;
  combo = 0;
  lives = 3;
  hp = 100;
  converted = 0;
  readonly goal = GOAL;
  banner = "";
  time = 0;

  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly sfx = new Sfx();

  private foeTex: THREE.Texture | null = null;
  private allyTex: THREE.Texture | null = null;
  private aspect = 0.55;
  private actors: Actor[] = [];
  private bolts: Bolt[] = [];
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private readonly root = new THREE.Group();
  private readonly bob = new THREE.Group();
  private readonly sun: THREE.DirectionalLight;
  private readonly dunes: THREE.Mesh;
  private readonly sky: THREE.Mesh;
  private readonly ground: THREE.Mesh;
  private readonly sand: THREE.Texture;
  private readonly boltGeo = new THREE.SphereGeometry(0.11, 10, 8);
  private readonly sparkGeo = new THREE.SphereGeometry(0.06, 6, 6);
  private x = 2.2;
  private y = 0;
  private vy = 0;
  private facing = 1;
  private grounded = true;
  private fireCd = 0;
  private roarCd = 0;
  private invuln = 0;
  private knock = 0;
  private knockDir = 1;
  private bannerT = 0;
  private comboT = 0;
  private winT = 0;
  private clock = 0;
  private shake = 0;
  private muzzle: THREE.PointLight;
  private sharedGeo: THREE.PlaneGeometry | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0xd7c4a8);
    this.scene.fog = new THREE.Fog(0xd7c4a8, 30, 78);
    this.camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 140);
    this.camera.position.set(2, 2.35, 16.8);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.add(new THREE.AmbientLight(0xfff4e4, 0.42));
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x8d5b34, 0.72));
    this.sun = new THREE.DirectionalLight(0xffe2b8, 2.35);
    this.sun.position.set(8, 12, 7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 48;
    this.sun.shadow.camera.left = -18;
    this.sun.shadow.camera.right = 18;
    this.sun.shadow.camera.top = 14;
    this.sun.shadow.camera.bottom = -10;
    this.sun.shadow.bias = -0.00035;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    const loader = new THREE.TextureLoader();
    this.sand = loader.load("/tex/sand.jpg");
    this.sand.colorSpace = THREE.SRGBColorSpace;
    this.sand.wrapS = THREE.RepeatWrapping;
    this.sand.wrapT = THREE.RepeatWrapping;
    this.sand.repeat.set(8, 3);
    this.sand.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 36),
      new THREE.MeshStandardMaterial({ map: this.sand, color: 0xffffff, roughness: 1, metalness: 0 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.sky = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 48),
      new THREE.MeshBasicMaterial({ color: 0xd7c4a8, depthWrite: false }),
    );
    this.sky.position.set(0, 16, -28);
    this.scene.add(this.sky);

    this.dunes = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 28),
      new THREE.MeshBasicMaterial({ color: 0xc4a574, depthWrite: false }),
    );
    this.dunes.position.set(0, 7.2, -11);
    this.scene.add(this.dunes);

    this.root.add(this.bob);
    this.scene.add(this.root);
    this.muzzle = new THREE.PointLight(0xb070ff, 0, 3.2);
    this.muzzle.position.copy(GUN);
    this.root.add(this.muzzle);
    this.resize();
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 2 || h < 2) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  async load(onStep: (label: string) => void): Promise<void> {
    onStep("Preparando o som");
    await this.sfx.load(["shot", "convert", "roar", "friend", "music"]);
    onStep("Recortando as camisas");
    const [foe, ally, skyTex, duneTex] = await Promise.all([
      loadCutout("/tex/enemy.png"),
      loadCutout("/tex/ally.png"),
      loadPlate("/tex/sky.jpg", "sky"),
      loadPlate("/tex/dunes.jpg", "bars"),
    ]);
    (this.sky.material as THREE.MeshBasicMaterial).map = skyTex;
    (this.sky.material as THREE.MeshBasicMaterial).needsUpdate = true;
    (this.dunes.material as THREE.MeshBasicMaterial).map = duneTex;
    (this.dunes.material as THREE.MeshBasicMaterial).needsUpdate = true;
    this.foeTex = foe.tex;
    this.allyTex = ally.tex;
    this.aspect = foe.aspect;
    onStep("Trazendo o dinossauro");
    await this.loadRider();
    this.spawnAll();
  }

  reset(): void {
    this.mode = "play";
    this.score = 0;
    this.combo = 0;
    this.lives = 3;
    this.hp = 100;
    this.converted = 0;
    this.banner = "";
    this.time = 0;
    this.x = 2.2;
    this.y = 0;
    this.vy = 0;
    this.facing = 1;
    this.grounded = true;
    this.fireCd = 0;
    this.roarCd = 0;
    this.invuln = 0;
    this.knock = 0;
    this.bannerT = 0;
    this.comboT = 0;
    this.winT = 0;
    this.clock = 0;
    for (const actor of this.actors) this.scene.remove(actor.mesh);
    for (const bolt of this.bolts) this.scene.remove(bolt.mesh);
    this.actors = [];
    this.bolts = [];
    this.spawnAll();
  }

  update(dt: number, input: Input): void {
    this.clock += dt;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.roarCd = Math.max(0, this.roarCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT === 0) this.combo = 0;
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.banner = "";
    }
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 28);
    this.shake = Math.max(0, this.shake - dt * 1.4);

    if (this.mode === "play") {
      this.time += dt;
      this.stepPlayer(dt, input);
      this.stepActors(dt);
      this.stepBolts(dt);
      if (this.converted >= this.goal && this.mode === "play") {
        this.winT += dt;
        this.banner = "TODO MUNDO JUNTO";
        if (this.winT > 1.25) this.mode = "win";
      }
    } else {
      this.bob.position.y = Math.abs(Math.sin(this.clock * 2.2)) * 0.03;
    }

    this.stepFx(dt);
    this.root.position.set(this.x, this.y, 0);
    this.root.scale.x = this.facing;
    this.placeActors();
    this.frameCamera();
  }

  draw(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private async loadRider(): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync("/models/player.glb");
    hideSlabs(gltf.scene);
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of list) {
        const mat = material as THREE.MeshStandardMaterial;
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      }
    });
    gltf.scene.rotation.y = YAW;
    fitFeet(gltf.scene, HEIGHT);
    this.bob.add(gltf.scene);
  }

  private spawnAll(): void {
    const h = 1.92;
    const w = h * this.aspect;
    if (!this.sharedGeo) this.sharedGeo = new THREE.PlaneGeometry(1, 1);
    SPAWNS.forEach((x, i) => {
      const mat = new THREE.MeshStandardMaterial({
        map: this.foeTex,
        transparent: true,
        alphaTest: 0.18,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.sharedGeo!, mat);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.actors.push({
        phase: "foe",
        x,
        face: 1,
        pop: 1,
        t: 0,
        seed: i * 1.7,
        shoot: 1.2 + i * 0.35,
        mesh,
        w,
        h,
      });
    });
  }

  private stepPlayer(dt: number, input: Input): void {
    const left = input.held("left");
    const right = input.held("right");
    if (this.knock > 0) {
      this.knock -= dt;
      this.x += this.knockDir * 7 * dt;
    } else if (left !== right) {
      this.facing = right ? 1 : -1;
      this.x += (right ? 6.4 : -6.4) * dt;
    }
    this.x = Math.max(0.8, Math.min(68, this.x));

    if (this.grounded && input.pressed("jump")) {
      this.vy = 8.4;
      this.grounded = false;
    }
    this.vy -= 26 * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.vy = 0;
      this.grounded = true;
    }

    const moving = left !== right && this.grounded;
    this.bob.position.y = moving ? Math.abs(Math.sin(this.clock * 11)) * 0.045 : Math.abs(Math.sin(this.clock * 2.2)) * 0.02;
    this.bob.rotation.z = this.facing * (moving ? -0.04 : 0);
    this.root.visible = this.invuln <= 0 || Math.floor(this.invuln * 18) % 2 === 0;

    let aim = this.aimChest();
    if (input.held("up") || (input.mouseHot && input.mouseY < VH * 0.38)) aim = 0.18;
    else if (input.held("down") || (input.mouseHot && input.mouseY > VH * 0.72)) aim = -0.85;
    if (input.held("shoot") && this.fireCd <= 0) this.shoot(aim);
    if (input.pressed("bite") && this.roarCd <= 0) this.roar();
  }

  private shoot(aim: number): void {
    this.fireCd = 0.18;
    this.sfx.play("shot", 0.85);
    this.muzzle.intensity = 3.5;
    this.shake = Math.min(0.22, this.shake + 0.06);
    this.root.updateWorldMatrix(true, true);
    const origin = GUN.clone().applyMatrix4(this.root.matrixWorld);
    const dir = this.facing;
    const speed = 22;
    this.addBolt(origin.x, origin.y, Math.cos(aim) * speed * dir, Math.sin(aim) * speed, true, 0xb56bff);
    burst(this, origin.x, origin.y, 0.2, 0xc080ff, 6);
  }

  private roar(): void {
    this.roarCd = 1.55;
    this.sfx.play("roar", 0.9);
    this.shake = 0.32;
    for (const actor of this.actors) {
      if (actor.phase !== "foe") continue;
      const dist = Math.abs(actor.x - this.x);
      if (dist < 4.8) this.convert(actor);
      else if (dist < 8) actor.x += Math.sign(actor.x - this.x) * 1.35;
    }
  }

  private aimChest(): number {
    let aim = -0.45;
    let best = 16;
    for (const actor of this.actors) {
      if (actor.phase !== "foe") continue;
      const dx = (actor.x - this.x) * this.facing;
      if (dx < 0.6 || dx > best) continue;
      best = dx;
      aim = Math.atan2(1.05 - (this.y + GUN.y), dx);
    }
    return Math.max(-1.1, Math.min(0.35, aim));
  }

  private stepActors(dt: number): void {
    let slot = 0;
    const foes = this.actors.filter((actor) => actor.phase === "foe").sort((a, b) => a.x - b.x);
    const rank = new Map(foes.map((actor, index) => [actor, index]));
    for (const actor of this.actors) {
      if (actor.phase === "vanish") {
        actor.t += dt;
        actor.pop = Math.max(0, 1 - actor.t / 0.12);
        if (actor.t >= 0.12) {
          (actor.mesh.material as THREE.MeshStandardMaterial).map = this.allyTex;
          actor.phase = "appear";
          actor.t = 0;
        }
        continue;
      }
      if (actor.phase === "appear") {
        actor.t += dt;
        actor.pop = Math.min(1, actor.t / 0.16);
        if (actor.pop >= 1) actor.phase = "friend";
        continue;
      }
      if (actor.phase === "friend") {
        const target = this.x - this.facing * (3.6 + slot * 1.25);
        slot += 1;
        actor.x += (target - actor.x) * Math.min(1, dt * 2.4);
        actor.face = this.facing > 0 ? -1 : 1;
        continue;
      }
      const target = this.x + 3.9 + (rank.get(actor) ?? 0) * 1.45;
      const step = (1.45 + (actor.seed % 1) * 0.4) * dt;
      if (Math.abs(target - actor.x) > step) actor.x += Math.sign(target - actor.x) * step;
      actor.face = this.x < actor.x ? 1 : -1;
      actor.shoot -= dt;
      if (actor.shoot <= 0 && Math.abs(actor.x - this.x) < 16) {
        actor.shoot = 1.55 + (actor.seed % 1);
        const dx = this.x - actor.x;
        const dy = this.y + 1.7 - 1.05;
        const len = Math.hypot(dx, dy) || 1;
        this.addBolt(actor.x, 1.15, (dx / len) * 7.2, (dy / len) * 7.2, false, 0xff3a3a);
      }
      if (this.invuln <= 0 && this.y < 1.5 && Math.abs(actor.x - this.x) < 2.15) {
        this.hurt(18, Math.sign(this.x - actor.x) || -this.facing);
      }
    }
  }

  private stepBolts(dt: number): void {
    for (const bolt of this.bolts) {
      bolt.px = bolt.x;
      bolt.py = bolt.y;
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      bolt.mesh.position.set(bolt.x, bolt.y, 0.25);
      if (bolt.y < 0.05) bolt.life = 0;
      if (!bolt.friendly) {
        const hit = swept(bolt.px, bolt.py, bolt.x, bolt.y, this.x, this.y + 1.85, 1.35, 1.55);
        if (hit && this.invuln <= 0) {
          bolt.life = 0;
          this.hurt(14, Math.sign(this.x - bolt.x) || -1);
        }
        continue;
      }
      for (const actor of this.actors) {
        if (actor.phase !== "foe") continue;
        if (swept(bolt.px, bolt.py, bolt.x, bolt.y, actor.x, 1.0, 0.48, 0.95)) {
          bolt.life = 0;
          this.convert(actor);
          break;
        }
      }
    }
    this.bolts = this.bolts.filter((bolt) => {
      if (bolt.life > 0 && bolt.x > -4 && bolt.x < 80) return true;
      this.scene.remove(bolt.mesh);
      return false;
    });
  }

  private convert(actor: Actor): void {
    if (actor.phase !== "foe") return;
    actor.phase = "vanish";
    actor.t = 0;
    this.converted += 1;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 2;
    this.score += 100 * this.combo;
    this.banner = "VIROU AMIGO";
    this.bannerT = 0.9;
    this.sfx.play("convert", 0.9);
    if (this.converted % 3 === 1) this.sfx.play("friend", 0.8);
    burst(this, actor.x, 1.1, 0.3, 0x19a34a, 10);
    burst(this, actor.x, 1.3, 0.3, 0xffe14a, 8);
    this.addRing(actor.x, 1.05);
    this.shake = Math.min(0.3, this.shake + 0.08);
  }

  private hurt(amount: number, dir: number): void {
    if (this.mode !== "play" || this.invuln > 0) return;
    this.hp -= amount;
    this.invuln = 0.85;
    this.knock = 0.18;
    this.knockDir = dir || -1;
    this.vy = Math.max(this.vy, 3.2);
    this.shake = 0.28;
    if (this.hp > 0) return;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.hp = 0;
      this.mode = "over";
      this.banner = "";
      return;
    }
    this.hp = 100;
    this.x = Math.max(0.8, this.x - 4);
    this.y = 0;
    this.vy = 0;
  }

  private addBolt(x: number, y: number, vx: number, vy: number, friendly: boolean, color: number): void {
    const mesh = new THREE.Mesh(
      this.boltGeo,
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.set(x, y, 0.25);
    this.scene.add(mesh);
    this.bolts.push({ x, y, px: x, py: y, vx, vy, friendly, life: 1.6, mesh });
  }

  addSpark(x: number, y: number, z: number, color: number): void {
    let spark = this.sparks.find((item) => item.age >= item.life);
    if (!spark) {
      const mesh = new THREE.Mesh(this.sparkGeo, new THREE.MeshBasicMaterial({ color }));
      this.scene.add(mesh);
      spark = { mesh, v: new THREE.Vector3(), life: 0, age: 1 };
      this.sparks.push(spark);
    }
    spark.mesh.visible = true;
    spark.mesh.position.set(x, y, z);
    (spark.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    spark.v.set((Math.random() - 0.5) * 5.5, 1.5 + Math.random() * 4.5, (Math.random() - 0.5) * 2);
    spark.life = 0.42 + Math.random() * 0.2;
    spark.age = 0;
  }

  private addRing(x: number, y: number): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.28, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, side: THREE.DoubleSide, opacity: 1 }),
    );
    mesh.position.set(x, y, 0.4);
    this.scene.add(mesh);
    this.rings.push({ mesh, age: 0 });
  }

  private stepFx(dt: number): void {
    for (const spark of this.sparks) {
      if (spark.age >= spark.life) continue;
      spark.age += dt;
      spark.v.y -= 12 * dt;
      spark.mesh.position.addScaledVector(spark.v, dt);
      const k = 1 - spark.age / spark.life;
      spark.mesh.scale.setScalar(Math.max(0.05, k));
      spark.mesh.visible = k > 0;
    }
    this.rings = this.rings.filter((ring) => {
      ring.age += dt;
      const k = ring.age / 0.45;
      ring.mesh.scale.setScalar(1 + k * 4);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k);
      if (k < 1) return true;
      this.scene.remove(ring.mesh);
      return false;
    });
  }

  private placeActors(): void {
    for (const actor of this.actors) {
      const bob = Math.abs(Math.sin(this.clock * (actor.phase === "friend" ? 8 : 7) + actor.seed)) * (actor.phase === "foe" ? 0.05 : 0.09);
      const h = actor.h * actor.pop;
      const w = actor.w * actor.pop;
      actor.mesh.scale.set(actor.face * Math.max(0.001, w), Math.max(0.001, h), 1);
      actor.mesh.position.set(actor.x, h / 2 + bob, 0);
    }
  }

  private frameCamera(): void {
    const lookX = this.x + this.facing * 1.35;
    const destX = this.x - this.facing * 0.15;
    const destY = 2.35 + this.y * 0.25;
    this.camera.position.x += (destX - this.camera.position.x) * 0.08;
    this.camera.position.y += (destY - this.camera.position.y) * 0.08;
    this.camera.position.z = 16.8;
    this.camera.lookAt(lookX, 1.85 + this.y * 0.15, 0);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
    }
    this.ground.position.x = this.camera.position.x;
    this.sand.offset.x = this.camera.position.x * 0.035;
    this.dunes.position.x = this.camera.position.x * 0.72;
    this.sky.position.x = this.camera.position.x * 0.28;
    this.sun.position.set(this.x + 7, 12, 8);
    this.sun.target.position.set(this.x, 1, 0);
    this.sun.target.updateMatrixWorld();
  }
}

function burst(game: Game, x: number, y: number, z: number, color: number, n: number): void {
  for (let i = 0; i < n; i++) game.addSpark(x, y, z, color);
}

function swept(x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, hw: number, hh: number): boolean {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const bw = 0.16 + Math.abs(x1 - x0) / 2;
  const bh = 0.16 + Math.abs(y1 - y0) / 2;
  return Math.abs(mx - cx) <= bw + hw && Math.abs(my - cy) <= bh + hh;
}

function hideSlabs(root: THREE.Object3D): void {
  const total = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
    const thin = dims[0] < dims[2] * 0.08;
    const big = dims[2] > Math.max(total.x, total.z) * 0.55 && dims[1] > total.y * 0.35;
    if (thin && big) mesh.visible = false;
  });
}

function fitFeet(root: THREE.Object3D, height: number): void {
  root.position.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = height / Math.max(0.001, size.y);
  root.scale.setScalar(scale);
  root.updateWorldMatrix(true, true);
  const fitted = new THREE.Box3().setFromObject(root);
  const center = fitted.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= fitted.min.y;
}

async function loadPlate(url: string, mode: "sky" | "bars"): Promise<THREE.Texture> {
  const img = await loadImage(url);
  const src = document.createElement("canvas");
  src.width = img.width;
  src.height = img.height;
  const ctx = src.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0);
  let top = 0;
  let bottom = src.height;
  if (mode === "sky") {
    bottom = Math.round(src.height * 0.58);
  } else {
    const data = ctx.getImageData(0, 0, src.width, src.height).data;
    const dark = (y: number) => {
      let sum = 0;
      let n = 0;
      for (let x = 0; x < src.width; x += 6) {
        const i = (y * src.width + x) * 4;
        sum += data[i] + data[i + 1] + data[i + 2];
        n += 1;
      }
      return sum / n < 26;
    };
    while (top < bottom - 2 && dark(top)) top += 1;
    while (bottom > top + 2 && dark(bottom - 1)) bottom -= 1;
  }
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = Math.max(1, bottom - top);
  out.getContext("2d")?.drawImage(src, 0, top, src.width, out.height, 0, 0, out.width, out.height);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

async function loadCutout(url: string): Promise<{ tex: THREE.Texture; aspect: number }> {
  const img = await loadImage(url);
  const src = document.createElement("canvas");
  src.width = img.width;
  src.height = img.height;
  const ctx = src.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, src.width, src.height).data;
  let minX = src.width;
  let minY = src.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < src.height; y += 2) {
    for (let x = 0; x < src.width; x += 2) {
      if (pixels[(y * src.width + x) * 4 + 3] <= 18) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const out = document.createElement("canvas");
  if (maxX <= minX || maxY <= minY) {
    out.width = src.width;
    out.height = src.height;
    out.getContext("2d")?.drawImage(src, 0, 0);
  } else {
    const pad = 6;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(src.width - 1, maxX + pad);
    maxY = Math.min(src.height - 1, maxY + pad);
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext("2d")?.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  }
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return { tex, aspect: out.width / Math.max(1, out.height) };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}
