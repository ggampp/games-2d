// Sons sintetizados (WebAudio), criados só após um gesto do usuário.
let ctx = null;
let enabled = true;

export function setSound(on) {
  enabled = on;
}

export function unlockAudio() {
  if (ctx || typeof AudioContext === 'undefined') return;
  try {
    ctx = new AudioContext();
  } catch {
    ctx = null;
  }
}

function tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', gain = 0.18, delay = 0 }) {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur = 0.15, gain = 0.2, delay = 0) {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

export const sfx = {
  select: () => tone({ freq: 660, to: 760, dur: 0.06, type: 'triangle', gain: 0.08 }),
  move: () => {
    tone({ freq: 180, to: 110, dur: 0.09, type: 'triangle', gain: 0.22 });
    noise(0.05, 0.08);
  },
  capture: () => {
    noise(0.22, 0.35);
    tone({ freq: 320, to: 90, dur: 0.2, type: 'sawtooth', gain: 0.07 });
  },
  invalid: () => tone({ freq: 160, to: 140, dur: 0.12, type: 'square', gain: 0.05 }),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.14, delay: i * 0.12 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone({ freq: f, to: f * 0.97, dur: 0.28, type: 'triangle', gain: 0.12, delay: i * 0.16 })),
  star: (i) => tone({ freq: 880 + i * 220, dur: 0.14, type: 'sine', gain: 0.12, delay: 0.25 + i * 0.22 }),
};
