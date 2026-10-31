// Fire Walker — procedural pixel character + DOOM fire.
//
// 1. The character has no sprite sheet. Each frame a small skeleton (hip, knees, ankles,
//    neck, head, shoulders, elbows, wrists) is posed with a few sines and 2-bone IK.
// 2. Body parts (tapered limbs, torso, hood, boots, belt, sword...) are rasterized into
//    a 256×144 grid of *part ids*. A shading pass then picks one of 4 tones per pixel
//    from where the light comes from and which part is in front, and adds an outline.
// 3. The character's silhouette is the heat source of the DOOM fire algorithm:
//    aura (every pixel burns), trail (burns only while moving) and dissolve/teleport.
//    The fire also rim-lights the character's edges.

'use strict';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const W = 256;
const H = 144;
const GROUND = 126;         // first row of the floor
const FEET_Y = GROUND - 3;  // where the ankles rest
const DT = 1 / 60;
const GRAVITY = 380;

const BODY = { thigh: 10, shin: 10, torso: 13, headR: 4.6, upperArm: 7, foreArm: 6.5 };
const LEG = BODY.thigh + BODY.shin;

const cfg = {
  effect: 'aura',   // aura | trail | none
  palette: 'fogo',
  decay: 3,         // fire heat lost per row (lower = taller flames)
  step: 4,          // foot lift in pixels
  walk: 38,         // walk speed in px/s (run = 2.1×)
  jump: 150,
  shading: true,
  skeleton: false,
  auto: true,
};

// ---------------------------------------------------------------------------
// Fire palettes (37 entries, index 0 = no heat)
// ---------------------------------------------------------------------------
const DOOM_RGB = [
  0x07, 0x07, 0x07, 0x1f, 0x07, 0x07, 0x2f, 0x0f, 0x07, 0x47, 0x0f, 0x07,
  0x57, 0x17, 0x07, 0x67, 0x1f, 0x07, 0x77, 0x1f, 0x07, 0x8f, 0x27, 0x07,
  0x9f, 0x2f, 0x07, 0xaf, 0x3f, 0x07, 0xbf, 0x47, 0x07, 0xc7, 0x47, 0x07,
  0xdf, 0x4f, 0x07, 0xdf, 0x57, 0x07, 0xdf, 0x57, 0x07, 0xd7, 0x5f, 0x07,
  0xd7, 0x5f, 0x07, 0xd7, 0x67, 0x0f, 0xcf, 0x6f, 0x0f, 0xcf, 0x77, 0x0f,
  0xcf, 0x7f, 0x0f, 0xcf, 0x87, 0x17, 0xc7, 0x87, 0x17, 0xc7, 0x8f, 0x17,
  0xc7, 0x97, 0x1f, 0xbf, 0x9f, 0x1f, 0xbf, 0x9f, 0x1f, 0xbf, 0xa7, 0x27,
  0xbf, 0xa7, 0x27, 0xbf, 0xaf, 0x2f, 0xb7, 0xaf, 0x2f, 0xb7, 0xb7, 0x2f,
  0xb7, 0xb7, 0x37, 0xcf, 0xcf, 0x6f, 0xdf, 0xdf, 0x9f, 0xef, 0xef, 0xc7,
  0xff, 0xff, 0xff,
];
const MAX_HEAT = 36;

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const pack = ([r, g, b]) => ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;

function ramp(stops) {
  const out = new Uint8Array(37 * 3);
  const s = stops.map(([t, h]) => [t, hexRgb(h)]);
  for (let i = 0; i <= MAX_HEAT; i++) {
    const t = i / MAX_HEAT;
    let k = 0;
    while (k < s.length - 2 && t > s[k + 1][0]) k++;
    const [t0, c0] = s[k];
    const [t1, c1] = s[k + 1];
    const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    for (let j = 0; j < 3; j++) out[i * 3 + j] = Math.round(c0[j] + (c1[j] - c0[j]) * u);
  }
  return out;
}

const PALETTES = {
  fogo: Uint8Array.from(DOOM_RGB),
  energia: ramp([[0, '#000000'], [0.3, '#0a1a55'], [0.62, '#1f6fe0'], [0.86, '#7fd8ff'], [1, '#ffffff']]),
  veneno: ramp([[0, '#000000'], [0.3, '#0b2e0f'], [0.62, '#2f9a22'], [0.86, '#bdf03e'], [1, '#f6ffd8']]),
  sombra: ramp([[0, '#000000'], [0.3, '#22093a'], [0.62, '#6c22b0'], [0.86, '#cf8bff'], [1, '#fff0ff']]),
};

// ---------------------------------------------------------------------------
// Character materials: 4 tones each (deep, shadow, base, light)
// ---------------------------------------------------------------------------
const MATERIALS = {
  cloth:   ['#3f1915', '#6b2a22', '#93402f', '#c25b3e'],
  pants:   ['#141a2e', '#222b47', '#334269', '#4d6296'],
  skin:    ['#8a5440', '#b9785a', '#e2a982', '#f7d0a9'],
  hood:    ['#0e0c17', '#1a1628', '#282239', '#3d3456'],
  leather: ['#140e0b', '#2b1f18', '#4a3526', '#71523a'],
  metal:   ['#3c3f4a', '#6d7282', '#a3a9bb', '#eef1f8'],
  steel:   ['#1f2129', '#3b3f4c', '#5d6373', '#8d94a6'],
  scarf:   ['#6a2410', '#a8441e', '#d8672b', '#f69b4c'],
  white:   ['#f4efe6', '#f4efe6', '#f4efe6', '#f4efe6'],
  pupil:   ['#120d14', '#120d14', '#120d14', '#120d14'],
  lid:     ['#9c5f47', '#9c5f47', '#9c5f47', '#9c5f47'],
};
const FLAT = new Set(['white', 'pupil', 'lid']);
const MAT_NAMES = Object.keys(MATERIALS);
const MAT_INDEX = Object.fromEntries(MAT_NAMES.map((n, i) => [n, i]));
const MAT32 = MAT_NAMES.map((n) => MATERIALS[n].map((h) => pack(hexRgb(h))));
const MAT_FLAT = MAT_NAMES.map((n) => FLAT.has(n));
const OUTLINE32 = pack(hexRgb('#0b080d'));
const GLOW32 = pack(hexRgb('#fff6d8'));

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPt = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const approach = (v, target, d) => (v < target ? Math.min(target, v + d) : Math.max(target, v - d));
const easeInOut = (t) => t * t * (3 - 2 * t);

