import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The policy from docs/11, applied to the real build before any host serves it.
const CSP = /`(default-src 'self';[^`]+)`/.exec(
  readFileSync('docs/11-security-privacy.md', 'utf8'),
)![1]!;

test('the app works under the content security policy', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { violations: string[] }).violations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      const list = (window as unknown as { violations: string[] }).violations;
      list.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': CSP },
    });
  });

  const blocked: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') blocked.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByTestId('stage-info')).not.toBeEmpty();
  await page.getByRole('tab', { name: 'พร้อมต์', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'ข้อความพร้อมต์' });
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('ความ');
  await expect(page.locator('.cm-tooltip-autocomplete')).toBeVisible();

  const styled = await page.locator('.cm-editor').evaluate((el) => getComputedStyle(el).display);
  expect(styled).toBe('flex');
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((font) => font.status === 'loaded');
  });
  expect(fonts).toBe(true);

  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+e');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'ส่งออกภาพความละเอียดเต็ม' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.jpg$/);

  const violations = await page.evaluate(
    () => (window as unknown as { violations: string[] }).violations,
  );
  expect(violations).toEqual([]);
  expect(blocked).toEqual([]);
});
