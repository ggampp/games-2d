import * as THREE from 'three';

/** Canonical pixel size when we must re-pack inconsistent art. */
export const SPRITE_CANON_W = 512;
export const SPRITE_CANON_H = 512;

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function isBgPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 8) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  // Near-white / light gray / checkerboard (low chroma + high luminance)
  if (lum >= 210 && max - min <= 32) return true;
  if (min >= 232) return true;
  return false;
}

/** Per-pixel punch for PNG strips (true alpha or baked checkerboard). */
function punchLightBackground(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 12 || isBgPixel(r, g, b, a)) {
      data[i + 3] = 0;
    }
  }
}

function floodKeyBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const n = width * height;
  const visited = new Uint8Array(n);
  const stack: number[] = [];

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    const o = i * 4;
    if (!isBgPixel(data[o], data[o + 1], data[o + 2], data[o + 3])) return;
    visited[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop()!;
    const o = i * 4;
    data[o + 3] = 0;
    const x = i % width;
    const y = (i / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] > 0 && isBgPixel(data[o], data[o + 1], data[o + 2], data[o + 3])) {
      data[o + 3] = 0;
    }
  }
}

function findAlphaBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaMin = 16,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > alphaMin) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

function normalizeToCanon(src: HTMLCanvasElement, fill = 0.92): HTMLCanvasElement {
  const outW = SPRITE_CANON_W;
  const outH = SPRITE_CANON_H;
  const sctx = src.getContext('2d');
  if (!sctx) throw new Error('2D context unavailable');
  const img = sctx.getImageData(0, 0, src.width, src.height);
  const bounds = findAlphaBounds(img.data, src.width, src.height);

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('2D context unavailable');
  octx.clearRect(0, 0, outW, outH);
  if (!bounds) return out;

  const bw = bounds.maxX - bounds.minX + 1;
  const bh = bounds.maxY - bounds.minY + 1;
  const fitW = outW * fill;
  const fitH = outH * fill;
  let scale = fitH / bh;
  if (bw * scale > fitW) scale = fitW / bw;
  const dw = bw * scale;
  const dh = bh * scale;
  const dx = (outW - dw) / 2;
  const dy = outH - outH * 0.03 - dh;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(src, bounds.minX, bounds.minY, bw, bh, dx, dy, dw, dh);
  return out;
}

function canvasToTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

export type SheetLoadOptions = {
  /** Equal-width columns (default). */
  cols?: number;
  rows?: number;
  /**
   * When true (default for pro sheets): keep each cell as-is with identical
   * pixel size — no per-frame re-scale. Best for artist-authored strips.
   */
  equalCells?: boolean;
  /** Flood-key light backgrounds (for JPG sheets). Off for transparent PNGs. */
  keyBackground?: boolean;
  /** Re-pack into 512² (can change relative scale). Default false for equalCells. */
  normalize?: boolean;
  pad?: number;
};

/**
 * Slice a horizontal sprite strip into frames.
 * Prefer equalCells=true for sheets like heroi_andando / heroi_atacando so
 * every frame shares the exact same texture dimensions.
 */
export async function loadSpriteSheetFrames(
  url: string,
  colsOrOptions: number | SheetLoadOptions = 4,
  rowsLegacy = 1,
): Promise<THREE.CanvasTexture[]> {
  const opts: SheetLoadOptions =
    typeof colsOrOptions === 'number'
      ? { cols: colsOrOptions, rows: rowsLegacy, equalCells: true, keyBackground: false, normalize: false }
      : colsOrOptions;

  const cols = opts.cols ?? 4;
  const rows = opts.rows ?? 1;
  const equalCells = opts.equalCells !== false;
  const keyBackground = opts.keyBackground === true;
  const normalize = opts.normalize === true;
  const pad = opts.pad ?? (equalCells ? 0 : 6);

  const img = await loadHtmlImage(url);
  const fullW = img.naturalWidth || img.width;
  const fullH = img.naturalHeight || img.height;
  const cellW = Math.floor(fullW / cols);
  const cellH = Math.floor(fullH / rows);
  const frames: THREE.CanvasTexture[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const sx = col * cellW + pad;
      const sy = row * cellH + pad;
      const sw = Math.max(1, cellW - pad * 2);
      const sh = Math.max(1, cellH - pad * 2);

      // Equal cells → identical canvas size for every frame
      const canvas = document.createElement('canvas');
      canvas.width = equalCells ? cellW : sw;
      canvas.height = equalCells ? cellH : sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D context unavailable');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (equalCells) {
        ctx.drawImage(img, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH);
      } else {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (keyBackground) {
        floodKeyBackground(imageData.data, canvas.width, canvas.height);
      } else {
        // Transparent PNGs (or sheets exported with checkerboard baked in):
        // punch out light gray / white / checker pixels while keeping colored art.
        punchLightBackground(imageData.data);
      }
      ctx.putImageData(imageData, 0, 0);

      if (normalize) {
        frames.push(canvasToTexture(normalizeToCanon(canvas)));
      } else {
        frames.push(canvasToTexture(canvas));
      }
    }
  }
  return frames;
}

/** Load single sprite (JPG-friendly with key + normalize). */
export async function loadSpriteTexture(url: string): Promise<THREE.CanvasTexture> {
  const img = await loadHtmlImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.drawImage(img, 0, 0);

  // PNG with real alpha: skip flood key. JPG: key light bg.
  const isPng = /\.png($|\?)/i.test(url);
  if (!isPng) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    floodKeyBackground(imageData.data, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
  }
  return canvasToTexture(normalizeToCanon(canvas));
}

export async function loadBackgroundTexture(url: string): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  const texture = await loader.loadAsync(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}
