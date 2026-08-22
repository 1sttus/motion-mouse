/**
 * Abstract base class for desktop pointer control.
 * Platform-specific implementations (Windows, macOS, Linux) should extend this.
 */
export class PointerController {
  /**
   * Moves the cursor by the given relative deltas.
   * @param {number} dx - Relative horizontal movement.
   * @param {number} dy - Relative vertical movement.
   */
  move(dx, dy) {
    throw new Error('PointerController#move must be implemented');
  }

  /**
   * Resets the controller state (e.g., releases buttons, stops movement).
   */
  stop() {
    throw new Error('PointerController#stop must be implemented');
  }

  /**
   * Returns information about the current pointer position.
   * Useful for internal tracking if needed.
   * @returns {Promise<{x: number, y: number}>}
   */
  async getPosition() {
    throw new Error('PointerController#getPosition must be implemented');
  }
}
