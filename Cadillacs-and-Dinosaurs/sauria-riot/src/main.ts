import "./styles.css";
import { createGame } from "./game/createGame.js";
import { Hud, type HudPayload } from "./ui/Hud.js";
import { TouchControls } from "./ui/TouchControls.js";
import { audio } from "./audio/GameAudio.js";
import type { GameScene } from "./game/scenes/GameScene.js";

function bootstrap() {
  const container = document.getElementById("game-container");
  const uiOverlay = document.getElementById("ui-overlay");
  if (!container || !uiOverlay) return;

  const game = createGame(container);
  const hud = new Hud(uiOverlay);
  let touch: TouchControls | null = null;

  const unlock = () => audio.unlock();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });

  game.events.on("hud-hide", () => {
    hud.hide();
    touch?.destroy();
    touch = null;
  });

  game.events.on("match-start", () => {
    hud.show();
    const scene = game.scene.getScene("GameScene") as GameScene;
    if (scene?.inputManager && !touch) {
      const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 820;
      if (coarse) touch = new TouchControls(uiOverlay, scene.inputManager);
    }
  });

  game.events.on("match-end", () => {
    hud.hide();
    touch?.destroy();
    touch = null;
  });

  game.events.on("hud", (data: HudPayload) => hud.apply(data));
}

window.addEventListener("DOMContentLoaded", bootstrap);
