import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('the build ships production React', () => {
  const assets = 'apps/web/dist/assets';
  const scripts = readdirSync(assets).filter((file) => file.endsWith('.js'));
  expect(scripts.length).toBeGreaterThan(0);
  for (const file of scripts) {
    expect(readFileSync(`${assets}/${file}`, 'utf8'), file).not.toContain('reactjs.org/link/');
  }
});

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
