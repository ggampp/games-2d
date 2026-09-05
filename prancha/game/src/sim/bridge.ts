import { resetBeamIds, type Beam } from "./beam.ts";
import type { Layout } from "./layout.ts";
import { BED, type LevelMods, type LoadCase, type PrebuiltMember } from "./loadcase.ts";
import { MATERIALS, SAFETY, TUNING, type MaterialId } from "./materials.ts";
import { Member, resetMemberIds } from "./member.ts";
import { resetNodeIds, SimNode } from "./node.ts";
import type { ContactLoad } from "./vehicle.ts";

export interface Zone {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  label: string;
}

export interface DesignMember {
  m: MaterialId;
  a: [number, number];
  b: [number, number];
}

export interface Design {
  v: 1;
  members: DesignMember[];
}

export type AddResult = { ok: true; member: Member } | { ok: false; error: string };

export interface CostBreakdown {
  material: number;
  foundations: number;
  labor: number;
  total: number;
}

export class BridgeSystem {
  nodes: SimNode[] = [];
  members: Member[] = [];
  /** Lista plana usada pelo solver (segmentos + contraventos). */
  beams: Beam[] = [];
  layout: Layout;
  mods: LevelMods;
  zones: Zone[] = [];
  maxStress = 0;
  peakStress = 0;
  peakDeflectionPx = 0;
  brokenCount = 0;
  simTime = 0;
  onBeamBreak: ((beam: Beam) => void) | null = null;

  constructor(layout: Layout, mods: LevelMods = {}) {
    this.layout = layout;
    this.mods = mods;
    this.buildZones();
    this.initAnchors();
    this.addPrebuilt();
  }

  private buildZones(): void {
    const { leftX, rightX, waterY, ppm, bedY } = this.layout;
    const c = this.mods.clearance;
    if (c) {
      const span = rightX - leftX;
      this.zones.push({
        x0: leftX + span * c.fromFrac,
        x1: leftX + span * c.toFrac,
        y0: waterY - c.heightM * ppm,
        y1: bedY + 40,
        label: `GABARITO ${c.heightM.toFixed(0)} m`,
      });
    }
  }

  private initAnchors(): void {
    const { leftX, rightX, deckY, ppm } = this.layout;
    const lowDx = ppm * 0.75;
    const lowDy = ppm * 1.8;
    const leftTop = new SimNode(leftX, deckY, true, true);
    const leftLow = new SimNode(leftX - lowDx, deckY + lowDy, true, false);
    const rightTop = new SimNode(rightX, deckY, true, true);
    rightTop.isRightBank = true;
    this.nodes.push(leftTop, leftLow, rightTop);
    if (!this.mods.noRightLowAnchor) {
      const rightLow = new SimNode(rightX + lowDx, deckY + lowDy, true, false);
      rightLow.isRightBank = true;
      this.nodes.push(rightLow);
    }
  }

  private addPrebuilt(): void {
    for (const p of this.mods.prebuilt ?? []) {
      const nodes: SimNode[] = [];
      for (const [x, y] of p.points) {
        const n = this.placePoint(this.mx(x), this.my(y), true);
        if (!n) continue;
        if (n.isFoundation) n.freeFoundation = true;
        nodes.push(n);
      }
      if (nodes.length >= 2) this.addPolyline(nodes, p.material);
    }
  }

  /** Peça contínua (patrimônio) passando por vários pontos; juntas rígidas. */
  addPolyline(points: SimNode[], materialId: MaterialId): Member {
    const mat = MATERIALS[materialId];
    const chain: SimNode[] = [points[0]];
    let lengthM = 0;
    for (let k = 0; k < points.length - 1; k++) {
      const a = points[k];
      const b = points[k + 1];
      const dist = Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
      lengthM += dist / this.layout.ppm;
      const parts = mat.bendStiff ? Math.max(1, Math.round(dist / (this.layout.ppm * TUNING.segmentM))) : 1;
      for (let i = 1; i < parts; i++) {
        const t = i / parts;
        const n = new SimNode(a.pos.x + (b.pos.x - a.pos.x) * t, a.pos.y + (b.pos.y - a.pos.y) * t, false, mat.canBeRoad);
        this.nodes.push(n);
        chain.push(n);
      }
      chain.push(b);
    }
    const member = new Member(chain, materialId, this.layout.ppm, true, lengthM);
    this.members.push(member);
    this.rebuildBeams();
    return member;
  }

  get leftDeck(): SimNode {
    return this.nodes[0];
  }

  get rightDeck(): SimNode {
    return this.nodes[2];
  }

