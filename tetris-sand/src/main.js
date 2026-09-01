import { CONFIG } from './config.js';
import { SandGrid } from './core/SandGrid.js';
import { PieceController } from './core/PieceController.js';
import { GameState, GAME_STATES, GAME_MODES } from './core/GameState.js';
import { SoundFx } from './audio/SoundFx.js';
import { ParticleSystem } from './vfx/ParticleSystem.js';
import { ScreenShake } from './vfx/ScreenShake.js';
import { HudManager } from './ui/HudManager.js';
import { TouchControls } from './ui/TouchControls.js';
import { AchievementsManager } from './core/Achievements.js';
import { PUZZLE_LEVELS } from './core/PuzzleLevels.js';

class SandTetrisApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.setupCanvasDPI();

    this.paletteKey = 'neon';
    this.palette = CONFIG.PALETTES[this.paletteKey];

    // Core Systems
    this.sandGrid = new SandGrid();
    this.gameState = new GameState();
    this.soundFx = new SoundFx();
    this.particles = new ParticleSystem();
    this.screenShake = new ScreenShake();

    // Achievements System
    this.achievements = new AchievementsManager((ach) => {
      this.soundFx.play('achievement');
      this.hud.showToast(ach.title, ach.desc, ach.icon);
    });

    this.hud = new HudManager(
      this.palette,
      (lvl) => this.startPuzzleLevel(lvl),
      () => this.hud.showAchievementsModal(this.achievements.getAll())
    );

    this.pieceController = new PieceController(
      this.sandGrid,
      (piece, bx, by) => this.onPieceLocked(piece, bx, by),
      (event, data) => this.soundFx.play(event, data)
    );

    this.keysDown = {};
    this.physicsTimer = 0;
    this.physicsInterval = 1000 / 60;
    this.lastTime = performance.now();

    this.settleDelayTimer = 0;
    this.isSettling = false;
    this.crtActive = false;

    // Mobile touch
    this.touchControls = new TouchControls({
      onLeft: () => this.pieceController.moveLeft(),
      onRight: () => this.pieceController.moveRight(),
      onDown: () => this.pieceController.softDrop(),
      onRotateCW: () => this.pieceController.rotate(true),
      onRotateCCW: () => this.pieceController.rotate(false),
      onHardDrop: () => {
        const rows = this.pieceController.hardDrop();
        if (rows > 0) {
          this.screenShake.addTrauma(0.25);
          this.soundFx.play('hardDrop');
        }
      },
      onHold: () => this.pieceController.hold()
    });

    this.initEventListeners();
    this.hud.showMenu();

    requestAnimationFrame((t) => this.loop(t));
  }

  setupCanvasDPI() {
    this.virtualWidth = 300;
    this.virtualHeight = 600;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.virtualWidth * dpr;
    this.canvas.height = this.virtualHeight * dpr;

    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;

    this.grainScaleX = this.virtualWidth / CONFIG.SAND_COLS;
    this.grainScaleY = this.virtualHeight / CONFIG.VISIBLE_SAND_ROWS;
    this.blockScaleX = this.virtualWidth / CONFIG.BLOCK_COLS;
    this.blockScaleY = this.virtualHeight / CONFIG.BLOCK_ROWS;
  }

  initEventListeners() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      this.soundFx.ensureContext();
      if (e.repeat) return;
      this.keysDown[e.code] = true;

      if (this.gameState.state === GAME_STATES.PLAYING) {
        if (e.code === 'ArrowUp' || e.code === 'KeyX') {
          this.pieceController.rotate(true);
        } else if (e.code === 'KeyZ') {
          this.pieceController.rotate(false);
        } else if (e.code === 'Space') {
          const rows = this.pieceController.hardDrop();
          if (rows > 0) {
            this.screenShake.addTrauma(0.3);
          }
        } else if (e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          this.pieceController.hold();
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
          this.togglePause();
        }
      } else if (this.gameState.state === GAME_STATES.PAUSED) {
        if (e.code === 'KeyP' || e.code === 'Escape') {
          this.togglePause();
        }
      } else if (this.gameState.state === GAME_STATES.GAMEOVER) {
        if (e.code === 'Space' || e.code === 'Enter') {
          this.startNewGame(this.gameState.mode);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown[e.code] = false;
    });

    // Theme selector
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.paletteKey = e.target.value;
        this.palette = CONFIG.PALETTES[this.paletteKey];
        this.hud.setPalette(this.palette);
      });
    }

    // CRT Toggle
    const crtBtn = document.getElementById('btn-crt-toggle');
    const crtOverlay = document.getElementById('crt-overlay');
    if (crtBtn && crtOverlay) {
      crtBtn.addEventListener('click', () => {
        this.crtActive = !this.crtActive;
        crtOverlay.classList.toggle('active', this.crtActive);
        crtBtn.style.color = this.crtActive ? 'var(--accent-cyan)' : 'var(--text-main)';
      });
    }

    // Achievements Buttons
    const achBtnTop = document.getElementById('btn-achievements-top');
    if (achBtnTop) {
      achBtnTop.addEventListener('click', () => {
        this.hud.showAchievementsModal(this.achievements.getAll());
      });
    }

    const achBtnMenu = document.getElementById('btn-menu-achievements');
    if (achBtnMenu) {
      achBtnMenu.addEventListener('click', () => {
        this.hud.showAchievementsModal(this.achievements.getAll());
      });
    }

    const closeAchBtn = document.getElementById('btn-close-achievements');
    if (closeAchBtn) {
      closeAchBtn.addEventListener('click', () => {
        this.hud.hideAchievementsModal();
      });
    }

    // Sound toggle
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isMuted = this.soundFx.toggleMute();
        soundBtn.textContent = isMuted ? '🔇' : '🔊';
      });
    }

    // Pause toggle
    const pauseBtn = document.getElementById('btn-pause-toggle');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.togglePause());
    }

    // Restart button
    const restartBtn = document.getElementById('btn-restart-game');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.startNewGame(this.gameState.mode));
    }

    // Menu mode buttons
    document.querySelectorAll('.btn-mode').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (mode === 'PUZZLE_MENU') {
          this.hud.showPuzzleModal(this.gameState.puzzleClearedLevels);
        } else {
          this.startNewGame(mode);
        }
      });
    });

    const closePuzzleBtn = document.getElementById('btn-close-puzzle');
    if (closePuzzleBtn) {
      closePuzzleBtn.addEventListener('click', () => {
        this.hud.hidePuzzleModal();
      });
    }

    // Pause modal buttons
    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.togglePause());
    }
    const restartPauseBtn = document.getElementById('btn-restart-pause');
    if (restartPauseBtn) {
      restartPauseBtn.addEventListener('click', () => this.startNewGame(this.gameState.mode));
    }
    const menuPauseBtn = document.getElementById('btn-menu-pause');
    if (menuPauseBtn) {
      menuPauseBtn.addEventListener('click', () => this.goToMenu());
    }

    // Game over modal buttons
    const playAgainBtn = document.getElementById('btn-play-again');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => this.startNewGame(this.gameState.mode));
    }
    const menuGoBtn = document.getElementById('btn-menu-gameover');
    if (menuGoBtn) {
      menuGoBtn.addEventListener('click', () => this.goToMenu());
    }
  }

  startNewGame(mode) {
    this.soundFx.ensureContext();
    this.soundFx.startBgm();
    this.sandGrid.reset();
    this.particles.reset();
    this.gameState.startNewGame(mode);
    this.pieceController.reset(this.gameState.level);

    this.hud.hideMenu();
    this.hud.hidePause();
    this.hud.hideGameOver();
    this.hud.hidePuzzleModal();
    this.hud.hideAchievementsModal();
  }

  startPuzzleLevel(lvl) {
    this.soundFx.ensureContext();
    this.soundFx.startBgm();
    this.particles.reset();
    this.gameState.startNewGame(GAME_MODES.PUZZLE);
    this.gameState.currentPuzzleIndex = lvl.id;

    lvl.setup(this.sandGrid);
    this.pieceController.reset(1, lvl.pieces);

    this.hud.hideMenu();
    this.hud.hidePuzzleModal();

    this.particles.addFloatingText(
      lvl.title,
      this.virtualWidth / 2,
      this.virtualHeight / 3,
      '#00f0ff',
      20,
      true
    );
  }

  togglePause() {
    if (this.gameState.state === GAME_STATES.PLAYING) {
      this.gameState.pause();
      this.hud.showPause();
    } else if (this.gameState.state === GAME_STATES.PAUSED) {
      this.gameState.resume();
      this.hud.hidePause();
    }
  }

  goToMenu() {
    this.gameState.state = GAME_STATES.MENU;
    this.hud.showMenu();
  }

  onPieceLocked(piece, blockX, blockY) {
    if (!piece) return;
    const levelResult = this.gameState.onPiecePlaced();
    this.isSettling = true;
    this.settleDelayTimer = 0;

    if (levelResult.leveledUp) {
      this.pieceController.updateLevelSpeed(levelResult.newLevel);
      this.soundFx.play('levelUp');
      this.screenShake.addTrauma(0.5);
      this.particles.addFloatingText(
        `🚀 NÍVEL ${levelResult.newLevel}! VELOCIDADE +`,
        this.virtualWidth / 2,
        this.virtualHeight / 2 - 20,
        '#facc15',
        22,
        true
      );
      this.hud.showToast('SUBIU DE NÍVEL!', `Nível ${levelResult.newLevel} atingido (${levelResult.piecesPlaced} peças jogadas)!`, '🚀');
    }

    const gpb = CONFIG.GRAINS_PER_BLOCK;
    const pieceCols = (piece.matrix && piece.matrix[0]) ? piece.matrix[0].length : 2;
    const pieceRows = piece.matrix ? piece.matrix.length : 2;
    const centerSandX = Math.floor((blockX + pieceCols / 2) * gpb);
    const centerSandY = Math.floor((blockY + pieceRows / 2) * gpb + this.sandGrid.hiddenOffset);

    // Check Special Power-up Pieces
    if (piece.type === 'BOMB') {
      this.gameState.bombsDetonated++;
      this.achievements.unlock('BOMB_DETONATED');
      this.soundFx.play('bomb');
      this.screenShake.addTrauma(0.85);

      this.sandGrid.detonateBomb(centerSandX, centerSandY, 24);
      this.particles.spawnBombExplosion(
        centerSandX,
        centerSandY - this.sandGrid.hiddenOffset,
        this.grainScaleX,
        this.grainScaleY
      );
      this.particles.addFloatingText(
        '💥 BOOM!',
        this.virtualWidth / 2,
        (centerSandY - this.sandGrid.hiddenOffset) * this.grainScaleY,
        '#ff3366',
        24,
        true
      );
    } else if (piece.type === 'LASER') {
      this.soundFx.play('laser');
      this.screenShake.addTrauma(0.5);
      this.sandGrid.fireLaser(centerSandY, 8);
      this.particles.spawnLaserBeam(
        centerSandY - this.sandGrid.hiddenOffset,
        this.grainScaleY,
        this.virtualWidth
      );
      this.particles.addFloatingText(
        '⚡ LASER SWEEP!',
        this.virtualWidth / 2,
        (centerSandY - this.sandGrid.hiddenOffset) * this.grainScaleY,
        '#ffea00',
        22,
        true
      );
    } else if (piece.type === 'ACID') {
      this.soundFx.play('acid');
      this.particles.spawnAcidBubbles(
        centerSandX,
        centerSandY - this.sandGrid.hiddenOffset,
        this.grainScaleX,
        this.grainScaleY
      );
    } else if (piece.type === 'RAINBOW') {
      this.soundFx.play('rainbow');
      this.gameState.rainbowsUsed++;
      this.achievements.unlock('RAINBOW_CLEAR');
    } else if (piece.type === 'MAGNET') {
      this.soundFx.play('move');
      this.sandGrid.activateMagnet(centerSandX, centerSandY, 35);
      this.screenShake.addTrauma(0.3);
    } else {
      const colorDef = this.palette.colors[piece.colorId] || { hex: '#ffffff' };
      this.particles.spawnImpactDust(
        blockX,
        blockY + 2,
        pieceCols,
        this.blockScaleX,
        this.blockScaleY,
        colorDef.hex
      );
    }

    if (this.gameState.level >= 10) {
      this.achievements.unlock('LEVEL_10');
    }

    // Check overflow / game over (unless in ZEN mode)
    if (this.gameState.mode !== GAME_MODES.ZEN && this.gameState.mode !== GAME_MODES.PUZZLE) {
      if (this.sandGrid.isOverflowing()) {
        this.handleGameOver();
        return;
      }
    }

    // Spawn next piece
    const spawned = this.pieceController.spawnNextPiece();
    if (!spawned && this.gameState.mode !== GAME_MODES.ZEN && this.gameState.mode !== GAME_MODES.PUZZLE) {
      this.handleGameOver();
    }
  }

  handleGameOver() {
    this.gameState.gameOver();
    this.soundFx.play('gameOver');
    this.screenShake.addTrauma(0.6);
    this.hud.showGameOver(this.gameState);
  }

  processSandClears() {
    const result = this.sandGrid.checkConnectedLineClears();
    if (result.cleared) {
      const scoreData = this.gameState.addSandClearScore(result);

      this.achievements.unlock('FIRST_CLEAR');
      if (scoreData.combo >= 3) this.achievements.unlock('COMBO_3');
      if (scoreData.combo >= 5) this.achievements.unlock('COMBO_5');
      if (result.usedRainbow) this.achievements.unlock('RAINBOW_CLEAR');

      this.soundFx.play('sandClear', { combo: scoreData.combo, count: result.count });
      this.screenShake.addTrauma(Math.min(0.7, 0.25 + scoreData.combo * 0.1));

      this.particles.spawnSandExplosion(
        result.positions,
        this.grainScaleX,
        this.grainScaleY,
        this.palette
      );

      let avgY = 0;
      for (const p of result.positions) avgY += p.y;
      avgY = (avgY / result.positions.length) * this.grainScaleY;

      const comboText = scoreData.combo > 1 ? ` COMBO x${scoreData.combo}!` : '';
      this.particles.addFloatingText(
        `+${scoreData.addedScore}${comboText}`,
        this.virtualWidth / 2,
        Math.max(40, avgY),
        scoreData.combo > 1 ? '#ff2a85' : '#00f0ff',
        scoreData.combo > 1 ? 22 : 18,
        scoreData.combo > 1
      );

      if (scoreData.leveledUp) {
        this.pieceController.updateLevelSpeed(this.gameState.level);
        this.soundFx.play('levelUp');
        this.particles.addFloatingText(
          `NÍVEL ${this.gameState.level}!`,
          this.virtualWidth / 2,
          this.virtualHeight / 2,
          '#facc15',
          28,
          true
        );
      }

      if (this.sandGrid.isBoardEmpty()) {
        this.achievements.unlock('PERFECT_CLEAR');
        this.gameState.score += CONFIG.SCORES.PERFECT_CLEAR_BONUS;
        this.soundFx.play('puzzleWin');
        this.particles.addFloatingText(
          '✨ ALL CLEAR! +5000',
          this.virtualWidth / 2,
          this.virtualHeight / 2 - 40,
          '#facc15',
          30,
          true
        );

        if (this.gameState.mode === GAME_MODES.PUZZLE) {
          this.achievements.unlock('PUZZLE_SOLVER');
          this.gameState.savePuzzleProgress(this.gameState.currentPuzzleIndex);
          setTimeout(() => {
            this.hud.showToast('DESAFIO CONCLUÍDO!', `Nível ${this.gameState.currentPuzzleIndex} resolvido com sucesso!`, '⭐');
            this.hud.showPuzzleModal(this.gameState.puzzleClearedLevels);
          }, 1200);
        }
      }
    }
  }

  loop(currentTime) {
    try {
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      if (this.gameState.state === GAME_STATES.PLAYING) {
        const allKeys = { ...this.keysDown, ...this.touchControls.getKeysDown() };
        this.pieceController.update(dt * 1000, allKeys);

        if (this.gameState.mode === GAME_MODES.CHAOS) {
          this.sandGrid.windForce = this.gameState.wind;
        } else {
          this.sandGrid.windForce = 0;
        }

        // Physics sub-stepping with safety cap
        this.physicsTimer += dt * 1000;
        let steps = 0;
        let anyMoved = false;
        while (this.physicsTimer >= this.physicsInterval && steps < 4) {
          steps++;
          const moved = this.sandGrid.updatePhysics(CONFIG.PHYSICS_STEPS_PER_FRAME);
          if (moved) anyMoved = true;
          this.physicsTimer -= this.physicsInterval;

          if (!moved && this.isSettling) {
            this.settleDelayTimer += this.physicsInterval;
            if (this.settleDelayTimer > 200) {
              this.isSettling = false;
              this.gameState.resetCombo();
            }
          }
        }

        // Discard backlog if stalled
        if (this.physicsTimer > this.physicsInterval * 4) {
          this.physicsTimer = 0;
        }

        // Process line clears
        this.processSandClears();

        this.gameState.update(dt);

        const fillRatio = this.sandGrid.getFillPercentage();
        this.soundFx.setDangerIntensity(fillRatio);
      }

      // VFX Updates
      this.particles.update(dt);
      this.screenShake.update(dt);

      // HUD
      this.hud.update(this.gameState, this.pieceController);

      // Canvas Render
      this.render();
    } catch (err) {
      console.error('Sand Tetris loop error:', err);
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  render() {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);

    this.screenShake.apply(this.ctx, this.virtualWidth / 2, this.virtualHeight / 2);

    // 1. Board Background
    this.ctx.fillStyle = this.palette.boardBg || '#0f172a';
    this.ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

    // Grid lines
    this.ctx.strokeStyle = this.palette.gridLines || 'rgba(255, 255, 255, 0.04)';
    this.ctx.lineWidth = 1;
    for (let c = 1; c < CONFIG.BLOCK_COLS; c++) {
      const x = c * this.blockScaleX;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.virtualHeight);
      this.ctx.stroke();
    }
    for (let r = 1; r < CONFIG.BLOCK_ROWS; r++) {
      const y = r * this.blockScaleY;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.virtualWidth, y);
      this.ctx.stroke();
    }

    // 2. Sand Grains
    this.renderSandGrains();

    // 3. Ghost Piece & Active Piece
    if (this.gameState.state === GAME_STATES.PLAYING && this.pieceController.activePiece) {
      this.renderGhostPiece();
      this.renderActivePiece();
    }

    // 4. Particles & Floating Texts
    this.particles.render(this.ctx);

    // 5. Danger overflow warning line
    if (this.gameState.mode !== GAME_MODES.ZEN) {
      const dangerY = 2 * this.blockScaleY;
      this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.moveTo(0, dangerY);
      this.ctx.lineTo(this.virtualWidth, dangerY);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    this.ctx.restore();
  }

  renderSandGrains() {
    const hiddenOffset = this.sandGrid.hiddenOffset;
    const startY = hiddenOffset;
    const endY = this.sandGrid.rows;
    const cols = this.sandGrid.cols;
    const gw = this.grainScaleX;
    const gh = this.grainScaleY;

    for (let y = startY; y < endY; y++) {
      const renderY = (y - hiddenOffset) * gh;
      for (let x = 0; x < cols; x++) {
        const idx = this.sandGrid.getIndex(x, y);
        const colorId = this.sandGrid.grid[idx];
        if (colorId === 0) continue;

        const colorDef = this.palette.colors[colorId];
        if (!colorDef) continue;

        const variation = this.sandGrid.variations[idx];
        const renderX = x * gw;

        if (colorDef.isRainbow) {
          const hue = (Date.now() / 15 + x * 5 + y * 5) % 360;
          this.ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
        } else {
          let r = colorDef.r;
          let g = colorDef.g;
          let b = colorDef.b;

          if (variation === 1) {
            r = Math.min(255, r + 20);
            g = Math.min(255, g + 20);
            b = Math.min(255, b + 20);
          } else if (variation === 2) {
            r = Math.max(0, r - 20);
            g = Math.max(0, g - 20);
            b = Math.max(0, b - 20);
          }

          this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        }

        this.ctx.fillRect(renderX, renderY, gw + 0.3, gh + 0.3);
      }
    }
  }

  renderGhostPiece() {
    const piece = this.pieceController.activePiece;
    if (!piece || !piece.matrix) return;
    const ghostY = this.pieceController.getGhostY();
    const bx = this.pieceController.x;
    const matrix = piece.matrix;
    const colorDef = this.palette.colors[piece.colorId] || { hex: '#ffffff' };

    this.ctx.save();
    this.ctx.strokeStyle = colorDef.hex;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([3, 3]);

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const px = (bx + c) * this.blockScaleX;
          const py = (ghostY + r) * this.blockScaleY;

          this.ctx.strokeRect(px + 2, py + 2, this.blockScaleX - 4, this.blockScaleY - 4);
          this.ctx.fillRect(px + 2, py + 2, this.blockScaleX - 4, this.blockScaleY - 4);
        }
      }
    }
    this.ctx.restore();
  }

  renderActivePiece() {
    const piece = this.pieceController.activePiece;
    if (!piece || !piece.matrix) return;
    const bx = this.pieceController.x;
    const by = this.pieceController.y;
    const matrix = piece.matrix;
    const colorDef = this.palette.colors[piece.colorId] || { hex: '#00f0ff' };

    this.ctx.save();
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const px = (bx + c) * this.blockScaleX;
          const py = (by + r) * this.blockScaleY;

          if (colorDef.isRainbow) {
            const hue = (Date.now() / 10 + px + py) % 360;
            this.ctx.fillStyle = `hsl(${hue}, 100%, 65%)`;
            this.ctx.shadowColor = `hsl(${hue}, 100%, 65%)`;
          } else {
            this.ctx.fillStyle = colorDef.hex;
            this.ctx.shadowColor = colorDef.hex;
          }

          this.ctx.shadowBlur = 10;
          this.ctx.beginPath();
          this.ctx.roundRect(px + 1, py + 1, this.blockScaleX - 2, this.blockScaleY - 2, 4);
          this.ctx.fill();

          this.ctx.shadowBlur = 0;
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          this.ctx.fillRect(px + 3, py + 3, this.blockScaleX - 6, (this.blockScaleY - 6) * 0.3);

          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          this.ctx.fillRect(
            px + 3,
            py + this.blockScaleY - 6 - (this.blockScaleY - 6) * 0.2,
            this.blockScaleX - 6,
            (this.blockScaleY - 6) * 0.2
          );

          if (piece.icon) {
            this.ctx.font = '16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(piece.icon, px + this.blockScaleX / 2, py + this.blockScaleY / 2);
          }
        }
      }
    }
    this.ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new SandTetrisApp();
});
