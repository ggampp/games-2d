import { Vector2 } from './Vector2.js';

let nextNodeId = 1;

export class Node {
  constructor(x, y, isAnchor = false, isRoad = false) {
    this.id = nextNodeId++;
    this.pos = new Vector2(x, y);
    this.oldPos = new Vector2(x, y);
    this.initialPos = new Vector2(x, y);
    this.forces = new Vector2(0, 0);
    this.isAnchor = isAnchor;
    this.isRoad = isRoad;
    this.mass = isAnchor ? 0 : 1.2;
    this.radius = isAnchor ? 7 : 5.5;
  }

  reset() {
    this.pos.copy(this.initialPos);
    this.oldPos.copy(this.initialPos);
    this.forces.set(0, 0);
  }

  applyForce(fx, fy) {
    if (this.isAnchor) return;
    this.forces.x += fx;
    this.forces.y += fy;
  }

  integrate(dt, damping = 0.992) {
    if (this.isAnchor) {
      this.pos.copy(this.initialPos);
      this.oldPos.copy(this.initialPos);
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

export function resetNodeIdCounter() {
  nextNodeId = 1;
}
