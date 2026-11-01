// Regras puras do jogo (sem DOM). Usadas pela interface, pela IA e pelos testes.
//
// Casa: 0 vazia · 1 tomates · 2 karelas · 3 pedra (bloqueio).
// Lance: { from, steps: [destinos...], caps: [casas capturadas...] }.
// Capturas em cadeia são obrigatoriamente completas: depois de saltar, a peça
// continua saltando enquanto puder (escolhendo o caminho).

export const EMPTY = 0;
export const ROCK = 3;
export const other = (p) => (p === 1 ? 2 : 1);

export const DEFAULT_RULES = Object.freeze({
  forceCapture: true, // havendo captura, é obrigatório capturar
  arcJumps: true, // vale saltar ao longo das curvas
  quietLimit: 40, // lances seguidos sem captura → empate
  blockedLoses: false, // sem lances: perde (true) ou passa a vez (false)
});

export const PASS = Object.freeze({ from: -1, steps: [], caps: [], pass: true });

const compiled = new Map();

/** Converte a definição do mapa em índices, vizinhanças e saltos. */
export function compileMap(def, rules = DEFAULT_RULES) {
  const cacheKey = `${def.id}|${rules.arcJumps ? 1 : 0}`;
  if (compiled.has(cacheKey) && compiled.get(cacheKey).def === def) return compiled.get(cacheKey);

  const index = new Map(def.nodes.map(([id], i) => [id, i]));
  const n = def.nodes.length;
  const adjSets = Array.from({ length: n }, () => new Set());
  const jumps = Array.from({ length: n }, () => []);
  const jumpSeen = new Set();
  const idx = (id) => {
    if (!index.has(id)) throw new Error(`Mapa ${def.id}: casa desconhecida ${id}`);
    return index.get(id);
  };

  const paths = def.paths.map((p) => ({ ...p, idx: p.nodes.map(idx) }));
  for (const p of paths) {
    const seq = p.closed ? [...p.idx, p.idx[0], p.idx[1]] : p.idx;
    for (let i = 0; i + 1 < seq.length; i++) {
      adjSets[seq[i]].add(seq[i + 1]);
      adjSets[seq[i + 1]].add(seq[i]);
    }
    if (p.kind === 'arc' && !rules.arcJumps) continue;
    for (let i = 0; i + 2 < seq.length; i++) {
      const [a, b, c] = [seq[i], seq[i + 1], seq[i + 2]];
      for (const [f, t] of [[a, c], [c, a]]) {
        const k = `${f}>${b}>${t}`;
        if (f === t || jumpSeen.has(k)) continue;
        jumpSeen.add(k);
        jumps[f].push({ over: b, to: t });
      }
    }
  }

  const map = {
    def,
    id: def.id,
    n,
    nodes: def.nodes.map(([id, x, y]) => ({ id, x, y })),
    index,
    idx,
    adj: adjSets.map((s) => [...s]),
    jumps,
    paths,
  };
  compiled.set(cacheKey, map);
  return map;
}

/**
 * Estado inicial. `setup` pode trazer posições próprias (fases):
 * { pieces: {1: [ids], 2: [ids]}, rocks: [ids], first }.
 */
export function createState(map, setup = {}) {
  const board = new Array(map.n).fill(EMPTY);
  const pieces = setup.pieces || map.def.start;
  for (const id of setup.rocks || []) board[map.idx(id)] = ROCK;
  for (const p of [1, 2]) {
    for (const id of pieces[p]) {
      const i = map.idx(id);
      if (board[i] !== EMPTY) throw new Error(`Casa ${id} ocupada duas vezes`);
      board[i] = p;
    }
  }
  return {
    board,
    turn: setup.first || 1,
    ply: 0,
    quiet: 0,
    lost: { 1: 0, 2: 0 },
    last: null,
  };
}

export function countPieces(state, player) {
  let c = 0;
  for (const v of state.board) if (v === player) c++;
  return c;
}

function captureChains(map, board, player, from) {
  const out = [];
  const enemy = other(player);
  const walk = (at, steps, caps) => {
    let extended = false;
    for (const { over, to } of map.jumps[at]) {
      if (board[over] !== enemy || board[to] !== EMPTY) continue;
      extended = true;
      board[over] = EMPTY;
      board[at] = EMPTY;
      board[to] = player;
      walk(to, [...steps, to], [...caps, over]);
      board[to] = EMPTY;
      board[at] = player;
      board[over] = enemy;
    }
    if (!extended && steps.length) out.push({ from, steps, caps });
  };
  walk(from, [], []);
  return out;
}

/** Todos os lances legais do jogador da vez. */
export function legalMoves(map, state, rules = DEFAULT_RULES) {
  const board = state.board.slice();
  const player = state.turn;
  const captures = [];
  const simple = [];
  for (let i = 0; i < map.n; i++) {
    if (board[i] !== player) continue;
    captures.push(...captureChains(map, board, player, i));
    for (const j of map.adj[i]) {
      if (board[j] === EMPTY) simple.push({ from: i, steps: [j], caps: [] });
    }
  }
  captures.sort((a, b) => b.caps.length - a.caps.length);
  if (rules.forceCapture && captures.length) return captures;
  const all = captures.concat(simple);
  if (all.length === 0 && !rules.blockedLoses && countPieces(state, player) > 0) return [PASS];
  return all;
}

export function applyMove(state, move) {
  if (move.pass) {
    return { ...state, turn: other(state.turn), ply: state.ply + 1, quiet: state.quiet + 1, last: move };
  }
  const board = state.board.slice();
  const player = board[move.from];
  board[move.from] = EMPTY;
  for (const c of move.caps) board[c] = EMPTY;
  board[move.steps[move.steps.length - 1]] = player;
  const lost = { ...state.lost };
  lost[other(player)] += move.caps.length;
  return {
    board,
    turn: other(player),
    ply: state.ply + 1,
    quiet: move.caps.length ? 0 : state.quiet + 1,
    lost,
    last: move,
  };
}

/** Resultado: { over, winner (1|2|0 empate), reason }. */
export function gameStatus(map, state, rules = DEFAULT_RULES) {
  for (const p of [1, 2]) {
    if (countPieces(state, p) === 0) return { over: true, winner: other(p), reason: 'capture' };
  }
  const moves = legalMoves(map, state, rules);
  if (moves.length === 0) {
    return { over: true, winner: other(state.turn), reason: 'blocked' };
  }
  if (moves[0].pass && legalMoves(map, { ...state, turn: other(state.turn) }, rules)[0]?.pass) {
    return { over: true, winner: 0, reason: 'stalemate' };
  }
  if (rules.quietLimit && state.quiet >= rules.quietLimit) {
    return { over: true, winner: 0, reason: 'quiet' };
  }
  return { over: false, winner: null, reason: null };
}

export const sameMove = (a, b) =>
  a.from === b.from && a.steps.length === b.steps.length && a.steps.every((s, i) => s === b.steps[i]);
