/**
 * The Long Spectrum - Web Audio API Procedural Sound Engine
 * Provides rich atmospheric audio, tactile glass/optics interaction feedback,
 * harmonic target resonance chords, and victory arpeggios.
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.ambientGain = null;
        this.masterGain = null;
        this.activeTargetSynths = {};
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            // Start ambient optics lab hum
            this.startAmbient();
            this.isInitialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported or blocked:', e);
        }
    }

    resume() {
        if (!this.ctx) {
            this.init();
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime, 0.05);
        }
        return this.isMuted;
    }

    startAmbient() {
        if (!this.ctx) return;
        try {
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            this.ambientGain = this.ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 hum

            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(110, this.ctx.currentTime); // A2 harmonic

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(220, this.ctx.currentTime);

            this.ambientGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(this.ambientGain);
            this.ambientGain.connect(this.masterGain);

            osc1.start();
            osc2.start();
        } catch (e) {
            console.warn('Ambient failed:', e);
        }
    }

    // Optical element pickup sound (light glass ping)
    playPickup() {
        if (this.isMuted || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    // Optical element place sound (subtle glass clink)
    playPlace() {
        if (this.isMuted || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    // Rotation dial tick feedback
    playRotateTick() {
        if (this.isMuted || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1600 + Math.random() * 200, now);

        gain.gain.setValueAtTime(0.025, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.025);
    }

    // Target beacon activation resonance
    updateTargetSounds(targets) {
        if (!this.ctx || this.isMuted) return;

        // Frequencies for targets (A major triad: A4, C#5, E5)
        const freqs = {
            blue: 440,    // A4
            green: 554.37, // C#5
            orange: 659.25, // E5
            red: 659.25,
            white: 880
        };

        targets.forEach((res, idx) => {
            const color = res.target.color || 'blue';
            const id = `target_${idx}`;
            const targetFreq = freqs[color] || 440;

            if (res.active) {
                if (!this.activeTargetSynths[id]) {
                    // Start soft resonant shimmer for this target
                    const now = this.ctx.currentTime;
                    const osc = this.ctx.createOscillator();
                    const filter = this.ctx.createBiquadFilter();
                    const gain = this.ctx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(targetFreq, now);

                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(targetFreq, now);
                    filter.Q.setValueAtTime(5.0, now);

                    gain.gain.setValueAtTime(0.001, now);
                    gain.gain.setTargetAtTime(0.07, now, 0.1);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.masterGain);

                    osc.start(now);
                    this.activeTargetSynths[id] = { osc, gain, filter };
                }
            } else {
                if (this.activeTargetSynths[id]) {
                    // Fade out
                    const synth = this.activeTargetSynths[id];
                    const now = this.ctx.currentTime;
                    synth.gain.gain.setTargetAtTime(0.0001, now, 0.08);
                    setTimeout(() => {
                        try {
                            synth.osc.stop();
                            synth.osc.disconnect();
                        } catch (e) {}
                    }, 150);
                    delete this.activeTargetSynths[id];
                }
            }
        });
    }

    // Stop all active target loops
    stopAllTargetSounds() {
        for (const id in this.activeTargetSynths) {
            try {
                this.activeTargetSynths[id].osc.stop();
            } catch (e) {}
        }
        this.activeTargetSynths = {};
    }

    // Victory fanfare (crystalline arpeggio chord)
    playVictory() {
        if (this.isMuted || !this.ctx) return;
        this.resume();
        this.stopAllTargetSounds();

        const now = this.ctx.currentTime;
        // Ascending major chords: A4, C#5, E5, A5, C#6, E6
        const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];

        notes.forEach((freq, i) => {
            const noteTime = now + i * 0.08;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0.18, noteTime);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 1.2);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(noteTime);
            osc.stop(noteTime + 1.3);
        });

        // Warm sub-bass victory swell
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(110, now);
        subGain.gain.setValueAtTime(0.2, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
        subOsc.connect(subGain);
        subGain.connect(this.masterGain);
        subOsc.start(now);
        subOsc.stop(now + 1.9);
    }

    // Button click / UI sound
    playButtonClick() {
        if (this.isMuted || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    // Reset sound (descending tone)
    playReset() {
        if (this.isMuted || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.18);
    }
}

window.SoundEngine = SoundEngine;
