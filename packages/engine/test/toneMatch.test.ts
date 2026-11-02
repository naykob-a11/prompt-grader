import { describe, expect, it } from 'vitest';
import {
  BUILTIN_PRESETS,
  DEFAULT_PARAMS,
  gradeImage,
  MATCH_SIDE,
  matchTone,
  parseSGP,
  serializeSGP,
  toneDistance,
  type GradeContext,
  type Params,
  type RawImage,
} from '../src';
import { syntheticRamps } from './support/synthetic';

const source = syntheticRamps(MATCH_SIDE, 64);
const ctx: GradeContext = {
  wbGains: [1, 1, 1],
  fullWidth: source.width,
  fullHeight: source.height,
};

const graded = (changes: Partial<Params>): RawImage => ({
  ...source,
  data: gradeImage(
    source.data,
    source.width,
    source.height,
    { ...DEFAULT_PARAMS, ...changes },
    ctx,
  ),
});

describe('matchTone', () => {
  it('stays neutral when the reference already has the same tone', () => {
    expect(matchTone(source, source)).toEqual(DEFAULT_PARAMS);
  });

  it('gives the same answer every time', () => {
    const reference = graded({ temp: 40, contrast: 30 });
    expect(matchTone(source, reference)).toEqual(matchTone(source, reference));
  });

  it.each(BUILTIN_PRESETS.map((preset) => [preset.id, preset.params] as const))(
    'comes close to the tone of %s',
    (_, params) => {
      const reference = graded(params);
      const before = toneDistance(source, reference);
      const after = toneDistance(graded(matchTone(source, reference)), reference);
      expect(after).toBeLessThan(Math.max(2.5, before * 0.45));
    },
  );

  it('moves the sliders the right way', () => {
    expect(matchTone(source, graded({ temp: 50 })).temp).toBeGreaterThan(15);
    expect(matchTone(source, graded({ temp: -50 })).temp).toBeLessThan(-15);
    expect(matchTone(source, graded({ exposure: 50 })).exposure).toBeGreaterThan(15);
    expect(matchTone(source, graded({ exposure: -50 })).exposure).toBeLessThan(-15);
  });

  it('reads a black and white reference as no color', () => {
    expect(matchTone(source, graded({ saturation: -100 })).saturation).toBeLessThan(-80);
  });

  it('compares images of different sizes', () => {
    const reference = syntheticRamps(40, 90);
    expect(() => matchTone(source, reference)).not.toThrow();
  });

  it('ignores transparent pixels', () => {
    const reference = graded({ temp: 40 });
    const padded = {
      data: new Uint8ClampedArray(reference.data.length * 2),
      width: reference.width,
      height: reference.height * 2,
    };
    padded.data.set(reference.data);
    expect(toneDistance(padded, reference)).toBe(0);
  });

  it('survives an image with nothing opaque, and a single flat color', () => {
    const empty = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
    const flat = { data: new Uint8ClampedArray([200, 120, 40, 255]), width: 1, height: 1 };
    expect(() => matchTone(source, empty)).not.toThrow();
    expect(() => matchTone(flat, source)).not.toThrow();
  });

  it('keeps the colors of the photo when the reference is another scene', () => {
    const data = new Uint8ClampedArray(source.data.length);
    for (let i = 0; i < data.length; i += 4) {
      const warm = i < data.length * 0.6;
      data.set(warm ? [232, 168, 96, 255] : [32, 48, 44, 255], i);
    }
    const params = matchTone(source, { ...source, data });
    expect(params.saturation).toBeGreaterThanOrEqual(-60);
    expect(params.temp).toBeGreaterThan(0);
  });

  it('stays inside the limits for a very different scene', () => {
    const night = {
      data: source.data.map((v, i) => (i % 4 === 3 ? 255 : v >> 3)),
      width: 128,
      height: 64,
    };
    const params = matchTone(source, night);
    expect(Math.abs(params.exposure)).toBeLessThanOrEqual(70);
    expect(Math.abs(params.contrast)).toBeLessThanOrEqual(50);
  });

  it('can be written as a prompt and read back', () => {
    const params = matchTone(source, graded({ temp: 30, shHue: 190, shSat: 60, fade: 40 }));
    const parsed = parseSGP(serializeSGP({ name: 'โทนจากภาพ', params }));
    expect(parsed.params).toEqual(params);
    expect(parsed.warnings).toEqual([]);
  });

  it('takes under a second and a half on a full size thumbnail', () => {
    const big = syntheticRamps(MATCH_SIDE, MATCH_SIDE);
    const reference = syntheticRamps(MATCH_SIDE, MATCH_SIDE);
    reference.data.forEach((v, i) => (reference.data[i] = i % 4 === 2 ? v >> 1 : v));
    const start = performance.now();
    matchTone(big, reference);
    expect(performance.now() - start).toBeLessThan(process.env.CI ? 8000 : 1500);
  });
});
