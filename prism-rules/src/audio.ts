// Procedural Sound Engine using Web Audio API

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private laserHumNode: OscillatorNode | null = null;
  private laserHumGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // Lazy init on first user gesture
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.45;
      this.masterGain.connect(this.ctx.destination);
      this.startLaserHum();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private startLaserHum() {
    if (!this.ctx || !this.masterGain) return;
    try {
      this.laserHumNode = this.ctx.createOscillator();
      this.laserHumNode.type = 'sine';
      this.laserHumNode.frequency.value = 55; // Low cosmic hum

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 140;

      this.laserHumGain = this.ctx.createGain();
      this.laserHumGain.gain.value = 0.08;

      this.laserHumNode.connect(filter);
      filter.connect(this.laserHumGain);
      this.laserHumGain.connect(this.masterGain);

      this.laserHumNode.start();
    } catch {
      // Audio autoplay policy fallback
    }
  }

  public playPlacePiece() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.06);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playRotateTick(angleDegrees: number) {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    // Pitch changes slightly with angle for spatial feel
    const baseFreq = 600 + (angleDegrees % 90) * 4;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playTargetHit(colorType: string) {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    let freq1 = 440;
    let freq2 = 880;

    switch (colorType) {
      case 'red':
        freq1 = 261.63; // C4
        freq2 = 523.25; // C5
        break;
      case 'green':
        freq1 = 329.63; // E4
        freq2 = 659.25; // E5
        break;
      case 'blue':
        freq1 = 392.00; // G4
        freq2 = 783.99; // G5
        break;
      case 'white':
      case 'gold':
      default:
        freq1 = 523.25; // C5
        freq2 = 1046.50;// C6
        break;
    }

    [freq1, freq2].forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.55);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.6);
    });
  }

  public playVictoryChime() {
    this.initCtx();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const chord = [261.63, 329.63, 392.00, 523.25, 659.25, 1046.50]; // Radiant C-major chord

    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.setValueAtTime(0.15, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.3);
    });
  }
}

export const sounds = new SoundManager();
