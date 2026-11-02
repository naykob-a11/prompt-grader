import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/images/synthetic-ramps.png';
const after = (page: Page) => page.getByTestId('stage-after');

async function openFixture(page: Page) {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByTestId('stage-info')).toContainText('synthetic-ramps.png');
  await page.getByRole('button', { name: 'หลังปรับ' }).click();
}

/** Waits for the frame after a change, so a screenshot never sees the previous one. */
async function shot(page: Page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  return after(page).screenshot();
}

const viewports = [
  { name: 'desktop', width: 1440, height: 900, tabs: false },
  { name: 'mobile', width: 360, height: 740, tabs: true },
];

for (const { name, tabs, ...viewport } of viewports) {
  test.describe(name, () => {
    test.use({ viewport });

    test('open an image, choose a preset, adjust a slider, see the result', async ({ page }) => {
      await openFixture(page);
      const initial = await shot(page);

      await page.getByRole('button', { name: /หมอกเช้าบนดอย/ }).click();
      const graded = await shot(page);
      expect(graded.equals(initial)).toBe(false);

      if (tabs) await page.getByRole('tab', { name: 'ปรับ' }).click();
      await page.getByLabel('ความสว่าง (EV)').fill('60');
      await page.getByLabel('ความสว่าง (EV)').dispatchEvent('pointerup');
      const brighter = await shot(page);
      expect(brighter.equals(graded)).toBe(false);

      await page.getByRole('button', { name: 'ย้อน' }).click();
      expect((await shot(page)).equals(graded)).toBe(true);
      await page.getByRole('button', { name: 'ทำซ้ำ' }).click();
      expect((await shot(page)).equals(brighter)).toBe(true);
    });

    test('the page never scrolls sideways', async ({ page }) => {
      await page.goto('/');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('the whole image fits inside the stage', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('stage-info')).not.toBeEmpty();
      const frame = (await page.getByTestId('stage-before').boundingBox())!;
      const stage = (await page.getByRole('region', { name: 'ภาพ', exact: true }).boundingBox())!;
      expect(frame.width).toBeGreaterThan(100);
      expect(frame.x).toBeGreaterThanOrEqual(stage.x);
      expect(frame.x + frame.width).toBeLessThanOrEqual(stage.x + stage.width);
      expect(frame.y + frame.height).toBeLessThanOrEqual(stage.y + stage.height);
    });
  });
}

test('holding backslash shows the original, and compare modes switch with C', async ({ page }) => {
  await openFixture(page);
  await expect(after(page)).toBeVisible();
  await page.keyboard.down('\\');
  await expect(after(page)).toBeHidden();
  await page.keyboard.up('\\');
  await expect(after(page)).toBeVisible();

  await page.keyboard.press('c');
  await expect(page.getByRole('button', { name: 'ต้นฉบับ' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('c');
  await expect(page.getByRole('slider', { name: 'เส้นแบ่งก่อนและหลัง' })).toBeVisible();
});

test('the compare divider moves with the keyboard', async ({ page }) => {
  await page.goto('/');
  const divider = page.getByRole('slider', { name: 'เส้นแบ่งก่อนและหลัง' });
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '52');
});

test('Ctrl+Z and Ctrl+Shift+Z undo and redo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /หมอกเช้าบนดอย/ }).click();
  const mist = page.getByRole('button', { name: /หมอกเช้าบนดอย/ });
  await expect(mist).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+z');
  await expect(mist).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Control+Shift+z');
  await expect(mist).toHaveAttribute('aria-pressed', 'true');
});

test('a dropped or pasted image opens, and a non-image file gives a helpful message', async ({
  page,
}) => {
  await page.goto('/');
  const transferOf = (name: string) =>
    page.evaluateHandle(async (fileName) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 8;
      canvas.getContext('2d')!.fillRect(0, 0, 8, 8);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!)));
      const data = new DataTransfer();
      data.items.add(new File([blob], fileName, { type: 'image/png' }));
      return data;
    }, name);

  await page.dispatchEvent('body', 'drop', { dataTransfer: await transferOf('dropped.png') });
  await expect(page.getByTestId('stage-info')).toContainText('dropped.png · 8 × 8 px');

  await page.evaluate(
    (data) => {
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data }));
    },
    await transferOf('pasted.png'),
  );
  await expect(page.getByTestId('stage-info')).toContainText('pasted.png');

  await page.locator('input[type=file]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a picture'),
  });
  await expect(page.getByRole('status')).toContainText('ไฟล์นี้ไม่ใช่ภาพ');
});

test('double-clicking a slider label resets it', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByLabel('คอนทราสต์');
  await expect(slider).toHaveValue('5');
  await page.getByText('คอนทราสต์', { exact: true }).dblclick();
  await expect(slider).toHaveValue('0');
});

test('zoom shows the image at its own pixel size', async ({ page }) => {
  await openFixture(page);
  await page.getByRole('button', { name: 'ซูม 100%' }).click();
  const box = await after(page).boundingBox();
  expect([box?.width, box?.height]).toEqual([512, 256]);
});
