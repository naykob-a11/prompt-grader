import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { BUILTIN_PRESETS, gradeImage, grayWorld, type GradeContext, type Params } from '../../src';

export interface Image {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export const ROOT = resolve(import.meta.dirname, '../../../..');
export const IMAGES_DIR = resolve(ROOT, 'tests/fixtures/images');
export const GOLDEN_DIR = resolve(ROOT, 'tests/golden');
export const SYNTHETIC_NAME = 'synthetic-ramps.png';

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
export function syntheticRamps(width = 512, height = 256): Image {
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

export function contextFor(image: Image): GradeContext {
  return {
    wbGains: grayWorld(image.data),
    fullWidth: image.width,
    fullHeight: image.height,
  };
}

export function render(image: Image, params: Params, stripRows?: number): Uint8ClampedArray {
  return gradeImage(image.data, image.width, image.height, params, contextFor(image), stripRows);
}

export function readPng(path: string): Image {
  const png = PNG.sync.read(readFileSync(path));
  return { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height };
}

export function writePng(path: string, image: Image): void {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
}

/** Index of the first differing pixel, or -1. Far faster than toEqual on large arrays. */
export function firstDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length) return 0;
  const bytes = (x: Uint8ClampedArray) => Buffer.from(x.buffer, x.byteOffset, x.length);
  if (bytes(a).equals(bytes(b))) return -1;
  return Math.floor(a.findIndex((v, i) => v !== b[i]) / 4);
}

/** PSNR in dB over RGB; Infinity for identical images. */
export function psnr(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    if (i % 4 === 3) continue;
    const d = a[i]! - b[i]!;
    sum += d * d;
    n++;
  }
  return sum === 0 ? Infinity : 10 * Math.log10((255 * 255) / (sum / n));
}

export const shortId = (id: string) => id.replace(/^builtin:/, '');

export const goldenName = (presetId: string, imageName: string) =>
  `${shortId(presetId)}__${imageName.replace(/\.[^.]+$/, '')}.png`;

/** Only PNG fixtures for now; JPEG photos need a decoder when they are added. */
export const fixtureImages = () => readdirSync(IMAGES_DIR).filter((f) => f.endsWith('.png'));

export function goldenCases() {
  return fixtureImages().flatMap((imageName) =>
    BUILTIN_PRESETS.map((preset) => ({
      preset,
      imageName,
      file: resolve(GOLDEN_DIR, goldenName(preset.id, imageName)),
    })),
  );
}
