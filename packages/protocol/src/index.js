export const PROTOCOL_VERSION = 1;

export const EVENT_KINDS = Object.freeze([
  'session.hello',    // Initial connection attempt
  'session.auth',     // Token-based authentication
  'session.ack',      // Acknowledgement (e.g., auth success)
  'session.heartbeat',// Keep-alive
  'session.close',    // Graceful disconnect
  'pointer.delta',    // Motion data
  'button',           // Clicks (Phase 4)
  'scroll',           // Scrolling (Phase 4)
  'calibrate',        // Recenter request
  'settings'          // Capability negotiation
]);

export const BUTTONS = Object.freeze(['left', 'right', 'middle']);
export const ACTIONS = Object.freeze(['down', 'up']);

export const MAX_POINTER_DELTA = 1000;
export const MAX_SCROLL_DELTA = 5000;

export function isFiniteDelta(value) {
  return Number.isFinite(value) && Math.abs(value) <= 10_000;
}

export function validateEnvelope(event) {
  if (!event || typeof event !== 'object') return false;
  return event.v === PROTOCOL_VERSION
    && EVENT_KINDS.includes(event.kind)
    && Number.isSafeInteger(event.seq) && event.seq >= 0
    && Number.isFinite(event.sentAtMs)
    && event.payload && typeof event.payload === 'object';
}

export function validateSessionEvent(event) {
  if (!validateEnvelope(event)) return { ok: false, reason: 'invalid envelope' };

  const { kind, payload, sessionId } = event;

  // Handshake events don't require sessionId yet
  if (kind === 'session.hello') {
    return typeof payload.deviceId === 'string' && payload.deviceId.length > 0
      ? { ok: true } : { ok: false, reason: 'invalid hello payload' };
  }

  if (kind === 'session.auth') {
    return typeof payload.token === 'string' && payload.token.length > 0
      ? { ok: true } : { ok: false, reason: 'invalid auth token' };
  }

  // Active session events require sessionId
  if (typeof sessionId !== 'string' || sessionId.length < 8) {
    return { ok: false, reason: 'missing or invalid sessionId' };
  }

  if (kind === 'pointer.delta') {
    const { dx, dy } = payload;
    if (!isFiniteDelta(dx) || !isFiniteDelta(dy) || Math.abs(dx) > MAX_POINTER_DELTA || Math.abs(dy) > MAX_POINTER_DELTA) {
      return { ok: false, reason: 'pointer delta out of bounds or non-finite' };
    }
  }

  if (kind === 'button') {
    if (!BUTTONS.includes(payload.button) || !ACTIONS.includes(payload.action)) {
      return { ok: false, reason: 'invalid button or action' };
    }
  }

  if (kind === 'scroll') {
    const { dx, dy } = payload;
    if (!isFiniteDelta(dx) || !isFiniteDelta(dy) || Math.abs(dx) > MAX_SCROLL_DELTA || Math.abs(dy) > MAX_SCROLL_DELTA) {
      return { ok: false, reason: 'scroll delta out of bounds or non-finite' };
    }
  }

  return { ok: true };
}

/**
 * Packet Builders
 */

export function createAuthPacket(token, seq) {
  return {
    v: PROTOCOL_VERSION,
    kind: 'session.auth',
    seq,
    sentAtMs: Date.now(),
    payload: { token }
  };
}

export function createPointerDeltaPacket(sessionId, seq, dx, dy) {
  return {
    v: PROTOCOL_VERSION,
    kind: 'pointer.delta',
    sessionId,
    seq,
    sentAtMs: Date.now(),
    payload: { dx, dy }
  };
}

export function createButtonPacket(sessionId, seq, button, action) {
  return {
    v: PROTOCOL_VERSION,
    kind: 'button',
    sessionId,
    seq,
    sentAtMs: Date.now(),
    payload: { button, action }
  };
}

export function createScrollPacket(sessionId, seq, dx, dy) {
  return {
    v: PROTOCOL_VERSION,
    kind: 'scroll',
    sessionId,
    seq,
    sentAtMs: Date.now(),
    payload: { dx, dy }
  };
}

export function createHeartbeatPacket(sessionId, seq) {
  return {
    v: PROTOCOL_VERSION,
    kind: 'session.heartbeat',
    sessionId,
    seq,
    sentAtMs: Date.now(),
    payload: {}
  };
}

export function createCalibratePacket(sessionId, seq) {
  return {
    v: PROTOCOL_VERSION,
    kind: 'calibrate',
    sessionId,
    seq,
    sentAtMs: Date.now(),
    payload: {}
  };
}
