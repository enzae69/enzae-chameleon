/**
 * Shared movement intent, written by both the keyboard handler and the on-screen
 * joystick, read every frame by the LocalController. Kept outside React so input
 * never causes re-renders.
 */
export const inputState = {
  kbX: 0,
  kbZ: 0,
  joyX: 0,
  joyZ: 0,
};

function clamp1(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

/** Combined, clamped movement intent on the world X/Z axes. */
export function getMoveIntent(): { x: number; z: number } {
  return {
    x: clamp1(inputState.kbX + inputState.joyX),
    z: clamp1(inputState.kbZ + inputState.joyZ),
  };
}

const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

const pressed = new Set<string>();

function recompute() {
  let x = 0;
  let z = 0;
  if (pressed.has("KeyW") || pressed.has("ArrowUp")) z -= 1;
  if (pressed.has("KeyS") || pressed.has("ArrowDown")) z += 1;
  if (pressed.has("KeyA") || pressed.has("ArrowLeft")) x -= 1;
  if (pressed.has("KeyD") || pressed.has("ArrowRight")) x += 1;
  inputState.kbX = x;
  inputState.kbZ = z;
}

/** Attach global keyboard listeners; returns a cleanup function. */
export function attachKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if (!MOVE_KEYS.has(e.code)) return;
    pressed.add(e.code);
    recompute();
  };
  const up = (e: KeyboardEvent) => {
    pressed.delete(e.code);
    recompute();
  };
  const blur = () => {
    pressed.clear();
    recompute();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    pressed.clear();
    recompute();
  };
}
