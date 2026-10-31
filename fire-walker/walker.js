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
// 4. A chargeable spell: the orb, the bolt, its explosion and the embers are all heat
//    sources for the same fire.
// 5. Ghouls walk in to attack. A hit makes them feel it (hit-stop, flash, recoil,
//    knockback) and catch fire: their own pixels become heat sources, they panic,
//    char, spread the fire and finally burn away into ash.

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
  effect: 'trail',  // aura | trail | none
  palette: 'fogo',
  decay: 3,         // fire heat lost per row (lower = taller flames)
  step: 4,          // foot lift in pixels
  walk: 38,         // walk speed in px/s (run = 2.1×)
  jump: 150,
  shading: true,
  skeleton: false,
  auto: true,
  enemies: 'few',   // off (training dummy) | few | many
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
  straw:   ['#4a3a1c', '#7a6230', '#a88a46', '#d6b86c'],
  wood:    ['#21150d', '#3d2817', '#5e3f24', '#83603a'],
  rope:    ['#3a2f22', '#6b5a40', '#97815c', '#c4ad82'],
  ghoul:   ['#1b241d', '#2f3f33', '#4b6450', '#73917a'],
  rags:    ['#17120e', '#2a2119', '#43362a', '#62513f'],
  bone:    ['#5a5240', '#8d846a', '#c2b998', '#ebe4c8'],
  eyeglow: ['#ffd84a', '#ffd84a', '#ffd84a', '#ffd84a'],
  mouth:   ['#1a0606', '#1a0606', '#1a0606', '#1a0606'],
  white:   ['#f4efe6', '#f4efe6', '#f4efe6', '#f4efe6'],
  pupil:   ['#120d14', '#120d14', '#120d14', '#120d14'],
  lid:     ['#9c5f47', '#9c5f47', '#9c5f47', '#9c5f47'],
};
const FLAT = new Set(['white', 'pupil', 'lid', 'eyeglow', 'mouth']);
const MAT_NAMES = Object.keys(MATERIALS);
const MAT_INDEX = Object.fromEntries(MAT_NAMES.map((n, i) => [n, i]));
const MAT32 = MAT_NAMES.map((n) => MATERIALS[n].map((h) => pack(hexRgb(h))));
const MAT_FLAT = MAT_NAMES.map((n) => FLAT.has(n));
const OUTLINE32 = pack(hexRgb('#0b080d'));
const GLOW32 = pack(hexRgb('#fff6d8'));
const PAL32 = Object.fromEntries(Object.entries(PALETTES).map(([k, p]) =>
  [k, Uint32Array.from({ length: MAX_HEAT + 1 }, (_, i) => pack([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]))]));

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
  hurt: 0, flash: 0,
};

const dissolve = { state: 'none', t: 0 };
const DIS_OUT = 0.85;
const DIS_GAP = 0.35;
const DIS_IN = 0.7;

function startDissolve() {
  if (dissolve.state === 'none' && spell.state === 'idle') { dissolve.state = 'out'; dissolve.t = 0; }
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
  const busy = dissolve.state !== 'none' || spell.state !== 'idle' || ch.hurt > 0;
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
  ch.hurt = Math.max(0, ch.hurt - dt);
  ch.flash = Math.max(0, ch.flash - dt);
}

// ---------------------------------------------------------------------------
// Spell: hold to charge an orb in the hand, release to throw it
// ---------------------------------------------------------------------------
const spell = { state: 'idle', t: 0, power: 0, release: false, launched: false };
const CHARGE_MIN = 0.22;   // shortest wind-up, even for a tap
const CHARGE_FULL = 1.0;   // seconds to full power
const RELEASE_T = 0.14;
const RECOVER_T = 0.35;
const bolts = [];
const embers = [];
const blasts = [];
let shake = 0;

const dummy = { x: W - 52, ang: 0, angV: 0, burn: 0, hits: 0 };

const orbRadius = () => 1.2 + spell.power * 2.6;

function updateSpell(dt, held) {
  const s = spell;
  if (s.state === 'idle') {
    if (held && dissolve.state === 'none') {
      s.state = 'charge'; s.t = 0; s.power = 0; s.release = false; s.launched = false;
    }
    return;
  }
  s.t += dt;
  if (s.state === 'charge') {
    s.power = clamp(s.t / CHARGE_FULL, 0, 1);
    if (!held) s.release = true;
    if (pose && Math.random() < 0.45 + s.power * 0.5) spawnInward();
    if (s.release && s.t >= CHARGE_MIN) { s.state = 'release'; s.t = 0; }
  } else if (s.state === 'release') {
    if (!s.launched && s.t >= 0.05) { launch(); s.launched = true; }
    if (s.t >= RELEASE_T) { s.state = 'recover'; s.t = 0; }
  } else if (s.state === 'recover' && s.t >= RECOVER_T) {
    s.state = 'idle'; s.t = 0;
  }
}

// Sparks sucked into the hand while charging.
function spawnInward() {
  const [hx, hy] = pose.hand;
  const a = Math.random() * Math.PI * 2;
  const d = 9 + Math.random() * 7;
  const life = 0.18 + Math.random() * 0.1;
  const x = hx + Math.cos(a) * d;
  const y = hy + Math.sin(a) * d;
  embers.push({ x, y, vx: (hx - x) / life, vy: (hy - y) / life, life, heat: 22 + spell.power * 10, g: 0 });
}

function launch() {
  const f = ch.facing;
  const [hx, hy] = pose.hand;
  const p = spell.power;
  bolts.push({ x: hx + f * 2, y: hy, y0: hy, vx: f * (150 + p * 90), r: 1.8 + p * 2.6, age: 0, sx: hx, sy: hy, power: p });
  ch.vx = -f * (18 + 30 * p); // recoil
  shake = Math.max(shake, 0.5 + p);
}

