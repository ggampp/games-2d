/** Procedural mixer: Master / Music / SFX / UI. Unlocks on first gesture. */

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private ui: GainNode | null = null;
  private musicTimer: number | null = null;
  private step = 0;

  public unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);

    this.music = this.ctx.createGain();
    this.music.gain.value = 0.18;
    this.music.connect(this.master);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.45;
    this.sfx.connect(this.master);

    this.ui = this.ctx.createGain();
    this.ui.gain.value = 0.28;
    this.ui.connect(this.master);

    this.startMusic();
  }

  public punch(heavy = false): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, heavy ? 0.09 : 0.05, heavy ? 0.5 : 0.32, 900, 180);
    this.tone(t, heavy ? 140 : 220, heavy ? 70 : 110, heavy ? 0.12 : 0.07, "square", this.sfx, heavy ? 0.22 : 0.14);
  }

  public hit(): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 0.06, 0.4, 1400, 240);
    this.tone(t, 180, 60, 0.08, "sawtooth", this.sfx, 0.16);
  }

  public gun(): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 0.08, 0.55, 2400, 200);
    this.tone(t, 520, 90, 0.07, "square", this.sfx, 0.18);
  }

  public jump(): void {
    if (!this.ctx || !this.sfx) return;
    this.tone(this.ctx.currentTime, 280, 420, 0.08, "triangle", this.sfx, 0.1);
  }

  public pickup(): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    this.tone(t, 520, 780, 0.1, "square", this.sfx, 0.12);
    this.tone(t + 0.08, 780, 1040, 0.1, "square", this.sfx, 0.1);
  }

  public roar(): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 0.35, 0.45, 400, 80);
    this.tone(t, 90, 40, 0.4, "sawtooth", this.sfx, 0.22);
  }

  public uiClick(): void {
    if (!this.ctx || !this.ui) return;
    this.tone(this.ctx.currentTime, 660, 440, 0.05, "square", this.ui, 0.08);
  }

  public uiConfirm(): void {
    if (!this.ctx || !this.ui) return;
    const t = this.ctx.currentTime;
    this.tone(t, 440, 660, 0.08, "square", this.ui, 0.1);
    this.tone(t + 0.07, 660, 880, 0.1, "square", this.ui, 0.1);
  }

  public death(): void {
    if (!this.ctx || !this.sfx) return;
    this.tone(this.ctx.currentTime, 220, 55, 0.35, "sawtooth", this.sfx, 0.18);
  }

  private startMusic(): void {
    if (!this.ctx || !this.music) return;
    const pulse = () => {
      if (!this.ctx || !this.music) return;
      const t = this.ctx.currentTime;
      const root = 110;
      const bass = [0, 0, 3, 0, 5, 3, 0, 7][this.step % 8];
      this.tone(t, root * Math.pow(2, bass / 12), root * Math.pow(2, bass / 12) * 0.7, 0.22, "triangle", this.music, 0.55);
      if (this.step % 2 === 0) {
        this.tone(t, 330, 280, 0.08, "square", this.music, 0.12);
      }
      if (this.step % 8 === 4) {
        this.tone(t, 440 * 1.5, 440, 0.18, "triangle", this.music, 0.1);
      }
      this.step++;
      this.musicTimer = window.setTimeout(pulse, 280);
    };
    pulse();
  }

  private tone(
    t: number,
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    bus: GainNode,
    gain: number,
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(t: number, dur: number, gain: number, hp: number, lp: number): void {
    if (!this.ctx || !this.sfx) return;
    const n = this.ctx.createBufferSource();
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = (hp + lp) / 2;
    filter.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    n.start(t);
    n.stop(t + dur + 0.02);
  }
}

export const audio = new GameAudio();
