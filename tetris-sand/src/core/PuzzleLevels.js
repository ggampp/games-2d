// 10 Hand-crafted Puzzle Challenges for Sand Tetris

export const PUZZLE_LEVELS = [
  {
    id: 1,
    title: 'Nível 1: Primeiro Passo',
    description: 'Complete a ponte ciano com uma única peça I.',
    pieces: ['I'],
    setup(sandGrid) {
      sandGrid.reset();
      const gpb = 10;
      const row = sandGrid.hiddenOffset + 180;
      // Pre-fill left side and right side with Cyan (Color ID 1)
      for (let y = row; y < row + 15; y++) {
        for (let x = 0; x < 35; x++) sandGrid.setGrain(x, y, 1);
        for (let x = 65; x < 100; x++) sandGrid.setGrain(x, y, 1);
      }
    }
  },
  {
    id: 2,
    title: 'Nível 2: Duna Dividida',
    description: 'Conecte as dunas laranjas usando a peça L e a peça J.',
    pieces: ['L', 'J'],
    setup(sandGrid) {
      sandGrid.reset();
      const row = sandGrid.hiddenOffset + 175;
      for (let y = row; y < row + 20; y++) {
        for (let x = 0; x < 40; x++) sandGrid.setGrain(x, y, 3); // Orange
        for (let x = 60; x < 100; x++) sandGrid.setGrain(x, y, 3);
      }
    }
  },
  {
    id: 3,
    title: 'Nível 3: Arco-Íris Mágico',
    description: 'Use a peça Arco-Íris para ligar a duna roxa da esquerda à duna amarela da direita!',
    pieces: ['RAINBOW'],
    setup(sandGrid) {
      sandGrid.reset();
      const row = sandGrid.hiddenOffset + 170;
      for (let y = row; y < row + 25; y++) {
        for (let x = 0; x < 45; x++) sandGrid.setGrain(x, y, 6); // Purple
        for (let x = 55; x < 100; x++) sandGrid.setGrain(x, y, 4); // Yellow
      }
    }
  },
  {
    id: 4,
    title: 'Nível 4: Detonação Perfeita',
    description: 'Use a Bomba no centro para destruir a barreira e deixar o caminho livre.',
    pieces: ['BOMB', 'I'],
    setup(sandGrid) {
      sandGrid.reset();
      const row = sandGrid.hiddenOffset + 160;
      // Barrier in middle
      for (let y = row; y < row + 35; y++) {
        for (let x = 40; x < 60; x++) sandGrid.setGrain(x, y, 7); // Red obstacle
      }
      for (let y = row + 20; y < row + 35; y++) {
        for (let x = 0; x < 35; x++) sandGrid.setGrain(x, y, 1);
        for (let x = 65; x < 100; x++) sandGrid.setGrain(x, y, 1);
      }
    }
  },
  {
    id: 5,
    title: 'Nível 5: Perfuratriz Ácida',
    description: 'Use a Areia Ácida para abrir caminho no paredão e completar com a peça verde.',
    pieces: ['ACID', 'S'],
    setup(sandGrid) {
      sandGrid.reset();
      const row = sandGrid.hiddenOffset + 150;
      for (let y = row; y < row + 40; y++) {
        for (let x = 42; x < 58; x++) sandGrid.setGrain(x, y, 2);
      }
      for (let y = row + 25; y < row + 40; y++) {
        for (let x = 0; x < 40; x++) sandGrid.setGrain(x, y, 5);
        for (let x = 60; x < 100; x++) sandGrid.setGrain(x, y, 5);
      }
    }
  },
  {
    id: 6,
    title: 'Nível 6: Combo Triplo',
    description: 'Encaixe as 3 peças para desencadear um combo de 3 cores consecutivas.',
    pieces: ['O', 'T', 'I'],
    setup(sandGrid) {
      sandGrid.reset();
      const row = sandGrid.hiddenOffset + 170;
      // Blue base
      for (let y = row + 15; y < row + 28; y++) {
        for (let x = 0; x < 35; x++) sandGrid.setGrain(x, y, 2);
        for (let x = 65; x < 100; x++) sandGrid.setGrain(x, y, 2);
      }
      // Yellow middle
      for (let y = row + 5; y < row + 15; y++) {
        for (let x = 0; x < 40; x++) sandGrid.setGrain(x, y, 4);
        for (let x = 60; x < 100; x++) sandGrid.setGrain(x, y, 4);
      }
    }
  },
  {
    id: 7,
    title: 'Nível 7: Oásis Desalinhado',
    description: 'Conecte as dunas em desnível usando a rotação precisa do Z.',
    pieces: ['Z', 'Z'],
    setup(sandGrid) {
      sandGrid.reset();
      const row = sandGrid.hiddenOffset + 160;
      for (let y = row; y < row + 30; y++) {
        for (let x = 0; x < 40; x++) sandGrid.setGrain(x, y, 7);
      }
      for (let y = row + 15; y < row + 35; y++) {
        for (let x = 60; x < 100; x++) sandGrid.setGrain(x, y, 7);
      }
    }
  },
  {
    id: 8,
    title: 'Nível 8: Disparo Laser',
    description: 'Posicione o Laser para vaporizar a linha central e liberar a areia acima.',
    pieces: ['LASER', 'I'],
    setup(sandGrid) {
      sandGrid.reset();
      const row = sandGrid.hiddenOffset + 150;
      for (let y = row; y < row + 20; y++) {
        for (let x = 0; x < 100; x++) sandGrid.setGrain(x, y, 7); // Obstacle line
      }
      for (let y = row + 25; y < row + 40; y++) {
        for (let x = 0; x < 45; x++) sandGrid.setGrain(x, y, 1);
        for (let x = 55; x < 100; x++) sandGrid.setGrain(x, y, 1);
      }
    }
  },
  {
    id: 9,
    title: 'Nível 9: Tempestade de Areia',
    description: 'Encaixe quatro peças com precisão milimétrica para limpar toda a areia.',
    pieces: ['T', 'S', 'L', 'I'],
    setup(sandGrid) {
      sandGrid.reset();
      const row = sandGrid.hiddenOffset + 165;
      for (let y = row; y < row + 30; y++) {
        for (let x = 0; x < 35; x++) sandGrid.setGrain(x, y, 6);
        for (let x = 65; x < 100; x++) sandGrid.setGrain(x, y, 6);
      }
    }
  },
  {
    id: 10,
    title: 'Nível 10: Grande Mestre da Areia',
    description: 'O desafio final: use todas as suas habilidades e o poder do Arco-Íris para zerar o tabuleiro!',
    pieces: ['BOMB', 'RAINBOW', 'I'],
    setup(sandGrid) {
      sandGrid.reset();
      const row = sandGrid.hiddenOffset + 140;
      for (let y = row; y < row + 55; y++) {
        for (let x = 0; x < 40; x++) sandGrid.setGrain(x, y, (x % 3 === 0) ? 1 : 3);
        for (let x = 60; x < 100; x++) sandGrid.setGrain(x, y, (x % 3 === 0) ? 1 : 3);
      }
    }
  }
];