function impact(b, onDummy, target = null) {
  b.dead = true;
  const dir = Math.sign(b.vx);
  const R = 6 + b.power * 10;
  blasts.push({ x: b.x, y: b.y, t: 0, R });
  if (target) hitEnemy(target, 25 + b.power * 60, dir, b.power, 2.5 + b.power * 2.5);
  // Splash: the explosion also hurts and ignites ghouls nearby.
  for (const e of enemies) {
    if (e === target || e.state === 'dying') continue;
    if (Math.abs(e.x - b.x) < R + 6 && b.y > e.y - 44 * e.scale - R && b.y < e.y + R) {
      hitEnemy(e, 12 + b.power * 25, Math.sign(e.x - b.x) || dir, b.power * 0.5, 1.5 + b.power * 2);
    }
  }
  const n = 12 + Math.round(b.power * 20);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * Math.random();
    const sp = (50 + Math.random() * 110) * (0.6 + b.power * 0.7);
    embers.push({
      x: b.x, y: b.y,
      vx: Math.cos(a) * sp - dir * 25, vy: Math.sin(a) * sp - 20,
      life: 0.5 + Math.random() * 0.9, heat: 30 + ((Math.random() * 6) | 0), g: 1,
    });
  }
  shake = Math.max(shake, 1.5 + b.power * 2.5);
  if (onDummy) {
    dummy.angV += dir * (4 + b.power * 6);
    dummy.burn = Math.max(dummy.burn, 1.6 + b.power * 1.8);
    dummy.hits++;
  }
}

function updateProjectiles(dt) {
  for (const b of bolts) {
    b.age += dt;
    b.x += b.vx * dt;
    b.y = b.y0 + Math.sin(b.age * 18) * 0.6;
    let target = null;
    for (const e of enemies) {
      if (e.state === 'dying') continue;
      if (Math.abs(e.x - b.x) < 5 * e.scale + b.r * 0.5 && b.y > e.y - 40 * e.scale && b.y < e.y + 2) { target = e; break; }
    }
    if (target) impact(b, false, target);
    else if (cfg.enemies === 'off' && Math.abs(dummy.x - b.x) < 6 && b.y > GROUND - 40 && b.y < GROUND - 6) impact(b, true);
    else if (b.x < 2 || b.x > W - 3 || b.age > 3) impact(b, false);
  }
  for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].dead) bolts.splice(i, 1);

  for (const e of embers) {
    e.life -= dt;
    if (e.g) e.vy += 240 * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.g && e.y >= GROUND - 1) { e.y = GROUND - 1; e.vy *= -0.35; e.vx *= 0.6; }
  }
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    if (e.life <= 0 || e.x < 0 || e.x >= W || e.y < 0) embers.splice(i, 1);
  }

  for (const bl of blasts) bl.t += dt;
  for (let i = blasts.length - 1; i >= 0; i--) if (blasts[i].t > 0.35) blasts.splice(i, 1);

  // Dummy: a damped spring around its base.
  dummy.angV += (-dummy.ang * 90 - dummy.angV * 5) * dt;
  dummy.ang += dummy.angV * dt;
  dummy.burn = Math.max(0, dummy.burn - dt);
  shake = Math.max(0, shake - dt * 7);
}

// ---------------------------------------------------------------------------
// Pose: a handful of sines + IK -> joint positions
// ---------------------------------------------------------------------------
let pose = null;

// Target angles for the cast: [front arm, back arm]. Angles are measured from
// straight down, positive = toward where the character faces.
// Charge: both hands cupped in front of the chest around the orb.
const CAST_CHARGE = { ua: [0.5, 0.75], fa: [1.9, 2.15], lean: -0.04, lunge: 0.25 };
const CAST_RELEASE = { ua: [1.5, -0.5], fa: [1.55, -0.2], lean: 0.3, lunge: 1 };

function castBlend() {
  const s = spell;
  if (s.state === 'charge') return { k: easeInOut(clamp(s.t / 0.18, 0, 1)), ...CAST_CHARGE };
  if (s.state === 'release') {
    const u = easeInOut(clamp(s.t / 0.07, 0, 1));
    return {
      k: 1,
      ua: CAST_CHARGE.ua.map((v, i) => lerp(v, CAST_RELEASE.ua[i], u)),
      fa: CAST_CHARGE.fa.map((v, i) => lerp(v, CAST_RELEASE.fa[i], u)),
      lean: lerp(CAST_CHARGE.lean, CAST_RELEASE.lean, u),
      lunge: lerp(CAST_CHARGE.lunge, CAST_RELEASE.lunge, u),
    };
  }
  if (s.state === 'recover') return { k: 1 - easeInOut(clamp(s.t / RECOVER_T, 0, 1)), ...CAST_RELEASE };
  return null;
}

