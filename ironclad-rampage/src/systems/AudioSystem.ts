export class AudioSystem {
  private ctx: AudioContext | null = null;

  private ensure(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private beep(freq: number, duration: number, type: OscillatorType, gain = 0.04): void {
    try {
      const ctx = this.ensure();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // autoplay policies
    }
  }

  attack(): void {
    this.beep(180, 0.08, 'square', 0.03);
    this.beep(90, 0.1, 'triangle', 0.04);
  }

  hit(): void {
    this.beep(120, 0.07, 'sawtooth', 0.035);
  }

  special(): void {
    this.beep(260, 0.12, 'square', 0.04);
    this.beep(130, 0.18, 'triangle', 0.05);
  }

  hurt(): void {
    this.beep(70, 0.14, 'sawtooth', 0.045);
  }

  win(): void {
    this.beep(440, 0.12, 'square', 0.04);
    setTimeout(() => this.beep(660, 0.16, 'square', 0.04), 100);
  }

  lose(): void {
    this.beep(110, 0.25, 'triangle', 0.05);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
