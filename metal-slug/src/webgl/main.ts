import "../styles.css";
import { Input, type Action } from "../input";
import { Game } from "./game";

const must = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(id);
  return el as T;
};

const stage = must<HTMLDivElement>("stage");
const canvas = must<HTMLCanvasElement>("view");
const hud = must<HTMLDivElement>("hud");
const title = must<HTMLDivElement>("title");
const pause = must<HTMLDivElement>("pause");
const end = must<HTMLDivElement>("end");
const touch = must<HTMLDivElement>("touch");
const press = must<HTMLParagraphElement>("press");
const sub = must<HTMLParagraphElement>("sub");
const score = must<HTMLDivElement>("score");
const combo = must<HTMLDivElement>("combo");
const lives = must<HTMLDivElement>("lives");
const weapon = must<HTMLDivElement>("weapon");
const hpFill = must<HTMLDivElement>("hp-fill");
const banner = must<HTMLDivElement>("banner");
const mute = must<HTMLButtonElement>("mute");
const endTitle = must<HTMLHeadingElement>("end-title");
const endRank = must<HTMLParagraphElement>("end-rank");
const endStats = must<HTMLUListElement>("end-stats");

const game = new Game(canvas);
const input = new Input(canvas);
let shownEnd = false;

if (matchMedia("(pointer: coarse)").matches) touch.classList.add("on");

for (const btn of document.querySelectorAll<HTMLButtonElement>("#touch button")) {
  const action = btn.dataset.k as Action;
  const down = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    input.setTouch(action, true);
  };
  const up = () => input.setTouch(action, false);
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointerleave", up);
  btn.addEventListener("pointercancel", up);
}

window.addEventListener("resize", () => game.resize());

title.addEventListener("pointerdown", (e) => {
  if (game.mode !== "title" || title.classList.contains("ready") === false) return;
  e.preventDefault();
  begin();
});

must<HTMLButtonElement>("resume").addEventListener("click", () => {
  if (game.mode === "pause") game.mode = "play";
});
must<HTMLButtonElement>("retry").addEventListener("click", () => restart());
must<HTMLButtonElement>("again").addEventListener("click", () => restart());
mute.addEventListener("click", () => {
  game.sfx.setMuted(!game.sfx.muted);
  mute.textContent = game.sfx.muted ? "MUDO" : "SOM";
});

function begin(): void {
  if (game.mode !== "title") return;
  game.sfx.unlock();
  game.sfx.startMusic();
  game.mode = "play";
  title.hidden = true;
  hud.hidden = false;
}

function restart(): void {
  shownEnd = false;
  end.hidden = true;
  pause.hidden = true;
  hud.hidden = false;
  title.hidden = true;
  game.reset();
  game.sfx.unlock();
  game.sfx.startMusic();
}

function showEnd(): void {
  if (shownEnd) return;
  shownEnd = true;
  const win = game.mode === "win";
  endTitle.textContent = win ? "MISSÃO CUMPRIDA" : "FIM DE JOGO";
  endRank.textContent = win ? "O deserto ficou verde e amarelo." : "A camisa vermelha levou a melhor.";
  endStats.replaceChildren();
  for (const line of [
    `Amigos ${game.converted}/${game.goal}`,
    `Pontos ${String(game.score).padStart(6, "0")}`,
    `Tempo ${Math.ceil(game.time)}s`,
  ]) {
    const li = document.createElement("li");
    li.textContent = line;
    endStats.append(li);
  }
  end.hidden = false;
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  input.beginFrame();
  if (game.mode === "title" && title.classList.contains("ready") && input.pressed("ok")) begin();
  if (game.mode === "play" && input.pressed("pause")) game.mode = "pause";
  else if (game.mode === "pause" && input.pressed("pause")) game.mode = "play";
  if (input.pressed("mute")) {
    game.sfx.setMuted(!game.sfx.muted);
    mute.textContent = game.sfx.muted ? "MUDO" : "SOM";
  }
  game.update(dt, input);
  game.draw();
  input.consume();
  paint();
  requestAnimationFrame(frame);
}

function paint(): void {
  score.textContent = String(game.score).padStart(6, "0");
  lives.textContent = `VIDAS ${game.lives}`;
  weapon.textContent = `AMIGOS ${game.converted}/${game.goal}`;
  combo.hidden = game.combo < 2;
  combo.textContent = game.combo >= 2 ? `COMBO x${game.combo}` : "";
  hpFill.style.width = `${Math.max(0, game.hp)}%`;
  hpFill.style.background = game.hp < 35 ? "#ff4040" : "#3dff7a";
  banner.hidden = game.banner.length === 0;
  banner.textContent = game.banner;
  stage.classList.toggle("danger", game.mode === "play" && game.hp < 35);
  pause.hidden = game.mode !== "pause";
  hud.hidden = game.mode === "title";
  if (game.mode === "over" || game.mode === "win") showEnd();
}

paint();
game
  .load((label) => {
    sub.textContent = label;
  })
  .then(() => {
    title.classList.add("ready");
    press.textContent = "PRESSIONE ENTER";
    sub.textContent = "ou clique para começar";
    game.resize();
    requestAnimationFrame(frame);
  })
  .catch(() => {
    press.textContent = "NÃO CARREGOU";
    sub.textContent = "Faltou o modelo, o cenário ou as camisas. Rode npm run assets.";
  });
