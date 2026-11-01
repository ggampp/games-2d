// Fire Walker — enemies.
//
// Four procedural enemy types share one pipeline: a pose from sines + 2-bone IK,
// rasterized into part ids, shaded and outlined like the hero. When hit they feel it
// (hit-stop, white flash, recoil, knockback) and catch fire: their own pixels become
// heat sources for the DOOM fire, they char, and they finally burn away into ash.
//
//   ghoul   — hunched melee, limps toward the hero and claws.
//   bat     — flies, hovers out of reach and dives at the hero's chest.
//   cultist — robed caster, keeps its distance and throws shadow orbs.
//   brute   — big and slow, barely flinches, slams the ground (a shockwave of fire).

'use strict';

const ENEMY_TYPES = {
  ghoul: {
    hp: 100, speed: [13, 21], scale: [0.9, 1.15], kb: 1, burnDps: 15, panic: true,
    halfW: 5, minWave: 1, weight: 5, jut: 1.6,
    body: { thigh: 8, shin: 8, torso: 11, headR: 4, upperArm: 6.5, foreArm: 6.5, hunch: 0.42 },
    melee: { range: 11, reach: 15, windup: 0.4, dmg: 12 },
  },
  bat: {
    hp: 30, speed: [38, 50], scale: [0.9, 1.1], kb: 1.4, burnDps: 22, panic: true, fly: true,
    halfW: 6, minWave: 2, weight: 3, dmg: 8,
  },
  cultist: {
    hp: 70, speed: [14, 18], scale: [0.95, 1.05], kb: 1.1, burnDps: 18, panic: true,
    halfW: 5, minWave: 3, weight: 2, jut: 0.4,
    body: { thigh: 8.5, shin: 8.5, torso: 12, headR: 4, upperArm: 6, foreArm: 6, hunch: 0.12 },
    ranged: { min: 60, max: 115, windup: 0.75, cd: [2.0, 3.2], dmg: 10 },
  },
  brute: {
    hp: 320, speed: [8, 11], scale: [1, 1.08], kb: 0.3, burnDps: 9, panic: false,
    halfW: 8, minWave: 4, weight: 1.5, jut: 0.8,
    body: { thigh: 10, shin: 9, torso: 15, headR: 3.8, upperArm: 9, foreArm: 9, hunch: 0.3 },
    melee: { range: 16, reach: 22, windup: 0.8, dmg: 22, slam: true },
  },
};

const ENEMY_MODES = {
  off: { base: 0, per: 0, cap: 0, every: 0 },
  few: { base: 2, per: 0.5, cap: 4, every: 4.2 },
  many: { base: 3, per: 1, cap: 7, every: 2.2 },
};

const enemies = [];
const eshots = [];      // cultist shadow orbs
const shockwaves = [];  // brute slams
const scorches = [];    // ash piles
const stats = { kills: 0, hitsTaken: 0, deaths: 0, wave: 1 };
let spawnTimer = 1.0;
let hitstop = 0;
let banner = { text: '', t: 0 };

const randIn = ([a, b]) => a + Math.random() * (b - a);
const waveOf = () => 1 + Math.floor(stats.kills / 6);
const heroTargetable = () => !ch.dead && (dissolve.state === 'none' || dissolve.state === 'out');

// Hostile magic gets its own palette so it reads apart from the hero's spell.
const HOSTILE = ramp([[0, '#000000'], [0.35, '#2c0838'], [0.68, '#8e2bc4'], [0.88, '#e39cff'], [1, '#ffffff']]);
const HOSTILE32 = Uint32Array.from({ length: MAX_HEAT + 1 }, (_, i) => pack([HOSTILE[i * 3], HOSTILE[i * 3 + 1], HOSTILE[i * 3 + 2]]));
const fxE = new Uint8Array(W * H);

// ---------------------------------------------------------------------------
// Spawning in waves
// ---------------------------------------------------------------------------
function pickType(wave) {
  const pool = Object.entries(ENEMY_TYPES).filter(([, d]) => wave >= d.minWave);
  let r = Math.random() * pool.reduce((s, [, d]) => s + d.weight, 0);
  for (const [name, d] of pool) { r -= d.weight; if (r <= 0) return name; }
  return pool[0][0];
}

function spawnEnemy(type) {
  // Enter just outside the camera, from a side that is still inside the world.
  let side = Math.random() < 0.5 ? -1 : 1;
  const left = cam.x - 14;
  const right = cam.x + VIEW_W + 14;
  if (left < -10) side = 1;
  if (right > W + 10) side = -1;
  const x = side < 0 ? Math.max(-10, left) : Math.min(W + 10, right);
  enemies.push(makeEnemy(type, x, -side));
}

function makeEnemy(type, x, facing) {
  const def = ENEMY_TYPES[type];
  const side = -facing;
  const scale = randIn(def.scale);
  return {
    type, def, x, y: def.fly ? FEET_Y - 60 - Math.random() * 15 : FEET_Y,
    vx: 0, vy: 0, onGround: !def.fly, facing, scale, speed: randIn(def.speed),
    phase: Math.random() * 6, wobble: Math.random() * 10, flapPh: Math.random() * 6,
    hp: def.hp, maxHp: def.hp, hpGhost: def.hp, barT: 0, lastDmg: -9,
    state: def.fly ? 'hover' : 'walk', t: 0, t2: 0, atkCd: 1 + Math.random(), entered: false,
    hurt: 0, flash: 0, burn: 0, char: 0, kneel: 0, cut: null, grounded: false, spin: 0,
    panicDir: -side, panicT: 0, jx: 0, jy: 0, diveX: 0, diveY: 0,
    lean: def.body ? def.body.hunch : 0, ua: [1.1, 1.1], fa: [1.5, 1.5], pose: null, rid: 0, gone: false,
  };
}

