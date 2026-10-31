// Fire Walker — procedural pixel character + DOOM fire.
//
// 1. The character has no sprite sheet. Each frame a tiny skeleton (hip, knees, feet,
//    neck, head, elbows, hands) is posed with a few sines and 2-bone IK, then rasterized
//    into a 192×108 grid of color ids and outlined. The low resolution hides the math.
// 2. The character's silhouette feeds the DOOM fire algorithm as its heat source:
//    aura (every pixel burns), trail (burns only while moving) and dissolve/teleport.

'use strict';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const W = 192;
const H = 108;
const GROUND = 94;          // first row of the floor
const FEET_Y = GROUND - 2;  // where the ankles rest
const DT = 1 / 60;
const GRAVITY = 300;

const BODY = { thigh: 6, shin: 6, torso: 8, headR: 3.4, upperArm: 4.5, foreArm: 4.2 };
const LEG = BODY.thigh + BODY.shin;

const cfg = {
  effect: 'aura',   // aura | trail | none
  palette: 'fogo',
  decay: 3,         // fire heat lost per row (lower = taller flames)
  step: 3,          // foot lift in pixels
  walk: 28,         // walk speed in px/s (run = 2.1×)
  jump: 115,
  skeleton: false,
  auto: true,
};

// ---------------------------------------------------------------------------
// Palettes (37 entries, index 0 = no heat)
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

// Character color ids -> packed ABGR.
const pack = ([r, g, b]) => ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
const C = {
  OUTLINE: 1, LEG_BACK: 2, LEG_FRONT: 3, TUNIC: 4, SKIN: 5, HOOD: 6, EYE: 7,
  SCARF: 8, SCARF_DARK: 9, ARM_BACK: 10, BOOT: 11, BELT: 12, GLOW: 13,
};
const CHAR_HEX = [
  '#000000', '#0d0a0e', '#26304a', '#3a4870', '#8a3a2c', '#e9b38a', '#1c1828',
  '#fff1c2', '#e0702c', '#a8441e', '#5e2620', '#14151d', '#c9a24a', '#fff6d8',
];
const CHAR32 = new Uint32Array(CHAR_HEX.map((h) => pack(hexRgb(h))));

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, target, d) => (v < target ? Math.min(target, v + d) : Math.max(target, v - d));
const easeInOut = (t) => t * t * (3 - 2 * t);

// 2-bone IK: returns knee/elbow and the (possibly clamped) end point.
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
const ch = {
  x: 60, y: FEET_Y, vx: 0, vy: 0,
  onGround: true, facing: 1, phase: 0,
  crouch: 0, squash: 0, air: 0, stride: 4,
  scarf: [],
};
for (let i = 0; i < 7; i++) ch.scarf.push({ x: ch.x - i * 1.5, y: FEET_Y - 20, px: ch.x - i * 1.5, py: FEET_Y - 20 });

const dissolve = { state: 'none', t: 0 };
const DIS_OUT = 0.8;
const DIS_GAP = 0.35;
const DIS_IN = 0.65;

function startDissolve() {
  if (dissolve.state === 'none') { dissolve.state = 'out'; dissolve.t = 0; }
}

