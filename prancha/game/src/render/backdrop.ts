import type { BiomeId, Layout } from "../sim/layout.ts";

/**
 * Fundo procedural por bioma, desenhado uma vez por layout e cacheado.
 * Camadas: céu → sol/névoa → cordilheiras → vegetação ou skyline → margens
 * com estratos → leito. Tudo em silhuetas com a paleta da prancheta, para
 * caber em qualquer vão sem cortar.
 */

interface Palette {
  skyTop: string;
  skyMid: string;
  horizon: string;
  sun: string;
  far: string;
  far2: string;
  mid: string;
  ground: string;
  groundDark: string;
  strata: string;
  bed: string;
}

const PALETTES: Record<BiomeId, Palette> = {
  plains: {
    skyTop: "#0f2a4a",
    skyMid: "#3a5f86",
    horizon: "#e2a066",
    sun: "rgba(255, 190, 120, 0.55)",
    far: "#33506e",
    far2: "#274361",
    mid: "#1d3a3a",
    ground: "#5a4632",
    groundDark: "#3c2f22",
    strata: "rgba(126, 200, 227, 0.16)",
    bed: "#2a2119",
  },
  canyon: {
    skyTop: "#0b1a33",
    skyMid: "#2d4a73",
    horizon: "#d9855a",
    sun: "rgba(255, 160, 100, 0.5)",
    far: "#3b3f5c",
    far2: "#2c3350",
    mid: "#1a2a30",
    ground: "#6a4a3a",
    groundDark: "#3f2c24",
    strata: "rgba(230, 184, 74, 0.18)",
    bed: "#251c17",
  },
  estuary: {
    skyTop: "#0a2436",
    skyMid: "#2a6a86",
    horizon: "#f0c27b",
    sun: "rgba(255, 220, 150, 0.6)",
    far: "#2a5a70",
    far2: "#1f4a5e",
    mid: "#173a3a",
    ground: "#6b6046",
    groundDark: "#44402e",
    strata: "rgba(126, 200, 227, 0.2)",
    bed: "#2b2a22",
  },
  serra: {
    skyTop: "#151a30",
    skyMid: "#3b4a6e",
    horizon: "#c9a5a0",
    sun: "rgba(220, 200, 210, 0.35)",
    far: "#4a5478",
    far2: "#384162",
    mid: "#1c2a2a",
    ground: "#4a4a44",
    groundDark: "#2f302c",
    strata: "rgba(232, 238, 242, 0.14)",
    bed: "#23241f",
  },
  mangrove: {
    skyTop: "#122a22",
    skyMid: "#3a6a4a",
    horizon: "#d9c27a",
    sun: "rgba(240, 220, 140, 0.45)",
    far: "#2c4a3a",
    far2: "#213a2e",
    mid: "#122a1e",
    ground: "#4a4a2e",
    groundDark: "#2e2f1c",
    strata: "rgba(61, 220, 151, 0.14)",
    bed: "#1d1e14",
  },
  urban: {
    skyTop: "#0c1024",
    skyMid: "#2b2f52",
    horizon: "#e08a5a",
    sun: "rgba(255, 170, 110, 0.45)",
    far: "#2a2e48",
    far2: "#1f2238",
    mid: "#15172a",
    ground: "#4a4a50",
    groundDark: "#2c2c32",
    strata: "rgba(126, 200, 227, 0.16)",
    bed: "#1e1e22",
  },
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS: Record<BiomeId, number> = { plains: 11, canyon: 23, estuary: 37, serra: 53, mangrove: 71, urban: 89 };

export class Backdrop {
  private cache = new Map<string, HTMLCanvasElement>();

  get(layout: Layout): HTMLCanvasElement {
    const key = `${layout.biome}|${layout.leftX}|${layout.rightX}|${layout.deckY}|${layout.waterY}|${layout.bedY}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const c = document.createElement("canvas");
    c.width = layout.width;
    c.height = layout.height;
    const ctx = c.getContext("2d");
    if (ctx) paint(ctx, layout);
    this.cache.set(key, c);
    return c;
  }
}

function paint(ctx: CanvasRenderingContext2D, L: Layout): void {
  const p = PALETTES[L.biome];
  const rand = rng(SEEDS[L.biome]);
  const W = L.width;
  const H = L.height;
  const horizonY = L.deckY - 150;

  // céu
  const sky = ctx.createLinearGradient(0, 0, 0, L.deckY + 40);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(0.55, p.skyMid);
  sky.addColorStop(1, p.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // sol baixo
  const sunX = W * 0.66;
  const sun = ctx.createRadialGradient(sunX, horizonY + 20, 10, sunX, horizonY + 20, 420);
  sun.addColorStop(0, p.sun);
  sun.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  // nuvens finas
  ctx.fillStyle = "rgba(232, 238, 242, 0.08)";
  for (let i = 0; i < 7; i++) {
    const cx = rand() * W;
    const cy = 60 + rand() * (horizonY - 120);
    const cw = 160 + rand() * 360;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, 6 + rand() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // cordilheiras (duas profundidades)
  const ridgeAmp = L.biome === "canyon" || L.biome === "serra" ? 150 : L.biome === "estuary" ? 28 : 70;
  ridge(ctx, rand, W, horizonY + 10, ridgeAmp, p.far, 5, L.deckY + 60);
  if (L.biome === "serra") fog(ctx, W, horizonY + 40, 90);
  ridge(ctx, rand, W, horizonY + 70, ridgeAmp * 0.6, p.far2, 3, L.deckY + 60);

  // camada média: vegetação, mar ou skyline
  if (L.biome === "urban") skyline(ctx, rand, W, L.deckY - 20, p.mid);
  else if (L.biome === "estuary") sea(ctx, rand, W, horizonY + 95, L.deckY - 10, p);
  else treeline(ctx, rand, W, L.deckY - 14, p.mid, L.biome);

  // margens e leito
  banks(ctx, rand, L, p);
  if (L.biome === "mangrove") roots(ctx, rand, L);
  if (L.biome === "urban") streetlights(ctx, L);

  // vinheta de prancheta
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05);
  vig.addColorStop(0, "rgba(11, 31, 58, 0)");
  vig.addColorStop(1, "rgba(11, 31, 58, 0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function ridge(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  W: number,
  baseY: number,
  amp: number,
  color: string,
  octaves: number,
  bottom: number,
): void {
  const phases = Array.from({ length: octaves }, () => rand() * Math.PI * 2);
  const freqs = Array.from({ length: octaves }, (_, i) => (0.0025 + rand() * 0.002) * (i + 1));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let x = 0; x <= W; x += 8) {
    let y = 0;
    for (let i = 0; i < octaves; i++) y += Math.sin(x * freqs[i] + phases[i]) / (i + 1);
    y = baseY - Math.abs(y) * amp * 0.7 - y * amp * 0.3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, bottom);
  ctx.closePath();
  ctx.fill();
  // linhas de cota da prancheta
  ctx.strokeStyle = "rgba(232, 238, 242, 0.06)";
  ctx.lineWidth = 1;
  for (let yy = baseY - amp; yy < bottom; yy += 22) {
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(W, yy);
    ctx.stroke();
  }
}

function fog(ctx: CanvasRenderingContext2D, W: number, y: number, h: number): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "rgba(232, 238, 242, 0)");
  g.addColorStop(0.5, "rgba(232, 238, 242, 0.22)");
  g.addColorStop(1, "rgba(232, 238, 242, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, h);
}

function treeline(ctx: CanvasRenderingContext2D, rand: () => number, W: number, baseY: number, color: string, biome: BiomeId): void {
  ctx.fillStyle = color;
  const conifer = biome === "canyon" || biome === "serra";
  for (let x = -20; x < W + 20; x += 10 + rand() * 14) {
    const h = (conifer ? 40 : 26) + rand() * (conifer ? 70 : 44);
    const w = conifer ? 10 + rand() * 12 : 18 + rand() * 26;
    ctx.beginPath();
    if (conifer) {
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + w / 2, baseY - h);
      ctx.lineTo(x + w, baseY);
    } else {
      ctx.ellipse(x + w / 2, baseY - h * 0.55, w / 2, h * 0.55, 0, 0, Math.PI * 2);
      ctx.rect(x + w / 2 - 2, baseY - h * 0.5, 4, h * 0.5);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(0, baseY - 4, W, 30);
}

function skyline(ctx: CanvasRenderingContext2D, rand: () => number, W: number, baseY: number, color: string): void {
  ctx.fillStyle = color;
  let x = -10;
  while (x < W + 10) {
    const w = 30 + rand() * 70;
    const h = 60 + rand() * 200;
    ctx.fillRect(x, baseY - h, w, h + 30);
    if (rand() > 0.6) ctx.fillRect(x + w * 0.3, baseY - h - 18, w * 0.4, 18);
    // janelas
    ctx.fillStyle = "rgba(230, 184, 74, 0.35)";
    for (let wy = baseY - h + 10; wy < baseY - 10; wy += 14) {
      for (let wx = x + 6; wx < x + w - 8; wx += 12) if (rand() > 0.55) ctx.fillRect(wx, wy, 5, 7);
    }
    ctx.fillStyle = color;
    x += w + 4 + rand() * 10;
  }
}

function sea(ctx: CanvasRenderingContext2D, rand: () => number, W: number, top: number, bottom: number, p: Palette): void {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, "rgba(126, 200, 227, 0.35)");
  g.addColorStop(1, p.mid);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, bottom - top + 30);
  ctx.strokeStyle = "rgba(232, 238, 242, 0.25)";
  for (let i = 0; i < 40; i++) {
    const y = top + 6 + rand() * (bottom - top - 10);
    const x = rand() * W;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20 + rand() * 60, y);
    ctx.stroke();
  }
  // mastros e guindastes do porto
  ctx.fillStyle = p.mid;
  for (let i = 0; i < 6; i++) {
    const x = rand() * W;
    const h = 30 + rand() * 60;
    ctx.fillRect(x, top - h, 3, h);
    ctx.fillRect(x - 12, top - h + 6, 26, 2);
  }
}

function banks(ctx: CanvasRenderingContext2D, rand: () => number, L: Layout, p: Palette): void {
  const { leftX, rightX, deckY, bedY, width: W, height: H } = L;
  const topY = deckY + 4;

  // parede oposta do vale: preenche o vão entre as margens até o leito
  const gorge = ctx.createLinearGradient(0, topY - 10, 0, bedY + 40);
  gorge.addColorStop(0, p.mid);
  gorge.addColorStop(0.18, p.groundDark);
  gorge.addColorStop(1, p.bed);
  ctx.fillStyle = gorge;
  ctx.fillRect(0, topY - 10, W, H - topY + 10);
  ctx.strokeStyle = p.strata;
  ctx.lineWidth = 1;
  for (let y = topY + 30; y < bedY; y += 34 + rand() * 14) {
    ctx.beginPath();
    let yy = y;
    ctx.moveTo(0, yy);
    for (let x = 0; x <= W; x += 80) {
      yy = y + Math.sin(x * 0.01 + y) * 5 + (rand() - 0.5) * 4;
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // névoa de fundo do vale
  const haze = ctx.createLinearGradient(0, topY, 0, bedY);
  haze.addColorStop(0, "rgba(126, 200, 227, 0.10)");
  haze.addColorStop(1, "rgba(11, 31, 58, 0.35)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, topY, W, bedY - topY);

  const drawBank = (side: 1 | -1): void => {
    const edgeX = side === 1 ? leftX + 30 : rightX - 30;
    const outer = side === 1 ? 0 : W;
    ctx.beginPath();
    ctx.moveTo(outer, topY);
    ctx.lineTo(edgeX, topY);
    // encosta irregular até o leito
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = edgeX + side * (10 + t * 70 + rand() * 12);
      const y = topY + t * (bedY + 40 - topY);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(outer, H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, topY, 0, H);
    g.addColorStop(0, p.ground);
    g.addColorStop(1, p.groundDark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = p.strata;
    ctx.lineWidth = 1.2;
    for (let y = topY + 18; y < H; y += 26 + rand() * 10) {
      ctx.beginPath();
      ctx.moveTo(outer, y + rand() * 6);
      ctx.lineTo(edgeX + side * 90, y - 4 + rand() * 8);
      ctx.stroke();
    }
    ctx.restore();
    // grama / borda superior
    ctx.fillStyle = p.mid;
    ctx.fillRect(Math.min(outer, edgeX), topY - 6, Math.abs(edgeX - outer), 8);
  };
  drawBank(1);
  drawBank(-1);

  // leito
  ctx.fillStyle = p.bed;
  ctx.fillRect(0, bedY + 20, W, H - bedY - 20);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(leftX - 20, bedY - 10, rightX - leftX + 40, 40);
}

function roots(ctx: CanvasRenderingContext2D, rand: () => number, L: Layout): void {
  ctx.strokeStyle = "rgba(18, 42, 30, 0.9)";
  ctx.lineWidth = 3;
  for (const side of [1, -1] as const) {
    const baseX = side === 1 ? L.leftX + 40 : L.rightX - 40;
    for (let i = 0; i < 9; i++) {
      const x = baseX + side * (rand() * 60);
      const y0 = L.deckY + 40 + rand() * 120;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.quadraticCurveTo(x + side * 30, y0 + 60, x + side * (10 + rand() * 40), L.waterY + 10);
      ctx.stroke();
    }
  }
}

function streetlights(ctx: CanvasRenderingContext2D, L: Layout): void {
  for (const x of [L.leftX - 150, L.rightX + 150]) {
    ctx.fillStyle = "#8A9AA8";
    ctx.fillRect(x - 2, L.deckY - 70, 4, 70);
    ctx.fillRect(x - 2, L.deckY - 70, 18, 3);
    const g = ctx.createRadialGradient(x + 16, L.deckY - 66, 2, x + 16, L.deckY - 66, 60);
    g.addColorStop(0, "rgba(230, 184, 74, 0.5)");
    g.addColorStop(1, "rgba(230, 184, 74, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 50, L.deckY - 130, 130, 130);
  }
}
