import assert from "node:assert/strict";
import { START_COINS, SLOT_COUNT, BASE_HP } from "../src/data/waves.ts";
import { canPlace, canUpgrade, placeCat, upgradeCats, type EconomyState } from "../src/systems/economy.ts";
import { applyDamage, pickTarget, type CombatCat, type CombatEnemy } from "../src/systems/combat.ts";
import { advanceT, createLanes, pointOnPath } from "../src/systems/path.ts";
import { createGrid } from "../src/data/layout.ts";

const lanes = createLanes();
assert.equal(lanes.length, 3);
const p0 = pointOnPath(lanes[0].points, 0);
const p1 = pointOnPath(lanes[0].points, 1);
assert.ok(p0.x > p1.x);
assert.ok(advanceT(lanes[0].points, 0, 40) > 0);
assert.equal(createGrid().length, SLOT_COUNT);

const state: EconomyState = {
  coins: START_COINS,
  catLevel: 1,
  wallHp: BASE_HP,
  slots: Array.from({ length: SLOT_COUNT }, (_, id) => ({ id, occupied: false })),
};
assert.equal(canPlace(state, state.slots[0]), true);
assert.equal(placeCat(state, state.slots[0]), true);
assert.equal(state.slots[0].occupied, true);
assert.equal(state.coins, 30);
assert.equal(canUpgrade(state), false);
state.coins = 70;
assert.equal(upgradeCats(state), true);
assert.equal(state.catLevel, 2);

const far: CombatEnemy = {
  id: 1,
  kind: "reg1",
  hp: 10,
  maxHp: 10,
  t: 0,
  x: 1200,
  y: 240,
  points: lanes[0].points,
  alive: true,
};
const near: CombatEnemy = {
  id: 2,
  kind: "reg1",
  hp: 10,
  maxHp: 10,
  t: 0.8,
  x: 360,
  y: 240,
  points: lanes[0].points,
  alive: true,
};
const cat: CombatCat = { slotId: 0, tier: 1, x: 122, y: 224, cooldown: 0 };
assert.equal(pickTarget(cat, [far, near])?.id, 2);
assert.equal(applyDamage(near, 10), true);
assert.equal(near.alive, false);

console.log("systems tests passed");
