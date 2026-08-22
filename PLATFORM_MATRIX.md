# Platform Matrix

| Platform | Sensor / receiver capability | Pointer route | Status / constraint |
| --- | --- | --- | --- |
| Android | rotation-vector sensor may be absent; runtime probe | mobile sender only | native Kotlin module required |
| iOS | Core Motion device-motion availability is runtime dependent | mobile sender only | native Swift module; foreground MVP |
| Windows | desktop receiver | Win32 `SendInput` | cannot inject into higher-integrity apps without matching elevation |
| macOS | desktop receiver | Quartz `CGEvent` | requires user-granted accessibility permission; validate distribution/notarization |
| Linux/X11 | desktop receiver | XTest-style adapter, distribution-dependent | separate native adapter |
| Linux/Wayland | desktop receiver | Remote Desktop portal/EIS | explicit user consent and compositor/portal support required |
| Bluetooth | optional transport experiment | n/a | BLE data path only; no MVP commitment; HID feasibility needs per-platform validation |

Evidence: Android documents `TYPE_ROTATION_VECTOR`; Apple Core Motion exposes fused `CMDeviceMotion` but says availability must be checked; Windows `SendInput` is subject to UIPI; the XDG Remote Desktop portal requires a user-approved session and supports EIS. Source links are retained in DECISIONS.md.

### Phase 3 implementation status

| Slice | Implemented route | Validation status |
| --- | --- | --- |
| Android | Chrome browser, `deviceorientation`, HTTPS/WSS sender | source and protocol smoke-tested; requires real-phone permission/certificate acceptance |
| Windows | Node receiver → pointer abstraction → persistent PowerShell Win32 `GetCursorPos`/`SetCursorPos` adapter | dry-run server and WSS handshake tested; real-cursor test intentionally awaits user hardware run |
