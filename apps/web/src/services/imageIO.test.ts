import { expect, test } from 'vitest';
import { sampleImage } from './imageIO';
import { makeSampleImage } from './sampleImage';

test('sampleImage keeps the aspect ratio and copies source pixels', () => {
  const data = new Uint8ClampedArray(400 * 200 * 4).fill(200);
  const small = sampleImage({ data, width: 400, height: 200 }, 100);
  expect([small.width, small.height]).toEqual([100, 50]);
  expect(small.data[0]).toBe(200);
});

test('sampleImage never enlarges', () => {
  const image = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
  expect(sampleImage(image, 100).width).toBe(2);
});

test('the sample picture is deterministic, opaque and not blank', () => {
  const a = makeSampleImage(96, 64);
  expect(a.data).toEqual(makeSampleImage(96, 64).data);
  expect(a.data[3]).toBe(255);
  expect(new Set(a.data).size).toBeGreaterThan(32);
});
