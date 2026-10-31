import "./styles.css";
import { createGame } from "./game/createGame";
import { Hud, type HudState } from "./ui/Hud";
import { Dialog, type DialogData } from "./ui/Dialog";
import { MessageToast } from "./ui/MessageToast";
import { UI_STRINGS } from "./data/constants";

function bootstrap(): void {
  const container = document.getElementById("game-container");
  const overlay = document.getElementById("ui-overlay");
  if (!container || !overlay) {
    console.error("Missing required DOM elements");
    return;
  }

  const game = createGame(container);
  // acesso para ferramentas de QA/debug (screenshots automatizados)
  (window as any).__fdd = { game };

  const hud = new Hud(overlay);
  hud.hide();
  const dialog = new Dialog(overlay);
  const toast = new MessageToast(overlay);

  // --- overlays DOM ---
  const hitFlash = document.createElement("div");
  hitFlash.className = "hit-flash";
  overlay.appendChild(hitFlash);

  const blind = document.createElement("div");
  blind.className = "blind-overlay";
  overlay.appendChild(blind);

  const banner = document.createElement("div");
  banner.className = "location-banner";
  overlay.appendChild(banner);
  let bannerTimer = 0;

  const pause = document.createElement("div");
  pause.className = "pause-overlay";
  pause.innerHTML = `
    <div class="pause-card">
      <h2>${UI_STRINGS.paused}</h2>
      <p class="pause-controls">${UI_STRINGS.controls.replace(/•/g, "<br>")}</p>
      <div class="pause-bestows"></div>
      <p class="pause-tip">Esc ou clique para continuar · <button class="pause-title">Voltar ao título</button></p>
    </div>`;
  overlay.appendChild(pause);
  let pausedScene: string | null = null;

  const resume = () => {
    if (!pausedScene) return;
    const key = pausedScene;
    pausedScene = null;
    pause.classList.remove("show");
    game.scene.resume(key);
  };

  pause.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("pause-title")) {
      const key = pausedScene;
      pausedScene = null;
      pause.classList.remove("show");
      if (key) {
        game.scene.stop(key);
        game.scene.start("TitleScene");
      }
      return;
    }
    resume();
  });

  window.addEventListener("keydown", (e) => {
    if (pausedScene && (e.code === "Escape" || e.code === "KeyP")) {
      e.preventDefault();
      resume();
    }
  });

  const controlsHint = document.createElement("div");
  controlsHint.className = "controls-hint";
  controlsHint.textContent = UI_STRINGS.controls;
  overlay.appendChild(controlsHint);

  // --- eventos do jogo ---
  game.events.on("hud-update", (state: HudState) => hud.update(state));
  game.events.on("hud-visible", (v: boolean) => {
    if (v) hud.show();
    else hud.hide();
    controlsHint.style.display = v ? "block" : "none";
  });

  game.events.on("show-dialog", (data: DialogData) => dialog.show(data));
  game.events.on("hide-dialog", () => dialog.hide());

  game.events.on("show-message", (data: { text: string; duration?: number } | string) => {
    if (typeof data === "string") toast.show(data);
    else toast.show(data.text, data.duration);
  });

  game.events.on("show-location", (data: { name: string; color: string }) => {
    hud.show();
    controlsHint.style.display = "block";
    banner.textContent = data.name;
    banner.style.color = data.color;
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => banner.classList.remove("show"), 2600);
  });

  game.events.on("player-hit", () => {
    hitFlash.classList.remove("show");
    void hitFlash.offsetWidth;
    hitFlash.classList.add("show");
  });

  game.events.on("blind", (on: boolean) => blind.classList.toggle("show", on));
  game.events.on("blind-pos", (p: { x: number; y: number }) => {
    const canvas = container.querySelector("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / canvas.width;
    const sy = rect.height / canvas.height;
    blind.style.setProperty("--bx", `${rect.left + p.x * sx}px`);
    blind.style.setProperty("--by", `${rect.top + p.y * sy}px`);
  });

  const pauseBestows = pause.querySelector(".pause-bestows") as HTMLDivElement;
  const fillPauseBestows = () => {
    const s = hud.lastState;
    const slots = s ? s.bestows.filter((b): b is NonNullable<typeof b> => !!b) : [];
    pauseBestows.innerHTML =
      slots.length === 0
        ? `<p class="pause-empty">Nenhuma bênção ainda — ganhe 25 de Devoção com um deus.</p>`
        : slots
            .map((b, i) => `<div class="pause-bestow ${b.bestow.godId}"><span class="k">${i + 1}</span><span class="i">${b.bestow.icon}</span><b>${b.bestow.name}</b><span>${b.bestow.description}</span></div>`)
            .join("");
  };

  game.events.on("paused", (key: string) => {
    pausedScene = key;
    fillPauseBestows();
    pause.classList.add("show");
  });

  // pausa automática ao perder o foco da janela
  window.addEventListener("blur", () => {
    const active = game.scene.getScenes(true).find((s) => ["HubScene", "WildsScene", "DungeonScene"].includes(s.scene.key));
    if (active && !pausedScene && !dialog.isVisible()) {
      pausedScene = active.scene.key;
      fillPauseBestows();
      pause.classList.add("show");
      game.scene.pause(active.scene.key);
    }
  });
}

window.addEventListener("DOMContentLoaded", bootstrap);
