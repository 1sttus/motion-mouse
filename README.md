# Motion Mouse

Control your computer cursor with your smartphone's motion sensors. Secure, low-latency, and local-first.

## 🚀 Quick Start

### 1. Install Desktop Agent (Windows)
- Download the latest `motion-mouse-agent.exe` from the Releases page.
- Run the executable. A system tray icon will appear.
- Right-click the tray icon and select **Show Pairing QR**.

### 2. Install Mobile App (Android)
- Download and install the `motion-mouse.apk` or `.aab`.
- Complete the onboarding flow to grant Camera permissions.
- Tap **Pair New Device** and scan the QR code displayed on your computer.
- Once connected, tap **Start Control**.

## 🛡️ Security & Privacy
- **Local Only**: Data never leaves your local network. No cloud relay.
- **Encrypted**: Transport is secured via TLS (WSS).
- **Authenticated**: Pairing is protected by a one-time secret token exchanged via QR code.

## 🛠️ Development

### Repository Structure
- `apps/mobile-android`: Native Kotlin Android application.
- `apps/desktop-agent`: Node.js receiver with system tray integration.
- `packages/protocol`: Shared wire protocol definitions.
- `packages/motion-core`: Shared motion processing logic.

### Building from Source

#### Desktop Agent
```bash
cd apps/desktop-agent
npm install
npm run build:win
```

#### Android App
```bash
cd apps/mobile-android
./gradlew bundleRelease
```

## 📄 License
MIT
