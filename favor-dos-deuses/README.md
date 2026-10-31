# Favor dos Deuses

Action-RPG top-down inspirado na mitologia de Theros (MTG). A fantasia central: poder vem do favor divino (Devoção), não de XP genérico. Deuses ficam ciumentos.

## Como Rodar

```bash
npm install
npm run dev      # http://127.0.0.1:3001
npm run build    # tsc + vite build -> dist/
```

## Controles

| Tecla | Ação |
|-------|------|
| WASD / Setas | Mover |
| Espaço ou J | Atacar (arco de 140° na direção em que o herói olha; parado, mira no inimigo mais próximo) |
| Shift ou K | Esquivar (invulnerável durante o rolamento) |
| E / Enter | Interagir (o rótulo `[E] ...` aparece sobre o herói quando há algo perto) |
| 1-4 | Ativar bênção equipada |
| Esc / P | Pausar (mostra controles e as bênçãos equipadas) |
| ↑↓ + Enter, ou 1-9 | Navegar diálogos (Esc fecha) |

O progresso (Devoção, bênçãos, vida, barganha) é salvo automaticamente no `localStorage` a cada oferenda, transição de área e morte. A tela de título oferece **Continuar** quando há save.

## O Loop

1. **Setessa (hub)** — vila com a taverna (descansar cura toda a vida; rumores explicam as regras), templos de Nylea e Heliod (oferendas) e portais para as duas áreas.
2. **Floresta Selvagem** — mundo 1200×900 com câmera. Cace 3 criaturas (javalis, lobos, sombras) e faça a oferenda no altar de Nylea.
3. **Ruínas Antigas** — masmorra 1120×736 com salas, corredores, tochas, armadilhas de espinhos e um baú. Purifique 4 mortos-vivos e faça a oferenda no altar de Heliod.
4. **Mundo Inferior** — ao morrer: **Escapar** (-20 Devoção com cada deus, volta com 50% de vida) ou **Barganhar com Erebos** (vida cheia, mas uma Sombra de Erebos passa a caçar você em todas as áreas até ser derrotada).

### Devoção e Bênçãos

- Duas barras (Nylea verde, Heliod dourado) com marcador do próximo marco.
- Inimigos dão Devoção ao deus correspondente; oferendas dão +15.
- 25 e 50 de Devoção desbloqueiam bênçãos, equipadas automaticamente em slots 1-4 com cooldown visível no HUD:
  - 🏹 **Flecha de Nylea** (25) — dano ×1.5 por 5 s
  - 🦌 **Passo Florestal** (50) — velocidade ×1.8 por 4 s
  - ☀️ **Raio Solar** (25) — cura 30
  - 🛡️ **Égide da Luz** (50) — bloqueia o próximo golpe
- **Ciúme divino**: subir muito com um deus enquanto o rival está ≥ 40 gera um aviso; na oferenda seguinte o rival pune — Nylea lança espinhos (dano ao longo do tempo), Heliod cega (visão reduzida por alguns segundos).

### Combate

- Física Arcade: herói e inimigos colidem com prédios, árvores, pedras e paredes.
- Inimigos têm estados (patrulha → perseguição → **aviso "!"** → golpe → recuperação). O aviso dá tempo de esquivar.
- Feedback: hit-stop, tremor de câmera, números de dano, barra de vida do inimigo, knockback, flash vermelho ao ser atingido, aviso de vida baixa.
- Buffer de entrada no ataque e captura de teclas por evento (toques rápidos nunca se perdem).

## Assets (CraftPix)

Os packs **não** são redistribuídos (licença). Coloque os PNGs em `public/assets/{forest,dungeon,tavern}/` conforme `assets-raw/README.txt`. Sem eles, o jogo roda com gráficos gerados por código.

Os sheets da CraftPix não são grades uniformes, por isso `src/data/assets.ts` guarda **coordenadas medidas em pixels** para cada recorte (taverna, casas, arcos, estátuas, caixões, baú, tochas 5 variantes × 6 frames…). Uso por cena:

| Cena | Assets |
|------|--------|
| Herói | `Animation_knight.png` (10 frames × 2 linhas de 40×40: idle / andar) |
| Setessa | `Walls_street.png` (paralelepípedo, pedra clara, folhas), `Exterior.png` (taverna, casas, cerca, caixotes, barris, mesas), NPCs animados (`Animation_host`, `Lute_player`, `watcher`), `Ground_grass.png` (jardim de Nylea), estátua/pilares/arco das ruínas |
| Floresta | `Ground_grass.png` (grama, caminho de terra em manchas 3×3/4×4), `objects/` (árvores, arbustos, pedras, cogumelos, troncos, ruínas) |
| Ruínas | `walls_floor.png` (piso, parede norte 3 tiles, frente sul, colunas finas, laje, rachaduras), `torches.png`, `coffins.png`, `other_objects.png`, `Arches_columns.png`, `chest_lever.png`, `Spikes.png`, `scull_bas-relief.png` |
| Sombras | `ghost_trap.png` (frames 1-3) |
| Mundo Inferior | `Statue_fire.png` (Erebos), `ghost_trap.png` (alma) |

Inimigos sem arte no pack (javali, lobo, esqueleto, harpia) são pixel art em texto em `src/data/pixelart.ts`, 2 frames cada.

Os chãos são desenhados numa única `RenderTexture` por cena (`src/game/tiles.ts`), não em milhares de sprites.

## Estrutura

```
src/
├── main.ts                 # bootstrap, overlays DOM (pausa, cegueira, flash, banner)
├── data/                   # assets (recortes medidos), bênçãos, constantes, inimigos, deuses, pixel art
├── entities/               # Player (Arcade sprite, esquiva, buffer) e Enemy (FSM com telegraph)
├── game/
│   ├── createGame.ts       # config Phaser (Arcade physics)
│   ├── tiles.ts            # TileCanvas (RenderTexture)
│   └── scenes/             # Boot, Preload, Title, Hub, Wilds, Dungeon, Underworld, BaseGameScene
├── systems/                # Devotion, Bestow, Combat (juice), Save
└── ui/                     # Hud, Dialog (teclado), MessageToast (pilha)
```
