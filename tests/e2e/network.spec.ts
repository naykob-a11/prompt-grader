import { expect, test } from '@playwright/test';

test('the app opens without any request leaving the origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/^(https?|wss?):$/.test(url.protocol) && url.origin !== origin) external.push(url.href);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(external).toEqual([]);
});
