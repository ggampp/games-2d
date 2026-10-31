import { LEVELS } from '../engine/levels.ts';

export class ModalManager {
  private modalSolved: HTMLElement;
  private solvedStats: HTMLElement;
  private solvedProgress: HTMLElement;
  private btnReplay: HTMLElement;
  private btnFreeplay: HTMLElement;
  private btnNextLevel: HTMLElement;

  private modalLevels: HTMLElement;
  private levelsGrid: HTMLElement;
  private btnCloseLevels: HTMLElement;
  private btnSandboxMode: HTMLElement;

  public onReplay: (() => void) | null = null;
  public onFreePlay: (() => void) | null = null;
  public onNextLevel: (() => void) | null = null;
  public onSelectLevel: ((levelId: number) => void) | null = null;

  constructor() {
    this.modalSolved = document.getElementById('modal-solved')!;
    this.solvedStats = document.getElementById('solved-stats')!;
    this.solvedProgress = document.getElementById('solved-progress')!;
    this.btnReplay = document.getElementById('btn-replay')!;
    this.btnFreeplay = document.getElementById('btn-freeplay')!;
    this.btnNextLevel = document.getElementById('btn-next-level')!;

    this.modalLevels = document.getElementById('modal-levels')!;
    this.levelsGrid = document.getElementById('levels-grid')!;
    this.btnCloseLevels = document.getElementById('btn-close-levels')!;
    this.btnSandboxMode = document.getElementById('btn-sandbox-mode')!;

    this.setupListeners();
  }

  private setupListeners() {
    this.btnReplay.addEventListener('click', () => {
      this.hideSolved();
      this.onReplay?.();
    });

    this.btnFreeplay.addEventListener('click', () => {
      this.hideSolved();
      this.onFreePlay?.();
    });

    this.btnNextLevel.addEventListener('click', () => {
      this.hideSolved();
      this.onNextLevel?.();
    });

    this.btnCloseLevels.addEventListener('click', () => {
      this.hideLevels();
    });

    this.btnSandboxMode.addEventListener('click', () => {
      this.hideLevels();
      this.onSelectLevel?.(999);
    });
  }

  public showSolved(piecesUsed: number, par: number, currentLevelId: number) {
    this.solvedStats.textContent = `${piecesUsed} pieces used · par ${par}`;
    if (currentLevelId === 70) {
      this.solvedProgress.textContent = "70 of 70 levels complete";
      this.btnNextLevel.style.display = 'none';
    } else {
      this.solvedProgress.textContent = `${currentLevelId} of 70 levels complete`;
      this.btnNextLevel.style.display = 'inline-block';
    }
    this.modalSolved.classList.remove('hidden');
  }

  public hideSolved() {
    this.modalSolved.classList.add('hidden');
  }

  public showLevels(currentLevelId: number) {
    this.levelsGrid.innerHTML = '';

    LEVELS.forEach(level => {
      if (level.id === 999) return; // sandbox has separate button

      const chip = document.createElement('div');
      chip.className = 'level-chip';
      if (level.id === currentLevelId) chip.classList.add('active');
      if (level.id === 70) chip.classList.add('featured');

      chip.innerHTML = `
        <div>Level ${level.id}</div>
        <div class="chip-name">${level.name}</div>
      `;

      chip.addEventListener('click', () => {
        this.hideLevels();
        this.onSelectLevel?.(level.id);
      });

      this.levelsGrid.appendChild(chip);
    });

    this.modalLevels.classList.remove('hidden');
  }

  public hideLevels() {
    this.modalLevels.classList.add('hidden');
  }
}