function updateDissolve(dt) {
  if (dissolve.state === 'none') return;
  dissolve.t += dt;
  if (dissolve.state === 'out' && dissolve.t >= DIS_OUT) {
    dissolve.state = 'gap'; dissolve.t = 0;
  } else if (dissolve.state === 'gap' && dissolve.t >= DIS_GAP) {
    // Teleport somewhere at least 50px away.
    let nx;
    do { nx = 16 + Math.random() * (W - 32); } while (Math.abs(nx - ch.x) < 50);
    ch.facing = nx > ch.x ? 1 : -1;
    ch.x = nx; ch.vx = 0;
    for (const p of ch.scarf) { p.x = p.px = nx; p.y = p.py = FEET_Y - 20; }
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

  ch.vx = approach(ch.vx, target, (ch.onGround ? 260 : 140) * dt);
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
      ch.squash = clamp(ch.vy / 180, 0, 1);
      if (ch.vy > 60) landingBurst = ch.squash;
    }
    ch.y = FEET_Y; ch.vy = 0; ch.onGround = true;
  }
  if (ch.x < 8 || ch.x > W - 8) { ch.x = clamp(ch.x, 8, W - 8); ch.vx = 0; }

  ch.crouch = approach(ch.crouch, crouching ? 1 : 0, dt * 6);
  ch.squash = approach(ch.squash, 0, dt * 4);
  ch.air = lerp(ch.air, ch.onGround ? 0 : 1, Math.min(1, dt * 12));

  // Feet never slide: during the stance half of the cycle the hip travels exactly one stride.
  const speed = Math.abs(ch.vx);
  ch.stride = 3.5 + speed * 0.08;
  ch.phase += (ch.onGround ? (Math.PI * speed) / ch.stride : 4) * dt;
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

  const bob = -Math.cos(2 * ch.phase) * (0.5 + run * 0.6) * a * ground;
  const breathe = Math.sin(t * 2.2) * (1 - a);
  const hipX = ch.x;
  const hipY = ch.y - LEG * 0.93 + crouch * 4.5 + bob;

  const legs = [];
  for (let i = 0; i < 2; i++) {
    const ph = ch.phase + i * Math.PI;
    const stand = i === 0 ? 1.4 : -1.2;
    const off = -Math.cos(ph) * (ch.stride / 2) * a + stand * (1 - a);
    const lift = Math.max(0, Math.sin(ph)) * cfg.step * (1 + run * 0.6) * a;
    let fx = hipX + f * off;
    let fy = ch.y - lift;
    // Tuck the legs while airborne.
    fx = lerp(fx, hipX + f * (i === 0 ? 2.5 : -1.5), air);
    fy = lerp(fy, hipY + LEG * (i === 0 ? 0.62 : 0.78), air);
    legs.push(ik(hipX, hipY, fx, fy, BODY.thigh, BODY.shin, f));
  }

  const lean = 0.06 + a * 0.1 + run * 0.22 - air * 0.05 + crouch * 0.25;
  const neckX = hipX + f * Math.sin(lean) * BODY.torso;
  const neckY = hipY - Math.cos(lean) * BODY.torso + breathe * 0.3;
  const shX = lerp(hipX, neckX, 0.85);
  const shY = lerp(hipY, neckY, 0.85);
  const headX = neckX + f * (Math.sin(lean) * (BODY.headR + 0.6) + 0.4);
  const headY = neckY - Math.cos(lean) * (BODY.headR + 0.6);

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

  pose = { f, hipX, hipY, neckX, neckY, headX, headY, legs, arms, run, a };
  return pose;
}

// Verlet scarf pinned to the back of the neck.
function updateScarf(t) {
  const s = ch.scarf;
  s[0].x = s[0].px = pose.neckX - pose.f * 1;
  s[0].y = s[0].py = pose.neckY + 0.5;
  for (let i = 1; i < s.length; i++) {
    const p = s[i];
    const vx = (p.x - p.px) * 0.9;
    const vy = (p.y - p.py) * 0.9;
    p.px = p.x; p.py = p.y;
    p.x += vx;
    p.y += vy + 0.012 + Math.sin(t * 11 + i * 1.3) * 0.015 * i;
  }
  for (let k = 0; k < 4; k++) {
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1];
      const b = s[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const diff = (d - 1.6) / d;
      if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
      else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
    }
  }
}

// ---------------------------------------------------------------------------
// Rasterizer: joints -> 192×108 grid of color ids
// ---------------------------------------------------------------------------
const cbuf = new Uint8Array(W * H);
const tmp = new Uint8Array(W * H);
let bbox = { minY: 0, maxY: 0 };

function plot(x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && x < W && y >= 0 && y < H) cbuf[y * W + x] = c;
}
function disk(cx, cy, r, c) {
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy <= r * r) plot(x0 + dx, y0 + dy, c);
    }
  }
}
function seg(ax, ay, bx, by, r, c) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2) + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    disk(lerp(ax, bx, t), lerp(ay, by, t), r, c);
  }
}

