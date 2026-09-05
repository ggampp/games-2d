# PRANCHA — Pack de Conceito
**O vão não perdoa.**

Jogo de construção de pontes com física e identidade visual de engenharia civil (prancheta / blueprint).

Este arquivo compactado reúne os 3 entregáveis combinados:

| Pasta | Conteúdo |
|---|---|
| `01-gdd/` | Game Design Document (Word) + planilha de economia e 24 níveis |
| `02-ui-prompts/` | 8 prompts prontos para gerar as telas do jogo |
| `03-concept-art/` | 8 conceitos visuais (menu → sandbox) |
| `04-prompts-mestre/` | Prompts longos: GDD, código e arte |

## Conceito em uma linha
Você é o engenheiro responsável. Orçamento, materiais reais, restrições de obra e um ensaio de carga que mostra a estrutura “falando” em verde / amarelo / vermelho.

## Telas do pack
1. Menu principal
2. Caderno de obras (mapa da campanha)
3. Briefing / memorial descritivo
4. Gameplay — modo construir
5. Ensaio de carga
6. Colapso estrutural
7. Relatório de ensaio
8. Sandbox / editor de terreno

## Como usar
- Leia o GDD antes de gerar código.
- Use os prompts da pasta `02` e `04` no Grok Imagine, Midjourney, Flux ou no LLM que for gerar UI/código.
- A planilha `economia-e-niveis.xlsx` é a fonte da verdade de custos e progressão.

## Produção

Plano de implementação: [`GAME_PLAN.md`](GAME_PLAN.md).  
Assets recortados: [`assets/`](assets/) · prévia [`assets/catalog.html`](assets/catalog.html).  
Dados jogáveis: [`data/materials.json`](data/materials.json) · [`data/levels.json`](data/levels.json).

Jogo completo em Vite + TypeScript + Canvas 2D + HUD DOM, em [`game/`](game/) (leia [`game/README.md`](game/README.md)).

```
cd game
npm install
npm run dev
```

Abre `http://localhost:5174`. Menu → Caderno de obras → Obra 01: clique o encontro esquerdo, arraste até o direito numa peça só, **TESTAR CARGA**.

Conteúdo jogável: campanha de 24 obras em 6 biomas (planície, canyon, estuário, serra, mangue, urbano), sandbox com terreno/carga/vento/maré, galeria as-built, progresso e projetos salvos no navegador. A fonte da verdade dos níveis jogáveis é `game/src/levels/catalog.ts`; `data/levels.json` é o dump da planilha.

Versão: 2.0 — 02/09/2026 (jogo completo).
Projeto fictício para prototipagem. CREA, NBR e ART aparecem só como linguagem visual.
