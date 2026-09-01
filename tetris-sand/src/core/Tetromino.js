import { CONFIG } from '../config.js';

// Tetromino & Special Power-up Piece Definitions (All square matrices for SRS rotation)
export const SHAPES = {
  I: {
    type: 'I',
    colorId: 1,
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  J: {
    type: 'J',
    colorId: 2,
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  L: {
    type: 'L',
    colorId: 3,
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  O: {
    type: 'O',
    colorId: 4,
    matrix: [
      [1, 1],
      [1, 1]
    ]
  },
  S: {
    type: 'S',
    colorId: 5,
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  T: {
    type: 'T',
    colorId: 6,
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  Z: {
    type: 'Z',
    colorId: 7,
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  },
  // Special Power-up Pieces
  BOMB: {
    type: 'BOMB',
    colorId: CONFIG.SPECIAL_IDS.BOMB,
    icon: '💣',
    name: 'Bomba',
    isSpecial: true,
    matrix: [
      [1, 1],
      [1, 1]
    ]
  },
  RAINBOW: {
    type: 'RAINBOW',
    colorId: CONFIG.SPECIAL_IDS.RAINBOW,
    icon: '🌈',
    name: 'Areia Arco-Íris',
    isSpecial: true,
    matrix: [
      [1, 1],
      [1, 1]
    ]
  },
  ACID: {
    type: 'ACID',
    colorId: CONFIG.SPECIAL_IDS.ACID,
    icon: '🧪',
    name: 'Areia Ácida',
    isSpecial: true,
    matrix: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0]
    ]
  },
  LASER: {
    type: 'LASER',
    colorId: CONFIG.SPECIAL_IDS.LASER,
    icon: '⚡',
    name: 'Laser Beam',
    isSpecial: true,
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  MAGNET: {
    type: 'MAGNET',
    colorId: CONFIG.SPECIAL_IDS.MAGNET,
    icon: '🧲',
    name: 'Ímã de Areia',
    isSpecial: true,
    matrix: [
      [1, 1],
      [1, 1]
    ]
  }
};

export class Tetromino {
  constructor(type) {
    const proto = SHAPES[type] || SHAPES['I'];
    this.type = proto.type;
    this.colorId = proto.colorId;
    this.icon = proto.icon || null;
    this.name = proto.name || proto.type;
    this.isSpecial = !!proto.isSpecial;
    this.matrix = proto.matrix.map(row => [...row]);
    this.rotation = 0;
  }

  clone() {
    const copy = new Tetromino(this.type);
    copy.colorId = this.colorId;
    copy.icon = this.icon;
    copy.name = this.name;
    copy.isSpecial = this.isSpecial;
    copy.matrix = this.matrix.map(row => [...row]);
    copy.rotation = this.rotation;
    return copy;
  }

  rotate(clockwise = true) {
    const N = this.matrix.length;
    const result = Array.from({ length: N }, () => new Array(N).fill(0));

    if (clockwise) {
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          result[c][N - 1 - r] = this.matrix[r][c];
        }
      }
      this.rotation = (this.rotation + 1) % 4;
    } else {
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          result[N - 1 - c][r] = this.matrix[r][c];
        }
      }
      this.rotation = (this.rotation + 3) % 4;
    }

    this.matrix = result;
  }
}

/**
 * 7-Bag Randomizer Generator
 */
export class BagRandomizer {
  constructor() {
    this.bag = [];
  }

  reset() {
    this.bag = [];
  }

  next() {
    if (this.bag.length === 0) {
      this.refill();
    }
    const type = this.bag.pop();
    return new Tetromino(type);
  }

  peek(count = 3) {
    while (this.bag.length < count) {
      this.refill();
    }
    const result = [];
    for (let i = 0; i < count; i++) {
      const type = this.bag[this.bag.length - 1 - i];
      result.push(new Tetromino(type));
    }
    return result;
  }

  refill() {
    const pieces = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    this.bag.unshift(...pieces);
  }
}
