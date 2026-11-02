import { SCHEMA_VERSION } from '@prompt-grader/engine';
import { expect, test } from 'vitest';

test('the engine package resolves through the workspace', () => {
  expect(SCHEMA_VERSION).toBeGreaterThan(0);
});
