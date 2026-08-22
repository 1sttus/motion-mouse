# Roadmap

| Phase | Deliverable | Definition of Done |
| --- | --- | --- |
| 1: Foundation | workspace, contracts, motion core, architecture docs | repository verification passes; no platform behavior claimed |
| 2: Android→Windows vertical slice | foreground sensor sender, paired Wi-Fi session, Windows relative cursor | measured local latency; clean disconnect; adapter/device tests pass |
| 3: iOS + macOS | native sensor and Quartz adapter | permission UX tested; equivalent protocol conformance passes |
| 4: Linux | X11 and supported Wayland portal paths | compositor support matrix and integration suite published |
| 5: Product hardening | settings, accessibility, observability, installer/signing | security review, load/fault tests, accessibility acceptance |
| 6: Bluetooth investigation | feasibility prototype | documented capability/power/reliability decision; no silent scope expansion |

Each phase closes only when acceptance criteria and linked test evidence are recorded in PROJECT_CONTEXT.md and relevant decision changes are logged.

## Phase 3 status

The Android-browser to Windows vertical slice is in progress. Automated protocol, motion, and dry-run WSS validation pass. It cannot be marked complete until a physical Android phone performs the connection, motion, stop, disconnect, and reconnect acceptance sequence on the local network and the requested latency, packet-rate, drop, CPU, and stability measurements are recorded.
