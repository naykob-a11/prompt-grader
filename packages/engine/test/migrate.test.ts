import { expect, test } from 'vitest';
import { BUILTIN_PRESETS, DEFAULT_PARAMS, migrateParams, PARAMS, SCHEMA_VERSION } from '../src';
import { firstDiff, render, syntheticRamps } from './support/images';

test('v1 keys become split toning and shadows', () => {
  const p = migrateParams({ cream: 30, shadowTeal: 45, depth: 50, teal: 60 }, 1);
  expect(p).toEqual({
    ...DEFAULT_PARAMS,
    hiHue: 40,
    hiSat: 30,
    shHue: 188,
    shSat: 45,
    shadows: -40,
    teal: 60,
  });
});

test('current parameters pass through unchanged', () => {
  for (const preset of BUILTIN_PRESETS) {
    expect(migrateParams(preset.params, SCHEMA_VERSION)).toEqual(preset.params);
  }
});

test('a saved v2 preset renders the same after migration', () => {
  const image = syntheticRamps();
  const added = new Set<string>(PARAMS.filter((p) => p.since === 3).map((p) => p.key));
  for (const preset of BUILTIN_PRESETS) {
    if (Object.keys(preset.params).some((k) => added.has(k) && preset.params[k as 'hP'] !== 0)) {
      continue;
    }
    const v2 = Object.fromEntries(Object.entries(preset.params).filter(([k]) => !added.has(k)));
    expect(firstDiff(render(image, migrateParams(v2, 2)), render(image, preset.params))).toBe(-1);
  }
});
