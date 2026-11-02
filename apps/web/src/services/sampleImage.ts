import type { RawImage } from '@prompt-grader/engine';

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Sum of sines: cheap, deterministic rolling terrain. */
const ridge = (x: number, seed: number) =>
  Math.sin(x * 3.1 + seed) * 0.5 +
  Math.sin(x * 7.3 + seed * 2) * 0.3 +
  Math.sin(x * 17 + seed) * 0.2;

/** A painted landscape of sky, mountains and fields, so the app has a picture on first open. */
export function makeSampleImage(width = 960, height = 640): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 4242;
  for (let py = 0; py < height; py++) {
    const y = py / height;
    for (let px = 0; px < width; px++) {
      const x = px / width;
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      const speckle = seed / 4294967296 - 0.5;
      const rows = Math.sin(y * 240 * y + ridge(x, 0.7) * 2);
      const texture = speckle * 0.9 + rows * 0.45 * smooth(0.6, 0.95, y);

      const haze = smooth(0.1, 0.5, y);
      let r = mix(92, 226, haze);
      let g = mix(146, 214, haze);
      let b = mix(204, 196, haze);

      const far = 0.34 + ridge(x, 1.2) * 0.05;
      if (y > far) {
        r = 112;
        g = 134;
        b = 150;
      }
      const near = 0.46 + ridge(x, 3.7) * 0.05;
      if (y > near) {
        r = 62;
        g = 104;
        b = 88;
      }
      const field = 0.58 + ridge(x, 5.1) * 0.025;
      if (y > field) {
        const depth = smooth(field, 1, y);
        const sun = smooth(-0.3, 0.8, ridge(x * 0.6, 2.4) + (0.5 - y));
        r = mix(70, 116, sun) + depth * 16;
        g = mix(122, 168, sun) - depth * 18;
        b = mix(56, 62, sun) - depth * 8;
        r += texture * 9;
        g += texture * 12;
        b += texture * 6;
      }

      const i = (py * width + px) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}
