// Achievements (Conquistas) System for Sand Tetris

export const ACHIEVEMENTS_LIST = {
  FIRST_CLEAR: {
    id: 'FIRST_CLEAR',
    icon: '⏳',
    title: 'Primeira Onda',
    desc: 'Elimine sua primeira linha contínua de areia.'
  },
  COMBO_3: {
    id: 'COMBO_3',
    icon: '🔥',
    title: 'Cascata Flamejante',
    desc: 'Realize um combo de 3x ou superior.'
  },
  COMBO_5: {
    id: 'COMBO_5',
    icon: '⚡',
    title: 'Mestre dos Combos',
    desc: 'Realize um combo devastador de 5x ou superior!'
  },
  BOMB_DETONATED: {
    id: 'BOMB_DETONATED',
    icon: '💣',
    title: 'Demolidor',
    desc: 'Detone um bloco bomba destruindo a areia ao redor.'
  },
  RAINBOW_CLEAR: {
    id: 'RAINBOW_CLEAR',
    icon: '🌈',
    title: 'Prisma Curinga',
    desc: 'Complete uma conexão utilizando a areia Arco-Íris.'
  },
  LEVEL_10: {
    id: 'LEVEL_10',
    icon: '🛡️',
    title: 'Sobrevivente Implacável',
    desc: 'Alcance o nível 10 no modo Clássico.'
  },
  PUZZLE_SOLVER: {
    id: 'PUZZLE_SOLVER',
    icon: '🧠',
    title: 'Mente Estrategista',
    desc: 'Conclua seu primeiro desafio no modo Puzzle.'
  },
  PERFECT_CLEAR: {
    id: 'PERFECT_CLEAR',
    icon: '✨',
    title: 'Limpeza Perfeita',
    desc: 'Esvazie 100% da areia do tabuleiro (All Clear)!'
  }
};

export class AchievementsManager {
  constructor(onUnlock) {
    this.onUnlock = onUnlock || (() => {});
    this.unlocked = this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem('sand_tetris_achievements');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem('sand_tetris_achievements', JSON.stringify(this.unlocked));
    } catch (e) {}
  }

  isUnlocked(id) {
    return !!this.unlocked[id];
  }

  unlock(id) {
    if (this.unlocked[id]) return false;
    const def = ACHIEVEMENTS_LIST[id];
    if (!def) return false;

    this.unlocked[id] = Date.now();
    this.save();

    this.onUnlock(def);
    return true;
  }

  getAll() {
    return Object.values(ACHIEVEMENTS_LIST).map(ach => ({
      ...ach,
      unlocked: !!this.unlocked[ach.id],
      unlockedAt: this.unlocked[ach.id] || null
    }));
  }
}
