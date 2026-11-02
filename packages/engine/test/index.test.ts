import { expect, test } from 'vitest';
import { ENGINE_NAME } from '../src/index';

test('the package entry point loads', () => {
  expect(ENGINE_NAME).toBe('@prompt-grader/engine');
});
