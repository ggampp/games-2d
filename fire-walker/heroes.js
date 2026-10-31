// Fire Walker — playable characters.
//
// All three share the hero skeleton, IK, cast poses and physics from walker.js.
// Each one changes how it looks (its own parts and secondary motion), its stats
// and its spell:
//   andarilho — hooded wanderer; chargeable fireball.
//   bruxa     — witch with a wide hat and long hair; 1-3 homing will-o'-wisps.
//   paladino  — armored knight with a cape and plume; a wall of flame along the floor.

'use strict';

const HEROES = {
  andarilho: {
    name: 'Andarilho', maxHp: 100, walk: 1, jump: 150, spell: 'fireball', palette: 'fogo',
    // Secondary motion anchors: two chains (scarf tails) and a spring tip (hood).
    secondary: (P, T) => ({
      a: torsoPt(-2.4, T - 0.6), lenA: 2.2,
      b: torsoPt(-2.2, T - 2.0), lenB: 2.1,
      tip: [P.headX - P.f * (BODY.headR + 2.4), P.headY - 0.6 - P.run * 0.8],
    }),
  },
  bruxa: {
    name: 'Bruxa', maxHp: 80, walk: 1.12, jump: 165, spell: 'wisps', palette: 'energia',
    // Two locks of hair and the tip of the hat.
    secondary: (P) => ({
      a: [P.headX - P.f * 2.6, P.headY + 0.5], lenA: 2.6,
      b: [P.headX - P.f * 1.6, P.headY + 2.2], lenB: 2.3,
      tip: [P.headX - P.f * 5.5, P.headY - 10 - P.run * 1.5],
    }),
  },
  paladino: {
    name: 'Paladino', maxHp: 150, walk: 0.85, jump: 138, spell: 'flamewave', palette: 'fogo',
    // Two edges of the cape and the plume.
    secondary: (P, T) => ({
      a: torsoPt(-3.0, T - 0.3), lenA: 3.0,
      b: torsoPt(-2.3, T - 0.9), lenB: 2.8,
      tip: [P.headX - P.f * 3.5, P.headY - 6.5],
    }),
  },
};

const heroDef = () => HEROES[cfg.hero];

function selectHero(name) {
  if (!HEROES[name]) return;
  cfg.hero = name;
  const def = heroDef();
  ch.maxHp = def.maxHp;
  ch.hp = ch.hpGhost = def.maxHp;
  spell.state = 'idle';
  resetSecondary(ch.x);
  // A quick materialize so the swap reads on screen.
  if (dissolve.state === 'none') { dissolve.state = 'in'; dissolve.t = 0; sfx('materialize', { x: ch.x }); }
}

// ---------------------------------------------------------------------------
// Spells
// ---------------------------------------------------------------------------
const heroWaves = [];

function launchHeroSpell() {
  const f = ch.facing;
  const [hx, hy] = pose.hand;
  const p = spell.power;
  const kind = heroDef().spell;
  if (kind === 'wisps') {
    // 1-3 small homing wisps in a fan; more charge = more wisps.
    const n = 1 + Math.round(p * 2);
    for (let k = 0; k < n; k++) {
      const off = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2;
      bolts.push({ x: hx + f * 2, y: hy, y0: hy, vx: f * (185 + p * 40), vy: off * 45, r: 1.3 + p * 1.0, age: k * 0.05, sx: hx, sy: hy, power: p * 0.6, dmgMul: 0.55, small: true, homing: true });
    }
    ch.vx = -f * 12;
    shake = Math.max(shake, 0.4);
    sfx('wisps', { x: ch.x, n });
  } else if (kind === 'flamewave') {
    // A wall of flame that runs along the floor; more charge = farther and taller.
    heroWaves.push({ x0: ch.x + f * 6, x: ch.x + f * 6, dir: f, dist: 0, max: 50 + p * 90, speed: 150 + p * 40, power: p, h: 8 + p * 10, hit: new Set() });
    ch.vx = -f * 10;
    shake = Math.max(shake, 1 + p);
    emberBurst(ch.x + f * 6, GROUND - 2, 8, 0.3);
    sfx('flamewave', { x: ch.x, power: p });
  } else {
    bolts.push({ x: hx + f * 2, y: hy, y0: hy, vx: f * (150 + p * 90), vy: 0, r: 1.8 + p * 2.6, age: 0, sx: hx, sy: hy, power: p, dmgMul: 1 });
    ch.vx = -f * (18 + 30 * p); // recoil
    shake = Math.max(shake, 0.5 + p);
    sfx('fireball', { x: ch.x, power: p });
  }
}