  mx(meters: number): number {
    return this.layout.leftX + meters * this.layout.ppm;
  }

  my(meters: number): number {
    if (meters === BED) return this.layout.bedY;
    return this.layout.deckY + meters * this.layout.ppm;
  }

  clear(): void {
    this.nodes = [];
    this.members = [];
    this.beams = [];
    resetNodeIds();
    resetBeamIds();
    resetMemberIds();
    this.resetStats();
    this.initAnchors();
    this.addPrebuilt();
  }

  private resetStats(): void {
    this.maxStress = 0;
    this.peakStress = 0;
    this.peakDeflectionPx = 0;
    this.brokenCount = 0;
    this.simTime = 0;
  }

  // ---------- geometria / regras ----------

  get piersAllowed(): boolean {
    return this.mods.piers !== "forbidden";
  }

  pierRange(): [number, number] {
    const p = this.mods.piers;
    const { leftX, rightX } = this.layout;
    if (!p || p === "forbidden") return [leftX - 60, rightX + 60];
    const span = rightX - leftX;
    return [leftX + span * (p.fromFrac ?? 0), leftX + span * (p.toFrac ?? 1)];
  }

  foundationCost(): number {
    const p = this.mods.piers;
    if (p && p !== "forbidden" && p.cost) return p.cost;
    return SAFETY.foundationCost;
  }

  isOnBed(x: number, y: number): boolean {
    if (!this.piersAllowed) return false;
    const [x0, x1] = this.pierRange();
    return Math.abs(y - this.layout.bedY) < 16 && x >= x0 && x <= x1;
  }

  snap(x: number, y: number): { x: number; y: number; bed: boolean } {
    if (this.isOnBed(x, y)) {
      const g = this.layout.snapPx;
      const sx = this.layout.leftX + Math.round((x - this.layout.leftX) / g) * g;
      return { x: sx, y: this.layout.bedY, bed: true };
    }
    const g = this.layout.snapPx;
    return {
      x: this.layout.leftX + Math.round((x - this.layout.leftX) / g) * g,
      y: this.layout.deckY + Math.round((y - this.layout.deckY) / g) * g,
      bed: false,
    };
  }

  inBuildEnvelope(x: number, y: number): boolean {
    const { leftX, rightX, topY, waterY, bedY } = this.layout;
    if (x < leftX - 80 || x > rightX + 80 || y < topY) return false;
    if (this.isOnBed(x, y)) return true;
    const floor = this.piersAllowed ? bedY - 24 : waterY - 30;
    return y <= floor;
  }

  inZone(x: number, y: number): Zone | null {
    for (const z of this.zones) {
      if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z;
    }
    return null;
  }

