# Guti — Tomates × Karelas

Versão web de um jogo de tabuleiro tradicional de captura por saltos, como o que aparece no vídeo de referência: o tabuleiro é riscado no chão de cimento, seis tomates enfrentam seis karelas (melão-de-são-caetano) e as peças capturam saltando por cima do adversário, no estilo do alquerque e do *guti* de Bangladesh. Feito em JavaScript, SVG e Web Worker, sem dependências em tempo de execução.

## Jogar

```sh
npm install
npm run dev
```

- **Campanha**: 13 fases em 6 mapas, com estrelas, desbloqueio progressivo, dois quebra-cabeças, pedras que bloqueiam casas e posições com desvantagem. O progresso fica no `localStorage`.
- **Partida livre**: escolha o mapa, jogue **contra o computador** (5 níveis: Iniciante, Fácil, Médio, Difícil e Mestre) ou **contra outro jogador** no mesmo aparelho. Também dá para escolher quem começa e ajustar as regras.
- Ferramentas: desfazer, dica (calculada pela IA), reiniciar e som sintetizado.
- No celular em retrato o tabuleiro gira 90° para ocupar a tela. Funciona com mouse, toque ou teclado (Tab + Enter).

## Análise do vídeo: o tabuleiro original

Dois "D" espelhados (semicírculo + corda vertical), cada um cortado por duas linhas horizontais e ligados por um **X** no centro:

```
      Ltop             Rtop
     ╱  │                │  ╲
  La0 ─ Ly0 ╲        ╱ Ry0 ─ Ra0
  │     │     ╲    ╱     │     │
  │     │       C        │     │      13 casas
  │     │     ╱    ╲     │     │      6 tomates (esquerda)
  La1 ─ Ly1 ╱        ╲ Ry1 ─ Ra1      6 karelas (direita)
     ╲  │                │  ╱         centro vazio
      Lbot             Rbot
```

- Cada lado tem 6 casas: as 4 da corda (topo, duas horizontais, base) e 2 no arco.
- O centro `C` liga-se só às quatro pontas do X. As diagonais `Ly0–C–Ry1` e `Ly1–C–Ry0` são retas, então dá para saltar pelo centro.
- No vídeo as karelas abrem entrando no centro e o tomate responde capturando pelo X. Isso confirma a regra de salto em linha.

### Regras implementadas

1. Ande uma casa pela linha até uma casa vizinha vazia.
2. Capture saltando, em linha reta (ou ao longo do arco), por cima de uma peça adversária colada até a casa livre logo atrás.
3. Depois de saltar, a peça continua saltando no mesmo lance enquanto houver captura.
4. A captura é obrigatória por padrão (configurável).
5. **Quem fica sem lances passa a vez** (padrão). A análise do motor mostrou que, no tabuleiro do vídeo com "sem lances = derrota", quem começa perde à força em 4 lances: entra no centro, é capturado, entra de novo e fica bloqueado. Por isso essa regra virou opção.
6. Empate após 40 lances sem captura, ou quando ninguém consegue se mexer.

## Mapas

| Mapa | Casas | Peças | Observação |
|---|---|---|---|
| Dois Ds | 13 | 6 × 6 | O tabuleiro do vídeo |
| Dois Ds Grande | 17 | 8 × 8 | Terceira horizontal atravessa o centro |
| Lau Kata Kati | 19 | 9 × 9 | Borboleta de Bengala |
| Roda | 17 | 6 × 6 | Anéis fechados e raios; início reequilibrado (com o anel interno cheio, quem começa caía numa armadilha forçada) |
| Alquerque | 25 | 12 × 12 | Grade 5×5 com diagonais |
| Sholo Guti | 37 | 16 × 16 | Alquerque com triângulos laterais |

## Arquitetura

| Arquivo | Papel |
|---|---|
| `src/maps.js` | Mapas como grafos declarativos: casas (x, y), caminhos (retas/arcos) e posição inicial. Geradores para "D duplo", borboleta, roda e grade. |
| `src/engine.js` | Regras puras: vizinhança e saltos derivados dos caminhos, lances legais (cadeias de captura), aplicar lance, fim de jogo. Sem DOM. |
| `src/ai.js` | Negamax com poda alfa-beta, aprofundamento iterativo com limite de tempo, tabela de transposição, extensão de capturas e ruído por nível. |
| `src/ai.worker.js` | Roda a IA fora da thread principal. |
| `src/levels.js` | Fases da campanha e cálculo de estrelas. |
| `src/render.js` | Tabuleiro em SVG: laje com textura, sulcos, peças vetoriais, destaques, animação de saltos e rotação retrato/paisagem. |
| `src/main.js` | Telas, turnos, interação, desfazer, dicas, persistência. |

Para criar um mapa novo, basta declarar as casas e os caminhos em `maps.js`. Vizinhanças e saltos são derivados automaticamente: três casas consecutivas no mesmo caminho formam um salto.

## Verificação

```sh
npm test                 # regras, mapas, IA, fases (node --test)
npm run test:e2e         # Playwright: quebra-cabeça, CPU + desfazer, 2 jogadores, celular
npm run build && npm run preview
```

Se o Chromium do Playwright já estiver instalado em outro caminho, use `PW_CHROMIUM_PATH=/caminho/do/chrome npm run test:e2e`.
