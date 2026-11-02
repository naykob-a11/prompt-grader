// Writes the app icons to apps/web/public/icons. Deterministic, so they can be regenerated.
import { resolve } from 'node:path';
import { ROOT, writePng } from '../packages/engine/test/support/images.ts';

const TEAL: readonly [number, number, number] = [31, 125, 116];
const PAPER: readonly [number, number, number] = [248, 250, 249];
const WARM: readonly [number, number, number] = [226, 168, 96];

/** A circle split into before and after, the idea of the app. */
function icon(size: number, circleRadius: number) {
  const data = new Uint8ClampedArray(size * size * 4);
  const center = size / 2;
  const radius = size * circleRadius;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inCircle = Math.hypot(x + 0.5 - center, y + 0.5 - center) < radius;
      const color = !inCircle ? TEAL : x < center ? PAPER : WARM;
      data.set([...color, 255], (y * size + x) * 4);
    }
  }
  return { data, width: size, height: size };
}

const dir = resolve(ROOT, 'apps/web/public/icons');
writePng(resolve(dir, 'icon-192.png'), icon(192, 0.34));
writePng(resolve(dir, 'icon-512.png'), icon(512, 0.34));
// Maskable icons are cropped by the system, so the circle keeps inside the safe zone.
writePng(resolve(dir, 'maskable-512.png'), icon(512, 0.26));
console.log(`wrote ${dir}`);
