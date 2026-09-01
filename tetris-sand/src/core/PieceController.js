import { CONFIG } from '../config.js';
import { BagRandomizer, Tetromino, SHAPES } from './Tetromino.js';
import { getRandomSpecialPiece, createSpecialPiece } from './SpecialPieces.js';

export class PieceController {
  constructor(sandGrid, onLockPiece, onSoundEvent) {
    this.sandGrid = sandGrid;
    this.onLockPiece = onLockPiece;
    this.onSoundEvent = onSoundEvent || (() => {});

    this.bag = new BagRandomizer();
    this.activePiece = null;
    this.x = 0;
    this.y = 0;

    this.holdPiece = null;
    this.canHold = true;

    // Timers & Lock delay safety
    this.gravityTimer = 0;
    this.gravityInterval = CONFIG.BASE_GRAVITY_INTERVAL;
    this.lockTimer = 0;
    this.isLocking = false;
    this.lockResets = 0;
    this.MAX_LOCK_RESETS = 15; // Standard guideline to prevent lock stalls

    // Input States & DAS/ARR
    this.keys = {};
    this.dasTimer = { left: 0, right: 0, down: 0 };
    this.arrTimer = { left: 0, right: 0, down: 0 };

    // Puzzle & Power-up Queue
    this.customQueue = [];
    this.powerupsEnabled = true;
    this.pieceCountSincePowerup = 0;

    this.spawnNextPiece();
  }

  reset(level = 1, customPieceList = null) {
    this.bag.reset();
    this.holdPiece = null;
    this.canHold = true;
    this.pieceCountSincePowerup = 0;
    this.lockResets = 0;
    this.customQueue = customPieceList ? [...customPieceList] : [];
    this.updateLevelSpeed(level);
    return this.spawnNextPiece();
  }

  updateLevelSpeed(level) {
    const speed = Math.max(
      CONFIG.MIN_GRAVITY_INTERVAL,
      Math.floor(CONFIG.BASE_GRAVITY_INTERVAL * Math.pow(0.80, level - 1))
    );
    this.gravityInterval = speed;
    this.lockDelay = Math.max(
      CONFIG.MIN_LOCK_DELAY_MS,
      CONFIG.LOCK_DELAY_MS - (level - 1) * 18
    );
  }

  spawnNextPiece() {
    this.lockResets = 0;
    if (this.customQueue.length > 0) {
      const nextType = this.customQueue.shift();
      this.activePiece = new Tetromino(nextType);
    } else {
      this.pieceCountSincePowerup++;
      // Spawn random special piece every 7 pieces or by chance
      if (this.powerupsEnabled && (this.pieceCountSincePowerup >= 7 || Math.random() < CONFIG.POWERUP_SPAWN_CHANCE)) {
        this.activePiece = getRandomSpecialPiece();
        this.pieceCountSincePowerup = 0;
      } else {
        this.activePiece = this.bag.next();
      }
    }

    if (!this.activePiece) {
      this.activePiece = new Tetromino('I');
    }

    this.x = Math.floor((CONFIG.BLOCK_COLS - this.activePiece.matrix[0].length) / 2);
    this.y = 0;
    this.lockTimer = 0;
    this.isLocking = false;
    this.canHold = true;

    if (this.sandGrid.collidesWithPiece(this.activePiece, this.x, this.y)) {
      return false; // Cannot spawn -> GameOver
    }
    return true;
  }

  hold() {
    if (!this.canHold || !this.activePiece) return false;

    this.onSoundEvent('hold');
    const currentType = this.activePiece.type;

    if (this.holdPiece === null) {
      this.holdPiece = currentType;
      this.spawnNextPiece();
    } else {
      const prevHold = this.holdPiece;
      this.holdPiece = currentType;
      this.activePiece = new Tetromino(prevHold);
      this.x = Math.floor((CONFIG.BLOCK_COLS - this.activePiece.matrix[0].length) / 2);
      this.y = 0;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.isLocking = false;
    }

    this.canHold = false;
    return true;
  }

  moveLeft() {
    if (!this.activePiece) return false;
    if (!this.sandGrid.collidesWithPiece(this.activePiece, this.x - 1, this.y)) {
      this.x--;
      this.resetLockDelayIfMoved();
      this.onSoundEvent('move');
      return true;
    }
    return false;
  }

  moveRight() {
    if (!this.activePiece) return false;
    if (!this.sandGrid.collidesWithPiece(this.activePiece, this.x + 1, this.y)) {
      this.x++;
      this.resetLockDelayIfMoved();
      this.onSoundEvent('move');
      return true;
    }
    return false;
  }

