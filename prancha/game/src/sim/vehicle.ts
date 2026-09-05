import type { Beam } from "./beam.ts";
import type { Layout } from "./layout.ts";
import { TUNING } from "./materials.ts";
import type { SimNode } from "./node.ts";
import { Vec2 } from "./vec2.ts";

export interface ContactLoad {
  node: SimNode;
  fy: number;
}

export interface VehicleSpec {
  id: string;
  name: string;
  chassisWidth: number;
  chassisHeight: number;
  wheelBase: number;
  wheelRadius: number;
  /** Eixos: a carga total se divide entre eles. */
  axles: number;
  enginePower: number;
  maxSpeed: number;
  sprite: string;
}

export const VEHICLES: Record<string, VehicleSpec> = {
  van: {
    id: "van",
    name: "Van",
    chassisWidth: 92,
    chassisHeight: 42,
    wheelBase: 58,
    wheelRadius: 11,
    axles: 2,
    enginePower: 150,
    maxSpeed: 200,
    sprite: "/assets/sprites/vehicles/veh_van.png",
  },
  truck: {
    id: "truck",
    name: "Caminhão",
    chassisWidth: 118,
    chassisHeight: 48,
    wheelBase: 78,
    wheelRadius: 13,
    axles: 2,
    enginePower: 70,
    maxSpeed: 90,
    sprite: "/assets/sprites/vehicles/veh_truck.png",
  },
  bus: {
    id: "bus",
    name: "Ônibus",
    chassisWidth: 150,
    chassisHeight: 50,
    wheelBase: 110,
    wheelRadius: 12,
    axles: 2,
    enginePower: 60,
    maxSpeed: 80,
    sprite: "/assets/sprites/vehicles/veh_bus.png",
  },
  bitrem: {
    id: "bitrem",
    name: "Bitrem",
    chassisWidth: 210,
    chassisHeight: 48,
    wheelBase: 150,
    wheelRadius: 12,
    axles: 5,
    enginePower: 45,
    maxSpeed: 60,
    sprite: "/assets/sprites/vehicles/veh_bitrem.png",
  },
};

export class Vehicle {
  spec: VehicleSpec;
  pos: Vec2;
  vel = new Vec2();
  angle = 0;
  angularVel = 0;
  readonly dir: 1 | -1;
  readonly loadT: number;
  readonly startAt: number;
  initialX: number;
  initialY: number;
  hasFallen = false;
  hasFinished = false;
  splashed = false;
  wheelRotation = 0;
  stuckTime = 0;
  grounded = true;
  /** Cargas de contato desta frame, aplicadas pelo solver em todos os substeps. */
  loads: ContactLoad[] = [];
  private time = 0;

  constructor(specId: string, loadT: number, dir: 1 | -1, startAt: number, layout: Layout) {
    this.spec = VEHICLES[specId] ?? VEHICLES.van;
    this.dir = dir;
    this.loadT = loadT;
    this.startAt = startAt;
    const off = 120 + this.spec.chassisWidth * 0.6;
    this.initialX = dir === 1 ? layout.leftX - off : layout.rightX + off;
    this.initialY = layout.deckY - 15;
    this.pos = new Vec2(this.initialX, this.initialY);
  }

  get active(): boolean {
    return this.time >= this.startAt;
  }

  reset(): void {
    this.pos.set(this.initialX, this.initialY);
    this.vel.set(0, 0);
    this.angle = 0;
    this.angularVel = 0;
    this.hasFallen = false;
    this.hasFinished = false;
    this.splashed = false;
    this.wheelRotation = 0;
    this.stuckTime = 0;
    this.grounded = true;
    this.loads = [];
    this.time = 0;
  }

  wheelPositions(): { rear: Vec2; front: Vec2 } {
    const half = this.spec.wheelBase / 2;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    return {
      rear: new Vec2(this.pos.x - cos * half, this.pos.y - sin * half + 4),
      front: new Vec2(this.pos.x + cos * half, this.pos.y + sin * half + 4),
    };
  }

  /** Posições dos eixos ao longo do entre-eixos. */
  axlePositions(): Vec2[] {
    const n = this.spec.axles;
    const half = this.spec.wheelBase / 2;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const out: Vec2[] = [];
    for (let i = 0; i < n; i++) {
      const d = n === 1 ? 0 : -half + (this.spec.wheelBase * i) / (n - 1);
      out.push(new Vec2(this.pos.x + cos * d, this.pos.y + sin * d + 4));
    }
    return out;
  }

