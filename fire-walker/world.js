// Fire Walker — the world.
//
// The stage is three screens wide (768 px) and the camera follows the hero.
// Three layers scroll at different speeds (parallax):
//   far  (×0.25) — dithered night sky, stars, moon, mountains and a castle;
//   mid  (×0.6)  — hills with dead trees and distant graves;
//   near (×1)    — the zones you walk through and the floor.
// Near props are drawn as shape ids and shaded with the same rule as the
// characters (light from the moon, contact shadow, outline). Braziers along the
// way are permanent heat sources for the DOOM fire, and they ignite enemies.

'use strict';

const cam = { x: 0, ix: 0 };

function updateCamera(dt, snap = false) {
  const target = clamp(ch.x - VIEW_W / 2 + ch.facing * 24, 0, W - VIEW_W);
  cam.x = snap ? target : lerp(cam.x, target, Math.min(1, dt * 3.5));
  cam.ix = Math.round(cam.x);
}

const FAR_P = 0.25;
const MID_P = 0.6;
const FAR_W = VIEW_W + Math.ceil((W - VIEW_W) * FAR_P) + 2;
const MID_W = VIEW_W + Math.ceil((W - VIEW_W) * MID_P) + 2;

const ZONES = [
  { name: 'Cemitério', x0: 0, x1: 210 },
  { name: 'Ruínas', x0: 210, x1: 430 },
  { name: 'Vila', x0: 430, x1: 640 },
  { name: 'Portão', x0: 640, x1: W },
];

const BRAZIERS = [96, 328, 512, 676, 742].map((x) => ({ x, top: GROUND - 13 }));

function mkRng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Thick line / disk stamping on a plain Uint32 layer.
function stampDisk(L, lw, cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if (y < 0 || y >= H) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= lw) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) L[y * lw + x] = c;
    }
  }
}
function stampLine(L, lw, x0, y0, x1, y1, r0, r1, c) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    stampDisk(L, lw, lerp(x0, x1, t), lerp(y0, y1, t), lerp(r0, r1, t), c);
  }
}
// Recursive dead tree.
function stampTree(L, lw, x, y, ang, len, thick, depth, c, rnd) {
  const x1 = x + Math.cos(ang) * len;
  const y1 = y + Math.sin(ang) * len;
  stampLine(L, lw, x, y, x1, y1, thick, thick * 0.7, c);
  if (depth <= 0) return;
  const n = depth > 2 ? 2 : 1 + (rnd() < 0.6 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const da = (k === 0 ? -1 : 1) * (0.35 + rnd() * 0.45);
    stampTree(L, lw, x1, y1, ang + da, len * (0.6 + rnd() * 0.2), Math.max(0.5, thick * 0.65), depth - 1, c, rnd);
  }
}

