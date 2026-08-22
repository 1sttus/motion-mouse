import { createServer } from 'https';
import { WebSocketServer } from 'ws';
import selfsigned from 'selfsigned';
import { validateSessionEvent } from '@motion-mouse/protocol';
import { QRProvider } from './qr-provider.js';
import { WindowsPointerController } from '../adapters/windows-pointer-controller.js';

const PORT = 8080;
const HEARTBEAT_INTERVAL = 3000;
const HEARTBEAT_TIMEOUT = 10000;

class MotionSession {
  constructor(ws, sessionId, controller) {
    this.ws = ws;
    this.sessionId = sessionId;
    this.controller = controller;
    this.lastHeartbeat = Date.now();
    this.seq = 0;
    this.active = false;

    this.ws.on('message', (data) => this.handleMessage(data));
    this.ws.on('close', () => this.cleanup());
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

      switch (event.kind) {
        case 'session.heartbeat':
          // Just update lastHeartbeat
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
          // Phase 3: Recenter is handled on mobile, but we can acknowledge it
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
    console.log(`[Session ${this.sessionId}] Closing session`);
    this.active = false;
    this.controller.stop();
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

  let pairingInfo = qrProvider.generatePairingInfo(PORT);
  const sessions = new Map();

  wss.on('connection', (ws) => {
    const sessionId = Math.random().toString(36).substring(2, 10);
    const session = new MotionSession(ws, sessionId, controller);

    ws.once('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        if (event.kind === 'session.auth' && event.payload.token === pairingInfo.token) {
          session.promote();
          sessions.set(sessionId, session);
        } else {
          console.warn(`[Server] Auth failed for session ${sessionId}`);
          ws.terminate();
        }
      } catch (err) {
        ws.terminate();
      }
    });
  });

  setInterval(() => {
    for (const [id, session] of sessions) {
      if (!session.isAlive()) {
        console.warn(`[Session ${id}] Heartbeat timeout`);
        session.cleanup();
        sessions.delete(id);
      }
    }
  }, HEARTBEAT_INTERVAL);

  if (useTLS) {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] WSS listening on port ${PORT}`);
    });
  }

  return {
    stop: () => {
      if (useTLS) server.close();
      else wss.close();
      controller.close();
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
