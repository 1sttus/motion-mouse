# Security Model

## Assets and threats

Assets: desktop cursor control, pairing credentials, session keys, user settings. Threats: LAN discovery/spoofing, replay, unauthorized connection, malicious QR substitution, stale button-down state, and overly broad desktop privileges.

## Controls

- Explicit QR-confirmed pairing binds device identity and a short-lived bootstrap secret; show a human-verifiable confirmation on both devices.
- Derive per-session keys after pairing; encrypt/authenticate transport (TLS) and pin the paired identity. Never expose an unauthenticated control listener.
- Restrict listener to local interfaces by default; no Internet traversal, relay, or port-forwarding guidance.
- Enforce message size, schema, rate, monotonic sequence, freshness, and capability limits before dispatch.
- Expire sessions on heartbeat loss; release held buttons on every terminal failure.
- Store only required pair metadata in OS secure storage; support revoke-all and individual revocation.
- Minimize privileges. Request macOS accessibility/Windows elevation only when the platform adapter actually needs it.

Security review gates pairing UX, key lifecycle, downgrade behavior, and adapter permissions before public beta.

## Phase 3 development exception

The Android-browser spike uses a local self-signed HTTPS certificate and an unpredictable, one-time token in the displayed URL. This provides encrypted transport after the user explicitly inspects/accepts the certificate, but it is **not** the production QR identity/key-agreement design and must only be used on a private development LAN. The token is process-local and expires when the desktop agent stops. Production work must replace this exception with authenticated device pairing and a trusted certificate/identity flow.
