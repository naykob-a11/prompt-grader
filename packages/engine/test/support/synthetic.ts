import type { RawImage } from '../../src';

function hsv(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

const BLOCKS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [255, 255, 255],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [224, 172, 105],
  [58, 110, 40],
  [120, 170, 90],
  [90, 140, 200],
  [128, 128, 128],
  [200, 170, 60],
];

/** Deterministic test chart: grey ramp, hue wheel, flat blocks and a noisy band with edges. */
export function syntheticRamps(width = 512, height = 256): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 12345;
  const noise = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  for (let y = 0; y < height; y++) {
    const band = Math.floor((y / height) * 4);
    for (let x = 0; x < width; x++) {
      const u = x / Math.max(1, width - 1);
      const v = (y % Math.ceil(height / 4)) / Math.max(1, Math.ceil(height / 4) - 1);
      let rgb: readonly [number, number, number];
      if (band === 0) {
        const g = Math.round(u * 255);
        rgb = [g, g, g];
      } else if (band === 1) {
        const [r, g, b] = hsv(u * 360, 0.15 + v * 0.85, 0.35 + v * 0.65);
        rgb = [r * 255, g * 255, b * 255];
      } else if (band === 2) {
        rgb = BLOCKS[Math.floor(u * BLOCKS.length) % BLOCKS.length]!;
      } else {
        const base = Math.floor(x / 8) % 2 ? 170 : 70;
        rgb = [base + noise() * 40, base + noise() * 40, base + noise() * 40];
      }
      const i = (y * width + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}
