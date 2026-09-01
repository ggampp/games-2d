import { CONFIG } from '../config.js';

export class SandGrid {
  constructor(cols = CONFIG.SAND_COLS, rows = CONFIG.SAND_ROWS, visibleRows = CONFIG.VISIBLE_SAND_ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.visibleRows = visibleRows;
    this.hiddenOffset = this.rows - this.visibleRows; // Spawn buffer at top

    // Grid data: 0 = empty, 1-7 = standard colors, 8-12 = special piece IDs
    this.grid = new Uint8Array(this.cols * this.rows);
    this.variations = new Uint8Array(this.cols * this.rows);

    // Reusable buffer for BFS to avoid GC pressure and lag
    this.visited = new Uint8Array(this.cols * this.rows);

    this.frameCount = 0;
    this.hasActiveSand = false;
    this.windForce = 0; // -1 (left wind), 0 (none), 1 (right wind)
  }

  reset() {
    this.grid.fill(0);
    this.variations.fill(0);
    this.visited.fill(0);
    this.hasActiveSand = false;
    this.windForce = 0;
  }

  getIndex(x, y) {
    return y * this.cols + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  isEmpty(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.grid[this.getIndex(x, y)] === 0;
  }

  getGrain(x, y) {
    if (!this.inBounds(x, y)) return 0;
    return this.grid[this.getIndex(x, y)];
  }

  setGrain(x, y, colorId, variation = null) {
    if (!this.inBounds(x, y)) return;
    const idx = this.getIndex(x, y);
    this.grid[idx] = colorId;
    this.variations[idx] = variation !== null ? variation : Math.floor(Math.random() * 4);
    if (colorId > 0) this.hasActiveSand = true;
  }

  isBoardEmpty() {
    for (let y = this.hiddenOffset; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[this.getIndex(x, y)] !== 0) {
          return false;
        }
      }
    }
    return true;
  }

  getFillPercentage() {
    let filled = 0;
    const totalVisible = this.cols * this.visibleRows;
    for (let y = this.hiddenOffset; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[this.getIndex(x, y)] !== 0) {
          filled++;
        }
      }
    }
    return filled / totalVisible;
  }

  depositTetromino(piece, blockX, blockY) {
    const matrix = piece.matrix;
    const colorId = piece.colorId;
    const gpb = CONFIG.GRAINS_PER_BLOCK;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const startSandX = (blockX + c) * gpb;
          const startSandY = (blockY + r) * gpb + this.hiddenOffset;

          for (let gy = 0; gy < gpb; gy++) {
            for (let gx = 0; gx < gpb; gx++) {
              const sx = startSandX + gx;
              const sy = startSandY + gy;
              if (this.inBounds(sx, sy)) {
                this.setGrain(sx, sy, colorId);
              }
            }
          }
        }
      }
    }
    this.hasActiveSand = true;
  }

  simulateStep() {
    let movedAny = false;
    this.frameCount++;
    const leftToRight = (this.frameCount + (this.windForce > 0 ? 1 : 0)) % 2 === 0;

    for (let y = this.rows - 2; y >= 0; y--) {
      const startX = leftToRight ? 0 : this.cols - 1;
      const endX = leftToRight ? this.cols : -1;
      const stepX = leftToRight ? 1 : -1;

      for (let x = startX; x !== endX; x += stepX) {
        const idx = this.getIndex(x, y);
        const color = this.grid[idx];
        if (color === 0) continue;

        const variation = this.variations[idx];

        // SPECIAL: Acid Sand (Burns through obstacles beneath it)
        if (color === CONFIG.SPECIAL_IDS.ACID) {
          if (y < this.rows - 1) {
            const belowIdx = this.getIndex(x, y + 1);
            if (this.grid[belowIdx] !== 0 && this.grid[belowIdx] !== CONFIG.SPECIAL_IDS.ACID) {
              this.grid[belowIdx] = 0;
              this.grid[idx] = 0;
              if (Math.random() < 0.6) {
                this.setGrain(x, y + 1, CONFIG.SPECIAL_IDS.ACID, variation);
              }
              movedAny = true;
              continue;
            }
          }
        }

        // 1. Direct fall down
        if (this.isEmpty(x, y + 1)) {
          this.grid[idx] = 0;
          this.setGrain(x, y + 1, color, variation);
          movedAny = true;
          continue;
        }

        // 2. Diagonal slide
        const canLeft = x > 0 && this.isEmpty(x - 1, y + 1);
        const canRight = x < this.cols - 1 && this.isEmpty(x + 1, y + 1);

        if (canLeft && canRight) {
          let goLeft = Math.random() < 0.5;
          if (this.windForce < 0) goLeft = Math.random() < 0.8;
          else if (this.windForce > 0) goLeft = Math.random() < 0.2;

          const targetX = goLeft ? x - 1 : x + 1;
          this.grid[idx] = 0;
          this.setGrain(targetX, y + 1, color, variation);
          movedAny = true;
        } else if (canLeft) {
          this.grid[idx] = 0;
          this.setGrain(x - 1, y + 1, color, variation);
          movedAny = true;
        } else if (canRight) {
          this.grid[idx] = 0;
          this.setGrain(x + 1, y + 1, color, variation);
          movedAny = true;
        }
      }
    }

    this.hasActiveSand = movedAny;
    return movedAny;
  }

  updatePhysics(steps = CONFIG.PHYSICS_STEPS_PER_FRAME) {
    let anyMoved = false;
    for (let i = 0; i < steps; i++) {
      if (this.simulateStep()) {
        anyMoved = true;
      }
    }
    return anyMoved;
  }

  detonateBomb(centerX, centerY, radius = 22) {
    const cleared = [];
    const r2 = radius * radius;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const gx = centerX + dx;
          const gy = centerY + dy;
          if (this.inBounds(gx, gy)) {
            const idx = this.getIndex(gx, gy);
            const color = this.grid[idx];
            if (color !== 0) {
              this.grid[idx] = 0;
              this.variations[idx] = 0;
              cleared.push({
                x: gx,
                y: gy - this.hiddenOffset,
                color: color
              });
            }
          }
        }
      }
    }
    this.hasActiveSand = true;
    return cleared;
  }

  fireLaser(centerY, thickness = 6) {
    const cleared = [];
    const half = Math.floor(thickness / 2);

    for (let y = centerY - half; y <= centerY + half; y++) {
      if (y >= this.hiddenOffset && y < this.rows) {
        for (let x = 0; x < this.cols; x++) {
          const idx = this.getIndex(x, y);
          const color = this.grid[idx];
          if (color !== 0) {
            this.grid[idx] = 0;
            this.variations[idx] = 0;
            cleared.push({
              x,
              y: y - this.hiddenOffset,
              color
            });
          }
        }
      }
    }
    this.hasActiveSand = true;
    return cleared;
  }

  activateMagnet(centerX, centerY, radius = 30) {
    const r2 = radius * radius;
    let pulledCount = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const gx = centerX + dx;
          const gy = centerY + dy;
          if (this.inBounds(gx, gy)) {
            const idx = this.getIndex(gx, gy);
            const color = this.grid[idx];
            if (color > 0 && color !== CONFIG.SPECIAL_IDS.MAGNET) {
              const stepX = gx < centerX ? 1 : gx > centerX ? -1 : 0;
              const stepY = gy < centerY ? 1 : gy > centerY ? -1 : 0;
              const targetX = gx + stepX;
              const targetY = gy + stepY;

              if (this.inBounds(targetX, targetY) && this.isEmpty(targetX, targetY)) {
                this.grid[idx] = 0;
                this.setGrain(targetX, targetY, color, this.variations[idx]);
                pulledCount++;
              }
            }
          }
        }
      }
    }
    this.hasActiveSand = true;
    return pulledCount;
  }

  checkConnectedLineClears() {
    this.visited.fill(0);
    const visited = this.visited;
    const clustersToClear = [];
    let totalGrainsCleared = 0;
    const clearedColors = new Set();
    let usedRainbow = false;

    const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dy = [-1, -1, -1, 0, 0, 1, 1, 1];
    const rainbowId = CONFIG.SPECIAL_IDS.RAINBOW;

    for (let y = this.hiddenOffset; y < this.rows; y++) {
      const startIdx = this.getIndex(0, y);
      const startColor = this.grid[startIdx];

      if (startColor === 0 || visited[startIdx]) continue;

      const queue = [{ x: 0, y }];
      visited[startIdx] = 1;

      const cluster = [{ x: 0, y }];
      let reachedRightWall = false;
      let dominantColor = startColor === rainbowId ? null : startColor;

      let head = 0;
      while (head < queue.length) {
        const { x: cx, y: cy } = queue[head++];

        if (cx === this.cols - 1) {
          reachedRightWall = true;
        }

        for (let d = 0; d < 8; d++) {
          const nx = cx + dx[d];
          const ny = cy + dy[d];

          if (this.inBounds(nx, ny) && ny >= this.hiddenOffset) {
            const nIdx = this.getIndex(nx, ny);
            const nColor = this.grid[nIdx];

            if (!visited[nIdx] && nColor !== 0) {
              const isMatch =
                dominantColor === null ||
                nColor === dominantColor ||
                nColor === rainbowId ||
                dominantColor === rainbowId;

              if (isMatch) {
                if (dominantColor === null && nColor !== rainbowId) {
                  dominantColor = nColor;
                }
                if (nColor === rainbowId) {
                  usedRainbow = true;
                }
                visited[nIdx] = 1;
                queue.push({ x: nx, y: ny });
                cluster.push({ x: nx, y: ny });
              }
            }
          }
        }
      }

      if (reachedRightWall) {
        clustersToClear.push({
          color: dominantColor || 1,
          grains: cluster
        });
        clearedColors.add(dominantColor || 1);
        totalGrainsCleared += cluster.length;
      }
    }

    if (clustersToClear.length > 0) {
      const clearedPositions = [];
      for (const group of clustersToClear) {
        for (const pt of group.grains) {
          const idx = this.getIndex(pt.x, pt.y);
          this.grid[idx] = 0;
          this.variations[idx] = 0;
          clearedPositions.push({
            x: pt.x,
            y: pt.y - this.hiddenOffset,
            color: group.color
          });
        }
      }

      this.hasActiveSand = true;
      return {
        cleared: true,
        count: totalGrainsCleared,
        colors: Array.from(clearedColors),
        clusters: clustersToClear.length,
        positions: clearedPositions,
        usedRainbow
      };
    }

    return { cleared: false, count: 0, colors: [], clusters: 0, positions: [], usedRainbow: false };
  }

  isOverflowing() {
    for (let y = 0; y < this.hiddenOffset + 2; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[this.getIndex(x, y)] !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  collidesWithPiece(piece, blockX, blockY) {
    if (!piece || !piece.matrix) return false;
    const matrix = piece.matrix;
    const gpb = CONFIG.GRAINS_PER_BLOCK;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const bX = blockX + c;
          const bY = blockY + r;

          if (bX < 0 || bX >= CONFIG.BLOCK_COLS) return true;
          if (bY >= CONFIG.BLOCK_ROWS) return true;

          const startSandX = bX * gpb;
          const startSandY = bY * gpb + this.hiddenOffset;

          for (let gy = 0; gy < gpb; gy++) {
            for (let gx = 0; gx < gpb; gx++) {
              const sx = startSandX + gx;
              const sy = startSandY + gy;
              if (this.inBounds(sx, sy) && this.grid[this.getIndex(sx, sy)] !== 0) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }
}
