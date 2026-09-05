import { Node, resetNodeIdCounter } from './Node.js';
import { Beam, resetBeamIdCounter } from './Beam.js';
import { MATERIALS } from './Material.js';

export class BridgeSystem {
  constructor() {
    this.nodes = [];
    this.beams = [];

    // Cliff anchor points & canyon dimensions
    this.leftCliff = { startX: 0, endX: 180, y: 260 };
    this.rightCliff = { startX: 740, endX: 960, y: 260 };
    this.waterY = 510;

    this.maxStress = 0; // Peak stress percentage
    this.peakStressRecord = 0;
    this.brokenBeamsCount = 0;

    this.onBeamBreak = null; // Callback for audio and visual particles
    this.initDefaultAnchors();
  }

  clear() {
    this.nodes = [];
    this.beams = [];
    resetNodeIdCounter();
    resetBeamIdCounter();
    this.maxStress = 0;
    this.peakStressRecord = 0;
    this.brokenBeamsCount = 0;
    this.initDefaultAnchors();
  }

  initDefaultAnchors() {
    // Left cliff anchors
    const leftTop = new Node(180, 260, true, true);
    const leftMid = new Node(180, 335, true, false);
    const leftLow = new Node(125, 410, true, false);
    const leftBase = new Node(95, 475, true, false);

    // Right cliff anchors
    const rightTop = new Node(740, 260, true, true);
    const rightMid = new Node(740, 335, true, false);
    const rightLow = new Node(795, 410, true, false);
    const rightBase = new Node(825, 475, true, false);

    // Deep gorge rock foundation (for arch and fan strut foundations)
    const gorgeMid = new Node(460, 480, true, false);

    this.nodes.push(leftTop, leftMid, leftLow, leftBase, rightTop, rightMid, rightLow, rightBase, gorgeMid);
  }

  addNode(x, y, isAnchor = false, isRoad = false) {
    const node = new Node(x, y, isAnchor, isRoad);
    this.nodes.push(node);
    return node;
  }

  addBeam(nodeA, nodeB, materialKey) {
    if (nodeA === nodeB) return null;

    // Check if beam already exists between these nodes
    const exists = this.beams.some(b => 
      (b.nodeA === nodeA && b.nodeB === nodeB) || 
      (b.nodeA === nodeB && b.nodeB === nodeA)
    );
    if (exists) return null;

    const beam = new Beam(nodeA, nodeB, materialKey);
    this.beams.push(beam);
    return beam;
  }

  removeBeam(beam) {
    const index = this.beams.indexOf(beam);
    if (index !== -1) {
      this.beams.splice(index, 1);
      this.cleanupOrphanNodes();
      return true;
    }
    return false;
  }

  removeNode(node) {
    if (node.isAnchor) return false;
    // Remove all beams attached to this node
    this.beams = this.beams.filter(b => b.nodeA !== node && b.nodeB !== node);
    const index = this.nodes.indexOf(node);
    if (index !== -1) {
      this.nodes.splice(index, 1);
    }
    return true;
  }

  cleanupOrphanNodes() {
    // Keep anchors and nodes connected to at least one beam
    this.nodes = this.nodes.filter(node => {
      if (node.isAnchor) return true;
      return this.beams.some(b => b.nodeA === node || b.nodeB === node);
    });
  }

  findNodeNear(x, y, maxDistance = 18) {
    let closestNode = null;
    let minDist = maxDistance;

    for (const node of this.nodes) {
      const d = Math.hypot(node.pos.x - x, node.pos.y - y);
      if (d < minDist) {
        minDist = d;
        closestNode = node;
      }
    }
    return closestNode;
  }

  findBeamNear(x, y, maxDistance = 14) {
    let closestBeam = null;
    let minDist = maxDistance;

    for (const beam of this.beams) {
      const pA = beam.nodeA.pos;
      const pB = beam.nodeB.pos;

      const segX = pB.x - pA.x;
      const segY = pB.y - pA.y;
      const segLenSq = segX * segX + segY * segY;

      if (segLenSq < 1) continue;

      const t = Math.max(0, Math.min(1, ((x - pA.x) * segX + (y - pA.y) * segY) / segLenSq));
      const projX = pA.x + t * segX;
      const projY = pA.y + t * segY;

      const d = Math.hypot(x - projX, y - projY);
      if (d < minDist) {
        minDist = d;
        closestBeam = beam;
      }
    }
    return closestBeam;
  }

  getTotalCost() {
    return this.beams.reduce((sum, beam) => sum + beam.getCost(), 0);
  }

  resetPhysics() {
    for (const node of this.nodes) {
      node.reset();
    }
    for (const beam of this.beams) {
      beam.reset();
    }
    this.maxStress = 0;
    this.peakStressRecord = 0;
    this.brokenBeamsCount = 0;
  }

  update(dt) {
    const gravity = 380;
    const subSteps = 12;
    const subDt = dt / subSteps;

    let currentFrameMaxStress = 0;

    for (let step = 0; step < subSteps; step++) {
      // 1. Apply gravity to dynamic nodes
      for (const node of this.nodes) {
        if (!node.isAnchor) {
          node.applyForce(0, gravity * node.mass);
        }
        node.integrate(subDt, 0.993);
      }

      // 2. Solve beam constraints relaxation
      for (const beam of this.beams) {
        const snapped = beam.solveConstraint();
        if (snapped) {
          this.brokenBeamsCount++;
          if (this.onBeamBreak) {
            this.onBeamBreak(beam);
          }
        }
        if (!beam.isBroken && beam.stress > currentFrameMaxStress) {
          currentFrameMaxStress = beam.stress;
        }
      }
    }

    this.maxStress = currentFrameMaxStress;
    if (this.maxStress > this.peakStressRecord) {
      this.peakStressRecord = this.maxStress;
    }
  }
}
