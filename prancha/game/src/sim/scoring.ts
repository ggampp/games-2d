import type { LevelDef } from "../levels/catalog.ts";
import type { BridgeSystem } from "./bridge.ts";
import { MATERIALS, SAFETY } from "./materials.ts";
import type { Vehicle } from "./vehicle.ts";

export type Outcome = "crossed" | "fell" | "stuck";

export interface Verdict {
  stars: number;
  pass: boolean;
  outcome: Outcome;
  fs: number;
  flechaM: number;
  limitM: number;
  cost: number;
  budget: number;
  mode: string;
  details: string[];
}

export function limitFor(level: LevelDef): number {
  return level.spanM / (level.mods.deflectionDiv ?? SAFETY.deflectionDiv);
}

export function evaluate(bridge: BridgeSystem, level: LevelDef, vehicles: Vehicle[], outcome: Outcome): Verdict {
  const fs = bridge.factorOfSafety();
  const flechaM = bridge.deflectionM();
  const limitM = limitFor(level);
  const cost = bridge.totalCost();
  const budget = level.budget;

  const crossed = outcome === "crossed" && vehicles.every((v) => v.hasFinished);
  const pass = crossed && fs >= SAFETY.fsPass && flechaM <= limitM;

  let stars = 0;
  if (pass) {
    stars = 1;
    if (cost <= budget) stars = 2;
    if (cost <= budget && (fs >= SAFETY.fsThreeStar || cost <= budget * 0.8)) stars = 3;
  }

  let mode = "APROVADO";
  if (outcome === "fell") mode = "QUEDA DO VEÍCULO";
  else if (outcome === "stuck") mode = "VEÍCULO PRESO NO VÃO";
  else if (!crossed) mode = "TRAVESSIA INCOMPLETA";
  else if (fs < SAFETY.fsPass) mode = "FATOR DE SEGURANÇA INSUFICIENTE";
  else if (flechaM > limitM) mode = "FLECHA EXCESSIVA";

  const details: string[] = [];
  const worst = bridge.worstSegment();
  if (worst) {
    const kind = worst.isTension ? "Tração" : "Compressão";
    const pct = Math.min(999, worst.effStress * 100);
    const buck = !worst.isTension && worst.compScale < 0.999 ? " (flambagem)" : "";
    details.push(`${kind} em ${MATERIALS[worst.materialId].name}: ${pct.toFixed(0)}% da capacidade${buck}`);
  }
  if (bridge.brokenCount > 0) details.push(`${bridge.brokenCount} segmento(s) romperam`);
  details.push(`Flecha máxima ${(flechaM * 1000).toFixed(0)} mm (limite ${(limitM * 1000).toFixed(0)} mm)`);
  details.push(`Fator de segurança ${fs.toFixed(2)} (mínimo ${SAFETY.fsPass.toFixed(2)})`);
  if (Number.isFinite(budget)) {
    const delta = cost - budget;
    details.push(
      delta > 0
        ? `Custo ${brl(cost)}: ${brl(delta)} acima do teto`
        : `Custo ${brl(cost)}: ${((cost / budget) * 100).toFixed(0)}% do teto`,
    );
  }

  return { stars, pass, outcome, fs, flechaM, limitM, cost, budget, mode, details };
}

export function brl(n: number): string {
  if (!Number.isFinite(n)) return "LIVRE";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
