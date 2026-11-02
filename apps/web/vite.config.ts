/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { parseEnv } from './src/config/envSchema.ts';

const envDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  // Parsing here makes a bad VITE_* value fail `pnpm build`, not just the running app.
  const env = parseEnv(loadEnv(mode, envDir, 'VITE_'));
  const tools = loadEnv(mode, envDir, '');
  return {
    base: env.VITE_BASE_PATH,
    envDir,
    plugins: [react()],
    server: { port: Number(tools.DEV_PORT || 5173) },
    preview: { port: Number(tools.PREVIEW_PORT || 4173) },
    test: { environment: 'jsdom' },
  };
});
