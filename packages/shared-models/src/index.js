export const POINTER_BUTTONS = Object.freeze(['left', 'middle', 'right']);
export const BUTTON_ACTIONS = Object.freeze(['down', 'up']);

export function isPointerButton(value) {
  return POINTER_BUTTONS.includes(value);
}