// ---------------------------------------------------------------------------
// Damage, burning, death
// ---------------------------------------------------------------------------
function ignite(e, seconds) {
  if (e.state === 'dying') return;
  if (e.burn <= 0) sfx('ignite', { x: e.x });
  e.burn = Math.max(e.burn, seconds);
}

function damageEnemy(e, amount) {
  e.hp -= amount;
  e.lastDmg = simTime;
  e.barT = 2.5;
}

// The enemy "feels" the hit: freeze-frame, white flash, recoil, knockback, fire.
// Heavy enemies (low kb) flinch less and are not interrupted by weak hits.
function hitEnemy(e, damage, dir, power, burnSeconds) {
  if (e.state === 'dying') return;
  const kb = e.def.kb;
  damageEnemy(e, damage);
  sfx('hit', { x: e.x, type: e.type, power });
  e.hurt = (0.35 + power * 0.2) * Math.min(1, 0.4 + kb * 0.6);
  e.flash = 0.09;
  e.vx = dir * (70 + power * 90) * kb;
  if (e.def.fly) e.vy = -40 * kb;
  else if (power > 0.45 && e.onGround && kb >= 1) { e.vy = -55 - power * 45; e.onGround = false; }
  if ((e.state === 'windup' || e.state === 'strike') && (kb >= 1 || power > 0.7)) { e.state = e.def.fly ? 'climb' : 'walk'; e.t = 0; e.atkCd = 0.7; }
  if (e.state === 'dive') { e.state = 'climb'; e.t = 0; }
  // The boss only staggers on a charged hit, and then has a few seconds of poise.
  if (e.def.boss && power > 0.85 && e.state !== 'intro' && !(e.poise > 0)) { e.state = 'stagger'; e.t = 0; e.poise = 4; }
  ignite(e, burnSeconds);
  hitstop = Math.max(hitstop, 0.05 + power * 0.05);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.state === 'dying') return;
  e.state = 'dying';
  e.t = 0;
  e.t2 = 0;
  e.hp = 0;
  stats.kills++;
  if (e.def.fly) { e.vy = -20; e.grounded = false; }
  if (e.def.boss) { showBanner('Vitória!'); BOSS.kills++; sfx('bossdeath', { x: e.x }); sfx('victory'); }
  else sfx('die', { x: e.x, type: e.type });
}

function emberBurst(x, y, n, power) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * Math.random();
    const sp = (40 + Math.random() * 90) * (0.6 + power);
    embers.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.4 + Math.random() * 0.8, heat: 28 + ((Math.random() * 8) | 0), g: 1 });
  }
}

// ---------------------------------------------------------------------------
// The hero gets hit
// ---------------------------------------------------------------------------
// src: the enemy that attacked (for blocks and perfect-block staggers).
// unblockable: hits from below or above (shockwaves, slams, meteors).
function playerHit(dir, dmg, kb = 1, src = null, unblockable = false) {
  if (ch.dead || dissolve.state !== 'none' || ch.hurt > 0 || ch.invuln > 0) return;
  if (rollInvulnerable()) { sfx('dodge', { x: ch.x }); return; } // rolled through it
  if (!unblockable) {
    const through = shieldResolve(dir, dmg, kb, src);
    if (through !== null) {
      if (through > 0) {
        ch.hp = Math.max(0, ch.hp - through);
        ch.lastHit = simTime;
        if (ch.hp <= 0) heroDies();
      }
      return;
    }
  }
  ch.hp = Math.max(0, ch.hp - dmg);
  ch.lastHit = simTime;
  ch.hurt = 0.35;
  ch.flash = 0.1;
  ch.vx = dir * 95 * kb;
  ch.vy = -70 * kb;
  ch.onGround = false;
  if (spell.state === 'charge') spell.state = 'idle';
  stats.hitsTaken++;
  sfx('hurt', { x: ch.x });
  shake = Math.max(shake, 2);
  hitstop = Math.max(hitstop, 0.06);
  if (ch.hp <= 0) heroDies();
}

function heroDies() {
  ch.dead = true;
  stats.deaths++;
  spell.state = 'idle';
  dissolve.state = 'out';
  dissolve.t = 0;
  emberBurst(ch.x, ch.y - 20, 16, 0.6);
  showBanner('Derrotado');
  sfx('herodeath', { x: ch.x });
}

function showBanner(text) {
  banner = { text, t: 2.2 };
}

// Hit box: walkers use their posed head as the top, bats are a small box.
function enemyBounds(e) {
  if (e.def.fly) return { x0: e.x - 6 * e.scale, x1: e.x + 6 * e.scale, y0: e.y - 5, y1: e.y + 5 };
  const hw = e.def.halfW * e.scale;
  return { x0: e.x - hw, x1: e.x + hw, y0: e.pose ? e.pose.top : e.y - 40 * e.scale, y1: e.y + 2 };
}

