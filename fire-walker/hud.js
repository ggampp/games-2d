// Fire Walker — pixel fonts, HUD, banners and the skeleton overlay.
//
// Everything here is drawn into the same 256×144 frame as the sprites, one frame
// pixel per font pixel: no browser text, no scaling, no anti-aliasing. Two bitmap
// fonts: 3×5 for the HUD and 5×7 for the banners. Accents are separate marks
// drawn above (or below, for Ç) the base letter.

'use strict';

const FONT3 = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'], ':': ['...', '.#.', '...', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'], '.': ['...', '...', '...', '...', '.#.'],
  '·': ['...', '...', '.#.', '...', '...'], ' ': ['...', '...', '...', '...', '...'],
};

const FONT5 = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.###.', '#...#', '#....', '.###.', '....#', '#...#', '.###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

// Accent marks: rows drawn above the glyph (one blank row in between); cedilla below.
const MARKS = {
  3: { acute: ['..#', '.#.'], tilde: ['.##', '##.'], circ: ['.#.', '#.#'], grave: ['#..', '.#.'], ced: ['.#.'] },
  5: { acute: ['...#.', '..#..'], tilde: ['.##.#', '#..#.'], circ: ['..#..', '.#.#.'], grave: ['.#...', '..#..'], ced: ['..#..', '.##..'] },
};
const ACCENTS = {
  Á: ['A', 'acute'], É: ['E', 'acute'], Í: ['I', 'acute'], Ó: ['O', 'acute'], Ú: ['U', 'acute'],
  Ã: ['A', 'tilde'], Õ: ['O', 'tilde'], Â: ['A', 'circ'], Ê: ['E', 'circ'], Ô: ['O', 'circ'],
  À: ['A', 'grave'], Ç: ['C', 'ced'],
};

// Small icons for the HUD (5×5).
const ICONS = {
  flame: ['..#..', '.##..', '.###.', '#####', '.###.'],
  skull: ['.###.', '#####', '#.#.#', '.###.', '.#.#.'],
  crown: ['#.#.#', '#####', '#####', '.....', '.....'],
  target: ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
};

const UI = Object.fromEntries(Object.entries({
  text: '#efe6dc', shadow: '#0b080d', dim: '#9b8fa0', flame: '#f08a3c', skull: '#d8cfc4', crown: '#f2d27a',
  banner: '#fff1d6', bannerEdge: '#3a0f0a', bone: '#78e1ff', joint: '#ffffff', ik: '#ffd166', scarf: '#ffa05a', hood: '#c8a0ff', foe: '#a0ffaa',
}).map(([k, v]) => [k, pack(hexRgb(v))]));

// Calls fn(x, y) for every lit pixel of `text` (upper-cased) set in `font`.
function textPixels(text, font, x, y, fn) {
  const size = font === FONT5 ? 5 : 3;
  const h = size === 5 ? 7 : 5;
  const marks = MARKS[size];
  const stamp = (rows, ox, oy) => rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') fn(ox + i, oy + j);
  });
  for (const raw of text.toUpperCase()) {
    let chr = raw;
    let mark = null;
    if (ACCENTS[chr]) [chr, mark] = ACCENTS[chr];
    const g = font[chr];
    if (g) {
      stamp(g, x, y);
      if (mark === 'ced') stamp(marks.ced, x, y + h);
      else if (mark) stamp(marks[mark], x, y - 1 - marks[mark].length);
    }
    x += size + 1;
  }
}

const textWidth = (text, font) => text.length * ((font === FONT5 ? 5 : 3) + 1) - 1;

// Text with a 1 px drop shadow (HUD) or a full 1 px outline (banners).
function pixelText(text, x, y, color = UI.text, font = FONT3, outline = false, edge = UI.shadow) {
  if (outline) {
    textPixels(text, font, x, y, (u, v) => {
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) px(u + i, v + j, edge);
    });
  } else {
    textPixels(text, font, x + 1, y + 1, (u, v) => px(u, v, edge));
  }
  textPixels(text, font, x, y, (u, v) => px(u, v, color));
}

function icon(name, x, y, color) {
  ICONS[name].forEach((row, j) => {
    for (let i = 0; i < 5; i++) if (row[i] === '#') { px(x + i + 1, y + j + 1, UI.shadow); }
  });
  ICONS[name].forEach((row, j) => {
    for (let i = 0; i < 5; i++) if (row[i] === '#') px(x + i, y + j, color);
  });
}

