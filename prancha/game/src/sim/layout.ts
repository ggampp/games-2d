export type BiomeId = "plains" | "canyon" | "estuary" | "serra" | "mangrove" | "urban";

export interface Layout {
  biome: BiomeId;
  ppm: number;
  spanM: number;
  leftX: number;
  rightX: number;
  deckY: number;
  waterY: number;
  /** Leito do rio: linha onde fundações podem ser apoiadas. */
  bedY: number;
  /** Limite superior da envoltória de construção. */
  topY: number;
  width: number;
  height: number;
  snapPx: number;
  snapM: number;
}

export const VIEW_W = 1600;
export const VIEW_H = 900;

interface Profile {
  deckY: number;
  waterY: number;
  bedY: number;
}

export const BIOME_PROFILE: Record<BiomeId, Profile> = {
  plains: { deckY: 410, waterY: 720, bedY: 770 },
  canyon: { deckY: 330, waterY: 790, bedY: 835 },
  estuary: { deckY: 330, waterY: 740, bedY: 810 },
  serra: { deckY: 320, waterY: 800, bedY: 840 },
  mangrove: { deckY: 420, waterY: 700, bedY: 790 },
  urban: { deckY: 330, waterY: 770, bedY: 820 },
};

export function makeLayout(spanM: number, biome: BiomeId): Layout {
  const margin = 230;
  const ppm = Math.max(20, Math.min(48, (VIEW_W - margin * 2) / spanM));
  const spanPx = spanM * ppm;
  const leftX = Math.round((VIEW_W - spanPx) / 2);
  const rightX = Math.round(leftX + spanPx);
  const p = BIOME_PROFILE[biome];
  const snapM = ppm >= 34 ? 0.5 : 1;
  return {
    biome,
    ppm,
    spanM,
    leftX,
    rightX,
    deckY: p.deckY,
    waterY: p.waterY,
    bedY: p.bedY,
    topY: p.deckY - 300,
    width: VIEW_W,
    height: VIEW_H,
    snapPx: ppm * snapM,
    snapM,
  };
}
