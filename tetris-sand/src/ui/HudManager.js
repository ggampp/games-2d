import { CONFIG } from '../config.js';
import { SHAPES } from '../core/Tetromino.js';
import { SPECIAL_PIECES } from '../core/SpecialPieces.js';
import { PUZZLE_LEVELS } from '../core/PuzzleLevels.js';

export class HudManager {
  constructor(palette, onPuzzleSelect, onShowAchievements) {
    this.palette = palette;
    this.onPuzzleSelect = onPuzzleSelect || (() => {});
    this.onShowAchievements = onShowAchievements || (() => {});

    // DOM Elements
    this.scoreEl = document.getElementById('hud-score');
    this.highScoreEl = document.getElementById('hud-high-score');
    this.levelEl = document.getElementById('hud-level');
    this.linesEl = document.getElementById('hud-lines');
    this.piecesEl = document.getElementById('hud-pieces');
    this.grainsEl = document.getElementById('hud-grains');
    this.sprintTimerContainer = document.getElementById('hud-timer-container');
    this.sprintTimerEl = document.getElementById('hud-timer');
    this.windIndicator = document.getElementById('hud-wind');
    this.comboBadgeEl = document.getElementById('hud-combo-badge');
    this.comboTextEl = document.getElementById('hud-combo-text');

    // Mini Canvases
    this.holdCanvas = document.getElementById('hold-canvas');
    this.holdCtx = this.holdCanvas ? this.holdCanvas.getContext('2d') : null;

    this.next1Canvas = document.getElementById('next-1-canvas');
    this.next1Ctx = this.next1Canvas ? this.next1Canvas.getContext('2d') : null;

    this.next2Canvas = document.getElementById('next-2-canvas');
    this.next2Ctx = this.next2Canvas ? this.next2Canvas.getContext('2d') : null;

    this.next3Canvas = document.getElementById('next-3-canvas');
    this.next3Ctx = this.next3Canvas ? this.next3Canvas.getContext('2d') : null;

    // Modals
    this.menuModal = document.getElementById('modal-menu');
    this.pauseModal = document.getElementById('modal-pause');
    this.gameOverModal = document.getElementById('modal-gameover');
    this.puzzleModal = document.getElementById('modal-puzzle');
    this.achievementsModal = document.getElementById('modal-achievements');

    // Game Over stats
    this.finalScoreEl = document.getElementById('gameover-score');
    this.finalHighEl = document.getElementById('gameover-highscore');
    this.finalGrainsEl = document.getElementById('gameover-grains');
    this.finalMaxComboEl = document.getElementById('gameover-maxcombo');

    // Toast Container
    this.toastContainer = document.getElementById('toast-container');
  }

  setPalette(palette) {
    this.palette = palette;
  }

