/**
 * Harness headless de calibração da física.
 *   node scripts/calibrate.ts            (Node 22.18+ com type stripping)
 * Monta projetos de referência, roda o ensaio e imprime pico de esforço,
 * flecha, rupturas e travessia. Use para ajustar BASE_STRAIN / LOAD_PER_TON.
 */
import { getLevel, LEVELS, type LevelDef } from "../src/levels/catalog.ts";
import { BridgeSystem, type Design, type DesignMember } from "../src/sim/bridge.ts";
import { makeLayout } from "../src/sim/layout.ts";
import { LoadCase } from "../src/sim/loadcase.ts";
import { BASE_STRAIN, MATERIALS, TUNING, type MaterialId } from "../src/sim/materials.ts";
import { evaluate, limitFor } from "../src/sim/scoring.ts";
import { Vehicle } from "../src/sim/vehicle.ts";

type P = [number, number];
const seg = (m: MaterialId, a: P, b: P): DesignMember => ({ m, a, b });

/** Tabuleiro reto em peças de até `pieceM`. */
function deck(spanM: number, m: MaterialId, pieceM: number, y = 0): DesignMember[] {
  const n = Math.ceil(spanM / pieceM);
  const out: DesignMember[] = [];
  for (let i = 0; i < n; i++) out.push(seg(m, [(spanM * i) / n, y], [(spanM * (i + 1)) / n, y]));
  return out;
}

/** Treliça Warren com montantes: tabuleiro + banzo superior a `h` m. */
function warren(spanM: number, panels: number, h: number, deckM: MaterialId, chordM: MaterialId, diagM: MaterialId): DesignMember[] {
  const out: DesignMember[] = [];
  const px = spanM / panels;
  for (let i = 0; i < panels; i++) out.push(seg(deckM, [px * i, 0], [px * (i + 1), 0]));
  for (let i = 1; i < panels - 1; i++) out.push(seg(chordM, [px * i, -h], [px * (i + 1), -h]));
  for (let i = 1; i < panels; i++) out.push(seg(diagM, [px * i, 0], [px * i, -h]));
  for (let i = 0; i < panels; i++) {
    const lo: P = [px * i, 0];
    const hi: P = [px * (i + 1), -h];
    if (i === 0) out.push(seg(diagM, lo, [px, -h]));
    else if (i === panels - 1) out.push(seg(diagM, [px * i, -h], [spanM, 0]));
    else out.push(i % 2 === 0 ? seg(diagM, lo, hi) : seg(diagM, [px * i, -h], [px * (i + 1), 0]));
  }
  return out;
}

/** Warren em madeira com as `n` diagonais de cada extremidade em aço. */
function warrenEnds(spanM: number, panels: number, h: number, n = 1): DesignMember[] {
  const out = warren(spanM, panels, h, "wood", "wood", "wood");
  const px = spanM / panels;
  return out.map((d) => {
    const isDiag = d.a[1] !== d.b[1] && d.a[0] !== d.b[0];
    if (!isDiag) return d;
    const xmin = Math.min(d.a[0], d.b[0]);
    const fromLeft = Math.round(xmin / px);
    const fromRight = Math.round((spanM - Math.max(d.a[0], d.b[0])) / px);
    return fromLeft < n || fromRight < n ? { ...d, m: "steel" as MaterialId } : d;
  });
}

/** Treliça com diagonais em X (Pratt/Howe duplo): forças por barra menores. */
function xtruss(spanM: number, panels: number, h: number, deckM: MaterialId, chordM: MaterialId, diagM: MaterialId): DesignMember[] {
  const out: DesignMember[] = [];
  const px = spanM / panels;
  for (let i = 0; i < panels; i++) out.push(seg(deckM, [px * i, 0], [px * (i + 1), 0]));
  for (let i = 1; i < panels - 1; i++) out.push(seg(chordM, [px * i, -h], [px * (i + 1), -h]));
  for (let i = 1; i < panels; i++) out.push(seg(diagM, [px * i, 0], [px * i, -h]));
  for (let i = 0; i < panels; i++) {
    if (i > 0) out.push(seg(diagM, [px * i, 0], [px * (i + 1), -h]));
    if (i < panels - 1) out.push(seg(diagM, [px * i, -h], [px * (i + 1), 0]));
  }
  out[out.length - 1] = seg(diagM, [px * (panels - 1), -h], [spanM, 0]);
  out.push(seg(diagM, [0, 0], [px, -h]));
  return out;
}

