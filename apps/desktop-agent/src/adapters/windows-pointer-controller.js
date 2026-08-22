import { spawn } from 'child_process';
import { PointerController } from '../pointer/pointer-controller.js';

export class WindowsPointerController extends PointerController {
  constructor() {
    super();
    this.ps = null;
    this.buttonsDown = new Set();
    this.init();
  }

  init() {
    // Start a persistent PowerShell process
    this.ps = spawn('powershell.exe', ['-Command', '-'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    // Define mouse_event via P/Invoke
    const initScript = `
      [Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null
      $signature = @'
      [DllImport("user32.dll")]
      public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, uint dwExtraInfo);
'@
      $type = Add-Type -MemberDefinition $signature -Name "Win32Mouse" -Namespace "Win32Functions" -PassThru
    `;
    this.ps.stdin.write(initScript + '\n');
  }

  move(dx, dy) {
    if (!this.ps) return;
    const script = `
      $pos = [System.Windows.Forms.Cursor]::Position
      [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(($pos.X + ${Math.round(dx)}), ($pos.Y + ${Math.round(dy)}))
    `;
    this.ps.stdin.write(script + '\n');
  }

  buttonDown(button) {
    if (!this.ps) return;
    const flag = this.getButtonFlag(button, 'down');
    if (flag) {
      this.buttonsDown.add(button);
      this.ps.stdin.write(`[Win32Functions.Win32Mouse]::mouse_event(${flag}, 0, 0, 0, 0)\n`);
    }
  }

  buttonUp(button) {
    if (!this.ps) return;
    const flag = this.getButtonFlag(button, 'up');
    if (flag) {
      this.buttonsDown.delete(button);
      this.ps.stdin.write(`[Win32Functions.Win32Mouse]::mouse_event(${flag}, 0, 0, 0, 0)\n`);
    }
  }

  scroll(dx, dy) {
    if (!this.ps) return;
    // MOUSEEVENTF_WHEEL = 0x0800, MOUSEEVENTF_HWHEEL = 0x1000
    // dy is vertical scroll, dx is horizontal scroll.
    // Wheel delta is usually 120 per notch.
    if (dy !== 0) {
      this.ps.stdin.write(`[Win32Functions.Win32Mouse]::mouse_event(0x0800, 0, 0, ${Math.round(dy)}, 0)\n`);
    }
    if (dx !== 0) {
      this.ps.stdin.write(`[Win32Functions.Win32Mouse]::mouse_event(0x1000, 0, 0, ${Math.round(dx)}, 0)\n`);
    }
  }

  stop() {
    if (!this.ps) return;
    // Release all buttons
    for (const button of this.buttonsDown) {
      this.buttonUp(button);
    }
    this.buttonsDown.clear();
  }

  getButtonFlag(button, action) {
    const flags = {
      left: { down: '0x0002', up: '0x0004' },
      right: { down: '0x0008', up: '0x0010' },
      middle: { down: '0x0020', up: '0x0040' }
    };
    return flags[button]?.[action] || null;
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
      this.stop();
      this.ps.stdin.end();
      this.ps.kill();
      this.ps = null;
    }
  }
}