function computePose(t) {
  const cast = castBlend();
  const ck = cast ? cast.k : 0;
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
  const hipY = ch.y - LEG * 0.93 + crouch * 6.5 + bob + (cast ? cast.lunge * ck * 2 : 0);

  const legs = [];
  for (let i = 0; i < 2; i++) {
    const ph = ch.phase + i * Math.PI;
    let stand = i === 0 ? 2 : -1.7;
    if (cast) stand = lerp(stand, i === 0 ? 5 : -4.5, cast.lunge * ck); // plant the feet
    const off = -Math.cos(ph) * (ch.stride / 2) * a + stand * (1 - a);
    const lift = Math.max(0, Math.sin(ph)) * cfg.step * (1 + run * 0.6) * a;
    let fx = hipX + f * off;
    let fy = ch.y - lift;
    // Tuck the legs while airborne.
    fx = lerp(fx, hipX + f * (i === 0 ? 3.5 : -2), air);
    fy = lerp(fy, hipY + LEG * (i === 0 ? 0.62 : 0.78), air);
    legs.push(ik(hipX, hipY, fx, fy, BODY.thigh, BODY.shin, f));
  }

  let lean = 0.06 + a * 0.1 + run * 0.22 - air * 0.05 + crouch * 0.25;
  if (cast) lean = lerp(lean, cast.lean, ck);
  const hk = clamp(ch.hurt / 0.3, 0, 1); // recoil when a ghoul hits him
  lean = lerp(lean, -0.35, hk);
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
    if (cast) { ua = lerp(ua, cast.ua[i], ck); fa = lerp(fa, cast.fa[i], ck); }
    if (hk > 0) { ua = lerp(ua, i === 0 ? -0.5 : -0.8, hk); fa = lerp(fa, i === 0 ? 0.3 : -0.4, hk); }
    const ex = shX + f * Math.sin(ua) * BODY.upperArm;
    const ey = shY + Math.cos(ua) * BODY.upperArm;
    arms.push({ sx: shX, sy: shY, ex, ey, hx: ex + f * Math.sin(fa) * BODY.foreArm, hy: ey + Math.cos(fa) * BODY.foreArm });
  }

  // Where the orb sits: just past the front fist.
  const fa0 = arms[0];
  const fd = Math.hypot(fa0.hx - fa0.ex, fa0.hy - fa0.ey) || 1;
  const hand = [fa0.hx + ((fa0.hx - fa0.ex) / fd) * 2.4, fa0.hy + ((fa0.hy - fa0.ey) / fd) * 2.4];

  pose = { f, hipX, hipY, neckX, neckY, headX, headY, legs, arms, up, fw, run, a, breathe, hand };
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
const partMat = new Uint8Array(256);
const partBack = new Uint8Array(256);
// Who owns each part / pixel: 1 = hero, 2 = training dummy, 3+ = a ghoul.
const partOwner = new Uint8Array(256);
const owner = new Uint8Array(W * H);
const ownerFlash = new Uint8Array(256);   // 1 = draw this owner white (hit flash)
const ownerChar = new Float32Array(256);  // 0..1 how charred this owner is
let drawOwner = 1;
let partCount = 0;
let bbox = { minY: 0, maxY: 0 };

function part(material, back = false) {
  partCount++;
  partMat[partCount] = MAT_INDEX[material];
  partBack[partCount] = back ? 1 : 0;
  partOwner[partCount] = drawOwner;
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

// Straw training dummy on a post; it tilts around its base like a spring.
function drawDummy() {
  drawOwner = 2;
  const a = dummy.ang;
  const P = (dx, dy) => [dummy.x + dx * Math.cos(a) - dy * Math.sin(a), GROUND - 0.5 + dx * Math.sin(a) + dy * Math.cos(a)];
  seg(P(0, 0), P(0, -34), 1.5, 1.2, part('wood'));                 // post
  seg(P(-9, -24), P(9, -24), 1.0, 1.0, part('wood'));               // crossbar
  disk(...P(-9.6, -24), 1.4, part('straw'));                        // straw hands
  disk(...P(9.6, -24), 1.4, part('straw'));
  poly([P(-5, -12), P(5, -12), P(6.2, -27.5), P(-6.2, -27.5)], part('straw')); // sack
  seg(P(-5.6, -17.5), P(5.6, -17.5), 0.6, 0.6, part('rope'));      // rope belt
  seg(P(-4.5, -12.2), P(4.5, -12.2), 0.5, 0.5, part('rope'));      // hem
  disk(...P(0, -32.2), 4.3, part('straw'));                        // head
  seg(P(0, -36), P(1.8, -39), 0.8, 0.4, part('straw'));            // tuft
  seg(P(-3.8, -29.5), P(3.8, -29.5), 0.5, 0.5, part('rope'));      // neck tie
  const eye = part('pupil');
  plot(...P(-1.6, -33), eye);
  plot(...P(1.6, -33), eye);
  const mouth = part('rope');
  for (let k = -1; k <= 1; k++) plot(...P(k, -30.8), mouth);
  drawOwner = 1;
}

function rasterize() {
  pbuf.fill(0);
  mask.fill(0);
  owner.fill(0);
  partCount = 0;
  ownerFlash.fill(0);
  ownerChar.fill(0);
  if (cfg.enemies === 'off') drawDummy();
  // Ghouls are drawn behind the hero; each gets its own owner id.
  enemies.forEach((e, k) => {
    e.rid = 3 + k;
    ownerFlash[e.rid] = e.flash > 0 ? 1 : 0;
    ownerChar[e.rid] = e.char;
    drawOwner = e.rid;
    drawEnemy(e);
  });
  drawOwner = 1;
  ownerFlash[1] = ch.flash > 0 ? 1 : 0;
  if (dissolve.state !== 'gap') drawCharacter();
  shade();
  applyDissolve();
  applyBurnAway();
}

function drawCharacter() {
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
        const o = partOwner[p];
        mask[i] = 1;
        owner[i] = o;
        let c = MAT32[m][s];
        const burnt = ownerChar[o];
        if (burnt > 0) {
          // Charring: darken toward soot, with embers flickering in the cracks.
          c = mix(c, 34, 16, 10, burnt * 0.75);
          if (Math.random() < burnt * 0.06) c = PAL32[cfg.palette][18 + ((Math.random() * 12) | 0)];
        }
        if (ownerFlash[o]) c = GLOW32;
        col[i] = c;
        if (o === 1) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      } else {
        const n = pbuf[i - 1] || pbuf[i + 1] || pbuf[i - W] || pbuf[i + W];
        if (n) {
          mask[i] = 2;
          owner[i] = partOwner[n];
          col[i] = OUTLINE32;
        }
      }
    }
  }
  bbox = { minY: minY - 1, maxY: maxY + 1 };
}

// Dissolve / materialize: a horizontal cut sweeps the sprite; the cut line burns.
function applyDissolve() {
  if (dissolve.state !== 'out' && dissolve.state !== 'in') return;
  if (bbox.maxY < bbox.minY) return;
  const out = dissolve.state === 'out';
  const span = bbox.maxY - bbox.minY + 2;
  const k = easeInOut(clamp(dissolve.t / (out ? DIS_OUT : DIS_IN), 0, 1));
  const cut = out ? bbox.minY - 1 + span * k : bbox.maxY + 1 - span * k;
  for (let y = Math.max(0, bbox.minY); y <= Math.min(H - 1, bbox.maxY); y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i] || owner[i] !== 1) continue;
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

