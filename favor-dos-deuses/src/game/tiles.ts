import Phaser from "phaser";
import { TILE_SIZE } from "../data/constants";

/**
 * Desenha tiles numa única RenderTexture (1 draw call) em vez de milhares
 * de Images. Coordenadas em tiles.
 */
export class TileCanvas {
  readonly rt: Phaser.GameObjects.RenderTexture;

  constructor(scene: Phaser.Scene, widthPx: number, heightPx: number, depth: number) {
    this.rt = scene.add.renderTexture(0, 0, widthPx, heightPx).setOrigin(0).setDepth(depth);
  }

  draw(key: string, frame: string | number, tx: number, ty: number, alpha = 1): void {
    this.rt.drawFrame(key, frame, tx * TILE_SIZE, ty * TILE_SIZE, alpha);
  }

  /** Preenche um retângulo de tiles; pick(tx,ty) escolhe o frame */
  fill(key: string, c0: number, r0: number, cols: number, rows: number, pick: (tx: number, ty: number) => string | number): void {
    this.rt.beginDraw();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.rt.batchDrawFrame(key, pick(c0 + c, r0 + r), (c0 + c) * TILE_SIZE, (r0 + r) * TILE_SIZE);
      }
    }
    this.rt.endDraw();
  }

  /**
   * "Mancha" com bordas: frames9 = [TL,T,TR, L,C,R, BL,B,BR]
   * cols/rows >= 2. Usado para caminhos de terra e canteiros.
   */
  blob(key: string, frames9: number[], c0: number, r0: number, cols: number, rows: number): void {
    const [TL, T, TR, L, C, R, BL, B, BR] = frames9;
    this.rt.beginDraw();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const top = r === 0;
        const bottom = r === rows - 1;
        const left = c === 0;
        const right = c === cols - 1;
        let f = C;
        if (top && left) f = TL;
        else if (top && right) f = TR;
        else if (bottom && left) f = BL;
        else if (bottom && right) f = BR;
        else if (top) f = T;
        else if (bottom) f = B;
        else if (left) f = L;
        else if (right) f = R;
        this.rt.batchDrawFrame(key, f, (c0 + c) * TILE_SIZE, (r0 + r) * TILE_SIZE);
      }
    }
    this.rt.endDraw();
  }

  /** Cor sólida em retângulo de tiles (fallback sem assets) */
  solid(color: number, c0: number, r0: number, cols: number, rows: number, alpha = 1): void {
    this.rt.fill(color, alpha, c0 * TILE_SIZE, r0 * TILE_SIZE, cols * TILE_SIZE, rows * TILE_SIZE);
  }
}

/** Escolha determinística-ish com peso para o primeiro frame (o "liso") */
export function pickWeighted(frames: number[], plainWeight = 0.75): number {
  if (Math.random() < plainWeight) return frames[0];
  return frames[Phaser.Math.Between(0, frames.length - 1)];
}
