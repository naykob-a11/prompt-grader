import { expect, test } from 'vitest';
import { BUILTIN_PRESETS, DEFAULT_PARAMS } from '../src';
import { firstDiff, render, syntheticRamps } from './support/images';

const image = syntheticRamps();

test('I4: strips of any height match one whole-image pass, for every preset', () => {
  for (const preset of BUILTIN_PRESETS) {
    const whole = render(image, preset.params);
    for (const rows of [1, 7, 64]) {
      expect(firstDiff(render(image, preset.params, rows), whole), `${preset.id}/${rows}`).toBe(-1);
    }
  }
});

test('I4: the detail pass is seamless across strip edges', () => {
  const params = { ...DEFAULT_PARAMS, sharpen: 100, denoise: 100, vignette: 50, haze: 50 };
  expect(firstDiff(render(image, params, 13), render(image, params))).toBe(-1);
});
