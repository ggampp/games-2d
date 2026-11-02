// Fire Walker — the boss: "O Guardião do Portão".
//
// A giant armored knight waits at the end of the gate. Walking into the arena locks
// the camera, pauses regular spawns and starts the fight. He uses the same skeleton,
// IK, shading and burning pipeline as every enemy, with his own attacks:
//   sweep — a huge sword swing (jump over it);
//   slam  — both fists into the floor, a big shockwave of fire (jump over it);
//   rain  — sword raised, meteors fall where the ground markers glow (move away).
// Below half health he enrages: faster, shorter wind-ups, and his sword burns.
// He only staggers on charged hits (then has 4 s of poise). On death he kneels and slowly burns to ash.

'use strict';

ENEMY_TYPES.boss = {
  hp: 1400, speed: [15, 15], scale: [1, 1], kb: 0.08, burnDps: 6, panic: false,
  halfW: 12, minWave: 999, weight: 0, jut: 0.6, boss: true,
  body: { thigh: 15, shin: 14, torso: 22, headR: 5.5, upperArm: 14, foreArm: 13, hunch: 0.15 },
};

const BOSS = { triggerX: 660, cooldown: 0, active: null, locked: false, kills: 0, name: 'O GUARDIAO DO PORTAO' };
const ARENA_X0 = W - VIEW_W;
const meteors = [];

function updateBossArena(dt) {
  BOSS.cooldown -= dt;
  if (!BOSS.active && BOSS.cooldown <= 0 && cfg.enemies !== 'off' && !ch.dead && ch.x > BOSS.triggerX) startBoss();
  if (BOSS.active && (BOSS.active.gone || !enemies.includes(BOSS.active))) {
    BOSS.active = null;
    BOSS.locked = false;
    BOSS.cooldown = 40; // he comes back if you return later
  }
  for (const m of meteors) updateMeteor(m, dt);
  for (let i = meteors.length - 1; i >= 0; i--) if (meteors[i].dead) meteors.splice(i, 1);
}

function startBoss() {
  const e = makeEnemy('boss', W - 34, -1);
  e.state = 'intro';
  e.entered = true;
  e.atkCd = 0.8;
  enemies.push(e);
  BOSS.active = e;
  BOSS.locked = true;
  showBanner('O Guardião do Portão');
  shake = Math.max(shake, 3);
  sfx('bossintro', { x: e.x });
}

function bossRage(e) {
  return e.hp < e.maxHp * 0.5;
}

