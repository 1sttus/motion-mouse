import { createServer as createHttpsServer } from 'node:https';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import selfsigned from 'selfsigned';
import { WebSocketServer } from 'ws';
import { MotionSession } from './MotionSession.js';

const root = new URL('../../../../', import.meta.url);

async function certificate() {
  const directory = new URL('../../../../.motion-mouse-dev/', import.meta.url);
  const key = new URL('key.pem', directory); const cert = new URL('cert.pem', directory);
  try { return { key: await readFile(key), cert: await readFile(cert) }; } catch {
    await mkdir(directory, { recursive: true });
    const pems = await selfsigned.generate([{ name: 'commonName', value: 'motion-mouse.local' }], { algorithm: 'sha256', keySize: 2048, days: 7 });
    await Promise.all([writeFile(key, pems.private), writeFile(cert, pems.cert)]);
    return { key: pems.private, cert: pems.cert };
  }
}

export async function createMotionServer({ pointer, pairingToken = randomBytes(24).toString('base64url'), timeoutMs = 3_000, staticRoot = new URL('../../../mobile/web/', import.meta.url) }) {
  const tls = await certificate(); const startedAt = Date.now(); const cpuStart = process.cpuUsage();
  const server = createHttpsServer(tls, async (request, response) => {
    if (request.url === '/metrics') { response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(metrics())); return; }
    const path = request.url === '/' ? 'index.html' : request.url === '/app.js' ? 'app.js' : request.url === '/shared/motion-core.js' ? '../../../../packages/motion-core/src/index.js' : null;
    if (!path) { response.writeHead(404); response.end(); return; }
    try { const file = path.startsWith('../') ? new URL(path, root) : new URL(path, staticRoot); response.writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : 'text/html', 'cache-control': 'no-store' }); response.end(await readFile(file)); } catch { response.writeHead(500); response.end('asset unavailable'); }
  });
  const webSocket = new WebSocketServer({ server, path: '/ws', maxPayload: 2_048 }); const sessions = new Map();
  webSocket.on('connection', (socket) => {
    const session = new MotionSession({ pairingToken, pointer, timeoutMs }); sessions.set(session, socket);
    socket.on('message', (raw) => { let event; try { event = JSON.parse(raw.toString()); } catch { session.reject('malformed'); return; } const result = session.handle(event); if (result.reply) socket.send(JSON.stringify(result.reply)); if (!result.ok && result.reason === 'unauthorized') socket.close(1008, 'unauthorized'); });
    socket.on('close', () => { session.close(); sessions.delete(session); }); socket.on('error', () => socket.close());
  });
  const watchdog = setInterval(() => { for (const [session, socket] of sessions) if (session.expired()) { session.close(); socket.close(4000, 'heartbeat timeout'); } }, 250);
  const metrics = () => { const values = [...sessions.keys()].map((session) => session.snapshot()); const cpu = process.cpuUsage(cpuStart); const elapsed = Math.max(Date.now() - startedAt, 1); return { uptimeMs: elapsed, sessions: values, packetRateHz: values.reduce((sum, value) => sum + value.accepted, 0) / (elapsed / 1_000), cpuMs: (cpu.user + cpu.system) / 1_000 }; };
  return { pairingToken, server, metrics, close: async () => { clearInterval(watchdog); for (const client of webSocket.clients) client.close(); await new Promise((resolve) => server.close(resolve)); } };
}
