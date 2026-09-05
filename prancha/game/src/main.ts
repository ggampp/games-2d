import { Game } from "./game.ts";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas missing");

const game = new Game(canvas);
void game.start();