function fireDisk(cx, cy, r, heat) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if (y < 0 || y >= H) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= W) continue;
      const dx = x - cx;
      const dy = y - cy;
      const i = y * W + x;
      if (dx * dx + dy * dy <= r * r && fire[i] < heat) fire[i] = heat;
    }
  }
}

function fireRing(cx, cy, r, w, heat) {
  const R2 = r + w;
  for (let y = Math.floor(cy - R2); y <= Math.ceil(cy + R2); y++) {
    if (y < 0 || y >= H) continue;
    for (let x = Math.floor(cx - R2); x <= Math.ceil(cx + R2); x++) {
      if (x < 0 || x >= W) continue;
      const d = Math.hypot(x - cx, y - cy);
      const i = y * W + x;
      if (d >= r - w && d <= r + w && fire[i] < heat) fire[i] = heat;
    }
  }
}

function seedSpell() {
  // Orb in the hand (until it leaves).
  if (spell.state === 'charge' || (spell.state === 'release' && !spell.launched)) {
    fireDisk(pose.hand[0], pose.hand[1], orbRadius() * 1.1, Math.round(22 + spell.power * 14));
  }
  // Bolts burn a continuous line from where they were last seeded.
  for (const b of bolts) {
    const n = Math.ceil(Math.abs(b.x - b.sx)) + 1;
    for (let k = 0; k <= n; k++) fireDisk(lerp(b.sx, b.x, k / n), lerp(b.sy, b.y, k / n), b.r * 0.9, MAX_HEAT);
    b.sx = b.x; b.sy = b.y;
  }
  for (const e of embers) {
    const x = Math.round(e.x);
    const y = Math.round(e.y);
    if (x >= 0 && x < W && y >= 0 && y < H) {
      const i = y * W + x;
      const heat = Math.round(e.heat * Math.min(1, e.life * 2.5));
      if (fire[i] < heat) fire[i] = heat;
    }
  }
  for (const bl of blasts) {
    const k = easeInOut(clamp(bl.t / 0.35, 0, 1));
    const r = lerp(2, bl.R, k);
    if (bl.t < 0.12) fireDisk(bl.x, bl.y, r, MAX_HEAT);
    else fireRing(bl.x, bl.y, r, 1.2, Math.round(MAX_HEAT * (1 - k * 0.4)));
  }
  // A burning dummy is its own heat source for a while.
  if (cfg.enemies === 'off' && dummy.burn > 0) {
    const heat = Math.round(18 + 18 * Math.min(1, dummy.burn / 1.5));
    for (let i = 0; i < mask.length; i++) if (mask[i] && owner[i] === 2 && fire[i] < heat && Math.random() < 0.6) fire[i] = heat;
  }
}

function seedFire() {
  const speed = Math.abs(ch.vx);
  fireBias = speed > 10 && spell.state === 'idle' ? -ch.facing : 0;
  seedSpell();
  seedEnemies();
  if (dissolve.state !== 'none') { landingBurst = 0; return; } // the dissolve seeds its own cut line

  let heat = 0;
  if (cfg.effect === 'aura') heat = MAX_HEAT;
  else if (cfg.effect === 'trail') {
    const k = Math.max(clamp(speed / (cfg.walk * 2.1), 0, 1), ch.onGround ? 0 : 0.7);
    heat = k > 0.25 ? Math.round(14 + 22 * k) : 0;
  }
  if (heat) {
    for (let i = 0; i < mask.length; i++) if (mask[i] && owner[i] === 1 && fire[i] < heat) fire[i] = heat;
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
// Ghouls: hunched, limping, long-armed. Same IK as the hero, own proportions.
// ---------------------------------------------------------------------------
const GHOUL = { thigh: 8, shin: 8, torso: 11, headR: 4, upperArm: 6.5, foreArm: 6.5 };
const ENEMY_MODES = { off: { max: 0, every: 0 }, few: { max: 3, every: 4.2 }, many: { max: 5, every: 2.2 } };
const enemies = [];
const scorches = [];
const stats = { kills: 0, hitsTaken: 0 };
let spawnTimer = 1.0;
let hitstop = 0;

function spawnEnemy() {
  const side = Math.random() < 0.5 ? -1 : 1;
  enemies.push({
    x: side < 0 ? -10 : W + 10, y: FEET_Y, vx: 0, vy: 0, onGround: true,
    facing: -side, scale: 0.9 + Math.random() * 0.25, speed: 13 + Math.random() * 8,
    phase: Math.random() * 6, wobble: Math.random() * 10,
    hp: 100, state: 'walk', t: 0, atkCd: 0.6, entered: false,
    hurt: 0, flash: 0, burn: 0, char: 0, kneel: 0, cut: null,
    panicDir: -side, panicT: 0,
    lean: 0.45, ua: [1.1, 1.1], fa: [1.5, 1.5], pose: null, rid: 0, gone: false,
  });
}

function ignite(e, seconds) {
  if (e.state !== 'dying') e.burn = Math.max(e.burn, seconds);
}

// The ghoul "feels" the hit: freeze-frame, white flash, recoil, knockback, fire.
function hitEnemy(e, damage, dir, power, burnSeconds) {
  if (e.state === 'dying') return;
  e.hp -= damage;
  e.hurt = 0.35 + power * 0.2;
  e.flash = 0.09;
  e.vx = dir * (70 + power * 90);
  if (power > 0.45 && e.onGround) { e.vy = -55 - power * 45; e.onGround = false; }
  if (e.state === 'windup' || e.state === 'strike') { e.state = 'walk'; e.atkCd = 0.7; }
  ignite(e, burnSeconds);
  hitstop = Math.max(hitstop, 0.05 + power * 0.05);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.state === 'dying') return;
  e.state = 'dying';
  e.t = 0;
  stats.kills++;
}

function playerHit(dir) {
  if (dissolve.state !== 'none' || ch.hurt > 0) return;
  ch.hurt = 0.35;
  ch.flash = 0.1;
  ch.vx = dir * 95;
  ch.vy = -70;
  ch.onGround = false;
  if (spell.state === 'charge') spell.state = 'idle';
  stats.hitsTaken++;
  shake = Math.max(shake, 2);
  hitstop = Math.max(hitstop, 0.06);
}

function emberBurst(x, y, n, power) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * Math.random();
    const sp = (40 + Math.random() * 90) * (0.6 + power);
    embers.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.4 + Math.random() * 0.8, heat: 28 + ((Math.random() * 8) | 0), g: 1 });
  }
}