function enemyHit(e, x, y, r) {
  const b = enemyBounds(e);
  return x + r > b.x0 && x - r < b.x1 && y + r > b.y0 && y - r < b.y1;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function updateEnemies(dt) {
  updateBossArena(dt);
  const wave = waveOf();
  if (wave > stats.wave) { stats.wave = wave; showBanner(`Onda ${wave}`); sfx('wave'); }
  banner.t = Math.max(0, banner.t - dt);

  if (cfg.enemies !== 'off') {
    const mode = ENEMY_MODES[cfg.enemies];
    spawnTimer -= dt;
    const alive = enemies.filter((e) => e.state !== 'dying').length;
    const max = Math.min(mode.cap, Math.floor(mode.base + (wave - 1) * mode.per));
    if (spawnTimer <= 0 && alive < max && !ch.dead && !BOSS.locked) {
      spawnEnemy(pickType(wave));
      spawnTimer = (mode.every * (0.7 + Math.random() * 0.6)) / (1 + (wave - 1) * 0.08);
    }
  }

  for (const e of enemies) {
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.hurt = Math.max(0, e.hurt - dt);
    e.barT = Math.max(0, e.barT - dt);
    e.atkCd -= dt;
    // The light trailing bar drains toward the real health after a short pause.
    if (e.hpGhost > e.hp && simTime - e.lastDmg > 0.4) e.hpGhost = Math.max(e.hp, e.hpGhost - e.maxHp * 0.6 * dt);
    if (e.def.fly) updateBat(e, dt);
    else if (e.def.boss) updateBoss(e, dt);
    else updateWalker(e, dt);
  }

  // Fire spreads to enemies that touch a burning one.
  for (const a of enemies) {
    if (a.burn <= 0 || a.state === 'dying') continue;
    for (const b of enemies) {
      if (b !== a && b.burn <= 0 && Math.abs(a.x - b.x) < 8 && Math.abs(a.y - b.y) < 24) ignite(b, 1.6);
    }
  }
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].gone) enemies.splice(i, 1);
  for (const a of scorches) a.t += dt;
  for (let i = scorches.length - 1; i >= 0; i--) if (scorches[i].t > 9) scorches.splice(i, 1);

  updateShots(dt);
  updateShockwaves(dt);
}

function updateWalker(e, dt) {
  const def = e.def;
  const toP = ch.x - e.x;
  const dist = Math.abs(toP);
  const heroThere = heroTargetable();
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
        scorches.push({ x: e.x, t: 0, r: 8 + def.halfW });
        emberBurst(e.x, e.y - 4, 10, 0.3);
      }
    }
  } else {
    if (e.burn > 0) {
      e.burn -= dt;
      damageEnemy(e, def.burnDps * dt);
      e.char = Math.min(1, e.char + dt * (def.panic ? 0.22 : 0.12));
      if (Math.random() < dt * 5) emberBurst(e.x + (Math.random() - 0.5) * 8, e.y - 10 - Math.random() * 25, 1, 0);
    }
    if (e.burn > 0 && def.panic) {
      // Burning: run around in a panic.
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
      e.facing = Math.sign(target) || e.facing;
    } else if (e.state === 'walk') {
      e.facing = Math.sign(toP) || e.facing;
      const slow = e.burn > 0 ? 0.8 : 1;
      if (def.melee) {
        if (heroThere && dist < def.melee.range * e.scale && e.atkCd <= 0 && e.hurt <= 0) { e.state = 'windup'; e.t = 0; }
        else if (dist > def.melee.range * 0.7 * e.scale) target = Math.sign(toP) * e.speed * slow * (0.7 + 0.3 * Math.sin(e.phase * 0.5 + e.wobble));
      } else if (def.ranged) {
        const r = def.ranged;
        if (dist > r.max || !heroThere) target = Math.sign(toP) * e.speed;
        else if (dist < r.min) target = -Math.sign(toP) * e.speed * 1.1; // back off
        else if (e.atkCd <= 0 && e.hurt <= 0) { e.state = 'windup'; e.t = 0; }
      }
    } else if (e.state === 'windup') {
      e.facing = Math.sign(toP) || e.facing;
      if (e.t > (def.melee ? def.melee.windup : def.ranged.windup)) {
        e.state = 'strike';
        e.t = 0;
        if (def.melee && def.melee.slam) slam(e);
        else if (def.melee) {
          if (heroThere && dist < def.melee.reach * e.scale && ch.y > FEET_Y - 16) playerHit(e.facing, def.melee.dmg, 1, e);
        } else castShadowOrb(e);
      }
    } else if (e.state === 'strike' && e.t > (def.melee && def.melee.slam ? 0.45 : 0.25)) {
      e.state = 'walk';
      e.t = 0;
      e.atkCd = def.ranged ? randIn(def.ranged.cd) : 0.9 + Math.random() * 0.6;
    }
    if (e.hp <= 0) killEnemy(e);
    // The hero's aura and the braziers set enemies on fire.
    if (cfg.effect === 'aura' && dissolve.state === 'none' && !ch.dead && dist < 10 + def.halfW) ignite(e, 1.5);
    for (const b of BRAZIERS) if (Math.abs(e.x - b.x) < 5) ignite(e, 1.2);
  }

  if (e.hurt > 0 || e.state === 'dying' || e.state === 'windup' || e.state === 'strike') target = 0;
  e.vx = approach(e.vx, target, (e.hurt > 0 ? 110 : 170) * dt);
  e.vy += GRAVITY * dt;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (e.y >= FEET_Y) { e.y = FEET_Y; e.vy = 0; e.onGround = true; }
  if (e.x > 10 && e.x < W - 10) e.entered = true;
  if (e.entered) e.x = clamp(e.x, 8, W - 8);
  const speed = Math.abs(e.vx);
  e.phase += ((Math.PI * speed) / ((4 + speed * 0.08) * e.scale)) * dt;
  computeWalkerPose(e, dt);
}

