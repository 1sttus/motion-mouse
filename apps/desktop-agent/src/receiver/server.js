import { createServer } from 'node:https';
import { WebSocketServer } from 'ws';
import selfsigned from 'selfsigned';
import { validateSessionEvent } from '@motion-mouse/protocol';
import { QRProvider } from './qr-provider.js';
import { WindowsPointerController } from '../adapters/windows-pointer-controller.js';
import { PairingStore } from './pairing-store.js';
import { TrayManager } from './tray-manager.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAIRING_STORE_PATH = path.join(__dirname, 'pairing-store.json');

const PORT = 8080;
const HEARTBEAT_INTERVAL = 3000;
const HEARTBEAT_TIMEOUT = 10000;

class MotionSession {
  constructor(ws, sessionId, controller, onClose) {
    this.ws = ws;
    this.sessionId = sessionId;
    this.controller = controller;
    this.onClose = onClose;
    this.lastHeartbeat = Date.now();
    this.seq = 0;
    this.active = false;
    this.stats = {
      packets: 0,
      drops: 0,
      lastSeq: -1,
      maxJitter: 0,
      lastPacketTime: 0
    };

    this.ws.on('message', (data) => this.handleMessage(data));
    this.ws.on('close', () => {
      this.cleanup();
      if (this.onClose) this.onClose();
    });
  }

  handleMessage(data) {
    try {
      const event = JSON.parse(data.toString());
      const validation = validateSessionEvent(event);

      if (!validation.ok) {
        console.warn(`[Session ${this.sessionId}] Validation failed: ${validation.reason}`);
        return;
      }

      if (event.kind === 'session.auth') {
        // Auth is handled by the server before promoting to active session
        return;
      }

      if (event.sessionId !== this.sessionId && this.active) {
        console.warn(`[Session ${this.sessionId}] Session ID mismatch`);
        return;
      }

      this.lastHeartbeat = Date.now();

      // Update stats
      this.stats.packets++;
      if (this.stats.lastSeq !== -1 && event.seq > this.stats.lastSeq + 1) {
        this.stats.drops += (event.seq - this.stats.lastSeq - 1);
      }
      this.stats.lastSeq = event.seq;

      const now = Date.now();
      if (this.stats.lastPacketTime !== 0) {
        const interval = now - this.stats.lastPacketTime;
        const jitter = Math.abs(interval - 16); // 16ms is ideal for 60Hz
        this.stats.maxJitter = Math.max(this.stats.maxJitter, jitter);
      }
      this.stats.lastPacketTime = now;

      switch (event.kind) {
        case 'session.heartbeat':
          this.ws.send(JSON.stringify({
            v: 1,
            kind: 'session.ack',
            sessionId: this.sessionId,
            seq: this.seq++,
            sentAtMs: Date.now(),
            payload: {}
          }));
          break;
        case 'pointer.delta':
          if (this.active) {
            this.controller.move(event.payload.dx, event.payload.dy);
          }
          break;
        case 'button':
          if (this.active) {
            const { button, action } = event.payload;
            if (action === 'down') this.controller.buttonDown(button);
            else this.controller.buttonUp(button);
          }
          break;
        case 'scroll':
          if (this.active) {
            this.controller.scroll(event.payload.dx, event.payload.dy);
          }
          break;
        case 'calibrate':
          console.log(`[Session ${this.sessionId}] Calibration requested`);
          break;
        case 'session.close':
          this.cleanup();
          break;
      }
    } catch (err) {
      console.error(`[Session ${this.sessionId}] Error handling message:`, err);
    }
  }

  promote() {
    this.active = true;
    this.ws.send(JSON.stringify({
      v: 1,
      kind: 'session.ack',
      sessionId: this.sessionId,
      seq: 0,
      sentAtMs: Date.now(),
      payload: {}
    }));
    console.log(`[Session ${this.sessionId}] Authenticated and Active`);
  }

  cleanup() {
    if (this.active) {
      console.log(`[Session ${this.sessionId}] Closing session. Stats:`, {
        totalPackets: this.stats.packets,
        estimatedDrops: this.stats.drops,
        maxJitterMs: this.stats.maxJitter.toFixed(2)
      });
      this.active = false;
      this.controller.stop();
    }
    this.ws.terminate();
  }

  isAlive() {
    return Date.now() - this.lastHeartbeat < HEARTBEAT_TIMEOUT;
  }
}

export function startServer() {
  const useTLS = process.env.MM_NO_TLS !== 'true';
  let server;
  let wss;

  if (useTLS) {
    const attrs = [{ name: 'commonName', value: 'MotionMouseDev' }];
    const pems = selfsigned.generate(attrs, { days: 30 });
    server = createServer({
      key: pems.private,
      cert: pems.cert
    });
    wss = new WebSocketServer({ server });
  } else {
    wss = new WebSocketServer({ port: PORT });
    console.log(`[Server] Plain WS listening on port ${PORT}`);
  }

  const qrProvider = new QRProvider();
  const controller = new WindowsPointerController();
  const pairingStore = new PairingStore(PAIRING_STORE_PATH);

  let pairingInfo = qrProvider.generatePairingInfo(PORT);
  if (process.env.MM_TOKEN) {
    pairingInfo.token = process.env.MM_TOKEN;
    console.log(`[Server] Overriding pairing token with: ${pairingInfo.token}`);
  }
  const sessions = new Map();

  const updateTray = () => trayManager.updateStatus(sessions.size > 0);

  const trayManager = new TrayManager({
    onShowQR: () => {
      pairingInfo = qrProvider.generatePairingInfo(PORT);
    },
    onResetPairing: () => {
      pairingStore.clear();
      console.log('[Server] Pairing store cleared');
    },
    onExit: () => {
      console.log('[Server] Exiting...');
      process.exit(0);
    }
  });
  trayManager.start();

  wss.on('connection', (ws) => {
    const sessionId = Math.random().toString(36).substring(2, 10);
    const session = new MotionSession(ws, sessionId, controller, () => {
      sessions.delete(sessionId);
      updateTray();
    });

    ws.once('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        if (event.kind === 'session.auth') {
          const token = event.payload.token;
          const isCurrentToken = token === pairingInfo.token;
          const isStoredToken = pairingStore.isValid(token);

          if (isCurrentToken || isStoredToken) {
            if (isCurrentToken) {
              pairingStore.addToken(token);
            }
            session.promote();
            sessions.set(sessionId, session);
            updateTray();
          } else {
            console.warn(`[Server] Auth failed for session ${sessionId}`);
            ws.terminate();
          }
        } else {
          console.warn(`[Server] Expected session.auth, got ${event.kind}`);
          ws.terminate();
        }
      } catch (err) {
        console.error(`[Server] Error during auth for session ${sessionId}:`, err);
        ws.terminate();
      }
    });
  });

  const heartbeatInterval = setInterval(() => {
    let changed = false;
    for (const [id, session] of sessions) {
      if (!session.isAlive()) {
        console.warn(`[Session ${id}] Heartbeat timeout`);
        session.cleanup();
        sessions.delete(id);
        changed = true;
      }
    }
    if (changed) updateTray();
  }, HEARTBEAT_INTERVAL);

  if (useTLS) {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] WSS listening on port ${PORT}`);
    });
  }

  return {
    stop: () => {
      clearInterval(heartbeatInterval);
      if (useTLS) server.close();
      else wss.close();
      controller.close();
      trayManager.stop();
    },
    regenerateToken: () => {
      pairingInfo = qrProvider.generatePairingInfo(PORT);
    }
  };
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
