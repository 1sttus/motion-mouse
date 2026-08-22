import { networkInterfaces } from 'os';

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

    console.log('\n┌──────────────────────────────────────────────┐');
    console.log('│             MOTION MOUSE PAIRING             │');
    console.log('├──────────────────────────────────────────────┤');
    console.log(`│ IP:    ${ip.padEnd(37)} │`);
    console.log(`│ Port:  ${port.toString().padEnd(37)} │`);
    console.log(`│ Token: ${token.padEnd(37)} │`);
    console.log('├──────────────────────────────────────────────┤');
    console.log('│ Scan the QR code in the Mobile App to connect│');
    console.log('└──────────────────────────────────────────────┘\n');

    // In a real implementation, we would print an actual QR code using qrcode-terminal
    // For now, the user can manually enter the IP and Token if needed, or we assume
    // the mobile app will eventually have a scanner that reads this format.

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
