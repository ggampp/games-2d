// Fire Walker — procedural audio (Web Audio API, no sound files).
//
// Sound effects are synthesized on demand from oscillators and filtered noise,
// panned by where they happen on screen. The music is a small step sequencer
// that composes as it plays: a dark ambient loop in D minor while exploring, a
// driving track in the boss arena (faster when he enrages) and a short fanfare
// on victory. Browsers only allow audio after a click or key press, so nothing
// plays until then.
//
// The game calls sfx(name, options) at its events; audioUpdate() runs every frame
// for the continuous sounds (spell charge, footsteps, fire crackle, music mode).

'use strict';

const audio = {
  ctx: null, master: null, music: null, musicLP: null, sfx: null, revIn: null, noiseBuf: null,
  enabled: true, musicVol: 0.6, sfxVol: 0.8, started: false,
  last: {}, charge: null, stepIdx: 0, mode: 'explore',
  seq: { next: 0, step: 0, bar: 0, timer: null },
};

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function audioStart() {
  if (!audio.enabled) return;
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  audio.ctx = ctx;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  comp.connect(ctx.destination);
  audio.master = ctx.createGain();
  audio.master.gain.value = 0.9;
  audio.master.connect(comp);

  // A generated reverb: stereo noise with a fast exponential decay.
  const rev = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.6);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  rev.buffer = ir;
  audio.revIn = ctx.createGain();
  audio.revIn.connect(rev);
  const revOut = ctx.createGain();
  revOut.gain.value = 0.55;
  rev.connect(revOut);
  revOut.connect(audio.master);

  // Music bus (with a low-pass used to muffle it when the hero falls) and SFX bus.
  audio.musicLP = ctx.createBiquadFilter();
  audio.musicLP.type = 'lowpass';
  audio.musicLP.frequency.value = 18000;
  audio.musicLP.connect(audio.master);
  audio.music = ctx.createGain();
  audio.music.connect(audio.musicLP);
  const mSend = ctx.createGain();
  mSend.gain.value = 0.45;
  audio.music.connect(mSend);
  mSend.connect(audio.revIn);
  audio.sfx = ctx.createGain();
  audio.sfx.connect(audio.master);
  const sSend = ctx.createGain();
  sSend.gain.value = 0.12;
  audio.sfx.connect(sSend);
  sSend.connect(audio.revIn);
  applyVolumes();

  audio.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = audio.noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  audio.seq.next = ctx.currentTime + 0.1;
  audio.seq.timer = setInterval(musicTick, 25);
  audio.started = true;
}

function applyVolumes() {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  audio.master.gain.setTargetAtTime(audio.enabled ? 0.9 : 0, t, 0.05);
  audio.music.gain.setTargetAtTime(audio.musicVol * 0.55, t, 0.05);
  audio.sfx.gain.setTargetAtTime(audio.sfxVol, t, 0.05);
}

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------
// An output for one effect: panned by its x on screen, quieter when off-screen.
function out(x, rev = 0) {
  const ctx = audio.ctx;
  const g = ctx.createGain();
  let pan = 0;
  let att = 1;
  if (x !== undefined) {
    const dx = x - (cam.x + VIEW_W / 2);
    pan = clamp(dx / (VIEW_W * 0.6), -1, 1);
    att = clamp(1 - (Math.abs(dx) - VIEW_W * 0.6) / 220, 0.12, 1);
  }
  g.gain.value = att;
  let node = g;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    node = p;
  }
  node.connect(audio.sfx);
  if (rev > 0) {
    const s = ctx.createGain();
    s.gain.value = rev;
    node.connect(s);
    s.connect(audio.revIn);
  }
  return g;
}

function envelope(g, t, a, vol, dur, hold = 0) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
  if (hold) g.gain.setValueAtTime(Math.max(0.0002, vol), t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

// Oscillator with pitch sweep, optional vibrato and filter.
function tone(dest, o) {
  const ctx = audio.ctx;
  const t = o.t ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  let node = osc;
  if (o.vib) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = o.vibRate || 28;
    lg.gain.value = o.vib;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + o.dur + 0.1);
  }
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = o.ft || 'lowpass';
    f.frequency.value = o.lp;
    f.Q.value = o.q || 0.7;
    node.connect(f);
    node = f;
  }
  const g = ctx.createGain();
  envelope(g, t, o.a ?? 0.005, o.vol, o.dur, o.hold);
  node.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

