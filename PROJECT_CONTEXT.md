# Project Context

## Product

Motion Mouse makes a phone a wireless, motion-controlled pointing device. Tilt/movement is the primary pointer source; touch zones issue discrete buttons, drag, scroll, and re-centering commands.

## Source of truth

| Concern | Authoritative document |
| --- | --- |
| Scope, constraints, status | this document |
| Structure and ownership | ARCHITECTURE.md |
| Relationships and failures | SYSTEM_GRAPH.md |
| Wire contract | PROTOCOL.md |
| Motion behavior | MOTION_ENGINE.md |
| Platform facts | PLATFORM_MATRIX.md |
| Security | SECURITY_MODEL.md |
| Decisions | DECISIONS.md |
| Quality | TESTING_STRATEGY.md |
| Delivery | ROADMAP.md |

## Current status

Phase 3 Android-browser → Windows development slice. The repository now provides a WSS receiver, explicit session protocol, reconnect/heartbeat safety, Android browser sensor sender, and a Windows-only pointer adapter. It was dry-run and protocol smoke-tested; it has not yet been demonstrated on a connected physical phone or with real cursor movement.

## Verified development environment (2026-08-21)

- Host: Windows 10 amd64 (reported by installed Gradle); Node.js 24.16.0 and npm 11.13.0 are the selected Phase 1 package manager/toolchain.
- Available: JDK 21 and a Gradle installation, although Gradle cannot load its `native-platform.dll` on this host.
- Unavailable: Android SDK/ADB, Flutter/Dart, Swift/Xcode, Rust/Cargo, pnpm, and Yarn.
- Consequently, only the dependency-free Node workspace is a build target in Phase 1. Android, iOS, macOS, and Linux native hosts are directory/documentation boundaries—not buildable claims.
- This directory was not initialized as a Git repository when inspected.

## Invariants

- Local network only in the MVP; no cloud relay or telemetry.
- Desktop input injection is a privileged platform boundary and is never shared logic.
- Every input event is authenticated, session-scoped, ordered, and bounded.
- Sensor fusion availability is probed at runtime; no phone sensor is assumed.
- Architectural changes require an entry in DECISIONS.md.

## Assumptions and open questions

- MVP active-session requirement: the mobile app remains foregrounded.
- Decide product policy for desktop access during elevated/UAC windows on Windows.
- Validate a secure, user-friendly QR pairing UX before committing to cryptographic library APIs.
- Benchmark Wi-Fi latency and motion feel on representative devices before setting final filter constants.
