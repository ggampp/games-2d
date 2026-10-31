// Usage: node --experimental-strip-types test/probe.ts <levelId> '<json pieces>'
// pieces: [{"type":"prism","x":420,"y":380,"angle":30}]
import { levelById } from '../src/core/levels.ts';
import { hintsToPieces, probe, type Hint } from './solver.ts';

const level = levelById(Number(process.argv[2]));
if (!level) throw new Error('no such level');
const hints: Hint[] = process.argv[3] ? JSON.parse(process.argv[3]) : [];
console.log(probe(level, hintsToPieces(hints)));
