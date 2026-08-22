import { networkInterfaces } from 'os';
import qrcode from 'qrcode-terminal';

/**
 * Generates and displays a pairing QR code (or token) in the console.
 */
export class QRProvider {
  /**
   * Generates a pairing secret and prints the connection info.
   * @param {number} port - The WebSocket server port.
   * @returns {{token: string, ip: string}}
   */
  generatePairingInfo(port) {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const ip = this.getLocalIP();

    const pairingUrl = `motionmouse://connect?ip=${ip}&port=${port}&token=${token}`;

    console.log('\n┌──────────────────────────────────────────────┐');
    console.log('│             MOTION MOUSE PAIRING             │');
    console.log('└──────────────────────────────────────────────┘\n');

    qrcode.generate(pairingUrl, { small: true });

    console.log('\n┌──────────────────────────────────────────────┐');
    console.log(`│ IP:    ${ip.padEnd(37)} │`);
    console.log(`│ Port:  ${port.toString().padEnd(37)} │`);
    console.log(`│ Token: ${token.padEnd(37)} │`);
    console.log('├──────────────────────────────────────────────┤');
    console.log('│ Scan the QR code in the Mobile App to connect│');
    console.log('└──────────────────────────────────────────────┘\n');

    return { token, ip };
  }

  getLocalIP() {
    const interfaces = networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return '127.0.0.1';
  }
}
