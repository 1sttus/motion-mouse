import SysTray from 'systray2';

export class TrayManager {
  constructor({ onShowQR, onResetPairing, onExit }) {
    this.onShowQR = onShowQR;
    this.onResetPairing = onResetPairing;
    this.onExit = onExit;
    this.connected = false;
    this.systray = null;
  }

  start() {
    const menu = {
      icon: '', // Empty icon as placeholder
      title: 'Motion Mouse',
      tooltip: 'Motion Mouse Agent',
      items: [
        {
          title: 'Show Pairing QR',
          tooltip: 'Show the pairing QR code',
          checked: false,
          enabled: true,
        },
        {
          title: 'Reset Pairing',
          tooltip: 'Clear all paired devices',
          checked: false,
          enabled: true,
        },
        {
          title: 'Exit',
          tooltip: 'Exit Motion Mouse',
          checked: false,
          enabled: true,
        }
      ]
    };

    this.systray = new SysTray.default({
      menu,
      debug: false,
      copyDir: true
    });

    this.systray.onClick(action => {
      switch (action.seq_id) {
        case 0:
          this.onShowQR();
          break;
        case 1:
          this.onResetPairing();
          break;
        case 2:
          this.onExit();
          break;
      }
    });
  }

  updateStatus(connected) {
    this.connected = connected;
    if (this.systray) {
      this.systray.sendAction({
        type: 'update-menu',
        menu: {
          icon: '',
          title: connected ? 'Motion Mouse (Connected)' : 'Motion Mouse',
          tooltip: connected ? 'Motion Mouse Agent (Connected)' : 'Motion Mouse Agent',
          items: [
            {
              title: 'Show Pairing QR',
              tooltip: 'Show the pairing QR code',
              checked: false,
              enabled: true,
            },
            {
              title: 'Reset Pairing',
              tooltip: 'Clear all paired devices',
              checked: false,
              enabled: true,
            },
            {
              title: 'Exit',
              tooltip: 'Exit Motion Mouse',
              checked: false,
              enabled: true,
            }
          ]
        }
      });
    }
  }

  stop() {
    if (this.systray) {
      this.systray.kill();
    }
  }
}
