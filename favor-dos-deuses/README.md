# Favor dos Deuses

Action-RPG top-down inspirado na mitologia de Theros (MTG). A fantasia central: poder vem do favor divino (Devoção), não de XP genérico. Deuses ficam ciumentos.

## Como Rodar

```bash
npm install
npm run dev
```

O jogo abrirá em `http://127.0.0.1:3001`

## Controles

| Tecla | Ação |
|-------|------|
| WASD / Setas | Mover |
| Espaço | Atacar |
| Shift | Esquivar (dodge roll) |
| E | Interagir |
| 1-4 | Ativar Bestow (bênção) |

## O que o MVP Demonstra

### Loop Completo
1. **Hub (Setessa)** - Vila central com templos de Nylea e Heliod
2. **Floresta Selvagem** - Área de caça com criaturas (javalis, lobos, sombras)
3. **Ruínas Antigas** - Dungeon com mortos-vivos (esqueletos, harpias)
4. **Mundo Inferior** - Cena de morte com escolha de escape ou barganha

### Sistema de Devoção
- Duas barras: Nylea (verde/caça/floresta) e Heliod (dourado/sol/justiça)
- Ganhe Devoção derrotando inimigos específicos ou fazendo oferendas nos templos/altares
- Milestones em 25/50 desbloqueiam Bestows (poderes divinos)

### Bestows (Bênçãos)
- **Flecha de Nylea** (25 Devoção) - Boost de dano
- **Passo Florestal** (50 Devoção) - Boost de velocidade
- **Raio Solar** (25 Devoção) - Cura
- **Égide da Luz** (50 Devoção) - Escudo protetor

### Ciúme Divino
- Quando sua Devoção com um deus sobe muito enquanto o rival também está alto, o deus rival fica ciumento
- Mensagens de aviso aparecem antes de eventos de ciúme
- Adiciona tensão ao sistema de progressão

### Sistema de Morte
- Ao morrer, você vai para o Mundo Inferior
- **Escapar**: Perde 20 de Devoção com cada deus, volta com 50% HP
- **Barganhar com Erebos**: Volta com HP cheio, mas há consequências narrativas

## Estrutura do Projeto

```
favor-dos-deuses/
├── src/
│   ├── main.ts              # Entry point
│   ├── styles.css           # UI styles
│   ├── data/                # Game data
│   │   ├── bestows.ts       # Bestow definitions
│   │   ├── constants.ts     # Game constants
│   │   ├── enemies.ts       # Enemy configs
│   │   └── gods.ts          # God definitions
│   ├── entities/            # Game entities
│   │   ├── Enemy.ts
│   │   └── Player.ts
│   ├── game/
│   │   ├── createGame.ts    # Phaser config
│   │   └── scenes/          # Game scenes
│   │       ├── BaseGameScene.ts
│   │       ├── BootScene.ts
│   │       ├── DungeonScene.ts
│   │       ├── HubScene.ts
│   │       ├── PreloadScene.ts
│   │       ├── UnderworldScene.ts
│   │       └── WildsScene.ts
│   ├── systems/             # Game systems
│   │   ├── BestowSystem.ts
│   │   ├── CombatSystem.ts
│   │   └── DevotionSystem.ts
│   └── ui/                  # UI components
│       ├── Dialog.ts
│       ├── Hud.ts
│       └── MessageToast.ts
└── public/
    └── assets/              # Placeholder for CraftPix assets
        ├── audio/
        ├── sprites/
        └── tilemaps/
```

## Scripts

- `npm run dev` - Servidor de desenvolvimento
- `npm run build` - Build de produção
- `npm run preview` - Preview do build

## Assets

O jogo usa gráficos placeholder gerados proceduralmente (retângulos coloridos 16x16). A estrutura `public/assets/` está preparada para receber packs do CraftPix:
- forest (floresta)
- dungeon (ruínas)
- tavern (hub)

## Stack

- **Phaser 3** - Game engine
- **Vite** - Build tool
- **TypeScript** - Linguagem
