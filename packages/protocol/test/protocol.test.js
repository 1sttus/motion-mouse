import test from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, isFiniteDelta, validateEnvelope, validateSessionEvent } from '../src/index.js';

test('accepts a minimum valid envelope', () => {
  assert.equal(validateEnvelope({ v: PROTOCOL_VERSION, kind: 'pointer.delta', sessionId: 's', seq: 0, sentAtMs: 1, payload: { dx: 0, dy: 0 } }), true);
});

test('validates explicit session packets and bounds pointer movement', () => {
  const hello = { v: PROTOCOL_VERSION, kind: 'session.hello', seq: 0, sentAtMs: 1, payload: { deviceId: 'android-browser', pairingToken: 'a'.repeat(32) } };
  assert.deepEqual(validateSessionEvent(hello), { ok: true });
  assert.equal(validateSessionEvent({ ...hello, kind: 'pointer.delta', sessionId: 'x'.repeat(16), payload: { dx: 101, dy: 0 } }).ok, false);
});

test('rejects malformed envelope and unbounded delta', () => {
  assert.equal(validateEnvelope({}), false);
  assert.equal(isFiniteDelta(Infinity), false);
  assert.equal(isFiniteDelta(10_001), false);
});
