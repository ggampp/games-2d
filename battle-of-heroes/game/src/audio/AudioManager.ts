export class AudioManager {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicNodes: OscillatorNode[] = [];
  private musicTimer: number | null = null;
  private step = 0;
  musicVolume = 0.45;
  sfxVolume = 0.7;

  init(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.sfxGain.gain.value = this.sfxVolume;
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.ctx.destination);
    const unlock = () => {
      void this.ctx?.resume();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  setMusic(v: number): void {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  setSfx(v: number): void {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol = 0.2, slide?: number): void {
    if (!this.ctx || !this.sfxGain || this.ctx.state !== "running") return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), this.ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  click(): void {
    this.tone(740, 0.07, "square", 0.08);
  }

  spawn(): void {
    this.tone(320, 0.12, "triangle", 0.12, 520);
  }

  hit(): void {
    const jitter = 0.9 + Math.random() * 0.2;
    this.tone(180 * jitter, 0.09, "sawtooth", 0.14, 70);
  }

  death(): void {
    this.tone(140, 0.28, "sawtooth", 0.16, 45);
  }

  projectile(): void {
    this.tone(620, 0.1, "square", 0.08, 280);
  }

  win(): void {
    this.tone(523, 0.18, "triangle", 0.16);
    setTimeout(() => this.tone(659, 0.18, "triangle", 0.16), 120);
    setTimeout(() => this.tone(784, 0.32, "triangle", 0.18), 240);
  }

  lose(): void {
    this.tone(220, 0.4, "sawtooth", 0.16, 80);
  }

  deny(): void {
    this.tone(140, 0.12, "square", 0.1);
  }

  startMusic(): void {
    this.stopMusic();
    if (!this.ctx || !this.musicGain) return;
    const pattern = [196, 246, 293, 246, 220, 196, 174, 196];
    const tick = () => {
      if (!this.ctx || !this.musicGain || this.ctx.state !== "running") return;
      const f = pattern[this.step % pattern.length];
      this.step += 1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.38);
      this.musicNodes = [osc];
    };
    tick();
    this.musicTimer = window.setInterval(tick, 420);
  }

  stopMusic(): void {
    if (this.musicTimer != null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicNodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    });
    this.musicNodes = [];
  }
}

export const audio = new AudioManager();
