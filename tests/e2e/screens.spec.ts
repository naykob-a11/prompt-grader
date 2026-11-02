import { expect, test } from '@playwright/test';

// Screenshots for reviewing light and dark themes at phone and desktop width.
for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [360, 820, 1440]) {
    test(`${colorScheme} at ${width} px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await expect(page.getByTestId('stage-info')).not.toBeEmpty();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/screens/${colorScheme}-${width}.png` });
    });
  }

  for (const width of [360, 1440]) {
    test(`${colorScheme} prompt editor at ${width} px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.getByRole('tab', { name: 'พร้อมต์', exact: true }).click();
      await page.getByRole('textbox', { name: 'ข้อความพร้อมต์' }).click();
      await page.keyboard.press('Control+Home');
      await page.keyboard.insertText('หัวข้อผิด: มาก\n');
      await expect(page.getByText('1 บรรทัดที่อ่านไม่ได้')).toBeVisible();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `test-results/screens/${colorScheme}-prompt-${width}.png` });
    });
  }

  test(`${colorScheme} export dialog`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await expect(page.getByTestId('stage-info')).not.toBeEmpty();
    await page.keyboard.press('Control+e');
    await expect(page.getByRole('button', { name: 'ส่งออกภาพความละเอียดเต็ม' })).toBeVisible();
    await page.screenshot({ path: `test-results/screens/${colorScheme}-export.png` });
  });

  test(`${colorScheme} hue sliders`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.getByLabel('สีของเงา').scrollIntoViewIfNeeded();
    await page
      .locator('details', { has: page.getByLabel('สีของเงา') })
      .screenshot({ path: `test-results/screens/${colorScheme}-hue.png` });
  });
}