  showToast(title, desc, icon = '🏆') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-desc">${desc}</div>
      </div>
    `;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  update(gameState, pieceController) {
    if (this.scoreEl) this.scoreEl.textContent = gameState.score.toLocaleString();
    if (this.highScoreEl) this.highScoreEl.textContent = gameState.highScore.toLocaleString();
    if (this.levelEl) this.levelEl.textContent = gameState.level;
    if (this.linesEl) this.linesEl.textContent = gameState.linesCleared;
    if (this.piecesEl) {
      const nextMilestone = (Math.floor(gameState.piecesPlaced / (CONFIG.PIECES_PER_LEVEL || 50)) + 1) * (CONFIG.PIECES_PER_LEVEL || 50);
      this.piecesEl.textContent = `${gameState.piecesPlaced} / ${nextMilestone}`;
    }
    if (this.grainsEl) this.grainsEl.textContent = gameState.totalGrainsCleared.toLocaleString();

    // Wind indicator for Chaos mode
    if (this.windIndicator) {
      if (gameState.mode === 'CHAOS') {
        this.windIndicator.style.display = 'flex';
        this.windIndicator.textContent = gameState.wind < 0 ? '💨 Vento: ◀ Esquerda' : gameState.wind > 0 ? '💨 Vento: ▶ Direita' : '💨 Vento: Calmo';
      } else {
        this.windIndicator.style.display = 'none';
      }
    }

    // Timer for sprint mode
    if (this.sprintTimerContainer) {
      if (gameState.mode === 'SPRINT') {
        this.sprintTimerContainer.style.display = 'flex';
        const mins = Math.floor(gameState.sprintTimeRemaining / 60);
        const secs = Math.floor(gameState.sprintTimeRemaining % 60);
        this.sprintTimerEl.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      } else {
        this.sprintTimerContainer.style.display = 'none';
      }
    }

    // Combo badge
    if (this.comboBadgeEl) {
      if (gameState.comboCount > 1) {
        this.comboBadgeEl.classList.add('active');
        this.comboTextEl.textContent = `COMBO x${gameState.comboCount}`;
      } else {
        this.comboBadgeEl.classList.remove('active');
      }
    }

    // Render Mini Previews
    if (pieceController) {
      this.drawPiecePreview(this.holdCtx, this.holdCanvas, pieceController.holdPiece);

      if (pieceController.customQueue.length > 0) {
        this.drawPiecePreview(this.next1Ctx, this.next1Canvas, pieceController.customQueue[0]);
        this.drawPiecePreview(this.next2Ctx, this.next2Canvas, pieceController.customQueue[1]);
        this.drawPiecePreview(this.next3Ctx, this.next3Canvas, pieceController.customQueue[2]);
      } else {
        const nextPieces = pieceController.bag.peek(3);
        this.drawPiecePreview(this.next1Ctx, this.next1Canvas, nextPieces[0] ? nextPieces[0].type : null);
        this.drawPiecePreview(this.next2Ctx, this.next2Canvas, nextPieces[1] ? nextPieces[1].type : null);
        this.drawPiecePreview(this.next3Ctx, this.next3Canvas, nextPieces[2] ? nextPieces[2].type : null);
      }
    }
  }

  drawPiecePreview(ctx, canvas, pieceType) {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (!pieceType) return;

    // Check special piece first
    const special = SPECIAL_PIECES[pieceType];
    const shape = special || SHAPES[pieceType];
    if (!shape) return;

    const matrix = shape.matrix;
    const rows = matrix.length;
    const cols = matrix[0].length;

    const cellSize = Math.min((w - 20) / cols, (h - 20) / rows);
    const startX = (w - cols * cellSize) / 2;
    const startY = (h - rows * cellSize) / 2;

    const colorDef = this.palette.colors[shape.colorId] || { hex: '#00f0ff' };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c]) {
          const px = startX + c * cellSize;
          const py = startY + r * cellSize;

          ctx.fillStyle = colorDef.hex;
          ctx.shadowColor = colorDef.hex;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.roundRect(px + 1, py + 1, cellSize - 2, cellSize - 2, 4);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillRect(px + 2, py + 2, cellSize - 4, (cellSize - 4) * 0.25);
        }
      }
    }

    // If special, draw icon badge
    if (special && special.icon) {
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(special.icon, w / 2, h / 2);
    }
  }

  renderPuzzleGrid(clearedList) {
    const grid = document.getElementById('puzzle-grid');
    if (!grid) return;
    grid.innerHTML = '';

    PUZZLE_LEVELS.forEach((lvl, idx) => {
      const isCleared = clearedList.includes(lvl.id);
      const card = document.createElement('button');
      card.className = `puzzle-level-btn ${isCleared ? 'cleared' : ''}`;
      card.innerHTML = `
        <div class="lvl-num">${lvl.id}</div>
        <div class="lvl-title">${lvl.title.split(':')[1] || lvl.title}</div>
        <div class="lvl-status">${isCleared ? '⭐ Concluído' : 'Disponível'}</div>
      `;
      card.addEventListener('click', () => {
        this.onPuzzleSelect(lvl);
      });
      grid.appendChild(card);
    });
  }

  renderAchievementsList(achievementsList) {
    const list = document.getElementById('achievements-list');
    if (!list) return;
    list.innerHTML = '';

    achievementsList.forEach((ach) => {
      const item = document.createElement('div');
      item.className = `achievement-item ${ach.unlocked ? 'unlocked' : 'locked'}`;
      item.innerHTML = `
        <div class="ach-icon">${ach.unlocked ? ach.icon : '🔒'}</div>
        <div class="ach-info">
          <div class="ach-title">${ach.title}</div>
          <div class="ach-desc">${ach.desc}</div>
        </div>
        <div class="ach-status">${ach.unlocked ? 'Desbloqueado' : 'Bloqueado'}</div>
      `;
      list.appendChild(item);
    });
  }

  showMenu() {
    this.menuModal?.classList.remove('hidden');
    this.pauseModal?.classList.add('hidden');
    this.gameOverModal?.classList.add('hidden');
    this.puzzleModal?.classList.add('hidden');
    this.achievementsModal?.classList.add('hidden');
  }

  hideMenu() {
    this.menuModal?.classList.add('hidden');
  }

  showPause() {
    this.pauseModal?.classList.remove('hidden');
  }

  hidePause() {
    this.pauseModal?.classList.add('hidden');
  }

  showGameOver(gameState) {
    if (this.gameOverModal) {
      if (this.finalScoreEl) this.finalScoreEl.textContent = gameState.score.toLocaleString();
      if (this.finalHighEl) this.finalHighEl.textContent = gameState.highScore.toLocaleString();
      if (this.finalGrainsEl) this.finalGrainsEl.textContent = gameState.totalGrainsCleared.toLocaleString();
      if (this.finalMaxComboEl) this.finalMaxComboEl.textContent = `x${gameState.maxCombo}`;

      this.gameOverModal.classList.remove('hidden');
    }
  }

  hideGameOver() {
    this.gameOverModal?.classList.add('hidden');
  }

  showPuzzleModal(clearedList) {
    this.renderPuzzleGrid(clearedList);
    this.puzzleModal?.classList.remove('hidden');
  }

  hidePuzzleModal() {
    this.puzzleModal?.classList.add('hidden');
  }

  showAchievementsModal(list) {
    this.renderAchievementsList(list);
    this.achievementsModal?.classList.remove('hidden');
  }

  hideAchievementsModal() {
    this.achievementsModal?.classList.add('hidden');
  }
}