// Wisps steer toward the nearest enemy ahead of them.
function steerBolt(b, dt) {
  if (!b.homing) return;
  const dir = Math.sign(b.vx);
  let best = null;
  for (const e of enemies) {
    if (e.state === 'dying') continue;
    const dx = (e.x - b.x) * dir;
    if (dx < 0 || dx > 140) continue;
    if (!best || dx < (best.x - b.x) * dir) best = e;
  }
  if (!best) return;
  const bb = enemyBounds(best);
  const ty = (bb.y0 + bb.y1) / 2;
  b.vy = lerp(b.vy, clamp((ty - b.y0) * 4, -140, 140), Math.min(1, dt * 5));
}

function updateHeroWaves(dt) {
  for (const w of heroWaves) {
    w.dist += w.speed * dt;
    w.x = w.x0 + w.dir * w.dist;
    for (const e of enemies) {
      if (e.state === 'dying' || w.hit.has(e)) continue;
      const low = !e.def.fly || e.y > GROUND - w.h - 8;
      if (low && Math.abs(e.x - w.x) < 4 + e.def.halfW * e.scale) {
        hitEnemy(e, 30 + w.power * 50, w.dir, 0.5 + w.power * 0.5, 2.5 + w.power * 2);
        w.hit.add(e);
      }
    }
    if (cfg.enemies === 'off' && !w.hit.has(dummy) && Math.abs(dummy.x - w.x) < 5) {
      dummy.angV += w.dir * 6; dummy.burn = Math.max(dummy.burn, 2.5); dummy.hits++; w.hit.add(dummy);
    }
    if (w.dist >= w.max || w.x < 4 || w.x > W - 4) { w.dead = true; emberBurst(w.x, GROUND - 3, 6, 0.2); }
  }
  for (let i = heroWaves.length - 1; i >= 0; i--) if (heroWaves[i].dead) heroWaves.splice(i, 1);
}

// The wave front is a column of heat: hottest at the floor.
function seedHeroWaves() {
  for (const w of heroWaves) {
    const fade = 1 - (w.dist / w.max) * 0.4;
    for (let dy = 1; dy <= w.h; dy++) {
      const y = GROUND - dy;
      const heat = Math.round(MAX_HEAT * fade * (1 - (dy / w.h) * 0.35));
      for (let dx = -2; dx <= 2; dx++) {
        const x = Math.round(w.x + dx - w.dir * (dy % 3 === 0 ? 1 : 0));
        if (x < 0 || x >= W) continue;
        const i = y * W + x;
        if (fire[i] < heat && Math.random() < 0.85) fire[i] = heat;
      }
    }
  }
}

