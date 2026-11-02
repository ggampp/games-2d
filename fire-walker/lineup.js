// Fire Walker — "Vitrine 1x": every character side by side at 1x, next to a floor tile.
//
// The pixel-art rule for new assets: before one goes in, put it next to a tile at
// 1x and check that the pixel sizes match. This mode freezes the game, puts the
// three heroes, the four enemy types and the Guardian on the Ruins floor (bricks of
// 12×5 px), outlines one brick and labels it. Everything is drawn by the same
// rasterizer as the game, so a mismatched asset shows up here at once.

'use strict';

const lineup = { on: false, saved: null, foes: [], shadows: [] };
const LINEUP_CAM = 196;
const LINEUP_HEROES = [['andarilho', 212], ['bruxa', 234], ['paladino', 257]];
const LINEUP_FOES = [['ghoul', 285, 0], ['cultist', 308, 0], ['bat', 328, FEET_Y - 54], ['brute', 352, 0], ['boss', 418, 0]];
const LINEUP_TILE = { x: 216, w: 12, y: GROUND + 2, h: 5 }; // one Ruins brick, mortar included
const LINEUP_MARK = pack(hexRgb('#ffd166'));

function setLineup(on) {
  if (on === lineup.on) return;
  if (on) {
    lineup.saved = { x: ch.x, y: ch.y, facing: ch.facing, hero: cfg.hero, enemies: enemies.splice(0) };
    // A neutral, standing pose for everyone.
    spell.state = 'idle';
    melee.state = 'idle';
    defense.block = defense.rolling = false;
    defense.blockK = 0;
    dissolve.state = 'none';
    Object.assign(ch, { vx: 0, vy: 0, hurt: 0, flash: 0, invuln: 0, air: 0, crouch: 0, squash: 0, onGround: true });
    lineup.foes = LINEUP_FOES.map(([type, x, y]) => {
      const e = makeEnemy(type, x, -1);
      e.scale = 1;
      e.phase = 0;
      if (y) e.y = y;
      if (e.def.boss) e.state = 'intro'; // sword raised, so it doesn't cross the others
      return e;
    });
  } else {
    const s = lineup.saved;
    cfg.hero = s.hero;
    Object.assign(ch, { x: s.x, y: s.y, facing: s.facing });
    enemies.push(...s.enemies);
    resetSecondary(ch.x);
    updateCamera(0, true);
  }
  lineup.on = on;
}

// Replaces the game tick while the showcase is on (main.js calls it).
function lineupTick() {
  cam.x = cam.ix = LINEUP_CAM;
  fx.fill(0);
  fxE.fill(0);
  fire.fill(0);
  pbuf.fill(0);
  mask.fill(0);
  owner.fill(0);
  partCount = 0;
  ownerFlash.fill(0);
  ownerChar.fill(0);
  lineup.shadows.length = 0;
  lineup.foes.forEach((e, k) => {
    e.rid = 3 + k;
    drawOwner = e.rid;
    if (e.def.fly) {
      e.flapPh += DT * 10;
      computeBatPose(e);
      lineup.shadows.push({ x: e.x, rx: 5, k: 0.25 });
    } else {
      e.t += DT;
      computeWalkerPose(e, DT);
      lineup.shadows.push({ x: e.x, rx: 6 + e.def.halfW, k: 0.5 });
    }
    drawEnemy(e);
  });
  drawOwner = 1;
  LINEUP_HEROES.forEach(([name, x], k) => {
    cfg.hero = name;
    Object.assign(ch, { x, y: FEET_Y, facing: 1 });
    computePose(simTime);
    resetSecondary(x);
    for (let i = 0; i < 40; i++) updateSecondary(simTime, DT); // let the scarf/cape settle
    drawCharacter();
    // compose() adds the shadow of the current hero (the last one); the others go here.
    if (k < LINEUP_HEROES.length - 1) lineup.shadows.push({ x, rx: 11, k: 0.55 });
  });
  shade();
  simTime += DT;
  tickCount++;
}

// Title, the outlined tile and its label, in the game's own pixel font.
function drawLineupMarks(visLeft) {
  pixelText('Vitrine 1x', visLeft + 5, 6);
  pixelText('Mesmo pixel para tudo', visLeft + 5, 14, UI.dim);
  const t = LINEUP_TILE;
  const x0 = t.x - cam.ix - 1;
  const x1 = t.x - cam.ix + t.w;
  const y0 = t.y - 1;
  const y1 = t.y + t.h;
  for (let x = x0; x <= x1; x++) { px(x, y0, LINEUP_MARK); px(x, y1, LINEUP_MARK); }
  for (let y = y0; y <= y1; y++) { px(x0, y, LINEUP_MARK); px(x1, y, LINEUP_MARK); }
  pixelText('Tile 12x5', x0, y1 + 3, LINEUP_MARK);
}