// 2-bone IK: returns the middle joint (knee) and the (possibly clamped) end point.
// bend = +1 puts the joint toward +x when the limb points down.
function ik(ax, ay, tx, ty, l1, l2, bend) {
  const dx = tx - ax;
  const dy = ty - ay;
  let d = Math.hypot(dx, dy);
  d = clamp(d, Math.abs(l1 - l2) + 0.001, l1 + l2 - 0.001);
  const th = Math.atan2(dy, dx);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ang = th - bend * A;
  return {
    jx: ax + Math.cos(ang) * l1,
    jy: ay + Math.sin(ang) * l1,
    ex: ax + Math.cos(th) * d,
    ey: ay + Math.sin(th) * d,
    tx, ty,
  };
}

// ---------------------------------------------------------------------------
// Character state + physics
// ---------------------------------------------------------------------------
const makeChain = (n, x, y) => Array.from({ length: n }, (_, i) => ({ x: x - i * 2, y, px: x - i * 2, py: y }));

const ch = {
  x: 80, y: FEET_Y, vx: 0, vy: 0,
  onGround: true, facing: 1, phase: 0,
  crouch: 0, squash: 0, air: 0, stride: 6,
  scarfA: makeChain(7, 80, FEET_Y - 30),
  scarfB: makeChain(6, 80, FEET_Y - 29),
  hood: { x: 74, y: FEET_Y - 40, vx: 0, vy: 0 },
  blink: 2, blinking: 0,
};

const dissolve = { state: 'none', t: 0 };
const DIS_OUT = 0.85;
const DIS_GAP = 0.35;
const DIS_IN = 0.7;

function startDissolve() {
  if (dissolve.state === 'none') { dissolve.state = 'out'; dissolve.t = 0; }
}

function resetSecondary(x) {
  for (const p of ch.scarfA) { p.x = p.px = x; p.y = p.py = FEET_Y - 30; }
  for (const p of ch.scarfB) { p.x = p.px = x; p.y = p.py = FEET_Y - 29; }
  ch.hood.x = x; ch.hood.y = FEET_Y - 40; ch.hood.vx = ch.hood.vy = 0;
}

function updateDissolve(dt) {
  if (dissolve.state === 'none') return;
  dissolve.t += dt;
  if (dissolve.state === 'out' && dissolve.t >= DIS_OUT) {
    dissolve.state = 'gap'; dissolve.t = 0;
  } else if (dissolve.state === 'gap' && dissolve.t >= DIS_GAP) {
    // Teleport somewhere at least 70px away.
    let nx;
    do { nx = 20 + Math.random() * (W - 40); } while (Math.abs(nx - ch.x) < 70);
    ch.facing = nx > ch.x ? 1 : -1;
    ch.x = nx; ch.vx = 0;
    resetSecondary(nx);
    dissolve.state = 'in'; dissolve.t = 0;
  } else if (dissolve.state === 'in' && dissolve.t >= DIS_IN) {
    dissolve.state = 'none'; dissolve.t = 0;
  }
}

let jumpBuffer = 0;
let landingBurst = 0;

function updateCharacter(dt, input) {
  const busy = dissolve.state !== 'none';
  const dir = busy ? 0 : input.dir;
  const crouching = !busy && input.crouch && ch.onGround;
  const runSpeed = cfg.walk * 2.1;
  const target = dir * (input.run ? runSpeed : cfg.walk) * (crouching ? 0.4 : 1);

  ch.vx = approach(ch.vx, target, (ch.onGround ? 340 : 180) * dt);
  if (dir !== 0) ch.facing = dir;

  if (input.jump) jumpBuffer = 0.12;
  jumpBuffer -= dt;
  if (jumpBuffer > 0 && ch.onGround && !busy) {
    ch.vy = -cfg.jump;
    ch.onGround = false;
    jumpBuffer = 0;
  }

  ch.vy += GRAVITY * dt;
  ch.x += ch.vx * dt;
  ch.y += ch.vy * dt;
  if (ch.y >= FEET_Y) {
    if (!ch.onGround) {
      ch.squash = clamp(ch.vy / 220, 0, 1);
      if (ch.vy > 80) landingBurst = ch.squash;
    }
    ch.y = FEET_Y; ch.vy = 0; ch.onGround = true;
  }
  if (ch.x < 12 || ch.x > W - 12) { ch.x = clamp(ch.x, 12, W - 12); ch.vx = 0; }

  ch.crouch = approach(ch.crouch, crouching ? 1 : 0, dt * 6);
  ch.squash = approach(ch.squash, 0, dt * 4);
  ch.air = lerp(ch.air, ch.onGround ? 0 : 1, Math.min(1, dt * 12));

  // Feet never slide: during the stance half of the cycle the hip travels exactly one stride.
  const speed = Math.abs(ch.vx);
  ch.stride = 5 + speed * 0.08;
  ch.phase += (ch.onGround ? (Math.PI * speed) / ch.stride : 4) * dt;

  // Blink every few seconds.
  ch.blink -= dt;
  if (ch.blink < 0) { ch.blinking = 0.13; ch.blink = 2.2 + Math.random() * 3.5; }
  ch.blinking = Math.max(0, ch.blinking - dt);
}

