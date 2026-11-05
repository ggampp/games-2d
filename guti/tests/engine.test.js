import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, MAP_BY_ID } from '../src/maps.js';
import { compileMap, createState, legalMoves, applyMove, gameStatus, countPieces, DEFAULT_RULES } from '../src/engine.js';

const id = (map, ...ids) => ids.map((x) => map.idx(x));
const names = (map, is) => is.map((i) => map.nodes[i].id);

test('todos os mapas: grafo conexo, simétrico e com início equilibrado', () => {
  for (const def of MAPS) {
    const map = compileMap(def);
    assert.equal(new Set(def.nodes.map((n) => n[0])).size, def.nodes.length, `${def.id}: ids repetidos`);
    assert.equal(def.start[1].length, def.start[2].length, `${def.id}: lados desiguais`);
    // Conexo
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) for (const j of map.adj[stack.pop()]) if (!seen.has(j)) seen.add(j), stack.push(j);
    assert.equal(seen.size, map.n, `${def.id}: grafo desconexo`);
    // Vizinhança simétrica, casas dentro da área
    map.adj.forEach((a, i) => a.forEach((j) => assert.ok(map.adj[j].includes(i))));
    for (const n of map.nodes) assert.ok(n.x >= 0 && n.x <= def.width && n.y >= 0 && n.y <= def.height);
    // Ao menos uma casa vazia e um lance inicial
    const s = createState(map);
    assert.ok(s.board.includes(0), `${def.id}: sem casa vazia`);
    assert.ok(legalMoves(map, s).length > 0);
  }
});

test('Dois Ds: topologia observada no vídeo', () => {
  const map = compileMap(MAP_BY_ID.borboleta);
  assert.equal(map.n, 13);
  assert.deepEqual(names(map, map.adj[map.idx('C')]).sort(), ['Ly0', 'Ly1', 'Ry0', 'Ry1']);
  assert.deepEqual(names(map, map.adj[map.idx('La0')]).sort(), ['La1', 'Ltop', 'Ly0']);
  // O X é reto: de Ly1 salta-se o centro até Ry0.
  assert.ok(map.jumps[map.idx('Ly1')].some((j) => names(map, [j.over, j.to]).join() === 'C,Ry0'));
  // Abertura: só dá para entrar no centro.
  const s = createState(map);
  assert.deepEqual(legalMoves(map, s).map((m) => names(map, [m.from, ...m.steps]).join('>')).sort(), ['Ly0>C', 'Ly1>C']);
});

test('captura simples remove a peça e zera o contador de calma', () => {
  const map = compileMap(MAP_BY_ID.borboleta);
  let s = createState(map, { pieces: { 1: ['Ly1'], 2: ['C', 'Rtop'] } });
  s = { ...s, quiet: 7 };
  const moves = legalMoves(map, s);
  assert.equal(moves.length, 1, 'captura obrigatória');
  assert.deepEqual(names(map, moves[0].steps), ['Ry0']);
  const after = applyMove(s, moves[0]);
  assert.equal(countPieces(after, 2), 1);
  assert.equal(after.quiet, 0);
  assert.equal(after.lost[2], 1);
  assert.equal(after.turn, 2);
});

test('captura opcional quando a regra está desligada', () => {
  const map = compileMap(MAP_BY_ID.borboleta);
  const s = createState(map, { pieces: { 1: ['Ly1'], 2: ['C', 'Rtop'] } });
  const moves = legalMoves(map, s, { ...DEFAULT_RULES, forceCapture: false });
  assert.ok(moves.length > 1);
  assert.ok(moves.some((m) => m.caps.length === 0));
});

test('cadeia de saltos é completa e pode seguir pelo arco', () => {
  const map = compileMap(MAP_BY_ID.borboleta);
  const s = createState(map, { pieces: { 1: ['Lbot'], 2: ['Ly1', 'C', 'Ry0', 'Ra0'] } });
  const [m] = legalMoves(map, s);
  assert.deepEqual(names(map, m.steps), ['Ly0', 'Ry1', 'Rtop', 'Ra1']);
  assert.equal(m.caps.length, 4);
  assert.deepEqual(gameStatus(map, applyMove(s, m)), { over: true, winner: 1, reason: 'capture' });
  // Sem saltos pelos arcos, a cadeia para no Rtop.
  const noArc = { ...DEFAULT_RULES, arcJumps: false };
  const map2 = compileMap(MAP_BY_ID.borboleta, noArc);
  const [m2] = legalMoves(map2, createState(map2, { pieces: { 1: ['Lbot'], 2: ['Ly1', 'C', 'Ry0', 'Ra0'] } }), noArc);
  assert.equal(m2.caps.length, 3);
});

test('anel fechado permite saltar pela emenda', () => {
  const map = compileMap(MAP_BY_ID.roda);
  const s = createState(map, { pieces: { 1: ['O7'], 2: ['O0', 'O5'] } });
  const moves = legalMoves(map, s);
  assert.deepEqual(moves.map((m) => names(map, m.steps).join()), ['O1']);
});

test('pedras bloqueiam casa e salto', () => {
  const map = compileMap(MAP_BY_ID.alquerque);
  const s = createState(map, { rocks: ['2,2'], pieces: { 1: ['0,2'], 2: ['1,2'] } });
  const moves = legalMoves(map, s);
  assert.ok(moves.every((m) => m.caps.length === 0));
  assert.ok(!moves.some((m) => m.steps.includes(map.idx('2,2'))));
});

test('sem lances: passa a vez (padrão) ou perde (opcional)', () => {
  const map = compileMap(MAP_BY_ID.borboleta);
  // Tomate preso no Ltop: vizinhos ocupados por karelas protegidas.
  const pieces = { 1: ['Ltop'], 2: ['Ly0', 'Ly1', 'La0', 'La1'] };
  const s = createState(map, { pieces });
  const moves = legalMoves(map, s);
  assert.equal(moves.length, 1);
  assert.ok(moves[0].pass);
  const after = applyMove(s, moves[0]);
  assert.equal(after.turn, 2);
  assert.equal(gameStatus(map, s).over, false);
  const strict = { ...DEFAULT_RULES, blockedLoses: true };
  assert.deepEqual(gameStatus(map, s, strict), { over: true, winner: 2, reason: 'blocked' });
});

test('empate por lances sem captura', () => {
  const map = compileMap(MAP_BY_ID.borboleta);
  const s = { ...createState(map), quiet: 40 };
  assert.equal(gameStatus(map, s).winner, 0);
});

test('createState recusa casa ocupada duas vezes', () => {
  const map = compileMap(MAP_BY_ID.borboleta);
  assert.throws(() => createState(map, { pieces: { 1: ['C'], 2: ['C'] } }));
});
