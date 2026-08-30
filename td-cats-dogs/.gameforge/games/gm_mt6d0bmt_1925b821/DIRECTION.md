# Direction — Cat Line Defense

- Genre: **Tower defense** (`tower-defense`) — line defense
- Art: **Cel / toon** (Craftpix cartoon cats vs zombies)
- Verb: posicionar e upar gatos
- Objective: sobreviver N ondas
- Fail: vida da base = 0
- Camera: side-view painted battlefield, fixed, y-sort
- Physics: none (waypoints + range checks)
- Engine: Vite + Phaser 3 + `@esotericsoftware/spine-phaser` 4.3
- Systems: path, waves, combat, economy, hud, spine-atlas
- Tracks: A, C, E, H

## Art notes

Contorno + rampas; silhueta primeiro. Gatos à esquerda, zumbis à direita. FX de tiro e explosão brilhantes. HUD DOM, Passion One, PT-BR.

## Juice (primary verb)

Place/upgrade: scale tween (não linear). Hit: flash ≤80ms + number pop. Kill: Explosion. Shake só no offset da câmera.

## Rule

Do not hide missing forms with bloom/fog. Build the playable loop before the graphics pass.
Serve the kit in place. Pack atlas PNGs to exact `.atlas` bounds (PMA). Fallback spritesheet if Spine QC fails.
