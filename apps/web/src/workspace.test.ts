import { ENGINE_NAME } from '@prompt-grader/engine';
import { expect, test } from 'vitest';

test('the engine package resolves through the workspace', () => {
  expect(ENGINE_NAME).toBe('@prompt-grader/engine');
});
