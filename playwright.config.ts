import { defineConfig, devices } from '@playwright/test';

const port = process.env.PREVIEW_PORT || '4173';
const external = process.env.E2E_BASE_URL;
const swiftshader = process.env.E2E_SWIFTSHADER !== 'false';

const harness = {
  command: 'pnpm exec vite --config tests/e2e/harness/vite.config.ts',
  url: 'http://localhost:5199',
  reuseExistingServer: !process.env.CI,
};

const preview = {
  command: 'pnpm build && pnpm preview',
  url: `http://localhost:${port}`,
  reuseExistingServer: !process.env.CI,
};

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: external || `http://localhost:${port}`,
    launchOptions: {
      args: swiftshader
        ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        : ['--use-angle=default', '--ignore-gpu-blocklist'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: external ? [harness] : [preview, harness],
});