/** Pórtico simples: tabuleiro + mastro central + tirantes em cabo. */
function kingpost(spanM: number, h: number, deckM: MaterialId, postM: MaterialId, tieM: MaterialId): DesignMember[] {
  const mid = spanM / 2;
  return [
    ...deck(spanM, deckM, 12),
    seg(postM, [mid, 0], [mid, -h]),
    seg(tieM, [0, 0], [mid, -h]),
    seg(tieM, [mid, -h], [spanM, 0]),
  ];
}

interface Scenario {
  name: string;
  level: LevelDef;
  design: DesignMember[];
}

function run(s: Scenario): void {
  const layout = makeLayout(s.level.spanM, s.level.biome);
  const bridge = new BridgeSystem(layout, s.level.mods);
  const design: Design = { v: 1, members: s.design };
  bridge.load(design);
  const dropped = s.design.length - bridge.members.filter((m) => !m.locked).length;
  const loads = new LoadCase(s.level.mods, layout);
  const runs = s.level.mods.vehicles ?? [{ id: s.level.vehicle, loadT: s.level.loadT, dir: 1 as const, delay: 0 }];
  const vehicles = runs.map((r) => new Vehicle(r.id, r.loadT, r.dir, r.delay, layout));
  bridge.resetPhysics();
  loads.reset();
  let firstBreak = -1;
  let t = 0;
  bridge.onBeamBreak = () => {
    if (firstBreak < 0) firstBreak = t;
  };
  bridge.presettle(loads);
  const selfWeightBroken = bridge.brokenCount;
  const dt = 1 / 60;
  let outcome: "crossed" | "fell" | "stuck" = "crossed";
  for (let i = 0; i < 60 * 40; i++) {
    t += dt;
    loads.update(dt);
    const road = bridge.roadBeams();
    for (const v of vehicles) v.update(dt, road, layout, loads.waterY, loads.trafficReleased);
    bridge.update(dt, loads, vehicles.flatMap((v) => v.loads));
    if (vehicles.some((v) => v.hasFallen)) {
      outcome = "fell";
      break;
    }
    if (vehicles.some((v) => v.stuckTime > 4)) {
      outcome = "stuck";
      break;
    }
    if (vehicles.every((v) => v.hasFinished)) break;
  }
  if (args.includes("--debug")) {
    for (const m of bridge.members) {
      console.log(`   member ${m.materialId} ${m.lengthM.toFixed(1)}m locked=${m.locked} segs=${m.segments.length} broken=${m.isBroken} a=(${m.a.initialPos.x.toFixed(0)},${m.a.initialPos.y.toFixed(0)}) b=(${m.b.initialPos.x.toFixed(0)},${m.b.initialPos.y.toFixed(0)}) anchors=${m.a.isAnchor}/${m.b.isAnchor}`);
    }
    let worst = bridge.nodes[0];
    for (const n of bridge.nodes) if (n.pos.y - n.initialPos.y > worst.pos.y - worst.initialPos.y) worst = n;
    console.log(`   worst node id=${worst.id} road=${worst.isRoad} drop=${(worst.pos.y - worst.initialPos.y).toFixed(0)}px at (${worst.initialPos.x.toFixed(0)},${worst.initialPos.y.toFixed(0)})`);
  }
  const v = evaluate(bridge, s.level, vehicles, outcome);
  const cost = bridge.totalCost();
  const budgetPct = Number.isFinite(s.level.budget) ? ((cost / s.level.budget) * 100).toFixed(0) + "%" : "livre";
  console.log(
    `${s.name.padEnd(34)} L${String(s.level.id).padStart(2, "0")} ` +
      `peak=${bridge.peakStress.toFixed(4)} fs=${v.fs.toFixed(2)} ` +
      `flecha=${(v.flechaM * 1000).toFixed(0)}/${(limitFor(s.level) * 1000).toFixed(0)}mm ` +
      `broken=${bridge.brokenCount}${selfWeightBroken ? `(${selfWeightBroken} peso próprio)` : ""}${firstBreak > 0 ? `@${firstBreak.toFixed(1)}s` : ""} ` +
      `${outcome} t=${t.toFixed(1)}s ★${v.stars} custo=${budgetPct}` +
      (dropped ? ` (${dropped} peças rejeitadas)` : ""),
  );
  if (args.includes("--worst")) {
    const segs = bridge.members.flatMap((m) => m.segments.map((sg) => ({ sg, m })));
    segs.sort((p, q) => q.sg.peak - p.sg.peak);
    for (const { sg, m } of segs.slice(0, 4)) {
      console.log(`     ${sg.materialId} peça ${m.lengthM.toFixed(1)}m ${sg.isTension ? "tração" : "compr."} pico=${sg.peak.toFixed(3)}@${sg.peakT.toFixed(1)}s compScale=${sg.compScale.toFixed(2)} seg=(${sg.nodeA.initialPos.x.toFixed(0)},${sg.nodeA.initialPos.y.toFixed(0)})-(${sg.nodeB.initialPos.x.toFixed(0)},${sg.nodeB.initialPos.y.toFixed(0)}) peça=(${m.a.initialPos.x.toFixed(0)},${m.a.initialPos.y.toFixed(0)})-(${m.b.initialPos.x.toFixed(0)},${m.b.initialPos.y.toFixed(0)})`);
    }
  }
}

