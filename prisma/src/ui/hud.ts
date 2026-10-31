import type { Inventory, Level, PieceType } from '../core/types.ts';
import { PIECE_TYPES } from '../core/types.ts';

const ICONS: Record<PieceType, string> = {
  mirror: `<svg viewBox="0 0 40 34"><rect x="6" y="15" width="28" height="4" rx="2" fill="#f4f6ff" stroke="#9aa3b8" stroke-width="1"/></svg>`,
  prism: `<svg viewBox="0 0 40 34"><polygon points="20,4 35,30 5,30" fill="rgba(255,255,255,0.08)" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
  lens: `<svg viewBox="0 0 40 34"><path d="M20 3 C 29 12 29 22 20 31 C 11 22 11 12 20 3 Z" fill="rgba(150,200,255,0.16)" stroke="#ffffff" stroke-width="2"/></svg>`,
  dichroic: `<svg viewBox="0 0 40 34"><line x1="6" y1="28" x2="34" y2="6" stroke="#ff3d7a" stroke-width="3" stroke-linecap="round"/><line x1="10" y1="10" x2="30" y2="24" stroke="#4dffb0" stroke-width="3.5" stroke-linecap="round"/></svg>`,
  filter: `<svg viewBox="0 0 40 34"><line x1="6" y1="26" x2="34" y2="8" stroke="#3dff86" stroke-width="4" stroke-linecap="round"/></svg>`,
  orb: `<svg viewBox="0 0 40 34"><circle cx="20" cy="17" r="12" fill="rgba(190,215,255,0.14)" stroke="#ffffff" stroke-width="1.8"/><ellipse cx="15" cy="12" rx="3.5" ry="2" fill="rgba(255,255,255,0.8)" transform="rotate(-35 15 12)"/></svg>`,
  portal: `<svg viewBox="0 0 40 34"><rect x="7" y="12" width="26" height="9" rx="3" fill="url(#pg)" /><rect x="10" y="15.5" width="20" height="2" fill="rgba(255,255,255,0.85)"/><defs><linearGradient id="pg" x1="0" x2="1"><stop offset="0" stop-color="#6a4cff"/><stop offset="0.5" stop-color="#c7b8ff"/><stop offset="1" stop-color="#4ad8ff"/></linearGradient></defs></svg>`
};

const TITLES: Record<PieceType, string> = {
  mirror: 'mirror — reflects light',
  prism: 'prism — fans white light into a spectrum',
  lens: 'convex lens — bends light passing off-centre',
  dichroic: 'dichroic filter — reflects red, transmits the rest',
  filter: 'green filter — only green passes',
  orb: 'glass orb — refracts and focuses light',
  portal: 'portal — light exits from the twin portal'
};

export class Hud {
  private tray = document.getElementById('tray')!;
  private title = document.getElementById('level-title')!;
  private fpsEl = document.getElementById('fps')!;
  private hintEl = document.getElementById('hint')!;
  private cursorEl = document.getElementById('cursor')!;
  private musicBtn = document.getElementById('btn-music')!;
  private slots = new Map<PieceType, { el: HTMLElement; count: HTMLElement }>();
  private active: PieceType | null = null;
  private hintTimer = 0;

  onSelectTool: (t: PieceType | null) => void = () => {};
  onTrayDrag: (t: PieceType, e: PointerEvent) => void = () => {};
  onRestart: () => void = () => {};
  onLevels: () => void = () => {};
  onMusic: () => void = () => {};

  constructor() {
    document.getElementById('btn-restart')!.addEventListener('click', () => this.onRestart());
    document.getElementById('btn-levels')!.addEventListener('click', () => this.onLevels());
    this.musicBtn.addEventListener('click', () => this.onMusic());
  }

  buildTray(inv: Inventory) {
    this.tray.innerHTML = '';
    this.slots.clear();
    this.active = null;
    for (const t of PIECE_TYPES) {
      if (inv[t] === undefined) continue;
      const el = document.createElement('div');
      el.className = 'slot';
      el.title = TITLES[t];
      el.innerHTML = `<div class="count">0</div>${ICONS[t]}<div class="name">${t}</div>`;
      const count = el.querySelector('.count') as HTMLElement;
      el.addEventListener('pointerdown', (e) => {
        if (el.classList.contains('empty')) return;
        e.preventDefault();
        this.setActive(t);
        this.onSelectTool(t);
        this.onTrayDrag(t, e);
      });
      this.tray.appendChild(el);
      this.slots.set(t, { el, count });
    }
    this.updateCounts(inv);
  }

  updateCounts(inv: Inventory) {
    for (const [t, s] of this.slots) {
      const n = inv[t] ?? 0;
      s.count.textContent = String(n);
      s.el.classList.toggle('empty', n <= 0);
      if (n <= 0 && this.active === t) this.setActive(null);
    }
  }

  setActive(t: PieceType | null) {
    this.active = t;
    for (const [k, s] of this.slots) s.el.classList.toggle('active', k === t);
  }

  get activeTool() { return this.active; }

  setLevel(level: Level) {
    this.title.textContent = level.sandbox ? 'free play' : `level ${level.id}: ${level.name}`;
  }

  showHint(text: string, ms = 6000) {
    window.clearTimeout(this.hintTimer);
    this.hintEl.textContent = text;
    this.hintEl.classList.add('show');
    this.hintTimer = window.setTimeout(() => this.hintEl.classList.remove('show'), ms);
  }

  hideHint() { window.clearTimeout(this.hintTimer); this.hintEl.classList.remove('show'); }

  setFps(n: number) { this.fpsEl.textContent = `${Math.round(n)} fps`; }

  setMusic(on: boolean) { this.musicBtn.classList.toggle('muted', !on); }

  moveCursor(x: number, y: number, visible: boolean) {
    this.cursorEl.style.display = visible ? 'block' : 'none';
    this.cursorEl.style.left = `${x}px`;
    this.cursorEl.style.top = `${y}px`;
  }

  setCursorMode(mode: 'hand' | 'grab' | 'point') {
    this.cursorEl.className = mode;
  }
}
