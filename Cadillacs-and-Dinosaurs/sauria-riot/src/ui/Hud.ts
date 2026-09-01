export interface HudPayload {
  hp: number;
  maxHp: number;
  score: number;
  lives: number;
  combo: number;
  name: string;
  special: string;
  ammo: number;
  weapon: string;
  boss: { name: string; hp: number; max: number } | null;
}

export class Hud {
  private root: HTMLElement;
  private hpFill!: HTMLElement;
  private hpText!: HTMLElement;
  private scoreEl!: HTMLElement;
  private livesEl!: HTMLElement;
  private comboEl!: HTMLElement;
  private nameEl!: HTMLElement;
  private gunEl!: HTMLElement;
  private bossWrap!: HTMLElement;
  private bossFill!: HTMLElement;
  private bossName!: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud-root is-hidden";
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-fighter">
          <div class="hud-name" id="hud-name">ROOK HALE</div>
          <div class="hp-track"><div class="hp-fill" id="hp-fill"></div></div>
          <div class="hud-sub">
            <span id="hp-text">150</span>
            <span id="hud-gun">REVÓLVER 6</span>
          </div>
        </div>
        <div class="hud-meta">
          <div class="hud-score" id="hud-score">000000</div>
          <div class="hud-lives" id="hud-lives">VIDAS 2</div>
        </div>
      </div>
      <div class="hud-combo is-hidden" id="hud-combo">2 HIT</div>
      <div class="boss-wrap is-hidden" id="boss-wrap">
        <div class="boss-name" id="boss-name">ASHJAW</div>
        <div class="boss-track"><div class="boss-fill" id="boss-fill"></div></div>
      </div>
    `;
    parent.appendChild(this.root);
    this.hpFill = this.root.querySelector("#hp-fill") as HTMLElement;
    this.hpText = this.root.querySelector("#hp-text") as HTMLElement;
    this.scoreEl = this.root.querySelector("#hud-score") as HTMLElement;
    this.livesEl = this.root.querySelector("#hud-lives") as HTMLElement;
    this.comboEl = this.root.querySelector("#hud-combo") as HTMLElement;
    this.nameEl = this.root.querySelector("#hud-name") as HTMLElement;
    this.gunEl = this.root.querySelector("#hud-gun") as HTMLElement;
    this.bossWrap = this.root.querySelector("#boss-wrap") as HTMLElement;
    this.bossFill = this.root.querySelector("#boss-fill") as HTMLElement;
    this.bossName = this.root.querySelector("#boss-name") as HTMLElement;
  }

  public show(): void {
    this.root.classList.remove("is-hidden");
  }
  public hide(): void {
    this.root.classList.add("is-hidden");
  }

  public apply(data: HudPayload): void {
    const pct = Math.max(0, data.hp / data.maxHp) * 100;
    this.hpFill.style.width = `${pct}%`;
    this.hpFill.classList.toggle("is-low", pct < 30);
    this.hpText.textContent = `${Math.ceil(data.hp)} / ${data.maxHp}`;
    this.scoreEl.textContent = String(data.score).padStart(6, "0");
    this.livesEl.textContent = `VIDAS ${data.lives}`;
    this.nameEl.textContent = data.name.toUpperCase();
    const extra = data.weapon === "pipe" ? " · CANO" : "";
    this.gunEl.textContent = `${data.special} · MUN ${data.ammo}${extra}`;
    if (data.combo >= 2) {
      this.comboEl.classList.remove("is-hidden");
      this.comboEl.textContent = `${data.combo} HIT`;
    } else {
      this.comboEl.classList.add("is-hidden");
    }
    if (data.boss) {
      this.bossWrap.classList.remove("is-hidden");
      this.bossName.textContent = data.boss.name.toUpperCase();
      this.bossFill.style.width = `${Math.max(0, data.boss.hp / data.boss.max) * 100}%`;
    } else {
      this.bossWrap.classList.add("is-hidden");
    }
  }
}
