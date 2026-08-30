export type HudState = {
  mode: 'title' | 'playing' | 'victory' | 'gameover';
  hp: number;
  maxHp: number;
  score: number;
  wave: number;
  waveTotal: number;
  status: string;
  specialReady: boolean;
};

export class Hud {
  private readonly hpFill: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly waveEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly overlayTitle: HTMLElement;
  private readonly overlayBody: HTMLElement;
  private readonly specialHint: HTMLElement;

  constructor() {
    this.hpFill = this.el('#hp-fill');
    this.hpText = this.el('#hp-text');
    this.scoreEl = this.el('#score-value');
    this.waveEl = this.el('#wave-value');
    this.statusEl = this.el('#status-line');
    this.overlay = this.el('#overlay');
    this.overlayTitle = this.el('#overlay-title');
    this.overlayBody = this.el('#overlay-body');
    this.specialHint = this.el('#special-hint');
  }

  update(state: HudState): void {
    const pct = Math.max(0, Math.min(1, state.hp / state.maxHp));
    this.hpFill.style.width = `${pct * 100}%`;
    this.hpFill.classList.toggle('low', pct < 0.3);
    this.hpText.textContent = `${Math.ceil(state.hp)} / ${state.maxHp}`;
    this.scoreEl.textContent = String(state.score);
    this.waveEl.textContent = `${state.wave}/${state.waveTotal}`;
    this.statusEl.textContent = state.status;
    this.specialHint.classList.toggle('ready', state.specialReady);

    if (state.mode === 'playing') {
      this.overlay.classList.add('hidden');
      return;
    }

    this.overlay.classList.remove('hidden');
    if (state.mode === 'title') {
      this.overlayTitle.textContent = 'Ironclad Rampage';
      this.overlayBody.innerHTML =
        'Cartoon medieval beat \'em up<br/>' +
        '<strong>WASD / arrows</strong> move · <strong>J / Z / Space</strong> attack · <strong>K / X</strong> special<br/>' +
        'Press <strong>Enter</strong> or tap <strong>Start</strong>';
    } else if (state.mode === 'victory') {
      this.overlayTitle.textContent = 'Castle Secured!';
      this.overlayBody.innerHTML = `Score <strong>${state.score}</strong><br/>Press Enter to play again`;
    } else {
      this.overlayTitle.textContent = 'Defeated...';
      this.overlayBody.innerHTML = `Score <strong>${state.score}</strong><br/>Press Enter to retry`;
    }
  }

  private el(selector: string): HTMLElement {
    const node = document.querySelector<HTMLElement>(selector);
    if (!node) throw new Error(`Missing ${selector}`);
    return node;
  }
}
