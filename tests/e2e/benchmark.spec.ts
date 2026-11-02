import { expect, test } from '@playwright/test';

test.use({ baseURL: 'http://localhost:5199' });
test.setTimeout(180_000);

// NFR-01. Software rendering says nothing about a real GPU, so it only reports the number there.
const realGpu = process.env.E2E_SWIFTSHADER === 'false';

test('NFR-01: preview at 2048 px', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.harness !== undefined);
  const gl = await page.evaluate(() => window.harness.glInfo());
  const frames = realGpu ? 120 : 5;
  const result = await page.evaluate((n) => window.harness.benchmark(2048, 1365, n), frames);
  console.log(`${gl.renderer}: ${result.fps.toFixed(1)} fps`);
  if (realGpu) expect(result.fps).toBeGreaterThanOrEqual(30);
});