function updateEnemies(dt) {
  const mode = ENEMY_MODES[cfg.enemies];
  if (mode.max > 0) {
    spawnTimer -= dt;
    const alive = enemies.filter((e) => e.state !== 'dying').length;
    if (spawnTimer <= 0 && alive < mode.max) {
      spawnEnemy();
      spawnTimer = mode.every * (0.7 + Math.random() * 0.6);
    }
  }
  for (const e of enemies) updateEnemy(e, dt);
  // Fire spreads to ghouls that bump into a burning one.
  for (const a of enemies) {
    if (a.burn <= 0 || a.state === 'dying') continue;
    for (const b of enemies) if (b !== a && b.burn <= 0 && Math.abs(a.x - b.x) < 8) ignite(b, 1.6);
  }
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].gone) enemies.splice(i, 1);
  for (const a of scorches) a.t += dt;
  for (let i = scorches.length - 1; i >= 0; i--) if (scorches[i].t > 9) scorches.splice(i, 1);
}

function updateEnemy(e, dt) {
  e.t += dt;
  e.flash = Math.max(0, e.flash - dt);
  e.hurt = Math.max(0, e.hurt - dt);
  e.atkCd -= dt;
  const toP = ch.x - e.x;
  const dist = Math.abs(toP);
  const heroThere = dissolve.state === 'none' || dissolve.state === 'out';
  let target = 0;

  if (e.state === 'dying') {
    // Drop to the knees, then burn away from the head down.
    e.kneel = Math.min(1, e.kneel + dt * 2.5);
    e.burn = Math.max(e.burn, 0.5);
    e.char = Math.min(1, e.char + dt * 0.8);
    if (e.t > 0.55) {
      e.cut = clamp((e.t - 0.55) / 1.0, 0, 1);
      if (e.cut >= 1) {
        e.gone = true;
        scorches.push({ x: e.x, t: 0 });
        emberBurst(e.x, e.y - 4, 10, 0.3);
      }
    }
  } else {
    if (e.burn > 0) {
      // Burning: lose health, char, and run around in a panic.
      e.burn -= dt;
      e.hp -= 15 * dt;
      e.char = Math.min(1, e.char + dt * 0.22);
      e.panicT -= dt;
      if (e.panicT <= 0) {
        const away = -Math.sign(toP || 1);
        e.panicDir = Math.random() < 0.65 ? away : -away;
        e.panicT = 0.35 + Math.random() * 0.7;
      }
      if (e.x < 12) e.panicDir = 1;
      if (e.x > W - 12) e.panicDir = -1;
      target = e.panicDir * e.speed * 2.1;
      if (e.state !== 'walk') { e.state = 'walk'; e.t = 0; }
      if (Math.random() < dt * 5) emberBurst(e.x + (Math.random() - 0.5) * 8, e.y - 10 - Math.random() * 25, 1, 0);
    } else if (e.state === 'walk') {
      e.facing = Math.sign(toP) || e.facing;
      if (heroThere && dist < 11 * e.scale && e.atkCd <= 0 && e.hurt <= 0) { e.state = 'windup'; e.t = 0; }
      else if (dist > 8) target = Math.sign(toP) * e.speed * (0.7 + 0.3 * Math.sin(e.phase * 0.5 + e.wobble)); // limp
    } else if (e.state === 'windup') {
      e.facing = Math.sign(toP) || e.facing;
      if (e.t > 0.4) {
        e.state = 'strike'; e.t = 0;
        if (heroThere && dist < 15 * e.scale && ch.y > FEET_Y - 16) playerHit(e.facing);
      }
    } else if (e.state === 'strike' && e.t > 0.25) {
      e.state = 'walk'; e.t = 0; e.atkCd = 0.9 + Math.random() * 0.6;
    }
    if (e.burn > 0 && target) e.facing = Math.sign(target);
    if (e.hp <= 0) killEnemy(e);
    // Aura: touching the burning hero sets a ghoul on fire.
    if (cfg.effect === 'aura' && dissolve.state === 'none' && dist < 10) ignite(e, 1.5);
  }

  if (e.hurt > 0 || e.state === 'dying') target = 0;
  e.vx = approach(e.vx, target, (e.hurt > 0 ? 110 : 170) * dt);
  e.vy += GRAVITY * dt;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (e.y >= FEET_Y) { e.y = FEET_Y; e.vy = 0; e.onGround = true; }
  if (e.x > 10 && e.x < W - 10) e.entered = true;
  if (e.entered) e.x = clamp(e.x, 8, W - 8);
  const speed = Math.abs(e.vx);
  e.phase += ((Math.PI * speed) / ((4 + speed * 0.08) * e.scale)) * dt;
  computeEnemyPose(e, dt);
}