// ---------------------------------------------------------------------------
// Far layer: sky, stars, moon, mountains, a castle on a peak
// ---------------------------------------------------------------------------
function makeFar() {
  const L = new Uint32Array(FAR_W * H);
  const rnd = mkRng(7);
  const sky = ['#0a0910', '#0e0c16', '#130f1c', '#181221', '#1e1426', '#251729'].map(hexRgb);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < FAR_W; x++) {
      const t = Math.min(1, y / GROUND);
      const d = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) / (sky.length - 1);
      L[y * FAR_W + x] = pack(sky[clamp(Math.round((t + d) * (sky.length - 1)), 0, sky.length - 1)]);
    }
  }
  for (let i = 0; i < 150; i++) {
    const x = (rnd() * FAR_W) | 0;
    const y = (rnd() * 70) | 0;
    const v = 60 + ((rnd() * 120) | 0);
    L[y * FAR_W + x] = pack([v, v, Math.min(255, v + 25)]);
  }
  // Moon with craters.
  const mx = 190;
  const my = 24;
  const mr = 9;
  for (let dy = -mr; dy <= mr; dy++) {
    for (let dx = -mr; dx <= mr; dx++) {
      if (dx * dx + dy * dy > mr * mr) continue;
      const crater = (dx + 3) ** 2 + (dy - 1) ** 2 < 6 || (dx - 4) ** 2 + (dy + 4) ** 2 < 3 || (dx - 1) ** 2 + (dy - 5) ** 2 < 2;
      const shade = dx + dy > 8 ? '#b7ad9c' : crater ? '#c9bfab' : '#e6dcc6';
      L[(my + dy) * FAR_W + mx + dx] = pack(hexRgb(shade));
    }
  }
  // Two mountain ridges, the farther one lighter (aerial perspective).
  const ridge = (base, amp, f1, f2, c, rim) => {
    const fill = pack(hexRgb(c));
    const top = pack(hexRgb(rim));
    for (let x = 0; x < FAR_W; x++) {
      const h = base + amp * (Math.sin(x * f1) * 0.6 + Math.sin(x * f2 + 1.3) * 0.3 + Math.sin(x * 0.17 + 2) * 0.1);
      const y0 = Math.round(GROUND - h);
      for (let y = y0; y < H; y++) L[y * FAR_W + x] = y === y0 ? top : fill;
    }
  };
  ridge(48, 16, 0.019, 0.051, '#1c1626', '#2a2236');
  ridge(30, 12, 0.031, 0.077, '#161120', '#231b2e');
  // Castle silhouette on the far ridge.
  const castle = pack(hexRgb('#130f1a'));
  const lit = pack(hexRgb('#e8b04a'));
  const cx = 300;
  const cy = GROUND - 60;
  for (let x = cx - 18; x <= cx + 18; x++) for (let y = cy; y < GROUND - 30; y++) L[y * FAR_W + x] = castle;
  for (const [tx, th] of [[-18, 16], [-6, 24], [8, 18], [18, 12]]) {
    for (let x = cx + tx - 3; x <= cx + tx + 3; x++) for (let y = cy - th; y < cy; y++) L[y * FAR_W + x] = castle;
    for (let x = cx + tx - 3; x <= cx + tx + 3; x += 2) L[(cy - th - 1) * FAR_W + x] = castle;
  }
  for (const [wx, wy] of [[-6, -16], [-6, -10], [8, -12], [-15, 6], [3, 4]]) L[(cy + wy) * FAR_W + cx + wx] = lit; // lit windows
  return L;
}

// ---------------------------------------------------------------------------
// Mid layer: hills with dead trees and distant graves (transparent elsewhere)
// ---------------------------------------------------------------------------
function makeMid() {
  const L = new Uint32Array(MID_W * H);
  const rnd = mkRng(11);
  const fill = pack(hexRgb('#110d16'));
  const rim = pack(hexRgb('#211a2a'));
  const hill = (x) => GROUND - 12 - 8 * Math.sin(x * 0.028) - 5 * Math.sin(x * 0.071 + 0.5);
  for (let x = 0; x < MID_W; x++) {
    const y0 = Math.round(hill(x));
    for (let y = y0; y < H; y++) L[y * MID_W + x] = y === y0 ? rim : fill;
  }
  for (let x = 20; x < MID_W; x += 55 + ((rnd() * 40) | 0)) {
    stampTree(L, MID_W, x, hill(x) + 1, -Math.PI / 2 + (rnd() - 0.5) * 0.3, 10 + rnd() * 6, 1.6, 4, fill, rnd);
  }
  // Distant crosses and tombs on the left hills.
  for (let x = 8; x < MID_W * 0.35; x += 9 + ((rnd() * 12) | 0)) {
    const y = Math.round(hill(x));
    if (rnd() < 0.5) {
      stampLine(L, MID_W, x, y, x, y - 7, 0.5, 0.5, fill);
      stampLine(L, MID_W, x - 2, y - 5, x + 2, y - 5, 0.5, 0.5, fill);
    } else {
      stampDisk(L, MID_W, x, y - 3, 2.2, fill);
      stampLine(L, MID_W, x, y - 3, x, y, 2, 2, fill);
    }
  }
  return L;
}

// ---------------------------------------------------------------------------
// Near layer: props as shape ids, shaded like the characters; then the floor
// ---------------------------------------------------------------------------
const PROP_MATS = {
  stone:  ['#141019', '#211a27', '#2e2536', '#433749'],
  brick:  ['#1a1216', '#2a1d22', '#3b2a30', '#523b42'],
  tomb:   ['#16141c', '#24212d', '#35313f', '#4b4657'],
  iron:   ['#0c0c10', '#17171d', '#24252d', '#3a3c47'],
  wood:   ['#150e0a', '#241811', '#36241a', '#4d3524'],
  burnt:  ['#0d0a09', '#17110f', '#221915', '#33251e'],
  moss:   ['#0f1610', '#172118', '#223024', '#304434'],
  banner: ['#2a0a0c', '#45121a', '#621c24', '#842a30'],
  gold:   ['#2a1e0a', '#4a3612', '#6e521e', '#9a7630'],
  hole:   ['#07060a', '#07060a', '#07060a', '#07060a'],
};
const PROP_NAMES = Object.keys(PROP_MATS);
const PROP32 = PROP_NAMES.map((n) => PROP_MATS[n].map((h) => pack(hexRgb(h))));
const PROP_OUTLINE = pack(hexRgb('#08060b'));

