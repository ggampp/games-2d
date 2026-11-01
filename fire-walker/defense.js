// Fire Walker — shield and dodge roll.
//
// Shield (hold): the back arm raises the shield in front of the body, the stance
// widens and the hero moves slowly. Hits from the front are blocked (chip damage,
// a push back, sparks). Raising it right before the hit is a perfect block: no
// damage, the attacker staggers and a shadow orb flies back as a fireball.
// Hits from below or above (shockwaves, meteors, slams) can't be blocked.
//
// Roll (tap): the hero tucks into a ball and rolls ~50 px; the middle of the roll
// is invulnerable. The tucked pose is built from the same joints and rotated
// 360° around the body's center, so the whole character really spins.

'use strict';

const ROLL_DUR = 0.42;
const ROLL_SPEED = 150;
const ROLL_IFRAMES = [0, 0.32]; // invulnerable from the first frame: rolling into a hit must work
const ROLL_COOLDOWN = 0.25;
const PERFECT_WINDOW = 0.18; // seconds after raising the shield

const SHIELDS = {
  andarilho: { kind: 'buckler', chip: 0.15 },
  bruxa: { kind: 'magic', chip: 0.25 },
  paladino: { kind: 'kite', chip: 0.05 },
};

const defense = { block: false, blockT: 0, blockK: 0, rolling: false, rollT: 0, rollDir: 1, rollCd: 0, flash: 0, perfect: 0 };

const rollInvulnerable = () => defense.rolling && defense.rollT >= ROLL_IFRAMES[0] && defense.rollT <= ROLL_IFRAMES[1];

function updateDefense(dt, input) {
  defense.rollCd = Math.max(0, defense.rollCd - dt);
  defense.flash = Math.max(0, defense.flash - dt);
  defense.perfect = Math.max(0, defense.perfect - dt);
  const free = !ch.dead && dissolve.state === 'none' && ch.hurt <= 0 && spell.state === 'idle' && melee.state === 'idle';

  if (defense.rolling) {
    defense.rollT += dt;
    if (defense.rollT >= ROLL_DUR) {
      defense.rolling = false;
      defense.rollCd = ROLL_COOLDOWN;
      sfx('land', { x: ch.x, power: 0.3 });
    }
  } else if (input.roll && free && ch.onGround && defense.rollCd <= 0) {
    defense.rolling = true;
    defense.rollT = 0;
    defense.rollDir = input.dir || ch.facing;
    ch.facing = defense.rollDir;
    defense.block = false;
    sfx('roll', { x: ch.x });
    emberBurst(ch.x - defense.rollDir * 4, GROUND - 2, 5, 0.1);
  }

  const want = input.block && free && ch.onGround && !defense.rolling;
  if (want && !defense.block) {
    defense.block = true;
    defense.blockT = 0;
    sfx('raise', { x: ch.x });
  }
  if (!want) defense.block = false;
  if (defense.block) defense.blockT += dt;
  defense.blockK = approach(defense.blockK, defense.block ? 1 : 0, dt * 12);
}

// Velocity override while rolling (called from updateCharacter).
const rollVelocity = () => defense.rollDir * ROLL_SPEED * (1 - 0.55 * (defense.rollT / ROLL_DUR));

// The shield is strapped to the forearm: centered a bit past its middle.
function shieldPoint() {
  const A = pose.arms[1];
  return [lerp(A.ex, A.hx, 0.6) + pose.f * 2, lerp(A.ey, A.hy, 0.6)];
}

// Called by playerHit. Returns null if the shield didn't take the hit, otherwise
// the damage that still goes through (0 on a perfect block).
function shieldResolve(dir, dmg, kb, src) {
  if (!defense.block || defense.blockK < 0.5) return null;
  const frontal = src ? Math.sign(src.x - ch.x) === ch.facing || Math.abs(src.x - ch.x) < 3 : dir === -ch.facing;
  if (!frontal) return null;
  const [sx, sy] = shieldPoint();
  if (defense.blockT < PERFECT_WINDOW) {
    // Perfect block: nothing gets through and the attacker reels.
    sparks(sx, sy, 16);
    sfx('perfect', { x: ch.x });
    hitstop = Math.max(hitstop, 0.1);
    shake = Math.max(shake, 2);
    defense.perfect = 0.3;
    if (src && src.state !== 'dying') {
      if (src.def.boss) {
        if (!(src.poise > 0)) { src.state = 'stagger'; src.t = 0; src.poise = 4; }
      } else {
        src.hurt = 0.6;
        src.flash = 0.08;
        src.vx = ch.facing * 90 * src.def.kb;
        if (src.state === 'windup' || src.state === 'strike') { src.state = 'walk'; src.t = 0; }
        if (src.state === 'dive') { src.state = 'climb'; src.t = 0; }
        src.atkCd = 1.2;
      }
    }
    return 0;
  }
  sparks(sx, sy, 8);
  sfx('block', { x: ch.x });
  hitstop = Math.max(hitstop, 0.05);
  shake = Math.max(shake, 1.2);
  defense.flash = 0.12;
  ch.vx = -ch.facing * 60 * kb; // pushed back on the heels
  const boss = src && src.def.boss ? 2 : 1;
  return dmg * SHIELDS[cfg.hero].chip * boss;
}