// ---------------------------------------------------------------------------
// Pose: a handful of sines + IK -> joint positions
// ---------------------------------------------------------------------------
let pose = null;

function computePose(t) {
  const f = ch.facing;
  const speed = Math.abs(ch.vx);
  const a = Math.min(1, speed / cfg.walk);                       // 0 idle .. 1 walking
  const run = clamp((speed - cfg.walk) / (cfg.walk * 1.1), 0, 1); // 0 walk .. 1 running
  const air = ch.air;
  const crouch = Math.max(ch.crouch, ch.squash);
  const ground = 1 - air;

  const bob = -Math.cos(2 * ch.phase) * (0.7 + run * 0.8) * a * ground;
  const breathe = Math.sin(t * 2.2) * (1 - a);
  const hipX = ch.x;
  const hipY = ch.y - LEG * 0.93 + crouch * 6.5 + bob;

  const legs = [];
  for (let i = 0; i < 2; i++) {
    const ph = ch.phase + i * Math.PI;
    const stand = i === 0 ? 2 : -1.7;
    const off = -Math.cos(ph) * (ch.stride / 2) * a + stand * (1 - a);
    const lift = Math.max(0, Math.sin(ph)) * cfg.step * (1 + run * 0.6) * a;
    let fx = hipX + f * off;
    let fy = ch.y - lift;
    // Tuck the legs while airborne.
    fx = lerp(fx, hipX + f * (i === 0 ? 3.5 : -2), air);
    fy = lerp(fy, hipY + LEG * (i === 0 ? 0.62 : 0.78), air);
    legs.push(ik(hipX, hipY, fx, fy, BODY.thigh, BODY.shin, f));
  }

  const lean = 0.06 + a * 0.1 + run * 0.22 - air * 0.05 + crouch * 0.25;
  const up = [f * Math.sin(lean), -Math.cos(lean)];  // torso axis
  const fw = [f * Math.cos(lean), Math.sin(lean)];   // torso "forward"
  const T = BODY.torso;
  const neckX = hipX + up[0] * T;
  const neckY = hipY + up[1] * T + breathe * 0.3;
  const shX = lerp(hipX, neckX, 0.86);
  const shY = lerp(hipY, neckY, 0.86);
  // The head stays more upright than the torso.
  const hl = lean * 0.4;
  const headX = neckX + f * (Math.sin(hl) * (BODY.headR + 0.4) + 0.6);
  const headY = neckY - Math.cos(hl) * (BODY.headR + 0.4);

  const arms = [];
  for (let i = 0; i < 2; i++) {
    const ph = ch.phase + i * Math.PI;
    const amp = (0.55 + run * 0.55) * a;
    // Arm swings opposite to the leg on the same side.
    let ua = Math.cos(ph) * amp + lean * 0.6 + Math.sin(t * 2.2 + i) * 0.05 * (1 - a) + crouch * 0.5;
    let fa = ua + 0.35 + run * 0.9 + crouch * 0.6;
    ua = lerp(ua, i === 0 ? 2.3 : 1.9, air * 0.85);
    fa = lerp(fa, i === 0 ? 2.8 : 2.4, air * 0.85);
    const ex = shX + f * Math.sin(ua) * BODY.upperArm;
    const ey = shY + Math.cos(ua) * BODY.upperArm;
    arms.push({ sx: shX, sy: shY, ex, ey, hx: ex + f * Math.sin(fa) * BODY.foreArm, hy: ey + Math.cos(fa) * BODY.foreArm });
  }

  pose = { f, hipX, hipY, neckX, neckY, headX, headY, legs, arms, up, fw, run, a, breathe };
  return pose;
}

// Point in the torso's local frame: a = forward, b = up from the hip.
const torsoPt = (a, b) => [pose.hipX + pose.fw[0] * a + pose.up[0] * b, pose.hipY + pose.fw[1] * a + pose.up[1] * b];

