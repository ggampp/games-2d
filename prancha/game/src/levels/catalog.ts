import type { BiomeId } from "../sim/layout.ts";
import { BED, type LevelMods } from "../sim/loadcase.ts";
import type { MaterialId } from "../sim/materials.ts";

export interface LevelDef {
  id: number;
  biome: BiomeId;
  name: string;
  spanM: number;
  /** Texto da carga no memorial. */
  load: string;
  vehicle: string;
  loadT: number;
  restriction: string;
  budget: number;
  teaches: string;
  tutorial: boolean;
  catalog: MaterialId[];
  mods: LevelMods;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  subtitle: string;
  /** Chapa fotográfica gerada; se não carregar, o fundo procedural assume. */
  plate: string;
  water: string;
  sky: string;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  plains: {
    id: "plains",
    plate: "/assets/env/plains/plate.png",
    name: "Planície",
    subtitle: "Córregos e rios de várzea",
    water: "rgba(30, 70, 100, 0.6)",
    sky: "#0B1F3A",
  },
  canyon: {
    id: "canyon",
    plate: "/assets/env/canyon/plate.png",
    name: "Canyon",
    subtitle: "Vãos altos, encontros de rocha",
    water: "rgba(20, 60, 90, 0.65)",
    sky: "#101A2E",
  },
  estuary: {
    id: "estuary",
    plate: "/assets/env/estuary/plate.png",
    name: "Estuário",
    subtitle: "Maré, gabarito náutico e vento do mar",
    water: "rgba(20, 90, 110, 0.7)",
    sky: "#0A2A3A",
  },
  serra: {
    id: "serra",
    plate: "/assets/env/serra/plate.png",
    name: "Serra",
    subtitle: "Vento forte e rajadas",
    water: "rgba(40, 70, 90, 0.6)",
    sky: "#1A2236",
  },
  mangrove: {
    id: "mangrove",
    plate: "/assets/env/mangrove/plate.png",
    name: "Mangue",
    subtitle: "Solo mole, fundação cara",
    water: "rgba(50, 70, 40, 0.7)",
    sky: "#16261A",
  },
  urban: {
    id: "urban",
    plate: "/assets/env/urban/plate.png",
    name: "Urbano",
    subtitle: "Flecha rigorosa, etapas e patrimônio",
    water: "rgba(30, 40, 60, 0.7)",
    sky: "#151526",
  },
};

export const BIOME_ORDER: BiomeId[] = ["plains", "canyon", "estuary", "serra", "mangrove", "urban"];

/**
 * Os tetos da planilha (01-gdd/economia-e-niveis.xlsx) valem ~2,1x o custo do
 * tabuleiro em madeira; com a física calibrada uma treliça correta custa ~3x.
 * O fator abaixo mantém a proporção entre obras e torna 2 estrelas alcançáveis.
 */
export const BUDGET_SCALE = 1.6;

const BASIC: MaterialId[] = ["wood", "steel", "cable", "concrete"];
const FULL: MaterialId[] = ["wood", "steel", "cable", "concrete", "bearing"];

/** Arco contínuo (bowstring) acima do tabuleiro. */
function arch(spanM: number, riseM: number, panels: number, material: MaterialId): NonNullable<LevelMods["prebuilt"]> {
  const y = (x: number) => -riseM * 4 * (x / spanM) * (1 - x / spanM);
  const points: [number, number][] = [];
  for (let i = 0; i <= panels; i++) {
    const x = (spanM * i) / panels;
    points.push([x, Math.round(y(x) * 100) / 100]);
  }
  return [{ material, points }];
}

/** Torre em pórtico: duas pernas do leito ao topo, travessa no nível do tabuleiro. */
function tower(x: number, topM: number): NonNullable<LevelMods["prebuilt"]> {
  return [
    { material: "steel", points: [[x - 2, BED], [x - 2, 0], [x, topM]] },
    { material: "steel", points: [[x + 2, BED], [x + 2, 0], [x, topM]] },
    { material: "steel", points: [[x - 2, 0], [x + 2, 0]] },
  ];
}

