import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export class PlatformPointerController {
  constructor({ dryRun = false } = {}) { this.dryRun = dryRun; this.process = null; }
  async start() {
    if (this.dryRun || this.process) return;
    const script = fileURLToPath(new URL('./windows-pointer.ps1', import.meta.url));
    this.process = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 150);
      this.process.once('error', (error) => { clearTimeout(timer); reject(error); });
      this.process.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Windows pointer adapter exited (${code})`)); });
    });
  }
  move(deltaX, deltaY) {
    if (this.dryRun) return true;
    return Boolean(this.process?.stdin.write(`${deltaX},${deltaY}\n`));
  }
  async stop() { if (this.process) { this.process.stdin.end(); this.process.kill(); this.process = null; } }
}