// Secondary motion: two Verlet scarf tails and a spring on the hood's tip.
function verlet(chain, anchor, len, t) {
  chain[0].x = chain[0].px = anchor[0];
  chain[0].y = chain[0].py = anchor[1];
  for (let i = 1; i < chain.length; i++) {
    const p = chain[i];
    const vx = (p.x - p.px) * 0.9;
    const vy = (p.y - p.py) * 0.9;
    p.px = p.x; p.py = p.y;
    p.x += vx;
    p.y += vy + 0.016 + Math.sin(t * 11 + i * 1.3) * 0.02 * i;
  }
  for (let k = 0; k < 4; k++) {
    for (let i = 1; i < chain.length; i++) {
      const a = chain[i - 1];
      const b = chain[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const diff = (d - len) / d;
      if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
      else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
    }
  }
}

function updateSecondary(t, dt) {
  const T = BODY.torso;
  verlet(ch.scarfA, torsoPt(-2.4, T - 0.6), 2.2, t);
  verlet(ch.scarfB, torsoPt(-2.2, T - 2.0), 2.1, t + 1.7);
  const f = pose.f;
  const tx = pose.headX - f * (BODY.headR + 2.4);
  const ty = pose.headY - 0.6 - pose.run * 0.8;
  const h = ch.hood;
  h.vx += ((tx - h.x) * 160 - h.vx * 13) * dt;
  h.vy += ((ty - h.y) * 160 - h.vy * 13) * dt;
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  // Keep the tip attached even after a teleport or a hard stop.
  const dx = h.x - tx;
  const dy = h.y - ty;
  const d = Math.hypot(dx, dy);
  if (d > 3) { h.x = tx + (dx / d) * 3; h.y = ty + (dy / d) * 3; }
}

// ---------------------------------------------------------------------------
// Rasterizer: joints -> part ids -> shaded pixels
// ---------------------------------------------------------------------------
const pbuf = new Uint8Array(W * H);  // part id per pixel (draw order = depth)
const mask = new Uint8Array(W * H);  // 0 empty, 1 body, 2 outline
const col = new Uint32Array(W * H);  // final character color
const partMat = new Uint8Array(64);
const partBack = new Uint8Array(64);
let partCount = 0;
let bbox = { minY: 0, maxY: 0 };

function part(material, back = false) {
  partCount++;
  partMat[partCount] = MAT_INDEX[material];
  partBack[partCount] = back ? 1 : 0;
  return partCount;
}

function plot(x, y, p) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && x < W && y >= 0 && y < H) pbuf[y * W + x] = p;
}
// Pixel-center test against the true circle keeps sub-pixel motion smooth.
function disk(cx, cy, r, p) {
  const x0 = Math.floor(cx - r);
  const x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r);
  const y1 = Math.ceil(cy + r);
  for (let y = y0; y <= y1; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= W) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) pbuf[y * W + x] = p;
    }
  }
}
// Tapered capsule from a (radius r0) to b (radius r1).
function seg(a, b, r0, r1, p) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2) + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    disk(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(r0, r1, t), p);
  }
}
function poly(pts, p) {
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) pbuf[y * W + x] = p;
    }
  }
}
function chain(points, r0, r1, p) {
  for (let i = 1; i < points.length; i++) {
    const t0 = (i - 1) / (points.length - 1);
    const t1 = i / (points.length - 1);
    seg([points[i - 1].x, points[i - 1].y], [points[i].x, points[i].y], lerp(r0, r1, t0), lerp(r0, r1, t1), p);
  }
}

function drawArm(arm, back) {
  const sh = [arm.sx, arm.sy];
  const el = [arm.ex, arm.ey];
  const wr = [arm.hx, arm.hy];
  const sleeve = part('cloth', back);
  seg(sh, el, 1.9, 1.5, sleeve);
  const cuff = lerpPt(el, wr, 0.35);
  seg(el, cuff, 1.5, 1.4, sleeve);
  seg(cuff, wr, 1.7, 1.4, part('leather', back)); // bracer
  const dx = wr[0] - el[0];
  const dy = wr[1] - el[1];
  const d = Math.hypot(dx, dy) || 1;
  disk(wr[0] + (dx / d) * 1.1, wr[1] + (dy / d) * 1.1, 1.6, part('skin', back)); // fist
}

function drawLeg(leg, f, back) {
  const hip = [pose.hipX, pose.hipY];
  const knee = [leg.jx, leg.jy];
  const ankle = [leg.ex, leg.ey];
  const pants = part('pants', back);
  seg(hip, knee, 2.6, 2.0, pants);
  seg(knee, ankle, 2.0, 1.6, pants);
  const boot = part('leather', back);
  const top = lerpPt(knee, ankle, 0.42);
  disk(top[0], top[1], 2.3, boot); // cuff
  seg(top, ankle, 2.0, 1.9, boot);
  seg([ankle[0] - f * 1.3, ankle[1] + 1.0], [ankle[0] + f * 3.8, ankle[1] + 1.4], 1.6, 1.1, boot);
  if (!back) disk(knee[0] + f * 0.6, knee[1], 1.5, part('leather')); // knee pad
}

