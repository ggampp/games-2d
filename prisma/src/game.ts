import type { Inventory, Level, Piece, PieceType, TraceResult, Vec } from './core/types.ts';
import { LEVELS, PLAYABLE, SANDBOX, levelById } from './core/levels.ts';
import { BOARD, DIM, segmentEndpoints, trace } from './core/tracer.ts';
import { clamp, dist, pointSegDist, TAU } from './core/geom.ts';
import { SceneRenderer } from './render/scene.ts';
import { PostProcessor } from './render/post.ts';
import { Hud } from './ui/hud.ts';
import { Modals, loadProgress, saveProgress } from './ui/modal.ts';
import { audio } from './audio.ts';

const D = Math.PI / 180;
const GIZMO_R = 52;

interface DragState {
  mode: 'move' | 'rotate' | 'ghost';
  piece?: Piece;
  offset?: Vec;
  ghostType?: PieceType;
  lastTickDeg?: number;
}

export class Game {
  private view = document.getElementById('view') as HTMLCanvasElement;
  private arena = document.getElementById('arena')!;
  private scene = new SceneRenderer();
  private post: PostProcessor | null = null;
  private fallback: CanvasRenderingContext2D | null = null;
  private hud = new Hud();
  private modals = new Modals();
  private progress = loadProgress();

  level: Level = PLAYABLE[0];
  pieces: Piece[] = [];
  private counts: Inventory = {};
  private selected: Piece | null = null;
  private drag: DragState | null = null;
  private pointer: Vec = { x: -1, y: -1 };
  private pointerClient: Vec = { x: 0, y: 0 };
  private overArena = false;
  private ghost: { type: PieceType; x: number; y: number; angle: number } | null = null;

  private traceResult: TraceResult = { segments: [], litTargets: new Map(), shadows: [], portalHits: [] };
  private dirty = true;
  private lit = new Map<string, number>();
  private wasLit = new Set<string>();
  private solved = false;
  private solvedTimer = 0;
  private solvedGlow = 0;
  private lastT = 0;
  private fps = 60;
  private seq = 0;

  constructor() {
    try {
      this.post = new PostProcessor(this.view);
    } catch (err) {
      console.warn('post-processing disabled:', err);
      this.fallback = this.view.getContext('2d');
    }
    this.bindHud();
    this.bindInput();
    const fromHash = Number((location.hash.match(/level=(\d+)/) ?? [])[1]);
    const first = PLAYABLE.find((l) => this.progress.solved[l.id] === undefined) ?? PLAYABLE[0];
    this.loadLevel(levelById(fromHash) ?? first);
    requestAnimationFrame((t) => this.frame(t));
    (window as unknown as { __prism: unknown }).__prism = this;
  }

  // ------------------------------------------------------------------ level lifecycle
  loadLevel(level: Level) {
    this.level = level;
    this.pieces = (level.pieces ?? []).map((p) => ({ ...p }));
    this.counts = { ...level.inventory };
    this.selected = null;
    this.drag = null;
    this.ghost = null;
    this.solved = false;
    this.solvedTimer = 0;
    this.solvedGlow = 0;
    this.lit.clear();
    this.wasLit.clear();
    this.dirty = true;
    this.hud.setLevel(level);
    this.hud.buildTray(this.counts);
    this.modals.hideSolved();
    if (level.hint) this.hud.showHint(level.hint); else this.hud.hideHint();
    history.replaceState(null, '', `#level=${level.id}`);
  }

  restart() { this.loadLevel(this.level); }

  nextLevel() {
    const i = PLAYABLE.indexOf(this.level);
    if (i >= 0 && i + 1 < PLAYABLE.length) this.loadLevel(PLAYABLE[i + 1]);
    else this.loadLevel(SANDBOX);
  }

  /** Dev/QA hook: place a set of pieces (angles in degrees). */
  applySolution(sol: { type: PieceType; x: number; y: number; angle: number }[]) {
    this.restart();
    for (const s of sol) {
      if ((this.counts[s.type] ?? 0) <= 0) continue;
      this.counts[s.type]!--;
      this.pieces.push({ id: `p${++this.seq}`, type: s.type, x: s.x, y: s.y, angle: s.angle * D });
    }
    this.hud.updateCounts(this.counts);
    this.dirty = true;
  }