function computeEnemyPose(e, dt) {
  const s = e.scale;
  const f = e.facing;
  const th = GHOUL.thigh * s;
  const sh = GHOUL.shin * s;
  const T = GHOUL.torso * s;
  const speed = Math.abs(e.vx);
  const a = Math.min(1, speed / 18);
  const panic = e.burn > 0 && e.state !== 'dying';
  const hurtK = clamp(e.hurt / 0.3, 0, 1);
  const stride = (4 + speed * 0.08) * s;
  const hipX = e.x;
  const hipY = e.y - (th + sh) * 0.9 + e.kneel * th * 0.85 - Math.cos(2 * e.phase) * 0.8 * a;

  const legs = [];
  for (let i = 0; i < 2; i++) {
    const ph = e.phase + i * Math.PI;
    const stand = (i === 0 ? 2 : -1.8) * s;
    let fx = hipX + f * (-Math.cos(ph) * (stride / 2) * a + stand * (1 - a));
    let fy = e.y - Math.max(0, Math.sin(ph)) * 3 * s * a;
    if (e.kneel > 0) fx = lerp(fx, hipX + f * (i === 0 ? 5 : -6) * s, e.kneel);
    if (!e.onGround) fy = hipY + (th + sh) * 0.8;
    legs.push(ik(hipX, hipY, fx, fy, th, sh, f));
  }

  // Target lean/arm angles by state, then smoothed so transitions read as motion.
  let leanT = 0.42 + a * 0.08 + Math.sin(e.t * 1.7 + e.wobble) * 0.04;
  let uaT = [1.15 + Math.sin(e.phase) * 0.3, 1.0 - Math.sin(e.phase) * 0.3];  // reaching forward
  let faT = [1.55, 1.45];
  if (e.state === 'windup') { leanT = lerp(leanT, 0.15, clamp(e.t / 0.25, 0, 1)); uaT = [2.7, 2.4]; faT = [3.1, 2.9]; }
  if (e.state === 'strike') { leanT = 0.75; uaT = [0.9, 1.2]; faT = [0.4, 0.8]; }
  if (panic) {
    // Arms flailing over the head.
    leanT = 0.05 + Math.sin(e.t * 9) * 0.12;
    uaT = [2.7 + Math.sin(e.t * 15) * 0.45, 2.5 + Math.sin(e.t * 13 + 2) * 0.45];
    faT = [3.0 + Math.sin(e.t * 17) * 0.6, 2.9 + Math.sin(e.t * 16 + 1) * 0.6];
  }
  if (hurtK > 0) {
    // Thrown back by the hit.
    leanT = lerp(leanT, -0.55, hurtK);
    uaT = uaT.map((v, i) => lerp(v, i ? -0.9 : -0.4, hurtK));
    faT = faT.map((v, i) => lerp(v, i ? -1.4 : -1.0, hurtK));
  }
  if (e.state === 'dying') { leanT = 0.9; uaT = [0.3, 0.2]; faT = [0.2, 0.1]; }
  const sm = Math.min(1, dt * (hurtK > 0 ? 30 : 12));
  e.lean = lerp(e.lean, leanT, sm);
  e.ua = e.ua.map((v, i) => lerp(v, uaT[i], sm));
  e.fa = e.fa.map((v, i) => lerp(v, faT[i], sm));

  const lean = e.lean;
  const up = [f * Math.sin(lean), -Math.cos(lean)];
  const fw = [f * Math.cos(lean), Math.sin(lean)];
  const neck = [hipX + up[0] * T, hipY + up[1] * T];
  // The head juts forward of the neck and snaps back when hit.
  const hl = lean * 0.3 - hurtK * 0.6;
  const head = [neck[0] + f * (Math.sin(hl) * GHOUL.headR * s + 1.6 * s * (1 - hurtK)), neck[1] - Math.cos(hl) * GHOUL.headR * s * 0.85];
  const shoulder = lerpPt([hipX, hipY], neck, 0.85);
  const arms = [0, 1].map((i) => {
    const el = [shoulder[0] + f * Math.sin(e.ua[i]) * GHOUL.upperArm * s, shoulder[1] + Math.cos(e.ua[i]) * GHOUL.upperArm * s];
    const hd = [el[0] + f * Math.sin(e.fa[i]) * GHOUL.foreArm * s, el[1] + Math.cos(e.fa[i]) * GHOUL.foreArm * s];
    return { sh: shoulder, el, hd };
  });
  e.pose = { f, s, T, hipX, hipY, neck, head, legs, arms, up, fw };
}

function drawGhoulArm(arm, back, s) {
  seg(arm.sh, lerpPt(arm.sh, arm.el, 0.55), 1.9 * s, 1.6 * s, part('rags', back)); // torn sleeve
  const skin = part('ghoul', back);
  seg(lerpPt(arm.sh, arm.el, 0.5), arm.el, 1.4 * s, 1.2 * s, skin);
  seg(arm.el, arm.hd, 1.2 * s, 1.0 * s, skin);
  const dx = arm.hd[0] - arm.el[0];
  const dy = arm.hd[1] - arm.el[1];
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const claw = part('bone', back);
  seg(arm.hd, [arm.hd[0] + ux * 2.4 - uy * 0.9, arm.hd[1] + uy * 2.4 + ux * 0.9], 0.5, 0.3, claw);
  seg(arm.hd, [arm.hd[0] + ux * 2.6 + uy * 0.7, arm.hd[1] + uy * 2.6 - ux * 0.7], 0.5, 0.3, claw);
}

function drawGhoulLeg(P, leg, back) {
  const hip = [P.hipX, P.hipY];
  const knee = [leg.jx, leg.jy];
  const ankle = [leg.ex, leg.ey];
  seg(hip, knee, 2.2 * P.s, 1.8 * P.s, part('rags', back));
  const skin = part('ghoul', back);
  seg(knee, ankle, 1.5 * P.s, 1.2 * P.s, skin);
  seg([ankle[0] - P.f * 0.8, ankle[1] + 0.8], [ankle[0] + P.f * 3 * P.s, ankle[1] + 1.1], 1.2, 0.9, skin);
}

