export const BASE_ELEVATION = Math.atan(.18) * 180 / Math.PI;
const MIN_TILT = -80 - BASE_ELEVATION;
const MAX_TILT = 80 - BASE_ELEVATION;

// Camera orbit is opposite to the equivalent model rotation. Horizontal drag
// orbits around Y; middle-button vertical drag adds orbit around X.
export function applyOrbitDrag(turn, tilt, button, dx, dy) {
  return {
    turn: turn - dx * .4,
    tilt: button === 1
      ? Math.max(MIN_TILT, Math.min(MAX_TILT, tilt + dy * .4))
      : tilt,
  };
}
