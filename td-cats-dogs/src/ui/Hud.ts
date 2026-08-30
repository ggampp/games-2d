import { REPAIR_COST } from "../data/cats.ts";
import { UI } from "../data/kit.ts";

export type HudState = {
  coins: number;
  hp: number;
  wave: number;
  maxWave: number;
  catLevel: number;
  place: number;
  upgrade: number;
  canUpgrade: boolean;
  canRepair: boolean;
};

export class Hud {
  private container: HTMLElement;

  constructor(parent: HTMLElement, onUpgrade: () => void, onRepair: () => void) {
    this.container = document.createElement("div");
    this.container.className = "hud-wrap";
    this.container.hidden = true;
    this.container.innerHTML = `
      <div class="hud-top">
        <div class="hud-bar hud-coins" style="background-image:url('${UI.coinBar}')">
          <img src="${UI.coin}" alt="" />
          <span id="hud-coins">0</span>
        </div>
        <div class="hud-bar hud-wave" style="background-image:url('${UI.waveBar}')">
          <span id="hud-wave">Onda 1 / 3</span>
        </div>
      </div>
      <div class="hud-bottom">
        <button type="button" id="hud-upgrade" class="hud-action" style="background-image:url('${UI.btnOrange}')">
          <img src="${UI.catIcon}" alt="" />
          <span>Nível <b id="hud-level">1</b> · <b id="hud-upcost">70</b></span>
        </button>
        <button type="button" id="hud-repair" class="hud-action" style="background-image:url('${UI.btnGreen}')">
          <img src="${UI.wallIcon}" alt="" />
          <span>Reparar muro · ${REPAIR_COST}</span>
        </button>
      </div>
    `;
    parent.appendChild(this.container);
    this.container.querySelector("#hud-upgrade")!.addEventListener("click", onUpgrade);
    this.container.querySelector("#hud-repair")!.addEventListener("click", onRepair);
  }

  set(state: HudState | null): void {
    this.container.hidden = !state;
    if (!state) return;
    this.container.querySelector("#hud-coins")!.textContent = String(state.coins);
    this.container.querySelector("#hud-wave")!.textContent = `Onda ${state.wave} / ${state.maxWave}`;
    this.container.querySelector("#hud-level")!.textContent = String(state.catLevel);
    this.container.querySelector("#hud-upcost")!.textContent = state.upgrade ? String(state.upgrade) : "máx";
    (this.container.querySelector("#hud-upgrade") as HTMLButtonElement).disabled = !state.canUpgrade;
    (this.container.querySelector("#hud-repair") as HTMLButtonElement).disabled = !state.canRepair;
  }
}
