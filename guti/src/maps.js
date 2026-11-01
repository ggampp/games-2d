// Definições dos tabuleiros. Coordenadas no espaço 900×600 (paisagem).
// Cada mapa é um grafo: casas (nodes) + caminhos (paths). Duas casas são
// vizinhas quando aparecem em sequência num caminho; uma captura salta três
// casas consecutivas do mesmo caminho (origem, adversário, destino).

const W = 900;
const H = 600;

const round = (v) => Math.round(v * 10) / 10;

/**
 * Tabuleiro "D duplo" do vídeo: dois semicírculos com corda vertical,
 * ligados por um X no centro. `hs` são as alturas das linhas horizontais
 * (relativas ao centro). Com uma altura 0 a linha do meio atravessa o centro.
 */
function doubleD({ id, name, subtitle, description, r, hs, gap = 150 }) {
  const cy = H / 2;
  const cx = W / 2;
  const nodes = [];
  const paths = [];
  const start = { 1: [], 2: [] };

  for (const side of ['L', 'R']) {
    const dir = side === 'L' ? -1 : 1;
    const chordX = cx + dir * gap;
    const chord = [`${side}top`];
    const arc = [`${side}top`];
    nodes.push([`${side}top`, chordX, cy - r]);
    hs.forEach((h, k) => {
      const yId = `${side}y${k}`;
      const aId = `${side}a${k}`;
      const dx = Math.sqrt(r * r - h * h);
      nodes.push([yId, chordX, cy + h]);
      nodes.push([aId, round(chordX + dir * dx), cy + h]);
      chord.push(yId);
      arc.push(aId);
    });
    nodes.push([`${side}bot`, chordX, cy + r]);
    chord.push(`${side}bot`);
    arc.push(`${side}bot`);
    paths.push({ nodes: chord, kind: 'line' });
    paths.push({ nodes: arc, kind: 'arc', cx: chordX, cy, r });
    for (const id of chord.concat(arc)) {
      const owner = side === 'L' ? 1 : 2;
      if (!start[owner].includes(id)) start[owner].push(id);
    }
  }
  nodes.push(['C', cx, cy]);

  // Linhas horizontais: arco → corda (e, se h = 0, atravessam o centro).
  hs.forEach((h, k) => {
    if (h === 0) {
      paths.push({ nodes: [`La${k}`, `Ly${k}`, 'C', `Ry${k}`, `Ra${k}`], kind: 'line' });
    } else {
      paths.push({ nodes: [`La${k}`, `Ly${k}`], kind: 'line' });
      paths.push({ nodes: [`Ry${k}`, `Ra${k}`], kind: 'line' });
    }
  });

  // O X: liga a horizontal de cima de um lado à de baixo do outro.
  const top = hs.findIndex((h) => h < 0);
  const bottom = hs.length - 1 - [...hs].reverse().findIndex((h) => h > 0);
  paths.push({ nodes: [`Ly${top}`, 'C', `Ry${bottom}`], kind: 'line' });
  paths.push({ nodes: [`Ly${bottom}`, 'C', `Ry${top}`], kind: 'line' });

  return { id, name, subtitle, description, width: W, height: H, nodes, paths, start };
}

/** Borboleta de Lau Kata Kati: dois triângulos que se tocam no centro. */
function butterfly() {
  const cx = W / 2;
  const cy = H / 2;
  const nodes = [['C', cx, cy]];
  const paths = [];
  const start = { 1: [], 2: [] };
  const rows = 3;
  const dx = 100;
  const dy = 62;
  for (const side of ['L', 'R']) {
    const dir = side === 'L' ? -1 : 1;
    for (let i = 1; i <= rows; i++) {
      const x = cx + dir * dx * i;
      const col = [`${side}${i}t`, `${side}${i}m`, `${side}${i}b`];
      nodes.push([col[0], x, cy - dy * i], [col[1], x, cy], [col[2], x, cy + dy * i]);
      paths.push({ nodes: col, kind: 'line' });
      start[side === 'L' ? 1 : 2].push(...col);
    }
  }
  const ray = (side, pos) => [3, 2, 1].map((i) => `${side}${i}${pos}`);
  // Retas que atravessam o centro: topo-esq ↔ base-dir, meio ↔ meio, base-esq ↔ topo-dir.
  paths.push({ nodes: [...ray('L', 't'), 'C', ...ray('R', 'b').reverse()], kind: 'line' });
  paths.push({ nodes: [...ray('L', 'm'), 'C', ...ray('R', 'm').reverse()], kind: 'line' });
  paths.push({ nodes: [...ray('L', 'b'), 'C', ...ray('R', 't').reverse()], kind: 'line' });
  return {
    id: 'lau-kata-kati',
    name: 'Lau Kata Kati',
    subtitle: '19 casas · 9 × 9',
    description: 'A borboleta clássica de Bengala: dois triângulos que se encontram num único ponto central.',
    width: W,
    height: H,
    nodes,
    paths,
    start,
  };
}

