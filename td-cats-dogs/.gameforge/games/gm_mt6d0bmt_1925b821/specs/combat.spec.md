# Spec — combat

gameId: `gm_mt6d0bmt_1925b821`

## Intent

Cats on the left shoot the nearest-to-base zombie in range. Zombies walk right-to-left. No physics bodies.

## Rules

- Targeting: first zombie in range with smallest `pathT` remaining (closest to base)
- Cat fire: play Shoot, spawn muzzle FX, apply damage after a short wind-up (~200ms)
- Hit: flash ?80ms, floating damage number, no hit-stop on hold
- Death: play Dead (or hide sprite), spawn Explosion, award coins
- Leak: zombie `pathT >= 1` deals `leakDamage` to base and despawns

## Slice

Cat1–3, Enemy Reg 1–2, Boss 1.
