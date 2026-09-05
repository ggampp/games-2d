# PRANCHA — Plano de produção

**O vão não perdoa.** Puzzle de física 2.5D de construção de pontes com identidade de engenharia civil.

Fonte da verdade do conceito: `01-gdd/GDD-PRANCHA.docx` + `01-gdd/economia-e-niveis.xlsx`.
Fonte da verdade jogável: `game/src/levels/catalog.ts` (24 obras) e `game/src/sim/materials.ts` (materiais + constantes calibradas).
Concept art: `03-concept-art/`. Prompts de tela: `02-ui-prompts/`.

GameForge: `gameId = gm_mtkkzy7p_f1c6fd1c` · gênero **puzzle**.

---

## 1. Visão travada

| | |
|---|---|
| Fantasia | "Eu assinei essa ART." |
| Verbo | Projetar → testar → ler o laudo |
| Não é | Poly Bridge cartoon, gems, XP, mascote |
| É | Prancheta viva: grid, cotas, carimbo, memorial, ensaio de carga |

Loop curto (2–6 min): briefing → construir (física pausada) → TESTAR CARGA → laudo 1–3★.
Loop médio: bioma (4 obras). Loop longo: 24 obras + sandbox.

---

## 2. Direção visual (tokens)

| Token | Hex | Uso |
|---|---|---|
| Navy planta | `#0B1F3A` | Fundo, header |
| Navy médio | `#12355B` | Painéis |
| Ciano cota | `#7EC8E3` | Grid, linhas, foco |
| Papel | `#E8EEF2` | Texto |
| Ok | `#3DDC97` | Tensão segura |
| Atenção | `#E6B84A` | Tensão média |
| Falha | `#D1495B` | Ruptura |
| Aço | `#8A9AA8` | Perfil |
| Concreto | `#C4BBB2` | Tabuleiro / encontro |
| Madeira | `#B08968` | Escora |
| Cabo | `#D9E2EC` | Estai |
| Ouro laudo | `#C9A227` | Estrela / ART / patrimônio |

Tipografia: Oswald / Barlow Condensed nos títulos, IBM Plex Mono nos números (sempre com unidade).
UI é DOM sobre o canvas; texto nunca vai na arte.

---

## 3. Engine

**Vite + TypeScript + Canvas 2D (mundo) + DOM (HUD).** Sem Phaser, sem Three.js.

- Física de barras/nós: Verlet com restrições, 10 substeps × 3 iterações por frame.
- Peça desenhada = `Member`: cadeia de segmentos de 2 m + contraventos ocultos (skip 2 e 3) que dão rigidez à flexão. Um segmento rompe e leva os contraventos que o cobrem: a peça se separa de verdade.
- Esforço = deformação residual do solver / limite do material (calibrado). Flambagem: capacidade à compressão cai com (L_crít/L)².
- Cabo: só tração, peça única. Concreto: forte à compressão, fraco à tração. Madeira: barata, fraca. Aço: referência, caro.
- Veículos por eixo (van 2, caminhão 2, ônibus 2, bitrem 5); a roda espalha 60/20/20 pelos nós do tabuleiro.
- Antes do ensaio a estrutura **assenta** sob peso próprio (`presettle`); a flecha é medida a partir daí.

Harness headless: `node game/scripts/calibrate.ts` (Node 22, roda `.ts` direto).

---

## 4. Arquitetura (`game/src`)

```
main.ts · game.ts (orquestrador)
core/      loop.ts (60 Hz fixo) · input.ts
levels/    catalog.ts (24 obras, biomas, sandbox, BUDGET_SCALE)
sim/       layout · materials · node · beam · member · bridge · loadcase · vehicle · scoring
render/    assets · backdrop (fundo procedural por bioma) · world (peças, cotas, zonas) · particles
ui/        hud.ts (menu, caderno, memorial, HUD, laudos, sandbox, galeria)
audio/     sound.ts (Web Audio procedural)
state/     progress.ts (localStorage)
```