function rasterize() {
  pbuf.fill(0);
  mask.fill(0);
  partCount = 0;
  if (dissolve.state === 'gap') { bbox = { minY: 0, maxY: 0 }; return; }
  const { f, legs, arms } = pose;
  const T = BODY.torso;

  // Back to front.
  // Sword on the back: scabbard, grip, guard, pommel.
  {
    const tip = torsoPt(-7.4, -4.5);
    const guardC = torsoPt(-2.7, T + 2.6);
    const pommel = torsoPt(-1.5, T + 6.6);
    seg(tip, guardC, 1.2, 1.5, part('leather', true));
    seg(guardC, pommel, 0.8, 0.8, part('leather', true));
    const dx = pommel[0] - tip[0];
    const dy = pommel[1] - tip[1];
    const d = Math.hypot(dx, dy);
    const nx = -dy / d;
    const ny = dx / d;
    seg([guardC[0] - nx * 2.6, guardC[1] - ny * 2.6], [guardC[0] + nx * 2.6, guardC[1] + ny * 2.6], 0.75, 0.75, part('metal'));
    disk(pommel[0], pommel[1], 1.1, part('metal'));
  }
  chain(ch.scarfB, 1.3, 0.6, part('scarf', true));
  chain(ch.scarfA, 1.5, 0.7, part('scarf'));
  drawArm(arms[1], true);
  drawLeg(legs[1], f, true);
  drawLeg(legs[0], f, false);

  // Torso: wider at the chest, breathing when idle.
  const torso = part('cloth');
  const chest = 3.9 + pose.breathe * 0.15;
  for (let k = 0; k <= 26; k++) {
    const t = k / 26;
    const r = t < 0.7 ? lerp(3.0, chest, t / 0.7) : lerp(chest, 2.7, (t - 0.7) / 0.3);
    const c = torsoPt(0.5 * Math.sin(Math.PI * t), T * t);
    disk(c[0], c[1], r, torso);
  }
  // Tunic skirt: its hem follows the thighs.
  {
    const hip = [pose.hipX, pose.hipY];
    const a0 = lerpPt(hip, [legs[0].jx, legs[0].jy], 0.62);
    const a1 = lerpPt(hip, [legs[1].jx, legs[1].jy], 0.62);
    const [fr, bk] = f * a0[0] >= f * a1[0] ? [a0, a1] : [a1, a0];
    poly([torsoPt(-3.3, 2.4), torsoPt(3.3, 2.4), [fr[0] + f * 1.8, fr[1] + 0.7], [bk[0] - f * 1.8, bk[1] + 0.7]], part('cloth'));
  }
  seg(torsoPt(2.4, T - 1.2), torsoPt(-3.2, 2.0), 0.7, 0.7, part('leather'));   // sword strap
  disk(...torsoPt(-3.7, 0.4), 1.6, part('leather'));                          // pouch
  seg(torsoPt(-3.4, 1.8), torsoPt(3.4, 1.8), 1.0, 1.0, part('leather'));     // belt
  disk(...torsoPt(3.2, 1.8), 0.9, part('metal'));                             // buckle

  // Scarf knot around the neck.
  const knot = part('scarf');
  disk(...torsoPt(-0.4, T + 0.3), 2.4, knot);
  seg(torsoPt(-0.4, T + 0.3), torsoPt(-2.6, T - 0.4), 1.8, 1.4, knot);

  // Head: hood (with a lagging tip), face window, scarf mask, eye, nose.
  {
    const cx = pose.headX;
    const cy = pose.headY;
    const r = BODY.headR;
    const hood = part('hood');
    seg([cx - f * 2.6, cy - 2.2], [ch.hood.x, ch.hood.y], 2.1, 0.8, hood);
    const face = part('skin');
    const maskP = part('scarf');
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const u = dx * f;
        let p = hood;
        if (u > -0.4 && dy > -1.4 && dy < 1.6) p = face;
        if (dy >= 1.6 && u > -1.4) p = maskP;
        plot(x, y, p);
      }
    }
    plot(cx + f * (r + 0.5), cy + 0.2, face);       // nose
    plot(cx + f * (r + 0.3), cy + 2.4, maskP);      // mask fold
    if (ch.blinking > 0) {
      const lid = part('lid');
      plot(cx + f * 1.6, cy - 0.4, lid);
      plot(cx + f * 2.6, cy - 0.4, lid);
    } else {
      plot(cx + f * 1.6, cy - 0.4, part('white'));
      plot(cx + f * 2.6, cy - 0.4, part('pupil'));
    }
  }

  drawArm(arms[0], false);
  {
    // Pauldron sits on top of the upper arm, below the neck.
    const a = arms[0];
    const d = Math.hypot(a.ex - a.sx, a.ey - a.sy) || 1;
    disk(a.sx + ((a.ex - a.sx) / d) * 1.4, a.sy + ((a.ey - a.sy) / d) * 1.4, 2.2, part('steel'));
  }

  shade();
  applyDissolve();
}

// Light comes from the moon (upper right). Each pixel picks one of 4 tones:
// next to a part drawn in front of it -> shadow (contact shadow / AO),
// edge facing the light -> light, edge facing away -> shadow, otherwise base.
// Parts behind the body are one tone darker. Then a 1-px outline wraps everything.
function shade() {
  let minY = H;
  let maxY = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const p = pbuf[i];
      if (p) {
        const m = partMat[p];
        let s = 2;
        if (cfg.shading && !MAT_FLAT[m]) {
          const up = pbuf[i - W];
          const dn = pbuf[i + W];
          const lf = pbuf[i - 1];
          const rt = pbuf[i + 1];
          if (up > p || dn > p || lf > p || rt > p) s = 1;
          else if (up !== p || rt !== p) s = 3;
          else if (dn !== p || lf !== p) s = 1;
          if (partBack[p]) s = Math.max(0, s - 1);
        }
        mask[i] = 1;
        col[i] = MAT32[m][s];
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else if (pbuf[i - 1] || pbuf[i + 1] || pbuf[i - W] || pbuf[i + W]) {
        mask[i] = 2;
        col[i] = OUTLINE32;
      }
    }
  }
  bbox = { minY: minY - 1, maxY: maxY + 1 };
}

// Dissolve / materialize: a horizontal cut sweeps the sprite; the cut line burns.
function applyDissolve() {
  if (dissolve.state !== 'out' && dissolve.state !== 'in') return;
  const out = dissolve.state === 'out';
  const span = bbox.maxY - bbox.minY + 2;
  const k = easeInOut(clamp(dissolve.t / (out ? DIS_OUT : DIS_IN), 0, 1));
  const cut = out ? bbox.minY - 1 + span * k : bbox.maxY + 1 - span * k;
  for (let y = Math.max(0, bbox.minY); y <= Math.min(H - 1, bbox.maxY); y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      const edge = out ? y >= cut - 2 && y < cut : y >= cut && y < cut + 1.5;
      if (edge) fire[i] = MAX_HEAT;
      if (y < cut) mask[i] = 0;
      else if (edge || Math.abs(y - cut) < 1) col[i] = GLOW32;
    }
  }
}

// ---------------------------------------------------------------------------
// DOOM fire, fed by the character instead of the bottom row
// ---------------------------------------------------------------------------
const fire = new Uint8Array(W * H);
let fireBias = 0; // -1/+1 = flames lean that way, 0 = symmetric flicker

