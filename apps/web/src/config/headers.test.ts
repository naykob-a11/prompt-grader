import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '../../../..');
const headers = readFileSync(resolve(root, 'apps/web/public/_headers'), 'utf8');
const docs = readFileSync(resolve(root, 'docs/11-security-privacy.md'), 'utf8');

test('the deployed policy is the one in docs/11', () => {
  const deployed = /Content-Security-Policy: (.+)/.exec(headers)![1]!.trim();
  const documented = /`(default-src 'self';[^`]+)`/.exec(docs)![1]!;
  expect(deployed).toBe(documented);
});

test('the policy allows nothing from another origin or inline', () => {
  const policy = /Content-Security-Policy: (.+)/.exec(headers)![1]!;
  expect(policy).not.toMatch(/https?:|unsafe-inline|unsafe-eval|\*/);
});

test('the file stays within the limits of Cloudflare Pages', () => {
  const lines = headers.split(/\r?\n/);
  expect(lines.filter((line) => line.startsWith('/')).length).toBeLessThanOrEqual(100);
  expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(2000);
});
