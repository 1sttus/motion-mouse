import WebSocket from 'ws';
import { createAuthPacket, createPointerDeltaPacket } from '../packages/protocol/src/index.js';

const SERVER_URL = process.env.MM_SERVER_URL || 'ws://localhost:8080';
const TOKEN = process.env.MM_TOKEN || 'test-token';
const PACKET_LOSS_RATE = parseFloat(process.env.MM_LOSS_RATE || '0.1');
const JITTER_MS = parseInt(process.env.MM_JITTER || '50');

async function runStressTest() {
  console.log(`Starting Stress Test against ${SERVER_URL}`);
  console.log(`Config: Loss=${PACKET_LOSS_RATE * 100}%, Jitter=${JITTER_MS}ms`);

  const ws = new WebSocket(SERVER_URL, {
    rejectUnauthorized: false
  });

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  let seq = 1;
  ws.send(JSON.stringify(createAuthPacket(TOKEN, seq++)));

  const sessionId = await new Promise((resolve) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.kind === 'session.ack') resolve(msg.sessionId);
    });
  });

  console.log(`Authenticated. Session: ${sessionId}`);

  let sent = 0;
  let dropped = 0;

  const interval = setInterval(() => {
    if (Math.random() < PACKET_LOSS_RATE) {
      dropped++;
      return;
    }

    const packet = JSON.stringify(createPointerDeltaPacket(sessionId, seq++, 1, 1));
    const delay = Math.random() * JITTER_MS;

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(packet);
        sent++;
      }
    }, delay);

    if (sent + dropped >= 1000) {
      clearInterval(interval);
      console.log(`Test Finished. Sent: ${sent}, Dropped: ${dropped}`);
      ws.close();
      process.exit(0);
    }
  }, 16); // 60Hz
}

runStressTest().catch(console.error);
