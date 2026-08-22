import { spawn } from 'child_process';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_PATH = path.join(__dirname, '../apps/desktop-agent/index.js');

async function runTest() {
  console.log('Starting Desktop Agent for verification (NO TLS)...');
  const agent = spawn('node', [AGENT_PATH], {
    env: { ...process.env, MM_NO_TLS: 'true' }
  });

  let token = null;
  let ip = null;

  const agentStarted = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Agent start timeout')), 5000);
    agent.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      const tokenMatch = output.match(/Token: (\w+)/);
      const ipMatch = output.match(/IP:\s+([\d.]+)/);
      if (tokenMatch) token = tokenMatch[1];
      if (ipMatch) ip = ipMatch[1];
      if (token && ip) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  await agentStarted;
  console.log(`\nDiscovered Agent at ${ip} with Token ${token}`);

  // Simulate Client
  const ws = new WebSocket(`ws://localhost:8080`);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  console.log('Client connected to WS');

  // Perform Auth
  ws.send(JSON.stringify({
    v: 1,
    kind: 'session.auth',
    seq: 1,
    sentAtMs: Date.now(),
    payload: { token }
  }));

  const sessionId = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Auth timeout')), 5000);
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.kind === 'session.ack') {
        clearTimeout(timeout);
        resolve(msg.sessionId);
      }
    });
  });
  console.log(`Client authenticated successfully: ${sessionId}`);

  // Test Interactions
  console.log('Testing Left Click Down...');
  ws.send(JSON.stringify({
    v: 1,
    kind: 'button',
    sessionId,
    seq: 2,
    sentAtMs: Date.now(),
    payload: { button: 'left', action: 'down' }
  }));
  await new Promise(r => setTimeout(r, 100));

  console.log('Testing Left Click Up...');
  ws.send(JSON.stringify({
    v: 1,
    kind: 'button',
    sessionId,
    seq: 3,
    sentAtMs: Date.now(),
    payload: { button: 'left', action: 'up' }
  }));
  await new Promise(r => setTimeout(r, 100));

  console.log('Testing Scrolling...');
  ws.send(JSON.stringify({
    v: 1,
    kind: 'scroll',
    sessionId,
    seq: 4,
    sentAtMs: Date.now(),
    payload: { dx: 0, dy: 120 }
  }));
  await new Promise(r => setTimeout(r, 100));

  // Test Safety: Disconnect while button is down
  console.log('Testing Safety (Disconnect while Right Click Down)...');
  ws.send(JSON.stringify({
    v: 1,
    kind: 'button',
    sessionId,
    seq: 5,
    sentAtMs: Date.now(),
    payload: { button: 'right', action: 'down' }
  }));
  await new Promise(r => setTimeout(r, 50));

  console.log('Disconnecting client...');
  ws.terminate();

  await new Promise(r => setTimeout(r, 500));
  agent.kill();
  console.log('Verification complete.');
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
