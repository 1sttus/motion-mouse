# Motion Mouse

Cross-platform, local-first motion mouse. This repository is Phase 1: a dependency-free, testable domain/protocol workspace. Native mobile and desktop hosts are intentionally not yet implemented.

Run `npm.cmd install` then `npm.cmd run verify` on Windows.

## Phase 3 development slice

This is an Android Chrome → Windows-only development slice. Start the receiver with `node apps/desktop-agent/src/index.js`, open the printed HTTPS URL on an Android phone on the same private LAN, inspect/accept the development certificate, then grant motion permission. The one-time token in the URL is required to connect. Use `MOTION_MOUSE_DRY_RUN=1` to exercise the receiver without moving the Windows cursor.

It is not a production pairing or certificate experience. See SECURITY_MODEL.md before exposing it outside a private test LAN.

The architectural record is rooted in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md). No module may bypass `packages/protocol` to communicate across the phone/desktop boundary.
