import { expect, test } from 'vitest';
import { BUILTIN_PRESETS, DEFAULT_PARAMS, grayWorld, PARAMS, type Params } from '../src';
import { firstDiff, render, syntheticRamps } from './support/images';
import { loadPrototype } from './support/prototype';

const image = syntheticRamps();
const proto = loadPrototype();
const prototypeOutput = (params: Params) =>
  proto.run(image.data, image.width, image.height, params);

function randomParams(count: number): Params[] {
  let seed = 2024;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  return Array.from({ length: count }, () => {
    const p = { ...DEFAULT_PARAMS };
    for (const d of PARAMS) {
      if (rnd() < 0.4) p[d.key] = Math.round(d.min + rnd() * (d.max - d.min));
    }
    return p;
  });
}

test('grayWorld matches the prototype', () => {
  expect(grayWorld(image.data)).toEqual(proto.grayWorld(image.data));
  expect(grayWorld(new Uint8ClampedArray(64))).toEqual([1, 1, 1]);
});

test('every preset matches the prototype on every pixel', () => {
  for (const preset of BUILTIN_PRESETS) {
    const out = render(image, preset.params);
    expect(firstDiff(out, prototypeOutput(preset.params)), preset.id).toBe(-1);
  }
});

test('random parameters at full strength match the prototype on every pixel', () => {
  for (const params of randomParams(60)) {
    const full = { ...params, amount: 100 };
    expect(firstDiff(render(image, full), prototypeOutput(full))).toBe(-1);
  }
});

test('any amount matches the prototype when the detail pass is off', () => {
  for (const params of randomParams(30)) {
    const noDetail = { ...params, sharpen: 0, denoise: 0 };
    expect(firstDiff(render(image, noDetail), prototypeOutput(noDetail))).toBe(-1);
  }
});
