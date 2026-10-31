import "./styles.css";
import { AudioBus } from "./audio";
import { Game, type Snapshot } from "./game";
import { Input } from "./input";

function must<T extends Element>(id: string): T {
  const el = document.querySelector<T>(id);
  if (!el) throw new Error(`Elemento ausente: ${id}`);
  return el;
}

const canvas = must<HTMLCanvasElement>("#view");
const title = must<HTMLElement>("#title");
const hud = must<HTMLElement>("#hud");
const pause = must<HTMLElement>("#pause");
const end = must<HTMLElement>("#end");
const touch = must<HTMLElement>("#touch");
const stage = must<HTMLElement>("#stage");

const audio = new AudioBus();
const input = new Input(canvas);
const game = new Game(canvas, audio, input);

const scoreEl = document.querySelector<HTMLElement>("#score");
const comboEl = document.querySelector<HTMLElement>("#combo");
const livesEl = document.querySelector<HTMLElement>("#lives");
const weaponEl = document.querySelector<HTMLElement>("#weapon");
const nadesEl = document.querySelector<HTMLElement>("#nades");
const hpFill = document.querySelector<HTMLElement>("#hp-fill");
const bossWrap = document.querySelector<HTMLElement>("#boss");
const bossFill = document.querySelector<HTMLElement>("#boss-fill");
const bannerEl = document.querySelector<HTMLElement>("#banner");
const muteBtn = document.querySelector<HTMLButtonElement>("#mute");
const endTitle = document.querySelector<HTMLElement>("#end-title");
const endRank = document.querySelector<HTMLElement>("#end-rank");
const endStats = document.querySelector<HTMLElement>("#end-stats");

const RANKS: Record<string, string> = {
  S: "LENDÁRIO",
  A: "IMPLACÁVEL",
  B: "FIRME",
  C: "SOBREVIVEU",
};

function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function show(mode: Snapshot["mode"], snap: Snapshot): void {
  title.hidden = mode !== "title";
  hud.hidden = mode === "title";
  pause.hidden = mode !== "pause";
  end.hidden = mode !== "over" && mode !== "win";
  touch.classList.toggle("on", mode === "play");
  if (mode === "over" || mode === "win") fillEnd(mode, snap);
}

function fillEnd(mode: Snapshot["mode"], snap: Snapshot): void {
  if (!endTitle || !endRank || !endStats) return;
  endTitle.textContent = mode === "win" ? "MISSÃO CUMPRIDA" : "FIM DE JOGO";
  endRank.textContent = mode === "win" ? `RANK ${snap.rank} — ${RANKS[snap.rank] ?? snap.rank}` : "A praça ficou vermelha.";
  endStats.innerHTML = "";
  const rows = [
    ["PONTOS", String(snap.score).padStart(6, "0")],
    ["TEMPO", clock(snap.time)],
    ["ABATES", String(snap.kills)],
    ["QUEDAS", String(snap.deaths)],
  ];
  for (const [k, v] of rows) {
    const li = document.createElement("li");
    li.textContent = `${k}  ${v}`;
    endStats.appendChild(li);
  }
}

function paintHud(s: Snapshot): void {
  if (scoreEl) scoreEl.textContent = String(s.score).padStart(6, "0");
  if (comboEl) {
    comboEl.hidden = s.combo < 2;
    comboEl.textContent = `COMBO x${s.combo}`;
  }
  if (livesEl) livesEl.textContent = `VIDAS ${s.lives}`;
  if (weaponEl) weaponEl.textContent = s.weapon;
  if (nadesEl) nadesEl.textContent = `GRANADA ${s.grenades}`;
  if (hpFill) {
    const pct = Math.max(0, Math.min(1, s.hp / s.hpMax));
    hpFill.style.width = `${pct * 100}%`;
    hpFill.style.background = pct < 0.3 ? "#ff4040" : pct < 0.6 ? "#ffd23a" : "#3dff7a";
  }
  if (bossWrap && bossFill) {
    bossWrap.hidden = s.boss < 0;
    bossFill.style.width = `${Math.max(0, s.boss) * 100}%`;
  }
  if (bannerEl) {
    bannerEl.hidden = s.banner.length === 0;
    bannerEl.textContent = s.banner;
  }
  if (muteBtn) muteBtn.textContent = s.muted ? "MUDO" : "SOM";
  stage.classList.toggle("danger", s.mode === "play" && s.hp > 0 && s.hp < 35);
  if ((s.mode === "over" || s.mode === "win") && !end.hidden) fillEnd(s.mode, s);
}

game.onMode = show;
game.onHud = paintHud;

title.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  game.start();
});

document.querySelector("#resume")?.addEventListener("click", () => game.resume());
document.querySelector("#retry")?.addEventListener("click", () => game.start());
document.querySelector("#again")?.addEventListener("click", () => game.start());
muteBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  game.toggleMute();
});

for (const btn of touch.querySelectorAll<HTMLButtonElement>("button[data-k]")) {
  const action = btn.dataset.k as "left" | "right" | "up" | "down" | "jump" | "shoot" | "grenade" | "bite";
  const down = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    input.setTouch(action, true);
    btn.setPointerCapture(e.pointerId);
  };
  const up = (e: PointerEvent) => {
    input.setTouch(action, false);
    e.preventDefault();
  };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
}
