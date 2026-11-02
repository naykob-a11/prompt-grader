import { expect, test } from '@playwright/test';

// Checks what a real host sends, so it needs one: set E2E_BASE_URL to a deployment, or to
// `wrangler pages dev apps/web/dist`. `pnpm preview` does not read _headers.
test.skip(!process.env.E2E_BASE_URL, 'needs a host that applies _headers');

test('the page is served with the security headers', async ({ request }) => {
  const headers = (await request.get('/')).headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('no-referrer');
});

test('hashed files are cached for good, and the service worker is not', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const script = await page.locator('script[type=module]').first().getAttribute('src');
  const asset = (await request.get(script!)).headers();
  expect(asset['cache-control']).toContain('immutable');
  const worker = (await request.get('/sw.js')).headers();
  expect(worker['cache-control']).toContain('no-cache');
  expect(worker['cache-control']).not.toContain('immutable');
});

test('_headers itself is not served as a file', async ({ request }) => {
  const response = await request.get('/_headers');
  expect(await response.text()).not.toContain('Content-Security-Policy:');
});

test('unknown paths still open the app', async ({ page }) => {
  await page.goto('/any/old/path');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
