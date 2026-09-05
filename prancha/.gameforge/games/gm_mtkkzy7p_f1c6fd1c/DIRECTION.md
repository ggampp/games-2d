# Direction — PRANCHA

- Genre: **Puzzle de física / construção** (`puzzle`)
- Art: **Ilustração técnica semi-realista** (NÃO cel-shaded, NÃO cartoon)
- Verb: projetar
- Objective: o veículo atravessa o vão sem colapso, dentro das restrições
- Fail: colapso, queda, flecha > L/800, gabarito/vento violado
- Camera: vista lateral 2.5D, ortográfica no plano de jogo
- Physics: Verlet/barras axiais + flambagem simplificada (não FEA)
- Engine: Vite + TypeScript + Canvas 2D + DOM HUD
- Tracks: A (slice), E (2D assets), C (gameplay/juice), H (QA), I (áudio)

## Art notes

Prancheta viva. Fundo navy `#0B1F3A`, grid ciano 8%, materiais reconhecíveis (concreto aparente, perfil I, cabo, madeira de escoramento). Overlay de tensão verde→amarelo→vermelho só no ensaio. UI de mesa de engenheiro. Sem mascote, sem neon, sem glassmorphism SaaS.

Sprites de produção: fundo magenta `#FF00FF`, zero texto na arte.

## Rule

Do not hide missing forms with bloom/fog. Build the playable loop before the graphics pass.
