import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDelta } from '../src/index.js';

test('motion normalization applies sensitivity, dead zone, inversion, and bounds', () => {
  assert.deepEqual(normalizeDelta({ dx: 1, dy: 5 }, { sensitivity: 2, deadZone: 3, invertY: true, maxDelta: 6 }), { dx: 0, dy: -6 });
});

test('motion normalization rejects invalid samples', () => {
  assert.equal(normalizeDelta({ dx: NaN, dy: 1 }, {}), null);
});
