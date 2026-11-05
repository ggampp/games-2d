// Tabuleiro em SVG: laje de cimento com sulcos, peças (tomate e karela),
// destaques e animações. Não conhece as regras: recebe índices de casas.

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

const DEFS = `
<radialGradient id="g-tomato" cx="38%" cy="34%" r="70%">
  <stop offset="0" stop-color="#ff8a66"/><stop offset=".45" stop-color="#f0401f"/>
  <stop offset="1" stop-color="#a8160a"/>
</radialGradient>
<linearGradient id="g-karela" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#9bd16a"/><stop offset=".5" stop-color="#4f9a2e"/>
  <stop offset="1" stop-color="#2c6418"/>
</linearGradient>
<radialGradient id="g-rock" cx="40%" cy="35%" r="70%">
  <stop offset="0" stop-color="#b9b4ab"/><stop offset="1" stop-color="#6c675f"/>
</radialGradient>
<radialGradient id="g-shadow"><stop offset="0" stop-color="#000" stop-opacity=".38"/>
  <stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<filter id="f-noise" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="7" result="n"/>
  <feColorMatrix type="matrix" values="0 0 0 0 .35  0 0 0 0 .32  0 0 0 0 .28  0 0 0 .55 0"/>
  <feComposite in2="SourceGraphic" operator="in"/>
</filter>
<filter id="f-blotch" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="3"/>
  <feColorMatrix type="matrix" values="0 0 0 0 .45  0 0 0 0 .4  0 0 0 0 .33  0 0 0 .35 0"/>
  <feComposite in2="SourceGraphic" operator="in"/>
</filter>
<filter id="f-glow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="5"/>
</filter>`;

function tomato(g) {
  el('ellipse', { cx: 3, cy: 22, rx: 26, ry: 9, fill: 'url(#g-shadow)' }, g);
  el('circle', { r: 26, fill: 'url(#g-tomato)', stroke: '#7a1006', 'stroke-width': 1.2 }, g);
  el('ellipse', { cx: -9, cy: -10, rx: 8, ry: 5, fill: '#fff', opacity: 0.35, transform: 'rotate(-30)' }, g);
  el('path', {
    d: 'M0-14 L4-6 L12-9 L6-3 L13 2 L4 0 L0 7 L-4 0 L-13 2 L-6-3 L-12-9 L-4-6Z',
    fill: '#3f7d22',
    stroke: '#24501a',
    'stroke-width': 0.8,
    transform: 'translate(0 -10) scale(.75)',
  }, g);
  el('circle', { cy: -10, r: 2.4, fill: '#2f5f1a' }, g);
}

function karela(g, seed) {
  const rot = ((seed * 37) % 50) - 25;
  const inner = el('g', { transform: `rotate(${rot})` }, g);
  el('ellipse', { cx: 3, cy: 16, rx: 34, ry: 9, fill: 'url(#g-shadow)' }, inner);
  el('path', {
    d: 'M-36 0 C-24-17 18-19 36-2 C20 16-22 17-36 0Z',
    fill: 'url(#g-karela)',
    stroke: '#24501a',
    'stroke-width': 1.2,
  }, inner);
  const bumps = [[-22, -4], [-12, -8], [-2, -9], [8, -8], [18, -5], [-16, 3], [-5, 2], [6, 2], [16, 3], [-8, 9], [4, 9]];
  for (const [x, y] of bumps) el('circle', { cx: x, cy: y, r: 2.6, fill: '#b8e48a', opacity: 0.55 }, inner);
  el('path', { d: 'M36-2 q6-3 8-9', stroke: '#5c7d2a', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }, inner);
}

