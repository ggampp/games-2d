# Ironclad Rampage

Cartoon medieval **side-scrolling beat 'em up** inspired by the feel of classic Capcom arcade brawlers (original IP — not affiliated with Cadillacs and Dinosaurs).

**Hero:** Sir Clankalot — heavy blue knight with mace  
**Tone:** bright cartoon  
**Mounts:** on foot for this slice (horse/cart later)

## Play

```powershell
cd D:\claude_projects\dev-games\ironclad-rampage
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`).

## Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Move | WASD / Arrows | Virtual stick |
| Attack | J / Z / Space | Attack |
| Special smash | K / X | Special |
| Start / retry | Enter | Start button |

## Slice content

1. Bandits on the road  
2. Bone patrol (skeletons + bandit)  
3. Gate guardians  
4. Boss: **Sir Malice**

Art generated with Imagine (`public/art/`), white backgrounds keyed out at runtime.

## Stack

- Vite + TypeScript + Three.js (sprite planes + side camera)
- Procedural UI / HUD
- Web Audio blips for hits

## Next ideas

- Walk / attack sprite frames via `image_edit` from the same base hero
- SnapOtter pipeline for clean PNG sheets
- Second stage (castle interior)
- Horse mount power-up
- Local co-op
