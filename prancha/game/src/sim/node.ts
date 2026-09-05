import { Vec2 } from "./vec2.ts";

let nextNodeId = 1;

export class SimNode {
  readonly id: number;
  pos: Vec2;
  oldPos: Vec2;
  initialPos: Vec2;
  /** Deslocamento imposto ao apoio (recalque). */
  anchorOffset = new Vec2();
  forces = new Vec2();
  isAnchor: boolean;
  isRoad: boolean;
  /** Apoio criado pelo jogador no leito (tem custo). */
  isFoundation = false;
  /** Fundação pré-existente (não entra no custo). */
  freeFoundation = false;
  /** Apoio da margem direita (recebe recalque diferencial). */
  isRightBank = false;
  mass = 1;
  radius: number;
  submerged = false;
  /** Cota após o assentamento sob peso próprio (referência da flecha). */
  baseY: number;

  constructor(x: number, y: number, isAnchor = false, isRoad = false) {
    this.id = nextNodeId++;
    this.pos = new Vec2(x, y);
    this.oldPos = new Vec2(x, y);
    this.initialPos = new Vec2(x, y);
    this.isAnchor = isAnchor;
    this.isRoad = isRoad;
    this.radius = isAnchor ? 8 : 5.5;
    this.baseY = y;
  }

  reset(): void {
    this.pos.copy(this.initialPos);
    this.oldPos.copy(this.initialPos);
    this.anchorOffset.set(0, 0);
    this.forces.set(0, 0);
    this.submerged = false;
    this.baseY = this.initialPos.y;
  }

  applyForce(fx: number, fy: number): void {
    if (this.isAnchor) return;
    this.forces.x += fx;
    this.forces.y += fy;
  }

  integrate(dt: number, damping = 0.993): void {
    if (this.isAnchor) {
      this.pos.set(this.initialPos.x + this.anchorOffset.x, this.initialPos.y + this.anchorOffset.y);
      this.oldPos.copy(this.pos);
      return;
    }
    const vx = (this.pos.x - this.oldPos.x) * damping;
    const vy = (this.pos.y - this.oldPos.y) * damping;
    const ax = this.forces.x / this.mass;
    const ay = this.forces.y / this.mass;
    const nextX = this.pos.x + vx + ax * dt * dt;
    const nextY = this.pos.y + vy + ay * dt * dt;
    this.oldPos.copy(this.pos);
    this.pos.set(nextX, nextY);
    this.forces.set(0, 0);
  }
}

export function resetNodeIds(): void {
  nextNodeId = 1;
}