---

## 5. Regras de jogo

- Vitória (1★): todos os veículos atravessam, FS ≥ 1,15, flecha ≤ L/50 (L/100 nas obras urbanas).
- 2★: custo ≤ teto. 3★: FS ≥ 1,80 **ou** custo ≤ 80% do teto.
- Custo = material + fundações + 18% de mão de obra. Passar do teto é permitido (máx. 1★).
- Tetos da planilha × 1,6 (`BUDGET_SCALE`): com a física calibrada uma treliça correta custa ~3× o tabuleiro.
- Uma obra desbloqueia a seguinte com 1★. Projeto salvo por obra; "Continuar projeto" retoma a última.

### Modificadores por obra (`LevelMods`)

| Mod | Onde | Efeito |
|---|---|---|
| `piers` | canyon 5, estuário, serra, mangue, urbano | fundação no leito (custo/un); `"forbidden"` interdita |
| `quotaM` | 6 | cota de material no canteiro |
| `vehicles` | 6, 12 | vários veículos, sentidos opostos |
| `tideRiseM` | 9, 11, 20 | água sobe 6 s; nós submersos sofrem empuxo + correnteza |
| `clearance` | 10, 11, 21, 24 | zona hachurada proibida (gabarito) |
| `windKmh`/`gusts` | 13–16, 24, 9 | força horizontal (± rajadas) |
| `settlementM` | 18, 20 | encontro direito afunda 5 s |
| `noRightLowAnchor` | 19 | vão assimétrico |
| `deflectionDiv` | 21 | flecha rigorosa |
| `deadLoadMul` | 22 | escoramento: gravidade × 1,8 por 3 s antes do tráfego |
| `prebuilt` | 23, 24 | arco / torres tombadas (polilinha contínua, sem custo, indestrutível) |

---

## 6. Fases

| Fase | Estado |
|---|---|
| 0 Conceito (GDD, planilha, telas, prompts) | feita |
| 1 Assets de produção (sprites chroma, parallax, ícones, FX) | feita |
| 2 Vertical slice (obra 01) | feita |
| 3 MVP obras 01–08 (planície + canyon, cabo, orçamento, flambagem, vão livre) | feita |
| 4 Campanha 24 + sandbox (estuário, serra, mangue, urbano, Hercílio Luz) | feita |
| 5 Polimento e release | parcial: áudio procedural, juice (hit-stop, shake, partículas, carimbo), playtest Playwright, build Vite ok; falta itch/PWA |

### Pendências conhecidas

- Fundos: chapas 16:9 geradas pelo Gemini (`gemini-2.5-flash-image`, cópias em `assets/env/generated/`, usadas em `game/public/assets/env/<bioma>/plate.png`), com fundo procedural (`render/backdrop.ts`) como fallback se a chapa não carregar. Chaves ficam em `.env` (ignorado pelo git).
- Referências de solução das obras 8, 11, 16, 19, 20 e 24 no harness ainda são geometrias ingênuas; a obra 8 fecha com Warren de madeira + diagonais extremas em aço (FS 1,2, acima do teto).
- `data/levels.json` continua sendo o dump da planilha; o catálogo TS diverge em cargas (obras 2, 3, 7, 8) e nos tetos (×1,6).
- Sem toque/mobile dedicado (funciona com ponteiro; toolbox colapsa abaixo de 900 px).

---

## 7. QA

- `python game/scripts/playtest.py` com o dev server ligado: percorre menu → caderno → obra 01 (tabuleiro reto → 3★) → obra 02 (tabuleiro reto → colapso por FS) → sandbox canyon → galeria, e salva screenshots em `game/qa/`.
- `node game/scripts/calibrate.ts --worst [filtro]` imprime pico de esforço, FS, flecha, custo e as peças mais solicitadas de cada projeto de referência.

CREA / NBR / ART são flavor visual. Não são projeto real.
