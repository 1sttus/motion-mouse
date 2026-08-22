# Testing Strategy

| Layer | Automated check | Native/device check |
| --- | --- | --- |
| Protocol | schema, bounds, ordering, compatibility fixtures | loopback WebSocket integration |
| Motion core | deterministic traces, property tests, edge time values | device trace replay across orientations |
| Mobile host | permission/lifecycle contract tests | Android/iOS sensor availability and battery runs |
| Receiver | malformed/replay/rate-limit tests | LAN disconnect/reconnect tests |
| Adapters | semantic call contract tests | real OS permission, multi-monitor, elevated-app tests |
| Security | pairing/revocation/expiry adversarial tests | QR UX and local-network attack test |

Phase 1 gates: Node syntax check, structural lint, unit tests, package dependency rules, and documentation-reference validation. CI must execute platform-native jobs only after the corresponding toolchain is provisioned. Record measured latency (p50/p95/p99), disconnect recovery, and battery impact before beta.

Phase 2 motion fixtures exercise stationary noise, slow/fast (including sudden) fused movement, calibration/recentering, pause/resume, display-orientation mapping, timestamp rejection, and low/high-rate gyro+accelerometer fallback. Fixtures replay through the public engine interface, ensuring deterministic output. Real Android and iOS capture traces are required before production tuning.

Phase 3 tests cover valid ordered sessions, sequence-gap accounting, malformed-packet rejection, and heartbeat expiry. A dry-run HTTPS/WSS smoke run successfully completed hello/ack and a pointer packet without moving the OS cursor. The physical acceptance sequence and latency, packet-rate, drop, CPU, and network-stability measurements remain blocked on an Android phone connected to the test LAN.
