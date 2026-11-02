import { DEFAULT_PARAMS, SCHEMA_VERSION } from '@prompt-grader/engine';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { PromptRecord } from './db';
import {
  LibraryFileError,
  parseLibraryFile,
  serializeLibrary,
  uniqueName,
  type LibraryFileProblem,
} from './libraryFile';

const limits = { maxBytes: 5_242_880, maxItems: 1000 };
const fixtures = resolve(import.meta.dirname, '../../../../tests/fixtures/library');
const fixture = (name: string) => readFileSync(resolve(fixtures, name), 'utf8');
const parse = (text: string, names: string[] = []) => parseLibraryFile(text, names, limits);
const file = (prompts: unknown[], extra: object = {}) =>
  JSON.stringify({ format: 'prompt-grader/library', version: 1, prompts, ...extra });

function problemOf(run: () => unknown): LibraryFileProblem | undefined {
  try {
    run();
  } catch (error) {
    return (error as LibraryFileError).problem;
  }
  return undefined;
}

describe('parseLibraryFile', () => {
  test('reads the sample library file', () => {
    const { records, skipped } = parse(fixture('sample-library.json'));
    expect(records.map((r) => r.name)).toEqual(['เช้าสดใส', 'เย็นทะเล']);
    expect(records[0]!.params.exposure).toBe(20);
    expect(records[0]!.tags).toEqual(['ทดสอบ']);
    expect(records[1]!.notes).toBe('ใช้กับภาพทะเล');
    expect(skipped).toBe(0);
  });

  test('reads the prototype format, mapping text and note', () => {
    const { records, skipped } = parse(fixture('kreadsi-prompts.json'));
    expect(records[0]).toMatchObject({
      name: 'ทุ่งนาเก่า',
      freeText: 'warm film look',
      notes: 'จากต้นแบบ',
      source: 'import',
    });
    expect(records[0]!.params.fade).toBe(40);
    expect(skipped).toBe(1);
  });

  test('fills every parameter, clamps values and always makes new ids', () => {
    const text = file([
      { name: 'a', params: { grain: 999 } },
      { name: 'b', params: {} },
    ]);
    const { records } = parse(text);
    expect(records[0]!.params).toEqual({ ...DEFAULT_PARAMS, grain: 100 });
    expect(records[0]!.schemaVersion).toBe(SCHEMA_VERSION);
    expect(records[0]!.id).not.toBe(records[1]!.id);
  });

  test('migrates parameters saved by an older schema', () => {
    const text = file([{ name: 'old', params: { cream: 30, depth: 50 } }], { schemaVersion: 1 });
    expect(parse(text).records[0]!.params).toMatchObject({ hiSat: 30, hiHue: 40, shadows: -40 });
  });

  test('never replaces existing names', () => {
    const text = file([
      { name: 'ซ้ำ', params: {} },
      { name: 'ซ้ำ', params: {} },
    ]);
    expect(parse(text, ['ซ้ำ']).records.map((r) => r.name)).toEqual(['ซ้ำ (2)', 'ซ้ำ (3)']);
  });

  test('skips bad items and counts them', () => {
    const text = file([
      { name: 'ดี', params: {} },
      42,
      { params: {} },
      { name: '   ', params: {} },
    ]);
    const { records, skipped } = parse(text);
    expect(records).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  test('skips items that have prompt text but no parameters, until P5 can read them', () => {
    const { records, skipped } = parse(file([{ name: 'ข้อความล้วน', prompt: 'เงา: ยก' }]));
    expect(records).toEqual([]);
    expect(skipped).toBe(1);
  });

  test('cuts names and tags to their limits', () => {
    const tags = Array.from({ length: 30 }, (_, i) => `t${i}`);
    const { records } = parse(file([{ name: 'ก'.repeat(200), params: {}, tags }]));
    expect(records[0]!.name).toHaveLength(80);
    expect(records[0]!.tags).toHaveLength(20);
  });

  test('imports at most the item limit and counts the rest as skipped', () => {
    const prompts = Array.from({ length: 5 }, (_, i) => ({ name: `p${i}`, params: {} }));
    const { records, skipped } = parseLibraryFile(file(prompts), [], { ...limits, maxItems: 3 });
    expect(records).toHaveLength(3);
    expect(skipped).toBe(2);
  });

  test('refuses files that are not a library, or too large', () => {
    expect(problemOf(() => parse('not json'))).toBe('invalid');
    expect(problemOf(() => parse('{"format":"other","version":1,"prompts":[]}'))).toBe('invalid');
    expect(problemOf(() => parse('null'))).toBe('invalid');
    const small = { ...limits, maxBytes: 4 };
    expect(problemOf(() => parseLibraryFile(file([]), [], small))).toBe('tooLarge');
  });

  test('a __proto__ key cannot reach the parameters or Object.prototype', () => {
    const text = `{"format":"prompt-grader/library","version":1,"prompts":[
      {"name":"x","params":{"__proto__":{"polluted":true},"grain":5}}]}`;
    const { records } = parse(text);
    expect(records[0]!.params.grain).toBe(5);
    expect(Object.keys(records[0]!.params)).toEqual(Object.keys(DEFAULT_PARAMS));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('serializeLibrary', () => {
  test('survives a round trip', () => {
    const record: PromptRecord = {
      id: 'x',
      name: 'เก็บไว้',
      prompt: 'เงา: ยก',
      freeText: 'lifted shadows',
      params: { ...DEFAULT_PARAMS, shadows: 30 },
      schemaVersion: SCHEMA_VERSION,
      notes: 'โน้ต',
      preserve: 'ใบหน้า',
      tags: ['ก'],
      source: 'user',
      createdAt: 1,
      updatedAt: 1,
    };
    const { records, skipped } = parse(serializeLibrary([record]));
    expect(skipped).toBe(0);
    expect(records[0]).toMatchObject({
      name: 'เก็บไว้',
      prompt: 'เงา: ยก',
      freeText: 'lifted shadows',
      params: record.params,
      notes: 'โน้ต',
      preserve: 'ใบหน้า',
      tags: ['ก'],
    });
    expect(JSON.parse(serializeLibrary([record])).exportedAt).toBeTruthy();
  });
});

test('uniqueName counts up from 2', () => {
  expect(uniqueName('a', new Set())).toBe('a');
  expect(uniqueName('a', new Set(['a', 'a (2)']))).toBe('a (3)');
});
