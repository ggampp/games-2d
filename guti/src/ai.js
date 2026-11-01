// IA: negamax com poda alfa-beta, aprofundamento iterativo, tabela de
// transposição e ordenação de lances (capturas primeiro).

import { legalMoves, applyMove, countPieces, other } from './engine.js';

export const LEVELS = {
  iniciante: { label: 'Iniciante', depth: 1, noise: 120, randomPick: 0.45 },
  facil: { label: 'Fácil', depth: 2, noise: 60, randomPick: 0.15 },
  medio: { label: 'Médio', depth: 4, noise: 12, randomPick: 0 },
  dificil: { label: 'Difícil', depth: 6, noise: 0, randomPick: 0, timeMs: 700 },
  mestre: { label: 'Mestre', depth: 14, noise: 0, randomPick: 0, timeMs: 1400 },
};

const WIN = 100000;

function evaluate(map, state, rules, player, toMove) {
  const me = countPieces(state, player);
  const op = countPieces(state, other(player));
  let score = (me - op) * 100;
  // Mobilidade e ameaças.
  const waiting = legalMoves(map, { ...state, turn: other(state.turn) }, rules);
  const mine = state.turn === player ? toMove : waiting;
  const theirs = state.turn === player ? waiting : toMove;
  score += (mine.length - theirs.length) * 3;
  const threat = (ms) => ms.reduce((m, mv) => Math.max(m, mv.caps.length), 0);
  // Quem está com a vez aproveita a ameaça; o outro apenas a sofre parcialmente.
  if (state.turn === player) score += threat(mine) * 60 - threat(theirs) * 25;
  else score += threat(mine) * 25 - threat(theirs) * 60;
  // Casas mais conectadas valem um pouco mais.
  for (let i = 0; i < map.n; i++) {
    const v = state.board[i];
    if (v === player) score += map.adj[i].length;
    else if (v === other(player)) score -= map.adj[i].length;
  }
  return score;
}

class Timeout extends Error {}

export function chooseMove(map, state, rules, levelKey = 'medio', rng = Math.random) {
  const level = LEVELS[levelKey] || LEVELS.medio;
  const moves = legalMoves(map, state, rules);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  if (level.randomPick && rng() < level.randomPick) {
    return moves[Math.floor(rng() * moves.length)];
  }

  const player = state.turn;
  const deadline = level.timeMs ? Date.now() + level.timeMs : Infinity;
  const tt = new Map();
  let nodes = 0;

  const negamax = (s, depth, alpha, beta, ply) => {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new Timeout();
    const sign = s.turn === player ? 1 : -1;
    if (countPieces(s, s.turn) === 0) return -WIN + ply;
    const ms = legalMoves(map, s, rules);
    if (ms.length === 0) return -WIN + ply;
    if (ms[0].pass && s.last?.pass) return 0; // ninguém consegue mexer
    if (rules.quietLimit && s.quiet >= rules.quietLimit) return 0;
    if (depth === 0) return sign * evaluate(map, s, rules, player, ms);

    const key = s.board.join('') + s.turn + (s.quiet > rules.quietLimit - 8 ? `q${s.quiet}` : '');
    const hit = tt.get(key);
    if (hit && hit.depth >= depth) {
      if (hit.flag === 0) return hit.value;
      if (hit.flag === 1 && hit.value >= beta) return hit.value;
      if (hit.flag === -1 && hit.value <= alpha) return hit.value;
    }
    if (hit && hit.best != null && hit.best < ms.length) {
      const [b] = ms.splice(hit.best, 1);
      ms.unshift(b);
    }
    const a0 = alpha;
    let best = -Infinity;
    let bestIdx = 0;
    for (let i = 0; i < ms.length; i++) {
      // Capturas estendem a busca um pouco para evitar o efeito horizonte.
      const ext = ms[i].caps.length && depth === 1 && ply < 12 ? 1 : 0;
      const v = -negamax(applyMove(s, ms[i]), depth - 1 + ext, -beta, -alpha, ply + 1);
      if (v > best) {
        best = v;
        bestIdx = i;
      }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    tt.set(key, { depth, value: best, flag: best <= a0 ? -1 : best >= beta ? 1 : 0, best: bestIdx });
    return best;
  };

  let scored = moves.map((m) => ({ m, v: 0 }));
  for (let d = 1; d <= level.depth; d++) {
    try {
      const next = [];
      let alpha = -Infinity;
      for (const { m } of scored) {
        // Com ruído precisamos do valor exato de cada lance (janela cheia).
        const beta = level.noise ? Infinity : -alpha + 1;
        const v = -negamax(applyMove(state, m), d - 1, -Infinity, beta, 1);
        next.push({ m, v });
        if (v > alpha) alpha = v;
      }
      next.sort((a, b) => b.v - a.v);
      scored = next;
      if (scored[0].v >= WIN - 100) break; // vitória forçada encontrada
    } catch (e) {
      if (e instanceof Timeout) break;
      throw e;
    }
  }

  if (level.noise) {
    const noisy = scored.map(({ m, v }) => ({ m, v: v + (rng() - 0.5) * 2 * level.noise }));
    noisy.sort((a, b) => b.v - a.v);
    return noisy[0].m;
  }
  const top = scored.filter((s) => s.v === scored[0].v);
  return top[Math.floor(rng() * top.length)].m;
}
