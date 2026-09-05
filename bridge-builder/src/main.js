import { BridgeSystem } from './physics/BridgeSystem.js';
import { Vehicle } from './physics/Vehicle.js';
import { Renderer } from './render/Renderer.js';
import { ParticleSystem } from './render/Particles.js';
import { SoundManager } from './audio/SoundManager.js';
import { Controls } from './ui/Controls.js';
import { PRESETS } from './archetypes/presets.js';
import { MATERIALS } from './physics/Material.js';
import { VEHICLE_TYPES } from './physics/Vehicle.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.bridge = new BridgeSystem();
    this.vehicle = new Vehicle('CAR', 70, 240);
    this.renderer = new Renderer(this.canvas);
    this.particles = new ParticleSystem();
    this.sound = new SoundManager();
    this.controls = new Controls(this.canvas, this);

    this.mode = 'BUILD'; // 'BUILD' or 'TEST'
    this.simulationSpeed = 1.0;
    this.isPaused = false;
    this.activeMaterialKey = 'STEEL';
    this.activePresetKey = 'WARREN_TRUSS';
    this.previewBeam = null;

    // Fixed timestep accumulator
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.FIXED_STEP = 1 / 60;

    this.initCallbacks();
    this.setupUI();
    this.loadPreset('WARREN_TRUSS');

    // Start game loop
    requestAnimationFrame((t) => this.loop(t));
  }

  initCallbacks() {
    this.bridge.onBeamBreak = (beam) => {
      this.sound.playSnap();
      const midX = (beam.nodeA.pos.x + beam.nodeB.pos.x) / 2;
      const midY = (beam.nodeA.pos.y + beam.nodeB.pos.y) / 2;
      this.particles.emitBeamSnap(midX, midY, beam.material.color);
    };
  }

  loadPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    this.activePresetKey = presetKey;
    preset.build(this.bridge);
    this.vehicle.reset();
    this.updateBudgetUI();
    this.updatePresetUI();
    this.updateEducationalText(preset);
  }

  updateEducationalText(preset) {
    const infoTitle = document.getElementById('archetypeTitle');
    const infoDesc = document.getElementById('archetypeDesc');
    if (infoTitle && infoDesc) {
      infoTitle.textContent = preset.name;
      infoDesc.textContent = preset.description;
    }
  }

  updateBudgetUI() {
    const costEl = document.getElementById('budgetCost');
    const beamsCountEl = document.getElementById('beamsCount');
    const nodesCountEl = document.getElementById('nodesCount');

    if (costEl) costEl.textContent = `$${this.bridge.getTotalCost().toLocaleString()}`;
    if (beamsCountEl) beamsCountEl.textContent = this.bridge.beams.length;
    if (nodesCountEl) nodesCountEl.textContent = this.bridge.nodes.length;
  }

  updatePresetUI() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === this.activePresetKey);
    });
  }

  updateStressUI() {
    const stressValEl = document.getElementById('stressVal');
    const stressBarEl = document.getElementById('stressBarFill');
    if (!stressValEl || !stressBarEl) return;

    const stressPct = Math.min(100, Math.round(this.bridge.maxStress * 100));
    stressValEl.textContent = `${stressPct}%`;
    stressBarEl.style.width = `${stressPct}%`;

    if (stressPct < 50) {
      stressBarEl.style.backgroundColor = '#22c55e';
    } else if (stressPct < 80) {
      stressBarEl.style.backgroundColor = '#eab308';
    } else if (stressPct < 95) {
      stressBarEl.style.backgroundColor = '#f97316';
    } else {
      stressBarEl.style.backgroundColor = '#ef4444';
    }
  }

  setMode(newMode) {
    this.mode = newMode;

    const buildPanel = document.getElementById('buildControlsPanel');
    const testPanel = document.getElementById('testControlsPanel');
    const playBtn = document.getElementById('btnStartTest');

    if (newMode === 'TEST') {
      this.sound.ensureContext();
      this.bridge.resetPhysics();
      this.vehicle.reset();
      if (buildPanel) buildPanel.classList.add('hidden');
      if (testPanel) testPanel.classList.remove('hidden');
      if (playBtn) playBtn.innerHTML = '🔄 Reiniciar / Editar';
    } else {
      this.bridge.resetPhysics();
      this.vehicle.reset();
      this.sound.stopAllContinuous();
      if (buildPanel) buildPanel.classList.remove('hidden');
      if (testPanel) testPanel.classList.add('hidden');
      if (playBtn) playBtn.innerHTML = '▶️ Iniciar Teste com Veículo';
    }
  }

  setupUI() {
    // Mode toggle / Start test
    const btnStart = document.getElementById('btnStartTest');
    btnStart.addEventListener('click', () => {
      if (this.mode === 'BUILD') {
        this.setMode('TEST');
      } else {
        this.setMode('BUILD');
      }
    });

    // Test controls
    document.getElementById('btnPauseSim')?.addEventListener('click', (e) => {
      this.isPaused = !this.isPaused;
      e.target.textContent = this.isPaused ? '▶️ Despausar' : '⏸️ Pausar';
    });

    document.getElementById('btnSpeedSlow')?.addEventListener('click', () => {
      this.simulationSpeed = 0.5;
      this.setActiveSpeedBtn('btnSpeedSlow');
    });
    document.getElementById('btnSpeedNormal')?.addEventListener('click', () => {
      this.simulationSpeed = 1.0;
      this.setActiveSpeedBtn('btnSpeedNormal');
    });
    document.getElementById('btnSpeedFast')?.addEventListener('click', () => {
      this.simulationSpeed = 2.0;
      this.setActiveSpeedBtn('btnSpeedFast');
    });

    document.getElementById('btnResetSim')?.addEventListener('click', () => {
      this.bridge.resetPhysics();
      this.vehicle.reset();
      this.sound.stopAllContinuous();
    });

    // Preset selector buttons (A, B, C, Livre)
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.setMode('BUILD');
        this.loadPreset(btn.dataset.preset);
      });
    });

    // Material selector buttons
    document.querySelectorAll('.material-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.activeMaterialKey = btn.dataset.material;
        document.querySelectorAll('.material-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.controls.deleteMode = false;
        document.getElementById('btnDeleteMode')?.classList.remove('active');
      });
    });

    // Delete tool button
    const btnDelete = document.getElementById('btnDeleteMode');
    btnDelete?.addEventListener('click', () => {
      this.sound.playClick();
      this.controls.deleteMode = !this.controls.deleteMode;
      btnDelete.classList.toggle('active', this.controls.deleteMode);
      if (this.controls.deleteMode) {
        document.querySelectorAll('.material-btn').forEach(b => b.classList.remove('active'));
      } else {
        const activeMatBtn = document.querySelector(`.material-btn[data-material="${this.activeMaterialKey}"]`);
        activeMatBtn?.classList.add('active');
      }
    });

    // Clear all bridge button
    document.getElementById('btnClearAll')?.addEventListener('click', () => {
      if (confirm('Deseja realmente limpar toda a ponte?')) {
        this.sound.playClick();
        this.bridge.clear();
        this.updateBudgetUI();
      }
    });

    // Vehicle selector
    document.querySelectorAll('.vehicle-card').forEach(card => {
      card.addEventListener('click', () => {
        this.sound.playClick();
        const vKey = card.dataset.vehicle;
        this.vehicle.setType(vKey);
        document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });

    // Mute toggle
    document.getElementById('btnMute')?.addEventListener('click', (e) => {
      const muted = this.sound.toggleMute();
      e.target.textContent = muted ? '🔇 Mudo' : '🔊 Som';
    });
  }

  setActiveSpeedBtn(activeId) {
    ['btnSpeedSlow', 'btnSpeedNormal', 'btnSpeedFast'].forEach(id => {
      document.getElementById(id)?.classList.toggle('active', id === activeId);
    });
  }

  loop(currentTime) {
    let frameTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (frameTime > 0.15) frameTime = 0.15; // Prevent lag spike spiral

    if (this.mode === 'TEST' && !this.isPaused) {
      this.accumulator += frameTime * this.simulationSpeed;

      while (this.accumulator >= this.FIXED_STEP) {
        // Step bridge physics
        this.bridge.update(this.FIXED_STEP);

        // Step vehicle physics
        this.vehicle.update(
          this.FIXED_STEP,
          this.bridge.beams,
          this.bridge.leftCliff,
          this.bridge.rightCliff,
          this.bridge.waterY
        );

        // Vehicle tire dust
        if (this.vehicle.rearWheelGrounded || this.vehicle.frontWheelGrounded) {
          const wheels = this.vehicle.getWheelPositions();
          this.particles.emitWheelDust(wheels.rear.x, wheels.rear.y);
        }

        // Vehicle crash splash
        if (this.vehicle.hasFallen && this.vehicle.pos.y >= this.bridge.waterY && !this.vehicle.splashed) {
          this.vehicle.splashed = true;
          this.sound.playSplash();
          this.particles.emitSplash(this.vehicle.pos.x, this.bridge.waterY);
        }

        // Victory fanfare
        if (this.vehicle.hasFinished && !this.vehicle.celebrated) {
          this.vehicle.celebrated = true;
          this.sound.playVictory();
          this.particles.emitVictoryConfetti(this.bridge.rightCliff.startX + 90, this.bridge.rightCliff.y - 30);
        }

        this.accumulator -= this.FIXED_STEP;
      }

      // Audio dynamics
      const moving = Math.abs(this.vehicle.vel.x) > 5 && !this.vehicle.hasFallen;
      const speedRatio = Math.min(1.0, Math.abs(this.vehicle.vel.x) / this.vehicle.spec.maxSpeed);
      this.sound.updateDynamicAudio(this.bridge.maxStress, moving, speedRatio);
    }

    // Step particles
    this.particles.update(frameTime);

    // Render frame
    this.renderer.render({
      bridge: this.bridge,
      vehicle: this.vehicle,
      particles: this.particles,
      mode: this.mode,
      activeMaterial: MATERIALS[this.activeMaterialKey] || MATERIALS.WOOD,
      previewBeam: this.previewBeam,
      hoveredNode: this.controls.hoveredNode,
      hoveredBeam: this.controls.hoveredBeam
    }, frameTime);

    // Update telemetry in UI
    this.updateStressUI();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
