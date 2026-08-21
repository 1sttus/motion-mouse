const TAU = Math.PI * 2;
const ORIENTATIONS = new Set(['portrait', 'landscape-left', 'landscape-right', 'portrait-upside-down']);

export const MOTION_MODES = Object.freeze(['relative', 'orientation']);

export function selectSensorStrategy(capabilities = {}) {
  if (capabilities.fusedAttitude) return { available: true, strategy: 'fused-attitude' };
  if (capabilities.gyroscope && capabilities.accelerometer) return { available: true, strategy: 'complementary-filter' };
  if (capabilities.gyroscope) return { available: true, strategy: 'gyro-only', warning: 'drift correction unavailable' };
  return { available: false, strategy: 'unavailable', reason: 'A fused-attitude source or gyroscope is required' };
}

export function createMotionEngine(options = {}) {
  const config = validateConfig({ mode: 'relative', sensitivity: 900, deadZoneRadians: 0.0025, smoothingTimeConstantSeconds: 0.035, acceleration: 0.35, maximumVelocity: 2_500, minimumMovement: 0.02, maximumDelta: 100, complementaryGain: 0.02, maxSampleIntervalSeconds: 0.1, ...options });
  let state = { paused: false, strategy: null, lastTimestampMs: null, lastSampleTimestampMs: null, attitude: null, previousAttitude: null, baseline: null, smooth: { x: 0, y: 0 } };
  const resetDynamics = () => { state = { ...state, previousAttitude: state.attitude, smooth: { x: 0, y: 0 } }; };
  return Object.freeze({
    getConfig: () => ({ ...config }),
    getState: () => ({ paused: state.paused, strategy: state.strategy, calibrated: state.baseline !== null, lastTimestampMs: state.lastTimestampMs }),
    pause: () => { state = { ...state, paused: true }; resetDynamics(); },
    resume: () => { state = { ...state, paused: false, baseline: state.attitude ? { ...state.attitude } : state.baseline }; resetDynamics(); },
    calibrate: () => { if (!state.attitude) return false; state = { ...state, baseline: { ...state.attitude } }; resetDynamics(); return true; },
    recenter: () => { if (!state.attitude) return false; state = { ...state, baseline: { ...state.attitude } }; resetDynamics(); return true; },
    process: (sample) => {
      const normalized = normalizeSample(sample);
      if (!normalized || (state.lastTimestampMs !== null && normalized.timestampMs <= state.lastTimestampMs)) return null;
      const strategy = selectSensorStrategy(normalized.capabilities);
      state = { ...state, strategy: strategy.strategy, lastTimestampMs: normalized.timestampMs };
      if (!strategy.available) return null;
      const dt = state.lastSampleTimestampMs === null ? 0 : Math.min((normalized.timestampMs - state.lastSampleTimestampMs) / 1000, config.maxSampleIntervalSeconds);
      const attitude = estimateAttitude(normalized, state.attitude, dt, strategy.strategy, config.complementaryGain);
      state = { ...state, attitude, lastSampleTimestampMs: normalized.timestampMs };
      if (!attitude || state.paused) { resetDynamics(); return null; }
      if (!state.baseline) state = { ...state, baseline: { ...attitude } };
      if (!state.previousAttitude) { state = { ...state, previousAttitude: { ...attitude } }; return zeroEvent(normalized.timestampMs, config.mode); }
      const raw = config.mode === 'orientation' ? attitudeDelta(state.baseline, attitude) : attitudeDelta(state.previousAttitude, attitude);
      state = { ...state, previousAttitude: { ...attitude } };
      const screen = orientVector(raw.yaw, raw.pitch, normalized.displayOrientation);
      const output = shapeMotion(screen.x, screen.y, dt, config, state.smooth);
      state = { ...state, smooth: output.smooth };
      return { deltaX: output.deltaX, deltaY: output.deltaY, velocityX: output.velocityX, velocityY: output.velocityY, timestampMs: normalized.timestampMs, mode: config.mode };
    }
  });
}

export function replaySamples(engine, samples) {
  if (!engine || !Array.isArray(samples)) throw new TypeError('engine and samples are required');
  return samples.map((sample) => engine.process(sample)).filter((event) => event !== null);
}

function validateConfig(config) {
  if (!MOTION_MODES.includes(config.mode)) throw new TypeError('mode must be relative or orientation');
  const keys = ['sensitivity', 'deadZoneRadians', 'smoothingTimeConstantSeconds', 'acceleration', 'maximumVelocity', 'minimumMovement', 'maximumDelta', 'complementaryGain', 'maxSampleIntervalSeconds'];
  if (!keys.every((key) => Number.isFinite(config[key])) || config.sensitivity < 0 || config.deadZoneRadians < 0 || config.smoothingTimeConstantSeconds < 0 || config.acceleration < 0 || config.maximumVelocity <= 0 || config.minimumMovement < 0 || config.maximumDelta <= 0 || config.complementaryGain < 0 || config.complementaryGain > 1 || config.maxSampleIntervalSeconds <= 0) throw new TypeError('invalid motion-engine configuration');
  return Object.freeze(config);
}

