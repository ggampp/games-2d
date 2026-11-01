// Fire Walker — input, autopilot, UI and the main loop.

'use strict';

// ---------------------------------------------------------------------------
// Input: keyboard and touch buttons
// ---------------------------------------------------------------------------
const keys = new Set();
let jumpPressed = false;
let swordPressed = false;
let rollPressed = false;
const HERO_KEYS = { Digit1: 'andarilho', Digit2: 'bruxa', Digit3: 'paladino' };
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyQ', 'KeyJ', 'KeyX', 'KeyL', 'KeyC']);

function takeControl() {
  if (!cfg.auto) return;
  cfg.auto = false;
  ui.auto.checked = false;
  // Drop a spell the autopilot was charging so the player's first command goes through.
  ai.casting = 0;
  if (spell.state === 'charge') spell.state = 'idle';
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement || (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox')) return;
  if (MOVE_KEYS.has(e.code)) { e.preventDefault(); takeControl(); }
  keys.add(e.code);
  if (!e.repeat && (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space')) jumpPressed = true;
  if (!e.repeat && (e.code === 'KeyJ' || e.code === 'KeyX')) swordPressed = true;
  if (!e.repeat && e.code === 'KeyC') rollPressed = true;
  if (!e.repeat && e.code === 'KeyE') startDissolve();
  if (!e.repeat && e.code === 'KeyK') { cfg.skeleton = !cfg.skeleton; ui.skeleton.checked = cfg.skeleton; }
  if (!e.repeat && HERO_KEYS[e.code]) { ui.hero.value = HERO_KEYS[e.code]; applyHero(); }
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
    if (code === 'Sword') swordPressed = true;
    if (code === 'Roll') rollPressed = true;
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
    crouch: keys.has('ArrowDown') || keys.has('KeyS') || keys.has('Crouch'),
    jump: jumpPressed,
    cast: keys.has('KeyF') || keys.has('KeyQ') || keys.has('Cast'),
    sword: swordPressed,
    block: keys.has('KeyL') || keys.has('Block'),
    roll: rollPressed,
  };
  jumpPressed = false;
  swordPressed = false;
  rollPressed = false;
  return input;
}

// ---------------------------------------------------------------------------
// Autopilot: explores, fights, dodges
// ---------------------------------------------------------------------------
const ai = { target: null, wait: 0.4, run: false, crouch: false, jumpCd: 2.5, disCd: 12, spellCd: 0, casting: 0 };

function autopilotInput(dt) {
  ai.jumpCd -= dt;
  ai.disCd -= dt;
  ai.spellCd -= dt;
  const idle = { dir: 0, run: false, crouch: ai.crouch, jump: false, cast: false };
  if (ai.casting > 0) { ai.casting -= dt; return { ...idle, crouch: false, cast: true }; }
  if (ch.dead || dissolve.state !== 'none' || spell.state !== 'idle' || ch.hurt > 0) return idle;

  if (defense.rolling) return idle;
  // Dodge: block or duck shadow orbs, roll through (or jump) shockwaves.
  for (const s of eshots) {
    const ahead = (ch.x - s.x) * Math.sign(s.vx);
    if (ahead > 0 && ahead < 34) {
      // Face the orb and raise the shield just before it arrives (a perfect block sends it back).
      if (ahead < 16 && !defense.block) { ch.facing = -Math.sign(s.vx); return { ...idle, crouch: false, block: true }; }
      if (defense.block) return { ...idle, crouch: false, block: true };
      return { ...idle, crouch: true };
    }
  }
  for (const w of shockwaves) {
    const gap = Math.abs(ch.x - w.x) - w.t * SHOCK_SPEED;
    if (gap > 0 && gap < 24 && ch.onGround) {
      if (defense.rollCd <= 0 && gap > 8) return { ...idle, roll: true, dir: Math.sign(w.x - ch.x) || ch.facing }; // through it
      return { ...idle, jump: true };
    }
  }
  // Step away from the glowing meteor markers.
  for (const m of meteors) {
    if (m.t > -0.3 && Math.abs(ch.x - m.x) < 13) {
      const away = ch.x < m.x ? -1 : 1;
      const blocked = (away < 0 && ch.x < ARENA_X0 + 16) || (away > 0 && ch.x > W - 16);
      const dir = blocked ? -away : away;
      if (m.t > m.warn - 0.25 && defense.rollCd <= 0) return { ...idle, crouch: false, roll: true, dir }; // roll out at the last moment
      return { ...idle, crouch: false, dir, run: true };
    }
  }
  // The boss's sword swing: raise the shield right before it lands (a perfect block staggers him).
  const bossE = BOSS.active;
  if (bossE && bossE.state === 'sweepWind' && Math.abs(bossE.x - ch.x) < 52 && ch.onGround) {
    const windup = 0.7 * (bossRage(bossE) ? 0.7 : 1);
    if (bossE.t > windup - 0.15 || defense.block) { ch.facing = Math.sign(bossE.x - ch.x) || ch.facing; return { ...idle, crouch: false, block: true }; }
  }

  // Fight the nearest enemy that is on or near the screen.
  let foe = null;
  for (const e of enemies) {
    if (e.state === 'dying' || Math.abs(e.x - ch.x) > 150) continue;
    const score = Math.abs(e.x - ch.x) + (e.def.fly && e.state !== 'dive' ? 40 : 0);
    if (!foe || score < foe.score) foe = { e, score };
  }
  if (foe) {
    const e = foe.e;
    const d = e.x - ch.x;
    const dist = Math.abs(d);
    const low = ch.hp < 35;
    const cornered = (d > 0 && ch.x < 24) || (d < 0 && ch.x > W - 24);
    if (e.def.fly && e.state !== 'dive' && e.y < ch.y - 40) {
      // A bat out of reach: jump and throw a quick spell in the air.
      if (dist < 45 && ai.spellCd < 0 && ch.onGround) {
        ch.facing = Math.sign(d) || ch.facing;
        ai.casting = 0.12;
        ai.spellCd = 0.7;
        return { ...idle, crouch: false, jump: true, cast: true };
      }
    } else {
      // Raise the shield right before a frontal melee hit lands (a perfect block staggers them).
      const windup = e.def.melee && e.state === 'windup' && !e.def.melee.slam ? e.def.melee.windup
        : e.type === 'boss' && e.state === 'sweepWind' ? 0.7 * (bossRage(e) ? 0.7 : 1) : 0;
      if (windup && dist < 52 && e.t > windup - 0.15) {
        ch.facing = Math.sign(d) || ch.facing;
        return { ...idle, crouch: false, block: true };
      }
      // Don't start a spell or a swing into a wind-up: wait for the moment to raise the shield.
      if (windup && dist < 52) { ch.facing = Math.sign(d) || ch.facing; return { ...idle, crouch: false }; }
      // Cornered: roll through the enemy instead of being pinned.
      if (cornered && dist < 24 && defense.rollCd <= 0 && e.type !== 'boss') return { ...idle, crouch: false, roll: true, dir: Math.sign(d) };
      // Up close against something small: use the sword (keeps pressing to chain the combo).
      const small = e.type === 'ghoul' || e.type === 'cultist' || (e.def.fly && e.y > ch.y - 34);
      if (small && dist < 20 + weapon().len * 0.6 && !low) {
        ch.facing = Math.sign(d) || ch.facing;
        return { ...idle, crouch: false, sword: true };
      }
      if (dist < 22 + (low ? 12 : 0)) {
        if (ai.disCd < 0 && (cornered || low || Math.random() < dt * 3)) { startDissolve(); ai.disCd = 5 + Math.random() * 3; return idle; }
        if (!cornered) return { dir: -Math.sign(d), run: true, crouch: false, jump: false, cast: false };
      }
      if (ai.spellCd < 0) {
        ch.facing = Math.sign(d) || ch.facing;
        const heavy = e.type === 'boss' ? 0.8 : e.type === 'brute' ? 0.4 : 0;
        ai.casting = clamp(dist / 150 + heavy, 0.15, 0.95) + Math.random() * 0.15; // farther / tougher = more charge
        ai.spellCd = 0.4 + Math.random() * 0.5;
        return { ...idle, crouch: false, cast: true };
      }
      const keep = (e.type === 'boss' ? 75 : e.type === 'brute' ? 60 : 45) + (low ? 20 : 0);
      if (dist < keep && !cornered) return { dir: -Math.sign(d), run: false, crouch: false, jump: false, cast: false };
      if (e.type === 'cultist' && dist > 110) return { dir: Math.sign(d), run: false, crouch: false, jump: false, cast: false };
    }
    ch.facing = Math.sign(d) || ch.facing;
    return { ...idle, crouch: false };
  }

  if (ai.wait > 0) {
    ai.wait -= dt;
    // Training: turn to the dummy and throw a spell, holding it a random time.
    if (cfg.enemies === 'off' && ai.spellCd < 0 && Math.abs(dummy.x - ch.x) > 28 && Math.abs(dummy.x - ch.x) < 150) {
      ch.facing = Math.sign(dummy.x - ch.x);
      ai.casting = 0.25 + Math.random() * 0.9;
      ai.spellCd = 2.5 + Math.random() * 3;
      ai.crouch = false;
      return { ...idle, cast: true };
    }
    return idle;
  }
  if (ai.target === null) {
    // Explore: walk somewhere within a screen or so.
    ai.target = clamp(ch.x + (Math.random() * 2 - 1) * 140, 20, W - 20);
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
  hero: document.getElementById('hero'),
  hud: document.getElementById('hud'),
  sound: document.getElementById('sound'),
  musicVol: document.getElementById('musicVol'),
  sfxVol: document.getElementById('sfxVol'),
  soundOn: document.getElementById('soundOn'),
  banner: document.getElementById('banner'),
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
// Switching character also switches to that character's palette.
function applyHero() {
  selectHero(ui.hero.value);
  cfg.palette = heroDef().palette;
  ui.palette.value = cfg.palette;
}
ui.hero.addEventListener('change', applyHero);

// Sound: browsers need a click or key press before any audio can play.
ui.sound.addEventListener('change', () => {
  audio.enabled = ui.sound.checked;
  if (audio.enabled) audioStart();
  applyVolumes();
});
ui.musicVol.addEventListener('input', () => { audio.musicVol = +ui.musicVol.value / 10; applyVolumes(); });
ui.sfxVol.addEventListener('input', () => { audio.sfxVol = +ui.sfxVol.value / 10; applyVolumes(); });
ui.soundOn.addEventListener('click', () => {
  audio.enabled = true;
  ui.sound.checked = true;
  audioStart();
  applyVolumes();
});
ui.enemies.addEventListener('change', () => {
  cfg.enemies = ui.enemies.value;
  if (cfg.enemies === 'off') { enemies.length = 0; eshots.length = 0; shockwaves.length = 0; meteors.length = 0; BOSS.locked = false; BOSS.active = null; }
  spawnTimer = 0.8;
});

let hudText = '';
let bannerShown = '';
function updateHud() {
  const zone = zoneAt(ch.x).name;
  const t = cfg.enemies === 'off'
    ? `${zone} · Boneco atingido: ${dummy.hits}`
    : `${heroDef().name} · ${BOSS.locked ? 'Arena do Guardião' : zone} · Onda ${stats.wave} · Queimados: ${stats.kills} · Quedas: ${stats.deaths}${BOSS.kills ? ` · Guardião: ${BOSS.kills}` : ''}`;
  if (t !== hudText) { hudText = t; ui.hud.textContent = t; }
  ui.soundOn.hidden = audio.started && audio.enabled;
  const b = banner.t > 0 ? banner.text : '';
  if (b !== bannerShown) {
    bannerShown = b;
    ui.banner.textContent = b;
    ui.banner.classList.toggle('show', !!b);
  }
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
  updateDefense(DT, input);
  updateCharacter(DT, input);
  updateSpell(DT, input.cast);
  updateMelee(DT, input.sword);
  updateDissolve(DT);
  computePose(simTime);
  updateSecondary(simTime, DT);
  if (melee.active) sweepBlade();
  updateCamera(DT);
  updateProjectiles(DT);
  updateHeroWaves(DT);
  updateEnemies(DT);
  rasterize();
  buildFx();
  buildEnemyFx();
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
  audioUpdate(Math.min(0.1, DT * 2));
}

new ResizeObserver(() => { fitCanvas(); if (pose) draw(); }).observe(canvas);
fitCanvas();
syncLabels();
updateCamera(0, true);
// Warm up so the first frame already shows flames.
for (let i = 0; i < 90; i++) tick();
requestAnimationFrame((t) => { last = t; frame(t); });
