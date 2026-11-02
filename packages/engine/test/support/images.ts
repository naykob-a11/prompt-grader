import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { BUILTIN_PRESETS, gradeImage, grayWorld } from '../../src';
import type { GradeContext, Params, RawImage } from '../../src';
import { syntheticRamps } from './synthetic';

export type Image = RawImage;
export { syntheticRamps };

export const ROOT = resolve(import.meta.dirname, '../../../..');
export const IMAGES_DIR = resolve(ROOT, 'tests/fixtures/images');
export const GOLDEN_DIR = resolve(ROOT, 'tests/golden');
export const SYNTHETIC_NAME = 'synthetic-ramps.png';

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