function updateBat(e, dt) {
  const def = e.def;
  const cx = ch.x;
  const cy = ch.y - 26; // the hero's chest
  e.flapPh += dt * (e.state === 'dive' ? 7 : e.state === 'dying' ? 9 : 17);

  if (e.state === 'dying') {
    // Falls spinning while it burns, then burns away on the ground.
    e.burn = Math.max(e.burn, 0.5);
    e.char = Math.min(1, e.char + dt);
    if (!e.grounded) {
      e.vy += GRAVITY * 0.6 * dt;
      e.vx *= 0.98;
      e.spin += dt * 9;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.y >= FEET_Y - 3) { e.y = FEET_Y - 3; e.vy = 0; e.vx = 0; e.grounded = true; }
    } else {
      e.t2 += dt;
      e.cut = clamp(e.t2 / 0.7, 0, 1);
      if (e.cut >= 1) { e.gone = true; scorches.push({ x: e.x, t: 0, r: 7 }); emberBurst(e.x, e.y, 6, 0.2); }
    }
    computeBatPose(e);
    return;
  }

  if (e.burn > 0) {
    e.burn -= dt;
    damageEnemy(e, def.burnDps * dt);
    e.char = Math.min(1, e.char + dt * 0.4);
    if (Math.random() < dt * 6) emberBurst(e.x, e.y, 1, 0);
  }
  let tx = null;
  let ty = null;
  let spd = e.speed;
  if (e.burn > 0) {
    // Burning: erratic, panicked flight.
    e.panicT -= dt;
    if (e.panicT <= 0) { e.panicT = 0.2 + Math.random() * 0.3; e.jx = (Math.random() - 0.5) * 70; e.jy = -Math.random() * 40; }
    tx = e.x + e.jx;
    ty = FEET_Y - 60 + e.jy;
    spd *= 1.3;
  } else if (e.state === 'hover') {
    const side = e.x < cx ? -1 : 1;
    tx = cx + side * 34;
    ty = FEET_Y - 62 + Math.sin(e.t * 2 + e.wobble) * 8;
    if (heroTargetable() && e.atkCd <= 0 && Math.abs(e.x - tx) < 14) { e.state = 'dive'; e.t = 0; e.diveX = cx; e.diveY = cy; }
  } else if (e.state === 'dive') {
    tx = e.diveX;
    ty = e.diveY;
    spd *= 2.4;
    if (heroTargetable() && Math.abs(e.x - cx) < 7 && Math.abs(e.y - cy) < 9) {
      playerHit(Math.sign(cx - e.x) || 1, def.dmg, 0.6, e);
      e.state = 'climb'; e.t = 0;
    }
    if (Math.hypot(e.x - tx, e.y - ty) < 4 || e.t > 1.2) { e.state = 'climb'; e.t = 0; }
  } else {
    tx = e.x + e.facing * 30;
    ty = FEET_Y - 72;
    if (e.t > 0.7) { e.state = 'hover'; e.t = 0; e.atkCd = 1.5 + Math.random() * 1.5; }
  }
  if (e.hurt <= 0 && tx !== null) {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, dt * 4);
    e.vx = lerp(e.vx, (dx / d) * spd, k);
    e.vy = lerp(e.vy, (dy / d) * spd, k);
  } else {
    e.vx *= 0.96;
    e.vy *= 0.96;
  }
  e.x += e.vx * dt;
  e.y = clamp(e.y + e.vy * dt, 14, FEET_Y - 6);
  if (e.x > 10 && e.x < W - 10) e.entered = true;
  if (e.entered) e.x = clamp(e.x, 8, W - 8);
  if (Math.abs(e.vx) > 3) e.facing = Math.sign(e.vx);
  if (e.hp <= 0) killEnemy(e);
  if (cfg.effect === 'aura' && dissolve.state === 'none' && !ch.dead && Math.abs(e.x - cx) < 10 && Math.abs(e.y - cy) < 16) ignite(e, 1.5);
  for (const b of BRAZIERS) if (Math.abs(e.x - b.x) < 6 && e.y > b.top - 16) ignite(e, 1.2);
  computeBatPose(e);
}

// ---------------------------------------------------------------------------
// Attacks: shadow orbs (cultist) and ground slam shockwaves (brute)
// ---------------------------------------------------------------------------
function castShadowOrb(e) {
  const hand = e.pose ? e.pose.arms[0].hd : [e.x, e.y - 30];
  sfx('orbcast', { x: e.x });
  eshots.push({ x: hand[0] + e.facing * 2, y: hand[1], ty: FEET_Y - 38, vx: e.facing * 85, r: 2.6, age: 0, dmg: e.def.ranged.dmg, dead: false });
}

function slam(e) {
  const x = e.x + e.facing * 12 * e.scale;
  shockwaves.push({ x, t: 0, hit: false, dmg: e.def.melee.dmg });
  sfx('slam', { x });
  shake = Math.max(shake, 3.5);
  emberBurst(x, GROUND - 2, 14, 0.5);
  if (heroTargetable() && Math.abs(ch.x - x) < 12 && ch.y > FEET_Y - 6) playerHit(Math.sign(ch.x - e.x) || e.facing, e.def.melee.dmg, 1.2, e, true);
}

const SHOCK_SPEED = 130;
const SHOCK_LIFE = 0.5;

function updateShockwaves(dt) {
  for (const s of shockwaves) {
    s.t += dt;
    const r = s.t * SHOCK_SPEED;
    // Jump over it: only hits a hero standing on the ground.
    if (!s.hit && heroTargetable() && ch.y > FEET_Y - 4) {
      for (const front of [s.x - r, s.x + r]) {
        if (Math.abs(ch.x - front) < 5) { playerHit(Math.sign(ch.x - s.x) || 1, s.dmg, 1.1, null, true); s.hit = true; break; }
      }
    }
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) if (shockwaves[i].t > SHOCK_LIFE) shockwaves.splice(i, 1);
}

