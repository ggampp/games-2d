import { Game } from './game.ts';
import { audio } from './audio.ts';

window.addEventListener('DOMContentLoaded', () => {
  new Game();
  const unlock = () => { audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
});