/** Roda: dois anéis concêntricos com raios que cruzam o centro. */
function wheel() {
  const cx = W / 2;
  const cy = H / 2;
  const ro = 250;
  const ri = 135;
  const nodes = [['C', cx, cy]];
  const start = { 1: [], 2: [] };
  const n = 8;
  for (let k = 0; k < n; k++) {
    const a = ((22.5 + 45 * k) * Math.PI) / 180;
    nodes.push([`O${k}`, round(cx + ro * Math.cos(a)), round(cy + ro * Math.sin(a))]);
    nodes.push([`I${k}`, round(cx + ri * Math.cos(a)), round(cy + ri * Math.sin(a))]);
    const owner = Math.cos(a) < 0 ? 1 : 2;
    start[owner].push(`O${k}`);
    // No anel interno só as pontas: com ele cheio, quem começa cai numa armadilha forçada.
    if ([1, 2, 5, 6].includes(k)) start[owner].push(`I${k}`);
  }
  const ids = (p) => Array.from({ length: n }, (_, k) => `${p}${k}`);
  const paths = [
    { nodes: ids('O'), kind: 'arc', cx, cy, r: ro, closed: true },
    { nodes: ids('I'), kind: 'arc', cx, cy, r: ri, closed: true },
  ];
  for (let k = 0; k < n / 2; k++) {
    paths.push({ nodes: [`O${k}`, `I${k}`, 'C', `I${k + 4}`, `O${k + 4}`], kind: 'line' });
  }
  return {
    id: 'roda',
    name: 'Roda',
    subtitle: '17 casas · 6 × 6',
    description: 'Dois anéis e quatro raios. Nos anéis dá para dar a volta e capturar pelas costas.',
    width: W,
    height: H,
    nodes,
    paths,
    start,
  };
}

/**
 * Grade de alquerque (5×5 com diagonais nas casas pares), opcionalmente com
 * os triângulos laterais do Sholo Guti. Coordenadas (c, r).
 */
function lattice({ id, name, subtitle, description, triangles }) {
  const step = triangles ? 100 : 112;
  const cols = triangles ? [-2, 6] : [0, 4];
  const ox = (W - step * (cols[1] - cols[0])) / 2 - step * cols[0];
  const oy = (H - step * 4) / 2;
  const key = (c, r) => `${c},${r}`;
  const nodes = [];
  const add = (c, r) => nodes.push([key(c, r), ox + c * step, oy + r * step]);
  for (let c = 0; c <= 4; c++) for (let r = 0; r <= 4; r++) add(c, r);
  if (triangles) {
    for (const [c, rs] of [[-1, [1, 2, 3]], [-2, [0, 2, 4]], [5, [1, 2, 3]], [6, [0, 2, 4]]]) {
      for (const r of rs) add(c, r);
    }
  }
  const line = (pts) => ({ nodes: pts.map(([c, r]) => key(c, r)), kind: 'line' });
  const seq = (n0, n1, f) => Array.from({ length: n1 - n0 + 1 }, (_, i) => f(n0 + i));
  const paths = [];
  for (let r = 0; r <= 4; r++) {
    const [a, b] = triangles && r === 2 ? cols : [0, 4];
    paths.push(line(seq(a, b, (c) => [c, r])));
  }
  for (let c = 0; c <= 4; c++) paths.push(line(seq(0, 4, (r) => [c, r])));
  paths.push(line(seq(0, 4, (i) => [i, i])));
  paths.push(line(seq(0, 4, (i) => [i, 4 - i])));
  const t = triangles ? 2 : 0;
  // Diagonais do losango (com prolongamento pelos triângulos).
  paths.push(line(seq(-t, 2, (i) => [i, i + 2])));
  paths.push(line(seq(-t, 2, (i) => [i, 2 - i])));
  paths.push(line(seq(2, 4 + t, (i) => [i, i - 2])));
  paths.push(line(seq(2, 4 + t, (i) => [i, 6 - i])));
  const start = { 1: [], 2: [] };
  if (triangles) {
    paths.push(line([[-1, 1], [-1, 2], [-1, 3]]), line([[-2, 0], [-2, 2], [-2, 4]]));
    paths.push(line([[5, 1], [5, 2], [5, 3]]), line([[6, 0], [6, 2], [6, 4]]));
    for (const [id] of nodes) {
      const c = Number(id.split(',')[0]);
      if (c <= 1) start[1].push(id);
      else if (c >= 3) start[2].push(id);
    }
  } else {
    for (const [id] of nodes) {
      const [c, r] = id.split(',').map(Number);
      if (c <= 1 || (c === 2 && r >= 3)) start[1].push(id);
      else if (c >= 3 || (c === 2 && r <= 1)) start[2].push(id);
    }
  }
  return { id, name, subtitle, description, width: W, height: H, nodes, paths, start };
}

export const MAPS = [
  doubleD({
    id: 'borboleta',
    name: 'Dois Ds',
    subtitle: '13 casas · 6 × 6',
    description: 'O tabuleiro do vídeo: dois semicírculos riscados no chão, ligados por um X. O centro começa vazio.',
    r: 180,
    hs: [-60, 60],
  }),
  doubleD({
    id: 'grande-borboleta',
    name: 'Dois Ds Grande',
    subtitle: '17 casas · 8 × 8',
    description: 'Os mesmos Ds com uma terceira linha horizontal que atravessa o centro de ponta a ponta.',
    r: 210,
    hs: [-105, 0, 105],
  }),
  butterfly(),
  wheel(),
  lattice({
    id: 'alquerque',
    name: 'Alquerque',
    subtitle: '25 casas · 12 × 12',
    description: 'A grade 5×5 com diagonais, avó das damas. Muito espaço para capturas em cadeia.',
    triangles: false,
  }),
  lattice({
    id: 'sholo-guti',
    name: 'Sholo Guti',
    subtitle: '37 casas · 16 × 16',
    description: 'Os “dezesseis soldados” de Bangladesh: alquerque com um triângulo de cada lado.',
    triangles: true,
  }),
];

export const MAP_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));