function updateBoss(e, dt) {
  const toP = ch.x - e.x;
  const dist = Math.abs(toP);
  const hero = heroTargetable();
  const rage = bossRage(e);
  const k = rage ? 0.7 : 1; // wind-up multiplier
  e.poise = Math.max(0, (e.poise || 0) - dt);
  if (rage && !e.raged) {
    e.raged = true;
    showBanner('Fúria!');
    shake = Math.max(shake, 3);
    sfx('rage', { x: e.x });
    emberBurst(e.x, e.y - 40, 24, 0.8);
  }
  let target = 0;

  if (e.state === 'dying') {
    // A long fall to the knees, then a slow burn from the helm down.
    e.kneel = Math.min(1, e.kneel + dt * 1.2);
    e.burn = Math.max(e.burn, 0.5);
    e.char = Math.min(1, e.char + dt * 0.35);
    if (Math.random() < dt * 8) emberBurst(e.x + (Math.random() - 0.5) * 24, e.y - Math.random() * 60, 3, 0.5);
    shake = Math.max(shake, 1.2);
    if (e.t > 1.0) {
      e.cut = clamp((e.t - 1.0) / 2.6, 0, 1);
      if (e.cut >= 1) {
        e.gone = true;
        scorches.push({ x: e.x, t: 0, r: 22 });
        emberBurst(e.x, e.y - 6, 40, 1);
      }
    }
  } else {
    if (e.burn > 0) {
      e.burn -= dt;
      damageEnemy(e, e.def.burnDps * dt);
      e.char = Math.min(0.6, e.char + dt * 0.05);
    }
    e.facing = e.state === 'sweep' || e.state === 'slam' ? e.facing : Math.sign(toP) || e.facing;
    switch (e.state) {
      case 'intro':
        if (e.t > 1.6) { e.state = 'walk'; e.t = 0; }
        break;
      case 'walk': {
        if (hero && e.atkCd <= 0) {
          const r = Math.random();
          if (dist < 42) e.state = r < 0.65 ? 'sweepWind' : 'slamWind';
          else if (dist < 120) e.state = r < 0.4 ? 'rainWind' : r < 0.75 ? 'slamWind' : 'walk';
          else e.state = 'rainWind';
          e.t = 0;
          if (e.state === 'walk') e.atkCd = 0.6;
        }
        if (e.state === 'walk' && dist > 30) target = Math.sign(toP) * e.speed * (rage ? 1.45 : 1);
        break;
      }
      case 'sweepWind':
        if (e.t > 0.7 * k) {
          e.state = 'sweep'; e.t = 0;
          const inFront = Math.sign(toP) === e.facing || dist < 14;
          if (hero && inFront && dist < 48 && ch.y > FEET_Y - 22) playerHit(e.facing, rage ? 24 : 18, 1.4, e);
          shake = Math.max(shake, 2);
          sfx('sweep', { x: e.x });
        }
        break;
      case 'slamWind':
        if (e.t > 0.9 * k) {
          e.state = 'slam'; e.t = 0;
          const x = e.x + e.facing * 20;
          shockwaves.push({ x, t: 0, hit: false, dmg: rage ? 22 : 18 });
          sfx('slam', { x, big: true });
          shake = Math.max(shake, 4.5);
          emberBurst(x, GROUND - 2, 24, 0.8);
          if (hero && Math.abs(ch.x - x) < 16 && ch.y > FEET_Y - 6) playerHit(Math.sign(ch.x - e.x) || e.facing, rage ? 22 : 18, 1.3, e, true);
        }
        break;
      case 'rainWind':
        if (e.t > 1.0 * k) {
          e.state = 'rain'; e.t = 0;
          sfx('rainwind', { x: e.x });
          const n = rage ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const tx = clamp(ch.x + (i === 0 ? 0 : (Math.random() - 0.5) * 90), ARENA_X0 + 8, W - 8);
            meteors.push({ x: tx, y: -8, t: -i * 0.22, warn: 0.7, dmg: rage ? 16 : 12, dead: false });
          }
        }
        break;
      case 'sweep':
        if (e.t > 0.35) { e.state = 'recover'; e.t = 0; }
        break;
      case 'slam':
        if (e.t > 0.5) { e.state = 'recover'; e.t = 0; }
        break;
      case 'rain':
        if (e.t > 1.0) { e.state = 'recover'; e.t = 0; }
        break;
      case 'recover':
        if (e.t > 0.5 * k) { e.state = 'walk'; e.t = 0; e.atkCd = 0.8 * k + Math.random() * 0.6; }
        break;
      case 'stagger':
        if (e.t > 0.8) { e.state = 'walk'; e.t = 0; e.atkCd = 0.4; }
        break;
      default:
        e.state = 'walk';
    }
    if (e.hp <= 0) killEnemy(e);
    if (cfg.effect === 'aura' && dissolve.state === 'none' && !ch.dead && dist < 22) ignite(e, 1.5);
  }

  e.vx = approach(e.vx, target, 120 * dt);
  e.vy += GRAVITY * dt;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (e.y >= FEET_Y) { e.y = FEET_Y; e.vy = 0; e.onGround = true; }
  e.x = clamp(e.x, ARENA_X0 + 14, W - 14);
  const speed = Math.abs(e.vx);
  e.phase += ((Math.PI * speed) / ((5 + speed * 0.08) * 1.6)) * dt;
  computeWalkerPose(e, dt);
}