// Filtered noise burst with a filter sweep.
function noise(dest, o) {
  const ctx = audio.ctx;
  const t = o.t ?? ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = audio.noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.ft || 'lowpass';
  f.Q.value = o.q || 0.8;
  f.frequency.setValueAtTime(o.f0, t);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  const g = ctx.createGain();
  envelope(g, t, o.a ?? 0.004, o.vol, o.dur, o.hold);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(t, Math.random() * 1.5);
  src.stop(t + o.dur + 0.05);
}

const growl = (d, f0, f1, dur, vol, lp = 900, t) => tone(d, { type: 'sawtooth', f0, f1, dur, vol, lp, q: 3, vib: f0 * 0.12, vibRate: 32, a: 0.02, t });
const thud = (d, vol, f0 = 150, t) => { tone(d, { f0, f1: 45, dur: 0.16, vol, t }); noise(d, { f0: 1400, f1: 200, dur: 0.1, vol: vol * 0.7, t }); };
const gong = (d, base, dur, vol, t) => [1, 1.42, 2.03, 2.7, 3.9].forEach((m, i) => tone(d, { f0: base * m, dur: dur / (1 + i * 0.3), vol: vol / (1 + i), a: 0.004, t }));

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------
const SFX_GAP = { slash: 0.02, step: 0.1, crackle: 0.01, ignite: 0.08, hit: 0.03, meteor: 0.1, land: 0.1, explode: 0.04 };