function drawEnemy(e) {
  const P = e.pose;
  if (!P) return;
  const { f, s } = P;
  const L = (a, b) => [P.hipX + P.fw[0] * a + P.up[0] * b, P.hipY + P.fw[1] * a + P.up[1] * b];
  drawGhoulArm(P.arms[1], true, s);
  drawGhoulLeg(P, P.legs[1], true);
  drawGhoulLeg(P, P.legs[0], false);
  // Hunched torso with a hump on the back.
  const torso = part('rags');
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    const c = L(-1.4 * s * Math.sin(Math.PI * t), P.T * t);
    disk(c[0], c[1], lerp(2.6, 3.3, Math.sin(Math.PI * t)) * s, torso);
  }
  // Torn hem and a rope belt.
  poly([L(-3.2 * s, 1.5 * s), L(3.0 * s, 1.5 * s), L(3.2 * s, -3 * s), L(1.5 * s, -1.6 * s), L(0, -3.6 * s), L(-1.6 * s, -1.8 * s), L(-3.0 * s, -3.4 * s)], part('rags'));
  seg(L(-3 * s, 1.2 * s), L(3 * s, 1.2 * s), 0.55, 0.55, part('rope'));
  // Head, a strand of hair, a jaw that drops open when attacking, hurt or burning.
  const [hx, hy] = P.head;
  disk(hx, hy, GHOUL.headR * s, part('ghoul'));
  seg([hx - f * 2.6 * s, hy - 2.8 * s], [hx - f * 5.2 * s, hy - 0.6 * s], 0.7, 0.4, part('rags'));
  const open = e.state === 'windup' || e.state === 'strike' || e.burn > 0 || e.hurt > 0 || e.state === 'dying';
  seg([hx + f * 0.5 * s, hy + 2.6 * s], [hx + f * 3.4 * s, hy + (open ? 4.2 : 2.8) * s], 1.1 * s, 0.9 * s, part('ghoul'));
  if (open) {
    const m = part('mouth');
    plot(hx + f * 2.4 * s, hy + 2.4 * s, m);
    plot(hx + f * 3.2 * s, hy + 2.6 * s, m);
  }
  const eye = part('eyeglow');
  plot(hx + f * 2.0 * s, hy - 0.6 * s, eye);
  plot(hx + f * 2.0 * s + f, hy - 0.6 * s, eye);
  drawGhoulArm(P.arms[0], false, s);
}

// Dying ghouls burn away from the head down; the cut line is a heat source.
function applyBurnAway() {
  for (const e of enemies) {
    if (e.cut === null) continue;
    const top = Math.floor(e.y - 44 * e.scale);
    const bottom = Math.ceil(e.y + 3);
    const cut = lerp(top, bottom, easeInOut(e.cut));
    const x0 = Math.max(0, Math.floor(e.x - 16));
    const x1 = Math.min(W - 1, Math.ceil(e.x + 16));
    for (let y = Math.max(0, top); y <= Math.min(H - 1, bottom); y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (!mask[i] || owner[i] !== e.rid) continue;
        if (y < cut) { mask[i] = 0; owner[i] = 0; }
        else if (y < cut + 1.2) { col[i] = GLOW32; fire[i] = MAX_HEAT; }
      }
    }
  }
}

// Burning ghouls are heat sources: their own pixels feed the fire.
function seedEnemies() {
  for (const e of enemies) {
    if (e.burn <= 0 && e.state !== 'dying') continue;
    const heat = e.state === 'dying' ? MAX_HEAT : Math.round(22 + 14 * Math.min(1, e.burn / 2));
    const top = Math.max(0, Math.floor(e.y - 46 * e.scale));
    const bottom = Math.min(H - 1, Math.ceil(e.y + 3));
    const x0 = Math.max(0, Math.floor(e.x - 16));
    const x1 = Math.min(W - 1, Math.ceil(e.x + 16));
    for (let y = top; y <= bottom; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (mask[i] && owner[i] === e.rid && fire[i] < heat && Math.random() < 0.7) fire[i] = heat;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// FX layer: opaque palette-colored cores (orb, bolts, embers, blast flash)
// drawn in front of the character. The fire around them is the glow.
// ---------------------------------------------------------------------------
const fx = new Uint8Array(W * H);

function fxDisk(cx, cy, r, edge) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if (y < 0 || y >= H) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= W) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      const v = Math.round(lerp(MAX_HEAT, edge, d / Math.max(r, 0.01))) - ((Math.random() * 3) | 0);
      const i = y * W + x;
      if (fx[i] < v) fx[i] = v;
    }
  }
}