function fireStep() {
  const decay = cfg.decay;
  for (let x = 0; x < W; x++) {
    for (let y = 1; y < H; y++) {
      const src = y * W + x;
      const p = fire[src];
      if (p === 0) { fire[src - W] = 0; continue; }
      const r = (Math.random() * 4) | 0;
      const shift = fireBias === 0 ? (r % 3) - 1 : (r - 1) * fireBias;
      const dx = clamp(x + shift, 0, W - 1);
      const loss = (r & 1) * decay;
      fire[(y - 1) * W + dx] = p > loss ? p - loss : 0;
    }
  }
}

function seedFire() {
  const speed = Math.abs(ch.vx);
  fireBias = speed > 10 ? -ch.facing : 0;
  if (dissolve.state !== 'none') return; // the dissolve seeds its own cut line

  let heat = 0;
  if (cfg.effect === 'aura') heat = MAX_HEAT;
  else if (cfg.effect === 'trail') {
    const k = Math.max(clamp(speed / (cfg.walk * 2.1), 0, 1), ch.onGround ? 0 : 0.7);
    heat = k > 0.25 ? Math.round(14 + 22 * k) : 0;
  }
  if (heat) {
    for (let i = 0; i < mask.length; i++) if (mask[i] && fire[i] < heat) fire[i] = heat;
  }
  if (landingBurst > 0 && cfg.effect !== 'none') {
    const row = (GROUND - 1) * W;
    const half = 5 + Math.round(landingBurst * 8);
    for (let x = Math.round(ch.x) - half; x <= Math.round(ch.x) + half; x++) {
      if (x >= 0 && x < W) fire[row + x] = Math.max(fire[row + x], 26 + ((Math.random() * 10) | 0));
    }
  }
  landingBurst = 0;
}

// ---------------------------------------------------------------------------
// Background: dithered night sky, ruins, moon, brick floor
// ---------------------------------------------------------------------------
function makeBackground() {
  const bg = new Uint32Array(W * H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const sky = ['#0a0910', '#0e0c16', '#130f1c', '#181221', '#1e1426', '#251729'].map(hexRgb);

  for (let y = 0; y < GROUND; y++) {
    for (let x = 0; x < W; x++) {
      const t = y / GROUND;
      const d = (bayer[(y & 3) * 4 + (x & 3)] / 16 - 0.5) / (sky.length - 1);
      const band = clamp(Math.round((t + d) * (sky.length - 1)), 0, sky.length - 1);
      bg[y * W + x] = pack(sky[band]);
    }
  }
  // Stars.
  for (let i = 0; i < 110; i++) {
    const x = (rnd() * W) | 0;
    const y = (rnd() * 75) | 0;
    const v = 60 + ((rnd() * 120) | 0);
    bg[y * W + x] = pack([v, v, Math.min(255, v + 25)]);
  }
  // Moon with a few craters.
  const mx = W - 36, my = 26, mr = 9;
  for (let dy = -mr; dy <= mr; dy++) {
    for (let dx = -mr; dx <= mr; dx++) {
      if (dx * dx + dy * dy > mr * mr) continue;
      const crater = (dx + 3) ** 2 + (dy - 1) ** 2 < 6 || (dx - 4) ** 2 + (dy + 4) ** 2 < 3 || (dx - 1) ** 2 + (dy - 5) ** 2 < 2;
      const shade = dx + dy > 8 ? '#b7ad9c' : crater ? '#c9bfab' : '#e6dcc6';
      bg[(my + dy) * W + mx + dx] = pack(hexRgb(shade));
    }
  }
  // Ruined pillars and a low wall.
  const ruin = pack(hexRgb('#140f18'));
  const ruinLit = pack(hexRgb('#1d1622'));
  for (let x = 0; x < W; x++) {
    const wall = 7 + ((Math.sin(x * 0.5) + Math.sin(x * 0.17)) > 1.2 ? 2 : 0);
    for (let y = GROUND - wall; y < GROUND; y++) bg[y * W + x] = ruin;
  }
  for (let px = 10; px < W; px += 44 + ((rnd() * 14) | 0)) {
    const h = 24 + ((rnd() * 24) | 0);
    for (let x = px; x < px + 8; x++) {
      const broken = x - px > 3 ? ((rnd() * 5) | 0) : 0;
      for (let y = GROUND - h + broken; y < GROUND; y++) bg[y * W + x] = x - px > 5 ? ruinLit : ruin;
    }
  }
  // Brick floor.
  const top = pack(hexRgb('#46343a'));
  const lip = pack(hexRgb('#2e232b'));
  const mortar = pack(hexRgb('#16111a'));
  const bricks = ['#2a2029', '#271d26', '#2d222b'].map((h) => pack(hexRgb(h)));
  for (let y = GROUND; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (y === GROUND) { bg[i] = top; continue; }
      if (y === GROUND + 1) { bg[i] = lip; continue; }
      const row = ((y - GROUND - 2) / 5) | 0;
      const bx = x + (row % 2) * 6;
      const isMortar = (y - GROUND - 2) % 5 === 4 || bx % 12 === 0;
      bg[i] = isMortar ? mortar : bricks[(((bx / 12) | 0) + row) % 3];
    }
  }
  return bg;
}
const BG = makeBackground();

// ---------------------------------------------------------------------------
// Compose + draw
// ---------------------------------------------------------------------------
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false });
const off = document.createElement('canvas');
off.width = W; off.height = H;
const offCtx = off.getContext('2d', { alpha: false });
const image = offCtx.createImageData(W, H);
const frame32 = new Uint32Array(image.data.buffer);