function updateShots(dt) {
  const heroTop = pose ? pose.headY - BODY.headR - 1 : ch.y - 40;
  for (const s of eshots) {
    s.age += dt;
    s.x += s.vx * dt;
    s.y += (s.ty - s.y) * Math.min(1, dt * 6) + Math.sin(s.age * 14) * 0.15;
    // Crouch under it or jump over it.
    if (heroTargetable() && shieldStopsOrb(s)) s.dead = true;
    else if (heroTargetable() && Math.abs(s.x - ch.x) < 4 + s.r && s.y > heroTop && s.y < ch.y && !rollInvulnerable()) {
      playerHit(Math.sign(s.vx), s.dmg, 0.8);
      s.dead = true;
    }
    // The hero's spell destroys it in the air (an orb the shield already stopped is gone:
    // a reflected fireball starts right on top of it and must not collide with it).
    if (!s.dead) for (const b of bolts) {
      if (!b.dead && Math.abs(b.x - s.x) < b.r + s.r && Math.abs(b.y - s.y) < b.r + s.r + 1) { impact(b, false); s.dead = true; }
    }
    if (s.x < 0 || s.x >= W || s.age > 4) s.dead = true;
    if (s.dead) for (let k = 0; k < 6; k++) embers.push({ x: s.x, y: s.y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.7) * 80, life: 0.3 + Math.random() * 0.3, heat: 24, g: 1 });
  }
  for (let i = eshots.length - 1; i >= 0; i--) if (eshots[i].dead) eshots.splice(i, 1);
}

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------
// Arm targets per type and state: [front, back] angles from straight down,
// positive = toward where the enemy faces.
function armTargets(e, a) {
  const t = e.type;
  if (t === 'boss') return bossArmTargets(e, a);
  if (t === 'brute') {
    if (e.state === 'windup') return { ua: [2.9, 2.8], fa: [3.2, 3.1], lean: 0.05 };
    if (e.state === 'strike') return { ua: [1.2, 1.1], fa: [1.0, 0.9], lean: 0.65 };
    return { ua: [0.25 + Math.sin(e.phase) * 0.25 * a, 0.2 - Math.sin(e.phase) * 0.25 * a], fa: [0.4, 0.35], lean: null };
  }
  if (t === 'cultist') {
    if (e.state === 'windup') return { ua: [2.0, 1.8], fa: [2.5, 2.3], lean: 0.0 };
    if (e.state === 'strike') return { ua: [1.55, 1.5], fa: [1.6, 1.55], lean: 0.25 };
    return { ua: [0.4, 0.35], fa: [1.0, 0.9], lean: null };
  }
  if (e.state === 'windup') return { ua: [2.7, 2.4], fa: [3.1, 2.9], lean: 0.15 };
  if (e.state === 'strike') return { ua: [0.9, 1.2], fa: [0.4, 0.8], lean: 0.75 };
  return { ua: [1.15 + Math.sin(e.phase) * 0.3, 1.0 - Math.sin(e.phase) * 0.3], fa: [1.55, 1.45], lean: null };
}

function computeWalkerPose(e, dt) {
  const def = e.def;
  const B = def.body;
  const s = e.scale;
  const f = e.facing;
  const th = B.thigh * s;
  const sh = B.shin * s;
  const T = B.torso * s;
  const speed = Math.abs(e.vx);
  const a = Math.min(1, speed / 18);
  const panic = e.burn > 0 && def.panic && e.state !== 'dying';
  const hurtK = clamp(e.hurt / 0.3, 0, 1) * Math.min(1, def.kb * 1.5);
  const stride = (4 + speed * 0.08) * s;
  const hipX = e.x;
  const hipY = e.y - (th + sh) * 0.9 + e.kneel * th * 0.85 - Math.cos(2 * e.phase) * 0.8 * a;

  const legs = [];
  for (let i = 0; i < 2; i++) {
    const ph = e.phase + i * Math.PI;
    const stand = (i === 0 ? 2 : -1.8) * s * (e.type === 'boss' ? 2.6 : e.type === 'brute' ? 1.6 : 1);
    let fx = hipX + f * (-Math.cos(ph) * (stride / 2) * a + stand * (1 - a));
    const fy0 = e.y - Math.max(0, Math.sin(ph)) * 3 * s * a;
    if (e.kneel > 0) fx = lerp(fx, hipX + f * (i === 0 ? 5 : -6) * s, e.kneel);
    const fy = e.onGround ? fy0 : hipY + (th + sh) * 0.8;
    legs.push(ik(hipX, hipY, fx, fy, th, sh, f));
  }

  // Target lean/arm angles by state, smoothed so transitions read as motion.
  const tg = armTargets(e, a);
  let leanT = tg.lean !== null ? tg.lean : B.hunch + a * 0.08 + Math.sin(e.t * 1.7 + e.wobble) * 0.04;
  let uaT = tg.ua;
  let faT = tg.fa;
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
  const sm = Math.min(1, dt * (hurtK > 0 || tg.fast ? 30 : 12));
  e.lean = lerp(e.lean, leanT, sm);
  e.ua = e.ua.map((v, i) => lerp(v, uaT[i], sm));
  e.fa = e.fa.map((v, i) => lerp(v, faT[i], sm));

  const lean = e.lean;
  const up = [f * Math.sin(lean), -Math.cos(lean)];
  const fw = [f * Math.cos(lean), Math.sin(lean)];
  const neck = [hipX + up[0] * T, hipY + up[1] * T];
  // The head juts forward of the neck and snaps back when hit.
  const hl = lean * 0.3 - hurtK * 0.6;
  const head = [
    neck[0] + f * (Math.sin(hl) * B.headR * s + def.jut * s * (1 - hurtK)),
    neck[1] - Math.cos(hl) * B.headR * s * 0.85,
  ];
  const shoulder = lerpPt([hipX, hipY], neck, 0.85);
  const arms = [0, 1].map((i) => {
    const el = [shoulder[0] + f * Math.sin(e.ua[i]) * B.upperArm * s, shoulder[1] + Math.cos(e.ua[i]) * B.upperArm * s];
    const hd = [el[0] + f * Math.sin(e.fa[i]) * B.foreArm * s, el[1] + Math.cos(e.fa[i]) * B.foreArm * s];
    return { sh: shoulder, el, hd };
  });
  let top = head[1] - B.headR * s - (e.type === 'boss' ? 7 : e.type === 'brute' ? 3 : e.type === 'cultist' ? 2 : 0);
  for (const arm of arms) top = Math.min(top, arm.hd[1] - 1);
  e.pose = { f, s, T, B, hipX, hipY, neck, head, legs, arms, up, fw, top };
}

