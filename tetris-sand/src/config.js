// Sand Tetris Game Configuration, Constants & Palettes

export const CONFIG = {
  // Tetris Grid dimensions (in tetromino blocks)
  BLOCK_COLS: 10,
  BLOCK_ROWS: 20,
  BUFFER_ROWS: 4, // Invisible spawn buffer above board

  // Sand Simulation Grid Resolution
  GRAINS_PER_BLOCK: 10, // 1 tetromino block = 10x10 sand grains
  get SAND_COLS() {
    return this.BLOCK_COLS * this.GRAINS_PER_BLOCK; // 100 grains wide
  },
  get SAND_ROWS() {
    return (this.BLOCK_ROWS + this.BUFFER_ROWS) * this.GRAINS_PER_BLOCK; // 240 grains high
  },
  get VISIBLE_SAND_ROWS() {
    return this.BLOCK_ROWS * this.GRAINS_PER_BLOCK; // 200 visible grains high
  },

  // Physics Simulation
  PHYSICS_STEPS_PER_FRAME: 2,
  ANGLE_OF_REPOSE: 1,
  INERTIA_ENABLED: true,

  // Special Piece IDs
  SPECIAL_IDS: {
    BOMB: 8,
    RAINBOW: 9,
    ACID: 10,
    LASER: 11,
    MAGNET: 12
  },

  // Gameplay Settings
  PIECES_PER_LEVEL: 50,       // Every 50 pieces increases difficulty & speed
  BASE_GRAVITY_INTERVAL: 800, // ms per block fall at Level 1
  MIN_GRAVITY_INTERVAL: 50,   // ms per block fall at max level
  SOFT_DROP_MULTIPLIER: 12,
  LOCK_DELAY_MS: 450,
  MIN_LOCK_DELAY_MS: 220,     // Tight lock delay at high levels
  DAS: 130,
  ARR: 30,
  POWERUP_SPAWN_CHANCE: 0.15, // 15% chance to spawn a special piece in normal/chaos modes

  // Scoring
  SCORES: {
    GRAIN_CLEARED: 2,
    FULL_ROW_EQUIV: 200,
    COMBO_MULTIPLIER: 1.5,
    HARD_DROP_PER_ROW: 2,
    SOFT_DROP_PER_ROW: 1,
    PERFECT_CLEAR_BONUS: 5000,
    PUZZLE_CLEAR_BONUS: 10000
  },

  // Color Palettes
  PALETTES: {
    neon: {
      name: 'Cyber Neon',
      background: '#0a0d1a',
      boardBg: '#10162a',
      gridLines: 'rgba(255, 255, 255, 0.04)',
      borderGlow: '#00f0ff',
      colors: {
        1: { name: 'Cyan (I)', hex: '#00f0ff', r: 0, g: 240, b: 255 },
        2: { name: 'Blue (J)', hex: '#3b82f6', r: 59, g: 130, b: 246 },
        3: { name: 'Orange (L)', hex: '#f97316', r: 249, g: 115, b: 22 },
        4: { name: 'Yellow (O)', hex: '#facc15', r: 250, g: 204, b: 21 },
        5: { name: 'Green (S)', hex: '#10b981', r: 16, g: 185, b: 129 },
        6: { name: 'Purple (T)', hex: '#a855f7', r: 168, g: 85, b: 247 },
        7: { name: 'Red (Z)', hex: '#ef4444', r: 239, g: 68, b: 68 },
        // Special piece colors
        8: { name: 'Bomb', hex: '#ff3366', r: 255, g: 51, b: 102 },
        9: { name: 'Rainbow', hex: '#ffffff', r: 255, g: 255, b: 255, isRainbow: true },
        10: { name: 'Acid', hex: '#39ff14', r: 57, g: 255, b: 20 },
        11: { name: 'Laser', hex: '#ffea00', r: 255, g: 234, b: 0 },
        12: { name: 'Magnet', hex: '#00e5ff', r: 0, g: 229, b: 255 }
      }
    },
    vaporwave: {
      name: 'Vaporwave 80s',
      background: '#180a2a',
      boardBg: '#241038',
      gridLines: 'rgba(255, 0, 128, 0.08)',
      borderGlow: '#ff007f',
      colors: {
        1: { name: 'Hot Cyan', hex: '#05ffa1', r: 5, g: 255, b: 161 },
        2: { name: 'Neon Purple', hex: '#b967ff', r: 185, g: 103, b: 255 },
        3: { name: 'Sunset Orange', hex: '#ff71ce', r: 255, g: 113, b: 206 },
        4: { name: 'Laser Yellow', hex: '#fffb96', r: 255, g: 251, b: 150 },
        5: { name: 'Mint Glow', hex: '#01cdfe', r: 1, g: 205, b: 254 },
        6: { name: 'Electric Magenta', hex: '#d600ff', r: 214, g: 0, b: 255 },
        7: { name: 'Crimson Wave', hex: '#ff3864', r: 255, g: 56, b: 100 },
        8: { name: 'Bomb', hex: '#ff0055', r: 255, g: 0, b: 85 },
        9: { name: 'Rainbow', hex: '#ffffff', r: 255, g: 255, b: 255, isRainbow: true },
        10: { name: 'Acid', hex: '#05ffa1', r: 5, g: 255, b: 161 },
        11: { name: 'Laser', hex: '#fffb96', r: 255, g: 251, b: 150 },
        12: { name: 'Magnet', hex: '#01cdfe', r: 1, g: 205, b: 254 }
      }
    },
    sahara: {
      name: 'Sahara Dunes',
      background: '#19110b',
      boardBg: '#291b12',
      gridLines: 'rgba(245, 158, 11, 0.06)',
      borderGlow: '#f59e0b',
      colors: {
        1: { name: 'Oasis Teal', hex: '#0d9488', r: 13, g: 148, b: 136 },
        2: { name: 'Dune Terracotta', hex: '#ea580c', r: 234, g: 88, b: 12 },
        3: { name: 'Desert Amber', hex: '#d97706', r: 217, g: 119, b: 6 },
        4: { name: 'Golden Sand', hex: '#eab308', r: 234, g: 179, b: 8 },
        5: { name: 'Palm Green', hex: '#15803d', r: 21, g: 128, b: 61 },
        6: { name: 'Sunset Clay', hex: '#b45309', r: 180, g: 83, b: 9 },
        7: { name: 'Desert Spice', hex: '#be123c', r: 190, g: 18, b: 60 },
        8: { name: 'Bomb', hex: '#dc2626', r: 220, g: 38, b: 38 },
        9: { name: 'Rainbow', hex: '#ffffff', r: 255, g: 255, b: 255, isRainbow: true },
        10: { name: 'Acid', hex: '#84cc16', r: 132, g: 204, b: 22 },
        11: { name: 'Laser', hex: '#fde047', r: 253, g: 224, b: 71 },
        12: { name: 'Magnet', hex: '#14b8a6', r: 20, g: 184, b: 166 }
      }
    },
    gemstones: {
      name: 'Gemstones',
      background: '#090d16',
      boardBg: '#121a2d',
      gridLines: 'rgba(255, 255, 255, 0.05)',
      borderGlow: '#38bdf8',
      colors: {
        1: { name: 'Diamond', hex: '#e0f2fe', r: 224, g: 242, b: 254 },
        2: { name: 'Sapphire', hex: '#2563eb', r: 37, g: 99, b: 235 },
        3: { name: 'Topaz', hex: '#f97316', r: 249, g: 115, b: 22 },
        4: { name: 'Citrine', hex: '#fbbf24', r: 251, g: 191, b: 36 },
        5: { name: 'Emerald', hex: '#059669', r: 5, g: 150, b: 105 },
        6: { name: 'Amethyst', hex: '#9333ea', r: 147, g: 51, b: 234 },
        7: { name: 'Ruby', hex: '#e11d48', r: 225, g: 29, b: 72 },
        8: { name: 'Bomb', hex: '#f43f5e', r: 244, g: 63, b: 94 },
        9: { name: 'Rainbow', hex: '#ffffff', r: 255, g: 255, b: 255, isRainbow: true },
        10: { name: 'Acid', hex: '#22c55e', r: 34, g: 197, b: 94 },
        11: { name: 'Laser', hex: '#facc15', r: 250, g: 204, b: 21 },
        12: { name: 'Magnet', hex: '#38bdf8', r: 56, g: 189, b: 248 }
      }
    },
    sunset: {
      name: 'Sunset Dunes',
      background: '#120a16',
      boardBg: '#1c1024',
      gridLines: 'rgba(255, 255, 255, 0.04)',
      borderGlow: '#ff5e7e',
      colors: {
        1: { name: 'Turquoise', hex: '#2dd4bf', r: 45, g: 212, b: 191 },
        2: { name: 'Ocean', hex: '#6366f1', r: 99, g: 102, b: 241 },
        3: { name: 'Amber', hex: '#fbbf24', r: 251, g: 191, b: 36 },
        4: { name: 'Gold', hex: '#f59e0b', r: 245, g: 158, b: 11 },
        5: { name: 'Emerald', hex: '#34d399', r: 52, g: 211, b: 153 },
        6: { name: 'Violet', hex: '#c084fc', r: 192, g: 132, b: 252 },
        7: { name: 'Coral', hex: '#fb7185', r: 251, g: 113, b: 133 },
        8: { name: 'Bomb', hex: '#e11d48', r: 225, g: 29, b: 72 },
        9: { name: 'Rainbow', hex: '#ffffff', r: 255, g: 255, b: 255, isRainbow: true },
        10: { name: 'Acid', hex: '#10b981', r: 16, g: 185, b: 129 },
        11: { name: 'Laser', hex: '#fef08a', r: 254, g: 240, b: 138 },
        12: { name: 'Magnet', hex: '#2dd4bf', r: 45, g: 212, b: 191 }
      }
    },
    pastel: {
      name: 'Pastel Dream',
      background: '#111827',
      boardBg: '#1f293d',
      gridLines: 'rgba(255, 255, 255, 0.05)',
      borderGlow: '#93c5fd',
      colors: {
        1: { name: 'Mint', hex: '#7dd3fc', r: 125, g: 211, b: 252 },
        2: { name: 'Periwinkle', hex: '#a5b4fc', r: 165, g: 180, b: 252 },
        3: { name: 'Peach', hex: '#fdba74', r: 253, g: 186, b: 116 },
        4: { name: 'Lemon', hex: '#fef08a', r: 254, g: 240, b: 138 },
        5: { name: 'Sage', hex: '#86efac', r: 134, g: 239, b: 172 },
        6: { name: 'Lavender', hex: '#d8b4fe', r: 216, g: 180, b: 254 },
        7: { name: 'Rose', hex: '#fda4af', r: 253, g: 164, b: 175 },
        8: { name: 'Bomb', hex: '#fb7185', r: 251, g: 113, b: 133 },
        9: { name: 'Rainbow', hex: '#ffffff', r: 255, g: 255, b: 255, isRainbow: true },
        10: { name: 'Acid', hex: '#4ade80', r: 74, g: 222, b: 128 },
        11: { name: 'Laser', hex: '#fef08a', r: 254, g: 240, b: 138 },
        12: { name: 'Magnet', hex: '#7dd3fc', r: 125, g: 211, b: 252 }
      }
    }
  }
};
