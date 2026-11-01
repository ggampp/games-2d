// Campanha. Cada fase escolhe um mapa, a força do computador, o lado do
// jogador e, opcionalmente, uma posição própria (peças e pedras).
//
// Estrelas: ★ vitória · ★ perder no máximo `maxLoss` peças · ★ vencer em até `par` lances.
// Fases-quebra-cabeça (`limit`) exigem vencer em até `limit` lances; vitória = 3 estrelas.

export const LEVELS = [
  {
    id: 1,
    name: 'Primeiros passos',
    map: 'borboleta',
    ai: 'iniciante',
    par: 14,
    maxLoss: 2,
    intro: 'Ande pelas linhas até uma casa vizinha vazia. Para capturar, salte em linha por cima de uma karela até a casa livre logo atrás.',
  },
  {
    id: 2,
    name: 'Desafio no quintal',
    map: 'borboleta',
    ai: 'facil',
    par: 16,
    maxLoss: 2,
    intro: 'O vizinho já aprendeu as regras. O ponto central do X liga os dois lados: quem domina o centro domina o jogo.',
  },
  {
    id: 3,
    name: 'Salto em cadeia',
    map: 'borboleta',
    ai: 'mestre',
    limit: 1,
    setup: {
      pieces: { 1: ['Lbot', 'La0', 'La1'], 2: ['Ly1', 'C', 'Ry0', 'Ra0'] },
    },
    intro: 'Quebra-cabeça: capture as quatro karelas num único lance. Depois de saltar, a peça continua saltando enquanto houver captura.',
  },
  {
    id: 4,
    name: 'Os Ds crescem',
    map: 'grande-borboleta',
    ai: 'facil',
    par: 20,
    maxLoss: 3,
    intro: 'Agora há uma linha que atravessa o centro de ponta a ponta. Cuidado com as capturas pela horizontal.',
  },
  {
    id: 5,
    name: 'Borboleta de Bengala',
    map: 'lau-kata-kati',
    ai: 'medio',
    par: 26,
    maxLoss: 4,
    intro: 'Nove contra nove. Todas as retas passam pelo centro: um único ponto decide as trocas.',
  },
  {
    id: 6,
    name: 'Escolha o tomate certo',
    map: 'lau-kata-kati',
    ai: 'mestre',
    limit: 1,
    setup: {
      pieces: { 1: ['L3m', 'L2t'], 2: ['L2m', 'C', 'R2m'] },
    },
    intro: 'Quebra-cabeça: dois tomates podem capturar, mas só um limpa o tabuleiro de uma vez.',
  },
  {
    id: 7,
    name: 'A roda gira',
    map: 'roda',
    ai: 'medio',
    par: 24,
    maxLoss: 3,
    intro: 'Os anéis não têm fim: uma peça pode ser cercada pelos dois lados. Os raios cruzam o centro em linha reta.',
  },
  {
    id: 8,
    name: 'Pedras no caminho',
    map: 'alquerque',
    ai: 'medio',
    par: 30,
    maxLoss: 4,
    setup: {
      rocks: ['2,0', '2,2', '2,4'],
      pieces: {
        1: ['0,0', '0,1', '0,2', '0,3', '0,4', '1,0', '1,1', '1,2', '1,3', '1,4'],
        2: ['3,0', '3,1', '3,2', '3,3', '3,4', '4,0', '4,1', '4,2', '4,3', '4,4'],
      },
    },
    intro: 'Pedras bloqueiam casas: ninguém para nelas nem salta por cima delas. Só restam duas passagens no meio.',
  },
  {
    id: 9,
    name: 'Alquerque',
    map: 'alquerque',
    ai: 'dificil',
    par: 34,
    maxLoss: 5,
    intro: 'Doze contra doze no avô das damas. O computador agora calcula vários lances à frente.',
  },
  {
    id: 10,
    name: 'Em desvantagem',
    map: 'lau-kata-kati',
    ai: 'facil',
    par: 30,
    maxLoss: 3,
    setup: {
      pieces: {
        1: ['L1t', 'L1m', 'L1b', 'L2t', 'L2m', 'L2b', 'L3m'],
        2: ['R1t', 'R1m', 'R1b', 'R2t', 'R2m', 'R2b', 'R3t', 'R3m', 'R3b'],
      },
    },
    intro: 'Sete tomates contra nove karelas. Troque peças só quando a troca for boa para você.',
  },
  {
    id: 11,
    name: 'Roda de pedra',
    map: 'roda',
    ai: 'dificil',
    par: 30,
    maxLoss: 4,
    setup: {
      rocks: ['C'],
    },
    intro: 'Uma pedra tampa o centro da roda. Os raios deixam de se cruzar: a briga é toda nos anéis.',
  },
  {
    id: 12,
    name: 'Dezesseis soldados',
    map: 'sholo-guti',
    ai: 'dificil',
    par: 44,
    maxLoss: 6,
    intro: 'O Sholo Guti completo: dezesseis peças de cada lado e triângulos para recuar.',
  },
  {
    id: 13,
    name: 'Grande final',
    map: 'borboleta',
    ai: 'mestre',
    side: 2,
    first: 1,
    par: 20,
    maxLoss: 3,
    intro: 'De volta ao tabuleiro do vídeo, agora com as karelas. O mestre dos tomates começa.',
  },
];

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

/** Estrelas conquistadas numa vitória. */
export function starsFor(level, { playerMoves, piecesLost }) {
  if (level.limit) return playerMoves <= level.limit ? 3 : 0;
  let s = 1;
  if (piecesLost <= level.maxLoss) s++;
  if (playerMoves <= level.par) s++;
  return s;
}