function computeBatPose(e) {
  const s = e.scale;
  const f = e.facing;
  let flap = Math.sin(e.flapPh);
  if (e.state === 'dive') flap = -0.6 + Math.sin(e.flapPh) * 0.15; // wings tucked
  if (e.state === 'dying') flap = Math.sin(e.flapPh) * 0.5;
  const c = Math.cos(e.spin);
  const sn = Math.sin(e.spin);
  const P = (dx, dy) => [e.x + dx * c - dy * sn, e.y + dx * sn + dy * c];
  const wing = (k) => ({
    sh: P(k * 1.5 * s, -1 * s),
    el: P(k * 6 * s, (-3 - flap * 4) * s),
    tip: P(k * 11 * s, (1 - flap * 7) * s),
    fin: P(k * 8 * s, (3.5 - flap * 3) * s),
    base: P(k * 1.2 * s, 2.5 * s),
  });
  e.pose = {
    f, s, P,
    wings: { back: wing(-f), front: wing(f) },
    head: P(f * 2.6 * s, -2.4 * s),
    top: e.y - 8 * s,
  };
}

// ---------------------------------------------------------------------------
// Drawing (into the shared part-id raster, shaded with the hero)
// ---------------------------------------------------------------------------
function drawEnemy(e) {
  if (!e.pose) return;
  if (e.type === 'boss') drawBoss(e);
  else if (e.type === 'bat') drawBat(e);
  else if (e.type === 'brute') drawBrute(e);
  else if (e.type === 'cultist') drawCultist(e);
  else drawGhoul(e);
}

function clawHand(arm, back, s, mat) {
  const dx = arm.hd[0] - arm.el[0];
  const dy = arm.hd[1] - arm.el[1];
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const claw = part(mat, back);
  seg(arm.hd, [arm.hd[0] + ux * 2.4 * s - uy * 0.9, arm.hd[1] + uy * 2.4 * s + ux * 0.9], 0.5, 0.3, claw);
  seg(arm.hd, [arm.hd[0] + ux * 2.6 * s + uy * 0.7, arm.hd[1] + uy * 2.6 * s - ux * 0.7], 0.5, 0.3, claw);
}

function drawGhoul(e) {
  const P = e.pose;
  const { f, s } = P;
  const L = (a, b) => [P.hipX + P.fw[0] * a + P.up[0] * b, P.hipY + P.fw[1] * a + P.up[1] * b];
  const arm = (A, back) => {
    seg(A.sh, lerpPt(A.sh, A.el, 0.55), 1.9 * s, 1.6 * s, part('rags', back)); // torn sleeve
    const skin = part('ghoul', back);
    seg(lerpPt(A.sh, A.el, 0.5), A.el, 1.4 * s, 1.2 * s, skin);
    seg(A.el, A.hd, 1.2 * s, 1.0 * s, skin);
    clawHand(A, back, s, 'bone');
  };
  const leg = (G, back) => {
    const knee = [G.jx, G.jy];
    const ankle = [G.ex, G.ey];
    seg([P.hipX, P.hipY], knee, 2.2 * s, 1.8 * s, part('rags', back));
    const skin = part('ghoul', back);
    seg(knee, ankle, 1.5 * s, 1.2 * s, skin);
    seg([ankle[0] - f * 0.8, ankle[1] + 0.8], [ankle[0] + f * 3 * s, ankle[1] + 1.1], 1.2, 0.9, skin);
  };
  arm(P.arms[1], true);
  leg(P.legs[1], true);
  leg(P.legs[0], false);
  // Hunched torso with a hump on the back.
  const torso = part('rags');
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    const c = L(-1.4 * s * Math.sin(Math.PI * t), P.T * t);
    disk(c[0], c[1], lerp(2.6, 3.3, Math.sin(Math.PI * t)) * s, torso);
  }
  poly([L(-3.2 * s, 1.5 * s), L(3.0 * s, 1.5 * s), L(3.2 * s, -3 * s), L(1.5 * s, -1.6 * s), L(0, -3.6 * s), L(-1.6 * s, -1.8 * s), L(-3.0 * s, -3.4 * s)], part('rags'));
  seg(L(-3 * s, 1.2 * s), L(3 * s, 1.2 * s), 0.55, 0.55, part('rope'));
  const [hx, hy] = P.head;
  disk(hx, hy, P.B.headR * s, part('ghoul'));
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
  arm(P.arms[0], false);
}

