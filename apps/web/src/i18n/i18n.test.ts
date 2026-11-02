import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { t } from '.';
import en from './en.json';
import th from './th.json';

test('Thai and English have the same keys', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(th).sort());
});

test('placeholders match between languages', () => {
  const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(th) as (keyof typeof th)[]) {
    expect(names(en[key]), key).toEqual(names(th[key]));
  }
});

test('t fills placeholders', () => {
  expect(t('param.positive', { value: 25 })).toBe('บวก 25');
});

test('no Thai text is written in component source', () => {
  const src = resolve(import.meta.dirname, '..');
  const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter(
    (f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'),
  );
  const thai = /[฀-๿]/;
  const offenders = files.filter((f) => thai.test(readFileSync(resolve(src, f), 'utf8')));
  expect(offenders).toEqual([]);
});
