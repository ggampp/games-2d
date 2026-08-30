# GDD — Cat Line Defense

gameId: `gm_mt6d0bmt_1925b821`  
folder: `td-cats-dogs`  
genre: **Tower defense** (`tower-defense`) — line defense, not maze path

## 1. Vision

Browser cartoon em que uma linha de gatos atira à direita enquanto zumbis avançam. Sensação de pew-pew fofo com pressão de onda.

## 2. Player fantasy

Esquadrão de gatos armados defendendo o quintal contra zumbis. Cat1 é o recruta; Cat15 é o veterano. MDA: Challenge + Submission (sensação, fantasy).

## 3. Core loop

- Verb: posicionar e upar gatos
- Objective: sobreviver N ondas
- Fail: vida da base chega a 0 (leaks)
- Camera: side-view / 3-4 painted battlefield (não top-down, não iso grid)

## 4. Mechanics

- 1–3 faixas horizontais sobre fundo pintado (sem tileset)
- Slots de gato à esquerda; zumbis spawnam à direita e andam em waypoints
- Upgrade in-place Cat1→Cat15 (dano / cadência / alcance sobem com o visual)
- Especiais (pós-slice): Boxeador (melee) e Guardião (tank)
- Moedas por kill; custo crescente de unlock / upgrade
- Base HP; leak = zumbi que cruza a linha

## 5. Dynamics (what emerges)

- Gastar cedo vs guardar para o boss
- 1 slot forte vs vários fracos
- Leak vs overkill

## 6. Progression / content

- Slice: 1 battlefield, Cat1→Cat3, 2 regulares + 1 boss, 3 ondas, win/lose
- Produção: 5 mapas, 15 tiers, 8+7 inimigos, Boxer + Guardian

## 7. Art / audio

Vetorial cartoon quente, silhueta legível, FX brilhante. UI DOM/CSS + Passion One, PT-BR, sem texto baked.  
Áudio: ELEVENLABS missing — SFX sintético no slice.

Kit: `free-cartoon-cat-defense-game-asset-kit` (Craftpix free). Spine 4.3. Servir no lugar; PNGs gerados ao lado dos `.atlas`.

## 8. Scope / MVP / risks

- Tracks: A, C, E, H
- MVP = vertical slice do loop, não campanha
- Engine: Vite + Phaser 3 + spine-phaser 4.3
- Risk: atlas PNG ausentes — packer PMA + fallback spritesheet
- Fora: loja/IAP, ads, claim premium

## Sources

- Hunicke, LeBlanc, Zubek — MDA (2004)
- GameForge catalog + extract
- Craftpix Free Cartoon Cat Defense Game Asset Kit
