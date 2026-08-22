import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENT_PATH = path.join(__dirname, '../apps/desktop-agent/index.js');
const BENCHMARK_PATH = path.join(__dirname, 'latency-benchmark.mjs');
const STRESS_PATH = path.join(__dirname, 'stress-test-client.mjs');

const TOKEN = process.env.MM_TOKEN || 'stress-test-token';

async function runAll() {
  console.log('Starting Desktop Agent for Stress Testing...');
  const agent = spawn('node', [AGENT_PATH], {
    env: { ...process.env, MM_NO_TLS: 'true', MM_TOKEN: TOKEN }
  });

  const agentStarted = new Promise((resolve) => {
    agent.stdout.on('data', (data) => {
      const out = data.toString();
      process.stdout.write(out);
      if (out.includes('listening on port')) resolve();
    });
  });

  await agentStarted;
  console.log(`\nUsing Token: ${TOKEN}`);

  console.log('\n--- PHASE 1: Latency Benchmark ---');
  await runScript('node', [BENCHMARK_PATH], { MM_NO_TLS: 'true', MM_TOKEN: TOKEN });

  console.log('\n--- PHASE 2: Fault Injection (10% Loss, 50ms Jitter) ---');
  await runScript('node', [STRESS_PATH], {
    MM_NO_TLS: 'true',
    MM_TOKEN: TOKEN,
    MM_LOSS_RATE: '0.1',
    MM_JITTER: '50'
  });

  agent.kill();
  console.log('\nStress Tests Complete.');
  process.exit(0);
}

function runScript(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: 'inherit' });
    child.on('exit', resolve);
  });
}

runAll().catch(err => {
  console.error(err);
  process.exit(1);
});
