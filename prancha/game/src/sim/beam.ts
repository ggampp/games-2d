import { MATERIALS, TUNING, type Material, type MaterialId } from "./materials.ts";
import type { SimNode } from "./node.ts";

let nextBeamId = 1;

/**
 * Barra elementar do solver. Uma peça desenhada pelo jogador (Member) vira uma
 * cadeia de segmentos visíveis + contraventos ocultos que dão rigidez à flexão.
 */
export class Beam {
  readonly id: number;
  nodeA: SimNode;
  nodeB: SimNode;
  materialId: MaterialId;
  material: Material;
  restLength: number;
  isBroken = false;
  /** Esforço instantâneo (1 = ruptura). */
  stress = 0;
  /** Esforço efetivo (axial + flexão herdada dos contraventos). */
  effStress = 0;
  /** Esforço suavizado para a leitura de cores. */
  displayStress = 0;
  isTension = true;
  isRoad = false;
  slack = false;
  hidden = false;
  /** Fator de capacidade à compressão (flambagem). */
  compScale = 1;
  overloadTicks = 0;
  /** Pico de esforço efetivo e instante (diagnóstico). */
  peak = 0;
  peakT = 0;

  constructor(nodeA: SimNode, nodeB: SimNode, materialId: MaterialId) {
    this.id = nextBeamId++;
    this.nodeA = nodeA;
    this.nodeB = nodeB;
    this.materialId = materialId;
    this.material = MATERIALS[materialId];
    const dx = nodeB.pos.x - nodeA.pos.x;
    const dy = nodeB.pos.y - nodeA.pos.y;
    this.restLength = Math.max(1, Math.hypot(dx, dy));
    this.isRoad = this.computeIsRoad();
  }

  lengthM(ppm: number): number {
    return this.restLength / ppm;
  }

  computeIsRoad(): boolean {
    if (!this.material.canBeRoad) return false;
    const dx = this.nodeB.pos.x - this.nodeA.pos.x;
    const dy = this.nodeB.pos.y - this.nodeA.pos.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return false;
    return Math.abs(dy) / len < 0.42;
  }

  reset(): void {
    this.isBroken = false;
    this.stress = 0;
    this.effStress = 0;
    this.displayStress = 0;
    this.isTension = true;
    this.slack = false;
    this.overloadTicks = 0;
    this.peak = 0;
    this.peakT = 0;
  }

  solveConstraint(): void {
    if (this.isBroken) return;
    const pA = this.nodeA.pos;
    const pB = this.nodeB.pos;
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.0001) return;

    const delta = dist - this.restLength;
    const strain = delta / this.restLength;
    this.isTension = delta >= 0;
    this.slack = false;

    if (this.material.tensionOnly && delta < 0) {
      this.stress = 0;
      this.slack = true;
      return;
    }

    const base = this.isTension ? this.material.breakTension : this.material.breakCompression * this.compScale;
    const limit = this.isRoad ? base * TUNING.deckBonus : base;
    this.stress = limit <= 0 ? 99 : Math.abs(strain) / limit;

    const wA = this.nodeA.isAnchor ? 0 : 1;
    const wB = this.nodeB.isAnchor ? 0 : 1;
    const wTotal = wA + wB;
    if (wTotal === 0) return;

    const diff = (delta / dist) * this.material.stiffness;
    const ox = dx * diff;
    const oy = dy * diff;
    if (wA) {
      pA.x += ox * (wA / wTotal);
      pA.y += oy * (wA / wTotal);
    }
    if (wB) {
      pB.x -= ox * (wB / wTotal);
      pB.y -= oy * (wB / wTotal);
    }
  }
}

export function resetBeamIds(): void {
  nextBeamId = 1;
}

export function stressTint(stress: number, broken: boolean, slack: boolean): string {
  if (broken) return "#5A3030";
  if (slack) return "#7A8894";
  if (stress < 0.45) return "#3DDC97";
  if (stress < 0.75) {
    const t = (stress - 0.45) / 0.3;
    return lerpHex("#3DDC97", "#E6B84A", t);
  }
  const t = Math.min(1, (stress - 0.75) / 0.25);
  return lerpHex("#E6B84A", "#D1495B", t);
}

export function lerpHex(a: string, b: string, t: number): string {
  const pa = hexRgb(a);
  const pb = hexRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
