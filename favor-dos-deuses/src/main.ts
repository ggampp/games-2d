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

  const hud = new Hud(overlay);
  const dialog = new Dialog(overlay);
  const toast = new MessageToast(overlay);

  game.events.on("hud-update", (state: HudState) => {
    hud.update(state);
  });

  game.events.on("show-dialog", (data: DialogData) => {
    dialog.show(data);
  });

  game.events.on("hide-dialog", () => {
    dialog.hide();
  });

  game.events.on("show-message", (text: string) => {
    toast.show(text);
  });

  const controlsHint = document.createElement("div");
  controlsHint.style.cssText = `
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.7);
    color: #999;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 11px;
    pointer-events: none;
  `;
  controlsHint.textContent = UI_STRINGS.controls;
  overlay.appendChild(controlsHint);
}

window.addEventListener("DOMContentLoaded", bootstrap);
