import { defineConfig, devices } from '@playwright/test';

const port = process.env.PREVIEW_PORT || '4173';
const external = process.env.E2E_BASE_URL;
const swiftshader = process.env.E2E_SWIFTSHADER !== 'false';

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: external || `http://localhost:${port}`,
    launchOptions: { args: swiftshader ? ['--use-angle=swiftshader'] : [] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(external
    ? {}
    : {
        webServer: {
          command: 'pnpm build && pnpm preview',
          url: `http://localhost:${port}`,
          reuseExistingServer: !process.env.CI,
        },
      }),
});
