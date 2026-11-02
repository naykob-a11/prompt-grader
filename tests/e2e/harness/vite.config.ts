// Dev server for the test-only page that runs the engine in a real browser. Never deployed.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: fileURLToPath(new URL('../../../node_modules/.vite-harness', import.meta.url)),
  server: { port: 5199, strictPort: true },
});