function normalizeSample(sample) {
  if (!sample || !Number.isFinite(sample.timestampMs) || !ORIENTATIONS.has(sample.displayOrientation ?? 'portrait')) return null;
  const finiteVector = (value) => value && ['x', 'y', 'z'].every((key) => Number.isFinite(value[key]));
  const attitude = sample.attitude && ['yaw', 'pitch', 'roll'].every((key) => Number.isFinite(sample.attitude[key])) ? sample.attitude : null;
  const capabilities = sample.capabilities ?? { fusedAttitude: Boolean(attitude), gyroscope: finiteVector(sample.gyro), accelerometer: finiteVector(sample.acceleration) };
  if ((capabilities.fusedAttitude && !attitude) || (capabilities.gyroscope && !finiteVector(sample.gyro)) || (capabilities.accelerometer && !finiteVector(sample.acceleration))) return null;
  return { timestampMs: sample.timestampMs, attitude, gyro: sample.gyro ?? null, acceleration: sample.acceleration ?? null, capabilities, displayOrientation: sample.displayOrientation ?? 'portrait' };
}

function estimateAttitude(sample, previous, dt, strategy, gain) {
  if (strategy === 'fused-attitude') return { ...sample.attitude };
  if (!previous) return sample.acceleration ? attitudeFromGravity(sample.acceleration) : { yaw: 0, pitch: 0, roll: 0 };
  const integrated = { yaw: wrap(previous.yaw + sample.gyro.z * dt), pitch: wrap(previous.pitch + sample.gyro.x * dt), roll: wrap(previous.roll + sample.gyro.y * dt) };
  if (strategy !== 'complementary-filter' || !sample.acceleration) return integrated;
  const gravity = attitudeFromGravity(sample.acceleration);
  return { yaw: integrated.yaw, pitch: blendAngle(integrated.pitch, gravity.pitch, gain), roll: blendAngle(integrated.roll, gravity.roll, gain) };
}

function attitudeFromGravity({ x, y, z }) { return { yaw: 0, pitch: Math.atan2(-x, Math.hypot(y, z)), roll: Math.atan2(y, z) }; }
function attitudeDelta(from, to) { return { yaw: wrap(to.yaw - from.yaw), pitch: wrap(to.pitch - from.pitch) }; }
function wrap(value) { return ((value + Math.PI) % TAU + TAU) % TAU - Math.PI; }
function blendAngle(from, to, gain) { return wrap(from + wrap(to - from) * gain); }
function orientVector(x, y, orientation) { if (orientation === 'landscape-left') return { x: y, y: -x }; if (orientation === 'landscape-right') return { x: -y, y: x }; if (orientation === 'portrait-upside-down') return { x: -x, y: -y }; return { x, y }; }

function shapeMotion(x, y, dt, config, previousSmooth) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= config.deadZoneRadians || dt <= 0) return { deltaX: 0, deltaY: 0, velocityX: 0, velocityY: 0, smooth: { x: 0, y: 0 } };
  const gain = config.sensitivity * (1 + config.acceleration * Math.min((magnitude / dt) / 4, 1));
  const targetX = x * gain; const targetY = y * gain;
  const alpha = config.smoothingTimeConstantSeconds === 0 ? 1 : 1 - Math.exp(-dt / config.smoothingTimeConstantSeconds);
  const smooth = { x: previousSmooth.x + (targetX - previousSmooth.x) * alpha, y: previousSmooth.y + (targetY - previousSmooth.y) * alpha };
  const speed = Math.hypot(smooth.x, smooth.y) / dt;
  const scale = speed > config.maximumVelocity ? config.maximumVelocity / speed : 1;
  const deltaX = clamp(smooth.x * scale, -config.maximumDelta, config.maximumDelta); const deltaY = clamp(smooth.y * scale, -config.maximumDelta, config.maximumDelta);
  if (Math.hypot(deltaX, deltaY) < config.minimumMovement) return { deltaX: 0, deltaY: 0, velocityX: 0, velocityY: 0, smooth: { x: 0, y: 0 } };
  return { deltaX, deltaY, velocityX: deltaX / dt, velocityY: deltaY / dt, smooth };
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function zeroEvent(timestampMs, mode) { return { deltaX: 0, deltaY: 0, velocityX: 0, velocityY: 0, timestampMs, mode }; }
