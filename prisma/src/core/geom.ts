import type { Vec } from './types.ts';

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const fromAngle = (a: number): Vec => ({ x: Math.cos(a), y: Math.sin(a) });
export const angleOf = (a: Vec): number => Math.atan2(a.y, a.x);
export const rot = (a: Vec, ang: number): Vec => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
export const reflect = (d: Vec, n: Vec): Vec => sub(d, mul(n, 2 * dot(d, n)));

/**
 * Snell refraction. `n` must face against `d` (dot(d,n) < 0). Returns null on total internal reflection.
 */
export function refract(d: Vec, n: Vec, n1: number, n2: number): Vec | null {
  const eta = n1 / n2;
  const cosI = -dot(d, n);
  const sin2T = eta * eta * (1 - cosI * cosI);
  if (sin2T > 1) return null;
  const cosT = Math.sqrt(1 - sin2T);
  return add(mul(d, eta), mul(n, eta * cosI - cosT));
}

export interface Hit {
  t: number;
  point: Vec;
  /** Surface normal facing the incoming ray (dot(dir, normal) < 0). */
  normal: Vec;
  /** For segments: signed offset along the segment tangent from its centre. */
  offset?: number;
  /** Which side of the segment we approached from (+1 = along its normal). */
  side?: number;
}

/** Ray vs segment (a-b). Returns null if no hit with t > eps. */
export function raySegment(o: Vec, d: Vec, a: Vec, b: Vec, eps = 1e-3): Hit | null {
  const e = sub(b, a);
  const denom = cross(d, e);
  if (Math.abs(denom) < 1e-9) return null;
  const ao = sub(a, o);
  const t = cross(ao, e) / denom;
  const u = cross(ao, d) / denom;
  if (t <= eps || u < 0 || u > 1) return null;
  let n = norm(perp(e));
  let side = 1;
  if (dot(n, d) > 0) { n = mul(n, -1); side = -1; }
  const point = add(o, mul(d, t));
  const half = len(e) * 0.5;
  return { t, point, normal: n, offset: (u - 0.5) * 2 * half, side };
}

/** Ray vs circle. Returns nearest hit with t > eps (entering or exiting). */
export function rayCircle(o: Vec, d: Vec, c: Vec, r: number, eps = 1e-3): Hit | null {
  const oc = sub(o, c);
  const b = dot(oc, d);
  const cc = dot(oc, oc) - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t <= eps) t = -b + s;
  if (t <= eps) return null;
  const point = add(o, mul(d, t));
  let n = norm(sub(point, c));
  if (dot(n, d) > 0) n = mul(n, -1);
  return { t, point, normal: n };
}

/** Ray vs axis-aligned rectangle (solid). */
export function rayRect(o: Vec, d: Vec, x: number, y: number, w: number, h: number, eps = 1e-3): Hit | null {
  let tmin = -Infinity, tmax = Infinity;
  let nx = 0, ny = 0;
  for (let axis = 0; axis < 2; axis++) {
    const oa = axis === 0 ? o.x : o.y;
    const da = axis === 0 ? d.x : d.y;
    const lo = axis === 0 ? x : y;
    const hi = axis === 0 ? x + w : y + h;
    if (Math.abs(da) < 1e-9) {
      if (oa < lo || oa > hi) return null;
      continue;
    }
    let t1 = (lo - oa) / da;
    let t2 = (hi - oa) / da;
    let n1 = -1, n2 = 1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; [n1, n2] = [n2, n1]; }
    if (t1 > tmin) {
      tmin = t1;
      nx = axis === 0 ? n1 : 0;
      ny = axis === 1 ? n1 : 0;
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (tmin <= eps) return null;
  return { t: tmin, point: add(o, mul(d, tmin)), normal: { x: nx, y: ny } };
}

/** Distance from point p to segment a-b. */
export function pointSegDist(p: Vec, a: Vec, b: Vec): number {
  const e = sub(b, a);
  const l2 = dot(e, e);
  if (l2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), e) / l2));
  return dist(p, add(a, mul(e, t)));
}

/** Does segment a-b pass within r of c? */
export function segHitsCircle(a: Vec, b: Vec, c: Vec, r: number): boolean {
  return pointSegDist(c, a, b) <= r;
}

export const TAU = Math.PI * 2;
export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export const normAngle = (a: number) => {
  a = a % TAU;
  if (a < 0) a += TAU;
  return a;
};
