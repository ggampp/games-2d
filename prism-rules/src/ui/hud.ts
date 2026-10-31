import { OpticalItemType, LevelDefinition } from '../engine/types.ts';

export class HUD {
  private levelLabel: HTMLElement;
  private countPrism: HTMLElement;
  private countGreen: HTMLElement;
  private countLens: HTMLElement;
  private countMirror: HTMLElement;
  private slotPrism: HTMLElement;
  private slotGreen: HTMLElement;
  private slotLens: HTMLElement;
  private slotMirror: HTMLElement;
  private fpsCounter: HTMLElement;
  private btnAudio: HTMLElement;

  private selectedType: OpticalItemType | null = null;
  public onSelectSlot: ((type: OpticalItemType | null) => void) | null = null;
  public onRestart: (() => void) | null = null;
  public onSolution: (() => void) | null = null;
  public onOpenLevels: (() => void) | null = null;
  public onToggleAudio: (() => void) | null = null;

  constructor() {
    this.levelLabel = document.getElementById('level-label')!;
    this.countPrism = document.getElementById('count-prism')!;
    this.countGreen = document.getElementById('count-green')!;
    this.countLens = document.getElementById('count-lens')!;
    this.countMirror = document.getElementById('count-mirror')!;

    this.slotPrism = document.getElementById('slot-prism')!;
    this.slotGreen = document.getElementById('slot-green')!;
    this.slotLens = document.getElementById('slot-lens')!;
    this.slotMirror = document.getElementById('slot-mirror')!;

    this.fpsCounter = document.getElementById('fps-counter')!;
    this.btnAudio = document.getElementById('btn-audio')!;

    this.setupListeners();
  }

  private setupListeners() {
    const slots: { el: HTMLElement; type: OpticalItemType }[] = [
      { el: this.slotPrism, type: 'prism' },
      { el: this.slotGreen, type: 'green' },
      { el: this.slotLens, type: 'lens' },
      { el: this.slotMirror, type: 'mirror' }
    ];

    slots.forEach(({ el, type }) => {
      el.addEventListener('click', () => {
        if (this.selectedType === type) {
          this.setSelectedType(null);
        } else {
          this.setSelectedType(type);
        }
        this.onSelectSlot?.(this.selectedType);
      });
    });

    document.getElementById('btn-solution')?.addEventListener('click', () => {
      this.onSolution?.();
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.onRestart?.();
    });

    document.getElementById('btn-levels')?.addEventListener('click', () => {
      this.onOpenLevels?.();
    });

    this.btnAudio?.addEventListener('click', () => {
      this.onToggleAudio?.();
    });
  }

  public setSelectedType(type: OpticalItemType | null) {
    this.selectedType = type;
    [this.slotPrism, this.slotGreen, this.slotLens, this.slotMirror].forEach(el => {
      el.classList.remove('active');
    });

    if (type === 'prism') this.slotPrism.classList.add('active');
    if (type === 'green') this.slotGreen.classList.add('active');
    if (type === 'lens') this.slotLens.classList.add('active');
    if (type === 'mirror') this.slotMirror.classList.add('active');
  }

  public getSelectedType(): OpticalItemType | null {
    return this.selectedType;
  }

  public updateLevelInfo(level: LevelDefinition) {
    if (level.id === 999) {
      this.levelLabel.textContent = `sandbox: ${level.name}`;
    } else {
      this.levelLabel.textContent = `level ${level.id}: ${level.name}`;
    }
  }

  public updateInventory(inventory: Record<OpticalItemType, number>) {
    this.updateCountBadge(this.countPrism, this.slotPrism, inventory.prism);
    this.updateCountBadge(this.countGreen, this.slotGreen, inventory.green);
    this.updateCountBadge(this.countLens, this.slotLens, inventory.lens);
    this.updateCountBadge(this.countMirror, this.slotMirror, inventory.mirror);

    // If active slot reached 0, deselect it
    if (this.selectedType && inventory[this.selectedType] <= 0) {
      this.setSelectedType(null);
      this.onSelectSlot?.(null);
    }
  }

  private updateCountBadge(countEl: HTMLElement, slotEl: HTMLElement, count: number) {
    countEl.textContent = count.toString();
    if (count <= 0) {
      countEl.classList.add('zero');
      slotEl.classList.add('disabled');
    } else {
      countEl.classList.remove('zero');
      slotEl.classList.remove('disabled');
    }
  }

  public updateFPS(fps: number) {
    this.fpsCounter.textContent = `${Math.round(fps)} fps`;
  }

  public updateAudioIcon(isMuted: boolean) {
    this.btnAudio.style.opacity = isMuted ? '0.45' : '1.0';
  }
}
