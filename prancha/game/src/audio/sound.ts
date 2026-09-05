/** Áudio procedural via Web Audio: cliques, carimbo, estalo, rangido, motor, vento. */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stressGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  setMuted(m: boolean): void {
    this._muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  ensure(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 1;
      this.master.connect(ctx.destination);

      const stressOsc = ctx.createOscillator();
      this.stressGain = ctx.createGain();
      stressOsc.type = "sawtooth";
      stressOsc.frequency.value = 78;
      this.stressGain.gain.value = 0;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 420;
      stressOsc.connect(f);
      f.connect(this.stressGain);
      this.stressGain.connect(this.master);
      stressOsc.start();

      this.engineOsc = ctx.createOscillator();
      this.engineGain = ctx.createGain();
      this.engineOsc.type = "triangle";
      this.engineOsc.frequency.value = 42;
      this.engineGain.gain.value = 0;
      const ef = ctx.createBiquadFilter();
      ef.type = "lowpass";
      ef.frequency.value = 150;
      this.engineOsc.connect(ef);
      ef.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();

      const noiseLen = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = "bandpass";
      this.windFilter.frequency.value = 300;
      this.windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      noise.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      noise.start();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private beep(freq: number, dur: number, type: OscillatorType, gain: number, freq2?: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  click(): void {
    this.ensure();
    this.beep(880, 0.05, "sine", 0.1, 280);
  }

  deny(): void {
    this.ensure();
    this.beep(180, 0.12, "square", 0.06, 120);
  }

  stamp(): void {
    this.ensure();
    this.beep(140, 0.18, "square", 0.12, 60);
    this.beep(420, 0.12, "triangle", 0.06, 180);
  }

  approve(): void {
    this.ensure();
    this.beep(523, 0.12, "triangle", 0.08);
    setTimeout(() => this.beep(784, 0.2, "triangle", 0.08), 110);
  }

  snap(): void {
    this.ensure();
    this.beep(220, 0.16, "sawtooth", 0.16, 40);
  }

  splash(): void {
    this.ensure();
    this.beep(240, 0.22, "triangle", 0.08, 70);
  }

  setStress(amount: number): void {
    if (!this.ctx || !this.stressGain) return;
    const a = Math.max(0, amount - 0.45) * 0.08;
    this.stressGain.gain.setTargetAtTime(a, this.ctx.currentTime, 0.08);
  }

  setEngine(on: boolean, speed = 0): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc) return;
    this.engineGain.gain.setTargetAtTime(on ? 0.04 : 0, this.ctx.currentTime, 0.12);
    this.engineOsc.frequency.setTargetAtTime(36 + Math.abs(speed) * 0.4, this.ctx.currentTime, 0.1);
  }

  /** Intensidade do vento 0–1. */
  setWind(amount: number): void {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    this.windGain.gain.setTargetAtTime(amount * 0.12, this.ctx.currentTime, 0.2);
    this.windFilter.frequency.setTargetAtTime(250 + amount * 500, this.ctx.currentTime, 0.2);
  }

  stopAll(): void {
    this.setEngine(false);
    this.setStress(0);
    this.setWind(0);
  }
}
