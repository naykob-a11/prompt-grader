import { expect, test } from 'vitest';
import { DEFAULT_PARAMS, gradePixels, PARAMS, type Params } from '../src';
import { detail } from '../src/cpu/detail';
import { contextFor, syntheticRamps } from './support/images';

const image = syntheticRamps(64, 32);
const ctx = contextFor(image);

/** Grades into a float buffer: a Uint8ClampedArray would silently turn NaN into 0. */
function rawOutput(params: Params) {
  const src = new Uint8ClampedArray(image.data);
  detail(src, image.width, image.height, params, 0, image.height);
  const raw = new Float64Array(image.data.length);
  const dst = raw as unknown as Uint8ClampedArray;
  gradePixels(image.data, src, dst, image.width, image.height, 0, params, ctx);
  return raw;
}

function expectFinite(params: Params, label: string) {
  const bad = rawOutput(params).findIndex((v) => !Number.isFinite(v));
  expect(bad, label).toBe(-1);
}

test('I3: each parameter at its minimum and maximum gives finite values', () => {
  for (const p of PARAMS) {
    expectFinite({ ...DEFAULT_PARAMS, [p.key]: p.min }, `${p.key} min`);
    expectFinite({ ...DEFAULT_PARAMS, [p.key]: p.max }, `${p.key} max`);
  }
});

test('I3: every parameter at the same extreme together gives finite values', () => {
  const pick = (side: 'min' | 'max') =>
    Object.fromEntries(PARAMS.map((p) => [p.key, p[side]])) as Params;
  expectFinite(pick('min'), 'all min');
  expectFinite(pick('max'), 'all max');
});
