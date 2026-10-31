// Fire Walker — sword attack.
//
// A three-hit combo (any press during a swing queues the next hit) plus a downward slash in the air.
// Each swing is two arm poses — wind-up and follow-through — blended into the
// procedural pose (same convention as the cast poses: angles from straight down,
// positive toward where the hero faces). During the active part of the swing the
// blade is swept against enemies; its tip leaves an arc of DOOM fire.
// Every character has its own blade: the Andarilho draws the sword from his back,
// the Bruxa a quick glowing dagger, the Paladino a slow, long, heavy sword.

'use strict';

const WEAPONS = {
  andarilho: { len: 11, speed: 1, dmg: 1, blade: 'blade', guard: 'metal', width: 1.1 },
  bruxa: { len: 8, speed: 0.8, dmg: 0.75, blade: 'glass', guard: 'gold', width: 0.9 },
  paladino: { len: 14, speed: 1.25, dmg: 1.35, blade: 'blade', guard: 'gold', width: 1.3 },
};
const weapon = () => WEAPONS[cfg.hero];

// [front arm (sword), back arm] for the wind-up and the follow-through.
const SWINGS = [
  // 1: diagonal cut from overhead down to the front.
  { wind: { ua: [2.8, 0.6], fa: [3.3, 0.9], lean: -0.1 }, act: { ua: [0.9, -0.4], fa: [0.7, -0.2], lean: 0.35 }, dmg: 22, power: 0.35, lunge: 30, burn: 0 },
  // 2: rising backhand.
  { wind: { ua: [0.2, 1.0], fa: [-0.4, 1.4], lean: 0.2 }, act: { ua: [2.3, -0.3], fa: [2.7, -0.1], lean: -0.05 }, dmg: 22, power: 0.35, lunge: 30, burn: 0 },
  // 3: heavy horizontal slash with a lunge; staggers and sets the target on fire.
  { wind: { ua: [-1.3, 0.9], fa: [-1.5, 1.2], lean: -0.15 }, act: { ua: [1.6, -0.6], fa: [1.6, -0.4], lean: 0.45 }, dmg: 38, power: 0.8, lunge: 85, burn: 1.6 },
];
// In the air: a plunging slash.
const AIR_SWING = { wind: { ua: [3.0, 2.2], fa: [3.4, 2.6], lean: -0.1 }, act: { ua: [0.6, 1.6], fa: [0.3, 1.9], lean: 0.4 }, dmg: 28, power: 0.5, lunge: 0, burn: 1 };

const SWING_WIND = 0.08;
const SWING_ACT = 0.12;
const SWING_REC = 0.2;

const melee = { state: 'idle', combo: 0, t: 0, buffer: 0, swing: null, hit: new Set(), trail: [], drawn: 0, prevTip: null, active: false, queued: false };

const swordOut = () => melee.state !== 'idle' || melee.drawn > 0;

function canSwing() {
  return !ch.dead && dissolve.state === 'none' && spell.state === 'idle' && ch.hurt <= 0;
}

function startSwing(combo) {
  melee.state = 'swing';
  melee.combo = combo;
  melee.t = 0;
  melee.swing = ch.onGround ? SWINGS[combo] : AIR_SWING;
  melee.hit.clear();
  melee.prevTip = null;
  melee.buffer = 0;
  melee.queued = false;
}

function updateMelee(dt, pressed) {
  if (pressed) melee.buffer = 0.25; // input buffer: a press slightly early still chains
  melee.buffer = Math.max(0, melee.buffer - dt);
  melee.drawn = Math.max(0, melee.drawn - dt);
  melee.active = false;
  for (const p of melee.trail) p.age += dt;
  while (melee.trail.length && melee.trail[0].age > 0.16) melee.trail.shift();

  if (melee.state === 'idle') {
    if (melee.buffer > 0 && canSwing()) startSwing(0);
    return;
  }
  if (!canSwing() && melee.state === 'swing' && (ch.hurt > 0 || ch.dead)) { melee.state = 'idle'; return; }
  const k = weapon().speed;
  const wind = SWING_WIND * k;
  const act = SWING_ACT * k;
  const rec = SWING_REC * k;
  // Any press during a swing queues the next hit of the combo.
  if (pressed) melee.queued = true;
  const before = melee.t;
  melee.t += dt;
  if (before < wind && melee.t >= wind) {
    // The blade starts moving: whoosh and lunge.
    sfx('swing', { x: ch.x, power: weapon().dmg });
    if (melee.swing.lunge && ch.onGround) ch.vx = ch.facing * melee.swing.lunge;
  }
  // The blade is swept against targets after this tick's pose (see tick() in main.js).
  melee.active = melee.t >= wind && melee.t < wind + act + DT;
  if (melee.t >= wind + act + rec) {
    const chain = (melee.queued || melee.buffer > 0) && ch.onGround && melee.swing !== AIR_SWING && melee.combo < SWINGS.length - 1;
    if (chain) startSwing(melee.combo + 1);
    else { melee.state = 'idle'; melee.combo = 0; }
  }
  melee.drawn = 1.2; // keep the sword in hand for a moment after the last swing
}

// Pose blend used by computePose (walker.js): null when not swinging.
function meleeBlend() {
  if (melee.state !== 'swing') return null;
  const k = weapon().speed;
  const wind = SWING_WIND * k;
  const act = SWING_ACT * k;
  const rec = SWING_REC * k;
  const S = melee.swing;
  const t = melee.t;
  if (t < wind) {
    return { k: easeInOut(t / wind), ua: S.wind.ua, fa: S.wind.fa, lean: S.wind.lean };
  }
  if (t < wind + act) {
    const u = 1 - (1 - (t - wind) / act) ** 2; // ease-out: fast through the hit
    return {
      k: 1,
      ua: S.wind.ua.map((v, i) => lerp(v, S.act.ua[i], u)),
      fa: S.wind.fa.map((v, i) => lerp(v, S.act.fa[i], u)),
      lean: lerp(S.wind.lean, S.act.lean, u),
    };
  }
  return { k: 1 - easeInOut(clamp((t - wind - act) / rec, 0, 1)), ua: S.act.ua, fa: S.act.fa, lean: S.act.lean };
}

