import type { Band, TargetColor } from './types.ts';

export const FULL_BAND: Band = { lo: 380, hi: 750 };

/** Approximate CIE-ish wavelength (nm) to linear RGB in 0..1. */
export function wavelengthToRgb(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; g = 0; b = 1; }
  else if (nm < 490) { r = 0; g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { r = 0; g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; b = 0; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; b = 0; }
  else if (nm <= 750) { r = 1; g = 0; b = 0; }
  // intensity falloff at the edges of visibility
  let f = 1;
  if (nm < 420) f = 0.3 + 0.7 * (nm - 380) / 40;
  else if (nm > 700) f = 0.3 + 0.7 * (750 - nm) / 50;
  return [r * f, g * f, b * f];
}

const bandCache = new Map<string, [number, number, number]>();

/** Average colour of a band, normalised so the brightest channel is ~1. Full band is a warm white. */
export function bandToRgb(band: Band): [number, number, number] {
  const key = `${band.lo | 0}-${band.hi | 0}`;
  const hit = bandCache.get(key);
  if (hit) return hit;
  const n = 12;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const nm = band.lo + ((i + 0.5) / n) * (band.hi - band.lo);
    const c = wavelengthToRgb(nm);
    r += c[0]; g += c[1]; b += c[2];
  }
  r /= n; g /= n; b /= n;
  const width = band.hi - band.lo;
  if (width > 250) {
    // Full-spectrum light: render as warm gold-white rather than the muddy average.
    const t = Math.min(1, (width - 250) / 120);
    r = r + (1 - r) * t; g = g + (0.93 - g) * t; b = b + (0.76 - b) * t;
  }
  const m = Math.max(r, g, b, 1e-3);
  const out: [number, number, number] = [r / m, g / m, b / m];
  bandCache.set(key, out);
  return out;
}

export function bandWidth(b: Band): number {
  return Math.max(0, b.hi - b.lo);
}

export function intersectBand(a: Band, b: Band): Band | null {
  const lo = Math.max(a.lo, b.lo);
  const hi = Math.min(a.hi, b.hi);
  return hi - lo > 4 ? { lo, hi } : null;
}

export const RANGES: Record<Exclude<TargetColor, 'any' | 'white'>, Band> = {
  red: { lo: 585, hi: 750 },
  green: { lo: 495, hi: 575 },
  blue: { lo: 380, hi: 495 }
};

/** Does light of this band count as the given target colour? */
export function bandMatches(band: Band, color: TargetColor): boolean {
  const w = bandWidth(band);
  if (w <= 0) return false;
  if (color === 'any') return true;
  if (color === 'white') return band.lo <= 460 && band.hi >= 640;
  if (w > 180) return false; // too broad to read as a single colour
  const inter = intersectBand(band, RANGES[color]);
  if (!inter) return false;
  return bandWidth(inter) / w >= 0.6;
}

/** Refractive index of the game's glass. Exaggerated dispersion so prisms fan wide. */
export function glassIndex(nm: number): number {
  return 1.4218 + 28500 / (nm * nm);
}

export function waterIndex(nm: number): number {
  return 1.318 + 3000 / (nm * nm);
}

export function bandCenter(b: Band): number {
  return (b.lo + b.hi) * 0.5;
}

/** Split a band into narrow sub-bands for dispersion. */
export function splitBand(b: Band, step = 16): Band[] {
  const w = bandWidth(b);
  if (w <= step * 1.5) return [b];
  const n = Math.min(28, Math.ceil(w / step));
  const out: Band[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ lo: b.lo + (w * i) / n, hi: b.lo + (w * (i + 1)) / n });
  }
  return out;
}