function sfx(name, o = {}) {
  if (!audio.ctx || !audio.enabled || audio.ctx.state !== 'running') return;
  const now = audio.ctx.currentTime;
  const gap = SFX_GAP[name] || 0;
  if (gap && now - (audio.last[name] || -9) < gap) return;
  audio.last[name] = now;
  const p = o.power ?? 0.5;
  const x = o.x;
  switch (name) {
    case 'step': noise(out(x), { f0: 900, f1: 300, dur: 0.05, vol: 0.05 }); break;
    case 'jump': {
      const d = out(x);
      noise(d, { ft: 'bandpass', f0: 600, f1: 1600, dur: 0.14, vol: 0.12 });
      tone(d, { f0: 220, f1: 420, dur: 0.1, vol: 0.04 });
      break;
    }
    case 'land': thud(out(x), 0.08 + p * 0.25, 120); break;
    case 'dissolve': {
      const d = out(x, 0.3);
      noise(d, { ft: 'bandpass', f0: 300, f1: 3200, dur: 0.85, vol: 0.18, a: 0.05, q: 2 });
      tone(d, { type: 'sawtooth', f0: 110, f1: 55, dur: 0.8, vol: 0.05, lp: 600 });
      break;
    }
    case 'materialize': {
      const d = out(x, 0.3);
      noise(d, { ft: 'bandpass', f0: 3200, f1: 300, dur: 0.6, vol: 0.14, a: 0.05, q: 2 });
      tone(d, { f0: 220, f1: 660, dur: 0.55, vol: 0.07 });
      break;
    }
    case 'respawn': {
      const d = out(x, 0.5);
      [392, 523, 659, 784].forEach((f, i) => tone(d, { type: 'triangle', f0: f, dur: 0.6, vol: 0.08, t: now + i * 0.08 }));
      break;
    }
    case 'fireball': {
      const d = out(x, 0.2);
      noise(d, { f0: 2400, f1: 350, dur: 0.35 + p * 0.2, vol: 0.18 + p * 0.2 });
      tone(d, { type: 'sawtooth', f0: 200, f1: 60, dur: 0.3 + p * 0.2, vol: 0.08 + p * 0.06, lp: 900 });
      break;
    }
    case 'wisps': {
      const d = out(x, 0.6);
      for (let i = 0; i < (o.n || 1); i++) tone(d, { type: 'triangle', f0: 900 + i * 220, f1: 1700 + i * 300, dur: 0.22, vol: 0.07, t: now + i * 0.05 });
      break;
    }
    case 'flamewave': {
      const d = out(x, 0.2);
      noise(d, { f0: 300, f1: 1600, dur: 0.6 + p * 0.3, vol: 0.25 + p * 0.1, a: 0.04 });
      tone(d, { type: 'sawtooth', f0: 70, f1: 40, dur: 0.6, vol: 0.12, lp: 400 });
      break;
    }
    case 'explode': {
      const d = out(x, 0.3);
      const k = o.small ? 0.5 : 1;
      noise(d, { f0: o.small ? 2600 : 1600, f1: 120, dur: (0.4 + p * 0.6) * k + 0.1, vol: (0.25 + p * 0.3) * k });
      tone(d, { f0: 120, f1: 35, dur: (0.35 + p * 0.35) * k, vol: (0.3 + p * 0.25) * k });
      break;
    }
    case 'draw': {
      // The blade sliding out of the scabbard.
      const d = out(x);
      noise(d, { ft: 'bandpass', f0: 2500, f1: 5500, dur: 0.16, vol: 0.06, q: 3 });
      tone(d, { type: 'square', f0: 2600, dur: 0.25, vol: 0.012, lp: 4000, ft: 'bandpass', q: 10, t: audio.ctx.currentTime + 0.12 });
      break;
    }
    case 'swing': {
      // Heavier blades whoosh lower.
      const d = out(x);
      const low = 1 / (o.power || 1);
      noise(d, { ft: 'bandpass', f0: 700 * low, f1: 3200 * low, dur: 0.13, vol: 0.16, q: 1.6 });
      break;
    }
    case 'slash': {
      const d = out(x, 0.15);
      noise(d, { f0: 3000, f1: 500, dur: 0.12, vol: 0.2 });
      thud(d, 0.18 + p * 0.15, 180);
      tone(d, { type: 'square', f0: 1900, dur: 0.12, vol: 0.025, lp: 3500, ft: 'bandpass', q: 7 });
      break;
    }
    case 'parry': {
      const d = out(x, 0.4);
      tone(d, { type: 'square', f0: 1480, dur: 0.5, vol: 0.05, lp: 2600, ft: 'bandpass', q: 9 });
      tone(d, { type: 'square', f0: 2210, dur: 0.35, vol: 0.035, lp: 3600, ft: 'bandpass', q: 9 });
      noise(d, { ft: 'highpass', f0: 4000, dur: 0.08, vol: 0.08 });
      break;
    }
    case 'ignite': noise(out(x), { ft: 'bandpass', f0: 700, f1: 2600, dur: 0.3, vol: 0.12, a: 0.03, q: 1.5 }); break;
    case 'crackle': noise(out(x), { ft: 'highpass', f0: 2000 + Math.random() * 3000, dur: 0.01 + Math.random() * 0.025, vol: 0.02 + Math.random() * 0.05, a: 0.001 }); break;
    case 'hit': {
      const d = out(x, 0.15);
      thud(d, 0.22 + p * 0.15);
      const t = o.type;
      if (t === 'bat') { tone(d, { type: 'square', f0: 2600, f1: 3600, dur: 0.08, vol: 0.04, lp: 5000 }); tone(d, { type: 'square', f0: 3400, f1: 2000, dur: 0.1, vol: 0.04, lp: 5000, t: now + 0.08 }); }
      else if (t === 'cultist') { tone(d, { f0: 330, dur: 0.35, vol: 0.06, vib: 8, vibRate: 6 }); tone(d, { f0: 349, dur: 0.35, vol: 0.06 }); }
      else if (t === 'brute') growl(d, 85, 55, 0.4, 0.2, 500);
      else if (t === 'boss') { growl(d, 62, 45, 0.5, 0.2, 400); tone(d, { type: 'square', f0: 520, dur: 0.45, vol: 0.05, lp: 1800, ft: 'bandpass', q: 6 }); tone(d, { type: 'square', f0: 781, dur: 0.35, vol: 0.03, lp: 2400, ft: 'bandpass', q: 6 }); }
      else growl(d, 150, 95, 0.3, 0.12, 900);
      break;
    }
    case 'die': {
      const d = out(x, 0.3);
      noise(d, { f0: 1600, f1: 250, dur: 1.0, vol: 0.18, a: 0.05 });
      const t = o.type;
      if (t === 'bat') tone(d, { type: 'square', f0: 3000, f1: 700, dur: 0.5, vol: 0.04, lp: 4000 });
      else if (t === 'cultist') { tone(d, { f0: 440, f1: 110, dur: 1.0, vol: 0.06 }); tone(d, { f0: 466, f1: 116, dur: 1.0, vol: 0.05 }); }
      else if (t === 'brute') growl(d, 90, 38, 1.2, 0.2, 500);
      else if (t !== 'boss') growl(d, 210, 60, 0.9, 0.12, 1000);
      break;
    }
    case 'hurt': {
      const d = out(x);
      thud(d, 0.3);
      const h = cfg.hero;
      tone(d, { type: 'triangle', f0: h === 'bruxa' ? 520 : h === 'paladino' ? 220 : 320, f1: h === 'bruxa' ? 300 : h === 'paladino' ? 120 : 160, dur: 0.16, vol: 0.12 });
      if (h === 'paladino') tone(d, { type: 'square', f0: 1250, dur: 0.18, vol: 0.03, lp: 3000, ft: 'bandpass', q: 8 });
      break;
    }
    case 'herodeath': {
      const d = out(x, 0.4);
      tone(d, { type: 'sawtooth', f0: 220, f1: 55, dur: 1.4, vol: 0.12, lp: 800 });
      noise(d, { f0: 1500, f1: 200, dur: 1.2, vol: 0.15, a: 0.05 });
      duckMusic(2.5);
      break;
    }
    case 'orbcast': {
      const d = out(x, 0.4);
      tone(d, { f0: 180, f1: 90, dur: 0.6, vol: 0.08, vib: 25, vibRate: 9 });
      noise(d, { ft: 'bandpass', f0: 400, dur: 0.4, vol: 0.06, q: 4 });
      break;
    }
    case 'slam': {
      const d = out(x, 0.3);
      const k = o.big ? 1.3 : 1;
      tone(d, { f0: 75, f1: 28, dur: 0.7 * k, vol: 0.45 * k });
      noise(d, { f0: 700, f1: 70, dur: 0.8 * k, vol: 0.35 * k });
      break;
    }
    case 'sweep': {
      const d = out(x, 0.2);
      noise(d, { ft: 'bandpass', f0: 400, f1: 2800, dur: 0.32, vol: 0.28, q: 1.4 });
      tone(d, { type: 'square', f0: 880, dur: 0.5, vol: 0.03, lp: 2000, ft: 'bandpass', q: 9 });
      break;
    }
    case 'bossintro': {
      const d = out(x, 0.7);
      gong(d, 82, 4, 0.25);
      growl(d, 72, 48, 1.8, 0.28, 450, now + 0.3);
      break;
    }
    case 'rage': growl(out(x, 0.5), 95, 55, 1.3, 0.3, 600); break;
    case 'rainwind': tone(out(x, 0.5), { f0: 300, f1: 1000, dur: 1.0, vol: 0.05, a: 0.2 }); break;
    case 'meteor': tone(out(x, 0.2), { f0: 1600, f1: 280, dur: 0.6, vol: 0.06 }); break;
    case 'wave': gong(out(undefined, 0.6), 196, 2.2, 0.14); break;
    case 'bossdeath': {
      const d = out(x, 0.6);
      noise(d, { f0: 300, f1: 60, dur: 3.2, vol: 0.35, a: 0.1, hold: 0.8 });
      growl(d, 75, 30, 2.6, 0.25, 400);
      break;
    }
    case 'victory': {
      const d = out(undefined, 0.6);
      [62, 65, 69, 74].forEach((n, i) => tone(d, { type: 'triangle', f0: midi(n + 12), dur: 0.5, vol: 0.09, t: now + 0.6 + i * 0.14 }));
      [62, 66, 69, 74].forEach((n) => tone(d, { type: 'triangle', f0: midi(n + 12), dur: 2.4, vol: 0.06, t: now + 1.3, a: 0.02 }));
      break;
    }
    default: break;
  }
}

