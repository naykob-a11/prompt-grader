/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { parseEnv } from './src/config/envSchema.ts';

const envDir = fileURLToPath(new URL('../..', import.meta.url));
const THEME_COLOR = '#1f7d74';

export default defineConfig(({ command, mode }) => {
  // A NODE_ENV left over in the shell must not ship the development build of React.
  if (command === 'build') process.env.NODE_ENV = 'production';

  // Parsing here makes a bad VITE_* value fail `pnpm build`, not just the running app.
  const env = parseEnv(loadEnv(mode, envDir, 'VITE_'));
  const tools = loadEnv(mode, envDir, '');
  return {
    base: env.VITE_BASE_PATH,
    envDir,
    plugins: [
      react(),
      VitePWA({
        disable: !env.VITE_FEATURE_PWA,
        registerType: 'autoUpdate',
        // A script file rather than inline code, which the CSP would block.
        injectRegister: 'script-defer',
        manifest: {
          name: env.VITE_APP_NAME,
          short_name: env.VITE_APP_SHORT_NAME,
          lang: env.VITE_DEFAULT_LOCALE,
          display: 'standalone',
          theme_color: THEME_COLOR,
          background_color: THEME_COLOR,
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        },
      }),
    ],
    server: { port: Number(tools.DEV_PORT || 5173) },
    preview: { port: Number(tools.PREVIEW_PORT || 4173) },
    test: { environment: 'jsdom' },
  };
});
