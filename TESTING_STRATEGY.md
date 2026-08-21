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