// Shadow orbs stop at the shield; a perfect block sends them back as fireballs.
function shieldStopsOrb(s) {
  if (!defense.block || defense.blockK < 0.5 || Math.sign(s.vx) !== -ch.facing) return false;
  const [sx, sy] = shieldPoint();
  if (Math.abs(s.x - sx) > 3 + s.r || Math.abs(s.y - sy) > 9) return false;
  if (defense.blockT < PERFECT_WINDOW) {
    bolts.push({ x: sx + ch.facing * 3, y: s.y, y0: s.y, vx: ch.facing * 170, vy: 0, r: 2.2, age: 0, sx, sy: s.y, power: 0.45, dmgMul: 0.9 });
    sfx('perfect', { x: ch.x });
    defense.perfect = 0.3;
    hitstop = Math.max(hitstop, 0.08);
  } else {
    sfx('block', { x: ch.x });
    defense.flash = 0.12;
  }
  sparks(sx, sy, 10);
  return true;
}

// ---------------------------------------------------------------------------
// Pose: the tucked ball, rotated around the body's center during a roll
// ---------------------------------------------------------------------------
function applyRollPose(P) {
  const p = clamp(defense.rollT / ROLL_DUR, 0, 1);
  // Tuck in during the first 15%, open up in the last 15%.
  const w = p < 0.15 ? easeInOut(p / 0.15) : p > 0.85 ? easeInOut((1 - p) / 0.15) : 1;
  const f = P.f;
  const ang = f * Math.PI * 2 * easeInOut(p);
  const cx = ch.x;
  const cy = FEET_Y - 7;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  // Local coordinates: u = forward, v = down, around the pivot.
  const T = (u, v) => {
    const x = f * u;
    return [cx + x * c - v * s, cy + x * s + v * c];
  };
  const mix = (ox, oy, [tx, ty]) => [lerp(ox, tx, w), lerp(oy, ty, w)];
  [P.hipX, P.hipY] = mix(P.hipX, P.hipY, T(-2.5, 2.5));
  [P.neckX, P.neckY] = mix(P.neckX, P.neckY, T(2.5, -3));
  [P.headX, P.headY] = mix(P.headX, P.headY, T(4.8, -0.2));
  P.legs.forEach((L, k) => {
    const o = k ? 0.9 : 0;
    [L.jx, L.jy] = mix(L.jx, L.jy, T(4 - o, 2.8));
    [L.ex, L.ey] = mix(L.ex, L.ey, T(0.5 - o, 6));
    L.tx = L.ex;
    L.ty = L.ey;
  });
  P.arms.forEach((A, k) => {
    const o = k ? 0.9 : 0;
    [A.sx, A.sy] = mix(A.sx, A.sy, T(1.8, -2));
    [A.ex, A.ey] = mix(A.ex, A.ey, T(4.5 - o, 0.8));
    [A.hx, A.hy] = mix(A.hx, A.hy, T(4 - o, 4.2));
  });
  // Rebuild the torso frame from the moved hip and neck.
  const dx = P.neckX - P.hipX;
  const dy = P.neckY - P.hipY;
  const d = Math.hypot(dx, dy) || 1;
  P.up = [dx / d, dy / d];
  P.fw = [f * -P.up[1], f * P.up[0]];
  P.hand = [P.arms[0].hx, P.arms[0].hy];
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function ellipse(cx, cy, rx, ry, p) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x - cx) / rx;
      const v = (y - cy) / ry;
      if (u * u + v * v <= 1) plot(x, y, p);
    }
  }
}

// Physical shields are drawn last, in front of the hero (heroes.js calls this).
function drawShield() {
  if (defense.blockK < 0.35 || defense.rolling || !pose) return;
  const kind = SHIELDS[cfg.hero].kind;
  const [cx, cy] = shieldPoint();
  const f = pose.f;
  if (kind === 'buckler') {
    // Round wooden buckler seen at three quarters: iron rim, planks, a boss in front.
    ellipse(cx, cy, 3.6, 5.0, part('iron'));
    ellipse(cx + f * 0.3, cy, 2.7, 4.0, part('wood'));
    disk(cx + f * 0.9, cy, 1.2, part('metal'));
  } else if (kind === 'kite') {
    // The Paladino's kite shield, taken off his back.
    const S = (a, b) => [cx + f * a, cy + b];
    poly([S(-2.6, -7.5), S(3.4, -7.5), S(4, -2), S(0.4, 8.5), S(-3.2, -2)], part('steel'));
    seg(S(0.4, -6.5), S(0.4, 6.5), 0.6, 0.5, part('gold'));
    seg(S(-2.2, -3), S(3.2, -3), 0.6, 0.6, part('gold'));
  }
}

// The Bruxa's barrier is light, not metal: a bright arc in the FX layer plus heat.
function magicArc(fn) {
  if (cfg.hero !== 'bruxa' || defense.blockK < 0.35 || defense.rolling || !pose) return;
  const [cx, cy] = shieldPoint();
  const f = pose.f;
  const ry = 10;
  for (let v = -ry; v <= ry; v += 0.7) {
    const bulge = 2.4 * (1 - (v / ry) ** 2);
    fn(cx + f * (1 + bulge), cy + v, Math.abs(v) / ry);
  }
}

function shieldFx() {
  magicArc((x, y, edge) => fxDisk(x, y, 0.7 + (defense.flash > 0 ? 0.5 : 0), Math.round(30 - edge * 12)));
  if (defense.perfect > 0 && pose) {
    // A ring of light on a perfect block.
    const [cx, cy] = shieldPoint();
    const r = 3 + (0.3 - defense.perfect) * 40;
    for (let a = 0; a < Math.PI * 2; a += 0.25) fxDisk(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.8, 24);
  }
}

function seedShield() {
  magicArc((x, y) => fireDisk(x, y, 1, 18));
}