  update(dt: number, roadBeams: Beam[], layout: Layout, waterY: number, released: boolean): void {
    this.loads = [];
    if (this.hasFinished || this.hasFallen) return;
    if (released) this.time += dt;
    if (!this.active) return;

    this.vel.y += 420 * dt;
    const wheels = this.wheelPositions();
    const rear = this.resolveWheel(wheels.rear, roadBeams, layout, 0);
    const front = this.resolveWheel(wheels.front, roadBeams, layout, 0);
    const perAxle = (this.loadT * TUNING.loadPerTon) / this.spec.axles + Math.max(0, this.vel.y) * 2;
    for (const axle of this.axlePositions()) this.resolveWheel(axle, roadBeams, layout, perAxle);
    this.grounded = rear.grounded || front.grounded;

    if (this.grounded) {
      const speed = this.vel.x * this.dir;
      if (speed < this.spec.maxSpeed) this.vel.x += this.spec.enginePower * dt * this.dir;
      if (this.vel.y > 0) this.vel.y = 0;
      const snap =
        rear.grounded && front.grounded
          ? (rear.snapY + front.snapY) / 2
          : rear.grounded
            ? rear.snapY
            : front.snapY;
      this.pos.y += (snap - this.pos.y) * 0.55;
      const targetAngle =
        rear.grounded && front.grounded ? Math.atan2(front.snapY - rear.snapY, this.spec.wheelBase) : 0;
      this.angle += (targetAngle - this.angle) * 0.3;
      this.angularVel *= 0.7;
    } else {
      this.vel.x *= Math.pow(0.995, dt * 60);
      this.angularVel += 1.4 * dt * this.dir;
      this.angle += this.angularVel * dt;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.wheelRotation += (this.vel.x / this.spec.wheelRadius) * dt;

    const inside = this.pos.x > layout.leftX && this.pos.x < layout.rightX;
    if (inside && Math.abs(this.vel.x) < 6) this.stuckTime += dt;
    else this.stuckTime = 0;

    if (this.pos.y > waterY + 80) this.hasFallen = true;
    const done = this.dir === 1 ? this.pos.x > layout.rightX + 40 : this.pos.x < layout.leftX - 40;
    if (done && !this.hasFallen) this.hasFinished = true;
  }

  private resolveWheel(
    wheel: Vec2,
    roadBeams: Beam[],
    layout: Layout,
    load: number,
  ): { grounded: boolean; snapY: number } {
    const r = this.spec.wheelRadius;
    let grounded = false;
    let surface = wheel.y + r;
    let bestY = Infinity;
    let bestBeam: Beam | null = null;
    let bestT = 0;

    const trySurface = (y: number, beam: Beam | null, t: number): void => {
      if (wheel.y + r >= y - 8 && wheel.y < y + r + 8 && y <= bestY) {
        grounded = true;
        surface = y;
        bestY = y;
        bestBeam = beam;
        bestT = t;
      }
    };

    if (wheel.x <= layout.leftX) trySurface(layout.deckY, null, 0);
    if (wheel.x >= layout.rightX) trySurface(layout.deckY, null, 0);

    for (const beam of roadBeams) {
      const pA = beam.nodeA.pos;
      const pB = beam.nodeB.pos;
      const segX = pB.x - pA.x;
      const segY = pB.y - pA.y;
      const lenSq = segX * segX + segY * segY;
      if (lenSq < 1) continue;
      const t = Math.max(0, Math.min(1, ((wheel.x - pA.x) * segX + (wheel.y - pA.y) * segY) / lenSq));
      const projX = pA.x + t * segX;
      const projY = pA.y + t * segY;
      if (Math.abs(wheel.x - projX) > r + 14) continue;
      trySurface(projY, beam, t);
    }

    if (bestBeam && load > 0) {
      const b: Beam = bestBeam;
      // A laje espalha a roda: 60% no segmento de contato, 20% em cada vizinho.
      const outerA = roadBeams.find((o) => o !== b && (o.nodeA === b.nodeA || o.nodeB === b.nodeA));
      const outerB = roadBeams.find((o) => o !== b && (o.nodeA === b.nodeB || o.nodeB === b.nodeB));
      let fa = load * (1 - bestT) * 0.6;
      let fb = load * bestT * 0.6;
      const spreadA = load * (1 - bestT) * 0.4;
      const spreadB = load * bestT * 0.4;
      if (outerA) {
        const far = outerA.nodeA === b.nodeA ? outerA.nodeB : outerA.nodeA;
        this.loads.push({ node: far, fy: spreadA * 0.5 });
        fa += spreadA * 0.5;
      } else fa += spreadA;
      if (outerB) {
        const far = outerB.nodeA === b.nodeB ? outerB.nodeB : outerB.nodeA;
        this.loads.push({ node: far, fy: spreadB * 0.5 });
        fb += spreadB * 0.5;
      } else fb += spreadB;
      this.loads.push({ node: b.nodeA, fy: fa }, { node: b.nodeB, fy: fb });
    }

    return { grounded, snapY: surface - r - 4 };
  }
}
