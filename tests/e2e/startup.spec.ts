import { expect, test } from '@playwright/test';

test('a driver that rejects the shaders falls back to the CPU', async ({ page }) => {
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.getShaderParameter;
    WebGL2RenderingContext.prototype.getShaderParameter = function (shader, name) {
      return name === this.COMPILE_STATUS ? false : original.call(this, shader, name);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('stage-info')).not.toBeEmpty();
  const drawn = await page.getByTestId('stage-after').evaluate(async (canvas) => {
    const element = canvas as HTMLCanvasElement;
    for (let i = 0; i < 100 && !element.width; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return element.width > 0 && element.getContext('2d') !== null;
  });
  expect(drawn).toBe(true);
});

test('an error while running shows a message instead of an empty page', async ({ page }) => {
  await page.addInitScript(() => {
    window.ImageData = function () {
      throw new Error('broken on purpose');
    } as unknown as typeof ImageData;
  });
  await page.goto('/');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('แอปทำงานผิดพลาด');
  await expect(alert).toContainText('broken on purpose');
  await expect(alert.getByRole('button', { name: 'โหลดใหม่' })).toBeVisible();
});

test('a bundle that cannot load shows why, with a way to retry', async ({ page }) => {
  await page.route('**/assets/index-*.js', (route) => route.abort());
  await page.goto('/');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('เปิดแอปไม่สำเร็จ');
  await expect(alert).toContainText('load failed');
  await expect(alert.getByRole('button', { name: 'ล้างแคชแล้วโหลดใหม่' })).toBeVisible();
});

test('a bundle that cannot be parsed shows why', async ({ page }) => {
  await page.route('**/assets/index-*.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: 'this is not javascript' }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('เปิดแอปไม่สำเร็จ');
});