  get piecesUsed() { return this.pieces.filter((p) => !p.fixed).length; }

  // ------------------------------------------------------------------ hud + modals
  private bindHud() {
    this.hud.onRestart = () => { audio.ui(); this.restart(); };
    this.hud.onLevels = () => { audio.ui(); this.modals.showLevels(PLAYABLE, this.level.id, this.progress); };
    this.hud.onMusic = () => { const on = audio.toggleMusic(); this.hud.setMusic(on); };
    this.hud.onSelectTool = () => { this.selected = null; };
    this.hud.onTrayDrag = (type, e) => {
      this.drag = { mode: 'ghost', ghostType: type };
      this.updatePointer(e.clientX, e.clientY);
      this.ghost = { type, x: this.pointer.x, y: this.pointer.y, angle: this.defaultAngle(type) };
      this.hud.setCursorMode('grab');
    };
    this.modals.onReplay = () => this.restart();
    this.modals.onFreePlay = () => this.loadLevel(SANDBOX);
    this.modals.onNext = () => this.nextLevel();
    this.modals.onSelect = (id) => { const l = levelById(id); if (l) this.loadLevel(l); };
  }

  // ------------------------------------------------------------------ input
  private updatePointer(clientX: number, clientY: number) {
    const r = this.view.getBoundingClientRect();
    this.pointerClient = { x: clientX - r.left, y: clientY - r.top };
    this.pointer = { x: ((clientX - r.left) / r.width) * BOARD, y: ((clientY - r.top) / r.height) * BOARD };
    this.overArena = clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  private bindInput() {
    const arena = this.arena;
    arena.addEventListener('pointerdown', (e) => {
      if (this.modals.anyOpen) return;
      audio.unlock();
      this.updatePointer(e.clientX, e.clientY);
      if (e.button === 2) { this.removeAt(this.pointer); return; }
      if (e.button !== 0) return;
      this.pointerDown();
      e.preventDefault();
    });
    arena.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointermove', (e) => {
      this.updatePointer(e.clientX, e.clientY);
      this.pointerMove();
    });
    window.addEventListener('pointerup', (e) => {
      this.updatePointer(e.clientX, e.clientY);
      this.pointerUp(e.target as HTMLElement | null);
    });
    arena.addEventListener('pointerleave', () => { if (!this.drag) this.hud.moveCursor(0, 0, false); });
    arena.addEventListener('wheel', (e) => {
      if (!this.selected || this.selected.fixed) return;
      e.preventDefault();
      const step = e.shiftKey ? 0.1 : e.ctrlKey ? 15 : 1;
      this.rotateSelected((e.deltaY > 0 ? 1 : -1) * step);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (this.modals.anyOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case 'r': case 'R': this.restart(); break;
        case 'Delete': case 'Backspace': this.removeSelected(); break;
        case 'Escape': this.selected = null; this.hud.setActive(null); this.ghost = null; this.drag = null; break;
        case 'ArrowLeft': case 'ArrowDown': this.rotateSelected(e.shiftKey ? -0.1 : -1); e.preventDefault(); break;
        case 'ArrowRight': case 'ArrowUp': this.rotateSelected(e.shiftKey ? 0.1 : 1); e.preventDefault(); break;
        case 'n': case 'N': if (this.solved) this.nextLevel(); break;
      }
    });
    window.addEventListener('resize', () => this.resize());
  }

  private defaultAngle(type: PieceType): number {
    switch (type) {
      case 'lens': return 90 * D;
      case 'prism': return 0;
      default: return 20 * D;
    }
  }

  private pieceAt(p: Vec): Piece | null {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const pc = this.pieces[i];
      if (pc.type === 'prism') { if (dist(p, pc) <= DIM.prismR + 6) return pc; continue; }
      if (pc.type === 'orb') { if (dist(p, pc) <= DIM.orbR + 6) return pc; continue; }
      const [a, b] = segmentEndpoints(pc);
      if (pointSegDist(p, a, b) <= 12 || dist(p, pc) <= 18) return pc;
    }
    return null;
  }

  private onKnob(p: Vec): boolean {
    if (!this.selected) return false;
    const s = this.selected;
    const kx = s.x + Math.cos(s.angle) * GIZMO_R, ky = s.y + Math.sin(s.angle) * GIZMO_R;
    if (Math.hypot(p.x - kx, p.y - ky) <= 14) return true;
    const d = dist(p, s);
    return Math.abs(d - GIZMO_R) <= 7;
  }

  private pointerDown() {
    const p = this.pointer;
    if (this.selected && !this.selected.fixed && this.onKnob(p)) {
      this.drag = { mode: 'rotate', piece: this.selected, lastTickDeg: Math.round(this.selected.angle / D) };
      this.hud.setCursorMode('grab');
      return;
    }
    const hit = this.pieceAt(p);
    if (hit) {
      this.selected = hit;
      this.hud.setActive(null);
      if (!hit.fixed) {
        this.drag = { mode: 'move', piece: hit, offset: { x: hit.x - p.x, y: hit.y - p.y } };
        this.hud.setCursorMode('grab');
        audio.pick();
      } else {
        this.hud.showHint('this piece is part of the apparatus', 1800);
      }
      return;
    }
    const tool = this.hud.activeTool;
    if (tool && (this.counts[tool] ?? 0) > 0) {
      this.placePiece(tool, p);
      return;
    }
    this.selected = null;
  }

  private placePiece(type: PieceType, at: Vec): Piece {
    const piece: Piece = {
      id: `p${++this.seq}`,
      type,
      x: clamp(at.x, 60, BOARD - 60),
      y: clamp(at.y, 60, BOARD - 60),
      angle: this.defaultAngle(type)
    };
    if (type === 'portal') {
      const open = this.pieces.find((q) => q.type === 'portal' && !q.link && !q.fixed);
      if (open) { open.link = piece.id; piece.link = open.id; }
    }
    this.pieces.push(piece);
    this.counts[type] = (this.counts[type] ?? 1) - 1;
    this.hud.updateCounts(this.counts);
    this.selected = piece;
    this.dirty = true;
    audio.place();
    return piece;
  }

  private pointerMove() {
    const d = this.drag;
    this.hud.moveCursor(this.pointerClient.x, this.pointerClient.y, this.overArena || !!d);
    if (!d) {
      const hover = this.pieceAt(this.pointer);
      this.hud.setCursorMode(this.selected && this.onKnob(this.pointer) ? 'point' : hover ? 'point' : 'hand');
      return;
    }
    if (d.mode === 'move' && d.piece) {
      d.piece.x = clamp(this.pointer.x + d.offset!.x, 50, BOARD - 50);
      d.piece.y = clamp(this.pointer.y + d.offset!.y, 50, BOARD - 50);
      this.dirty = true;
    } else if (d.mode === 'rotate' && d.piece) {
      const raw = Math.atan2(this.pointer.y - d.piece.y, this.pointer.x - d.piece.x);
      const snapped = Math.round(raw / (0.5 * D)) * 0.5 * D;
      if (snapped !== d.piece.angle) {
        d.piece.angle = snapped;
        this.dirty = true;
        const deg = Math.round(snapped / D);
        if (Math.abs(deg - (d.lastTickDeg ?? deg)) >= 2) { audio.tick(deg); d.lastTickDeg = deg; }
      }
    } else if (d.mode === 'ghost' && this.ghost) {
      this.ghost.x = this.pointer.x;
      this.ghost.y = this.pointer.y;
    }
  }

  private pointerUp(target: HTMLElement | null) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.hud.setCursorMode('hand');
    if (d.mode === 'ghost') {
      const type = d.ghostType!;
      this.ghost = null;
      if (this.overArena && (this.counts[type] ?? 0) > 0) {
        this.placePiece(type, this.pointer);
        if ((this.counts[type] ?? 0) <= 0) this.hud.setActive(null);
      }
      return;
    }
    if (d.mode === 'move' && d.piece) {
      const overTray = !!target?.closest?.('#hud-bottom');
      if (overTray || !this.overArena) this.removePiece(d.piece);
      else audio.place();
    }
  }

  private rotateSelected(deg: number) {
    if (!this.selected || this.selected.fixed) return;
    this.selected.angle = ((this.selected.angle + deg * D) % TAU + TAU) % TAU;
    this.dirty = true;
    audio.tick(Math.round(this.selected.angle / D));
  }

  private removePiece(p: Piece) {
    if (p.fixed) return;
    const i = this.pieces.indexOf(p);
    if (i < 0) return;
    this.pieces.splice(i, 1);
    if (p.link) { const twin = this.pieces.find((q) => q.id === p.link); if (twin) twin.link = undefined; }
    this.counts[p.type] = (this.counts[p.type] ?? 0) + 1;
    this.hud.updateCounts(this.counts);
    if (this.selected === p) this.selected = null;
    this.dirty = true;
    audio.remove();
  }

  private removeSelected() { if (this.selected) this.removePiece(this.selected); }
  private removeAt(p: Vec) { const hit = this.pieceAt(p); if (hit) this.removePiece(hit); }

  // ------------------------------------------------------------------ frame
  private resize() {
    const r = this.view.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.max(300, Math.min(1800, Math.round(r.width * dpr)));
    this.scene.setSize(px);
    if (this.fallback) { this.view.width = this.view.height = px; }
  }

  private frame(t: number) {
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;
    const time = t / 1000;
    if (dt > 0) { this.fps = this.fps * 0.92 + (1 / dt) * 0.08; }
    if ((t | 0) % 20 === 0) this.hud.setFps(this.fps);
    if (this.scene.canvas.width === 900 && this.view.getBoundingClientRect().width > 0) this.resize();

    if (this.dirty) {
      this.traceResult = trace(this.level, this.pieces);
      this.dirty = false;
      this.onTraceChanged();
    }

    // smooth lit values
    for (const tg of this.level.targets) {
      const goal = this.traceResult.litTargets.has(tg.id) ? 1 : 0;
      const cur = this.lit.get(tg.id) ?? 0;
      this.lit.set(tg.id, cur + (goal - cur) * Math.min(1, dt * 5));
    }

    // win check
    const all = this.level.targets.length > 0 && this.level.targets.every((tg) => this.traceResult.litTargets.has(tg.id));
    if (all && !this.solved && !this.level.sandbox) {
      this.solvedTimer += dt;
      if (this.solvedTimer > 0.7) this.onSolved();
    } else if (!all) {
      this.solvedTimer = 0;
    }
    if (this.solved) this.solvedGlow = Math.min(1, this.solvedGlow + dt * 1.5);

    this.scene.render({
      level: this.level,
      pieces: this.pieces,
      trace: this.traceResult,
      selected: this.selected,
      lit: this.lit,
      solvedGlow: this.solvedGlow,
      ghost: this.ghost
    }, time);

    if (this.post) this.post.render(this.scene.canvas, time);
    else if (this.fallback) this.fallback.drawImage(this.scene.canvas, 0, 0);

    requestAnimationFrame((tt) => this.frame(tt));
  }

  private onTraceChanged() {
    const now = new Set(this.traceResult.litTargets.keys());
    for (const tg of this.level.targets) {
      const was = this.wasLit.has(tg.id), is = now.has(tg.id);
      if (is && !was) audio.targetLit(tg.color);
      else if (!is && was && !this.solved) audio.targetUnlit();
    }
    this.wasLit = now;
  }

  private onSolved() {
    this.solved = true;
    audio.solved();
    const used = this.piecesUsed;
    const best = this.progress.solved[this.level.id];
    if (best === undefined || used < best) this.progress.solved[this.level.id] = used;
    saveProgress(this.progress);
    const done = PLAYABLE.filter((l) => this.progress.solved[l.id] !== undefined).length;
    const i = PLAYABLE.indexOf(this.level);
    window.setTimeout(() => {
      this.modals.showSolved(used, this.level.par, done, PLAYABLE.length, i >= 0 && i + 1 < PLAYABLE.length);
    }, 900);
  }

  get allLevels() { return LEVELS; }
}
