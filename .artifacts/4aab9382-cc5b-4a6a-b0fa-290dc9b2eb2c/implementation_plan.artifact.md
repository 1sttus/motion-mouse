# Implementation Plan - Phase 3: First End-to-End Cursor

Implement a vertical slice of the Motion Mouse system, enabling a real smartphone to control a desktop cursor over a local network.

## User Review Required

> [!IMPORTANT]
> - **Platform Choices**: Mobile will be implemented as a native Android app (Kotlin). Desktop will be a Node.js agent.
> - **Pointer Control**: On Windows, the cursor will be moved using PowerShell commands as a zero-dependency implementation for the `WindowsPointerController`.
> - **Network**: Local Wi-Fi connection via WebSockets. The mobile app will require the desktop's IP address.

## Proposed Changes

### [Protocol]
Finalize and implement the wire protocol for motion data and session management.

#### [MODIFY] [index.js](file:///C:/Users/Hp/motion-mouse/packages/protocol/src/index.js)
- Add packet builders for `pointer.delta`, `session.heartbeat`, and `calibrate`.
- Enhance validation to include sequence numbers and timestamps.

---

### [Desktop Agent]
Implement the receiver and pointer controller.

#### [NEW] [server.js](file:///C:/Users/Hp/motion-mouse/apps/desktop-agent/src/receiver/server.js)
- WebSocket server implementation.
- Handles connection lifecycle, heartbeat timeouts, and packet validation.

#### [NEW] [controller.js](file:///C:/Users/Hp/motion-mouse/apps/desktop-agent/src/pointer/controller.js)
- Abstract `PointerController` class.

#### [NEW] [windows-adapter.js](file:///C:/Users/Hp/motion-mouse/apps/desktop-agent/src/adapters/windows-adapter.js)
- Implementation of `PointerController` using PowerShell for cursor movement.

---

### [Mobile App (Android)]
Implement the sensor capture and transmitter.

#### [NEW] [Android Module](file:///C:/Users/Hp/motion-mouse/apps/mobile-android)
- Create a new Android project/module within the monorepo.
- **SensorService**: Captures Gyroscope and Accelerometer data.
- **MotionEngine**: Ports the logic from `@motion-mouse/motion-core` to Kotlin.
- **NetworkClient**: WebSocket client to stream motion packets.
- **MainActivity**: UI for connection (IP input) and calibration.

---

### [Motion Core]
Ensure the core logic is accessible.

#### [MODIFY] [index.js](file:///C:/Users/Hp/motion-mouse/packages/motion-core/src/index.js)
- Small tweaks if necessary to ensure portability or provide clear algorithm specs for the Kotlin port.

## Verification Plan

### Automated Tests
- Unit tests for protocol validation in `packages/protocol`.
- Unit tests for motion shaping in `packages/motion-core`.

### Manual Verification
1. Start `desktop-agent` on the computer.
2. Deploy and open the `mobile-android` app on a phone.
3. Enter the desktop's IP and connect.
4. Move the phone and verify the desktop cursor moves accordingly.
5. Perform calibration and verify recentering.
6. Toggle Wi-Fi on the phone to test graceful reconnect and safety (cursor stops).

### Metrics
- Log sensor-to-cursor latency.
- Monitor packet rate (aiming for 60Hz).
- Log dropped packets and CPU usage of the desktop agent.
