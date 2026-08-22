import { spawn } from 'child_process';
import { PointerController } from '../pointer/pointer-controller.js';

export class WindowsPointerController extends PointerController {
  constructor() {
    super();
    this.ps = null;
    this.init();
  }

  init() {
    // Start a persistent PowerShell process
    this.ps = spawn('powershell.exe', ['-Command', '-'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    // Load necessary assembly once
    this.ps.stdin.write("[Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null\n");
  }

  move(dx, dy) {
    if (!this.ps) return;

    // Use PowerShell to get current position and set new position
    // This is relative movement logic
    const script = `
      $pos = [System.Windows.Forms.Cursor]::Position
      [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(($pos.X + ${Math.round(dx)}), ($pos.Y + ${Math.round(dy)}))
    `;
    this.ps.stdin.write(script + '\n');
  }

  stop() {
    // For motion-only, stop doesn't do much yet except maybe clear any pending buffers
    // In Phase 4, this would release all mouse buttons.
  }

  async getPosition() {
    return new Promise((resolve) => {
      this.ps.stdout.once('data', (data) => {
        const line = data.toString().trim();
        const match = line.match(/X=(\d+),Y=(\d+)/);
        if (match) {
          resolve({ x: parseInt(match[1]), y: parseInt(match[2]) });
        }
      });
      this.ps.stdin.write('[System.Windows.Forms.Cursor]::Position\n');
    });
  }

  close() {
    if (this.ps) {
      this.ps.stdin.end();
      this.ps.kill();
      this.ps = null;
    }
  }
}