function drawBrute(e) {
  const P = e.pose;
  const { f, s } = P;
  const L = (a, b) => [P.hipX + P.fw[0] * a + P.up[0] * b, P.hipY + P.fw[1] * a + P.up[1] * b];
  const arm = (A, back) => {
    const skin = part('brute', back);
    seg(A.sh, A.el, 3.2 * s, 2.7 * s, skin);
    seg(A.el, A.hd, 2.7 * s, 2.3 * s, skin);
    seg(lerpPt(A.el, A.hd, 0.35), lerpPt(A.el, A.hd, 0.85), 2.9 * s, 2.7 * s, part('iron', back)); // bracer
    disk(A.hd[0], A.hd[1], 2.8 * s, part('brute', back)); // fist
  };
  const leg = (G, back) => {
    const knee = [G.jx, G.jy];
    const ankle = [G.ex, G.ey];
    seg([P.hipX, P.hipY], knee, 3.6 * s, 3.0 * s, part('leather', back));
    seg(knee, ankle, 3.0 * s, 2.5 * s, part('brute', back));
    seg([ankle[0] - f * 1.5, ankle[1] + 1], [ankle[0] + f * 4.5 * s, ankle[1] + 1.5], 2.0, 1.6, part('iron', back));
  };
  arm(P.arms[1], true);
  leg(P.legs[1], true);
  leg(P.legs[0], false);
  // Massive bare torso, wider at the chest, with a hanging gut.
  const torso = part('brute');
  for (let k = 0; k <= 24; k++) {
    const t = k / 24;
    const r = (t < 0.65 ? lerp(5.2, 6.6, t / 0.65) : lerp(6.6, 4.6, (t - 0.65) / 0.35)) * s;
    const c = L(0.8 * s * Math.sin(Math.PI * t) - 1.2 * s * Math.sin(Math.PI * t * 0.9), P.T * t);
    disk(c[0], c[1], r, torso);
  }
  poly([L(-5 * s, 1.5 * s), L(5 * s, 1.5 * s), L(3.5 * s, -6 * s), L(-3.8 * s, -5.5 * s)], part('leather')); // loincloth
  seg(L(-5.4 * s, 2 * s), L(5.4 * s, 2 * s), 1.3, 1.3, part('iron'));                                    // belt
  disk(...L(4.8 * s, 2 * s), 1.6, part('bone'));                                                           // skull buckle
  seg(L(3.5 * s, P.T - 1 * s), L(-4.5 * s, 3 * s), 0.8, 0.8, part('leather'));                           // strap
  // Small head with an iron helmet and horns.
  const [hx, hy] = P.head;
  const r = P.B.headR * s;
  disk(hx, hy, r, part('brute'));
  const helm = part('iron');
  for (let y = Math.floor(hy - r); y <= Math.ceil(hy + r); y++) {
    for (let x = Math.floor(hx - r); x <= Math.ceil(hx + r); x++) {
      const dx = x - hx;
      const dy = y - hy;
      if (dx * dx + dy * dy <= r * r && dy < -0.5) plot(x, y, helm);
    }
  }
  const horn = part('bone');
  seg([hx - f * 1.5, hy - r * 0.6], [hx - f * 4.5, hy - r - 3.5], 1.0, 0.4, horn);
  seg([hx + f * 1.5, hy - r * 0.6], [hx + f * 3.2, hy - r - 3], 1.0, 0.4, horn);
  const eye = part('eyeglow');
  plot(hx + f * 2, hy + 0.3, eye);
  if (e.state === 'windup' || e.state === 'strike' || e.hurt > 0 || e.burn > 0) plot(hx + f * 2.6, hy + 2.2, part('mouth'));
  arm(P.arms[0], false);
  // Spiked pauldron on the front shoulder.
  const A = P.arms[0];
  disk(A.sh[0], A.sh[1] - 0.5, 3.4 * s, part('iron'));
  seg([A.sh[0], A.sh[1] - 2.5 * s], [A.sh[0] - f * 1.5, A.sh[1] - 6 * s], 0.8, 0.3, part('bone'));
}

function drawCultist(e) {
  const P = e.pose;
  const { f, s } = P;
  const L = (a, b) => [P.hipX + P.fw[0] * a + P.up[0] * b, P.hipY + P.fw[1] * a + P.up[1] * b];
  // Feet peek out under the robe.
  for (const [G, back] of [[P.legs[1], true], [P.legs[0], false]]) {
    seg([G.ex - f * 0.8, G.ey + 1], [G.ex + f * 2.6, G.ey + 1.2], 1.1, 0.9, part('leather', back));
  }
  const sleeve = (A, back) => {
    const robe = part('robe', back);
    seg(A.sh, A.el, 1.9 * s, 2.1 * s, robe);
    seg(A.el, A.hd, 2.1 * s, 2.6 * s, robe); // flared sleeve
    const dx = A.hd[0] - A.el[0];
    const dy = A.hd[1] - A.el[1];
    const d = Math.hypot(dx, dy) || 1;
    disk(A.hd[0] + (dx / d) * 1.6, A.hd[1] + (dy / d) * 1.6, 1.2, part('bone', back)); // pale hand
  };
  sleeve(P.arms[1], true);
  // Robe: from the shoulders to a hem that follows the feet.
  const [a0, a1] = [P.legs[0], P.legs[1]];
  const [fr, bk] = f * a0.ex >= f * a1.ex ? [a0, a1] : [a1, a0];
  const robe = part('robe');
  poly([L(-3.2 * s, P.T), L(3.2 * s, P.T), [fr.ex + f * 3, fr.ey + 0.5], [bk.ex - f * 3.5, bk.ey + 0.5]], robe);
  for (let k = 0; k <= 14; k++) {
    const t = k / 14;
    const c = L(0, P.T * (0.3 + t * 0.7));
    disk(c[0], c[1], 3.2 * s, robe);
  }
  seg(L(2.2 * s, P.T - 0.5), [lerp(fr.ex, bk.ex, 0.3) + f * 1.5, fr.ey], 0.5, 0.5, part('gold')); // trim
  seg(L(-3.2 * s, 2.5 * s), L(3.2 * s, 2.5 * s), 0.7, 0.7, part('gold'));                         // sash
  // Hood with a dark face and two glowing eyes.
  const [hx, hy] = P.head;
  const r = P.B.headR * s;
  disk(hx, hy, r + 0.6, part('robe'));
  seg([hx - f * 2, hy - r], [hx - f * 4.5, hy - r - 2], 1.4, 0.5, part('robe')); // hood peak
  const face = part('pupil');
  for (let y = Math.floor(hy - 1); y <= Math.ceil(hy + 2.5); y++) {
    for (let x = Math.floor(hx - 4); x <= Math.ceil(hx + 4); x++) {
      const u = (x - hx) * f;
      if (u >= 0.4 && u <= 3.4) plot(x, y, face);
    }
  }
  const eye = part('eyecult');
  plot(hx + f * 1.8, hy + 0.2, eye);
  plot(hx + f * 3.0, hy + 0.2, eye);
  sleeve(P.arms[0], false);
}

