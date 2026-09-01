import { SHAPES, Tetromino } from './Tetromino.js';

export const SPECIAL_PIECES = {
  BOMB: SHAPES.BOMB,
  RAINBOW: SHAPES.RAINBOW,
  ACID: SHAPES.ACID,
  LASER: SHAPES.LASER,
  MAGNET: SHAPES.MAGNET
};

export function createSpecialPiece(type) {
  if (!SPECIAL_PIECES[type]) return null;
  return new Tetromino(type);
}

export function getRandomSpecialPiece() {
  const types = Object.keys(SPECIAL_PIECES);
  const picked = types[Math.floor(Math.random() * types.length)];
  return new Tetromino(picked);
}
