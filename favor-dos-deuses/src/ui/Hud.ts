import type { Bestow } from "../data/bestows";

export interface HudState {
  hp: number;
  maxHp: number;
  nylea: number;
  heliod: number;
  bestows: (Bestow | null)[];
  activeBestows: boolean[];
}

export class Hud {
  private container: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private hpValue: HTMLSpanElement;
  private nyleaFill: HTMLDivElement;
  private nyleaValue: HTMLSpanElement;
  private heliodFill: HTMLDivElement;
  private heliodValue: HTMLSpanElement;
  private bestowsContainer: HTMLDivElement;

  constructor(overlay: HTMLElement) {
    this.container = document.createElement("div");
    this.container.className = "hud-container";
    this.container.innerHTML = `
      <div class="hud-left">
        <div class="hud-bar">
          <span class="hud-bar-label">HP</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill hp" style="width: 100%"></div>
            <span class="hud-bar-value">100/100</span>
          </div>
        </div>
        <div class="hud-bar">
          <span class="hud-bar-label">Nylea</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill nylea" style="width: 0%"></div>
            <span class="hud-bar-value">0</span>
          </div>
        </div>
        <div class="hud-bar">
          <span class="hud-bar-label">Heliod</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill heliod" style="width: 0%"></div>
            <span class="hud-bar-value">0</span>
          </div>
        </div>
      </div>
      <div class="hud-right">
        <div class="bestows-container"></div>
      </div>
    `;

    overlay.appendChild(this.container);

    this.hpFill = this.container.querySelector(".hud-bar-fill.hp")!;
    this.hpValue = this.container.querySelector(".hud-bar-fill.hp + .hud-bar-value")!;
    this.nyleaFill = this.container.querySelector(".hud-bar-fill.nylea")!;
    this.nyleaValue = this.container.querySelector(".hud-bar-fill.nylea + .hud-bar-value")!;
    this.heliodFill = this.container.querySelector(".hud-bar-fill.heliod")!;
    this.heliodValue = this.container.querySelector(".hud-bar-fill.heliod + .hud-bar-value")!;
    this.bestowsContainer = this.container.querySelector(".bestows-container")!;
  }

  update(state: HudState): void {
    const hpPercent = (state.hp / state.maxHp) * 100;
    this.hpFill.style.width = `${hpPercent}%`;
    this.hpValue.textContent = `${Math.round(state.hp)}/${state.maxHp}`;

    this.nyleaFill.style.width = `${state.nylea}%`;
    this.nyleaValue.textContent = String(Math.round(state.nylea));

    this.heliodFill.style.width = `${state.heliod}%`;
    this.heliodValue.textContent = String(Math.round(state.heliod));

    this.updateBestows(state.bestows, state.activeBestows);
  }

  private updateBestows(bestows: (Bestow | null)[], active: boolean[]): void {
    this.bestowsContainer.innerHTML = "";

    for (let i = 0; i < 4; i++) {
      const bestow = bestows[i];
      const isActive = active[i];

      const icon = document.createElement("div");
      icon.className = `bestow-icon ${bestow?.godId ?? "empty"}`;

      if (bestow) {
        icon.textContent = bestow.icon;
        icon.title = `[${i + 1}] ${bestow.name}: ${bestow.description}`;

        if (isActive) {
          icon.style.boxShadow = "0 0 10px currentColor";
        }
      } else {
        icon.textContent = String(i + 1);
        icon.style.opacity = "0.3";
      }

      this.bestowsContainer.appendChild(icon);
    }
  }

  show(): void {
    this.container.style.display = "flex";
  }

  hide(): void {
    this.container.style.display = "none";
  }

  destroy(): void {
    this.container.remove();
  }
}
