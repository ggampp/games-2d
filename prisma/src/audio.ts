/** Procedural audio: soft laboratory ambience, gentle generative music, and UI/target cues. */
import type { TargetColor } from './core/types.ts';

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicOn = true;
  private musicTimer = 0;
  private step = 0;
  private started = false;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? 0.35 : 0;
      this.musicGain.connect(this.master);
      this.startAmbience();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Call from the first user gesture. */
  unlock() {
    if (this.started) return;
    if (this.ensure()) {
      this.started = true;
      this.scheduleMusic();
    }
  }

  toggleMusic(): boolean {
    this.musicOn = !this.musicOn;
    const ctx = this.ensure();
    if (ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.musicOn ? 0.35 : 0, ctx.currentTime, 0.2);
    }
    return this.musicOn;
  }

  get isMusicOn() { return this.musicOn; }

  private startAmbience() {
    const ctx = this.ctx!;
    // low hum through a lowpass, slowly wobbling
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 48;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    osc.connect(lp); lp.connect(g); g.connect(this.musicGain!);
    osc.start(); lfo.start();
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; attack?: number; dest?: GainNode; detune?: number } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.value = freq;
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    const a = opts.attack ?? 0.01;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.2, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g);
    g.connect(opts.dest ?? this.sfxGain!);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx) return;
    const chords = [
      [220, 277.18, 329.63, 415.3],   // A add9-ish
      [174.61, 220, 261.63, 349.23],  // F
      [196, 246.94, 293.66, 392],     // G
      [164.81, 207.65, 246.94, 329.63] // E
    ];
    const play = () => {
      if (!this.ctx) return;
      const chord = chords[Math.floor(this.step / 2) % chords.length];
      const idx = this.step % 2 === 0 ? [0, 2] : [1, 3];
      for (const i of idx) {
        this.tone(chord[i], 5.5, { type: 'sine', gain: 0.07, attack: 1.4, dest: this.musicGain! });
        this.tone(chord[i] * 2, 4, { type: 'triangle', gain: 0.012, attack: 1.8, dest: this.musicGain!, detune: 4 });
      }
      if (this.step % 4 === 3) {
        const melody = chord[(this.step * 7) % 4] * 2;
        this.tone(melody, 2.2, { type: 'sine', gain: 0.03, attack: 0.05, dest: this.musicGain! });
      }
      this.step++;
      this.musicTimer = window.setTimeout(play, 3200);
    };
    window.clearTimeout(this.musicTimer);
    play();
  }

  place() {
    this.tone(520, 0.12, { type: 'triangle', gain: 0.12 });
    this.tone(780, 0.08, { type: 'sine', gain: 0.06 });
  }

  pick() {
    this.tone(660, 0.07, { type: 'triangle', gain: 0.07 });
  }

  remove() {
    this.tone(330, 0.16, { type: 'triangle', gain: 0.1 });
    this.tone(220, 0.2, { type: 'sine', gain: 0.06 });
  }

  tick(deg: number) {
    const f = 900 + ((deg % 90) / 90) * 500;
    this.tone(f, 0.035, { type: 'square', gain: 0.025 });
  }

  targetLit(color: TargetColor) {
    const base = { red: 392, green: 523.25, blue: 659.25, white: 783.99, any: 587.33 }[color];
    this.tone(base, 0.9, { type: 'sine', gain: 0.16, attack: 0.02 });
    this.tone(base * 1.5, 0.7, { type: 'sine', gain: 0.07, attack: 0.03 });
    this.tone(base * 2, 0.5, { type: 'triangle', gain: 0.03, attack: 0.04 });
  }

  targetUnlit() {
    this.tone(300, 0.2, { type: 'sine', gain: 0.05 });
  }

  solved() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, i) => window.setTimeout(() => {
      this.tone(n, 1.4, { type: 'sine', gain: 0.14, attack: 0.02 });
      this.tone(n / 2, 1.8, { type: 'triangle', gain: 0.04, attack: 0.05 });
    }, i * 110));
  }

  ui() {
    this.tone(1200, 0.05, { type: 'sine', gain: 0.05 });
  }
}

export const audio = new Audio();