function drawLeg(leg, f, color) {
  seg(pose.hipX, pose.hipY, leg.jx, leg.jy, 1.3, color);
  seg(leg.jx, leg.jy, leg.ex, leg.ey, 1.2, color);
  seg(leg.ex, leg.ey, leg.ex + f * 2, leg.ey, 1.0, C.BOOT);
}
function drawArm(arm, color) {
  seg(arm.sx, arm.sy, arm.ex, arm.ey, 1.1, color);
  seg(arm.ex, arm.ey, arm.hx, arm.hy, 1.0, color);
  disk(arm.hx, arm.hy, 0.8, C.SKIN);
}

function rasterize() {
  cbuf.fill(0);
  if (dissolve.state === 'gap') { bbox = { minY: 0, maxY: 0 }; return; }
  const { f, legs, arms } = pose;

  // Back to front: scarf, back arm, back leg, torso, head, front leg, front arm.
  const s = ch.scarf;
  for (let i = 1; i < s.length; i++) {
    seg(s[i - 1].x, s[i - 1].y, s[i].x, s[i].y, i < 3 ? 1.0 : 0.6, i % 2 ? C.SCARF : C.SCARF_DARK);
  }
  drawArm(arms[1], C.ARM_BACK);
  drawLeg(legs[1], f, C.LEG_BACK);
  seg(pose.hipX, pose.hipY, pose.neckX, pose.neckY, 2.4, C.TUNIC);
  seg(pose.hipX - 2.2, pose.hipY - 0.6, pose.hipX + 2.2, pose.hipY - 0.6, 0.6, C.BELT);

  // Head: skin disk, hood over the top and back, one-pixel eye.
  const hx = Math.round(pose.headX);
  const hy = Math.round(pose.headY);
  const r = BODY.headR;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const hood = dy < -0.6 || dx * f < -0.8;
      plot(hx + dx, hy + dy, hood ? C.HOOD : C.SKIN);
    }
  }
  plot(hx + f * 1.6, hy, C.HOOD);

  drawLeg(legs[0], f, C.LEG_FRONT);
  drawArm(arms[0], C.TUNIC);

  // 1-pixel outline around everything.
  tmp.set(cbuf);
  let minY = H, maxY = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (tmp[i]) { if (y < minY) minY = y; if (y > maxY) maxY = y; continue; }
      if (tmp[i - 1] || tmp[i + 1] || tmp[i - W] || tmp[i + W]) cbuf[i] = C.OUTLINE;
    }
  }
  bbox = { minY: minY - 1, maxY: maxY + 1 };

  // Dissolve / materialize: a horizontal cut sweeps the sprite; the cut line burns.
  if (dissolve.state === 'out' || dissolve.state === 'in') {
    const span = bbox.maxY - bbox.minY + 2;
    const k = easeInOut(clamp(dissolve.t / (dissolve.state === 'out' ? DIS_OUT : DIS_IN), 0, 1));
    const cut = dissolve.state === 'out' ? bbox.minY - 1 + span * k : bbox.maxY + 1 - span * k;
    for (let y = bbox.minY; y <= bbox.maxY; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!cbuf[i]) continue;
        const gone = dissolve.state === 'out' ? y < cut : y < cut;
        const edge = dissolve.state === 'out' ? y >= cut - 2 && y < cut : y >= cut && y < cut + 1.5;
        if (edge) { fire[i] = MAX_HEAT; }
        if (gone) cbuf[i] = 0;
        else if (edge || Math.abs(y - cut) < 1) cbuf[i] = C.GLOW;
      }
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
  fireBias = speed > 8 ? -ch.facing : 0;
  if (dissolve.state !== 'none') return; // the dissolve seeds its own cut line

  let heat = 0;
  if (cfg.effect === 'aura') heat = MAX_HEAT;
  else if (cfg.effect === 'trail') {
    const k = Math.max(clamp(speed / (cfg.walk * 2.1), 0, 1), ch.onGround ? 0 : 0.7);
    heat = k > 0.25 ? Math.round(14 + 22 * k) : 0;
  }
  if (heat) {
    for (let i = 0; i < cbuf.length; i++) if (cbuf[i] && fire[i] < heat) fire[i] = heat;
  }
  if (landingBurst > 0 && cfg.effect !== 'none') {
    const row = (GROUND - 1) * W;
    const half = 4 + Math.round(landingBurst * 6);
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
  for (let i = 0; i < 70; i++) {
    const x = (rnd() * W) | 0;
    const y = (rnd() * 55) | 0;
    const v = 60 + ((rnd() * 120) | 0);
    bg[y * W + x] = pack([v, v, Math.min(255, v + 25)]);
  }
  // Moon with a couple of craters.
  const mx = 158, my = 20, mr = 7;
  for (let dy = -mr; dy <= mr; dy++) {
    for (let dx = -mr; dx <= mr; dx++) {
      if (dx * dx + dy * dy > mr * mr) continue;
      const crater = (dx + 2) ** 2 + (dy - 1) ** 2 < 4 || (dx - 3) ** 2 + (dy + 3) ** 2 < 2;
      const shade = dx + dy > 6 ? '#b7ad9c' : crater ? '#c9bfab' : '#e6dcc6';
      bg[(my + dy) * W + mx + dx] = pack(hexRgb(shade));
    }
  }
  // Ruined pillars and a low wall.
  const ruin = pack(hexRgb('#140f18'));
  const ruinLit = pack(hexRgb('#1d1622'));
  for (let x = 0; x < W; x++) {
    const wall = 5 + ((Math.sin(x * 0.7) + Math.sin(x * 0.23)) > 1.2 ? 1 : 0);
    for (let y = GROUND - wall; y < GROUND; y++) bg[y * W + x] = ruin;
  }
  for (let px = 8; px < W; px += 34 + ((rnd() * 10) | 0)) {
    const h = 18 + ((rnd() * 18) | 0);
    for (let x = px; x < px + 6; x++) {
      const broken = x - px > 2 ? ((rnd() * 4) | 0) : 0;
      for (let y = GROUND - h + broken; y < GROUND; y++) bg[y * W + x] = x === px ? ruinLit : ruin;
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
      const row = ((y - GROUND - 2) / 4) | 0;
      const bx = x + (row % 2) * 5;
      const isMortar = (y - GROUND - 2) % 4 === 3 || bx % 10 === 0;
      bg[i] = isMortar ? mortar : bricks[(((bx / 10) | 0) + row) % 3];
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

function compose() {
  const pal = PALETTES[cfg.palette];
  for (let i = 0; i < W * H; i++) {
    const c = cbuf[i];
    if (c) { frame32[i] = CHAR32[c]; continue; }
    const bg = BG[i];
    const v = fire[i];
    if (!v) { frame32[i] = bg; continue; }
    // Additive glow over the background.
    const r = Math.min(255, (bg & 255) + pal[v * 3]);
    const g = Math.min(255, ((bg >> 8) & 255) + pal[v * 3 + 1]);
    const b = Math.min(255, ((bg >> 16) & 255) + pal[v * 3 + 2]);
    frame32[i] = ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
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
    const k = s * 0.9;
    ctx.beginPath(); ctx.moveTo(tx - k, ty); ctx.lineTo(tx + k, ty); ctx.moveTo(tx, ty - k); ctx.lineTo(tx, ty + k); ctx.stroke();
  }
  line([[pose.hipX, pose.hipY], [pose.neckX, pose.neckY], [pose.headX, pose.headY]], bone, w);
  for (const arm of pose.arms) line([[arm.sx, arm.sy], [arm.ex, arm.ey], [arm.hx, arm.hy]], bone, w);
  line(ch.scarf.map((p) => [p.x, p.y]), 'rgba(255, 160, 90, 0.9)', Math.max(1, s * 0.18));
  const r = Math.max(2, s * 0.45);
  dot(pose.hipX, pose.hipY, r * 1.2, '#ffffff');
  dot(pose.neckX, pose.neckY, r, '#ffffff');
  for (const leg of pose.legs) { dot(leg.jx, leg.jy, r, '#ffffff'); dot(leg.ex, leg.ey, r, '#ffffff'); }
  for (const arm of pose.arms) { dot(arm.ex, arm.ey, r, '#ffffff'); dot(arm.hx, arm.hy, r * 0.8, '#ffffff'); }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(1, s * 0.18);
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
    ai.target = 16 + Math.random() * (W - 32);
    ai.run = Math.random() < 0.4;
    ai.crouch = false;
  }
  const d = ai.target - ch.x;
  if (Math.abs(d) < 3) {
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
  updateScarf(simTime);
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
