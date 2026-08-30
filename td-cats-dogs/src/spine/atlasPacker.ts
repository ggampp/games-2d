export type AtlasRegion = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: boolean;
  offsets?: { x: number; y: number; origW: number; origH: number };
};

export type AtlasPage = {
  image: string;
  width: number;
  height: number;
  filter: string;
  pma: boolean;
  regions: AtlasRegion[];
};

export type PackedPage = {
  image: string;
  width: number;
  height: number;
  pma: boolean;
  rgba: Uint8Array;
};

const KEY_RE = /^(size|filter|pma|bounds|offsets|rotate|index|orig|offset):/i;

export function parseAtlas(text: string): AtlasPage[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const pages: AtlasPage[] = [];
  let page: AtlasPage | null = null;
  let region: AtlasRegion | null = null;

  const flushRegion = () => {
    if (page && region) page.regions.push(region);
    region = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushRegion();
      page = null;
      continue;
    }
    if (!page) {
      page = {
        image: line,
        width: 0,
        height: 0,
        filter: "Linear,Linear",
        pma: false,
        regions: [],
      };
      pages.push(page);
      continue;
    }
    if (line.startsWith("size:")) {
      const [w, h] = line.slice(5).split(",").map((v) => Number(v.trim()));
      page.width = w;
      page.height = h;
      continue;
    }
    if (line.startsWith("filter:")) {
      page.filter = line.slice(7).trim();
      continue;
    }
    if (line.startsWith("pma:")) {
      page.pma = line.slice(4).trim().toLowerCase() === "true";
      continue;
    }
    if (!KEY_RE.test(line) && !line.includes(":")) {
      flushRegion();
      region = { name: line, x: 0, y: 0, width: 0, height: 0, rotate: false };
      continue;
    }
    if (!region) continue;
    if (line.startsWith("bounds:")) {
      const [x, y, w, h] = line.slice(7).split(",").map((v) => Number(v.trim()));
      region.x = x;
      region.y = y;
      region.width = w;
      region.height = h;
      continue;
    }
    if (line.startsWith("offsets:")) {
      const [x, y, ow, oh] = line.slice(8).split(",").map((v) => Number(v.trim()));
      region.offsets = { x, y, origW: ow, origH: oh };
      continue;
    }
    if (line.startsWith("rotate:")) {
      const value = line.slice(7).trim().toLowerCase();
      region.rotate = value === "true" || value === "90" || value === "270";
    }
  }
  flushRegion();
  return pages.filter((p) => p.width > 0 && p.height > 0);
}

export function createRgba(width: number, height: number, fill = [0, 0, 0, 0]): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = fill[0];
    out[i * 4 + 1] = fill[1];
    out[i * 4 + 2] = fill[2];
    out[i * 4 + 3] = fill[3];
  }
  return out;
}

export function rotateRgba90Cw(src: Uint8Array, width: number, height: number): {
  rgba: Uint8Array;
  width: number;
  height: number;
} {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const dx = height - 1 - y;
      const dy = x;
      const di = (dy * height + dx) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return { rgba: out, width: height, height: width };
}

export function scaleRgba(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
): Uint8Array {
  const dest = new Uint8Array(destW * destH * 4);
  for (let y = 0; y < destH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y + 0.5) * srcH / destH));
    for (let x = 0; x < destW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x + 0.5) * srcW / destW));
      const si = (sy * srcW + sx) * 4;
      const di = (y * destW + x) * 4;
      dest[di] = src[si];
      dest[di + 1] = src[si + 1];
      dest[di + 2] = src[si + 2];
      dest[di + 3] = src[si + 3];
    }
  }
  return dest;
}

export function blitRgba(
  dest: Uint8Array,
  destW: number,
  destH: number,
  src: Uint8Array,
  srcW: number,
  srcH: number,
  x: number,
  y: number,
): void {
  for (let sy = 0; sy < srcH; sy++) {
    const dy = y + sy;
    if (dy < 0 || dy >= destH) continue;
    for (let sx = 0; sx < srcW; sx++) {
      const dx = x + sx;
      if (dx < 0 || dx >= destW) continue;
      const si = (sy * srcW + sx) * 4;
      const di = (dy * destW + dx) * 4;
      const a = src[si + 3];
      if (a === 0) continue;
      dest[di] = src[si];
      dest[di + 1] = src[si + 1];
      dest[di + 2] = src[si + 2];
      dest[di + 3] = a;
    }
  }
}

export function toPma(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    out[i] = Math.round((rgba[i] * a) / 255);
    out[i + 1] = Math.round((rgba[i + 1] * a) / 255);
    out[i + 2] = Math.round((rgba[i + 2] * a) / 255);
    out[i + 3] = a;
  }
  return out;
}

type Palette = { fill: [number, number, number]; ink: [number, number, number] };