  private segmentHitsZone(ax: number, ay: number, bx: number, by: number): Zone | null {
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const z = this.inZone(ax + (bx - ax) * t, ay + (by - ay) * t);
      if (z) return z;
    }
    return null;
  }

  findNodeNear(x: number, y: number, max = 20): SimNode | null {
    let best: SimNode | null = null;
    let min = max;
    for (const node of this.nodes) {
      const d = Math.hypot(node.pos.x - x, node.pos.y - y);
      if (d < min) {
        min = d;
        best = node;
      }
    }
    return best;
  }

  findMemberNear(x: number, y: number, max = 14): Member | null {
    let best: Member | null = null;
    let min = max;
    for (const m of this.members) {
      for (const beam of m.segments) {
        const pA = beam.nodeA.pos;
        const pB = beam.nodeB.pos;
        const segX = pB.x - pA.x;
        const segY = pB.y - pA.y;
        const lenSq = segX * segX + segY * segY;
        if (lenSq < 1) continue;
        const t = Math.max(0, Math.min(1, ((x - pA.x) * segX + (y - pA.y) * segY) / lenSq));
        const d = Math.hypot(x - (pA.x + t * segX), y - (pA.y + t * segY));
        if (d < min) {
          min = d;
          best = m;
        }
      }
    }
    return best;
  }

  /** Devolve um nó existente perto do ponto, ou cria um novo (fundação se estiver no leito). */
  placePoint(x: number, y: number, force = false): SimNode | null {
    const existing = this.findNodeNear(x, y, 22);
    if (existing) return existing;
    if (!force && !this.inBuildEnvelope(x, y)) return null;
    const s = this.snap(x, y);
    const node = new SimNode(s.x, s.y, s.bed, false);
    if (s.bed) {
      node.isFoundation = true;
      node.radius = 7;
    }
    this.nodes.push(node);
    return node;
  }

  usedM(materialId: MaterialId): number {
    return this.members
      .filter((m) => !m.locked && m.materialId === materialId)
      .reduce((s, m) => s + m.lengthM, 0);
  }

  addMember(nodeA: SimNode, nodeB: SimNode, materialId: MaterialId, locked = false): AddResult {
    if (nodeA === nodeB) return { ok: false, error: "Peça sem comprimento." };
    const dup = this.members.some(
      (m) => (m.a === nodeA && m.b === nodeB) || (m.a === nodeB && m.b === nodeA),
    );
    if (dup) return { ok: false, error: "Já existe uma peça entre esses nós." };
    const mat = MATERIALS[materialId];
    const dist = Math.hypot(nodeB.pos.x - nodeA.pos.x, nodeB.pos.y - nodeA.pos.y);
    const lengthM = dist / this.layout.ppm;
    if (lengthM > mat.maxLengthM + 0.05) {
      return { ok: false, error: `${mat.name}: máximo ${mat.maxLengthM.toFixed(0)} m por peça.` };
    }
    if (nodeA.isAnchor && nodeB.isAnchor && nodeA.isFoundation === false && nodeB.isFoundation === false && lengthM < 3) {
      return { ok: false, error: "Peça entre apoios do mesmo encontro não trabalha." };
    }
    if (!locked) {
      const quota = this.mods.quotaM?.[materialId];
      if (quota !== undefined && this.usedM(materialId) + lengthM > quota + 0.01) {
        return {
          ok: false,
          error: `${mat.name}: só ${quota.toFixed(0)} m no canteiro (${this.usedM(materialId).toFixed(1)} m usados).`,
        };
      }
      const z = this.segmentHitsZone(nodeA.pos.x, nodeA.pos.y, nodeB.pos.x, nodeB.pos.y);
      if (z) return { ok: false, error: `Peça invade o ${z.label.toLowerCase()}.` };
    }

    const segPx = this.layout.ppm * TUNING.segmentM;
    const parts = mat.bendStiff ? Math.max(1, Math.round(dist / segPx)) : 1;
    const chain: SimNode[] = [nodeA];
    for (let i = 1; i < parts; i++) {
      const t = i / parts;
      const nx = nodeA.pos.x + (nodeB.pos.x - nodeA.pos.x) * t;
      const ny = nodeA.pos.y + (nodeB.pos.y - nodeA.pos.y) * t;
      const n = new SimNode(nx, ny, false, mat.canBeRoad);
      this.nodes.push(n);
      chain.push(n);
    }
    chain.push(nodeB);
    const member = new Member(chain, materialId, this.layout.ppm, locked);
    this.members.push(member);
    this.rebuildBeams();
    return { ok: true, member };
  }

  removeMember(member: Member): boolean {
    if (member.locked) return false;
    const i = this.members.indexOf(member);
    if (i === -1) return false;
    this.members.splice(i, 1);
    this.rebuildBeams();
    this.cleanupOrphans();
    return true;
  }

  private rebuildBeams(): void {
    this.beams = [];
    for (const m of this.members) this.beams.push(...m.beams);
    this.recomputeMasses();
  }

  cleanupOrphans(): void {
    const used = new Set<SimNode>();
    for (const b of this.beams) {
      used.add(b.nodeA);
      used.add(b.nodeB);
    }
    this.nodes = this.nodes.filter((node) => {
      if (node.isAnchor && !node.isFoundation) return true;
      return used.has(node);
    });
  }

  private recomputeMasses(): void {
    for (const n of this.nodes) n.mass = 0.25;
    for (const m of this.members) {
      for (const seg of m.segments) {
        const half = (m.material.weight * seg.lengthM(this.layout.ppm)) / 2;
        seg.nodeA.mass += half;
        seg.nodeB.mass += half;
      }
    }
  }

  // ---------- custo ----------

  costs(): CostBreakdown {
    const material = this.members.filter((m) => !m.locked).reduce((s, m) => s + m.cost(), 0);
    const foundations = this.nodes.filter((n) => n.isFoundation && !n.freeFoundation).length * this.foundationCost();
    const labor = material * SAFETY.laborFraction;
    return { material, foundations, labor, total: material + foundations + labor };
  }

  totalCost(): number {
    return this.costs().total;
  }

  // ---------- serialização ----------

  serialize(): Design {
    const { leftX, deckY, ppm } = this.layout;
    const pt = (n: SimNode): [number, number] => [
      Math.round(((n.initialPos.x - leftX) / ppm) * 100) / 100,
      Math.round(((n.initialPos.y - deckY) / ppm) * 100) / 100,
    ];
    return {
      v: 1,
      members: this.members.filter((m) => !m.locked).map((m) => ({ m: m.materialId, a: pt(m.a), b: pt(m.b) })),
    };
  }

  load(design: Design): void {
    this.clear();
    for (const d of design.members) {
      const a = this.placePoint(this.mx(d.a[0]), this.my(d.a[1]));
      const b = this.placePoint(this.mx(d.b[0]), this.my(d.b[1]));
      if (!a || !b) continue;
      const r = this.addMember(a, b, d.m);
      if (!r.ok) this.cleanupOrphans();
    }
  }

  // ---------- simulação ----------

  resetPhysics(): void {
    for (const n of this.nodes) n.reset();
    for (const m of this.members) m.reset();
    this.resetStats();
  }

  /**
   * Assenta a estrutura sob peso próprio antes do ensaio (como a retirada do
   * escoramento), com amortecimento alto. Rupturas aqui são reais: a obra não
   * se sustenta sozinha. Depois disso a flecha passa a ser medida a partir da
   * posição assentada e o pico de esforço reflete a carga móvel.
   */
  presettle(loads: LoadCase): void {
    const dt = 1 / 60;
    for (let i = 0; i < 150; i++) this.update(dt, loads, [], 0.9);
    for (const n of this.nodes) n.baseY = n.pos.y;
    this.maxStress = 0;
    this.peakStress = 0;
    this.peakDeflectionPx = 0;
    this.simTime = 0;
  }

  update(dt: number, loads: LoadCase, contact: ContactLoad[] = [], damping = 0.993): void {
    const sub = TUNING.substeps;
    const subDt = dt / sub;
    const gravity = TUNING.gravity * loads.gravityMul;
    const wind = loads.windNow;
    const waterY = loads.waterY;
    const settle = loads.settlementPx;
    let frameMax = 0;
    let frameDefl = 0;
    this.simTime += dt;
    const counting = this.simTime > 0.05;

    for (let s = 0; s < sub; s++) {
      for (const node of this.nodes) {
        if (node.isAnchor) {
          if (node.isRightBank) node.anchorOffset.y = settle;
        } else {
          node.submerged = node.pos.y > waterY;
          let fy = gravity * node.mass;
          let fx = wind * (0.4 + node.mass * 0.6);
          if (node.submerged) {
            fy -= gravity * node.mass * 0.6;
            fx += 45;
          }
          node.applyForce(fx, fy);
        }
      }
      for (const c of contact) c.node.applyForce(0, c.fy);
      for (const node of this.nodes) node.integrate(subDt, damping);
      for (let it = 0; it < TUNING.iterations; it++) {
        for (const beam of this.beams) beam.solveConstraint();
      }
      for (const member of this.members) {
        const broken = member.resolveBreaks(this.simTime);
        for (const seg of broken) {
          this.brokenCount++;
          this.onBeamBreak?.(seg);
        }
        if (counting) {
          const m = member.maxEffStress();
          if (m > frameMax) frameMax = m;
        }
      }
    }

    for (const node of this.nodes) {
      if (node.isAnchor || !node.isRoad) continue;
      const d = node.pos.y - node.baseY;
      if (d > frameDefl) frameDefl = d;
    }

    const k = Math.min(1, dt / 0.2);
    for (const m of this.members) {
      for (const seg of m.segments) seg.displayStress += (seg.effStress - seg.displayStress) * k;
    }

    this.maxStress = frameMax;
    if (frameMax > this.peakStress) this.peakStress = frameMax;
    if (counting && frameDefl > this.peakDeflectionPx) this.peakDeflectionPx = frameDefl;
  }

  factorOfSafety(): number {
    if (this.brokenCount > 0) return Math.min(0.99, 1 / Math.max(1, this.peakStress));
    if (this.peakStress <= 0.05) return 9.99;
    return Math.min(9.99, 1 / this.peakStress);
  }

  deflectionM(): number {
    return this.peakDeflectionPx / this.layout.ppm;
  }

  roadBeams(): Beam[] {
    const out: Beam[] = [];
    for (const m of this.members) {
      for (const s of m.segments) if (!s.isBroken && s.isRoad) out.push(s);
    }
    return out;
  }

  worstSegment(): Beam | null {
    let best: Beam | null = null;
    for (const m of this.members) {
      for (const s of m.segments) {
        if (!best || s.effStress > best.effStress) best = s;
      }
    }
    return best;
  }

  prebuiltSpec(): PrebuiltMember[] {
    return this.mods.prebuilt ?? [];
  }
}
