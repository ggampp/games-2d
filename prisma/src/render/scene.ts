import type { BeamSegment, Level, Piece, Target, TraceResult, Vec } from '../core/types.ts';
import { BOARD, BORDER, DIM, prismVertices } from '../core/tracer.ts';
import { TAU, fromAngle } from '../core/geom.ts';

export interface RenderState {
  level: Level;
  pieces: Piece[];
  trace: TraceResult;
  selected: Piece | null;
  /** id -> 0..1 smoothed lit amount */
  lit: Map<string, number>;
  solvedGlow: number;
  ghost: { type: Piece['type']; x: number; y: number; angle: number } | null;
}

const COLORS = {
  red: { main: '#ff2f5a', glow: [255, 60, 90], gem1: '#ff8aa4', gem2: '#c20a38' },
  green: { main: '#33ef7a', glow: [60, 240, 130], gem1: '#a8ffd0', gem2: '#0f9e45' },
  blue: { main: '#3f86ff', glow: [70, 140, 255], gem1: '#9cc6ff', gem2: '#1747c9' },
  white: { main: '#ffd66b', glow: [255, 214, 120], gem1: '#fff6d8', gem2: '#8f7430' },
  any: { main: '#ffffff', glow: [255, 255, 255], gem1: '#ffffff', gem2: '#8c8c9c' }
} as const;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export class SceneRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private beamCanvas: HTMLCanvasElement;
  private beamCtx: CanvasRenderingContext2D;
  private brick: CanvasPattern | null = null;
  private noise: HTMLCanvasElement;
  private dust: HTMLCanvasElement | null = null;
  private px = 900;
  private scale = 1;
  private time = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.beamCanvas = document.createElement('canvas');
    this.beamCtx = this.beamCanvas.getContext('2d')!;
    this.noise = this.makeNoise();
    this.setSize(900);
  }

  setSize(px: number) {
    if (px === this.px && this.canvas.width === px) return;
    this.px = px;
    this.scale = px / BOARD;
    this.canvas.width = this.canvas.height = px;
    this.beamCanvas.width = this.beamCanvas.height = px;
    this.brick = this.makeBrickPattern();
    this.dust = this.makeDust();
  }

  private makeNoise(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const img = g.createImageData(256, 256);
    const rnd = mulberry(7);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 150 + rnd() * 105;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = v;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  private makeBrickPattern(): CanvasPattern | null {
    const bw = 26, bh = 13;
    const c = document.createElement('canvas');
    c.width = bw * 2; c.height = bh * 2;
    const g = c.getContext('2d')!;
    g.fillStyle = '#1b1e2a';
    g.fillRect(0, 0, c.width, c.height);
    const brick = (x: number, y: number) => {
      g.fillStyle = '#3d4459';
      g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      g.fillStyle = 'rgba(160,175,210,0.28)';
      g.fillRect(x + 1, y + 1, bw - 2, 1.2);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x + 1, y + bh - 2.2, bw - 2, 1.2);
    };
    brick(0, 0); brick(bw, 0);
    brick(-bw / 2, bh); brick(bw / 2, bh); brick(bw * 1.5, bh);
    const p = this.ctx.createPattern(c, 'repeat');
    return p;
  }

  private makeDust(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = this.px;
    const g = c.getContext('2d')!;
    g.scale(this.scale, this.scale);
    const rnd = mulberry(99);
    for (let i = 0; i < 900; i++) {
      const x = 40 + rnd() * 820, y = 40 + rnd() * 820;
      const a = 0.02 + rnd() * 0.06;
      g.fillStyle = `rgba(190,200,240,${a})`;
      g.fillRect(x, y, 1.2, 1.2);
    }
    return c;
  }

  render(state: RenderState, time: number) {
    this.time = time;
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    this.drawBackground(ctx);
    this.drawRivers(ctx, state.level);
    this.drawWalls(ctx, state.level);
    for (const sh of state.trace.shadows) this.drawEclipseShadow(ctx, sh.planet, sh.dir, sh.width);
    for (const bh of state.level.blackHoles ?? []) this.drawBlackHole(ctx, bh.x, bh.y, bh.horizon);
    for (const p of state.pieces) if (p.type === 'portal') this.drawPortal(ctx, p, state.trace.portalHits);

    this.drawBeams(state.trace.segments);
    ctx.globalCompositeOperation = 'lighter';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.beamCanvas, 0, 0);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    for (const pl of state.level.planets ?? []) this.drawEarth(ctx, pl.x, pl.y, pl.radius, state.trace);
    for (const e of state.level.emitters) e.kind === 'moon' ? this.drawMoon(ctx, e.x, e.y, e.angle) : this.drawSun(ctx, e.x, e.y);
    for (const t of state.level.targets) this.drawTarget(ctx, t, state.lit.get(t.id) ?? 0, state.solvedGlow);
    for (const p of state.pieces) if (p.type !== 'portal') this.drawPiece(ctx, p, 1);
    if (state.ghost) this.drawPiece(ctx, { id: 'ghost', type: state.ghost.type, x: state.ghost.x, y: state.ghost.y, angle: state.ghost.angle }, 0.55);
    if (state.selected) this.drawGizmo(ctx, state.selected);
    this.drawBorder(ctx);
  }

  // ------------------------------------------------------------------ background
  private drawBackground(ctx: CanvasRenderingContext2D) {
    const g = ctx.createRadialGradient(450, 450, 60, 450, 450, 700);
    g.addColorStop(0, '#0f1017');
    g.addColorStop(0.55, '#0a0b10');
    g.addColorStop(1, '#050507');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, BOARD, BOARD);
    if (this.dust) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.dust, 0, 0);
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    }
  }

  private drawBorder(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = this.brick ?? '#3a3f52';
    ctx.fillRect(0, 0, BOARD, BORDER);
    ctx.fillRect(0, BOARD - BORDER, BOARD, BORDER);
    ctx.fillRect(0, 0, BORDER, BOARD);
    ctx.fillRect(BOARD - BORDER, 0, BORDER, BOARD);
    // inner shading
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(BORDER - 1, BORDER - 1, BOARD - BORDER * 2 + 2, BOARD - BORDER * 2 + 2);
    ctx.strokeStyle = 'rgba(150,165,205,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(BORDER - 3, BORDER - 3, BOARD - BORDER * 2 + 6, BOARD - BORDER * 2 + 6);
    // outer vignette to black
    const g = ctx.createLinearGradient(0, 0, 0, 14);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, BOARD, 14);
    ctx.restore();
  }

  private drawWalls(ctx: CanvasRenderingContext2D, level: Level) {
    ctx.save();
    for (const w of level.walls ?? []) {
      ctx.fillStyle = this.brick ?? '#3a3f52';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(170,185,225,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
    }
    ctx.restore();
  }

  private drawRivers(ctx: CanvasRenderingContext2D, level: Level) {
    const t = this.time;
    for (const r of level.rivers ?? []) {
      ctx.save();
      const wave = (x: number, phase: number) => Math.sin(x * 0.045 + t * 1.3 + phase) * 3 + Math.sin(x * 0.11 - t * 0.8 + phase) * 1.5;
      ctx.beginPath();
      for (let x = BORDER; x <= BOARD - BORDER; x += 8) ctx.lineTo(x, r.y0 + wave(x, 0));
      for (let x = BOARD - BORDER; x >= BORDER; x -= 8) ctx.lineTo(x, r.y1 + wave(x, 2.1));
      ctx.closePath();
      const g = ctx.createLinearGradient(0, r.y0, 0, r.y1);
      g.addColorStop(0, 'rgba(90,150,255,0.30)');
      g.addColorStop(0.5, 'rgba(50,110,230,0.18)');
      g.addColorStop(1, 'rgba(80,140,255,0.28)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(170,210,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // flow lines
      ctx.strokeStyle = 'rgba(150,200,255,0.12)';
      for (let k = 1; k < 4; k++) {
        const y = r.y0 + ((r.y1 - r.y0) * k) / 4;
        ctx.beginPath();
        for (let x = BORDER; x <= BOARD - BORDER; x += 10) ctx.lineTo(x, y + Math.sin(x * 0.06 + t * 1.6 + k) * 2.5);
        ctx.stroke();
      }
      // sparkles
      const rnd = mulberry(31);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        const x = BORDER + rnd() * (BOARD - BORDER * 2);
        const y = r.y0 + 6 + rnd() * (r.y1 - r.y0 - 12);
        const ph = rnd() * TAU;
        const a = Math.max(0, Math.sin(t * 2.2 + ph)) ** 6;
        if (a < 0.05) continue;
        ctx.globalAlpha = a * 0.8;
        ctx.fillRect(x - 1, y - 0.5, 2, 1);
        ctx.fillRect(x - 0.5, y - 1, 1, 2);
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ cosmic objects
  private drawBlackHole(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
    const t = this.time;
    ctx.save();
    ctx.translate(x, y);
    // ambient glow
    let g = ctx.createRadialGradient(0, 0, h * 0.5, 0, 0, h * 5);
    g.addColorStop(0, 'rgba(255,250,235,0.9)');
    g.addColorStop(0.25, 'rgba(255,235,200,0.35)');
    g.addColorStop(0.6, 'rgba(230,200,150,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, h * 5, 0, TAU); ctx.fill();

    // swirling arms
    ctx.globalCompositeOperation = 'lighter';
    for (let arm = 0; arm < 4; arm++) {
      const base = t * 0.9 + (arm * TAU) / 4;
      ctx.beginPath();
      for (let a = 0; a < 7; a += 0.12) {
        const rr = h * 0.9 + a * h * 0.42;
        const th = base + a * 1.15;
        const px = Math.cos(th) * rr, py = Math.sin(th) * rr * 0.62;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(255,248,230,0.35)';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // equatorial flare + thin dark ring
    ctx.save();
    ctx.rotate(-0.2);
    g = ctx.createLinearGradient(-h * 5.5, 0, h * 5.5, 0);
    g.addColorStop(0, 'rgba(255,200,130,0)');
    g.addColorStop(0.5, 'rgba(255,240,215,0.85)');
    g.addColorStop(1, 'rgba(255,200,130,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-h * 5.5, -3, h * 11, 6);
    ctx.strokeStyle = 'rgba(30,18,8,0.85)';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(0, 0, h * 2.6, h * 0.5, 0, 0, TAU); ctx.stroke();
    ctx.restore();

    // bright core
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 1.6);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, 'rgba(255,252,240,0.95)');
    g.addColorStop(1, 'rgba(255,245,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, h * 1.6, 0, TAU); ctx.fill();
    // singularity
    ctx.fillStyle = '#05040a';
    ctx.beginPath(); ctx.arc(0, 0, h * 0.32, 0, TAU); ctx.fill();
    ctx.restore();
  }

  private drawEarth(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, trace: TraceResult) {
    ctx.save();
    ctx.translate(x, y);
    // atmosphere
    let g = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.35);
    g.addColorStop(0, 'rgba(120,170,255,0.35)');
    g.addColorStop(1, 'rgba(120,170,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.35, 0, TAU); ctx.fill();
    // ocean
    g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#5aa4ff');
    g.addColorStop(0.7, '#1d55c8');
    g.addColorStop(1, '#0b2560');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    // continents
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    const rnd = mulberry(1234);
    ctx.fillStyle = '#4fae5c';
    for (let i = 0; i < 9; i++) {
      const cx = (rnd() - 0.5) * r * 1.6, cy = (rnd() - 0.5) * r * 1.6;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        const rr = r * (0.18 + rnd() * 0.22);
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.92, r * 0.5, r * 0.18, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, r * 0.92, r * 0.45, r * 0.16, 0, 0, TAU); ctx.fill();
    // terminator shading
    g = ctx.createLinearGradient(-r, 0, r, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,10,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    // lit rim on the side facing an incoming beam
    for (const sh of trace.shadows) {
      if (sh.planet.x !== x || sh.planet.y !== y) continue;
      const a = Math.atan2(-sh.dir.y, -sh.dir.x);
      ctx.strokeStyle = 'rgba(255,190,120,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, r + 1, a - 1.2, a + 1.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, r + 1, a - 0.7, a + 0.7); ctx.stroke();
    }
    ctx.restore();
  }

  private drawEclipseShadow(ctx: CanvasRenderingContext2D, pl: { x: number; y: number; radius: number }, dir: Vec, width: number) {
    const len = 520;
    const n = { x: -dir.y, y: dir.x };
    const w0 = pl.radius + 2, w1 = pl.radius * 1.15 + width * 0.6;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pl.x + n.x * w0, pl.y + n.y * w0);
    ctx.lineTo(pl.x + dir.x * len + n.x * w1, pl.y + dir.y * len + n.y * w1);
    ctx.lineTo(pl.x + dir.x * len - n.x * w1, pl.y + dir.y * len - n.y * w1);
    ctx.lineTo(pl.x - n.x * w0, pl.y - n.y * w0);
    ctx.closePath();
    const g = ctx.createLinearGradient(pl.x, pl.y, pl.x + dir.x * len, pl.y + dir.y * len);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fill();
    // reddish atmospheric rim along the cone edges
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [1, -1]) {
      const gg = ctx.createLinearGradient(pl.x, pl.y, pl.x + dir.x * len * 0.35, pl.y + dir.y * len * 0.35);
      gg.addColorStop(0, 'rgba(255,110,60,0.5)');
      gg.addColorStop(1, 'rgba(255,90,50,0)');
      ctx.strokeStyle = gg;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pl.x + n.x * w0 * s, pl.y + n.y * w0 * s);
      ctx.lineTo(pl.x + dir.x * len * 0.35 + n.x * (w0 + (w1 - w0) * 0.35) * s, pl.y + dir.y * len * 0.35 + n.y * (w0 + (w1 - w0) * 0.35) * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPortal(ctx: CanvasRenderingContext2D, p: Piece, hits: Vec[]) {
    const t = this.time;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const L = DIM.portal, th = 9;
    const pulse = 0.75 + 0.25 * Math.sin(t * 3 + p.x * 0.01);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 4; i >= 1; i--) {
      ctx.fillStyle = `rgba(120,90,255,${0.06 * pulse})`;
      ctx.beginPath();
      ctx.roundRect(-L / 2 - i * 4, -th / 2 - i * 4, L + i * 8, th + i * 8, 6);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
    g.addColorStop(0, '#6a4cff');
    g.addColorStop(0.5, '#c7b8ff');
    g.addColorStop(1, '#4ad8ff');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(-L / 2, -th / 2, L, th, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-L / 2 + 4, -1, L - 8, 2);
    ctx.restore();
    // sparkle when a beam is passing through
    for (const h of hits) {
      if (Math.hypot(h.x - p.x, h.y - p.y) > L) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g2 = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 22);
      g2.addColorStop(0, 'rgba(255,255,255,0.8)');
      g2.addColorStop(1, 'rgba(160,120,255,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(h.x, h.y, 22, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ light
  private drawBeams(segments: BeamSegment[]) {
    const b = this.beamCtx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, this.px, this.px);
    b.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    b.globalCompositeOperation = 'lighter';
    b.lineJoin = 'round';
    for (const s of segments) this.drawRibbon(b, s);
    // grain inside the light
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'destination-in';
    const pat = b.createPattern(this.noise, 'repeat')!;
    const m = new DOMMatrix().translate((this.time * 37) % 256, (this.time * 23) % 256);
    pat.setTransform(m);
    b.fillStyle = pat;
    b.fillRect(0, 0, this.px, this.px);
    b.globalCompositeOperation = 'lighter';
  }

  private drawRibbon(b: CanvasRenderingContext2D, s: BeamSegment) {
    const pts = s.pts;
    if (pts.length < 2) return;
    // arc lengths
    const cum: number[] = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = cum[cum.length - 1] || 1;
    const normals: Vec[] = pts.map((_, i) => {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
      const dx = c.x - a.x, dy = c.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      return { x: -dy / l, y: dx / l };
    });
    const width = (i: number) => Math.max(2.5, s.w0 + (s.w1 - s.w0) * (cum[i] / total));
    const narrow = s.band.hi - s.band.lo < 60;
    const boost = narrow ? 1.7 : 1;
    const inten = Math.min(1, s.intensity * boost);
    const [r, g, bl] = s.rgb.map((v) => Math.round(v * 255));
    const water = s.medium === 'water';
    const glass = s.medium === 'glass';
    const passes: [number, number, string][] = [
      [1.55, 0.07 * inten, `rgba(${r},${g},${bl},1)`],
      [1.0, 0.24 * inten, `rgba(${r},${g},${bl},1)`],
      [0.5, 0.30 * inten, `rgba(${Math.round(r * 0.6 + 102)},${Math.round(g * 0.6 + 102)},${Math.round(bl * 0.6 + 102)},1)`]
    ];
    if (glass || narrow) passes.splice(0, 1);
    for (const [k, alpha, color] of passes) {
      b.globalAlpha = alpha * (glass ? 0.55 : 1);
      b.fillStyle = color;
      b.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const w = (width(i) * k) / 2;
        b.lineTo(pts[i].x + normals[i].x * w, pts[i].y + normals[i].y * w);
      }
      for (let i = pts.length - 1; i >= 0; i--) {
        const w = (width(i) * k) / 2;
        b.lineTo(pts[i].x - normals[i].x * w, pts[i].y - normals[i].y * w);
      }
      b.closePath();
      b.fill();
    }
    if (water) this.drawCaustics(b, s, cum, normals, total);
    b.globalAlpha = 1;
  }

  private drawCaustics(b: CanvasRenderingContext2D, s: BeamSegment, cum: number[], normals: Vec[], total: number) {
    const t = this.time;
    const pts = s.pts;
    b.globalAlpha = 0.55;
    b.strokeStyle = 'rgba(200,235,255,1)';
    b.lineWidth = 1.2;
    for (let k = -1; k <= 1; k++) {
      b.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const w = Math.max(3, s.w0 + (s.w1 - s.w0) * (cum[i] / total));
        const off = k * w * 0.28 + Math.sin(cum[i] * 0.25 + t * 6 + k) * w * 0.12;
        b.lineTo(pts[i].x + normals[i].x * off, pts[i].y + normals[i].y * off);
      }
      b.stroke();
    }
    // interpolate along straight water segments for a little wave shimmer
    if (pts.length === 2) {
      const a = pts[0], c = pts[1];
      b.beginPath();
      for (let u = 0; u <= 1; u += 0.05) {
        const off = Math.sin(u * 14 + t * 5) * s.w0 * 0.2;
        b.lineTo(a.x + (c.x - a.x) * u + normals[0].x * off, a.y + (c.y - a.y) * u + normals[0].y * off);
      }
      b.stroke();
    }
  }

  // ------------------------------------------------------------------ emitters
  private drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 78);
    g.addColorStop(0, 'rgba(255,240,190,0.7)');
    g.addColorStop(0.4, 'rgba(255,205,110,0.28)');
    g.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 78, 0, TAU); ctx.fill();
    ctx.rotate(angle);
    // full gold disc then dark disc offset backwards -> crescent facing the beam
    const r = 30;
    const gg = ctx.createRadialGradient(6, -4, 2, 0, 0, r);
    gg.addColorStop(0, '#fff8dc');
    gg.addColorStop(0.5, '#ffd97a');
    gg.addColorStop(1, '#f2b043');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3c4153';
    ctx.beginPath(); ctx.arc(-11, 0, r - 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, r, -1.1, 1.1); ctx.stroke();
    ctx.restore();
  }

  private drawSun(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const t = this.time;
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 90);
    g.addColorStop(0, 'rgba(255,245,200,0.75)');
    g.addColorStop(0.4, 'rgba(255,210,120,0.3)');
    g.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 90, 0, TAU); ctx.fill();
    ctx.rotate(t * 0.15);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rr = i % 2 === 0 ? 32 : 15;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    const gg = ctx.createRadialGradient(0, 0, 2, 0, 0, 32);
    gg.addColorStop(0, '#ffffff');
    gg.addColorStop(0.35, '#ffe9a8');
    gg.addColorStop(1, '#f0a83a');
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ targets
  private drawTarget(ctx: CanvasRenderingContext2D, t: Target, lit: number, solvedGlow: number) {
    const c = COLORS[t.color];
    const glow = Math.min(1, lit + solvedGlow * 0.5);
    ctx.save();
    ctx.translate(t.x, t.y);
    const ringR = t.radius * (1.35 + 0.08 * Math.sin(this.time * 3 + t.x));
    const g = ctx.createRadialGradient(0, 0, t.radius * 0.6, 0, 0, ringR * (1 + glow * 0.4));
    g.addColorStop(0, rgba(c.glow, 0.10 + 0.5 * glow));
    g.addColorStop(0.55, rgba(c.glow, 0.06 + 0.3 * glow));
    g.addColorStop(1, rgba(c.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, ringR * (1 + glow * 0.4), 0, TAU); ctx.fill();
    // coloured halo ring (always visible, brighter when lit)
    ctx.strokeStyle = rgba(c.glow, 0.35 + 0.6 * glow);
    ctx.lineWidth = 2 + 2 * glow;
    ctx.beginPath(); ctx.arc(0, 0, t.radius + 6, 0, TAU); ctx.stroke();

    if (t.kind === 'planet') this.drawPlanet(ctx, t, lit);
    else if (t.kind === 'flower') this.drawFlower(ctx, t, lit);
    else this.drawFlag(ctx, t, lit);
    ctx.restore();
  }

  private drawPlanet(ctx: CanvasRenderingContext2D, t: Target, lit: number) {
    const r = t.radius;
    const c = COLORS[t.color];
    // gear ring
    ctx.beginPath();
    const teeth = 15;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i * Math.PI) / teeth;
      const d = i % 2 === 0 ? r : r - 4;
      ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fillStyle = t.color === 'white' && lit < 0.5 ? '#7d7f8b' : '#cfa845';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#171923';
    ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, TAU); ctx.fill();
    // core
    const gr = r - 9;
    if (t.color === 'white') {
      const g = ctx.createRadialGradient(-gr * 0.35, -gr * 0.35, 1, 0, 0, gr);
      if (lit > 0.5) { g.addColorStop(0, '#fffbe6'); g.addColorStop(0.5, '#ffd76e'); g.addColorStop(1, '#9a7a2a'); }
      else { g.addColorStop(0, '#d5d8e6'); g.addColorStop(0.5, '#8d92a6'); g.addColorStop(1, '#3f4352'); }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, gr, 0, TAU); ctx.fill();
      ctx.fillStyle = lit > 0.5 ? 'rgba(120,80,10,0.25)' : 'rgba(20,22,30,0.35)';
      for (const [cx, cy, cr] of [[-0.3, -0.2, 0.2], [0.25, 0.3, 0.15], [-0.25, 0.4, 0.12], [0.35, -0.3, 0.1]]) {
        ctx.beginPath(); ctx.arc(cx * gr, cy * gr, cr * gr, 0, TAU); ctx.fill();
      }
    } else {
      const g = ctx.createRadialGradient(-gr * 0.35, -gr * 0.35, 1, 0, 0, gr);
      g.addColorStop(0, lit > 0.2 ? '#ffffff' : c.gem1);
      g.addColorStop(0.35, c.gem1);
      g.addColorStop(0.85, c.gem2);
      g.addColorStop(1, '#0e0a14');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, gr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.ellipse(-gr * 0.35, -gr * 0.38, gr * 0.28, gr * 0.16, -0.8, 0, TAU); ctx.fill();
    }
  }

  private drawFlower(ctx: CanvasRenderingContext2D, t: Target, lit: number) {
    const c = COLORS[t.color];
    const r = t.radius;
    // pot
    ctx.fillStyle = '#b8563a';
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, r * 0.05);
    ctx.lineTo(r * 0.62, r * 0.05);
    ctx.lineTo(r * 0.45, r * 0.95);
    ctx.lineTo(-r * 0.45, r * 0.95);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9754f';
    ctx.fillRect(-r * 0.7, -r * 0.12, r * 1.4, r * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(r * 0.15, r * 0.1, r * 0.3, r * 0.8);
    // soil + stem
    ctx.fillStyle = '#3b2a1f';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 0.55, r * 0.12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3ea34a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.12); ctx.quadraticCurveTo(r * 0.1, -r * 0.5, 0, -r * 0.78); ctx.stroke();
    ctx.fillStyle = '#4cbf58';
    ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.42, r * 0.22, r * 0.09, -0.5, 0, TAU); ctx.fill();
    // bloom
    const open = 0.7 + 0.45 * lit;
    ctx.save();
    ctx.translate(0, -r * 0.82);
    ctx.scale(open, open);
    const petal = t.color === 'white' ? '#fbfbff' : c.main;
    const petals = t.color === 'white' ? 8 : 5;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU + this.time * 0.1 * lit;
      ctx.fillStyle = petal;
      ctx.globalAlpha = 0.85 + 0.15 * lit;
      ctx.beginPath();
      if (t.color === 'white') ctx.ellipse(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32, r * 0.24, r * 0.1, a, 0, TAU);
      else ctx.arc(Math.cos(a) * r * 0.26, Math.sin(a) * r * 0.26, r * 0.2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.color === 'white' ? '#ffcf3a' : '#2a1a2e';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
    if (lit > 0.3) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.05, r * 0.06, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  private drawFlag(ctx: CanvasRenderingContext2D, t: Target, lit: number) {
    const r = t.radius;
    ctx.strokeStyle = lit > 0.3 ? '#fff3c4' : '#c9c9d6';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#e8e8f2';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-2, r * 0.5); ctx.lineTo(-2, -r * 0.75); ctx.stroke();
    ctx.fillStyle = lit > 0.3 ? '#ffd45c' : '#ff5a6e';
    ctx.beginPath(); ctx.moveTo(-1, -r * 0.75); ctx.lineTo(r * 0.55, -r * 0.5); ctx.lineTo(-1, -r * 0.25); ctx.closePath(); ctx.fill();
  }

  // ------------------------------------------------------------------ pieces
  private drawPiece(ctx: CanvasRenderingContext2D, p: Piece, alpha: number) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    switch (p.type) {
      case 'mirror': {
        ctx.rotate(p.angle);
        const L = DIM.mirror;
        ctx.fillStyle = '#9aa3b8';
        ctx.beginPath(); ctx.roundRect(-L / 2, -2, L, 5, 2); ctx.fill();
        ctx.fillStyle = '#f7f8ff';
        ctx.beginPath(); ctx.roundRect(-L / 2, -3, L, 3.5, 2); ctx.fill();
        break;
      }
      case 'dichroic': {
        ctx.rotate(p.angle);
        const L = DIM.dichroic;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,60,120,0.35)'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(-L / 2, -2); ctx.lineTo(L / 2, -2); ctx.stroke();
        ctx.strokeStyle = 'rgba(60,255,160,0.3)';
        ctx.beginPath(); ctx.moveTo(-L / 2, 2); ctx.lineTo(L / 2, 2); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ff3d7a'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-L / 2, -1.5); ctx.lineTo(L / 2, -1.5); ctx.stroke();
        ctx.strokeStyle = '#4dffb0';
        ctx.beginPath(); ctx.moveTo(-L / 2, 1.5); ctx.lineTo(L / 2, 1.5); ctx.stroke();
        break;
      }
      case 'filter': {
        ctx.rotate(p.angle);
        const L = DIM.filter;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(60,255,130,0.35)'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(L / 2, 0); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#3dff86'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(L / 2, 0); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-L / 2 + 3, -0.5); ctx.lineTo(L / 2 - 3, -0.5); ctx.stroke();
        break;
      }
      case 'lens': {
        ctx.rotate(p.angle);
        const L = DIM.lens, th = 16;
        ctx.beginPath();
        ctx.moveTo(-L / 2, 0);
        ctx.quadraticCurveTo(0, -th, L / 2, 0);
        ctx.quadraticCurveTo(0, th, -L / 2, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(150,200,255,0.16)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-L / 2 + 8, -2); ctx.quadraticCurveTo(0, -th * 0.55, L / 2 - 8, -2); ctx.stroke();
        break;
      }
      case 'prism': {
        const vs = prismVertices(p);
        ctx.translate(-p.x, -p.y);
        ctx.beginPath();
        vs.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
        ctx.closePath();
        const g = ctx.createLinearGradient(vs[0].x, vs[0].y, vs[2].x, vs[2].y);
        g.addColorStop(0, 'rgba(255,255,255,0.22)');
        g.addColorStop(1, 'rgba(180,210,255,0.06)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vs[0].x * 0.7 + p.x * 0.3, vs[0].y * 0.7 + p.y * 0.3);
        ctx.lineTo(vs[1].x * 0.7 + p.x * 0.3, vs[1].y * 0.7 + p.y * 0.3);
        ctx.stroke();
        break;
      }
      case 'orb': {
        const r = DIM.orbR;
        const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 2, 0, 0, r);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(0.5, 'rgba(190,215,255,0.12)');
        g.addColorStop(1, 'rgba(120,170,255,0.2)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, r - 4, 0.6, 2.2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.42, r * 0.22, r * 0.12, -0.7, 0, TAU); ctx.fill();
        break;
      }
      case 'portal':
        break;
    }
    if (p.fixed && alpha === 1) {
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(150,165,205,0.55)';
      ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  private drawGizmo(ctx: CanvasRenderingContext2D, p: Piece) {
    const R = 52;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = '#ff9f2e';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      const l = i % 9 === 0 ? 8 : i % 3 === 0 ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (R - l), Math.sin(a) * (R - l));
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.stroke();
    }
    // knob at current angle
    const k = fromAngle(p.angle);
    ctx.fillStyle = '#ff9f2e';
    ctx.beginPath(); ctx.arc(k.x * R, k.y * R, 6.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.stroke();
    // readout
    const deg = (((p.angle * 180) / Math.PI) % 360 + 360) % 360;
    ctx.fillStyle = '#ff9f2e';
    ctx.font = '11px "Space Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${deg.toFixed(1)}°`, 0, -R - 10);
    ctx.restore();
  }
}
