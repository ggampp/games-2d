import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, MAP_BY_ID } from '../src/maps.js';
import { compileMap, createState, legalMoves, applyMove, gameStatus, DEFAULT_RULES } from '../src/engine.js';
import { chooseMove } from '../src/ai.js';
import { LEVELS, starsFor } from '../src/levels.js';

const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('IA encontra a captura que vence', () => {
  const map = compileMap(MAP_BY_ID.borboleta);
  const s = createState(map, { pieces: { 1: ['Lbot', 'La0'], 2: ['Ly1', 'C', 'Ry0', 'Ra0'] } });
  for (const lv of ['medio', 'dificil', 'mestre']) {
    const m = chooseMove(map, s, DEFAULT_RULES, lv);
    assert.equal(gameStatus(map, applyMove(s, m)).winner, 1, lv);
  }
});

test('IA evita entregar peça de graça', () => {
  // Tomates: mover Ly1→C entregaria a peça (Ry0 salta para Ly1).
  const map = compileMap(MAP_BY_ID.borboleta);
  const rules = { ...DEFAULT_RULES, forceCapture: false };
  const s = createState(map, { pieces: { 1: ['Ly1', 'Lbot'], 2: ['Ry0', 'Rtop'] } });
  const m = chooseMove(map, s, rules, 'medio');
  assert.notEqual(map.nodes[m.steps[0]].id, 'C');
});

test('IA sempre devolve lance legal e partidas terminam', () => {
  for (const def of MAPS) {
    const map = compileMap(def);
    let s = createState(map);
    const rng = seeded(def.id.length * 7919);
    let n = 0;
    while (!gameStatus(map, s).over && n < 400) {
      const m = chooseMove(map, s, DEFAULT_RULES, n % 2 ? 'facil' : 'iniciante', rng);
      assert.ok(legalMoves(map, s).some((x) => x === m || (x.from === m.from && x.steps.join() === m.steps.join())));
      s = applyMove(s, m);
      n++;
    }
    assert.ok(gameStatus(map, s).over, `${def.id} não terminou`);
  }
});

test('níveis mais fortes vencem os mais fracos', () => {
  const map = compileMap(MAP_BY_ID['lau-kata-kati']);
  let strong = 0;
  for (let g = 0; g < 4; g++) {
    const rng = seeded(1234 + g);
    const strongSide = g % 2 ? 1 : 2;
    let s = createState(map);
    while (!gameStatus(map, s).over) {
      s = applyMove(s, chooseMove(map, s, DEFAULT_RULES, s.turn === strongSide ? 'medio' : 'iniciante', rng));
    }
    if (gameStatus(map, s).winner === strongSide) strong++;
  }
  assert.ok(strong >= 3, `médio venceu só ${strong}/4`);
});

test('fases: posições válidas e quebra-cabeças com solução', () => {
  for (const lv of LEVELS) {
    const def = MAP_BY_ID[lv.map];
    assert.ok(def, `fase ${lv.id}: mapa ${lv.map}`);
    const map = compileMap(def);
    const s = createState(map, { ...(lv.setup || {}), first: lv.first || 1 });
    assert.ok(legalMoves(map, s).length > 0);
    if (lv.limit === 1) {
      const wins = legalMoves(map, s).filter((m) => gameStatus(map, applyMove(s, m)).winner === (lv.side || 1));
      assert.equal(wins.length, 1, `fase ${lv.id}: deve ter exatamente uma solução`);
      assert.ok(legalMoves(map, s).length > 1 || lv.id === 3, `fase ${lv.id}: precisa de alternativa errada`);
    }
  }
  assert.deepEqual(LEVELS.map((l) => l.id), LEVELS.map((_, i) => i + 1));
});

test('estrelas', () => {
  const lv = { par: 10, maxLoss: 2 };
  assert.equal(starsFor(lv, { playerMoves: 9, piecesLost: 1 }), 3);
  assert.equal(starsFor(lv, { playerMoves: 12, piecesLost: 1 }), 2);
  assert.equal(starsFor(lv, { playerMoves: 12, piecesLost: 5 }), 1);
  assert.equal(starsFor({ limit: 1 }, { playerMoves: 1, piecesLost: 0 }), 3);
});
