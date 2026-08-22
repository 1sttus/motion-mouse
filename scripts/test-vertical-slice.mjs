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

  // Send Motion Data
  console.log('Sending 20 motion packets...');
  const start = Date.now();
  for (let i = 0; i < 20; i++) {
    ws.send(JSON.stringify({
      v: 1,
      kind: 'pointer.delta',
      sessionId,
      seq: i + 2,
      sentAtMs: Date.now(),
      payload: { dx: 5, dy: 5 }
    }));
    await new Promise(r => setTimeout(r, 16));
  }

  const end = Date.now();
  console.log(`Finished sending 20 packets in ${end - start}ms`);

  ws.close();
  agent.kill();
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