  rotate(clockwise = true) {
    if (!this.activePiece) return false;

    const testPiece = this.activePiece.clone();
    testPiece.rotate(clockwise);

    const kicks = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [-2, 0],
      [2, 0],
      [0, -1],
      [-1, -1],
      [1, -1]
    ];

    for (const [kx, ky] of kicks) {
      if (!this.sandGrid.collidesWithPiece(testPiece, this.x + kx, this.y + ky)) {
        this.activePiece = testPiece;
        this.x += kx;
        this.y += ky;
        this.resetLockDelayIfMoved();
        this.onSoundEvent('rotate');
        return true;
      }
    }

    return false;
  }

  softDrop() {
    if (!this.activePiece) return false;
    if (!this.sandGrid.collidesWithPiece(this.activePiece, this.x, this.y + 1)) {
      this.y++;
      this.lockTimer = 0;
      return true;
    } else {
      this.isLocking = true;
      return false;
    }
  }

  hardDrop() {
    if (!this.activePiece) return 0;
    let dropRows = 0;
    while (!this.sandGrid.collidesWithPiece(this.activePiece, this.x, this.y + 1)) {
      this.y++;
      dropRows++;
    }

    this.onSoundEvent('hardDrop');
    this.lockPieceInstantly();
    return dropRows;
  }

  getGhostY() {
    if (!this.activePiece) return this.y;
    let gy = this.y;
    while (!this.sandGrid.collidesWithPiece(this.activePiece, this.x, gy + 1)) {
      gy++;
    }
    return gy;
  }

  resetLockDelayIfMoved() {
    if (this.isLocking) {
      if (this.lockResets < this.MAX_LOCK_RESETS) {
        this.lockTimer = 0;
        this.lockResets++;
      }
    }
  }

  lockPieceInstantly() {
    if (!this.activePiece) return;

    const piece = this.activePiece;
    const blockX = this.x;
    const blockY = this.y;

    this.sandGrid.depositTetromino(piece, blockX, blockY);

    this.activePiece = null;
    this.isLocking = false;
    this.lockTimer = 0;
    this.lockResets = 0;

    if (this.onLockPiece) {
      this.onLockPiece(piece, blockX, blockY);
    }
  }

  update(deltaTime, keysDown) {
    if (!this.activePiece) return;

    this.handleHorizontalInput(deltaTime, keysDown);

    const isSoftDropping = keysDown['ArrowDown'] || keysDown['KeyS'];
    const currentInterval = isSoftDropping
      ? this.gravityInterval / CONFIG.SOFT_DROP_MULTIPLIER
      : this.gravityInterval;

    this.gravityTimer += deltaTime;
    if (this.gravityTimer >= currentInterval) {
      this.gravityTimer = 0;
      const moved = this.softDrop();
      if (isSoftDropping && moved) {
        this.onSoundEvent('softDrop');
      }
    }

    const onGround = this.sandGrid.collidesWithPiece(this.activePiece, this.x, this.y + 1);
    if (onGround) {
      this.isLocking = true;
      this.lockTimer += deltaTime;
      if (this.lockTimer >= (this.lockDelay || CONFIG.LOCK_DELAY_MS)) {
        this.onSoundEvent('lock');
        this.lockPieceInstantly();
      }
    } else {
      this.isLocking = false;
      this.lockTimer = 0;
    }
  }

  handleHorizontalInput(deltaTime, keysDown) {
    const leftDown = keysDown['ArrowLeft'] || keysDown['KeyA'];
    const rightDown = keysDown['ArrowRight'] || keysDown['KeyD'];

    if (leftDown && !rightDown) {
      if (this.dasTimer.left === 0) {
        this.moveLeft();
        this.dasTimer.left += deltaTime;
      } else {
        this.dasTimer.left += deltaTime;
        if (this.dasTimer.left >= CONFIG.DAS) {
          this.arrTimer.left += deltaTime;
          if (this.arrTimer.left >= CONFIG.ARR) {
            this.moveLeft();
            this.arrTimer.left = 0;
          }
        }
      }
    } else {
      this.dasTimer.left = 0;
      this.arrTimer.left = 0;
    }

    if (rightDown && !leftDown) {
      if (this.dasTimer.right === 0) {
        this.moveRight();
        this.dasTimer.right += deltaTime;
      } else {
        this.dasTimer.right += deltaTime;
        if (this.dasTimer.right >= CONFIG.DAS) {
          this.arrTimer.right += deltaTime;
          if (this.arrTimer.right >= CONFIG.ARR) {
            this.moveRight();
            this.arrTimer.right = 0;
          }
        }
      }
    } else {
      this.dasTimer.right = 0;
      this.arrTimer.right = 0;
    }
  }
}