function duckMusic(seconds) {
  if (!audio.ctx) return;
  const f = audio.musicLP.frequency;
  const t = audio.ctx.currentTime;
  f.cancelScheduledValues(t);
  f.setValueAtTime(f.value, t);
  f.exponentialRampToValueAtTime(450, t + 0.2);
  f.setValueAtTime(450, t + seconds);
  f.exponentialRampToValueAtTime(18000, t + seconds + 1.5);
}

// ---------------------------------------------------------------------------
// Continuous sounds, updated every frame
// ---------------------------------------------------------------------------
function audioUpdate(dt) {
  if (!audio.ctx || audio.ctx.state !== 'running') return;
  const ctx = audio.ctx;
  // Spell charge: a buzzing hum whose pitch and brightness rise with the charge.
  const charging = spell.state === 'charge';
  if (charging && !audio.charge) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.06, ctx.currentTime, 0.05);
    osc.connect(f);
    f.connect(g);
    g.connect(out(ch.x, 0.3));
    osc.start();
    audio.charge = { osc, f, g };
  }
  if (audio.charge) {
    const c = audio.charge;
    const t = ctx.currentTime;
    if (charging) {
      c.osc.frequency.setTargetAtTime(90 + spell.power * 160, t, 0.05);
      c.f.frequency.setTargetAtTime(300 + spell.power * 2200, t, 0.05);
    } else {
      c.g.gain.setTargetAtTime(0.0001, t, 0.03);
      c.osc.stop(t + 0.2);
      audio.charge = null;
    }
  }
  // Footsteps on each foot plant.
  const idx = Math.floor(ch.phase / Math.PI);
  if (idx !== audio.stepIdx) {
    audio.stepIdx = idx;
    if (ch.onGround && Math.abs(ch.vx) > 6 && dissolve.state === 'none') sfx('step', { x: ch.x });
  }
  // Fire crackle: busier the more things burn near the camera.
  const cx = cam.x + VIEW_W / 2;
  const spots = [];
  let sources = 0;
  for (const e of enemies) if ((e.burn > 0 || e.state === 'dying') && Math.abs(e.x - cx) < 160) { sources += e.def.boss ? 3 : 1; spots.push(e.x); }
  for (const b of BRAZIERS) if (Math.abs(b.x - cx) < 140) { sources += 0.4; spots.push(b.x); }
  if (cfg.effect === 'aura' && !ch.dead) { sources += 0.6; spots.push(ch.x); }
  if (spots.length && Math.random() < sources * 7 * dt) sfx('crackle', { x: spots[(Math.random() * spots.length) | 0] + (Math.random() - 0.5) * 20 });
  // Music mode follows the game.
  const boss = BOSS.locked && BOSS.active && BOSS.active.state !== 'dying';
  audio.mode = boss ? (bossRage(BOSS.active) ? 'rage' : 'boss') : 'explore';
}

