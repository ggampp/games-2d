import type {
  Band, BeamSegment, BlackHole, EclipseShadow, Level, Piece, Planet, River, TraceResult, Vec
} from './types.ts';
import {
  add, dot, fromAngle, mul, norm, perp, rayCircle, rayRect, raySegment, reflect, refract, segHitsCircle, sub
} from './geom.ts';
import type { Hit } from './geom.ts';
import {
  FULL_BAND, bandCenter, bandMatches, bandToRgb, bandWidth, glassIndex, intersectBand, splitBand, waterIndex
} from './spectrum.ts';

export const BOARD = 900;
export const BORDER = 40;

export const DIM = {
  mirror: 74,
  dichroic: 74,
  filter: 74,
  lens: 66,
  lensFocal: 210,
  prismR: 36, // circumradius of the equilateral prism
  orbR: 30,
  portal: 64,
  emitterOffset: 30
} as const;

const DICHROIC_CUT = 590;
const FILTER_PASS: Band = { lo: 500, hi: 570 };

type Medium = 'air' | 'glass' | 'water';

interface Beam {
  pos: Vec;
  dir: Vec;
  band: Band;
  intensity: number;
  /** signed width; rendering uses |width| */
  width: number;
  widthRate: number;
  depth: number;
  medium: Medium;
  mediumId: string | null;
  outerMedium: Medium;
  outerMediumId: string | null;
}

type SurfaceKind =
  | 'border' | 'wall' | 'mirror' | 'dichroic' | 'filter' | 'lens' | 'portal'
  | 'prism' | 'orb' | 'planet' | 'horizon' | 'river';

interface Surface {
  id: string;
  kind: SurfaceKind;
  a?: Vec;
  b?: Vec;
  c?: Vec;
  r?: number;
  rect?: { x: number; y: number; w: number; h: number };
  piece?: Piece;
  planet?: Planet;
  river?: River;
  tangent?: Vec;
  normal?: Vec;
}

export function prismVertices(p: Piece): Vec[] {
  const out: Vec[] = [];
  for (let k = 0; k < 3; k++) {
    const a = p.angle - Math.PI / 2 + (k * Math.PI * 2) / 3;
    out.push({ x: p.x + Math.cos(a) * DIM.prismR, y: p.y + Math.sin(a) * DIM.prismR });
  }
  return out;
}

export function segmentEndpoints(p: Piece): [Vec, Vec] {
  const L = p.type === 'lens' ? DIM.lens : p.type === 'portal' ? DIM.portal : DIM.mirror;
  const t = fromAngle(p.angle);
  return [
    { x: p.x - t.x * L * 0.5, y: p.y - t.y * L * 0.5 },
    { x: p.x + t.x * L * 0.5, y: p.y + t.y * L * 0.5 }
  ];
}

export function buildSurfaces(level: Level, pieces: Piece[]): Surface[] {
  const s: Surface[] = [];
  const lo = BORDER, hi = BOARD - BORDER;
  s.push({ id: 'b0', kind: 'border', a: { x: lo, y: lo }, b: { x: hi, y: lo } });
  s.push({ id: 'b1', kind: 'border', a: { x: hi, y: lo }, b: { x: hi, y: hi } });
  s.push({ id: 'b2', kind: 'border', a: { x: hi, y: hi }, b: { x: lo, y: hi } });
  s.push({ id: 'b3', kind: 'border', a: { x: lo, y: hi }, b: { x: lo, y: lo } });
  for (const [i, w] of (level.walls ?? []).entries()) {
    s.push({ id: `w${i}`, kind: 'wall', rect: { x: w.x, y: w.y, w: w.w, h: w.h } });
  }
  for (const bh of level.blackHoles ?? []) {
    s.push({ id: bh.id, kind: 'horizon', c: { x: bh.x, y: bh.y }, r: bh.horizon });
  }
  for (const pl of level.planets ?? []) {
    s.push({ id: pl.id, kind: 'planet', c: { x: pl.x, y: pl.y }, r: pl.radius, planet: pl });
  }
  for (const rv of level.rivers ?? []) {
    s.push({ id: rv.id + ':t', kind: 'river', a: { x: lo, y: rv.y0 }, b: { x: hi, y: rv.y0 }, river: rv });
    s.push({ id: rv.id + ':b', kind: 'river', a: { x: lo, y: rv.y1 }, b: { x: hi, y: rv.y1 }, river: rv });
  }
  for (const p of pieces) {
    switch (p.type) {
      case 'mirror':
      case 'dichroic':
      case 'filter':
      case 'lens':
      case 'portal': {
        const [a, b] = segmentEndpoints(p);
        const tangent = fromAngle(p.angle);
        s.push({ id: p.id, kind: p.type, a, b, piece: p, tangent, normal: perp(tangent) });
        break;
      }
      case 'prism': {
        const vs = prismVertices(p);
        for (let k = 0; k < 3; k++) {
          s.push({ id: `${p.id}:${k}`, kind: 'prism', a: vs[k], b: vs[(k + 1) % 3], piece: p });
        }
        break;
      }
      case 'orb':
        s.push({ id: p.id, kind: 'orb', c: { x: p.x, y: p.y }, r: DIM.orbR, piece: p });
        break;
    }
  }
  return s;
}

