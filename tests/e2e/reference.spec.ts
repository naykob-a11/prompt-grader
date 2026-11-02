import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/images/synthetic-ramps.png';
const SAVED = 'บันทึก โทนจาก sunset เข้าคลังและใช้กับภาพแล้ว';
const windowOf = (page: Page) => page.locator('.reference-window');
const referenceInput = (page: Page) => page.getByTestId('reference-input');
const mainTemperature = (page: Page) => page.locator('#param-temp');
const draftTemperature = (page: Page) => page.locator('#draft-temp');
const draftText = (page: Page) => windowOf(page).getByRole('textbox', { name: 'ข้อความพร้อมต์' });

/** A warm gradient, made in the page so the test needs no extra file. */
async function warmReference(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 120;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 200, 0);
    gradient.addColorStop(0, '#1a0f05');
    gradient.addColorStop(0.5, '#b0702a');
    gradient.addColorStop(1, '#f8d8a0');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 200, 120);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  return { name: 'sunset.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

const openWindow = (page: Page) => page.getByRole('button', { name: 'สร้างจากภาพอ้างอิง' }).click();

async function ready(page: Page) {
  await page.goto('/');
  await page.locator('.topbar input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByTestId('stage-info')).toContainText('synthetic-ramps.png');
  await page.getByRole('tab', { name: 'แถบเลื่อน', exact: true }).click();
}

async function measured(page: Page) {
  await ready(page);
  const before = await mainTemperature(page).inputValue();
  await openWindow(page);
  await referenceInput(page).setInputFiles(await warmReference(page));
  await expect(draftText(page)).toBeVisible();
  return before;
}

test('a reference opens a draft that leaves the main image alone', async ({ page }) => {
  const before = await measured(page);
  await expect(page.getByRole('img', { name: 'ภาพอ้างอิง sunset.png' })).toBeVisible();
  await expect(windowOf(page).locator('canvas')).toBeVisible();
  await expect(draftText(page)).toHaveValue(/ชื่อ: โทนจาก sunset/);
  await expect(windowOf(page).getByText('ทุกบรรทัดอ่านได้')).toBeVisible();
  expect(Number(await draftTemperature(page).inputValue())).toBeGreaterThan(0);

  await windowOf(page).getByRole('button', { name: 'ปิด' }).click();
  await expect(mainTemperature(page)).toHaveValue(before);
  await expect(page.getByRole('button', { name: 'ย้อน' })).toBeDisabled();

  await openWindow(page);
  await expect(draftText(page)).toHaveValue(/ชื่อ: โทนจาก sunset/);
});

test('sliders and text stay in step in the draft', async ({ page }) => {
  await measured(page);
  await draftTemperature(page).fill('-25');
  await expect(draftText(page)).toHaveValue(/อุณหภูมิสี:.*\(-25\)/);

  const text = await draftText(page).inputValue();
  await draftText(page).fill(text.replace('(-25)', '(+33)'));
  await expect(draftTemperature(page)).toHaveValue('33');

  await draftText(page).fill(`หัวข้อผิด: มาก\n${text}`);
  await expect(windowOf(page).getByRole('list')).toContainText('บรรทัด 1');
  await expect(draftTemperature(page)).toHaveValue('-25');
});

test('saving keeps the edits, adds the prompt and can be undone', async ({ page }) => {
  const before = await measured(page);
  await draftTemperature(page).fill('37');
  await windowOf(page).getByRole('button', { name: 'บันทึกเข้าคลัง' }).click();

  await expect(page.getByText(SAVED)).toBeVisible();
  await expect(windowOf(page)).toBeHidden();
  await expect(mainTemperature(page)).toHaveValue('37');
  await expect(page.locator('.panel-library')).toContainText('โทนจาก sunset');

  await page.getByRole('button', { name: 'ย้อน' }).click();
  await expect(mainTemperature(page)).toHaveValue(before);
});

test('a prompt needs a name before it is saved', async ({ page }) => {
  await measured(page);
  await windowOf(page).getByLabel('ชื่อพร้อมต์').fill(' ');
  await expect(windowOf(page).getByRole('button', { name: 'บันทึกเข้าคลัง' })).toBeDisabled();
});

test('dropping a file on the window does not replace the photo', async ({ page }) => {
  await ready(page);
  const { buffer, name, mimeType } = await warmReference(page);
  const transfer = await page.evaluateHandle(
    ({ bytes, name, mimeType }) => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(bytes)], name, { type: mimeType }));
      return data;
    },
    { bytes: [...buffer], name, mimeType },
  );
  await openWindow(page);
  await windowOf(page).dispatchEvent('drop', { dataTransfer: transfer });
  await expect(draftText(page)).toBeVisible();
  await expect(page.getByTestId('stage-info')).toContainText('synthetic-ramps.png');
});

test('a file that is not an image is refused in the window', async ({ page }) => {
  await ready(page);
  await openWindow(page);
  await referenceInput(page).setInputFiles({
    name: 'note.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });
  await expect(windowOf(page).getByRole('alert')).toContainText('ไฟล์นี้ไม่ใช่ภาพ');
  await expect(draftText(page)).toHaveCount(0);
});

test('the window fits a phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(page.getByTestId('stage-info')).not.toBeEmpty();
  await openWindow(page);
  await referenceInput(page).setInputFiles(await warmReference(page));
  await expect(draftText(page)).toBeVisible();
  const overflow = await windowOf(page).evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('nothing leaves the page, and the policy allows the worker and the preview', async ({
  page,
  baseURL,
}) => {
  const csp = /`(default-src 'self';[^`]+)`/.exec(
    readFileSync('docs/11-security-privacy.md', 'utf8'),
  )![1]!;
  const outside: string[] = [];
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text());
  });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (/^https?:/.test(url) && !url.startsWith(new URL(baseURL!).origin)) outside.push(url);
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });

  await measured(page);
  const image = page.getByRole('img', { name: 'ภาพอ้างอิง sunset.png' });
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty('complete', true);
  expect(outside).toEqual([]);
  expect(violations).toEqual([]);
});
