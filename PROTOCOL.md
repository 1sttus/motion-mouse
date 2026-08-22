# Protocol

## Transport and envelope

MVP uses one authenticated TLS WebSocket per paired session. Discovery and QR bootstrap are separate from the post-pairing transport. Payloads are versioned JSON during validation; no event is actioned before schema, session, sequence, timestamp, and MAC/transport-authentication validation.

```json
{"v":1,"kind":"pointer.delta","sessionId":"opaque","seq":42,"sentAtMs":123456,"payload":{"dx":1.25,"dy":-0.5}}
```

## Event families

| Family | Payload | Semantics |
| --- | --- | --- |
| `session.*` | hello, ack, heartbeat, close | lifecycle only |
| `pointer.delta` | finite `dx`, `dy` | relative motion, coalescible |
| `button` | button, action | down/up; never coalesce away state transition |
| `scroll` | finite `dx`, `dy`, mode | relative scroll |
| `calibrate` | action | baseline/reset request |
| `settings` | negotiated capabilities | receiver-approved values only |

Sequence numbers are strictly increasing per session. Receiver rejects duplicate/old messages, future timestamps outside a small clock tolerance, payloads exceeding negotiated bounds, and unknown required fields. Motion is lossy/coalescible; button transitions are reliable and idempotently keyed by sequence. Protocol changes require a decision record and a compatibility test.

## Phase 3 Android-to-Windows profile

The development slice uses HTTPS/WSS and version `1`. The Android sender first sends `session.hello` with `seq: 0`, a stable device ID, and the one-time pairing token displayed by the receiver. The receiver responds with a generated `session.ack` session ID. All later packets carry that session ID and a strictly increasing sequence.

`pointer.delta` payloads are exactly `{ "dx": number, "dy": number }`; each finite value is bounded to ±100 semantic movement units. Heartbeats occur each second; the receiver closes a session after 3 seconds without a valid packet. Duplicate, stale, malformed, unauthorized, oversized, or clock-skewed packets cannot reach the pointer controller. A reconnect starts a new session and sequence stream.
