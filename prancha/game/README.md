# PRANCHA — jogo

Puzzle de construção de pontes com física de barras (Verlet) e identidade de prancheta de engenharia. Campanha de 24 obras em 6 biomas, sandbox, progresso salvo no navegador.

```
npm install
npm run dev        # http://localhost:5174
npm run build      # dist/
```

## Como jogar

- **Caderno de obras**: 6 biomas × 4 obras. Uma obra desbloqueia a seguinte com 1★.
- **Construir**: arraste entre nós (grade de 0,5 m ou 1 m). Botão direito apaga a peça. `1–5` troca o material, `Ctrl+Z` desfaz, `T` inicia o ensaio, `Esc` volta ao caderno. O projeto é salvo automaticamente por obra.
- **Leito**: em obras com pilar permitido, toque a linha tracejada do leito para criar uma fundação (custo por unidade).
- **Ensaio**: a estrutura assenta sob peso próprio e o veículo atravessa. Verde/amarelo/vermelho = esforço; `f` mostra a flecha. Vento, maré, recalque e escoramento aparecem como fases.
- **Laudo**: 1★ atravessou com FS ≥ 1,15 e flecha ≤ L/50 · 2★ dentro do teto · 3★ FS ≥ 1,80 ou custo ≤ 80% do teto.

## Estrutura

```
src/
  main.ts               bootstrap
  game.ts               orquestrador: telas, sessão de obra, input, ensaio
  core/loop.ts          passo fixo 60 Hz        core/input.ts   ponteiro
  levels/catalog.ts     24 obras, biomas, sandbox (fonte da verdade jogável)
  sim/
    layout.ts           escala px/m, perfis de bioma (tabuleiro, água, leito)
    materials.ts        tabela de materiais + TUNING (constantes calibradas)
    node.ts beam.ts     Verlet: nós e barras (esforço, flambagem, ruptura)
    member.ts           peça desenhada = cadeia de segmentos + contraventos ocultos
    bridge.ts           sistema: regras, fundações, zonas, custo, serialização, solver
    loadcase.ts         cargas ambientais (vento, maré, recalque, escoramento)
    vehicle.ts          veículos por eixo, carga distribuída no tabuleiro
    scoring.ts          estrelas, laudo, diagnóstico
  render/               canvas: chapas por bioma (public/assets/env/<bioma>/plate.png) com backdrop.ts procedural de fallback, peças texturizadas, cotas, partículas
  ui/hud.ts             DOM: menu, caderno, memorial, HUD, laudos, sandbox, galeria
  audio/sound.ts        Web Audio procedural (clique, carimbo, estalo, motor, vento)
  state/progress.ts     localStorage: estrelas, melhor custo, projetos por obra
scripts/
  calibrate.ts          harness headless: `node scripts/calibrate.ts [--worst] [filtro]`
  playtest.py           smoke test Playwright (dev server ligado): screenshots em qa/
```

## Calibração

A física é "leitura", não FEA. `node scripts/calibrate.ts` monta projetos de referência (tabuleiro reto, Warren, arco, pênsil) e imprime pico de esforço, FS, flecha e custo por obra. Os parâmetros ficam em `sim/materials.ts` (`BASE_STRAIN`, `TUNING`). Flags: `--strain=k --g=200 --lpt=400 --it=3 --seg=2 --worst`.

Referências atuais: tabuleiro reto de madeira passa a van da obra 01 (FS ≈ 3,8), rompe na obra 03; Warren de madeira resolve as obras 02–07 com FS 1,2–2,9; vãos de 40+ m pedem treliças altas e aço nos pontos críticos.