// ---------------------------------------------------------------------------
// Music: a step sequencer scheduled slightly ahead of time
// ---------------------------------------------------------------------------
const CHORDS_EXPLORE = [
  { n: [62, 65, 69], b: 38 }, // Dm
  { n: [58, 62, 65], b: 34 }, // Bb
  { n: [57, 60, 65], b: 41 }, // F
  { n: [55, 60, 64], b: 36 }, // C
];
const CHORDS_BOSS = [
  { n: [62, 65, 69], b: 38 }, // Dm
  { n: [58, 62, 65], b: 34 }, // Bb
  { n: [60, 64, 67], b: 36 }, // C
  { n: [57, 61, 64], b: 33 }, // A (major: harmonic-minor tension)
];
const PENTA = [62, 65, 67, 69, 72, 74, 77, 79];

function musicTick() {
  if (!audio.ctx || audio.ctx.state !== 'running') return;
  const s = audio.seq;
  const ctx = audio.ctx;
  if (s.next < ctx.currentTime - 0.2) s.next = ctx.currentTime + 0.05; // after a pause
  while (s.next < ctx.currentTime + 0.12) {
    const mode = audio.mode;
    const bpm = mode === 'explore' ? 70 : mode === 'rage' ? 146 : 132;
    const stepDur = 60 / bpm / 4; // sixteenth notes
    if (mode !== s.mode) { s.mode = mode; s.step = 0; s.bar = 0; }
    if (mode === 'explore') exploreStep(s.step, s.bar, s.next, stepDur);
    else bossStep(s.step, s.bar, s.next, stepDur, mode === 'rage');
    s.next += stepDur;
    s.step = (s.step + 1) % 16;
    if (s.step === 0) s.bar++;
  }
}

