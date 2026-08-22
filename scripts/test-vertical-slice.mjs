import { spawn } from 'child_process';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_PATH = path.join(__dirname, '../apps/desktop-agent/index.js');

async function runTest() {
  console.log('Starting Desktop Agent for verification...');
  const agent = spawn('node', [AGENT_PATH], { stdio: ['pipe', 'pipe', 'inherit'] });

  let token = null;
  let ip = null;

  const agentStarted = new Promise((resolve) => {
    agent.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Agent Out] ${output}`);
      const tokenMatch = output.match(/Token: (\w+)/);
      const ipMatch = output.match(/IP:\s+([\d.]+)/);
      if (tokenMatch) token = tokenMatch[1];
      if (ipMatch) ip = ipMatch[1];
      if (token && ip) resolve();
    });
  });

  await agentStarted;
  console.log(`Discovered Agent at ${ip} with Token ${token}`);

  // Simulate Client
  const ws = new WebSocket(`wss://localhost:8080`, {
    rejectUnauthorized: false
  });

  const connected = new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  await connected;
  console.log('Client connected to WSS');

  // Perform Auth
  ws.send(JSON.stringify({
    v: 1,
    kind: 'session.auth',
    seq: 1,
    sentAtMs: Date.now(),
    payload: { token }
  }));

  const authenticated = new Promise((resolve) => {
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.kind === 'session.ack') {
        console.log('Client authenticated successfully');
        resolve(msg.sessionId);
      }
    });
  });

  const sessionId = await authenticated;

  // Send Motion Data
  console.log('Sending 100 motion packets...');
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    ws.send(JSON.stringify({
      v: 1,
      kind: 'pointer.delta',
      sessionId,
      seq: i + 2,
      sentAtMs: Date.now(),
      payload: { dx: 1, dy: 1 }
    }));
    await new Promise(r => setTimeout(r, 16)); // ~60Hz
  }

  const end = Date.now();
  console.log(`Finished sending 100 packets in ${end - start}ms`);
  console.log(`Average packet interval: ${(end - start) / 100}ms`);

  ws.close();
  agent.kill();
  console.log('Verification complete.');
}

runTest().catch(console.error);
