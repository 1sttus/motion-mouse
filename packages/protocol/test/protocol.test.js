import test from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, isFiniteDelta, validateEnvelope } from '../src/index.js';

test('accepts a minimum valid envelope', () => {
  assert.equal(validateEnvelope({ v: PROTOCOL_VERSION, kind: 'pointer.delta', sessionId: 's', seq: 0, sentAtMs: 1, payload: { dx: 0, dy: 0 } }), true);
});

test('rejects malformed envelope and unbounded delta', () => {
  assert.equal(validateEnvelope({}), false);
  assert.equal(isFiniteDelta(Infinity), false);
  assert.equal(isFiniteDelta(10_001), false);
});