function rock(g) {
  el('ellipse', { cx: 3, cy: 18, rx: 28, ry: 9, fill: 'url(#g-shadow)' }, g);
  el('path', {
    d: 'M-26 6 C-28-10-14-24 2-22 C18-22 29-10 27 4 C26 18 10 22-4 21 C-18 20-25 16-26 6Z',
    fill: 'url(#g-rock)',
    stroke: '#4a463f',
    'stroke-width': 1.2,
  }, g);
  el('path', { d: 'M-12-8 q8-6 18-2', stroke: '#e0dbd2', 'stroke-width': 2, fill: 'none', opacity: 0.6 }, g);
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const frame = () => new Promise((r) => requestAnimationFrame(r));

export class BoardView {
  constructor(svg, { onNodeClick }) {
    this.svg = svg;
    this.onNodeClick = onNodeClick;
    this.portrait = false;
    this.pieceEls = new Map(); // nó → { g, id }
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  pt(i) {
    const n = this.map.nodes[i];
    return this.tf(n.x, n.y);
  }

  tf(x, y) {
    return this.portrait ? [this.map.def.height - y, x] : [x, y];
  }

  /** Monta laje, sulcos e alvos de clique. */
  setMap(map, portrait = false) {
    this.map = map;
    this.portrait = portrait;
    const { width: W, height: H } = map.def;
    const [vw, vh] = portrait ? [H, W] : [W, H];
    const svg = this.svg;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    const defs = el('defs', {}, svg);
    defs.innerHTML = DEFS;

    el('rect', { x: 0, y: 0, width: vw, height: vh, rx: 28, fill: '#cbc3b4' }, svg);
    el('rect', { x: 0, y: 0, width: vw, height: vh, rx: 28, fill: '#fff', filter: 'url(#f-blotch)' }, svg);
    el('rect', { x: 0, y: 0, width: vw, height: vh, rx: 28, fill: '#fff', filter: 'url(#f-noise)', opacity: 0.6 }, svg);

    const grooves = el('g', { class: 'grooves', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    for (const p of map.paths) {
      const d = this.pathD(p);
      el('path', { d, stroke: '#e9e3d8', 'stroke-width': 22, opacity: 0.55, transform: 'translate(1.5 2.5)' }, grooves);
      el('path', { d, stroke: '#26282d', 'stroke-width': 15 }, grooves);
      el('path', { d, stroke: '#4a4d55', 'stroke-width': 5, opacity: 0.55, transform: 'translate(-1 -1.5)' }, grooves);
    }
    const dots = el('g', { class: 'dots' }, svg);
    map.nodes.forEach((_, i) => {
      const [x, y] = this.pt(i);
      el('circle', { cx: x, cy: y, r: 10, fill: '#1d1f23' }, dots);
    });

    this.lastLayer = el('g', { class: 'last-move' }, svg);
    this.hlLayer = el('g', { class: 'highlights' }, svg);
    this.rockLayer = el('g', { class: 'rocks' }, svg);
    this.pieceLayer = el('g', { class: 'pieces' }, svg);
    this.fxLayer = el('g', { class: 'fx', 'pointer-events': 'none' }, svg);
    this.hitLayer = el('g', { class: 'hits' }, svg);
    this.hits = map.nodes.map((n, i) => {
      const [x, y] = this.pt(i);
      const c = el('circle', { cx: x, cy: y, r: 38, class: 'hit', tabindex: -1, role: 'button' }, this.hitLayer);
      c.dataset.node = i;
      c.addEventListener('click', () => this.onNodeClick(i));
      c.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.onNodeClick(i);
        }
      });
      return c;
    });
    this.pieceEls.clear();
  }

  pathD(p) {
    const pts = p.idx.map((i) => this.pt(i));
    if (p.closed) pts.push(pts[0]);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    if (p.kind !== 'arc') {
      for (const [x, y] of pts.slice(1)) d += ` L${x} ${y}`;
      return d;
    }
    const [cx, cy] = this.tf(p.cx, p.cy);
    for (let k = 1; k < pts.length; k++) {
      const [x1, y1] = pts[k - 1];
      const [x2, y2] = pts[k];
      const cross = (x1 - cx) * (y2 - cy) - (y1 - cy) * (x2 - cx);
      d += ` A${p.r} ${p.r} 0 0 ${cross > 0 ? 1 : 0} ${x2} ${y2}`;
    }
    return d;
  }

  /** Recria todas as peças a partir do tabuleiro (sem animação). */
  setPieces(board) {
    this.pieceLayer.innerHTML = '';
    this.rockLayer.innerHTML = '';
    this.pieceEls.clear();
    let seq = 0;
    board.forEach((v, i) => {
      if (v === 3) {
        const g = el('g', { transform: `translate(${this.pt(i).join(' ')})` }, this.rockLayer);
        rock(g);
      } else if (v === 1 || v === 2) {
        this.pieceEls.set(i, this.makePiece(v, i, seq++));
      }
    });
    this.updateLabels(board);
  }

  makePiece(player, i, seed) {
    const [x, y] = this.pt(i);
    const g = el('g', { class: `piece p${player}`, transform: `translate(${x} ${y})` }, this.pieceLayer);
    const body = el('g', { class: 'body' }, g);
    if (player === 1) tomato(body);
    else karela(body, seed + i);
    return { g, body };
  }

  updateLabels(board) {
    const names = { 0: 'vazia', 1: 'tomate', 2: 'karela', 3: 'pedra' };
    this.hits.forEach((h, i) => h.setAttribute('aria-label', `Casa ${i + 1}: ${names[board[i]]}`));
  }

  /** Destaques: peças selecionáveis, peça escolhida, destinos, dica. */
  highlight({ selectable = [], selected = null, targets = [], hint = null } = {}) {
    const L = this.hlLayer;
    L.innerHTML = '';
    for (const i of selectable) {
      const [x, y] = this.pt(i);
      el('circle', { cx: x, cy: y, r: 33, class: 'hl-selectable' }, L);
    }
    if (selected != null) {
      const [x, y] = this.pt(selected);
      el('circle', { cx: x, cy: y, r: 36, class: 'hl-selected-glow', filter: 'url(#f-glow)' }, L);
      el('circle', { cx: x, cy: y, r: 35, class: 'hl-selected' }, L);
    }
    for (const t of targets) {
      const [x, y] = this.pt(t.node);
      el('circle', { cx: x, cy: y, r: t.capture ? 24 : 18, class: t.capture ? 'hl-target capture' : 'hl-target' }, L);
    }
    if (hint) {
      const pts = [hint.from, ...hint.steps].map((i) => this.pt(i));
      el('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'hl-hint' }, L);
      for (const p of pts.slice(1)) el('circle', { cx: p[0], cy: p[1], r: 20, class: 'hl-hint-dot' }, L);
    }
    // Só casas acionáveis entram na ordem de Tab.
    const act = new Set([...selectable, ...targets.map((t) => t.node)]);
    if (selected != null) act.add(selected);
    this.hits.forEach((h, i) => h.setAttribute('tabindex', act.has(i) ? 0 : -1));
  }

  showLast(move) {
    this.lastLayer.innerHTML = '';
    if (!move || move.pass) return;
    const pts = [move.from, ...move.steps].map((i) => this.pt(i));
    el('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'last-trail' }, this.lastLayer);
    el('circle', { cx: pts[0][0], cy: pts[0][1], r: 14, class: 'last-from' }, this.lastLayer);
  }

  /** Anima um trecho (de → para), removendo a peça capturada no meio. */
  async animateStep(from, to, captured) {
    const piece = this.pieceEls.get(from);
    if (!piece) return;
    this.pieceEls.delete(from);
    this.pieceEls.set(to, piece);
    this.pieceLayer.appendChild(piece.g);
    const [x0, y0] = this.pt(from);
    const [x1, y1] = this.pt(to);
    const jump = captured != null;
    const dur = this.reducedMotion ? 1 : jump ? 380 : 260;
    const t0 = performance.now();
    let capturedDone = false;
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = easeInOut(t);
      const lift = jump ? Math.sin(Math.PI * t) * 1 : Math.sin(Math.PI * t) * 0.25;
      const s = 1 + lift * 0.28;
      piece.g.setAttribute('transform', `translate(${x0 + (x1 - x0) * e} ${y0 + (y1 - y0) * e - lift * 26}) scale(${s})`);
      if (jump && !capturedDone && t >= 0.5) {
        capturedDone = true;
        this.removeCaptured(captured);
      }
      if (t >= 1) break;
      await frame();
    }
    piece.g.setAttribute('transform', `translate(${x1} ${y1})`);
  }

  removeCaptured(i) {
    const victim = this.pieceEls.get(i);
    if (!victim) return;
    this.pieceEls.delete(i);
    victim.g.classList.add('captured');
    const [x, y] = this.pt(i);
    const burst = el('g', { transform: `translate(${x} ${y})`, class: 'burst' }, this.fxLayer);
    const color = victim.g.classList.contains('p1') ? '#f0401f' : '#5ea83a';
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      el('circle', { r: 5, fill: color, style: `--dx:${Math.cos(a) * 46}px;--dy:${Math.sin(a) * 46}px` }, burst);
    }
    setTimeout(() => {
      victim.g.remove();
      burst.remove();
    }, 600);
  }

  async animateMove(move) {
    let at = move.from;
    for (let k = 0; k < move.steps.length; k++) {
      await this.animateStep(at, move.steps[k], move.caps[k] ?? null);
      at = move.steps[k];
    }
  }

  pulse(i) {
    const p = this.pieceEls.get(i);
    if (!p) return;
    p.g.classList.remove('nudge');
    void p.g.getBBox();
    p.g.classList.add('nudge');
  }
}

/** Miniatura estática do mapa (para os cartões de seleção). */
export function mapThumbnail(map, start) {
  const svg = el('svg', { viewBox: `0 0 ${map.def.width} ${map.def.height}`, class: 'thumb', 'aria-hidden': 'true' });
  el('rect', { width: map.def.width, height: map.def.height, rx: 36, fill: 'var(--slab)' }, svg);
  const v = Object.create(BoardView.prototype);
  v.map = map;
  v.portrait = false;
  const g = el('g', { fill: 'none', stroke: 'var(--groove)', 'stroke-width': 16, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
  for (const p of map.paths) el('path', { d: v.pathD(p) }, g);
  const board = start || [];
  map.nodes.forEach((n, i) => {
    const fill = board[i] === 1 ? '#e2391b' : board[i] === 2 ? '#4f9a2e' : board[i] === 3 ? '#8d877d' : null;
    if (fill) el('circle', { cx: n.x, cy: n.y, r: 24, fill }, svg);
    else el('circle', { cx: n.x, cy: n.y, r: 11, fill: 'var(--groove)' }, svg);
  });
  return svg;
}
