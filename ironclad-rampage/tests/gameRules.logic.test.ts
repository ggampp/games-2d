import test from 'node:test';
import assert from 'node:assert/strict';
import { depthPresentation, isInMeleeRange, PATH_BOUNDS, WAVES } from '../src/game/gameRules.ts';

test('waves progress from regular enemies to the boss', () => {
  assert.equal(WAVES.length, 4);
  assert.equal(WAVES.at(-1)?.spawns[0]?.kind, 'boss');
  assert.ok(WAVES.every((wave) => wave.spawns.length > 0));
});

test('melee rules enforce facing and lane distance', () => {
  assert.equal(isInMeleeRange(0, -2, 1, 1, -2, 0.5, 1.2), true);
  assert.equal(isInMeleeRange(0, -2, 1, -1, -2, 0.5, 1.2), false);
  assert.equal(isInMeleeRange(0, -2, 1, 0.2, PATH_BOUNDS.maxY + 2, 0.5, 1.2), false);
});

test('depth presentation draws southern fighters in front', () => {
  const north = depthPresentation(PATH_BOUNDS.maxY);
  const south = depthPresentation(PATH_BOUNDS.minY);
  assert.ok(south.renderOrder > north.renderOrder);
  assert.ok(south.z > north.z);
});
