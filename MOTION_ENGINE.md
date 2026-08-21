# Motion Engine

## Processing

`native fusion → coordinate normalization → recenter baseline → dead zone → smoothing → gain curve → bounded relative delta`.

Prefer OS-fused attitude/rotation where available; it is a capability, not a contract. The shared core consumes normalized, timestamped angular deltas, not vendor sensor objects. Baseline subtraction makes recentering explicit and avoids position drift. Dead zone precedes smoothing; gain is velocity-sensitive but bounded; output is clamped by negotiated protocol limits.

## Safety and usability

- Drop non-finite samples, negative/non-monotonic times, and samples older than freshness policy.
- Pause output during calibration, orientation transition, and focus loss.
- Never use magnetometer heading as a pointer requirement.
- Initial target is 60 Hz semantic output; adapt sensor/transport rates after profiling battery and latency.

Calibration settings are per device/profile and must be explainable: sensitivity, dominant axis mapping, inversion, smoothing, and dead-zone. Accessibility requires alternative touch controls and adjustable sensitivity.

## Phase 2 implementation

The shared engine is `packages/motion-core`. It is deterministic and has no UI, network, desktop, clock, or click dependency. Native hosts supply normalized samples:

```js
{
  timestampMs,
  attitude: { yaw, pitch, roll }, // radians; optional OS-fused attitude
  gyro: { x, y, z },              // radians/second; fallback
  acceleration: { x, y, z },      // m/s²; fallback
  displayOrientation: 'portrait' | 'landscape-left' | 'landscape-right' | 'portrait-upside-down',
  capabilities: { fusedAttitude, gyroscope, accelerometer }
}
```

It emits `{ deltaX, deltaY, velocityX, velocityY, timestampMs, mode }` as semantic relative motion units, not screen pixels.

Strategy selection is capability-driven: native fused attitude is preferred; gyro plus accelerometer uses a complementary filter that integrates gyro motion and corrects pitch/roll toward gravity; gyro-only is allowed with a drift warning. No magnetometer value is consumed. It is unnecessary for relative pointing and would introduce environmental heading instability.

Relative mode uses the consecutive attitude delta. Orientation mode uses displacement from a calibrated baseline and is marked experimental. Calibration/recentering resets its baseline and smoothing history. Pause consumes and validates fresh samples but emits no event; resume resets dynamics and, in orientation mode, resets the reference to prevent a jump. Invalid/non-monotonic samples are dropped, and a long elapsed interval is capped.

The implemented stages are dead-zone, exponential time-based smoothing, bounded velocity-sensitive gain, maximum velocity/delta clamping, and minimum output threshold. Configuration exposes each of those controls plus complementary-filter gain.
