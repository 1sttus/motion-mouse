# Decisions

| ID | Decision | Status | Rationale / consequences |
| --- | --- | --- | --- |
| ADR-001 | Wi-Fi TLS WebSocket is the MVP transport. | Accepted | Uniform Android/iOS/desktop path; Bluetooth deferred. |
| ADR-002 | Pointer data is relative semantic delta, never absolute screen coordinates. | Accepted | Handles multiple displays and desktop layouts in the receiver. |
| ADR-003 | Sensor fusion is native; interpretation is shared/pure. | Accepted | OS APIs and quality differ, while behavior remains testable. |
| ADR-004 | Desktop injection is isolated per OS. | Accepted | Permissions and APIs fundamentally differ. |
| ADR-005 | Phase 1 is dependency-free Node workspaces. | Accepted | Current host can verify it without pretending native targets build. |
| ADR-006 | JSON is the initial versioned wire representation. | Accepted | Optimize only after latency profiling. |

### ADR-001 evidence

Android sensor: https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion

Apple Core Motion: https://developer.apple.com/documentation/coremotion/getting-processed-device-motion-data

Windows input/UIPI: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput

XDG Remote Desktop: https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.RemoteDesktop.html