const PALETTES: Record<string, Palette> = {
  Head: { fill: [255, 166, 77], ink: [72, 42, 20] },
  Head1: { fill: [255, 166, 77], ink: [72, 42, 20] },
  Body: { fill: [242, 140, 58], ink: [72, 42, 20] },
  Body1: { fill: [242, 140, 58], ink: [72, 42, 20] },
  Gun: { fill: [86, 96, 110], ink: [30, 34, 40] },
  Tails: { fill: [230, 128, 52], ink: [72, 42, 20] },
  Shade: { fill: [40, 32, 28], ink: [20, 16, 14] },
  HandF: { fill: [120, 168, 92], ink: [36, 52, 28] },
  HandB: { fill: [104, 148, 80], ink: [36, 52, 28] },
  Hand1: { fill: [255, 166, 77], ink: [72, 42, 20] },
  Hand2: { fill: [255, 166, 77], ink: [72, 42, 20] },
  LegF: { fill: [110, 156, 84], ink: [36, 52, 28] },
  LegB: { fill: [96, 140, 72], ink: [36, 52, 28] },
  Mouth: { fill: [80, 168, 92], ink: [28, 48, 24] },
  Hat: { fill: [68, 92, 56], ink: [24, 32, 20] },
  EarF: { fill: [90, 140, 70], ink: [36, 52, 28] },
  EarB: { fill: [80, 124, 62], ink: [36, 52, 28] },
  Shield: { fill: [90, 140, 190], ink: [28, 44, 72] },
  Star: { fill: [255, 214, 64], ink: [160, 90, 16] },
  Light: { fill: [255, 244, 180], ink: [255, 180, 40] },
  Fx: { fill: [255, 120, 40], ink: [255, 220, 80] },
  Box: { fill: [255, 90, 30], ink: [255, 200, 60] },
};

function paletteFor(name: string): Palette {
  if (PALETTES[name]) return PALETTES[name];
  if (/^0\d$/.test(name) || name === "10") return { fill: [255, 196, 64], ink: [255, 240, 160] };
  if (name.startsWith("Hand")) return PALETTES.HandF;
  if (name.startsWith("Leg")) return PALETTES.LegF;
  if (name.startsWith("Ear")) return PALETTES.EarF;
  return { fill: [168, 196, 88], ink: [40, 56, 24] };
}

function setPixel(buf: Uint8Array, w: number, h: number, x: number, y: number, rgba: number[]): void {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y * w + x) * 4;
  buf[i] = rgba[0];
  buf[i + 1] = rgba[1];
  buf[i + 2] = rgba[2];
  buf[i + 3] = rgba[3];
}

function fillEllipse(
  buf: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number[],
): void {
  const r2x = rx * rx || 1;
  const r2y = ry * ry || 1;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx);
      const dy = (y + 0.5 - cy);
      if ((dx * dx) / r2x + (dy * dy) / r2y <= 1) setPixel(buf, w, h, x, y, color);
    }
  }
}

export function synthesizeRegion(name: string, width: number, height: number): Uint8Array {
  const buf = createRgba(width, height);
  const { fill, ink } = paletteFor(name);
  const cx = width / 2;
  const cy = height / 2;
  const rx = Math.max(2, width * 0.42);
  const ry = Math.max(2, height * 0.42);
  fillEllipse(buf, width, height, cx, cy, rx + 1.2, ry + 1.2, [...ink, 255]);
  fillEllipse(buf, width, height, cx, cy, rx, ry, [...fill, 255]);
  if (name.startsWith("Head") || name === "Head1") {
    fillEllipse(buf, width, height, cx - rx * 0.35, cy - ry * 0.1, rx * 0.12, ry * 0.14, [40, 28, 18, 255]);
    fillEllipse(buf, width, height, cx + rx * 0.2, cy - ry * 0.08, rx * 0.12, ry * 0.14, [40, 28, 18, 255]);
    fillEllipse(buf, width, height, cx, cy + ry * 0.18, rx * 0.16, ry * 0.1, [255, 140, 150, 255]);
  }
  if (name === "Gun") {
    fillEllipse(buf, width, height, cx + rx * 0.35, cy, rx * 0.55, ry * 0.28, [50, 56, 64, 255]);
  }
  if (name === "Shade") {
    for (let i = 3; i < buf.length; i += 4) buf[i] = Math.round(buf[i] * 0.45);
  }
  return buf;
}

export function packPages(
  pages: AtlasPage[],
  getPart?: (page: AtlasPage, region: AtlasRegion) => { rgba: Uint8Array; width: number; height: number } | null,
): PackedPage[] {
  return pages.map((page) => {
    let rgba = createRgba(page.width, page.height);
    for (const region of page.regions) {
      const custom = getPart?.(page, region) ?? null;
      let part = custom
        ? scaleRgba(custom.rgba, custom.width, custom.height, region.rotate ? region.height : region.width, region.rotate ? region.width : region.height)
        : synthesizeRegion(region.name, region.rotate ? region.height : region.width, region.rotate ? region.width : region.height);
      let pw = region.rotate ? region.height : region.width;
      let ph = region.rotate ? region.width : region.height;
      if (region.rotate) {
        const rotated = rotateRgba90Cw(part, pw, ph);
        part = rotated.rgba;
        pw = rotated.width;
        ph = rotated.height;
      }
      if (pw !== region.width || ph !== region.height) {
        part = scaleRgba(part, pw, ph, region.width, region.height);
      }
      blitRgba(rgba, page.width, page.height, part, region.width, region.height, region.x, region.y);
    }
    if (page.pma) rgba = toPma(rgba);
    return { image: page.image, width: page.width, height: page.height, pma: page.pma, rgba };
  });
}

export function regionHasOpaquePixels(page: PackedPage, region: AtlasRegion): boolean {
  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      if (page.rgba[(y * page.width + x) * 4 + 3] > 0) return true;
    }
  }
  return false;
}
