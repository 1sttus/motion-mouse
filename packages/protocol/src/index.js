export const PROTOCOL_VERSION = 1;

export const EVENT_KINDS = Object.freeze([
  'session.hello', 'session.ack', 'session.heartbeat', 'session.close',
  'pointer.delta', 'button', 'scroll', 'calibrate', 'settings'
]);

export const MAX_POINTER_DELTA = 100;

export function isFiniteDelta(value) {
  return Number.isFinite(value) && Math.abs(value) <= 10_000;
}

export function validateEnvelope(event) {
  if (!event || typeof event !== 'object') return false;
  return event.v === PROTOCOL_VERSION
    && EVENT_KINDS.includes(event.kind)
    && typeof event.sessionId === 'string' && event.sessionId.length > 0
    && Number.isSafeInteger(event.seq) && event.seq >= 0
    && Number.isFinite(event.sentAtMs)
    && event.payload && typeof event.payload === 'object';
}

export function validateSessionEvent(event) {
  if (!event || typeof event !== 'object' || event.v !== PROTOCOL_VERSION || !EVENT_KINDS.includes(event.kind)) return { ok: false, reason: 'unsupported envelope' };
  if (!Number.isSafeInteger(event.seq) || event.seq < 0 || !Number.isFinite(event.sentAtMs) || !event.payload || typeof event.payload !== 'object') return { ok: false, reason: 'invalid sequence, timestamp, or payload' };
  if (event.kind === 'session.hello') return typeof event.payload.deviceId === 'string' && event.payload.deviceId.length <= 128 && typeof event.payload.pairingToken === 'string' && event.payload.pairingToken.length >= 32 ? { ok: true } : { ok: false, reason: 'invalid hello' };
  if (typeof event.sessionId !== 'string' || event.sessionId.length < 16) return { ok: false, reason: 'invalid session' };
  if (event.kind === 'pointer.delta' && (!isFiniteDelta(event.payload.dx) || !isFiniteDelta(event.payload.dy) || Math.abs(event.payload.dx) > MAX_POINTER_DELTA || Math.abs(event.payload.dy) > MAX_POINTER_DELTA)) return { ok: false, reason: 'invalid pointer delta' };
  return { ok: true };
}
