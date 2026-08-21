export function normalizeDelta(sample, calibration) {
  if (!sample || !calibration || !Number.isFinite(sample.dx) || !Number.isFinite(sample.dy)) return null;
  const { sensitivity = 1, deadZone = 0, invertX = false, invertY = false, maxDelta = 1_000 } = calibration;
  if (![sensitivity, deadZone, maxDelta].every(Number.isFinite) || sensitivity < 0 || deadZone < 0 || maxDelta <= 0) return null;
  const scale = (value, inverted) => {
    const signed = (inverted ? -value : value) * sensitivity;
    if (Math.abs(signed) <= deadZone) return 0;
    return Math.max(-maxDelta, Math.min(maxDelta, signed));
  };
  return { dx: scale(sample.dx, invertX), dy: scale(sample.dy, invertY) };
}