function drawBat(e) {
  const P = e.pose;
  const { f, s } = P;
  const wing = (Wg, back) => {
    poly([Wg.sh, Wg.el, Wg.tip, Wg.fin, Wg.base], part('wing', back));
    const bone = part('batfur', back);
    seg(Wg.sh, Wg.el, 0.8, 0.6, bone);
    seg(Wg.el, Wg.tip, 0.6, 0.4, bone);
    seg(Wg.el, Wg.fin, 0.5, 0.4, bone);
  };
  wing(P.wings.back, true);
  const fur = part('batfur');
  disk(...P.P(0, 0), 3 * s, fur);
  disk(...P.P(-f * 0.5, 2.2 * s), 2.2 * s, fur);
  const [hx, hy] = P.head;
  disk(hx, hy, 2.2 * s, fur);
  seg([hx - f * 0.6, hy - 1.5], [hx - f * 1.4, hy - 4.2 * s], 0.8, 0.3, fur); // ears
  seg([hx + f * 0.8, hy - 1.5], [hx + f * 1.2, hy - 4 * s], 0.8, 0.3, fur);
  plot(hx + f * 1.2, hy - 0.3, part('eyeglow'));
  plot(hx + f * 1.8, hy + 1.2, part('bone')); // fang
  wing(P.wings.front, false);
}

// ---------------------------------------------------------------------------
// Fire: burning enemies, burn-away, shockwaves
// ---------------------------------------------------------------------------
function enemyRegion(e) {
  const b = enemyBounds(e);
  const pad = e.def.boss ? 40 : 12; // the boss's sword reaches far
  return {
    x0: Math.max(0, Math.floor(b.x0 - pad)),
    x1: Math.min(W - 1, Math.ceil(b.x1 + pad)),
    y0: Math.max(0, Math.floor(b.y0 - (e.def.boss ? 30 : 8))),
    y1: Math.min(H - 1, Math.ceil(b.y1 + 4)),
  };
}

// Dying enemies burn away from the head down; the cut line is a heat source.
function applyBurnAway() {
  for (const e of enemies) {
    if (e.cut === null) continue;
    const R = enemyRegion(e);
    const cut = lerp(R.y0, R.y1, easeInOut(e.cut));
    for (let y = R.y0; y <= R.y1; y++) {
      for (let x = R.x0; x <= R.x1; x++) {
        const i = y * W + x;
        if (!mask[i] || owner[i] !== e.rid) continue;
        if (y < cut) { mask[i] = 0; owner[i] = 0; }
        else if (y < cut + 1.2) { col[i] = GLOW32; fire[i] = MAX_HEAT; }
      }
    }
  }
}

// Burning enemies feed the fire with their own pixels; slams leave a running line of fire.
function seedEnemies() {
  for (const e of enemies) {
    if (e.burn <= 0 && e.state !== 'dying') continue;
    const heat = e.state === 'dying' ? MAX_HEAT : Math.round(22 + 14 * Math.min(1, e.burn / 2));
    const R = enemyRegion(e);
    for (let y = R.y0; y <= R.y1; y++) {
      for (let x = R.x0; x <= R.x1; x++) {
        const i = y * W + x;
        if (mask[i] && owner[i] === e.rid && fire[i] < heat && Math.random() < 0.7) fire[i] = heat;
      }
    }
  }
  seedBoss();
  for (const s of shockwaves) {
    const r = s.t * SHOCK_SPEED;
    const heat = Math.round(34 * (1 - s.t / SHOCK_LIFE));
    for (const front of [s.x - r, s.x + r]) fireDisk(front, GROUND - 1.5, 2.4, heat);
  }
}

// Shadow orbs (and the one growing in a cultist's hands) in their own FX layer.
function buildEnemyFx() {
  fxE.fill(0);
  const disk2 = (cx, cy, r, edge) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      if (y < 0 || y >= H) continue;
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || x >= W) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        const v = Math.round(lerp(MAX_HEAT, edge, d / Math.max(r, 0.01))) - ((Math.random() * 3) | 0);
        const i = y * W + x;
        if (fxE[i] < v) fxE[i] = v;
      }
    }
  };
  for (const s of eshots) {
    const dir = Math.sign(s.vx);
    for (let k = 3; k >= 1; k--) disk2(s.x - dir * k * 2.4, s.y, s.r * (1 - k * 0.22), 12);
    disk2(s.x, s.y, s.r, 20);
  }
  bossFx();
  for (const e of enemies) {
    if (e.type === 'cultist' && e.state === 'windup' && e.pose) {
      const k = clamp(e.t / e.def.ranged.windup, 0, 1);
      const [a, b] = [e.pose.arms[0].hd, e.pose.arms[1].hd];
      disk2((a[0] + b[0]) / 2 + e.facing * 2, (a[1] + b[1]) / 2, 0.6 + k * 2.2, 16);
    }
  }
}
