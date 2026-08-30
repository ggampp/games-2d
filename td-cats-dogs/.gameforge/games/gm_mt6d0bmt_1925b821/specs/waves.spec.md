# Spec — waves

gameId: `gm_mt6d0bmt_1925b821`

## Intent

Three authored waves on one battlefield. Spawn from the right on 1–3 lanes.

## Slice waves

1. 6× Reg1, interval 1.1s, 1 lane
2. 5× Reg1 + 3× Reg2, interval 0.9s, 2 lanes
3. 4× Reg2 + 1× Boss1, interval 1.0s, 2 lanes

## Win / fail

Win when last wave spawned and no living enemies remain and base HP > 0.  
Fail when base HP ? 0.