function exploreStep(step, bar, t, sd) {
  const M = audio.music;
  const chord = CHORDS_EXPLORE[Math.floor(bar / 2) % 4];
  // Pad: one chord every two bars, slow attack, detuned saws through a low-pass.
  if (step === 0 && bar % 2 === 0) {
    const dur = sd * 32;
    for (const n of chord.n) {
      for (const det of [-9, 9]) tone(M, { type: 'sawtooth', f0: midi(n), detune: det, dur, vol: 0.022, a: 1.2, hold: dur - 2.6, lp: 750, q: 0.8, t });
    }
  }
  // Bass on beats 1 and 3.
  if (step === 0 || step === 8) tone(M, { type: 'triangle', f0: midi(chord.b + 12), dur: sd * 7, vol: 0.12, a: 0.02, t });
  // Heartbeat: lub-dub at the start of every bar.
  if (step === 0 || step === 3) tone(M, { f0: step === 0 ? 62 : 55, f1: 38, dur: 0.25, vol: step === 0 ? 0.16 : 0.1, t });
  // Sparse bells from the D minor pentatonic.
  if (step % 2 === 0 && Math.random() < 0.26) {
    const n = PENTA[(Math.random() * PENTA.length) | 0];
    tone(M, { type: 'triangle', f0: midi(n + 12), dur: 1.4, vol: 0.05, a: 0.004, t });
    tone(M, { f0: midi(n + 24), dur: 0.7, vol: 0.015, a: 0.004, t });
  }
}

function bossStep(step, bar, t, sd, rage) {
  const M = audio.music;
  const chord = CHORDS_BOSS[bar % 4];
  // Drums.
  if (step === 0 || step === 8 || (step === 10 && bar % 2)) tone(M, { f0: 110, f1: 38, dur: 0.22, vol: 0.32, t });
  if (step === 4 || step === 12) { noise(M, { ft: 'bandpass', f0: 1800, dur: 0.16, vol: 0.18, q: 0.8, t }); tone(M, { type: 'triangle', f0: 190, f1: 140, dur: 0.1, vol: 0.08, t }); }
  if (rage || step % 2 === 0) noise(M, { ft: 'highpass', f0: 7000, dur: 0.035, vol: rage ? 0.05 : 0.04, t });
  // Driving bass in eighths, jumping an octave on the off-beats.
  if (step % 2 === 0) {
    const up = step === 6 || step === 14;
    tone(M, { type: 'sawtooth', f0: midi(chord.b + 12 + (up ? 12 : 0)), dur: sd * 1.8, vol: 0.09, lp: 420, q: 4, t });
  }
  // Chord stabs.
  if (step === 0 || step === 6 || step === 12) {
    for (const n of chord.n) tone(M, { type: 'square', f0: midi(n), dur: sd * 2.5, vol: 0.022, lp: 1600, t });
  }
  // Choir pad: sines with vibrato, one chord per bar.
  if (step === 0) {
    for (const n of chord.n) tone(M, { f0: midi(n + 12), dur: sd * 16, vol: 0.018, a: 0.3, hold: sd * 10, vib: 3, vibRate: 5, t });
  }
}

// Unlock on the first gesture anywhere on the page.
for (const ev of ['pointerdown', 'keydown']) {
  window.addEventListener(ev, () => { if (audio.enabled) audioStart(); }, { passive: true });
}
