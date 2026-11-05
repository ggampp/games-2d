// Roda a IA fora da thread principal para a animação não travar.
import { MAP_BY_ID } from './maps.js';
import { compileMap } from './engine.js';
import { chooseMove } from './ai.js';

self.onmessage = (e) => {
  const { id, mapId, mapDef, rules, state, level } = e.data;
  const map = compileMap(mapDef || MAP_BY_ID[mapId], rules);
  const move = chooseMove(map, state, rules, level);
  self.postMessage({ id, move });
};
