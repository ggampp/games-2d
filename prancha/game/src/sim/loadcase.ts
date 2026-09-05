import type { Layout } from "./layout.ts";
import type { MaterialId } from "./materials.ts";

export interface VehicleRun {
  id: string;
  loadT: number;
  /** 1 = esquerda para direita, -1 = direita para esquerda. */
  dir: 1 | -1;
  delay: number;
}

/** Valor especial de y (metros) que significa "apoiado no leito". */
export const BED = 999;

export interface PrebuiltMember {
  material: MaterialId;
  /** Polilinha contínua em metros a partir do encontro esquerdo; y positivo para baixo (BED = leito). */
  points: [number, number][];
}

export interface LevelMods {
  windKmh?: number;
  gusts?: boolean;
  tideRiseM?: number;
  /** Recalque do encontro direito durante o ensaio (m). */
  settlementM?: number;
  /** Fase de escoramento: gravidade vezes mul durante N segundos antes do tráfego. */
  deadLoadMul?: number;
  deadLoadPhaseS?: number;
  /** Gabarito: nada pode ser construído abaixo de heightM acima da água, no trecho do canal. */
  clearance?: { heightM: number; fromFrac: number; toFrac: number };
  /** Pilares no leito: proibidos, ou permitidos num trecho com custo próprio. */
  piers?: "forbidden" | { cost?: number; fromFrac?: number; toFrac?: number };
  /** Cota de material disponível no canteiro (m). */
  quotaM?: Partial<Record<MaterialId, number>>;
  deflectionDiv?: number;
  prebuilt?: PrebuiltMember[];
  vehicles?: VehicleRun[];
  noRightLowAnchor?: boolean;
}

function smooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Cargas ambientais ao longo do tempo de ensaio. */
export class LoadCase {
  time = 0;
  windNow = 0;
  private turbulence = 0;

  readonly mods: LevelMods;
  readonly layout: Layout;

  constructor(mods: LevelMods, layout: Layout) {
    this.mods = mods;
    this.layout = layout;
  }

  reset(): void {
    this.time = 0;
    this.windNow = 0;
    this.turbulence = 0;
  }

  update(dt: number): void {
    this.time += dt;
    const kmh = this.mods.windKmh ?? 0;
    if (kmh > 0) {
      const base = kmh * kmh * 0.035;
      let gust = 1;
      if (this.mods.gusts) {
        const t = this.time;
        gust = 1 + 1.1 * Math.max(0, Math.sin(t * 0.9) * Math.sin(t * 2.3 + 1));
      }
      this.turbulence += ((Math.random() - 0.5) * 0.6 - this.turbulence) * Math.min(1, dt * 6);
      const ramp = smooth(this.time / 1.5);
      this.windNow = base * gust * (1 + this.turbulence) * ramp;
    } else {
      this.windNow = 0;
    }
  }

  get waterY(): number {
    const rise = this.mods.tideRiseM ?? 0;
    if (rise <= 0) return this.layout.waterY;
    return this.layout.waterY - rise * this.layout.ppm * smooth(this.time / 6);
  }

  get deadLoadPhase(): number {
    return this.mods.deadLoadMul ? (this.mods.deadLoadPhaseS ?? 3) : 0;
  }

  get gravityMul(): number {
    if (!this.mods.deadLoadMul) return 1;
    return this.time < this.deadLoadPhase ? this.mods.deadLoadMul : 1;
  }

  get trafficReleased(): boolean {
    return this.time >= this.deadLoadPhase;
  }

  /** Recalque do encontro direito em px. */
  get settlementPx(): number {
    const m = this.mods.settlementM ?? 0;
    if (m <= 0) return 0;
    return m * this.layout.ppm * smooth(this.time / 5);
  }

  phaseLabel(): string | null {
    if (this.mods.deadLoadMul && !this.trafficReleased) {
      return `ESCORAMENTO: peso construtivo por ${(this.deadLoadPhase - this.time).toFixed(1)} s`;
    }
    if (this.mods.tideRiseM && this.time < 6) return "MARÉ SUBINDO";
    if (this.mods.settlementM && this.time < 5) return "RECALQUE DO ENCONTRO DIREITO";
    return null;
  }
}
