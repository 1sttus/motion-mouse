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
