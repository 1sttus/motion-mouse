# Architecture

## Boundaries

```text
apps/mobile (UI + native sensor/transport hosts)
  -> packages/motion-core (pure interpretation)
  -> packages/shared-models (domain vocabulary)
  -> packages/protocol (wire schema)
  -> transport boundary
apps/desktop-agent (receiver + lifecycle)
  -> packages/protocol
  -> pointer boundary -> platform adapter -> OS cursor
```

`packages/protocol`, `packages/shared-models`, and `packages/motion-core` are platform-neutral, deterministic JavaScript today; their public contracts must remain portable if moved to a typed/shared runtime later. `apps/mobile` owns UI, permissions, sensor acquisition, screen orientation, and transport lifecycle. `apps/desktop-agent` owns listener lifecycle, pairing storage, session validation, and pointer dispatch. Adapter implementations remain OS-specific.

## Proposed production technology

| Layer | Choice | Rationale |
| --- | --- | --- |
| Shared contracts/domain | TypeScript package (Phase 2 migration) | portable types and pure tests |
| Mobile host | React Native with native Kotlin/Swift sensor modules | shared UI while retaining first-class sensor access |
| Desktop agent | Rust, with native OS adapters | small distributable, strong concurrency and platform bindings |
| MVP transport | TLS WebSocket over local Wi-Fi | bidirectional, debuggable, widely supported |
| Wire encoding | versioned JSON initially | inspectable; only consider binary after measurements |
| Pairing | QR bootstrap + ephemeral key agreement | avoids unauthenticated LAN control |

The Phase 1 workspace intentionally takes no framework dependencies. Choices become implementation commitments only when native toolchains and a dependency lock are introduced.

## Dependency rules

1. Apps may depend on shared packages; shared packages never depend on apps.
2. Motion core never imports network, UI, clocks, or OS APIs.
3. Protocol never imports motion algorithms or adapters.
4. Pointer adapters consume validated semantic events, never raw network messages.
5. Platform modules cannot be imported by another platform module.
