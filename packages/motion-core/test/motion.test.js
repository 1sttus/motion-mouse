import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionEngine, replaySamples, selectSensorStrategy } from '../src/index.js';
import stationary from './fixtures/stationary.json' with { type: 'json' };
import slow from './fixtures/slow-movement.json' with { type: 'json' };
import fast from './fixtures/fast-movement.json' with { type: 'json' };
import rotation from './fixtures/orientation-change.json' with { type: 'json' };

const testOptions = { sensitivity: 100, deadZoneRadians: 0.001, smoothingTimeConstantSeconds: 0, acceleration: 0, maximumVelocity: 10_000, maximumDelta: 1_000, minimumMovement: 0 };

test('detects available sensor strategies without requiring a magnetometer', () => {
  assert.deepEqual(selectSensorStrategy({ fusedAttitude: true }), { available: true, strategy: 'fused-attitude' });
  assert.equal(selectSensorStrategy({ gyroscope: true, accelerometer: true }).strategy, 'complementary-filter');
  assert.equal(selectSensorStrategy({}).available, false);
});

test('recorded stationary noise remains inside the dead zone', () => {
  const events = replaySamples(createMotionEngine({ ...testOptions, deadZoneRadians: 0.003 }), stationary);
  assert.ok(events.every((event) => event.deltaX === 0 && event.deltaY === 0));
});

test('recorded slow and fast movement are deterministic and bounded', () => {
  const config = { ...testOptions, maximumDelta: 2 };
  const first = replaySamples(createMotionEngine(config), slow);
  const second = replaySamples(createMotionEngine(config), slow);
  assert.deepEqual(first, second);
  assert.ok(first.some((event) => event.deltaX > 0));
  const fastEvents = replaySamples(createMotionEngine(config), fast);
  assert.ok(fastEvents.some((event) => event.deltaX === 2));
});

test('recenter removes orientation-mode displacement and pause suppresses output', () => {
  const engine = createMotionEngine({ ...testOptions, mode: 'orientation' });
  engine.process(rotation[0]);
  assert.ok(engine.process(rotation[1]).deltaX > 0);
  assert.equal(engine.recenter(), true);
  assert.equal(engine.process(rotation[2]).deltaX, 0);
  engine.pause();
  assert.equal(engine.process(rotation[3]), null);
  engine.resume();
  assert.equal(engine.process(rotation[4]).deltaX, 0);
});

test('complementary fallback handles low and high sensor frequencies', () => {
  const sample = (timestampMs, gyroZ) => ({ timestampMs, gyro: { x: 0, y: 0, z: gyroZ }, acceleration: { x: 0, y: 0, z: 9.81 }, capabilities: { gyroscope: true, accelerometer: true } });
  const low = replaySamples(createMotionEngine(testOptions), [sample(0, 0), sample(100, 1)]);
  const high = replaySamples(createMotionEngine(testOptions), [sample(0, 0), sample(10, 1), sample(20, 1), sample(30, 1), sample(40, 1), sample(50, 1), sample(60, 1), sample(70, 1), sample(80, 1), sample(90, 1), sample(100, 1)]);
  assert.ok(low.at(-1).deltaX > 0);
  assert.ok(high.at(-1).deltaX > 0);
});

test('maps motion through the reported display orientation', () => {
  const engine = createMotionEngine(testOptions);
  engine.process({ timestampMs: 0, attitude: { yaw: 0, pitch: 0, roll: 0 }, displayOrientation: 'portrait' });
  const event = engine.process({ timestampMs: 20, attitude: { yaw: 0.1, pitch: 0, roll: 0 }, displayOrientation: 'landscape-left' });
  assert.equal(event.deltaX, 0);
  assert.ok(event.deltaY < 0);
});

test('rejects non-monotonic or unavailable samples', () => {
  const engine = createMotionEngine(testOptions);
  assert.equal(engine.process({ timestampMs: 1, capabilities: {} }), null);
  assert.equal(engine.process({ timestampMs: 2, attitude: { yaw: 0, pitch: 0, roll: 0 } }).timestampMs, 2);
  assert.equal(engine.process({ timestampMs: 2, attitude: { yaw: 1, pitch: 0, roll: 0 } }), null);
});
