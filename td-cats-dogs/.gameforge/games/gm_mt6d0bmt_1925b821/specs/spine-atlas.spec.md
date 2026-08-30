# Spec — spine-atlas

gameId: `gm_mt6d0bmt_1925b821`

## Intent

Rebuild missing atlas PNGs so Spine 4.3 JSON+atlas can load. Kit stays in `free-cartoon-cat-defense-game-asset-kit`.

## Packer

Parse `.atlas` pages: name, size, filter, pma, regions (`bounds`, `offsets`, `rotate`).  
Place each part image into `bounds`, rotate 90° when flagged, write PMA PNG next to the atlas.

## Fallback

If a skeleton fails visual QC, battle uses generated full-body sprites (Idle/Shoot or walk bob). Packer tests still pass on layout.