function heroWaveFx() {
  for (const w of heroWaves) fxDisk(w.x, GROUND - 2, 2.2, 22);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function drawCharacter() {
  if (cfg.hero === 'bruxa') drawBruxa();
  else if (cfg.hero === 'paladino') drawPaladino();
  else drawAndarilho();
  drawSword(); // melee.js
}

// Forearm direction (elbow -> wrist), normalized.
function forearmDir(arm) {
  const dx = arm.hx - arm.ex;
  const dy = arm.hy - arm.ey;
  const d = Math.hypot(dx, dy) || 1;
  return [dx / d, dy / d];
}

// Skirt hem that follows the thighs (shared by tunic, dress and tabard).
function hemPoints(legs, f, k, flare) {
  const hip = [pose.hipX, pose.hipY];
  const a0 = lerpPt(hip, [legs[0].jx, legs[0].jy], k);
  const a1 = lerpPt(hip, [legs[1].jx, legs[1].jy], k);
  const [fr, bk] = f * a0[0] >= f * a1[0] ? [a0, a1] : [a1, a0];
  return [[fr[0] + f * flare, fr[1] + 0.7], [bk[0] - f * flare, bk[1] + 0.7]];
}

function drawBruxa() {
  const { f, legs, arms } = pose;
  const T = BODY.torso;
  // Hair behind everything.
  chain(ch.scarfB, 1.7, 0.7, part('hair', true));
  chain(ch.scarfA, 1.9, 0.8, part('hair'));
  // Back arm: sleeve and hand.
  {
    const A = arms[1];
    const sleeve = part('dress', true);
    seg([A.sx, A.sy], [A.ex, A.ey], 1.6, 1.4, sleeve);
    seg([A.ex, A.ey], [A.hx, A.hy], 1.4, 2.0, sleeve);
    const [ux, uy] = forearmDir(A);
    disk(A.hx + ux * 1.3, A.hy + uy * 1.3, 1.3, part('skin', true));
  }
  // Legs: dark stockings and pointed boots.
  for (const [L, back] of [[legs[1], true], [legs[0], false]]) {
    const knee = [L.jx, L.jy];
    const ankle = [L.ex, L.ey];
    const stock = part('stock', back);
    seg([pose.hipX, pose.hipY], knee, 2.1, 1.6, stock);
    seg(knee, ankle, 1.6, 1.3, stock);
    const boot = part('leather', back);
    seg(lerpPt(knee, ankle, 0.55), ankle, 1.7, 1.6, boot);
    seg([ankle[0] - f * 1.2, ankle[1] + 1], [ankle[0] + f * 4.2, ankle[1] + 0.6], 1.4, 0.6, boot);
  }
  // Bodice and a long flared skirt with a ragged hem.
  const dress = part('dress');
  for (let k = 0; k <= 22; k++) {
    const t = k / 22;
    const r = t < 0.7 ? lerp(2.6, 3.4 + pose.breathe * 0.12, t / 0.7) : lerp(3.4, 2.4, (t - 0.7) / 0.3);
    const c = torsoPt(0.4 * Math.sin(Math.PI * t), T * t);
    disk(c[0], c[1], r, dress);
  }
  const [hf, hb] = hemPoints(legs, f, 1.05, 3);
  const mid = lerpPt(hf, hb, 0.5);
  poly([torsoPt(-3.0, 3.2), torsoPt(3.0, 3.2), hf, [mid[0] + f * 0.5, mid[1] - 1.5], hb], part('dress'));
  seg(torsoPt(-2.8, 3.0), torsoPt(2.8, 3.0), 0.8, 0.8, part('leather'));      // belt
  for (let k = 0; k < 3; k++) plot(...torsoPt(1.6, T * (0.45 + k * 0.12)), part('leather')); // lacing
  disk(...torsoPt(-3.2, 2.0), 1.3, part('glass'));                          // potion vial
  plot(...torsoPt(-3.2, 3.4), part('leather'));
  // Head: face, hair, eye with lashes, nose.
  const cx = pose.headX;
  const cy = pose.headY;
  const r = BODY.headR;
  const hairP = part('hair');
  const face = part('skin');
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      plot(x, y, dx * f < -0.6 || dy < -2 ? hairP : face);
    }
  }
  plot(cx + f * (r + 0.4), cy + 0.6, face); // nose
  if (ch.blinking > 0) {
    plot(cx + f * 1.8, cy - 0.3, part('lid'));
  } else {
    plot(cx + f * 1.8, cy - 0.3, part('pupil'));
    plot(cx + f * 2.4, cy - 1.2, part('pupil')); // lash
  }
  plot(cx + f * 2.6, cy + 2.2, part('lips'));
  // Hat: wide brim and a cone that bends toward the springy tip.
  const brimY = cy - 2.6;
  seg([cx - f * 7.5, brimY + 0.6], [cx + f * 6.5, brimY], 0.9, 0.8, part('dress'));
  const baseL = [cx - f * 4, brimY - 0.5];
  const baseR = [cx + f * 3.5, brimY - 0.5];
  const tip = [ch.hood.x, ch.hood.y];
  const bend = [lerp(cx, tip[0], 0.45) + f * 1.2, lerp(brimY, tip[1], 0.5)];
  poly([baseL, baseR, bend, tip, [bend[0] - f * 2.2, bend[1] + 0.6]], part('dress'));
  seg([cx - f * 3.8, brimY - 1.2], [cx + f * 3.4, brimY - 1.4], 0.7, 0.7, part('gold')); // hat band
  // Front arm with a wand.
  const A = arms[0];
  const sleeve = part('dress');
  seg([A.sx, A.sy], [A.ex, A.ey], 1.6, 1.4, sleeve);
  seg([A.ex, A.ey], [A.hx, A.hy], 1.4, 2.1, sleeve);
  const [ux, uy] = forearmDir(A);
  const hand = [A.hx + ux * 1.3, A.hy + uy * 1.3];
  seg(hand, [hand[0] + ux * 6, hand[1] + uy * 6], 0.6, 0.5, part('wood'));
  plot(hand[0] + ux * 6.6, hand[1] + uy * 6.6, part('glass'));
  disk(hand[0], hand[1], 1.3, part('skin'));
}

