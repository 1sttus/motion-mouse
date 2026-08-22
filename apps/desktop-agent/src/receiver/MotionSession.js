import { randomUUID } from 'node:crypto';
import { validateSessionEvent } from '@motion-mouse/protocol';

export class MotionSession {
  constructor({ pairingToken, pointer, now = () => Date.now(), timeoutMs = 3_000, maxClockSkewMs = 60_000 }) {
    this.pairingToken = pairingToken; this.pointer = pointer; this.now = now; this.timeoutMs = timeoutMs; this.maxClockSkewMs = maxClockSkewMs;
    this.id = null; this.lastSequence = -1; this.lastSeenMs = 0; this.deviceId = null; this.metrics = { accepted: 0, dropped: 0, malformed: 0, latencyTotalMs: 0 };
  }
  handle(event) {
    const check = validateSessionEvent(event);
    if (!check.ok) return this.reject('malformed');
    if (!this.id) {
      if (event.kind !== 'session.hello' || event.payload.pairingToken !== this.pairingToken) return this.reject('unauthorized');
      this.id = randomUUID(); this.deviceId = event.payload.deviceId; this.lastSequence = event.seq; this.lastSeenMs = this.now();
      return { ok: true, reply: { v: 1, kind: 'session.ack', sessionId: this.id, seq: 0, sentAtMs: this.now(), payload: { heartbeatIntervalMs: 1_000, timeoutMs: this.timeoutMs } } };
    }
    if (event.sessionId !== this.id) return this.reject('session');
    if (event.seq <= this.lastSequence) return this.reject('sequence');
    if (Math.abs(this.now() - event.sentAtMs) > this.maxClockSkewMs) return this.reject('timestamp');
    this.metrics.dropped += Math.max(0, event.seq - this.lastSequence - 1); this.lastSequence = event.seq; this.lastSeenMs = this.now();
    if (event.kind === 'pointer.delta') { this.pointer.move(event.payload.dx, event.payload.dy); this.metrics.accepted += 1; this.metrics.latencyTotalMs += Math.max(0, this.now() - event.sentAtMs); }
    return { ok: true };
  }
  expired() { return this.id !== null && this.now() - this.lastSeenMs > this.timeoutMs; }
  snapshot() { return { connected: this.id !== null, deviceId: this.deviceId, accepted: this.metrics.accepted, dropped: this.metrics.dropped, malformed: this.metrics.malformed, averageLatencyMs: this.metrics.accepted ? this.metrics.latencyTotalMs / this.metrics.accepted : 0 }; }
  close() { this.id = null; }
  reject(reason) { if (reason === 'malformed') this.metrics.malformed += 1; return { ok: false, reason }; }
}
