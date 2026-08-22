import test from 'node:test';
import assert from 'node:assert/strict';
import { MotionSession } from '../src/receiver/MotionSession.js';

const token = 'a'.repeat(32);
const hello = { v: 1, kind: 'session.hello', seq: 0, sentAtMs: 1_000, payload: { deviceId: 'android-phone', pairingToken: token } };

test('session accepts ordered motion and records sequence gaps', () => {
  let now = 1_000; const moved = []; const session = new MotionSession({ pairingToken: token, pointer: { move: (...delta) => moved.push(delta) }, now: () => now });
  const acknowledgement = session.handle(hello).reply;
  assert.equal(acknowledgement.kind, 'session.ack');
  assert.equal(session.handle({ v: 1, kind: 'pointer.delta', sessionId: acknowledgement.sessionId, seq: 2, sentAtMs: 1_000, payload: { dx: 2, dy: -1 } }).ok, true);
  assert.deepEqual(moved, [[2, -1]]);
  assert.equal(session.snapshot().dropped, 1);
  assert.equal(session.handle({ v: 1, kind: 'pointer.delta', sessionId: acknowledgement.sessionId, seq: 2, sentAtMs: 1_000, payload: { dx: 9, dy: 9 } }).ok, false);
});

test('session rejects malformed input and expires without a heartbeat', () => {
  let now = 1_000; const session = new MotionSession({ pairingToken: token, pointer: { move() {} }, now: () => now, timeoutMs: 100 });
  assert.equal(session.handle({ nope: true }).ok, false);
  session.handle(hello); now = 1_101;
  assert.equal(session.expired(), true);
});
