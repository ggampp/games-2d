export type MaterialId = "wood" | "steel" | "concrete" | "cable" | "bearing";

export interface Material {
  id: MaterialId;
  name: string;
  short: string;
  color: string;
  highlight: string;
  /** Largura visual em px quando ppm = 48. */
  width: number;
  maxLengthM: number;
  /** Fração da correção aplicada por substep (0–1). */
  stiffness: number;
  /** Deformação relativa de ruptura (calibrada para o solver Verlet). */
  breakTension: number;
  breakCompression: number;
  /** Comprimento (m) a partir do qual a peça comprimida perde capacidade (flambagem). */
  slenderM: number;
  costPerMeter: number;
  /** Custo por unidade (apoio elastomérico). */
  unitCost?: number;
  /** Massa por metro (unidade de jogo). */
  weight: number;
  tensionOnly: boolean;
  canBeRoad: boolean;
  /** Recebe contraventamento interno (rigidez à flexão). */
  bendStiff: boolean;
  icon: string;
  sprite: string;
}

/**
 * Deformação residual típica do solver para a carga de projeto.
 * Ajustada com `scripts/calibrate.ts` (g=200, 400/t, tabuleiro x2):
 * tabuleiro reto de madeira passa a van da obra 01 (~0,27) e rompe com o
 * caminhão da obra 02; treliças Warren em madeira ficam entre 0,3 e 0,7.
 */
export const BASE_STRAIN = 0.00224;

export const MATERIALS: Record<MaterialId, Material> = {
  wood: {
    id: "wood",
    name: "Madeira",
    short: "MAD",
    color: "#B08968",
    highlight: "#D4A574",
    width: 8,
    maxLengthM: 14,
    stiffness: 0.8,
    breakTension: BASE_STRAIN * 0.55,
    breakCompression: BASE_STRAIN * 0.7,
    slenderM: 6,
    costPerMeter: 420,
    weight: 0.4,
    tensionOnly: false,
    canBeRoad: true,
    bendStiff: true,
    icon: "/assets/sprites/ui/icon_wood.png",
    sprite: "/assets/sprites/materials/mat_wood_beam.png",
  },
  steel: {
    id: "steel",
    name: "Aço estrutural",
    short: "AÇO",
    color: "#8A9AA8",
    highlight: "#C5D0D8",
    width: 9,
    maxLengthM: 20,
    stiffness: 0.94,
    breakTension: BASE_STRAIN * 1.6,
    breakCompression: BASE_STRAIN * 1.6,
    slenderM: 10,
    costPerMeter: 1860,
    weight: 1,
    tensionOnly: false,
    canBeRoad: true,
    bendStiff: true,
    icon: "/assets/sprites/ui/icon_steel.png",
    sprite: "/assets/sprites/materials/mat_steel_ibeam.png",
  },
  concrete: {
    id: "concrete",
    name: "Concreto",
    short: "CONC",
    color: "#C4BBB2",
    highlight: "#E2DBD4",
    width: 12,
    maxLengthM: 14,
    stiffness: 0.97,
    breakTension: BASE_STRAIN * 0.25,
    breakCompression: BASE_STRAIN * 1.5,
    slenderM: 8,
    costPerMeter: 980,
    weight: 1.45,
    tensionOnly: false,
    canBeRoad: true,
    bendStiff: true,
    icon: "/assets/sprites/ui/icon_concrete.png",
    sprite: "/assets/sprites/materials/mat_concrete_beam.png",
  },
  cable: {
    id: "cable",
    name: "Cabo de aço",
    short: "CABO",
    color: "#D9E2EC",
    highlight: "#FFFFFF",
    width: 3,
    maxLengthM: 40,
    stiffness: 0.9,
    breakTension: BASE_STRAIN * 2.2,
    breakCompression: 0,
    slenderM: 999,
    costPerMeter: 1240,
    weight: 0.22,
    tensionOnly: true,
    canBeRoad: false,
    bendStiff: false,
    icon: "/assets/sprites/ui/icon_cable.png",
    sprite: "/assets/sprites/materials/mat_cable.png",
  },
  bearing: {
    id: "bearing",
    name: "Apoio elastomérico",
    short: "APOIO",
    color: "#4A4A4A",
    highlight: "#777777",
    width: 12,
    maxLengthM: 2.5,
    stiffness: 0.5,
    breakTension: BASE_STRAIN * 2.4,
    breakCompression: BASE_STRAIN * 2.4,
    slenderM: 999,
    costPerMeter: 0,
    unitCost: 8500,
    weight: 0.15,
    tensionOnly: false,
    canBeRoad: false,
    bendStiff: false,
    icon: "/assets/sprites/ui/icon_bearing.png",
    sprite: "/assets/sprites/materials/mat_bearing.png",
  },
};

export const MATERIAL_ORDER: MaterialId[] = ["wood", "steel", "concrete", "cable", "bearing"];

export const SAFETY = {
  fsPass: 1.15,
  fsThreeStar: 1.8,
  /** Flecha admissível = vão / deflectionDiv (NBR usa 800; o slice usa 50). */
  deflectionDiv: 50,
  laborFraction: 0.18,
  /** Custo padrão de uma fundação (pilar apoiado no leito). */
  foundationCost: 9800,
};

/** Parâmetros globais ajustáveis (o harness de calibração os sobrescreve). */
export const TUNING = {
  /** Carga por roda (unidade de força do jogo) por tonelada do veículo. */
  loadPerTon: 400,
  gravity: 200,
  /** Substeps por frame e iterações de restrição por substep. */
  substeps: 10,
  iterations: 3,
  /** Comprimento alvo de cada segmento de uma peça (m). */
  segmentM: 2,
  /** Ganho de capacidade dos segmentos de tabuleiro (a laje distribui a roda). */
  deckBonus: 2.0,
};
