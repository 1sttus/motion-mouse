export const PROTOCOL_VERSION = 1;

export const EVENT_KINDS = Object.freeze([
  'session.hello', 'session.ack', 'session.heartbeat', 'session.close',
  'pointer.delta', 'button', 'scroll', 'calibrate', 'settings'
]);

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
