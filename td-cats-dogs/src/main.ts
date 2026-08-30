import "./styles.css";
import { UI } from "./data/kit.ts";
import { createGame } from "./game/createGame.ts";
import { EndScreen } from "./ui/EndScreen.ts";
import { Hud, type HudState } from "./ui/Hud.ts";

function bootstrap() {
  const container = document.getElementById("game-container");
  const overlay = document.getElementById("ui-overlay");
  if (!container || !overlay) return;

  const game = createGame(container);
  const playBtn = document.getElementById("btn-play") as HTMLButtonElement | null;
  if (playBtn) playBtn.style.backgroundImage = `url("${UI.btnGreen}")`;
  playBtn?.addEventListener("click", () => {
    playBtn.hidden = true;
    game.scene.stop("TitleScene");
    game.scene.start("BattleScene");
  });
  const hud = new Hud(
    overlay,
    () => game.events.emit("hud-upgrade"),
    () => game.events.emit("hud-repair"),
  );
  const end = new EndScreen(
    overlay,
    () => {
      end.hide();
      if (playBtn) playBtn.hidden = true;
      game.scene.stop("BattleScene");
      game.scene.start("BattleScene");
    },
    () => {
      end.hide();
      if (playBtn) playBtn.hidden = false;
      game.scene.stop("BattleScene");
      game.scene.start("TitleScene");
    },
  );

  game.events.on("battle-hud", (state: HudState | null) => {
    hud.set(state);
    if (state && playBtn) playBtn.hidden = true;
  });
  game.events.on("battle-end", (result: { won: boolean; coins: number; hp: number }) => {
    end.show(result.won, result.coins, result.hp);
  });
}

window.addEventListener("DOMContentLoaded", bootstrap);