function makeNear() {
  const ids = new Uint16Array(W * H);
  const mats = [0];
  const rnd = mkRng(23);
  const shape = (mat) => { mats.push(PROP_NAMES.indexOf(mat)); return mats.length - 1; };
  const put = (x, y, id) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < GROUND) ids[y * W + x] = id; };
  const rect = (x, y, w, h, id) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, id); };
  const disc = (cx, cy, r, id) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, id);
  };
  const ln = (x0, y0, x1, y1, r0, r1, id) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) { const t = i / n; disc(lerp(x0, x1, t), lerp(y0, y1, t), lerp(r0, r1, t), id); }
  };
  const pol = (pts, id) => {
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) put(x, y, id);
      }
    }
  };
  const tree = (x, y, ang, len, thick, depth, id) => {
    const x1 = x + Math.cos(ang) * len;
    const y1 = y + Math.sin(ang) * len;
    ln(x, y, x1, y1, thick, thick * 0.7, id);
    if (depth <= 0) return;
    const n = depth > 2 ? 2 : 1 + (rnd() < 0.6 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const da = (k === 0 ? -1 : 1) * (0.35 + rnd() * 0.5);
      tree(x1, y1, ang + da, len * (0.6 + rnd() * 0.2), Math.max(0.5, thick * 0.62), depth - 1, id);
    }
  };
  const G = GROUND;

  // --- Graveyard -----------------------------------------------------------
  {
    const fence = shape('iron');
    for (let x = 4; x < 206; x++) {
      if (x > 60 && x < 72) continue; // a broken gap
      put(x, G - 11, fence);
      put(x, G - 4, fence);
      if (x % 4 === 0) { for (let y = G - 14; y < G; y++) put(x, y, fence); put(x, G - 15, fence); }
    }
    tree(36, G, -Math.PI / 2 - 0.08, 16, 2.6, 5, shape('burnt'));
    // Crypt with a pediment, columns, a dark door and a cross.
    const crypt = shape('stone');
    rect(140, G - 26, 36, 26, crypt);
    pol([[136, G - 26], [158, G - 40], [180, G - 26]], shape('tomb'));
    rect(142, G - 25, 4, 25, shape('tomb'));
    rect(170, G - 25, 4, 25, shape('tomb'));
    rect(153, G - 16, 10, 16, shape('hole'));
    disc(158, G - 16, 5, shape('hole'));
    const cross = shape('stone');
    rect(157, G - 49, 2, 10, cross);
    rect(154, G - 46, 8, 2, cross);
    // Tombstones: rounded, cross, leaning slab.
    for (const [x, kind, h] of [[18, 0, 11], [54, 1, 13], [80, 0, 9], [112, 2, 10], [124, 0, 12], [192, 1, 12], [200, 0, 8]]) {
      const t = shape('tomb');
      if (kind === 0) { rect(x - 3, G - h + 3, 7, h - 3, t); disc(x, G - h + 3, 3.5, t); }
      else if (kind === 1) { rect(x - 1, G - h, 3, h, t); rect(x - 3, G - h + 3, 7, 2, t); }
      else pol([[x - 4, G], [x + 3, G], [x + 6, G - h], [x - 1, G - h - 1]], t);
      const m = shape('moss');
      for (let k = -3; k <= 3; k++) if (rnd() < 0.6) put(x + k, G - 1, m);
    }
  }

  // --- Ruins -----------------------------------------------------------------
  {
    const pillar = (x, h, broken, capital) => {
      const p = shape('stone');
      for (let i = 0; i < 8; i++) {
        const top = broken ? h - ((rnd() * 6) | 0) * (i > 3 ? 1 : 0.3) : h;
        for (let y = G - top; y < G; y++) put(x + i, y, p);
      }
      if (capital) rect(x - 1, G - h - 3, 10, 3, shape('stone'));
      rect(x - 1, G - 3, 10, 3, shape('stone')); // base
      const crack = shape('hole');
      let cy = G - h + 6;
      let cx = x + 3;
      while (cy < G - 8) { put(cx, cy, crack); cy++; if (rnd() < 0.4) cx += rnd() < 0.5 ? -1 : 1; cx = clamp(cx, x + 1, x + 6); if (rnd() < 0.15) break; }
    };
    pillar(222, 42, true, false);
    pillar(274, 28, true, false);
    pillar(386, 50, false, true);
    pillar(418, 20, true, false);
    // Fallen column segment.
    const fallen = shape('stone');
    rect(236, G - 6, 22, 6, fallen);
    disc(258, G - 3, 3, shape('stone'));
    // Arch framing the brazier.
    pillar(302, 44, false, true);
    pillar(346, 44, false, true);
    const arch = shape('brick');
    for (let y = G - 80; y <= G - 47; y++) {
      for (let x = 300; x <= 356; x++) {
        const d = Math.hypot(x - 328, y - (G - 47));
        if (d >= 21 && d <= 27) put(x, y, arch);
      }
    }
    const key = shape('stone');
    rect(326, G - 76, 5, 6, key); // keystone
    // Low broken wall.
    const wall = shape('brick');
    for (let x = 212; x < 430; x++) {
      const h = 5 + ((Math.sin(x * 0.5) + Math.sin(x * 0.17)) > 1.1 ? 3 : 0);
      if (x > 296 && x < 360) continue;
      for (let y = G - h; y < G; y++) put(x, y, wall);
    }
  }

  // --- Burnt village ---------------------------------------------------------
  {
    const post = (x, h) => ln(x, G, x, G - h, 1.3, 1.1, shape('burnt'));
    post(442, 34);
    post(470, 34);
    post(498, 30);
    ln(440, G - 34, 500, G - 32, 1.0, 1.0, shape('burnt')); // beam
    ln(438, G - 34, 470, G - 54, 1.0, 0.9, shape('burnt')); // rafters, one broken
    ln(470, G - 54, 486, G - 44, 0.9, 0.8, shape('burnt'));
    for (const [x, h] of [[446, 22], [450, 16], [454, 26], [476, 12], [480, 18], [490, 9]]) rect(x, G - h, 3, h, shape('wood'));
    // Stone house with window, door and a burnt upper frame.
    const house = shape('brick');
    rect(560, G - 22, 60, 22, house);
    rect(572, G - 15, 7, 7, shape('hole'));
    rect(600, G - 15, 8, 15, shape('hole'));
    ln(560, G - 22, 590, G - 46, 1.0, 1.0, shape('burnt'));
    ln(590, G - 46, 604, G - 36, 1.0, 0.8, shape('burnt'));
    post(562, 40);
    post(618, 36);
    // Barrels, crates and a leaning cart wheel.
    for (const x of [526, 533]) { const b = shape('wood'); rect(x - 3, G - 8, 7, 8, b); rect(x - 3, G - 6, 7, 1, shape('iron')); }
    const crate = shape('wood');
    rect(538, G - 7, 8, 7, crate);
    ln(538, G - 7, 545, G, 0.5, 0.5, shape('burnt'));
    const wheel = shape('wood');
    for (let a = 0; a < Math.PI * 2; a += 0.05) put(552 + Math.cos(a) * 6, G - 6 + Math.sin(a) * 6, wheel);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI; ln(552 - Math.cos(a) * 5, G - 6 - Math.sin(a) * 5, 552 + Math.cos(a) * 5, G - 6 + Math.sin(a) * 5, 0.4, 0.4, wheel); }
  }

  // --- Gate --------------------------------------------------------------------
  {
    const wall = shape('brick');
    rect(652, G - 58, W - 652, 58, wall);
    for (let x = 652; x < W; x += 10) rect(x, G - 64, 6, 6, wall); // merlons
    const tower = shape('stone');
    rect(648, G - 76, 18, 76, tower);
    for (let x = 648; x < 666; x += 5) rect(x, G - 80, 3, 4, tower);
    rect(655, G - 66, 3, 6, shape('hole')); // arrow slit
    // Gate opening with a half-raised portcullis.
    const hole = shape('hole');
    rect(694, G - 26, 24, 26, hole);
    disc(706, G - 26, 12, hole);
    const bars = shape('iron');
    for (let x = 696; x < 718; x += 4) for (let y = G - 36; y < G - 12; y++) put(x, y, bars);
    for (let x = 694; x < 718; x++) put(x, G - 13, bars);
    // Brick courses drawn as mortar lines.
    const mortar = shape('stone');
    for (let y = G - 56; y < G; y += 6) for (let x = 668; x < W; x++) if (!(x > 690 && x < 722 && y > G - 40)) put(x, y, mortar);
    // Hanging banners.
    for (const bx of [672, 744]) {
      const b = shape('banner');
      pol([[bx - 5, G - 54], [bx + 5, G - 54], [bx + 5, G - 34], [bx, G - 30], [bx - 5, G - 34]], b);
      ln(bx - 6, G - 54, bx + 6, G - 54, 0.6, 0.6, shape('wood'));
      disc(bx, G - 44, 1.8, shape('gold'));
    }
  }

  // --- Braziers ---------------------------------------------------------------
  for (const b of BRAZIERS) {
    rect(b.x - 2, b.top + 3, 5, GROUND - b.top - 3, shape('stone'));
    rect(b.x - 3, GROUND - 2, 7, 2, shape('stone'));
    pol([[b.x - 5.5, b.top - 0.5], [b.x + 5.5, b.top - 0.5], [b.x + 3, b.top + 3.5], [b.x - 3, b.top + 3.5]], shape('iron'));
  }

  // Shade every prop pixel like the characters; outline the props.
  const out = new Uint32Array(W * H);
  for (let y = 1; y < GROUND; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const p = ids[i];
      if (p) {
        const up = ids[i - W];
        const dn = y + 1 < GROUND ? ids[i + W] : p;
        const lf = ids[i - 1];
        const rt = ids[i + 1];
        let s = 2;
        if (up > p || dn > p || lf > p || rt > p) s = 1;
        else if (up !== p || rt !== p) s = 3;
        else if (dn !== p || lf !== p) s = 1;
        out[i] = PROP32[mats[p]][s];
      } else if (ids[i - 1] || ids[i + 1] || ids[i - W] || (y + 1 < GROUND && ids[i + W])) {
        out[i] = PROP_OUTLINE;
      }
    }
  }
  drawFloor(out, rnd);
  return out;
}

