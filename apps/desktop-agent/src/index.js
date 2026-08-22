import { networkInterfaces } from 'node:os';
import { PointerController } from './pointer/PointerController.js';
import { PlatformPointerController } from './adapters/windows/PlatformPointerController.js';
import { createMotionServer } from './receiver/createServer.js';

const port = Number(process.env.MOTION_MOUSE_PORT ?? 8443);
const pointer = new PointerController(new PlatformPointerController({ dryRun: process.env.MOTION_MOUSE_DRY_RUN === '1' }));
await pointer.start();
const agent = await createMotionServer({ pointer });
await new Promise((resolve) => agent.server.listen(port, '0.0.0.0', resolve));
const addresses = Object.values(networkInterfaces()).flat().filter((entry) => entry?.family === 'IPv4' && !entry.internal).map((entry) => entry.address);
console.log(`Motion Mouse Windows receiver listening on port ${port}`);
console.log(`Open https://${addresses[0] ?? 'localhost'}:${port}/?token=${agent.pairingToken} on Android Chrome.`);
console.log('Development certificate: inspect and accept only on your private LAN. Press Ctrl+C to stop.');
process.on('SIGINT', async () => { await agent.close(); await pointer.stop(); process.exit(0); });