interface NearestHit {
  hit: Hit;
  surf: Surface;
}

const EPS = 0.5;

export function nearest(surfaces: Surface[], o: Vec, d: Vec): NearestHit | null {
  let best: NearestHit | null = null;
  for (const surf of surfaces) {
    let h: Hit | null = null;
    if (surf.rect) h = rayRect(o, d, surf.rect.x, surf.rect.y, surf.rect.w, surf.rect.h, EPS);
    else if (surf.c) h = rayCircle(o, d, surf.c, surf.r!, EPS);
    else h = raySegment(o, d, surf.a!, surf.b!, EPS);
    if (h && (!best || h.t < best.hit.t)) best = { hit: h, surf };
  }
  return best;
}

export interface TraceOptions {
  maxBeams?: number;
  maxDepth?: number;
}

export function trace(level: Level, pieces: Piece[], opts: TraceOptions = {}): TraceResult {
  const maxBeams = opts.maxBeams ?? 900;
  const maxDepth = opts.maxDepth ?? 20;
  const surfaces = buildSurfaces(level, pieces);
  const holes = level.blackHoles ?? [];
  const portals = pieces.filter((p) => p.type === 'portal');

  const segments: BeamSegment[] = [];
  const litTargets = new Map<string, Band>();
  const shadows: EclipseShadow[] = [];
  const portalHits: Vec[] = [];
  const queue: Beam[] = [];
  let spawned = 0;

  for (const e of level.emitters) {
    const dir = fromAngle(e.angle);
    queue.push({
      pos: add({ x: e.x, y: e.y }, mul(dir, DIM.emitterOffset)),
      dir,
      band: { ...FULL_BAND },
      intensity: 1,
      width: e.width,
      widthRate: 0,
      depth: 0,
      medium: 'air',
      mediumId: null,
      outerMedium: 'air',
      outerMediumId: null
    });
  }

  const push = (b: Beam) => {
    if (spawned >= maxBeams) return;
    if (b.depth > maxDepth || b.intensity < 0.02) return;
    spawned++;
    queue.push(b);
  };

  const checkTargets = (a: Vec, b: Vec, band: Band, width: number) => {
    for (const t of level.targets) {
      if (litTargets.has(t.id)) continue;
      if (!bandMatches(band, t.color)) continue;
      if (segHitsCircle(a, b, { x: t.x, y: t.y }, t.radius + Math.abs(width) * 0.35)) {
        litTargets.set(t.id, band);
      }
    }
  };

  /** Finish a polyline for a beam, splitting where the signed width crosses zero. */
  const emit = (beam: Beam, pts: Vec[]) => {
    if (pts.length < 2) return;
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (total < 0.01) return;
    const w0 = beam.width;
    const w1raw = beam.width + beam.widthRate * total;
    // A lens focuses to a point then re-expands; cap the re-expansion so the cone stays readable.
    const w1 = Math.sign(w1raw || 1) * Math.min(Math.abs(w1raw), 34);
    if (Math.abs(w1raw) >= 34) beam.widthRate = 0;
    const rgb = bandToRgb(beam.band);
    const base = { band: beam.band, rgb, intensity: beam.intensity, medium: beam.medium };
    for (let i = 1; i < pts.length; i++) checkTargets(pts[i - 1], pts[i], beam.band, w0);
    if (w0 * w1 < 0 && pts.length === 2) {
      const sZero = -w0 / beam.widthRate;
      const mid = add(pts[0], mul(beam.dir, sZero));
      segments.push({ pts: [pts[0], mid], w0: Math.abs(w0), w1: 0, ...base });
      segments.push({ pts: [mid, pts[1]], w0: 0, w1: Math.abs(w1), ...base });
    } else {
      segments.push({ pts, w0: Math.abs(w0), w1: Math.abs(w1), ...base });
    }
    beam.width = w1;
  };

  const spawnFrom = (beam: Beam, pos: Vec, dir: Vec, patch: Partial<Beam> = {}): Beam => ({
    pos: add(pos, mul(dir, 0.01)),
    dir,
    band: beam.band,
    intensity: beam.intensity,
    width: beam.width,
    widthRate: beam.widthRate,
    depth: beam.depth + 1,
    medium: beam.medium,
    mediumId: beam.mediumId,
    outerMedium: beam.outerMedium,
    outerMediumId: beam.outerMediumId,
    ...patch
  });

  const enterGlass = (beam: Beam, hit: Hit, pieceId: string) => {
    const n1 = beam.medium === 'water' ? waterIndex(bandCenter(beam.band)) : 1;
    const subs = splitBand(beam.band);
    const wTotal = bandWidth(beam.band);
    for (const sb of subs) {
      const n2 = glassIndex(bandCenter(sb));
      const d = refract(beam.dir, hit.normal, n1, n2);
      if (!d) continue;
      const share = subs.length === 1 ? 1 : Math.sqrt(bandWidth(sb) / wTotal) * 0.95;
      push(spawnFrom(beam, hit.point, d, {
        band: sb,
        intensity: beam.intensity * 0.94 * share,
        medium: 'glass',
        mediumId: pieceId,
        outerMedium: beam.medium,
        outerMediumId: beam.mediumId
      }));
    }
  };

  const leaveGlass = (beam: Beam, hit: Hit) => {
    const n1 = glassIndex(bandCenter(beam.band));
    const n2 = beam.outerMedium === 'water' ? waterIndex(bandCenter(beam.band)) : 1;
    const d = refract(beam.dir, hit.normal, n1, n2);
    if (d) {
      push(spawnFrom(beam, hit.point, d, {
        intensity: beam.intensity * 0.96,
        medium: beam.outerMedium,
        mediumId: beam.outerMediumId
      }));
    } else {
      // total internal reflection
      push(spawnFrom(beam, hit.point, reflect(beam.dir, hit.normal), { intensity: beam.intensity * 0.9 }));
    }
  };

  const interact = (beam: Beam, nh: NearestHit) => {
    const { hit, surf } = nh;
    switch (surf.kind) {
      case 'border':
      case 'wall':
      case 'horizon':
        return;
      case 'planet':
        shadows.push({ planet: surf.planet!, dir: beam.dir, width: Math.abs(beam.width) });
        return;
      case 'mirror':
        push(spawnFrom(beam, hit.point, reflect(beam.dir, hit.normal), { intensity: beam.intensity * 0.97 }));
        return;
      case 'dichroic': {
        const refl = intersectBand(beam.band, { lo: DICHROIC_CUT, hi: 750 });
        const pass = intersectBand(beam.band, { lo: 380, hi: DICHROIC_CUT });
        if (refl) push(spawnFrom(beam, hit.point, reflect(beam.dir, hit.normal), { band: refl, intensity: beam.intensity * 0.95 }));
        if (pass) push(spawnFrom(beam, hit.point, beam.dir, { band: pass, intensity: beam.intensity * 0.95 }));
        return;
      }
      case 'filter': {
        const pass = intersectBand(beam.band, FILTER_PASS);
        if (pass) push(spawnFrom(beam, hit.point, beam.dir, { band: pass, intensity: beam.intensity * 0.9 }));
        return;
      }
      case 'lens': {
        const axis = mul(hit.normal, -1); // direction of travel through the lens
        const t = surf.tangent!;
        const h = hit.offset ?? 0;
        const f = DIM.lensFocal;
        const along = dot(beam.dir, axis);
        if (along < 0.05) return;
        // Rays parallel to `dir` converge on the back focal plane at f*dir/along; this ray starts at offset h.
        const target = sub(mul(beam.dir, f / along), mul(t, h));
        const d = norm(target);
        push(spawnFrom(beam, hit.point, d, {
          intensity: beam.intensity * 0.97,
          widthRate: beam.widthRate - beam.width / f
        }));
        return;
      }
      case 'portal': {
        const src = surf.piece!;
        const dst = portals.find((p) => p.id === src.link || p.link === src.id);
        if (!dst || dst.id === src.id) return;
        portalHits.push(hit.point);
        const tA = surf.tangent!, nA = surf.normal!;
        const tB = fromAngle(dst.angle), nB = perp(tB);
        const lx = dot(beam.dir, tA), ly = dot(beam.dir, nA);
        const dOut = norm(add(mul(tB, -lx), mul(nB, -ly)));
        const h = hit.offset ?? 0;
        const exitPos = add({ x: dst.x, y: dst.y }, mul(tB, -h));
        push(spawnFrom(beam, add(exitPos, mul(dOut, 0.6)), dOut, { intensity: beam.intensity * 0.98 }));
        return;
      }
      case 'prism':
      case 'orb': {
        const pid = surf.piece!.id;
        if (beam.medium === 'glass' && beam.mediumId === pid) leaveGlass(beam, hit);
        else if (beam.medium === 'glass') return; // nested glass unsupported: absorb
        else enterGlass(beam, hit, pid);
        return;
      }
      case 'river': {
        const entering = beam.medium !== 'water';
        if (beam.medium === 'glass') return;
        const nm = bandCenter(beam.band);
        const n1 = entering ? 1 : waterIndex(nm);
        const n2 = entering ? waterIndex(nm) : 1;
        const d = refract(beam.dir, hit.normal, n1, n2);
        if (d) {
          push(spawnFrom(beam, hit.point, d, {
            intensity: beam.intensity * 0.96,
            medium: entering ? 'water' : 'air',
            mediumId: entering ? surf.river!.id : null
          }));
        } else {
          push(spawnFrom(beam, hit.point, reflect(beam.dir, hit.normal), { intensity: beam.intensity * 0.92 }));
        }
        return;
      }
    }
  };

  const insideInfluence = (p: Vec): BlackHole | null => {
    for (const bh of holes) {
      if (Math.hypot(p.x - bh.x, p.y - bh.y) < bh.influence) return bh;
    }
    return null;
  };

  const march = (beam: Beam) => {
    const pts: Vec[] = [beam.pos];
    let pos = beam.pos;
    let dir = beam.dir;
    let guard = 0;
    while (guard++ < 2000) {
      const bh = insideInfluence(pos);
      if (!bh) {
        let nh = nearest(surfaces, pos, dir);
        // Would we enter a black hole's influence before hitting anything?
        let entryT = Infinity;
        for (const h of holes) {
          const hit = rayCircle(pos, dir, { x: h.x, y: h.y }, h.influence, EPS);
          if (hit && hit.t < entryT) entryT = hit.t;
        }
        if (entryT < (nh ? nh.hit.t : Infinity)) {
          pos = add(pos, mul(dir, entryT + 0.5));
          pts.push(pos);
          continue;
        }
        if (!nh) {
          // Outside the arena (numerical drift): stop here.
          beam.dir = dir;
          emit(beam, pts);
          return;
        }
        pts.push(nh.hit.point);
        beam.dir = dir;
        emit(beam, pts);
        interact(beam, nh);
        return;
      }
      // Curved marching inside gravitational influence.
      let cached: NearestHit | null = nearest(surfaces, pos, dir);
      let travelled = 0;
      let stepCount = 0;
      while (guard++ < 2000) {
        const rx = pos.x - bh.x, ry = pos.y - bh.y;
        const r = Math.hypot(rx, ry);
        if (r < bh.horizon) {
          beam.dir = dir;
          emit(beam, pts);
          return;
        }
        const ds = r < 90 ? 1.5 : 3;
        if (cached && cached.hit.t - travelled <= ds) {
          pts.push(cached.hit.point);
          beam.dir = dir;
          emit(beam, pts);
          interact(beam, cached);
          return;
        }
        const k = (bh.mass / (r * r)) * ds;
        dir = norm({ x: dir.x - (rx / r) * k, y: dir.y - (ry / r) * k });
        pos = add(pos, mul(dir, ds));
        travelled += ds;
        stepCount++;
        if (stepCount % 2 === 0) pts.push(pos);
        // Re-aim the straight-line lookahead periodically, but never while a surface is within reach:
        // a recompute from < EPS away would skip it and let the beam tunnel through.
        const remaining = cached ? cached.hit.t - travelled : Infinity;
        if (!cached || (remaining > 14 && stepCount % 6 === 0)) {
          cached = nearest(surfaces, pos, dir);
          travelled = 0;
        }
        if (Math.hypot(pos.x - bh.x, pos.y - bh.y) >= bh.influence) {
          pts.push(pos);
          break;
        }
      }
      // Exited influence: continue straight in outer loop with updated state.
      if (!insideInfluence(pos)) {
        beam.dir = dir;
        continue;
      }
    }
    beam.dir = dir;
    emit(beam, pts);
  };

  while (queue.length) {
    const b = queue.shift()!;
    march(b);
  }

  return { segments, litTargets, shadows, portalHits };
}

/** Utility for tests & tools: which surfaces a piece exposes (for debugging). */
export function describeTrace(res: TraceResult): string {
  return `${res.segments.length} segments, lit: ${[...res.litTargets.keys()].join(',') || '-'}`;
}

