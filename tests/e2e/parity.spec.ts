import { expect, test } from '@playwright/test';
import type { Comparison } from './harness/main';

const maxDiff = Number(process.env.PARITY_MAX_DIFF || 2);

test.use({ baseURL: 'http://localhost:5199' });
test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.harness !== undefined);
});

function report(results: Comparison[], limit = maxDiff) {
  const worst = results.reduce((a, b) => (b.maxDiff > a.maxDiff ? b : a));
  console.log(`${results.length} cases, worst ${worst.maxDiff}/255: ${JSON.stringify(worst)}`);
  const failed = results.filter((r) => r.maxDiff > limit);
  expect(failed, JSON.stringify(failed.slice(0, 5))).toEqual([]);
}

test('I5: GPU matches CPU for presets, extremes and random parameters', async ({ page }) => {
  console.log(await page.evaluate(() => window.harness.glInfo()));
  const results = await page.evaluate(() => window.harness.parity());
  report(results.filter((r) => r.label.startsWith('builtin:')));
  // One level more for stress cases, whose causes are explained in docs/04 section 3.
  report(results, maxDiff + 1);
});

test('I5: tiled rendering matches CPU across seams', async ({ page }) => {
  report(await page.evaluate(() => window.harness.tiled(64)));
  report(await page.evaluate(() => window.harness.tiled(201)));
});

test('the canvas shows the same image as memory, the right way up', async ({ page }) => {
  const result = await page.evaluate(() => window.harness.canvasOrientation());
  expect(result.maxDiff, JSON.stringify(result)).toBeLessThanOrEqual(1);
});

test('forceCpu paints the CPU result through a worker', async ({ page }) => {
  const result = await page.evaluate(() => window.harness.cpuFallback());
  expect(result.backend).toBe('cpu');
  expect(result.maxDiff, JSON.stringify(result)).toBe(0);
});

test('losing the GPU context reports it, and a new canvas can fall back to CPU', async ({
  page,
}) => {
  const result = await page.evaluate(() => window.harness.contextLoss());
  expect(result).toEqual({ backend: 'webgl2', lost: true, next: 'cpu' });
});
