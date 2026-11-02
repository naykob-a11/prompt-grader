import { expect, test } from 'vitest';
import { DEFAULT_PARAMS } from '../src';
import { render, syntheticRamps } from './support/images';

test('I7: saturation -100 gives r = g = b for every pixel', () => {
  const out = render(syntheticRamps(), { ...DEFAULT_PARAMS, saturation: -100 });
  for (let i = 0; i < out.length; i += 4) {
    if (out[i] !== out[i + 1] || out[i] !== out[i + 2]) {
      expect.fail(`pixel ${i / 4}: ${out[i]}, ${out[i + 1]}, ${out[i + 2]}`);
    }
  }
});