// Blade from the front wrist along the forearm.
function swordGeom(P) {
  const A = P.arms[0];
  const dx = A.hx - A.ex;
  const dy = A.hy - A.ey;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const len = weapon().len;
  const hand = [A.hx + ux * 1.1, A.hy + uy * 1.1];
  return { hand, ux, uy, tip: [hand[0] + ux * len, hand[1] + uy * len] };
}

// Test the blade (and the arc its tip swept since last tick) against enemies,
// the training dummy and cultist orbs.
function sweepBlade() {
  if (!pose || !pose.sword) return;
  const S = pose.sword;
  const W8 = weapon();
  const pts = [];
  // Forearm and fist count too: an enemy pressed against the hero is inside the blade's reach.
  const A = pose.arms[0];
  for (let k = 0; k < 1; k += 0.34) pts.push([lerp(A.ex, S.hand[0], k), lerp(A.ey, S.hand[1], k)]);
  for (let k = 0; k <= 1.001; k += 0.2) pts.push([lerp(S.hand[0], S.tip[0], k), lerp(S.hand[1], S.tip[1], k)]);
  if (melee.prevTip) for (let k = 0.25; k < 1; k += 0.25) pts.push([lerp(melee.prevTip[0], S.tip[0], k), lerp(melee.prevTip[1], S.tip[1], k)]);
  melee.prevTip = S.tip;
  melee.trail.push({ x: S.tip[0], y: S.tip[1], age: 0 });

  const sw = melee.swing;
  for (const e of enemies) {
    if (e.state === 'dying' || melee.hit.has(e)) continue;
    const at = pts.find(([x, y]) => enemyHit(e, x, y, 2));
    if (!at) continue;
    melee.hit.add(e);
    const finisher = sw.power >= 0.8;
    hitEnemy(e, sw.dmg * W8.dmg, ch.facing, sw.power, sw.burn);
    if (!finisher && !e.def.fly) e.vx *= 0.45; // light hits keep the target in reach for the combo
    hitstop = Math.max(hitstop, finisher ? 0.09 : 0.06);
    shake = Math.max(shake, finisher ? 2.2 : 1.2);
    sparks(at[0], at[1], finisher ? 12 : 6);
    sfx('slash', { x: e.x, power: sw.power });
  }
  if (cfg.enemies === 'off' && !melee.hit.has(dummy) && pts.some(([x, y]) => Math.abs(x - dummy.x) < 6 && y > GROUND - 40 && y < GROUND - 6)) {
    melee.hit.add(dummy);
    dummy.angV += ch.facing * (3 + sw.power * 5);
    dummy.hits++;
    if (sw.burn) dummy.burn = Math.max(dummy.burn, sw.burn);
    sparks(dummy.x, GROUND - 22, 6);
    sfx('slash', { x: dummy.x, power: sw.power });
  }
  // Parry: the blade knocks shadow orbs out of the air.
  for (const s of eshots) {
    if (s.dead) continue;
    if (pts.some(([x, y]) => Math.hypot(x - s.x, y - s.y) < s.r + 3)) {
      s.dead = true;
      sparks(s.x, s.y, 8);
      sfx('parry', { x: s.x });
      hitstop = Math.max(hitstop, 0.05);
    }
  }
}

function sparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 90;
    embers.push({ x, y, vx: Math.cos(a) * sp + ch.facing * 30, vy: Math.sin(a) * sp - 30, life: 0.2 + Math.random() * 0.3, heat: 30 + ((Math.random() * 6) | 0), g: 1 });
  }
}

// The tip's recent path is a heat source: an arc of fire.
function seedMelee() {
  for (const p of melee.trail) fireDisk(p.x, p.y, 1.4, Math.round(32 * (1 - p.age / 0.16)));
}

// And a bright streak along the same arc.
function meleeFx() {
  const T = melee.trail;
  for (let i = 1; i < T.length; i++) {
    const a = T[i - 1];
    const b = T[i];
    const fade = 1 - b.age / 0.16;
    if (fade <= 0) continue;
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)) + 1;
    for (let k = 0; k <= n; k++) fxDisk(lerp(a.x, b.x, k / n), lerp(a.y, b.y, k / n), 0.6 + fade * 0.7, Math.round(14 + fade * 10));
  }
}

// Drawn after the hero, in the front hand.
function drawSword() {
  if (!swordOut() || !pose || !pose.sword) return;
  const S = pose.sword;
  const W8 = weapon();
  const nx = -S.uy;
  const ny = S.ux;
  seg([S.hand[0] - S.ux * 2.2, S.hand[1] - S.uy * 2.2], S.hand, 0.7, 0.7, part('leather'));               // grip
  disk(S.hand[0] - S.ux * 2.6, S.hand[1] - S.uy * 2.6, 0.9, part(W8.guard));                               // pommel
  seg([S.hand[0] + nx * 2.4, S.hand[1] + ny * 2.4], [S.hand[0] - nx * 2.4, S.hand[1] - ny * 2.4], 0.7, 0.7, part(W8.guard)); // guard
  seg([S.hand[0] + S.ux * 0.8, S.hand[1] + S.uy * 0.8], S.tip, W8.width, 0.5, part(W8.blade));             // blade
}
