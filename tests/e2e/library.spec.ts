import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FIXTURES = 'tests/fixtures/library';
const mine = (page: Page) => page.getByRole('list', { name: 'พร้อมต์ของฉัน' });
const promptButton = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name}`) });
const importFile = (page: Page) => page.locator('input[accept*="json"]');
const toast = (page: Page) => page.locator('.toast');

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('stage-info')).not.toBeEmpty();
}

async function saveNew(page: Page, name: string) {
  await page.getByRole('button', { name: '+ พร้อมต์ใหม่' }).click();
  await page.getByLabel('ชื่อพร้อมต์').fill(name);
  await page.getByRole('button', { name: 'บันทึกเป็นพร้อมต์ใหม่' }).click();
  await expect(promptButton(page, name)).toBeVisible();
}

test('a saved prompt is still there after a reload, with its values', async ({ page }) => {
  await ready(page);
  await page.getByLabel('ความสว่าง (EV)').fill('42');
  await page.getByLabel('ความสว่าง (EV)').dispatchEvent('pointerup');
  await saveNew(page, 'เช้าวันใหม่');

  await page.reload();
  await expect(promptButton(page, 'เช้าวันใหม่')).toBeVisible();
  await expect(promptButton(page, 'เช้าวันใหม่')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('ความสว่าง (EV)')).toHaveValue('42');
});

test('choosing a saved prompt restores its values', async ({ page }) => {
  await ready(page);
  await page.getByLabel('ความสว่าง (EV)').fill('42');
  await saveNew(page, 'สว่าง');
  await promptButton(page, 'Teal & Orange').click();
  await expect(page.getByLabel('ความสว่าง (EV)')).toHaveValue('0');
  await promptButton(page, 'สว่าง').click();
  await expect(page.getByLabel('ความสว่าง (EV)')).toHaveValue('42');
});

test('duplicate, rename, and delete with a confirmation in the row', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'ทำสำเนา Teal & Orange' }).click();
  await expect(mine(page).getByRole('button', { name: /^Teal & Orange/ })).toBeVisible();

  await page.getByRole('button', { name: 'เปลี่ยนชื่อ Teal & Orange' }).click();
  await page.getByRole('textbox', { name: 'เปลี่ยนชื่อ Teal & Orange' }).fill('ส้มฟ้า');
  await page.keyboard.press('Enter');
  await expect(promptButton(page, 'ส้มฟ้า')).toBeVisible();

  await page.getByRole('button', { name: 'ลบ ส้มฟ้า' }).click();
  await page.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(promptButton(page, 'ส้มฟ้า')).toBeVisible();

  await page.getByRole('button', { name: 'ลบ ส้มฟ้า' }).click();
  await page.getByRole('button', { name: 'ลบเลย' }).click();
  await expect(promptButton(page, 'ส้มฟ้า')).toHaveCount(0);
  await page.reload();
  await expect(promptButton(page, 'ส้มฟ้า')).toHaveCount(0);
});

test('built-in presets cannot be renamed or deleted', async ({ page }) => {
  await ready(page);
  await expect(page.getByRole('button', { name: 'ลบ Teal & Orange' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'เปลี่ยนชื่อ Teal & Orange' })).toHaveCount(0);
});

test('search and tags narrow the list', async ({ page }) => {
  await ready(page);
  await page.getByRole('searchbox', { name: 'ค้นหาพร้อมต์' }).fill('analog film');
  await expect(promptButton(page, 'ฟิล์มอุ่นวินเทจ')).toBeVisible();
  await expect(promptButton(page, 'Teal & Orange')).toHaveCount(0);

  await page.getByRole('searchbox', { name: 'ค้นหาพร้อมต์' }).fill('ไม่มีคำนี้แน่นอน');
  await expect(page.getByText('ไม่พบพร้อมต์ที่ตรงกับการค้นหา')).toBeVisible();

  await page.getByRole('searchbox', { name: 'ค้นหาพร้อมต์' }).fill('');
  await page.getByRole('button', { name: 'ขาวดำ', exact: true }).click();
  await expect(promptButton(page, 'ขาวดำคอนทราสต์สูง')).toBeVisible();
  await expect(promptButton(page, 'Teal & Orange')).toHaveCount(0);
});

test('unsaved changes are flagged, and Ctrl+S saves over the current prompt', async ({ page }) => {
  await ready(page);
  await expect(page.getByText('มีค่าที่ยังไม่บันทึก')).toHaveCount(0);
  await saveNew(page, 'ของฉัน');

  await page.getByRole('slider', { name: 'คอนทราสต์' }).fill('33');
  await expect(page.getByText('มีค่าที่ยังไม่บันทึก')).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(page.getByText('บันทึกพร้อมต์แล้ว')).toBeVisible();
  await expect(page.getByText('มีค่าที่ยังไม่บันทึก')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('slider', { name: 'คอนทราสต์' })).toHaveValue('33');
});

test('Ctrl+S on a built-in asks for a name instead of overwriting it', async ({ page }) => {
  await ready(page);
  await page.getByRole('slider', { name: 'คอนทราสต์' }).fill('33');
  await page.keyboard.press('Control+s');
  await expect(page.getByLabel('ชื่อพร้อมต์')).toBeVisible();
});

test('the compare mode is remembered', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'หลังปรับ' }).click();
  await expect(page.getByRole('button', { name: 'หลังปรับ' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.waitForTimeout(100);
  await page.reload();
  await expect(page.getByRole('button', { name: 'หลังปรับ' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('imports the sample library and the prototype format, without replacing names', async ({
  page,
}) => {
  await ready(page);
  await importFile(page).setInputFiles(`${FIXTURES}/sample-library.json`);
  await expect(toast(page)).toContainText('นำเข้า 2 พร้อมต์ ข้าม 0 รายการ');
  await expect(promptButton(page, 'เช้าสดใส')).toBeVisible();

  await importFile(page).setInputFiles(`${FIXTURES}/kreadsi-prompts.json`);
  await expect(toast(page).last()).toContainText('นำเข้า 1 พร้อมต์ ข้าม 1 รายการ');
  await expect(promptButton(page, 'ทุ่งนาเก่า')).toBeVisible();

  await importFile(page).setInputFiles(`${FIXTURES}/sample-library.json`);
  await expect(promptButton(page, 'เช้าสดใส \\(2\\)')).toBeVisible();

  await page.reload();
  await expect(promptButton(page, 'ทุ่งนาเก่า')).toBeVisible();
});

test('a file that is not a library gives a helpful message', async ({ page }) => {
  await ready(page);
  await importFile(page).setInputFiles({
    name: 'other.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  });
  await expect(toast(page)).toContainText('ไฟล์นี้ไม่ใช่คลังพร้อมต์');
});

test('export downloads a file that imports back', async ({ page }) => {
  await ready(page);
  await saveNew(page, 'สำรอง');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'ส่งออกคลัง' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^prompt-library-\d{4}-\d{2}-\d{2}\.json$/);
  const saved = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(saved.format).toBe('prompt-grader/library');
  expect(saved.prompts[0].name).toBe('สำรอง');

  await page.getByRole('button', { name: 'ลบ สำรอง' }).click();
  await page.getByRole('button', { name: 'ลบเลย' }).click();
  await importFile(page).setInputFiles(await download.path());
  await expect(promptButton(page, 'สำรอง')).toBeVisible();
});