// ---------------------------------------------------------------------------
// HUD: area name on top, wave and counters below (top-left of the visible view)
// ---------------------------------------------------------------------------
function drawHud(visLeft) {
  const x = visLeft + 5;
  const zone = cfg.enemies !== 'off' && BOSS.locked ? 'Arena do Guardião' : zoneAt(ch.x).name;
  pixelText(zone, x, 6);
  let cx = x;
  const y = 14;
  if (cfg.enemies === 'off') {
    icon('target', cx, y, UI.flame);
    pixelText(String(dummy.hits), cx + 7, y);
    return;
  }
  pixelText(`Onda ${stats.wave}`, cx, y, UI.dim);
  cx += textWidth(`Onda ${stats.wave}`, FONT3) + 5;
  icon('flame', cx, y, UI.flame);
  pixelText(String(stats.kills), cx + 7, y);
  cx += 7 + textWidth(String(stats.kills), FONT3) + 5;
  icon('skull', cx, y, UI.skull);
  pixelText(String(stats.deaths), cx + 7, y);
  cx += 7 + textWidth(String(stats.deaths), FONT3) + 5;
  if (BOSS.kills) {
    icon('crown', cx, y + 1, UI.crown);
    pixelText(String(BOSS.kills), cx + 7, y);
  }
}

// ---------------------------------------------------------------------------
// Banners: 5×7 letters typed in one by one, with fire rising from them
// ---------------------------------------------------------------------------
const bannerPixels = []; // frame coordinates of the lit pixels, for the fire seed

function drawBanner(visLeft, visRight) {
  bannerPixels.length = 0;
  if (banner.t <= 0 || !banner.text) return;
  const age = 2.2 - banner.t;
  if (banner.t < 0.35 && Math.floor(banner.t * 20) % 2) return; // blink out
  const text = banner.text.toUpperCase();
  const shown = text.slice(0, Math.max(1, Math.floor(age * 40)));
  const w = textWidth(text, FONT5);
  const x = Math.round((visLeft + visRight - w) / 2);
  const y = 50;
  pixelText(shown, x, y, UI.banner, FONT5, true, UI.bannerEdge);
  textPixels(shown, FONT5, x, y, (u, v) => bannerPixels.push(u, v));
}

// The banner's letters are heat sources, so the same fire licks up from them.
function seedBanner() {
  for (let k = 0; k < bannerPixels.length; k += 2) {
    const x = bannerPixels[k] + cam.ix;
    const y = bannerPixels[k + 1];
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const i = y * W + x;
    if (fire[i] < 20) fire[i] = 20;
  }
}

// ---------------------------------------------------------------------------
// Skeleton overlay: 1 px bones in the frame (Bresenham), white joints
// ---------------------------------------------------------------------------
function pxLine(x0, y0, x1, y1, c) {
  x0 = Math.round(x0 - cam.ix); y0 = Math.round(y0);
  x1 = Math.round(x1 - cam.ix); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
const pxPath = (pts, c) => { for (let k = 1; k < pts.length; k++) pxLine(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], c); };
const pxDot = (x, y, c) => px(Math.round(x - cam.ix), Math.round(y), c);

function drawSkeletonPx() {
  if (!pose || dissolve.state !== 'none') return;
  for (const E of enemies.map((e) => e.pose)) {
    if (!E || !E.legs) continue;
    for (const L of E.legs) pxPath([[E.hipX, E.hipY], [L.jx, L.jy], [L.ex, L.ey]], UI.foe);
    pxPath([[E.hipX, E.hipY], E.neck, E.head], UI.foe);
    for (const A of E.arms) pxPath([A.sh, A.el, A.hd], UI.foe);
  }
  pxPath(ch.scarfA.map((p) => [p.x, p.y]), UI.scarf);
  pxPath(ch.scarfB.map((p) => [p.x, p.y]), UI.scarf);
  pxPath([[pose.headX, pose.headY], [ch.hood.x, ch.hood.y]], UI.hood);
  for (const L of pose.legs) pxPath([[pose.hipX, pose.hipY], [L.jx, L.jy], [L.ex, L.ey]], UI.bone);
  pxPath([[pose.hipX, pose.hipY], [pose.neckX, pose.neckY], [pose.headX, pose.headY]], UI.bone);
  for (const A of pose.arms) pxPath([[A.sx, A.sy], [A.ex, A.ey], [A.hx, A.hy]], UI.bone);
  for (const L of pose.legs) {
    // IK target: a 3×3 plus sign.
    const tx = Math.round(L.tx - cam.ix);
    const ty = Math.round(L.ty);
    for (let k = -1; k <= 1; k++) { px(tx + k, ty, UI.ik); px(tx, ty + k, UI.ik); }
    pxDot(L.jx, L.jy, UI.joint);
    pxDot(L.ex, L.ey, UI.joint);
  }
  for (const A of pose.arms) { pxDot(A.ex, A.ey, UI.joint); pxDot(A.hx, A.hy, UI.joint); }
  pxDot(pose.hipX, pose.hipY, UI.joint);
  pxDot(pose.neckX, pose.neckY, UI.joint);
  pxDot(pose.headX, pose.headY, UI.joint);
}