function buildFx() {
  fx.fill(0);
  if (spell.state === 'charge' || (spell.state === 'release' && !spell.launched)) {
    const r = orbRadius() + Math.sin(simTime * 40) * 0.25;
    fxDisk(pose.hand[0], pose.hand[1], r, 20);
  }
  for (const b of bolts) {
    const dir = Math.sign(b.vx);
    fxDisk(b.x - dir * b.r * 0.9, b.y, b.r * 0.75, 18);
    fxDisk(b.x, b.y, b.r, 22);
  }
  for (const e of embers) {
    const x = Math.round(e.x);
    const y = Math.round(e.y);
    if (x >= 0 && x < W && y >= 0 && y < H) fx[y * W + x] = Math.max(fx[y * W + x], Math.round(e.heat * Math.min(1, e.life * 3)));
  }
  for (const bl of blasts) {
    if (bl.t < 0.09) fxDisk(bl.x, bl.y, bl.R * 0.55 * (1 - bl.t / 0.09) + 2, 24);
  }
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

// Contact shadows and the ash left by burnt ghouls.
const ASH = hexRgb('#6a6168');
function groundFx(bg, x, y, shadows) {
  if (y >= GROUND) {
    for (const s of shadows) {
      if (s.k <= 0) continue;
      const u = (x - s.x) / s.rx;
      const v = (y - GROUND - 0.3) / 2.2;
      if (u * u + v * v <= 1) bg = mix(bg, 0, 0, 0, s.k);
    }
  }
  for (const a of scorches) {
    const fade = 1 - a.t / 9;
    const dx = x - a.x;
    if (y >= GROUND) {
      const u = dx / 12;
      const v = (y - GROUND - 0.5) / 2.5;
      if (u * u + v * v <= 1) bg = mix(bg, 8, 6, 8, 0.6 * fade);
    } else if (Math.abs(dx) <= 4 - Math.abs(Math.round(dx * 0.4))) {
      bg = mix(bg, ASH[0], ASH[1], ASH[2], 0.85 * fade); // little ash mound
    }
  }
  return bg;
}

function compose() {
  const pal = PALETTES[cfg.palette];
  // Ground shadow: shrinks as the character rises.
  const visible = dissolve.state === 'none' || dissolve.state === 'in' ? 1 : dissolve.state === 'out' ? 1 - dissolve.t / DIS_OUT : 0;
  const rise = clamp((FEET_Y - ch.y) / 40, 0, 1);
  const rx = 11 * (1 - rise * 0.6);
  const shadowK = 0.55 * visible * (1 - rise * 0.5);
  const shadows = [{ x: ch.x, rx, k: shadowK }];
  for (const e of enemies) if (e.cut === null || e.cut < 0.85) shadows.push({ x: e.x, rx: 9 * e.scale, k: 0.5 });

  const fxPal = PAL32[cfg.palette];
  const isOutline = (j) => mask[j] === 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (fx[i]) { frame32[i] = fxPal[fx[i]]; continue; }
      const m = mask[i];
      if (m) {
        let c = col[i];
        // Rim light: body pixels next to burning outline pick up the fire color.
        if (m === 1) {
          let h = 0;
          if (isOutline(i - 1) && fire[i - 1] > h) h = fire[i - 1];
          if (isOutline(i + 1) && fire[i + 1] > h) h = fire[i + 1];
          if (isOutline(i - W) && fire[i - W] > h) h = fire[i - W];
          if (isOutline(i + W) && fire[i + W] > h) h = fire[i + W];
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
      if (y >= GROUND - 1 && y <= GROUND + 2) bg = groundFx(bg, x, y, shadows);
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
  const sh = shake * s * 0.7;
  view = { s, ox: ox + Math.round((Math.random() - 0.5) * sh), oy: Math.round((chh - dh) / 2 + (Math.random() - 0.5) * sh) };
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
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyQ']);

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
    cast: keys.has('KeyF') || keys.has('KeyQ') || keys.has('Cast'),
  };
  jumpPressed = false;
  return input;
}

const ai = { target: null, wait: 0.4, run: false, crouch: false, jumpCd: 2.5, disCd: 12, spellCd: 0, casting: 0 };

function autopilotInput(dt) {
  ai.jumpCd -= dt;
  ai.disCd -= dt;
  ai.spellCd -= dt;
  const idle = { dir: 0, run: false, crouch: ai.crouch, jump: false, cast: false };
  if (ai.casting > 0) { ai.casting -= dt; return { ...idle, crouch: false, cast: true }; }
  if (dissolve.state !== 'none' || spell.state !== 'idle' || ch.hurt > 0) return idle;

  // Combat: keep distance from the nearest ghoul and throw spells at it.
  let foe = null;
  for (const e of enemies) {
    if (e.state === 'dying' || e.x < 4 || e.x > W - 4) continue;
    if (!foe || Math.abs(e.x - ch.x) < Math.abs(foe.x - ch.x)) foe = e;
  }
  if (foe) {
    const d = foe.x - ch.x;
    const dist = Math.abs(d);
    const cornered = (d > 0 && ch.x < 24) || (d < 0 && ch.x > W - 24);
    if (dist < 22) {
      if (ai.disCd < 0 && (cornered || Math.random() < dt * 3)) { startDissolve(); ai.disCd = 5 + Math.random() * 3; return idle; }
      if (!cornered) return { dir: -Math.sign(d), run: true, crouch: false, jump: false, cast: false };
    }
    if (ai.spellCd < 0) {
      ch.facing = Math.sign(d) || ch.facing;
      ai.casting = clamp(dist / 150, 0.15, 0.95) + Math.random() * 0.15; // farther = more charge
      ai.spellCd = 0.4 + Math.random() * 0.5;
      return { ...idle, crouch: false, cast: true };
    }
    if (dist < 45 && !cornered) return { dir: -Math.sign(d), run: false, crouch: false, jump: false, cast: false };
    ch.facing = Math.sign(d) || ch.facing;
    return { ...idle, crouch: false };
  }

  if (ai.wait > 0) {
    ai.wait -= dt;
    // Turn to the dummy and throw a spell, holding it a random time to vary the power.
    if (cfg.enemies === 'off' && ai.spellCd < 0 && Math.abs(dummy.x - ch.x) > 28) {
      ch.facing = Math.sign(dummy.x - ch.x);
      ai.casting = 0.25 + Math.random() * 0.9;
      ai.spellCd = 2.5 + Math.random() * 3;
      ai.crouch = false;
      return { ...idle, cast: true };
    }
    return idle;
  }
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
  return { dir: Math.sign(d), run: ai.run, crouch: false, jump, cast: false };
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
  enemies: document.getElementById('enemies'),
  hud: document.getElementById('hud'),
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
ui.enemies.addEventListener('change', () => {
  cfg.enemies = ui.enemies.value;
  if (cfg.enemies === 'off') enemies.length = 0;
  spawnTimer = 0.8;
});

let hudText = '';
function updateHud() {
  const t = cfg.enemies === 'off'
    ? `Boneco atingido: ${dummy.hits}`
    : `Queimados: ${stats.kills} · Golpes recebidos: ${stats.hitsTaken}`;
  if (t !== hudText) { hudText = t; ui.hud.textContent = t; }
}

// ---------------------------------------------------------------------------
// Loop: fixed 60 Hz physics, fire at 30 Hz (the chunky DOOM cadence)
// ---------------------------------------------------------------------------
let simTime = 0;
let tickCount = 0;

function tick() {
  // Hit-stop: freeze the world for a few frames so a hit lands with weight.
  if (hitstop > 0) { hitstop -= DT; return; }
  const input = cfg.auto ? autopilotInput(DT) : keyboardInput();
  updateCharacter(DT, input);
  updateSpell(DT, input.cast);
  updateDissolve(DT);
  computePose(simTime);
  updateSecondary(simTime, DT);
  updateProjectiles(DT);
  updateEnemies(DT);
  rasterize();
  buildFx();
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
  updateHud();
}

new ResizeObserver(() => { fitCanvas(); if (pose) draw(); }).observe(canvas);
fitCanvas();
syncLabels();
// Warm up so the first frame already shows flames.
for (let i = 0; i < 90; i++) tick();
requestAnimationFrame((t) => { last = t; frame(t); });