// Floor: dirt with grass in the graveyard, bricks in the ruins, cobbles in the
// village, flagstones at the gate.
function drawFloor(out, rnd) {
  const P = (h) => pack(hexRgb(h));
  const top = P('#46343a');
  const lip = P('#2e232b');
  const mortar = P('#16111a');
  const bricks = ['#2a2029', '#271d26', '#2d222b'].map(P);
  const dirt = ['#1d1719', '#221b1e', '#191416'].map(P);
  const grass = P('#1c2a1d');
  const cobble = ['#2b232a', '#30272f', '#272027'].map(P);
  const flag = ['#2c2530', '#29222c', '#31293a'].map(P);
  for (let x = 0; x < W; x++) {
    const zone = x < 210 ? 0 : x < 430 ? 1 : x < 640 ? 2 : 3;
    for (let y = GROUND; y < H; y++) {
      const i = y * W + x;
      const r = y - GROUND - 2;
      if (zone === 0) {
        out[i] = y === GROUND ? P('#2a2124') : dirt[(BAYER[(y & 3) * 4 + (x & 3)] + x * 7 + y * 3) % 3];
        continue;
      }
      if (y === GROUND) { out[i] = top; continue; }
      if (y === GROUND + 1) { out[i] = lip; continue; }
      if (zone === 1) {
        const row = (r / 5) | 0;
        const bx = x + (row % 2) * 6;
        out[i] = r % 5 === 4 || bx % 12 === 0 ? mortar : bricks[(((bx / 12) | 0) + row) % 3];
      } else if (zone === 2) {
        const row = (r / 4) | 0;
        const bx = x + (row % 2) * 3;
        const edge = r % 4 === 3 || bx % 6 === 0;
        out[i] = edge ? mortar : cobble[(((bx / 6) | 0) * 3 + row) % 3];
      } else {
        const row = (r / 6) | 0;
        const bx = x + (row % 2) * 9;
        out[i] = r % 6 === 5 || bx % 18 === 0 ? mortar : flag[(((bx / 18) | 0) + row) % 3];
      }
    }
    // Grass tufts on the graveyard dirt.
    if (x < 210 && rnd() < 0.35) out[(GROUND - 1) * W + x] = grass;
    if (x < 210 && rnd() < 0.12) out[(GROUND - 2) * W + x] = grass;
  }
}

// Braziers burn forever: the bowl's top row is a heat source every fire step.
function seedWorld() {
  for (const b of BRAZIERS) {
    const row = (b.top - 1) * W;
    for (let dx = -4; dx <= 4; dx++) {
      const i = row + b.x + dx;
      const v = 26 + ((Math.random() * 11) | 0);
      if (fire[i] < v) fire[i] = v;
    }
  }
}

const zoneAt = (x) => ZONES.find((z) => x >= z.x0 && x < z.x1) || ZONES[ZONES.length - 1];