function mix(c, r, g, b, k) {
  const cr = c & 255;
  const cg = (c >> 8) & 255;
  const cb = (c >> 16) & 255;
  return ((0xff << 24) | (Math.round(cb + (b - cb) * k) << 16) | (Math.round(cg + (g - cg) * k) << 8) | Math.round(cr + (r - cr) * k)) >>> 0;
}

function compose() {
  const pal = PALETTES[cfg.palette];
  // Ground shadow: shrinks as the character rises.
  const visible = dissolve.state === 'none' || dissolve.state === 'in' ? 1 : dissolve.state === 'out' ? 1 - dissolve.t / DIS_OUT : 0;
  const rise = clamp((FEET_Y - ch.y) / 40, 0, 1);
  const rx = 11 * (1 - rise * 0.6);
  const shadowK = 0.55 * visible * (1 - rise * 0.5);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const m = mask[i];
      if (m) {
        let c = col[i];
        // Rim light: body pixels next to burning outline pick up the fire color.
        if (m === 1) {
          let h = 0;
          if (mask[i - 1] === 2 && fire[i - 1] > h) h = fire[i - 1];
          if (mask[i + 1] === 2 && fire[i + 1] > h) h = fire[i + 1];
          if (mask[i - W] === 2 && fire[i - W] > h) h = fire[i - W];
          if (mask[i + W] === 2 && fire[i + W] > h) h = fire[i + W];
          // Use a mid-palette tone (orange, not white) so the rim warms the edge without washing it out.
          if (h > 12 && c !== GLOW32) {
            const k = Math.min(h, 24);
            c = mix(c, pal[k * 3], pal[k * 3 + 1], pal[k * 3 + 2], (h / MAX_HEAT) * 0.35);
          }
        }
        frame32[i] = c;
        continue;
      }
      let bg = BG[i];
      if (shadowK > 0 && y >= GROUND && y <= GROUND + 2) {
        const u = (x - ch.x) / rx;
        const v = (y - GROUND - 0.3) / 2.2;
        if (u * u + v * v <= 1) bg = mix(bg, 0, 0, 0, shadowK);
      }
      const v = fire[i];
      if (!v) { frame32[i] = bg; continue; }
      // Additive glow over the background.
      const r = Math.min(255, (bg & 255) + pal[v * 3]);
      const g = Math.min(255, ((bg >> 8) & 255) + pal[v * 3 + 1]);
      const b = Math.min(255, ((bg >> 16) & 255) + pal[v * 3 + 2]);
      frame32[i] = ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
  }
  offCtx.putImageData(image, 0, 0);
}

let view = { s: 1, ox: 0, oy: 0 };
let camX = null;

function draw() {
  compose();
  const cw = canvas.width;
  const chh = canvas.height;
  let s = Math.min(cw / W, chh / H);
  // Narrow (portrait) screens: zoom in, show ~55% of the stage and follow the character.
  const zoom = Math.min(chh / H, cw / (W * 0.55));
  if (zoom > s) s = zoom;
  if (s >= 2) s = Math.floor(s);
  const dw = W * s;
  const dh = H * s;
  let ox;
  if (dw <= cw) {
    ox = Math.round((cw - dw) / 2);
    camX = null;
  } else {
    const target = cw / 2 - ch.x * s;
    camX = camX === null ? target : lerp(camX, target, 0.08);
    ox = Math.round(clamp(camX, cw - dw, 0));
  }
  view = { s, ox, oy: Math.round((chh - dh) / 2) };
  ctx.fillStyle = '#0a0910';
  ctx.fillRect(0, 0, cw, chh);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, view.ox, view.oy, dw, dh);
  if (cfg.skeleton && pose && dissolve.state === 'none') drawSkeleton();
}

function drawSkeleton() {
  const { s, ox, oy } = view;
  const P = (x, y) => [ox + (x + 0.5) * s, oy + (y + 0.5) * s];
  const line = (pts, color, w) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const [px, py] = P(x, y); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke();
  };
  const dot = (x, y, r, color) => {
    const [px, py] = P(x, y);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  };
  const w = Math.max(1.5, s * 0.3);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const bone = 'rgba(120, 225, 255, 0.95)';
  for (const leg of pose.legs) {
    line([[pose.hipX, pose.hipY], [leg.jx, leg.jy], [leg.ex, leg.ey]], bone, w);
    // IK target (where the foot wants to be).
    const [tx, ty] = P(leg.tx, leg.ty);
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.95)';
    ctx.lineWidth = Math.max(1, s * 0.18);
    const k = s * 1.2;
    ctx.beginPath(); ctx.moveTo(tx - k, ty); ctx.lineTo(tx + k, ty); ctx.moveTo(tx, ty - k); ctx.lineTo(tx, ty + k); ctx.stroke();
  }
  line([[pose.hipX, pose.hipY], [pose.neckX, pose.neckY], [pose.headX, pose.headY]], bone, w);
  for (const arm of pose.arms) line([[arm.sx, arm.sy], [arm.ex, arm.ey], [arm.hx, arm.hy]], bone, w);
  const thin = Math.max(1, s * 0.18);
  line(ch.scarfA.map((p) => [p.x, p.y]), 'rgba(255, 160, 90, 0.9)', thin);
  line(ch.scarfB.map((p) => [p.x, p.y]), 'rgba(255, 160, 90, 0.9)', thin);
  line([[pose.headX, pose.headY], [ch.hood.x, ch.hood.y]], 'rgba(200, 160, 255, 0.9)', thin);
  const r = Math.max(2, s * 0.45);
  dot(pose.hipX, pose.hipY, r * 1.2, '#ffffff');
  dot(pose.neckX, pose.neckY, r, '#ffffff');
  for (const leg of pose.legs) { dot(leg.jx, leg.jy, r, '#ffffff'); dot(leg.ex, leg.ey, r, '#ffffff'); }
  for (const arm of pose.arms) { dot(arm.ex, arm.ey, r, '#ffffff'); dot(arm.hx, arm.hy, r * 0.8, '#ffffff'); }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = thin;
  const [hx, hy] = P(pose.headX, pose.headY);
  ctx.beginPath(); ctx.arc(hx, hy, BODY.headR * s, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
}

