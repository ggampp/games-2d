import type { Bestow } from "../data/bestows";

export interface HudBestowSlot {
  bestow: Bestow;
  active: boolean;
  /** 0..1 fração do cooldown restante */
  cooldown: number;
  /** 0..1 fração da duração ativa restante */
  activeFraction: number;
}

export interface HudState {
  hp: number;
  maxHp: number;
  nylea: number;
  heliod: number;
  nextNylea: number | null;
  nextHeliod: number | null;
  bestows: (HudBestowSlot | null)[];
  dodgeCooldown: number;
  shield: boolean;
  status: string | null;
  bargained: boolean;
}

export class Hud {
  private container: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private hpValue: HTMLSpanElement;
  private nyleaFill: HTMLDivElement;
  private nyleaValue: HTMLSpanElement;
  private nyleaMark: HTMLDivElement;
  private heliodFill: HTMLDivElement;
  private heliodValue: HTMLSpanElement;
  private heliodMark: HTMLDivElement;
  private slots: { root: HTMLDivElement; icon: HTMLDivElement; cd: HTMLDivElement; key: HTMLDivElement }[] = [];
  /** último estado recebido (usado pela tela de pausa) */
  lastState: HudState | null = null;
  private dodgeFill: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private lastSig = "";

  constructor(overlay: HTMLElement) {
    this.container = document.createElement("div");
    this.container.className = "hud-container";
    this.container.innerHTML = `
      <div class="hud-left">
        <div class="hud-bar">
          <span class="hud-bar-label">Vida</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill hp" style="width:100%"></div>
            <span class="hud-bar-value">100/100</span>
          </div>
        </div>
        <div class="hud-bar">
          <span class="hud-bar-label nylea" title="Deusa da Caça e das Florestas">Nylea</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill nylea" style="width:0%"></div>
            <div class="hud-bar-mark nylea-mark"></div>
            <span class="hud-bar-value">0</span>
          </div>
        </div>
        <div class="hud-bar">
          <span class="hud-bar-label heliod" title="Deus do Sol e da Justiça">Heliod</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill heliod" style="width:0%"></div>
            <div class="hud-bar-mark heliod-mark"></div>
            <span class="hud-bar-value">0</span>
          </div>
        </div>
        <div class="hud-status"></div>
      </div>
      <div class="hud-right">
        <div class="bestows-container"></div>
        <div class="dodge-row"><span>Esquiva</span><div class="dodge-track"><div class="dodge-fill"></div></div></div>
      </div>
    `;
    overlay.appendChild(this.container);

    const q = <T extends HTMLElement>(sel: string) => this.container.querySelector(sel) as T;
    this.hpFill = q(".hud-bar-fill.hp");
    this.hpValue = q(".hud-bar-fill.hp + .hud-bar-value");
    this.nyleaFill = q(".hud-bar-fill.nylea");
    this.nyleaMark = q(".nylea-mark");
    this.nyleaValue = q(".nylea-mark + .hud-bar-value");
    this.heliodFill = q(".hud-bar-fill.heliod");
    this.heliodMark = q(".heliod-mark");
    this.heliodValue = q(".heliod-mark + .hud-bar-value");
    this.dodgeFill = q(".dodge-fill");
    this.statusEl = q(".hud-status");

    const bc = q<HTMLDivElement>(".bestows-container");
    for (let i = 0; i < 4; i++) {
      const root = document.createElement("div");
      root.className = "bestow-slot empty";
      root.innerHTML = `<div class="bestow-icon">${i + 1}</div><div class="bestow-cd"></div><div class="bestow-key">${i + 1}</div>`;
      bc.appendChild(root);
      this.slots.push({
        root,
        icon: root.querySelector(".bestow-icon")!,
        cd: root.querySelector(".bestow-cd")!,
        key: root.querySelector(".bestow-key")!,
      });
    }
  }

  update(s: HudState): void {
    this.lastState = s;
    const hpPct = Math.max(0, (s.hp / s.maxHp) * 100);
    this.hpFill.style.width = `${hpPct}%`;
    this.hpFill.classList.toggle("low", hpPct <= 25);
    this.hpValue.textContent = `${Math.round(s.hp)}/${s.maxHp}`;

    this.nyleaFill.style.width = `${s.nylea}%`;
    this.nyleaValue.textContent = String(Math.round(s.nylea));
    this.setMark(this.nyleaMark, s.nextNylea);

    this.heliodFill.style.width = `${s.heliod}%`;
    this.heliodValue.textContent = String(Math.round(s.heliod));
    this.setMark(this.heliodMark, s.nextHeliod);

    this.dodgeFill.style.width = `${(1 - s.dodgeCooldown) * 100}%`;
    this.dodgeFill.classList.toggle("ready", s.dodgeCooldown <= 0);

    const status: string[] = [];
    if (s.shield) status.push("🛡️ Égide ativa");
    if (s.status) status.push(`☠ ${s.status}`);
    if (s.bargained) status.push("👁 Sombra de Erebos");
    const sig = status.join("|");
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.statusEl.innerHTML = status.map((t) => `<span>${t}</span>`).join("");
    }

    for (let i = 0; i < 4; i++) {
      const slot = this.slots[i];
      const b = s.bestows[i];
      if (!b) {
        if (!slot.root.classList.contains("empty")) {
          slot.root.className = "bestow-slot empty";
          slot.icon.textContent = String(i + 1);
          slot.root.title = `Slot ${i + 1} vazio`;
        }
        continue;
      }
      const cls = `bestow-slot ${b.bestow.godId}${b.active ? " active" : ""}${b.cooldown > 0 ? " cooling" : ""}`;
      if (slot.root.className !== cls) slot.root.className = cls;
      if (slot.icon.textContent !== b.bestow.icon) {
        slot.icon.textContent = b.bestow.icon;
        slot.root.title = `[${i + 1}] ${b.bestow.name}: ${b.bestow.description}`;
      }
      slot.cd.style.height = b.active ? `${(1 - b.activeFraction) * 100}%` : `${b.cooldown * 100}%`;
    }
  }

  private setMark(el: HTMLDivElement, next: number | null): void {
    if (next === null) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    el.style.left = `${next}%`;
    el.title = `Próxima bênção: ${next}`;
  }

  show(): void {
    this.container.style.display = "flex";
  }

  hide(): void {
    this.container.style.display = "none";
  }
}
