import { CONFIG } from '../config.js';

export const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER',
  PUZZLE_SELECT: 'PUZZLE_SELECT',
  ACHIEVEMENTS: 'ACHIEVEMENTS'
};

export const GAME_MODES = {
  CLASSIC: 'CLASSIC',
  ZEN: 'ZEN',
  SPRINT: 'SPRINT',
  PUZZLE: 'PUZZLE',
  CHAOS: 'CHAOS'
};

export class GameState {
  constructor() {
    this.state = GAME_STATES.MENU;
    this.mode = GAME_MODES.CLASSIC;
    this.paletteKey = 'neon';

    this.score = 0;
    this.highScore = this.loadHighScore();
    this.level = 1;
    this.linesCleared = 0;
    this.totalGrainsCleared = 0;

    this.comboCount = 0;
    this.maxCombo = 0;
    this.cascadeCount = 0;

    // Sprint Mode Timer (120 seconds)
    this.sprintTimeRemaining = 120;

    // Puzzle Mode
    this.currentPuzzleIndex = 0;
    this.puzzlePiecesRemaining = 0;
    this.puzzleClearedLevels = this.loadPuzzleProgress();

    // Stats for achievements
    this.bombsDetonated = 0;
    this.rainbowsUsed = 0;
    this.piecesPlaced = 0;

    // Chaos Mode Wind
    this.wind = 0;
    this.windTimer = 0;
  }

  loadHighScore() {
    try {
      const saved = localStorage.getItem(`sand_tetris_highscore_${this.mode}`);
      return saved ? parseInt(saved, 10) : 0;
    } catch (e) {
      return 0;
    }
  }

  saveHighScore() {
    try {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem(`sand_tetris_highscore_${this.mode}`, this.highScore.toString());
        return true;
      }
    } catch (e) {}
    return false;
  }

  loadPuzzleProgress() {
    try {
      const saved = localStorage.getItem('sand_tetris_puzzle_progress');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  savePuzzleProgress(levelId) {
    try {
      if (!this.puzzleClearedLevels.includes(levelId)) {
        this.puzzleClearedLevels.push(levelId);
        localStorage.setItem('sand_tetris_puzzle_progress', JSON.stringify(this.puzzleClearedLevels));
      }
    } catch (e) {}
  }

  setMode(mode) {
    this.mode = mode;
    this.highScore = this.loadHighScore();
  }

  startNewGame(mode = null) {
    if (mode) this.setMode(mode);
    this.state = GAME_STATES.PLAYING;
    this.score = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.totalGrainsCleared = 0;
    this.comboCount = 0;
    this.maxCombo = 0;
    this.cascadeCount = 0;
    this.piecesPlaced = 0;
    this.sprintTimeRemaining = 120;
    this.wind = 0;
    this.windTimer = 0;
    this.highScore = this.loadHighScore();
  }

  pause() {
    if (this.state === GAME_STATES.PLAYING) {
      this.state = GAME_STATES.PAUSED;
    }
  }

  resume() {
    if (this.state === GAME_STATES.PAUSED) {
      this.state = GAME_STATES.PLAYING;
    }
  }

  gameOver() {
    this.state = GAME_STATES.GAMEOVER;
    this.saveHighScore();
  }

  onPiecePlaced() {
    this.piecesPlaced++;
    if (this.mode === GAME_MODES.CLASSIC || this.mode === GAME_MODES.CHAOS) {
      const pieceLevel = 1 + Math.floor(this.piecesPlaced / (CONFIG.PIECES_PER_LEVEL || 50));
      const linesLevel = 1 + Math.floor(this.linesCleared / 6);
      const targetLevel = Math.max(pieceLevel, linesLevel);

      if (targetLevel > this.level) {
        this.level = Math.min(30, targetLevel);
        return { leveledUp: true, newLevel: this.level, piecesPlaced: this.piecesPlaced };
      }
    }
    return { leveledUp: false, newLevel: this.level, piecesPlaced: this.piecesPlaced };
  }

  addSandClearScore(clearResult) {
    this.comboCount++;
    if (this.comboCount > this.maxCombo) {
      this.maxCombo = this.comboCount;
    }

    const grainPoints = clearResult.count * CONFIG.SCORES.GRAIN_CLEARED;
    const baseLinesEquivalent = clearResult.clusters * CONFIG.SCORES.FULL_ROW_EQUIV;
    const comboMult = 1 + (this.comboCount - 1) * 0.5;

    const addedScore = Math.floor((grainPoints + baseLinesEquivalent) * comboMult * this.level);
    this.score += addedScore;
    this.linesCleared += clearResult.clusters;
    this.totalGrainsCleared += clearResult.count;

    if (this.mode === GAME_MODES.CLASSIC || this.mode === GAME_MODES.CHAOS) {
      const pieceLevel = 1 + Math.floor(this.piecesPlaced / (CONFIG.PIECES_PER_LEVEL || 50));
      const linesLevel = 1 + Math.floor(this.linesCleared / 6);
      const targetLevel = Math.max(pieceLevel, linesLevel);
      const leveledUp = targetLevel > this.level;
      this.level = Math.min(30, targetLevel);
      return { addedScore, leveledUp, combo: this.comboCount, newLevel: this.level };
    }

    return { addedScore, leveledUp: false, combo: this.comboCount, newLevel: this.level };
  }

  resetCombo() {
    this.comboCount = 0;
  }

  update(dt) {
    if (this.state === GAME_STATES.PLAYING) {
      // Sprint timer
      if (this.mode === GAME_MODES.SPRINT) {
        this.sprintTimeRemaining -= dt;
        if (this.sprintTimeRemaining <= 0) {
          this.sprintTimeRemaining = 0;
          this.gameOver();
        }
      }

      // Chaos wind oscillations
      if (this.mode === GAME_MODES.CHAOS) {
        this.windTimer += dt;
        if (this.windTimer > 4.0) {
          this.windTimer = 0;
          const options = [-1, 0, 1];
          this.wind = options[Math.floor(Math.random() * options.length)];
        }
      }
    }
  }
}
