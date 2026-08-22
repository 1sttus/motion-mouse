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
   * Presses a mouse button.
   * @param {'left'|'right'|'middle'} button
   */
  buttonDown(button) {
    throw new Error('PointerController#buttonDown must be implemented');
  }

  /**
   * Releases a mouse button.
   * @param {'left'|'right'|'middle'} button
   */
  buttonUp(button) {
    throw new Error('PointerController#buttonUp must be implemented');
  }

  /**
   * Scrolls by the given deltas.
   * @param {number} dx - Horizontal scroll delta.
   * @param {number} dy - Vertical scroll delta.
   */
  scroll(dx, dy) {
    throw new Error('PointerController#scroll must be implemented');
  }

  /**
   * Resets the controller state (e.g., releases all buttons, stops movement).
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
