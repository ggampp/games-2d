import { Beam } from "./beam.ts";
import { MATERIALS, type Material, type MaterialId } from "./materials.ts";
import type { SimNode } from "./node.ts";

let nextMemberId = 1;

/**
 * Peça desenhada pelo jogador: cadeia de nós entre dois pontos.
 * Segmentos são visíveis e transitáveis; contraventos (skip 2 e 3) são ocultos
 * e representam a rigidez à flexão da peça. Quando um segmento rompe, os
 * contraventos que o cobrem rompem junto, e a peça se separa de verdade.
 */
export class Member {
  readonly id: number;
  materialId: MaterialId;
  material: Material;
  chain: SimNode[];
  segments: Beam[] = [];
  braces: Beam[] = [];
  private cover: Beam[][] = [];
  locked: boolean;
  lengthM: number;

  constructor(chain: SimNode[], materialId: MaterialId, ppm: number, locked = false, lengthM?: number) {
    this.id = nextMemberId++;
    this.materialId = materialId;
    this.material = MATERIALS[materialId];
    this.chain = chain;
    this.locked = locked;
    const a = chain[0].pos;
    const b = chain[chain.length - 1].pos;
    this.lengthM = lengthM ?? Math.hypot(b.x - a.x, b.y - a.y) / ppm;
    const slender = this.material.slenderM / Math.max(0.01, this.lengthM);
    // Peças pré-existentes (patrimônio) são contínuas e rígidas: sem flambagem.
    const compScale = locked ? 1 : Math.max(0.1, Math.min(1, slender * slender));

    for (let i = 0; i < chain.length - 1; i++) {
      const seg = new Beam(chain[i], chain[i + 1], materialId);
      seg.compScale = compScale;
      this.segments.push(seg);
      this.cover.push([]);
    }
    if (this.material.bendStiff) {
      for (const skip of [2, 3]) {
        for (let i = 0; i + skip < chain.length; i++) {
          const brace = new Beam(chain[i], chain[i + skip], materialId);
          brace.hidden = true;
          brace.isRoad = false;
          brace.compScale = compScale;
          this.braces.push(brace);
          for (let s = i; s < i + skip; s++) this.cover[s].push(brace);
        }
      }
    }
  }

  get a(): SimNode {
    return this.chain[0];
  }

  get b(): SimNode {
    return this.chain[this.chain.length - 1];
  }

  get beams(): Beam[] {
    return [...this.segments, ...this.braces];
  }

  get isBroken(): boolean {
    return this.segments.some((s) => s.isBroken);
  }

  cost(): number {
    if (this.material.unitCost) return this.material.unitCost;
    return this.lengthM * this.material.costPerMeter;
  }

  reset(): void {
    for (const b of this.beams) b.reset();
  }

  /** Combina esforço axial com o dos contraventos e rompe segmentos sobrecarregados. */
  resolveBreaks(time = 0): Beam[] {
    const broken: Beam[] = [];
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (seg.isBroken) continue;
      let eff = seg.stress;
      for (const br of this.cover[i]) {
        if (!br.isBroken && br.stress > eff) eff = br.stress;
      }
      seg.effStress = eff;
      if (eff > seg.peak) {
        seg.peak = eff;
        seg.peakT = time;
      }
      if (eff > 1) {
        seg.overloadTicks++;
        if (seg.overloadTicks >= 3) {
          seg.isBroken = true;
          for (const br of this.cover[i]) br.isBroken = true;
          broken.push(seg);
        }
      } else if (seg.overloadTicks > 0) {
        seg.overloadTicks--;
      }
    }
    return broken;
  }

  maxEffStress(): number {
    let m = 0;
    for (const s of this.segments) if (!s.isBroken && s.effStress > m) m = s.effStress;
    return m;
  }
}

export function resetMemberIds(): void {
  nextMemberId = 1;
}
