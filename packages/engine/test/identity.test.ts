import { expect, test } from 'vitest';
import { BUILTIN_PRESETS, DEFAULT_PARAMS } from '../src';
import { firstDiff, render, syntheticRamps } from './support/images';

const image = syntheticRamps();

test('I1: neutral parameters return every pixel unchanged', () => {
  expect(firstDiff(render(image, DEFAULT_PARAMS), image.data)).toBe(-1);
});

test('I1: every 8-bit grey and primary level survives the neutral path', () => {
  const data = new Uint8ClampedArray(256 * 4 * 4);
  for (let v = 0; v < 256; v++) {
    data.set([v, v, v, 255, v, 0, 0, 255, 0, v, 0, 255, 0, 0, v, 255], v * 16);
  }
  expect(firstDiff(render({ data, width: 256, height: 4 }, DEFAULT_PARAMS), data)).toBe(-1);
});

test('I2: amount 0 returns the original for every preset, including sharpened ones', () => {
  for (const preset of BUILTIN_PRESETS) {
    const out = render(image, { ...preset.params, amount: 0 });
    expect(firstDiff(out, image.data), preset.id).toBe(-1);
  }
  const sharp = { ...DEFAULT_PARAMS, amount: 0, sharpen: 100, denoise: 100 };
  expect(firstDiff(render(image, sharp), image.data)).toBe(-1);
});
