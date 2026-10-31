// Proves every playable level can be solved with its inventory, and records a reference solution.
// Run: npm test   (node --experimental-strip-types)
import { LEVELS } from '../src/core/levels.ts';
import { solve, type Hint } from './solver.ts';
import { writeFileSync } from 'node:fs';

/** Reference solution hints per level. Angles left undefined are searched by the solver. */
export const HINTS: Record<number, Hint[]> = {
  1: [{ type: 'mirror', x: 600, y: 450 }],
  2: [{ type: 'mirror', x: 760, y: 450 }, { type: 'mirror', x: 760, y: 780 }],
  3: [{ type: 'prism', x: 420, y: 380 }],
  4: [{ type: 'filter', x: 400, y: 430 }],
  5: [{ type: 'dichroic', x: 450, y: 450 }, { type: 'filter', x: 620, y: 450 }],
  6: [{ type: 'lens', x: 440, y: 475 }],
  7: [{ type: 'orb', x: 420, y: 470 }],
  8: [{ type: 'mirror', x: 760, y: 150 }],
  9: [{ type: 'mirror', x: 450, y: 450 }],
  10: [{ type: 'mirror', x: 740, y: 660 }],
  11: [{ type: 'mirror', x: 700, y: 700 }],
  12: [{ type: 'mirror', x: 700, y: 250 }, { type: 'prism', x: 420, y: 650 }],
  13: [{ type: 'prism', x: 300, y: 300 }],
  70: [
    { type: 'lens', x: 235, y: 195, angle: 135 },
    { type: 'prism', x: 600, y: 510, angle: 46 },
    { type: 'dichroic', x: 250, y: 520, angle: 45 },
    { type: 'mirror', x: 420, y: 520, angle: -22.5 },
    { type: 'orb', x: 580, y: 400, angle: 0 },
    { type: 'mirror', x: 720, y: 62 }
  ]
};

const only = process.argv[2] ? Number(process.argv[2]) : null;
let failed = 0;
const solutions: Record<number, { type: string; x: number; y: number; angle: number }[]> = {};

for (const level of LEVELS) {
  if (level.sandbox) continue;
  if (only !== null && level.id !== only) continue;
  const hints = HINTS[level.id];
  if (!hints) { console.log(`level ${level.id}: no hints`); failed++; continue; }
  const inv = { ...level.inventory };
  for (const h of hints) {
    inv[h.type] = (inv[h.type] ?? 0) - 1;
    if (inv[h.type]! < 0) { console.log(`level ${level.id}: hints exceed inventory for ${h.type}`); failed++; }
  }
  const t0 = performance.now();
  const r = solve(level, hints);
  const ms = (performance.now() - t0).toFixed(0);
  const ok = r.lit === r.total;
  if (!ok) failed++;
  console.log(
    `level ${String(level.id).padStart(2)} ${level.name.padEnd(12)} ${ok ? 'OK ' : 'FAIL'} ${r.lit}/${r.total} (${ms}ms)  ` +
    r.pieces.map((p) => `${p.type}@${p.x},${p.y} ${((p.angle * 180) / Math.PI).toFixed(1)}°`).join(' | ')
  );
  solutions[level.id] = r.pieces.map((p) => ({ type: p.type, x: p.x, y: p.y, angle: +(p.angle * 180 / Math.PI).toFixed(2) }));
}

if (only === null) {
  writeFileSync(new URL('./solutions.json', import.meta.url), JSON.stringify(solutions, null, 2));
}
if (failed) { console.log(`${failed} level(s) unsolved`); process.exit(1); }
console.log('all levels solvable');
