import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { EnvSchema, parseEnv } from './envSchema';

const root = resolve(import.meta.dirname, '../../../..');

function readVite(file: string) {
  const out: Record<string, string> = {};
  for (const m of readFileSync(resolve(root, file), 'utf8').matchAll(
    /^(VITE_[A-Z0-9_]+)=(.*)$/gm,
  )) {
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

test('every VITE_* variable in .env.example is in the schema, and the reverse', () => {
  expect(Object.keys(readVite('.env.example')).sort()).toEqual(Object.keys(EnvSchema.shape).sort());
});

test('.env.example states the same values as the schema defaults', () => {
  expect(parseEnv(readVite('.env.example'))).toEqual(parseEnv({}));
});

test('a malformed value throws and names the variable', () => {
  expect(() => parseEnv({ VITE_EXPORT_QUALITY: '101' })).toThrow('VITE_EXPORT_QUALITY');
  expect(() => parseEnv({ VITE_DEBUG_SGP: 'yes' })).toThrow('VITE_DEBUG_SGP');
  expect(() => parseEnv({ VITE_BASE_PATH: 'prompt-grader' })).toThrow('VITE_BASE_PATH');
});

test('booleans and numbers are converted from strings', () => {
  const env = parseEnv({ VITE_FORCE_CPU_ENGINE: 'true', VITE_UNDO_LIMIT: '10' });
  expect(env.VITE_FORCE_CPU_ENGINE).toBe(true);
  expect(env.VITE_UNDO_LIMIT).toBe(10);
});

test('.env.production keeps debug features off', () => {
  const production = readVite('.env.production');
  expect(production.VITE_DEBUG_PANEL).toBe('false');
  expect(production.VITE_DEBUG_SGP).toBe('false');
});
