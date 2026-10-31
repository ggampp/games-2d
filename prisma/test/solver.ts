// Solver / probe utilities for level QA. Runs under `node --experimental-strip-types`.
import type { Level, Piece, PieceType } from '../src/core/types.ts';
import { trace } from '../src/core/tracer.ts';
import { pointSegDist } from '../src/core/geom.ts';

export interface Hint {
  type: PieceType;
  x: number;
  y: number;
  angle?: number; // degrees; omitted = search
  link?: string;
  id?: string;
}

const D = Math.PI / 180;

export function hintsToPieces(hints: Hint[]): Piece[] {
  return hints.map((h, i) => ({
    id: h.id ?? `h${i}`,
    type: h.type,
    x: h.x,
    y: h.y,
    angle: (h.angle ?? 0) * D,
    link: h.link
  }));
}

export function score(level: Level, pieces: Piece[]): number {
  const res = trace(level, [...(level.pieces ?? []), ...pieces]);
  // Primary: lit targets. Secondary: how close any beam gets to each unlit target (smooths the search).
  let near = 0;
  for (const t of level.targets) {
    if (res.litTargets.has(t.id)) continue;
    let best = 400;
    for (const s of res.segments) {
      for (let i = 1; i < s.pts.length; i++) {
        const d = pointSegDist({ x: t.x, y: t.y }, s.pts[i - 1], s.pts[i]);
        if (d < best) best = d;
      }
    }
    near += (400 - best) / 400;
  }
  return res.litTargets.size * 100 + near;
}

/**
 * Coordinate-descent angle search: for each searched piece, scan angles, keep the best.
 * Returns the best pieces and how many targets they light.
 */
export function solve(level: Level, hints: Hint[], passes = 3): { pieces: Piece[]; lit: number; total: number } {
  const pieces = hintsToPieces(hints);
  const total = level.targets.length;
  const free = hints.map((h, i) => (h.angle === undefined ? i : -1)).filter((i) => i >= 0);
  const lit = () => Math.floor(score(level, pieces) / 100);
  let best = score(level, pieces);

  const refine = (idx: number, span: number, step: number) => {
    const centre = pieces[idx].angle;
    let bestAngle = centre;
    for (let d = -span; d <= span + 1e-9; d += step) {
      pieces[idx].angle = centre + d * D;
      const s = score(level, pieces);
      if (s > best) { best = s; bestAngle = pieces[idx].angle; }
    }
    pieces[idx].angle = bestAngle;
  };

  if (free.length === 2) {
    // joint coarse grid, then refine each
    const [i, j] = free;
    let bi = 0, bj = 0;
    for (let a = 0; a < 360; a += 4) {
      pieces[i].angle = a * D;
      for (let b = 0; b < 360; b += 4) {
        pieces[j].angle = b * D;
        const s = score(level, pieces);
        if (s > best) { best = s; bi = a; bj = b; }
      }
    }
    pieces[i].angle = bi * D; pieces[j].angle = bj * D;
    for (let k = 0; k < 2; k++) { refine(i, 4, 0.25); refine(j, 4, 0.25); }
    return { pieces, lit: lit(), total };
  }

  for (let pass = 0; pass < passes; pass++) {
    for (const i of free) {
      pieces[i].angle = 0;
      let bestAngle = 0;
      for (let deg = 0; deg < 360; deg += 1) {
        pieces[i].angle = deg * D;
        const s = score(level, pieces);
        if (s > best) { best = s; bestAngle = pieces[i].angle; }
      }
      pieces[i].angle = bestAngle;
      refine(i, 1, 0.1);
    }
    if (lit() === total) break;
  }
  return { pieces, lit: lit(), total };
}

/** Print where each beam ends up, useful for placing targets. */
export function probe(level: Level, pieces: Piece[]): string {
  const res = trace(level, [...(level.pieces ?? []), ...pieces]);
  const lines: string[] = [];
  for (const s of res.segments) {
    const a = s.pts[0], b = s.pts[s.pts.length - 1];
    lines.push(
      `${s.medium.padEnd(5)} band ${s.band.lo.toFixed(0)}-${s.band.hi.toFixed(0)} ` +
      `(${a.x.toFixed(0)},${a.y.toFixed(0)}) -> (${b.x.toFixed(0)},${b.y.toFixed(0)}) ` +
      `w ${s.w0.toFixed(0)}->${s.w1.toFixed(0)} i ${s.intensity.toFixed(2)}`
    );
  }
  lines.push(`lit: ${[...res.litTargets.keys()].join(', ') || '-'}`);
  return lines.join('\n');
}
