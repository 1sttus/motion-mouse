export class PointerController {
  constructor(adapter) {
    if (!adapter || typeof adapter.move !== 'function') throw new TypeError('a platform pointer adapter is required');
    this.adapter = adapter;
    this.active = false;
  }

  async start() { await this.adapter.start?.(); this.active = true; }
  async stop() { this.active = false; await this.adapter.stop?.(); }
  async move(deltaX, deltaY) {
    if (!this.active || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return false;
    return this.adapter.move(deltaX, deltaY);
  }
}