function drawPaladino() {
  const { f, legs, arms } = pose;
  const T = BODY.torso;
  // Cape behind everything, and the shield strapped on the back.
  chain(ch.scarfB, 2.6, 3.4, part('cape', true));
  chain(ch.scarfA, 2.4, 3.2, part('cape', true));
  {
    const c = torsoPt(-4.2, T * 0.55);
    const up = pose.up;
    const fw = pose.fw;
    const S = (a, b) => [c[0] + fw[0] * a + up[0] * b, c[1] + fw[1] * a + up[1] * b];
    poly([S(-1, 6.5), S(1.5, 6.5), S(2.5, 1), S(0.5, -7), S(-2.5, 1)], part('steel', true));
    seg(S(-0.2, 5.5), S(0.6, -5), 0.6, 0.5, part('gold', true));
  }
  // Back arm in plate.
  {
    const A = arms[1];
    const plate = part('steel', true);
    seg([A.sx, A.sy], [A.ex, A.ey], 2.0, 1.7, plate);
    seg([A.ex, A.ey], [A.hx, A.hy], 1.7, 1.9, plate);
    const [ux, uy] = forearmDir(A);
    disk(A.hx + ux * 1.2, A.hy + uy * 1.2, 1.7, part('iron', true)); // gauntlet
  }
  // Armored legs and sabatons.
  for (const [L, back] of [[legs[1], true], [legs[0], false]]) {
    const knee = [L.jx, L.jy];
    const ankle = [L.ex, L.ey];
    seg([pose.hipX, pose.hipY], knee, 2.8, 2.2, part('iron', back));
    seg(knee, ankle, 2.2, 1.9, part('steel', back));
    disk(knee[0] + f * 0.5, knee[1], 1.8, part('steel', back)); // knee cop
    seg([ankle[0] - f * 1.4, ankle[1] + 1], [ankle[0] + f * 4, ankle[1] + 1.2], 1.7, 1.2, part('steel', back));
  }
  // Breastplate, tabard with a cross, belt and a mace at the hip.
  const plate = part('steel');
  for (let k = 0; k <= 24; k++) {
    const t = k / 24;
    const r = t < 0.7 ? lerp(3.2, 4.2 + pose.breathe * 0.12, t / 0.7) : lerp(4.2, 3.0, (t - 0.7) / 0.3);
    const c = torsoPt(0.5 * Math.sin(Math.PI * t), T * t);
    disk(c[0], c[1], r, plate);
  }
  const [hf, hb] = hemPoints(legs, f, 0.7, 1.5);
  poly([torsoPt(-1.6, T - 2), torsoPt(3.6, T - 2), torsoPt(3.6, 2.5), hf, hb, torsoPt(-1.6, 2.5)], part('cape'));
  const cross = part('gold');
  seg(torsoPt(1.2, T * 0.32), torsoPt(1.2, T * 0.8), 0.6, 0.6, cross);
  seg(torsoPt(-0.4, T * 0.65), torsoPt(2.8, T * 0.65), 0.6, 0.6, cross);
  seg(torsoPt(-3.6, 2.2), torsoPt(3.8, 2.2), 1.1, 1.1, part('leather'));
  const mace = torsoPt(-1.5, 1.2);
  seg(mace, [mace[0] - f * 1.2, mace[1] + 7], 0.6, 0.6, part('wood'));
  disk(mace[0] - f * 1.4, mace[1] + 8, 1.6, part('iron'));
  // Great helm with a visor slit and a plume.
  const cx = pose.headX;
  const cy = pose.headY;
  const r = BODY.headR + 0.4;
  seg([cx - f * 0.5, cy - r + 0.5], [ch.hood.x, ch.hood.y], 1.8, 0.9, part('cape'));
  seg([ch.hood.x, ch.hood.y], [ch.hood.x - f * 2.5, ch.hood.y + 2], 1.0, 0.5, part('cape'));
  disk(cx, cy, r, part('steel'));
  const slit = part('pupil');
  for (let k = 0; k <= 3; k++) plot(cx + f * (1 + k), cy - 0.6, slit);
  for (let k = 0; k < 2; k++) plot(cx + f * (2 + k), cy + 1.8, slit); // breaths
  seg([cx - f * r, cy + 0.2], [cx - f * 1, cy - r], 0.5, 0.5, part('gold')); // crest band
  // Front arm in plate with pauldron.
  const A = arms[0];
  const armP = part('steel');
  seg([A.sx, A.sy], [A.ex, A.ey], 2.0, 1.7, armP);
  seg([A.ex, A.ey], [A.hx, A.hy], 1.7, 1.9, armP);
  const [ux, uy] = forearmDir(A);
  disk(A.hx + ux * 1.2, A.hy + uy * 1.2, 1.8, part('iron'));
  const d = Math.hypot(A.ex - A.sx, A.ey - A.sy) || 1;
  disk(A.sx + ((A.ex - A.sx) / d) * 1.2, A.sy + ((A.ey - A.sy) / d) * 1.2 - 0.4, 3.0, part('steel'));
}
