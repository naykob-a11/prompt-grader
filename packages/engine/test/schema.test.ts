import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import {
  clamp,
  DEFAULT_PARAMS,
  PARAM_GROUPS,
  PARAM_KEYS,
  PARAMS,
  ParamsSchema,
  SCHEMA_VERSION,
  toSeedSchema,
} from '../src';
import { ROOT } from './support/images';

test('seed/parameter-schema.json is exactly what schema.ts exports', () => {
  const seed = JSON.parse(readFileSync(resolve(ROOT, 'seed/parameter-schema.json'), 'utf8'));
  expect(toSeedSchema()).toEqual(seed);
});

test('there are 45 parameters with unique keys, each in a known group', () => {
  expect(PARAMS).toHaveLength(45);
  expect(new Set(PARAM_KEYS).size).toBe(45);
  const groups = new Set<string>(PARAM_GROUPS.map((g) => g.id));
  expect(PARAMS.every((p) => groups.has(p.group))).toBe(true);
});

test('every neutral value is in range and no parameter is newer than the schema', () => {
  for (const p of PARAMS) {
    expect(p.default).toBeGreaterThanOrEqual(p.min);
    expect(p.default).toBeLessThanOrEqual(p.max);
    expect(p.since).toBeLessThanOrEqual(SCHEMA_VERSION);
  }
});

test('clamp fills, rounds and bounds values', () => {
  const p = clamp({ exposure: 12.6, grain: 999, shadows: -999, contrast: 'x', tint: NaN });
  expect(p.exposure).toBe(13);
  expect(p.grain).toBe(100);
  expect(p.shadows).toBe(-100);
  expect(p.contrast).toBe(0);
  expect(p.tint).toBe(0);
  expect(p.amount).toBe(100);
  expect(Object.is(clamp({ exposure: -0.2 }).exposure, 0)).toBe(true);
});

test('ParamsSchema accepts the defaults and rejects bad values', () => {
  expect(ParamsSchema.safeParse(DEFAULT_PARAMS).success).toBe(true);
  expect(ParamsSchema.safeParse({ ...DEFAULT_PARAMS, grain: 101 }).success).toBe(false);
  expect(ParamsSchema.safeParse({ ...DEFAULT_PARAMS, grain: 1.5 }).success).toBe(false);
  expect(ParamsSchema.safeParse({}).success).toBe(false);
});
