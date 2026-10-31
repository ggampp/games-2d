export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private step = 0;
  private next = 0;
  muted = false;
  private playing = false;

  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(ctx.destination);
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.ensureNoise();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.playing = true;
    this.next = this.ctx.currentTime + 0.05;
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.85;
    return this.muted;
  }

  tick(): void {
    if (!this.ctx || !this.playing || !this.musicGain) return;
    const beat = 60 / 136 / 2;
    while (this.next < this.ctx.currentTime + 0.22) {
      const s = this.step % 16;
      if (s % 4 === 0) this.kick(this.next);
      if (s % 8 === 4) this.snare(this.next);
      if (s % 2 === 0) this.hat(this.next);
      const bass = [0, 0, 3, 0, 5, 3, 7, 5, 0, 0, 3, 5, 7, 5, 3, 0][s];
      if (s % 2 === 0) {
        this.tone(110 * 2 ** (bass / 12), this.next, beat * 1.3, "square", 0.045, this.musicGain);
      }
      const lead = [0, 7, 12, 10, 7, 3, 7, 12, 15, 12, 10, 7, 3, 7, 10, 12][s];
      if (s % 2 === 0) {
        this.tone(220 * 2 ** (lead / 12), this.next, beat * 0.85, "square", 0.028, this.musicGain);
      }
      this.step += 1;
      this.next += beat;
    }
  }

  shoot(kind: "blaster" | "rapid" | "spread" | "heavy"): void {
    if (kind === "heavy") {
      this.tone(140, 0, 0.12, "sawtooth", 0.08);
      this.burst(0.08, 180, 0.08);
      return;
    }
    const f = kind === "rapid" ? 980 : kind === "spread" ? 640 : 760;
    this.tone(f, 0, 0.05, "square", 0.05);
    this.burst(0.04, 1400, 0.04);
  }

  jump(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.12);
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g);
    g.connect(this.master!);
    o.start(t);
    o.stop(t + 0.15);
  }

  bite(): void {
    this.burst(0.07, 500, 0.06);
    this.tone(90, 0, 0.08, "sawtooth", 0.05);
  }

  boom(): void {
    this.burst(0.28, 240, 0.12);
    this.tone(70, 0, 0.2, "sine", 0.09);
  }

  hurt(): void {
    this.tone(110, 0, 0.12, "square", 0.06);
    this.burst(0.08, 600, 0.05);
  }

  die(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    [220, 160, 110, 70].forEach((f, i) => this.tone(f, t + i * 0.08, 0.12, "sawtooth", 0.06, this.master!));
  }

  pickup(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.06, 0.1, "square", 0.05, this.master!));
  }

  wave(): void {
    this.tone(180, 0, 0.08, "square", 0.05);
    this.tone(360, 0.09, 0.1, "square", 0.05);
  }

  boss(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    [110, 92, 78, 130].forEach((f, i) => this.tone(f, t + i * 0.12, 0.16, "sawtooth", 0.07, this.master!));
  }

  fanfare(): void {
    if (!this.ctx || !this.master || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(0.04, this.ctx.currentTime, 0.05);
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.12, 0.2, "square", 0.06, this.master!));
  }

  lose(): void {
    if (!this.ctx || !this.master || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(0.04, this.ctx.currentTime, 0.05);
    const t = this.ctx.currentTime;
    [196, 155, 123, 92].forEach((f, i) => this.tone(f, t + i * 0.14, 0.2, "sawtooth", 0.06, this.master!));
  }

  pop(): void {
    this.tone(320, 0, 0.06, "square", 0.04);
  }

  private tone(
    freq: number,
    when: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    dest?: AudioNode,
  ): void {
    if (!this.ctx || !this.master) return;
    const t = when || this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, freq: number, gain: number): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  private kick(when: number): void {
    if (!this.ctx || !this.musicGain) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.08);
    g.gain.setValueAtTime(0.12, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(when);
    o.stop(when + 0.11);
  }

  private snare(when: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    src.start(when);
    src.stop(when + 0.09);
  }

  private hat(when: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 5000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.02, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    src.start(when);
    src.stop(when + 0.04);
  }

  private ensureNoise(): void {
    if (!this.ctx || this.noiseBuf) return;
    const len = Math.floor(this.ctx.sampleRate * 0.4);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }
}
