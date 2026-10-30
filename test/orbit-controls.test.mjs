import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOrbitDrag } from '../browser/orbit-controls.js';

test('preview drag maps to the requested camera orbit directions', () => {
  const right = applyOrbitDrag(0, 0, 1, 40, 0);
  assert.equal(right.turn, -16, 'dragging right orbits opposite the positive-Y model rotation');
  assert.equal(right.tilt, 0);

  const up = applyOrbitDrag(0, 0, 1, 0, -30);
  assert.equal(up.tilt, -12, 'dragging up orbits opposite the clockwise positive-X model rotation');
  const down = applyOrbitDrag(0, 0, 1, 0, 30);
  assert.equal(down.tilt, 12, 'dragging down orbits opposite the counterclockwise positive-X model rotation');

  const primary = applyOrbitDrag(0, 0, 0, 40, 30);
  assert.equal(primary.turn, -16, 'primary drag retains horizontal rotation');
  assert.equal(primary.tilt, 0, 'vertical orbit is reserved for middle-button drag');

  assert.equal(applyOrbitDrag(0, 0, 1, 0, 10000).tilt, 80 - Math.atan(.18) * 180 / Math.PI);
});