const L = (id: number): LevelDef => {
  const l = getLevel(id);
  if (!l) throw new Error(`level ${id}`);
  return l;
};

const scenarios: Scenario[] = [
  { name: "L1 tabuleiro madeira 14m", level: L(1), design: deck(14, "wood", 14) },
  { name: "L1 tabuleiro madeira 2x7m", level: L(1), design: deck(14, "wood", 7) },
  { name: "L2 tabuleiro madeira 18m", level: L(2), design: deck(18, "wood", 9) },
  { name: "L2 tabuleiro aço 18m", level: L(2), design: deck(18, "steel", 18) },
  { name: "L2 kingpost madeira", level: L(2), design: kingpost(18, 4, "wood", "wood", "wood") },
  { name: "L2 warren madeira 4p h3", level: L(2), design: warren(18, 4, 3, "wood", "wood", "wood") },
  { name: "L3 tabuleiro madeira 24m", level: L(3), design: deck(24, "wood", 12) },
  { name: "L3 kingpost cabo", level: L(3), design: kingpost(24, 6, "wood", "wood", "cable") },
  { name: "L3 warren madeira 6p h3.5", level: L(3), design: warren(24, 6, 3.5, "wood", "wood", "wood") },
  { name: "L4 warren madeira 7p h4", level: L(4), design: warren(28, 7, 4, "wood", "wood", "wood") },
  { name: "L4 warren madeira 7p h6", level: L(4), design: warren(28, 7, 6, "wood", "wood", "wood") },
  { name: "L4 xtruss madeira 7p h5", level: L(4), design: xtruss(28, 7, 5, "wood", "wood", "wood") },
  { name: "L4 xtruss madeira 8p h5", level: L(4), design: xtruss(28, 8, 5, "wood", "wood", "wood") },
  { name: "L7 xtruss madeira 12p h6", level: L(7), design: xtruss(42, 12, 6, "wood", "wood", "wood") },
  { name: "L8 xtruss madeira 12p h7", level: L(8), design: xtruss(48, 12, 7, "wood", "wood", "wood") },
  { name: "L8 xtruss madeira 16p h7", level: L(8), design: xtruss(48, 16, 7, "wood", "wood", "wood") },
  { name: "L8 xtruss aço diag 12p h7", level: L(8), design: xtruss(48, 12, 7, "wood", "wood", "steel") },
  { name: "L4 warren aço/madeira 7p h4", level: L(4), design: warren(28, 7, 4, "wood", "steel", "wood") },
  { name: "L5 warren madeira 8p h4", level: L(5), design: warren(32, 8, 4, "wood", "wood", "wood") },
  { name: "L7 warren madeira 10p h5", level: L(7), design: warren(42, 10, 5, "wood", "wood", "wood") },
  { name: "L8 warren madeira 12p h6", level: L(8), design: warren(48, 12, 6, "wood", "wood", "wood") },
  { name: "L8 warren aço banzo 12p h6", level: L(8), design: warren(48, 12, 6, "wood", "steel", "wood") },
  { name: "L7 warren diag extremas aço", level: L(7), design: warrenEnds(42, 10, 5) },
  { name: "L7 warren madeira 12p h7", level: L(7), design: warren(42, 12, 7, "wood", "wood", "wood") },
  { name: "L7 warren madeira 14p h6", level: L(7), design: warren(42, 14, 6, "wood", "wood", "wood") },
  { name: "L8 warren madeira 14p h8", level: L(8), design: warren(48, 14, 8, "wood", "wood", "wood") },
  { name: "L8 warren madeira 8p h6", level: L(8), design: warren(48, 8, 6, "wood", "wood", "wood") },
  { name: "L8 warren madeira 10p h6", level: L(8), design: warren(48, 10, 6, "wood", "wood", "wood") },
  { name: "L8 warren madeira 10p h8", level: L(8), design: warren(48, 10, 8, "wood", "wood", "wood") },
  { name: "L8 warren banzo aço 10p h7", level: L(8), design: warren(48, 10, 7, "wood", "steel", "wood") },
  { name: "L8 warren aço total 10p h7", level: L(8), design: warren(48, 10, 7, "steel", "steel", "steel") },
  { name: "L8 warren madeira 16p h7", level: L(8), design: warren(48, 16, 7, "wood", "wood", "wood") },
  { name: "L8 warren diag extremas aço", level: L(8), design: warrenEnds(48, 12, 6) },
  { name: "L8 warren 4 diag aço", level: L(8), design: warrenEnds(48, 12, 6, 2) },
  { name: "L13 warren madeira vento", level: L(13), design: warren(30, 8, 4, "wood", "wood", "wood") },
  { name: "L14 warren aço vento 90", level: L(14), design: warren(36, 9, 4.5, "wood", "steel", "wood") },
  { name: "L21 metrô warren aço", level: L(21), design: warren(24, 6, 4, "steel", "steel", "steel") },
  { name: "L22 etapas warren madeira", level: L(22), design: warren(30, 8, 4, "wood", "wood", "wood") },
  { name: "L23 arco + tabuleiro pendurado", level: L(23), design: [...deck(36, "wood", 12), seg("cable", [6, 0], [6, -3.89]), seg("cable", [12, 0], [12, -6.22]), seg("cable", [18, 0], [18, -7]), seg("cable", [24, 0], [24, -6.22]), seg("cable", [30, 0], [30, -3.89])] },
  {
    name: "L24 pênsil",
    level: L(24),
    design: [
      ...deck(52, "steel", 13),
      seg("cable", [10, -14], [0, 0]),
      seg("cable", [10, -14], [26, -2]),
      seg("cable", [42, -14], [26, -2]),
      seg("cable", [42, -14], [52, 0]),
      seg("cable", [10, -14], [18, 0]),
      seg("cable", [42, -14], [34, 0]),
      seg("steel", [26, -2], [26, 0]),
    ],
  },
];

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith("--"));
const strainK = Number(args.find((a) => a.startsWith("--strain="))?.split("=")[1] ?? 1);
const loadK = Number(args.find((a) => a.startsWith("--load="))?.split("=")[1] ?? 1);
const g = args.find((a) => a.startsWith("--g="));
if (g) TUNING.gravity = Number(g.split("=")[1]);
const lpt = args.find((a) => a.startsWith("--lpt="));
if (lpt) TUNING.loadPerTon = Number(lpt.split("=")[1]);
const it = args.find((a) => a.startsWith("--it="));
if (it) TUNING.iterations = Number(it.split("=")[1]);
const segm = args.find((a) => a.startsWith("--seg="));
if (segm) TUNING.segmentM = Number(segm.split("=")[1]);
for (const m of Object.values(MATERIALS)) {
  m.breakTension *= strainK;
  m.breakCompression *= strainK;
}
TUNING.loadPerTon *= loadK;
console.log(`strain x${strainK}  load x${loadK}  g=${TUNING.gravity} it=${TUNING.iterations} seg=${TUNING.segmentM}m (BASE_STRAIN=${BASE_STRAIN}, loadPerTon=${TUNING.loadPerTon})`);
for (const s of scenarios) {
  if (only && !s.name.toLowerCase().includes(only.toLowerCase())) continue;
  run(s);
}
console.log(`\n${LEVELS.length} obras no catálogo.`);