export const LEVELS: LevelDef[] = [
  // ---- Planície ----
  {
    id: 1,
    biome: "plains",
    name: "Córrego do Aprendiz",
    spanM: 14,
    load: "Van 3 t",
    vehicle: "van",
    loadT: 3,
    restriction: "Nenhuma, só atravessar",
    budget: 14764.68,
    teaches: "Nós, barras, testar",
    tutorial: true,
    catalog: ["wood"],
    mods: {},
  },
  {
    id: 2,
    biome: "plains",
    name: "Ponte do Sítio",
    spanM: 18,
    load: "Caminhão 14 t",
    vehicle: "truck",
    loadT: 14,
    restriction: "Orçamento apertado",
    budget: 18983.16,
    teaches: "Não overbuildar: treliça simples",
    tutorial: true,
    catalog: ["wood", "steel"],
    mods: {},
  },
  {
    id: 3,
    biome: "plains",
    name: "Rio do Meio",
    spanM: 24,
    load: "Ônibus 16 t",
    vehicle: "bus",
    loadT: 16,
    restriction: "Cabo disponível",
    budget: 25310.88,
    teaches: "Tração não é compressão",
    tutorial: true,
    catalog: ["wood", "steel", "cable"],
    mods: {},
  },
  {
    id: 4,
    biome: "plains",
    name: "Passagem da Colheita",
    spanM: 28,
    load: "Bitrem 32 t",
    vehicle: "bitrem",
    loadT: 32,
    restriction: "Carga pesada e lenta",
    budget: 29529.36,
    teaches: "Carga móvel: cada painel sofre",
    tutorial: false,
    catalog: BASIC,
    mods: {},
  },
  // ---- Canyon ----
  {
    id: 5,
    biome: "canyon",
    name: "Fenda Seca",
    spanM: 32,
    load: "Caminhão 12 t",
    vehicle: "truck",
    loadT: 12,
    restriction: "Encontros altos: pilar esbelto flamba",
    budget: 40176,
    teaches: "Flambagem",
    tutorial: false,
    catalog: BASIC,
    mods: { piers: {} },
  },
  {
    id: 6,
    biome: "canyon",
    name: "Vão do Gavião",
    spanM: 38,
    load: "Dois carros",
    vehicle: "van",
    loadT: 3,
    restriction: "Só 30 m de aço no canteiro",
    budget: 47709,
    teaches: "Treliça eficiente",
    tutorial: false,
    catalog: BASIC,
    mods: {
      quotaM: { steel: 30 },
      vehicles: [
        { id: "van", loadT: 3, dir: 1, delay: 0 },
        { id: "van", loadT: 3, dir: 1, delay: 1.4 },
      ],
    },
  },
  {
    id: 7,
    biome: "canyon",
    name: "Corte da Pedra",
    spanM: 42,
    load: "Caminhão 12 t",
    vehicle: "truck",
    loadT: 12,
    restriction: "Proibido pilar no leito",
    budget: 52731,
    teaches: "Vão livre obrigatório",
    tutorial: false,
    catalog: BASIC,
    mods: { piers: "forbidden" },
  },
  {
    id: 8,
    biome: "canyon",
    name: "Abismo Norte",
    spanM: 48,
    load: "Bitrem 20 t",
    vehicle: "bitrem",
    loadT: 20,
    restriction: "Orçamento + vão livre",
    budget: 60264,
    teaches: "Duas restrições",
    tutorial: false,
    catalog: FULL,
    mods: { piers: "forbidden" },
  },
  // ---- Estuário ----
  {
    id: 9,
    biome: "estuary",
    name: "Maré Baixa",
    spanM: 26,
    load: "Van + vento leve",
    vehicle: "van",
    loadT: 3,
    restriction: "A maré sobe 2,5 m durante o ensaio",
    budget: 35907.3,
    teaches: "Empuxo e correnteza",
    tutorial: false,
    catalog: FULL,
    mods: { tideRiseM: 2.5, windKmh: 20, piers: {} },
  },
  {
    id: 10,
    biome: "estuary",
    name: "Canal do Porto",
    spanM: 34,
    load: "Caminhão 14 t",
    vehicle: "truck",
    loadT: 14,
    restriction: "Gabarito náutico 8 m no canal",
    budget: 46955.7,
    teaches: "Altura livre",
    tutorial: false,
    catalog: FULL,
    mods: { clearance: { heightM: 8, fromFrac: 0.3, toFrac: 0.7 }, piers: {} },
  },
  {
    id: 11,
    biome: "estuary",
    name: "Foz do Itajaí",
    spanM: 40,
    load: "Bitrem 40 t",
    vehicle: "bitrem",
    loadT: 40,
    restriction: "Gabarito 10 m + maré",
    budget: 55242,
    teaches: "Combo ambiental",
    tutorial: false,
    catalog: FULL,
    mods: { clearance: { heightM: 10, fromFrac: 0.3, toFrac: 0.7 }, tideRiseM: 2, piers: {} },
  },
  {
    id: 12,
    biome: "estuary",
    name: "Porto Noturno",
    spanM: 44,
    load: "Duas cargas opostas",
    vehicle: "truck",
    loadT: 14,
    restriction: "Tráfego simultâneo nos dois sentidos",
    budget: 60766.2,
    teaches: "Momentos invertidos",
    tutorial: false,
    catalog: FULL,
    mods: {
      piers: {},
      vehicles: [
        { id: "truck", loadT: 14, dir: 1, delay: 0 },
        { id: "truck", loadT: 14, dir: -1, delay: 0.4 },
      ],
    },
  },
  // ---- Serra ----
  {
    id: 13,
    biome: "serra",
    name: "Camada de Vento",
    spanM: 30,
    load: "Ônibus 14 t",
    vehicle: "bus",
    loadT: 14,
    restriction: "Vento 70 km/h",
    budget: 43691.4,
    teaches: "Contraventamento",
    tutorial: false,
    catalog: FULL,
    mods: { windKmh: 70, piers: {} },
  },
  {
    id: 14,
    biome: "serra",
    name: "Serra do Rio do Rastro",
    spanM: 36,
    load: "Caminhão 16 t",
    vehicle: "truck",
    loadT: 16,
    restriction: "Vento 90 km/h",
    budget: 52429.68,
    teaches: "Cabos + rigidez lateral",
    tutorial: false,
    catalog: FULL,
    mods: { windKmh: 90, piers: {} },
  },
  {
    id: 15,
    biome: "serra",
    name: "Pico do Corcovado SC",
    spanM: 40,
    load: "Van + rajadas",
    vehicle: "van",
    loadT: 3,
    restriction: "Rajadas de vento no ensaio",
    budget: 58255.2,
    teaches: "Carga variável no tempo",
    tutorial: false,
    catalog: FULL,
    mods: { windKmh: 60, gusts: true, piers: {} },
  },
  {
    id: 16,
    biome: "serra",
    name: "Passagem Austral",
    spanM: 46,
    load: "Bitrem 36 t",
    vehicle: "bitrem",
    loadT: 36,
    restriction: "Vento 80 km/h + orçamento",
    budget: 66993.48,
    teaches: "Chefe do bioma",
    tutorial: false,
    catalog: FULL,
    mods: { windKmh: 80, piers: "forbidden" },
  },
  // ---- Mangue ----
  {
    id: 17,
    biome: "mangrove",
    name: "Solo Mole I",
    spanM: 22,
    load: "Caminhão 10 t",
    vehicle: "truck",
    loadT: 10,
    restriction: "Fundação a R$ 24.000 cada",
    budget: 34250.04,
    teaches: "Poucos pilares",
    tutorial: false,
    catalog: FULL,
    mods: { piers: { cost: 24000 } },
  },
  {
    id: 18,
    biome: "mangrove",
    name: "Estrada da Vila",
    spanM: 28,
    load: "Ônibus 12 t",
    vehicle: "bus",
    loadT: 12,
    restriction: "Recalque diferencial de 0,6 m no encontro direito",
    budget: 43590.96,
    teaches: "Apoios flexíveis",
    tutorial: false,
    catalog: FULL,
    mods: { settlementM: 0.6, piers: { cost: 24000 } },
  },
  {
    id: 19,
    biome: "mangrove",
    name: "Canal do Siri",
    spanM: 34,
    load: "Bitrem 28 t",
    vehicle: "bitrem",
    loadT: 28,
    restriction: "Sem apoio baixo nem pilar na margem direita",
    budget: 52931.88,
    teaches: "Vão assimétrico",
    tutorial: false,
    catalog: FULL,
    mods: { noRightLowAnchor: true, piers: { cost: 24000, fromFrac: 0, toFrac: 0.5 } },
  },
  {
    id: 20,
    biome: "mangrove",
    name: "Baía Enterrada",
    spanM: 40,
    load: "Caminhão 18 t",
    vehicle: "truck",
    loadT: 18,
    restriction: "Solo mole + maré 2 m",
    budget: 62272.8,
    teaches: "Combo solo e água",
    tutorial: false,
    catalog: FULL,
    mods: { piers: { cost: 24000 }, tideRiseM: 2, settlementM: 0.4 },
  },
  // ---- Urbano ----
  {
    id: 21,
    biome: "urban",
    name: "Linha do Metrô",
    spanM: 24,
    load: "Metrô 40 t eq.",
    vehicle: "bus",
    loadT: 40,
    restriction: "Gabarito ferroviário 6 m + flecha L/100",
    budget: 42184.8,
    teaches: "Flecha rigorosa",
    tutorial: false,
    catalog: FULL,
    mods: { clearance: { heightM: 6, fromFrac: 0.25, toFrac: 0.75 }, deflectionDiv: 100, piers: "forbidden" },
  },
  {
    id: 22,
    biome: "urban",
    name: "Obra em Etapas",
    spanM: 30,
    load: "Caminhão 16 t",
    vehicle: "truck",
    loadT: 16,
    restriction: "Escoramento: peso construtivo 1,8x por 3 s",
    budget: 52731,
    teaches: "Peso construtivo",
    tutorial: false,
    catalog: FULL,
    mods: { deadLoadMul: 1.8, deadLoadPhaseS: 3, piers: {} },
  },
  {
    id: 23,
    biome: "urban",
    name: "Patrimônio Centro",
    spanM: 36,
    load: "Ônibus 14 t",
    vehicle: "bus",
    loadT: 14,
    restriction: "Arco histórico existente (não demolir)",
    budget: 63277.2,
    teaches: "Reforço: pendurar o tabuleiro",
    tutorial: false,
    catalog: FULL,
    mods: { prebuilt: arch(36, 7, 6, "steel"), piers: "forbidden" },
  },
  {
    id: 24,
    biome: "urban",
    name: "Hercílio Luz",
    spanM: 52,
    load: "Trem turístico 28 t",
    vehicle: "bitrem",
    loadT: 28,
    restriction: "Vento 90 + gabarito 18 m + torres tombadas",
    budget: 91400.4,
    teaches: "Chefe final: pênsil",
    tutorial: false,
    catalog: FULL,
    mods: {
      windKmh: 90,
      clearance: { heightM: 18, fromFrac: 0.3, toFrac: 0.7 },
      prebuilt: [...tower(10, -14), ...tower(42, -14)],
      piers: { cost: 28000 },
    },
  },
];

for (const l of LEVELS) l.budget = Math.round(l.budget * BUDGET_SCALE);

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function levelsOf(biome: BiomeId): LevelDef[] {
  return LEVELS.filter((l) => l.biome === biome);
}

export interface SandboxOptions {
  biome: BiomeId;
  spanM: number;
  vehicle: string;
  loadT: number;
  windKmh: number;
  tideRiseM: number;
  piers: boolean;
}

export function makeSandboxLevel(o: SandboxOptions): LevelDef {
  return {
    id: 0,
    biome: o.biome,
    name: "Sandbox",
    spanM: o.spanM,
    load: `${o.vehicle} ${o.loadT} t`,
    vehicle: o.vehicle,
    loadT: o.loadT,
    restriction: "Orçamento livre",
    budget: Infinity,
    teaches: "Experimente à vontade",
    tutorial: false,
    catalog: FULL,
    mods: {
      windKmh: o.windKmh || undefined,
      gusts: o.windKmh > 0,
      tideRiseM: o.tideRiseM || undefined,
      piers: o.piers ? {} : "forbidden",
    },
  };
}
