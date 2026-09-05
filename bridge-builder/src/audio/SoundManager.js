export class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.stressGain = null;
    this.stressOsc = null;
    this.engineGain = null;
    this.engineOsc = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Continuous stress groaning synthesizer
      this.stressOsc = this.ctx.createOscillator();
      this.stressGain = this.ctx.createGain();
      this.stressOsc.type = 'sawtooth';
      this.stressOsc.frequency.setValueAtTime(80, this.ctx.currentTime);
      this.stressGain.gain.setValueAtTime(0, this.ctx.currentTime);

      const stressFilter = this.ctx.createBiquadFilter();
      stressFilter.type = 'lowpass';
      stressFilter.frequency.setValueAtTime(450, this.ctx.currentTime);

      this.stressOsc.connect(stressFilter);
      stressFilter.connect(this.stressGain);
      this.stressGain.connect(this.ctx.destination);
      this.stressOsc.start();

      // Engine rumble synthesizer
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'triangle';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.setValueAtTime(160, this.ctx.currentTime);

      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio could not be initialized:', e);
    }
  }

  ensureContext() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.04);
  }

  playConnect(isRoad = false) {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isRoad ? 'square' : 'triangle';
    const baseFreq = isRoad ? 320 : 520;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.08);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  playSnap() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const t = this.ctx.currentTime;

    // 1. Noise burst for crack
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(2, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    // 2. Low boom body
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playSplash() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.45);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  playVictory() {
    if (this.isMuted || !this.ctx) return;
    this.ensureContext();

    const t = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5 fanfare
    notes.forEach((freq, idx) => {
      const startTime = t + idx * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      const dur = idx === notes.length - 1 ? 0.6 : 0.2;
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  }

  updateDynamicAudio(maxStress, vehicleMoving, vehicleSpeedRatio) {
    if (this.isMuted || !this.ctx || !this.initialized) return;

    const t = this.ctx.currentTime;

    // Stress creak volume & pitch
    if (this.stressGain && this.stressOsc) {
      if (maxStress > 0.65) {
        const stressIntensity = Math.min(1.0, (maxStress - 0.65) / 0.35);
        const targetVol = 0.03 + stressIntensity * 0.18;
        const targetFreq = 70 + stressIntensity * 120 + Math.sin(t * 18) * 15;
        this.stressGain.gain.setTargetAtTime(targetVol, t, 0.05);
        this.stressOsc.frequency.setTargetAtTime(targetFreq, t, 0.05);
      } else {
        this.stressGain.gain.setTargetAtTime(0, t, 0.08);
      }
    }

    // Engine rumble
    if (this.engineGain && this.engineOsc) {
      if (vehicleMoving) {
        const engineVol = 0.04 + vehicleSpeedRatio * 0.08;
        const engineFreq = 40 + vehicleSpeedRatio * 45;
        this.engineGain.gain.setTargetAtTime(engineVol, t, 0.06);
        this.engineOsc.frequency.setTargetAtTime(engineFreq, t, 0.06);
      } else {
        this.engineGain.gain.setTargetAtTime(0, t, 0.1);
      }
    }
  }

  stopAllContinuous() {
    if (!this.ctx || !this.initialized) return;
    const t = this.ctx.currentTime;
    if (this.stressGain) this.stressGain.gain.setTargetAtTime(0, t, 0.04);
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, t, 0.04);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopAllContinuous();
    }
    return this.isMuted;
  }
}
