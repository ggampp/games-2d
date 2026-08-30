# Isle Builder

Sandbox relaxante de pintura de ilhas em pixel art (2D top-down), Vite +
TypeScript + Three.js ortográfico. Pinte terreno, coloque props e observe
aldeões, peixes e navios reagirem ao mundo.

Plano e sprints: [`GAME_PLAN.md`](./GAME_PLAN.md), [`sprints/`](./sprints/).

## Rodando

```bash
npm install
npm run dev      # Vite, com HMR
npm run test     # Vitest
npm run build    # tsc + vite build
```

## Publicação

O GitHub Actions (`.github/workflows/deploy.yml`) publica **só este jogo** no
GitHub Pages. Este projeto vive em `games-2d/isle-builder`. Canyon Rails, Prisma,
Splinter e Glint estão nos guarda-chuva irmãos (`games-3d/`, `games-2d/`).

## Documentação

- `GAME_PLAN.md` — análise do vídeo e plano de construção
- `sprints/` — sprints executáveis; `sprints/ANDAMENTO.md` é o dashboard
- `CLAUDE.md` / `AGENTS.md` — guia para agentes
- `AIMemory/handoffs/` — histórico de sessões
