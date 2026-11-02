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

  test(`${colorScheme} hue sliders`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.getByLabel('สีของเงา').scrollIntoViewIfNeeded();
    await page
      .locator('details', { has: page.getByLabel('สีของเงา') })
      .screenshot({ path: `test-results/screens/${colorScheme}-hue.png` });
  });
}
