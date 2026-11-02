import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const FIXTURE = 'tests/fixtures/images/synthetic-ramps.png';

test('every feature works with the network off', async ({ page, context }) => {
  test.setTimeout(90_000);

  // First visit: the service worker installs and caches the app.
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('stage-info')).not.toBeEmpty();

  // Open an image, and grade it with a preset and a slider.
  await page.locator('.topbar input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByTestId('stage-info')).toContainText('synthetic-ramps.png');
  await page.getByRole('button', { name: /^Teal & Orange/ }).click();
  await page.getByLabel('ความสว่าง (EV)').fill('25');
  await page.getByLabel('ความสว่าง (EV)').dispatchEvent('pointerup');

  // The prompt editor is a separate download, so this proves it was cached.
  await page.getByRole('tab', { name: 'พร้อมต์', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'ข้อความพร้อมต์' });
  await expect(editor).toContainText('(+25)');
  await page.locator('input[accept*=".txt"]').setInputFiles({
    name: 'attached.sgp.txt',
    mimeType: 'text/plain',
    buffer: readFileSync('seed/structured-prompts/warm-vintage-film.sgp.txt'),
  });
  await expect(editor).toContainText('ฟิล์มอุ่นวินเทจ');

  // Save it to the library, which survives an offline reload.
  await page.keyboard.press('Control+s');
  await page.getByRole('button', { name: 'บันทึกเป็นพร้อมต์ใหม่' }).click();
  await expect(page.getByRole('list', { name: 'พร้อมต์ของฉัน' }).getByRole('listitem')).toHaveCount(
    1,
  );
  await page.waitForTimeout(100);
  await page.reload();
  await expect(page.getByRole('list', { name: 'พร้อมต์ของฉัน' }).getByRole('listitem')).toHaveCount(
    1,
  );

  // Export the graded image.
  await expect(page.getByTestId('stage-info')).not.toBeEmpty();
  await page.keyboard.press('Control+e');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'ส่งออกภาพความละเอียดเต็ม' }).click(),
  ]);
  expect(readFileSync(await download.path()).length).toBeGreaterThan(1000);
});

test('the app can be installed', async ({ page, baseURL }) => {
  await page.goto('/');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await page.request.get(new URL(href!, baseURL).href)).json();
  expect(manifest).toMatchObject({ display: 'standalone', lang: 'th' });
  expect(manifest.name).toBe('เกรดสีจากพร้อมต์');
  for (const icon of manifest.icons) {
    const response = await page.request.get(new URL(icon.src, baseURL).href);
    expect(response.ok(), icon.src).toBe(true);
  }
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(
    true,
  );
});
