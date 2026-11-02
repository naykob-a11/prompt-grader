import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/images/synthetic-ramps.png';
const referenceInput = (page: Page) => page.getByTestId('reference-input');
const temperature = (page: Page) => page.getByRole('slider', { name: 'อุณหภูมิสี (เย็น ↔ อุ่น)' });

/** A warm, dim copy of a gradient, made in the page so the test needs no extra file. */
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

async function ready(page: Page) {
  await page.goto('/');
  await page.locator('.topbar input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByTestId('stage-info')).toContainText('synthetic-ramps.png');
}

test('a reference image becomes a prompt, and one undo takes it back', async ({ page }) => {
  await ready(page);
  await page.getByRole('tab', { name: 'แถบเลื่อน', exact: true }).click();
  const before = await temperature(page).inputValue();

  await referenceInput(page).setInputFiles(await warmReference(page));
  await expect(page.getByText('สร้างพร้อมต์จากโทนของ sunset แล้ว')).toBeVisible();
  await expect(page.getByRole('img', { name: 'ภาพอ้างอิง sunset.png' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เปลี่ยนภาพอ้างอิง' })).toBeVisible();
  await expect(page.getByTestId('stage-info')).toContainText('synthetic-ramps.png');
  await expect(temperature(page)).not.toHaveValue(before);
  expect(Number(await temperature(page).inputValue())).toBeGreaterThan(0);

  await page.getByRole('tab', { name: 'พร้อมต์', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'ข้อความพร้อมต์' });
  await expect(editor).toContainText('ชื่อ: โทนจาก sunset');
  await expect(editor).toContainText('ภาพอ้างอิง');
  await expect(page.getByText('ทุกบรรทัดอ่านได้')).toBeVisible();

  await page.getByRole('button', { name: 'ย้อน' }).click();
  await page.getByRole('tab', { name: 'แถบเลื่อน', exact: true }).click();
  await expect(temperature(page)).toHaveValue(before);
});

test('the new prompt can be saved to the library', async ({ page }) => {
  await ready(page);
  await referenceInput(page).setInputFiles(await warmReference(page));
  await expect(page.getByText('สร้างพร้อมต์จากโทนของ sunset แล้ว')).toBeVisible();
  await page.getByRole('button', { name: '+ พร้อมต์ใหม่' }).click();
  await expect(page.getByLabel('ชื่อพร้อมต์')).toHaveValue('โทนจาก sunset');
  await page.getByRole('button', { name: 'บันทึกเป็นพร้อมต์ใหม่' }).click();
  await expect(
    page.getByRole('list', { name: 'พร้อมต์ของฉัน' }).getByText('โทนจาก sunset', { exact: true }),
  ).toBeVisible();
});

test('dropping a file on the section does not replace the photo', async ({ page }) => {
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
  await page.locator('.reference-tone').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByText('สร้างพร้อมต์จากโทนของ sunset แล้ว')).toBeVisible();
  await expect(page.getByTestId('stage-info')).toContainText('synthetic-ramps.png');
});

test('a file that is not an image is refused and changes nothing', async ({ page }) => {
  await ready(page);
  await page.getByRole('tab', { name: 'แถบเลื่อน', exact: true }).click();
  const before = await temperature(page).inputValue();
  await referenceInput(page).setInputFiles({
    name: 'note.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByText('ไฟล์นี้ไม่ใช่ภาพ')).toBeVisible();
  await expect(temperature(page)).toHaveValue(before);
  await expect(page.getByRole('img', { name: /ภาพอ้างอิง/ })).toHaveCount(0);
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

  await ready(page);
  await referenceInput(page).setInputFiles(await warmReference(page));
  await expect(page.getByRole('img', { name: 'ภาพอ้างอิง sunset.png' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'ภาพอ้างอิง sunset.png' })).toHaveJSProperty(
    'complete',
    true,
  );
  expect(outside).toEqual([]);
  expect(violations).toEqual([]);
});