// Arm targets for the boss's states: [front (sword) arm, back arm].
function bossArmTargets(e, a) {
  switch (e.state) {
    case 'intro': return { ua: [2.6, 2.4], fa: [2.9, 2.7], lean: -0.1 };
    case 'sweepWind': return { ua: [3.5, 0.9], fa: [3.9, 1.3], lean: -0.15 };
    case 'sweep': return { ua: [1.35, -0.4], fa: [1.5, -0.2], lean: 0.45, fast: true };
    case 'slamWind': return { ua: [3.0, 2.9], fa: [3.3, 3.2], lean: -0.1 };
    case 'slam': return { ua: [1.0, 0.9], fa: [0.5, 0.4], lean: 0.7, fast: true };
    case 'rainWind':
    case 'rain': return { ua: [3.1, 0.5], fa: [3.15, 0.7], lean: -0.05 };
    case 'stagger': return { ua: [-0.6, -0.9], fa: [-1.0, -1.4], lean: -0.5 };
    default: return { ua: [0.65 + Math.sin(e.phase) * 0.15 * a, 0.3 - Math.sin(e.phase) * 0.25 * a], fa: [1.3, 0.6], lean: null };
  }
}

// Sword: from the front fist along the forearm.
function bossSword(e) {
  const A = e.pose.arms[0];
  const dx = A.hd[0] - A.el[0];
  const dy = A.hd[1] - A.el[1];
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  return { hand: A.hd, ux, uy, tip: [A.hd[0] + ux * 30, A.hd[1] + uy * 30] };
}

function drawBoss(e) {
  const P = e.pose;
  const { f } = P;
  const L = (a, b) => [P.hipX + P.fw[0] * a + P.up[0] * b, P.hipY + P.fw[1] * a + P.up[1] * b];
  // Tattered cape behind.
  poly([L(-6, P.T - 1), L(-2, P.T + 1), L(-4, -18), L(-9, -14), L(-12, -19)], part('cape', true));
  // Back arm.
  const arm = (A, back) => {
    seg(A.sh, A.el, 4.2, 3.6, part('bossplate', back));
    seg(A.el, A.hd, 3.6, 3.2, part('bossplate', back));
    disk(A.hd[0], A.hd[1], 3.4, part('iron', back));
  };
  arm(P.arms[1], true);
  // Legs: heavy greaves.
  for (const [G, back] of [[P.legs[1], true], [P.legs[0], false]]) {
    const knee = [G.jx, G.jy];
    const ankle = [G.ex, G.ey];
    seg([P.hipX, P.hipY], knee, 5.2, 4.4, part('bossplate', back));
    seg(knee, ankle, 4.4, 3.6, part('bossplate', back));
    disk(knee[0] + f * 1.2, knee[1], 3.4, part('iron', back));
    seg([ankle[0] - f * 2.5, ankle[1] + 1.2], [ankle[0] + f * 6, ankle[1] + 1.6], 2.6, 2.0, part('iron', back));
  }
  // Torso: massive breastplate with a glowing core.
  const torso = part('bossplate');
  for (let k = 0; k <= 26; k++) {
    const t = k / 26;
    const r = t < 0.65 ? lerp(6.5, 9.2, t / 0.65) : lerp(9.2, 6.5, (t - 0.65) / 0.35);
    const c = L(0.8 * Math.sin(Math.PI * t), P.T * t);
    disk(c[0], c[1], r, torso);
  }
  poly([L(-7, 3), L(7.5, 3), L(6, -9), L(0, -7), L(-6, -10)], part('iron')); // faulds
  seg(L(-8.4, 3.2), L(8.6, 3.2), 1.6, 1.6, part('leather'));
  disk(...L(3, P.T * 0.6), 2.2, part(bossRage(e) ? 'bossglow' : 'eyeglow')); // core
  // Head: horned great helm, glowing visor.
  const [hx, hy] = P.head;
  const r = P.B.headR;
  disk(hx, hy, r, part('bossplate'));
  const horn = part('bone');
  seg([hx - f * 2, hy - r * 0.5], [hx - f * 8, hy - r - 6], 1.6, 0.5, horn);
  seg([hx + f * 2, hy - r * 0.6], [hx + f * 5, hy - r - 7], 1.6, 0.5, horn);
  const visor = part(bossRage(e) ? 'bossglow' : 'eyeglow');
  for (let k = 0; k <= 3; k++) plot(hx + f * (1.5 + k), hy - 0.4, visor);
  // Front arm with pauldron, and the greatsword.
  arm(P.arms[0], false);
  const A = P.arms[0];
  disk(A.sh[0], A.sh[1] - 1, 5.2, part('iron'));
  seg([A.sh[0], A.sh[1] - 4], [A.sh[0] - f * 2, A.sh[1] - 9], 1.2, 0.4, part('bone'));
  const S = bossSword(e);
  const nx = -S.uy;
  const ny = S.ux;
  seg([S.hand[0] - S.ux * 4, S.hand[1] - S.uy * 4], S.hand, 0.9, 0.9, part('leather'));                    // grip
  disk(S.hand[0] - S.ux * 4.5, S.hand[1] - S.uy * 4.5, 1.4, part('gold'));                                    // pommel
  seg([S.hand[0] + nx * 4.5, S.hand[1] + ny * 4.5], [S.hand[0] - nx * 4.5, S.hand[1] - ny * 4.5], 1.1, 1.1, part('gold')); // guard
  seg([S.hand[0] + S.ux * 1.5, S.hand[1] + S.uy * 1.5], S.tip, 2.0, 0.8, part('blade'));
}

