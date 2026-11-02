import { expect, test } from 'vitest';
import { histogram } from '../src';

test('counts each channel and luminance', () => {
  const bins = histogram(new Uint8ClampedArray([255, 0, 0, 255, 10, 10, 10, 255]));
  expect(bins.r[255]).toBe(1);
  expect(bins.r[10]).toBe(1);
  expect(bins.g[0]).toBe(1);
  expect(bins.l[10]).toBe(1);
  expect(bins.l[54]).toBe(1); // 0.2126 x 255
  expect(bins.r.reduce((a, b) => a + b)).toBe(2);
});
