import WebSocket from 'ws';
import { createAuthPacket, createHeartbeatPacket } from '../packages/protocol/src/index.js';

const SERVER_URL = process.env.MM_SERVER_URL || 'ws://localhost:8080';
const TOKEN = process.env.MM_TOKEN || 'test-token';

async function runBenchmark() {
  const ws = new WebSocket(SERVER_URL, { rejectUnauthorized: false });
  await new Promise(r => ws.on('open', r));

  let seq = 1;
  ws.send(JSON.stringify(createAuthPacket(TOKEN, seq++)));

  const sessionId = await new Promise(resolve => {
    const handler = (data) => {
      const m = JSON.parse(data.toString());
      if (m.kind === 'session.ack') {
        ws.off('message', handler);
        resolve(m.sessionId);
      }
    };
    ws.on('message', handler);
  });

  console.log(`Starting Latency Benchmark for session ${sessionId} (100 samples)...`);
  const latencies = [];

  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    ws.send(JSON.stringify(createHeartbeatPacket(sessionId, seq++)));

    await new Promise(r => ws.once('message', () => {
      latencies.push(performance.now() - start);
      r();
    }));
    await new Promise(r => setTimeout(r, 20));
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log(`\nResults (ms):`);
  console.log(`Min: ${latencies[0].toFixed(2)}`);
  console.log(`P50: ${p50.toFixed(2)}`);
  console.log(`P95: ${p95.toFixed(2)}`);
  console.log(`P99: ${p99.toFixed(2)}`);
  console.log(`Max: ${latencies[latencies.length - 1].toFixed(2)}`);

  ws.close();
}

runBenchmark().catch(console.error);