// Meteors: a glowing marker on the floor, then a falling burning rock.
function updateMeteor(m, dt) {
  const wasWarning = m.t < m.warn;
  m.t += dt;
  if (m.t < m.warn) return;
  if (wasWarning) sfx('meteor', { x: m.x });
  m.y += 260 * dt;
  if (m.y >= GROUND - 3) {
    m.dead = true;
    blasts.push({ x: m.x, y: GROUND - 3, t: 0, R: 12 });
    sfx('explode', { x: m.x, power: 0.6 });
    emberBurst(m.x, GROUND - 3, 10, 0.5);
    shake = Math.max(shake, 2);
    if (heroTargetable() && Math.abs(ch.x - m.x) < 11 && ch.y > FEET_Y - 20) playerHit(Math.sign(ch.x - m.x) || 1, m.dmg, 1, null, true);
  }
}

// Heat sources: falling meteors, the sword's arc during a sweep, and the burning blade in rage.
function seedBoss() {
  for (const m of meteors) if (m.t >= m.warn) fireDisk(m.x, m.y, 3, MAX_HEAT);
  const e = BOSS.active;
  if (!e || !e.pose || e.state === 'dying') return;
  if (e.state === 'sweep' || bossRage(e)) {
    const S = bossSword(e);
    const heat = e.state === 'sweep' ? MAX_HEAT : 28;
    for (let k = 4; k <= 30; k += 2) fireDisk(S.hand[0] + S.ux * k, S.hand[1] + S.uy * k, e.state === 'sweep' ? 1.8 : 1.1, heat);
  }
}

function bossFx() {
  for (const m of meteors) {
    if (m.t < 0) continue;
    if (m.t < m.warn) {
      // Pulsing marker on the floor where it will land.
      const pulse = 0.5 + 0.5 * Math.sin(m.t * 30);
      for (let dx = -6; dx <= 6; dx++) {
        const x = Math.round(m.x + dx);
        if (x < 0 || x >= W) continue;
        const v = Math.round(lerp(14, 30, pulse) - Math.abs(dx) * 1.2);
        const i = (GROUND - 1) * W + x;
        if (fxE[i] < v) fxE[i] = v;
      }
    } else {
      for (let k = 3; k >= 0; k--) {
        const r = 3.2 - k * 0.6;
        for (let y = Math.floor(m.y - k * 3 - r); y <= Math.ceil(m.y - k * 3 + r); y++) {
          for (let x = Math.floor(m.x - r); x <= Math.ceil(m.x + r); x++) {
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            if ((x - m.x) ** 2 + (y - (m.y - k * 3)) ** 2 > r * r) continue;
            const i = y * W + x;
            const v = 34 - k * 4;
            if (fxE[i] < v) fxE[i] = v;
          }
        }
      }
    }
  }
}
