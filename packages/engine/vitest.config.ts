import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Pixel comparisons take a few seconds here and several times that on a CI runner.
  test: { testTimeout: 30_000 },
});
