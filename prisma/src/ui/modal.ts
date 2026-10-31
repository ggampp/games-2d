import type { Level } from '../core/types.ts';

export interface Progress {
  solved: Record<number, number>; // level id -> best piece count
}

const KEY = 'prism-rules-progress-v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Progress;
  } catch { /* ignore */ }
  return { solved: {} };
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export class Modals {
  private solvedEl = document.getElementById('modal-solved')!;
  private levelsEl = document.getElementById('modal-levels')!;
  private grid = document.getElementById('level-grid')!;
  private stats = document.getElementById('solved-stats')!;
  private progress = document.getElementById('solved-progress')!;
  private ribbon = document.getElementById('solved-ribbon')!;
  private nextBtn = document.getElementById('btn-next') as HTMLButtonElement;

  onReplay: () => void = () => {};
  onFreePlay: () => void = () => {};
  onNext: () => void = () => {};
  onSelect: (id: number) => void = () => {};

  constructor() {
    document.getElementById('btn-replay')!.addEventListener('click', () => { this.hideSolved(); this.onReplay(); });
    document.getElementById('btn-freeplay')!.addEventListener('click', () => { this.hideSolved(); this.onFreePlay(); });
    this.nextBtn.addEventListener('click', () => { this.hideSolved(); this.onNext(); });
    document.getElementById('btn-close-levels')!.addEventListener('click', () => this.hideLevels());
    document.getElementById('btn-sandbox')!.addEventListener('click', () => { this.hideLevels(); this.onFreePlay(); });
    this.levelsEl.addEventListener('click', (e) => { if (e.target === this.levelsEl) this.hideLevels(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.hideLevels(); } });
  }

  showSolved(used: number, par: number, done: number, total: number, hasNext: boolean) {
    this.stats.textContent = `${used} piece${used === 1 ? '' : 's'} used · par ${par}`;
    this.progress.textContent = `${done} of ${total} levels complete`;
    this.ribbon.textContent = used <= par ? (used < par ? 'under par' : 'par') : `+${used - par}`;
    this.nextBtn.style.display = hasNext ? '' : 'none';
    this.solvedEl.classList.remove('hidden');
  }

  hideSolved() { this.solvedEl.classList.add('hidden'); }
  get solvedOpen() { return !this.solvedEl.classList.contains('hidden'); }

  showLevels(levels: Level[], currentId: number, progress: Progress) {
    this.grid.innerHTML = '';
    for (const l of levels) {
      const b = document.createElement('button');
      b.className = 'tile' + (progress.solved[l.id] !== undefined ? ' done' : '') + (l.id === currentId ? ' current' : '');
      b.innerHTML = `<span class="num">${l.id}</span><span class="nm">${l.name}</span><span class="par">par ${l.par}${progress.solved[l.id] !== undefined ? ` · best ${progress.solved[l.id]}` : ''}</span>`;
      b.addEventListener('click', () => { this.hideLevels(); this.onSelect(l.id); });
      this.grid.appendChild(b);
    }
    this.levelsEl.classList.remove('hidden');
  }

  hideLevels() { this.levelsEl.classList.add('hidden'); }
  get anyOpen() { return this.solvedOpen || !this.levelsEl.classList.contains('hidden'); }
}