// ---------------------------------------------------------------------------
// Input: keyboard, touch buttons, autopilot
// ---------------------------------------------------------------------------
const keys = new Set();
let jumpPressed = false;
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE']);

function takeControl() {
  if (cfg.auto) { cfg.auto = false; ui.auto.checked = false; }
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement || (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox')) return;
  if (MOVE_KEYS.has(e.code)) { e.preventDefault(); takeControl(); }
  keys.add(e.code);
  if (!e.repeat && (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space')) jumpPressed = true;
  if (!e.repeat && e.code === 'KeyE') startDissolve();
  if (!e.repeat && e.code === 'KeyK') { cfg.skeleton = !cfg.skeleton; ui.skeleton.checked = cfg.skeleton; }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

document.querySelectorAll('[data-hold]').forEach((btn) => {
  const code = btn.dataset.hold;
  const down = (e) => {
    e.preventDefault();
    takeControl();
    btn.setPointerCapture?.(e.pointerId);
    keys.add(code);
    if (code === 'ArrowUp') jumpPressed = true;
  };
  const up = () => keys.delete(code);
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('lostpointercapture', up);
});

function keyboardInput() {
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  const input = {
    dir: (right ? 1 : 0) - (left ? 1 : 0),
    run: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Run'),
    crouch: keys.has('ArrowDown') || keys.has('KeyS'),
    jump: jumpPressed,
  };
  jumpPressed = false;
  return input;
}

const ai = { target: null, wait: 1.2, run: false, crouch: false, jumpCd: 2.5, disCd: 7 };

function autopilotInput(dt) {
  ai.jumpCd -= dt;
  ai.disCd -= dt;
  const idle = { dir: 0, run: false, crouch: ai.crouch, jump: false };
  if (dissolve.state !== 'none') return idle;
  if (ai.wait > 0) { ai.wait -= dt; return idle; }
  if (ai.target === null) {
    ai.target = 20 + Math.random() * (W - 40);
    ai.run = Math.random() < 0.4;
    ai.crouch = false;
  }
  const d = ai.target - ch.x;
  if (Math.abs(d) < 4) {
    ai.target = null;
    ai.wait = 0.6 + Math.random() * 1.4;
    ai.crouch = Math.random() < 0.25;
    if (ai.disCd < 0) { startDissolve(); ai.disCd = 8 + Math.random() * 6; }
    return idle;
  }
  let jump = false;
  if (ai.jumpCd < 0 && Math.random() < dt * 0.7) { jump = true; ai.jumpCd = 1.5 + Math.random() * 2; }
  return { dir: Math.sign(d), run: ai.run, crouch: false, jump };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
const ui = {
  effect: document.getElementById('effect'),
  palette: document.getElementById('palette'),
  flames: document.getElementById('flames'),
  step: document.getElementById('step'),
  speed: document.getElementById('speed'),
  shading: document.getElementById('shading'),
  skeleton: document.getElementById('skeleton'),
  auto: document.getElementById('auto'),
  dissolve: document.getElementById('dissolve'),
  flamesVal: document.getElementById('flamesVal'),
  stepVal: document.getElementById('stepVal'),
  speedVal: document.getElementById('speedVal'),
};

function syncLabels() {
  ui.flamesVal.textContent = ui.flames.value;
  ui.stepVal.textContent = cfg.step;
  ui.speedVal.textContent = cfg.walk;
}

ui.effect.addEventListener('change', () => { cfg.effect = ui.effect.value; });
ui.palette.addEventListener('change', () => { cfg.palette = ui.palette.value; });
ui.flames.addEventListener('input', () => { cfg.decay = 5 - +ui.flames.value; syncLabels(); });
ui.step.addEventListener('input', () => { cfg.step = +ui.step.value; syncLabels(); });
ui.speed.addEventListener('input', () => { cfg.walk = +ui.speed.value; syncLabels(); });
ui.shading.addEventListener('change', () => { cfg.shading = ui.shading.checked; });
ui.skeleton.addEventListener('change', () => { cfg.skeleton = ui.skeleton.checked; });
ui.auto.addEventListener('change', () => { cfg.auto = ui.auto.checked; ai.target = null; ai.wait = 0.3; });
ui.dissolve.addEventListener('click', startDissolve);

// ---------------------------------------------------------------------------
// Loop: fixed 60 Hz physics, fire at 30 Hz (the chunky DOOM cadence)
// ---------------------------------------------------------------------------
let simTime = 0;
let tickCount = 0;

function tick() {
  const input = cfg.auto ? autopilotInput(DT) : keyboardInput();
  updateCharacter(DT, input);
  updateDissolve(DT);
  computePose(simTime);
  updateSecondary(simTime, DT);
  rasterize();
  if (tickCount % 2 === 0) {
    fireStep();
    seedFire();
  }
  simTime += DT;
  tickCount++;
}

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= DT) { tick(); acc -= DT; }
  draw();
}

new ResizeObserver(() => { fitCanvas(); if (pose) draw(); }).observe(canvas);
fitCanvas();
syncLabels();
// Warm up so the first frame already shows flames.
for (let i = 0; i < 90; i++) tick();
requestAnimationFrame((t) => { last = t; frame(t); });
