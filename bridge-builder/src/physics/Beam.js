import { Vector2 } from './Vector2.js';
import { MATERIALS } from './Material.js';

let nextBeamId = 1;

export class Beam {
  constructor(nodeA, nodeB, materialKey = 'WOOD') {
    this.id = nextBeamId++;
    this.nodeA = nodeA;
    this.nodeB = nodeB;
    this.materialKey = materialKey;
    this.material = MATERIALS[materialKey] || MATERIALS.WOOD;

    const dx = nodeB.pos.x - nodeA.pos.x;
    const dy = nodeB.pos.y - nodeA.pos.y;
    this.restLength = Math.max(1, Math.sqrt(dx * dx + dy * dy));

    this.isBroken = false;
    this.stress = 0; // 0.0 to 1.0+ (1.0 = breaking point)
    this.isTension = true;
    this.breakCooldown = 0;
  }

  getCost() {
    return Math.round(this.restLength * this.material.costPerUnit * 0.1);
  }

  reset() {
    this.isBroken = false;
    this.stress = 0;
    this.isTension = true;
  }

  solveConstraint() {
    if (this.isBroken) return false;

    const pA = this.nodeA.pos;
    const pB = this.nodeB.pos;

    let dx = pB.x - pA.x;
    let dy = pB.y - pA.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.0001) return false;

    const delta = dist - this.restLength;
    const strain = delta / this.restLength;

    // Cables do not resist compression (they go slack)
    if (this.material.tensionOnly && delta < 0) {
      this.stress = 0;
      return false;
    }

    const stressRatio = Math.abs(strain) / this.material.breakingStrain;
    this.stress = stressRatio;
    this.isTension = delta >= 0;

    // Check breaking condition
    if (stressRatio > 1.0) {
      this.isBroken = true;
      return true; // Signals a break occurred
    }

    const wA = this.nodeA.isAnchor ? 0 : 1;
    const wB = this.nodeB.isAnchor ? 0 : 1;
    const wTotal = wA + wB;

    if (wTotal === 0) return false;

    const diff = (delta / dist) * this.material.stiffness;
    const offsetX = dx * diff;
    const offsetY = dy * diff;

    if (!this.nodeA.isAnchor) {
      pA.x += offsetX * (wA / wTotal);
      pA.y += offsetY * (wA / wTotal);
    }

    if (!this.nodeB.isAnchor) {
      pB.x -= offsetX * (wB / wTotal);
      pB.y -= offsetY * (wB / wTotal);
    }

    return false;
  }

  getStressColor() {
    if (this.isBroken) return '#404040';
    const s = Math.min(1.0, this.stress);

    if (s < 0.35) {
      // Normal material color or subtle green
      return this.material.color;
    } else if (s < 0.65) {
      // Green to Yellow
      const t = (s - 0.35) / 0.30;
      return `rgb(${Math.round(80 + 175 * t)}, ${Math.round(200 - 15 * t)}, 50)`;
    } else if (s < 0.85) {
      // Yellow to Orange
      const t = (s - 0.65) / 0.20;
      return `rgb(255, ${Math.round(185 - 85 * t)}, 30)`;
    } else {
      // Orange to Flash Red
      const t = (s - 0.85) / 0.15;
      return `rgb(255, ${Math.round(100 - 80 * t)}, ${Math.round(30 + 10 * t)})`;
    }
  }
}

export function resetBeamIdCounter() {
  nextBeamId = 1;
}
