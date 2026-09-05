import type { Design } from "../sim/bridge.ts";

export interface LevelRecord {
  stars: number;
  bestCost: number;
  bestFs: number;
  attempts: number;
}

export interface ProgressData {
  v: 1;
  levels: Record<string, LevelRecord>;
  designs: Record<string, Design>;
  lastLevel: number;
  muted: boolean;
}

const KEY = "prancha.progress.v1";

function empty(): ProgressData {
  return { v: 1, levels: {}, designs: {}, lastLevel: 1, muted: false };
}

export class Progress {
  data: ProgressData = empty();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ProgressData>;
      if (parsed && parsed.v === 1) this.data = { ...empty(), ...parsed };
    } catch {
      this.data = empty();
    }
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* armazenamento indisponível: o jogo segue sem persistir */
    }
  }

  record(id: number): LevelRecord | undefined {
    return this.data.levels[String(id)];
  }

  stars(id: number): number {
    return this.record(id)?.stars ?? 0;
  }

  isUnlocked(id: number): boolean {
    if (id <= 1) return true;
    return this.stars(id - 1) >= 1;
  }

  /** Última obra desbloqueada ainda não concluída (ou a última do jogo). */
  nextOpen(maxId: number): number {
    for (let id = 1; id <= maxId; id++) {
      if (this.isUnlocked(id) && this.stars(id) === 0) return id;
    }
    return maxId;
  }

  registerAttempt(id: number): void {
    const rec = this.record(id) ?? { stars: 0, bestCost: Infinity, bestFs: 0, attempts: 0 };
    rec.attempts++;
    this.data.levels[String(id)] = rec;
    this.save();
  }

  registerResult(id: number, stars: number, cost: number, fs: number): void {
    const rec = this.record(id) ?? { stars: 0, bestCost: Infinity, bestFs: 0, attempts: 0 };
    if (stars > rec.stars) rec.stars = stars;
    if (stars > 0 && cost < rec.bestCost) rec.bestCost = cost;
    if (stars > 0 && fs > rec.bestFs) rec.bestFs = fs;
    this.data.levels[String(id)] = rec;
    this.save();
  }

  saveDesign(id: number, design: Design): void {
    if (id <= 0) return;
    this.data.designs[String(id)] = design;
    this.data.lastLevel = id;
    this.save();
  }

  design(id: number): Design | undefined {
    return this.data.designs[String(id)];
  }

  setMuted(m: boolean): void {
    this.data.muted = m;
    this.save();
  }

  totalStars(): number {
    return Object.values(this.data.levels).reduce((s, r) => s + r.stars, 0);
  }

  reset(): void {
    this.data = empty();
    this.save();
  }
}
