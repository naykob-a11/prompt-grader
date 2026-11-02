import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const SEED = 'seed/structured-prompts';
const presets = JSON.parse(readFileSync('seed/builtin-presets.json', 'utf8')).presets as {
  name: string;
  params: Record<string, number>;
}[];

const openPromptTab = (page: Page) =>
  page.getByRole('tab', { name: 'พร้อมต์', exact: true }).click();
const openSlidersTab = (page: Page) => page.getByRole('tab', { name: 'แถบเลื่อน' }).click();
const editor = (page: Page) => page.getByRole('textbox', { name: 'ข้อความพร้อมต์' });
const attachInput = (page: Page) => page.locator('input[accept*=".txt"]');
const after = (page: Page) => page.getByTestId('stage-after');

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('stage-info')).not.toBeEmpty();
  await openPromptTab(page);
  await expect(editor(page)).toBeVisible();
}

async function setText(page: Page, text: string) {
  await editor(page).click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(text);
}

async function sliderValue(page: Page, label: string) {
  await openSlidersTab(page);
  const value = await page.getByRole('slider', { name: label, exact: true }).inputValue();
  await openPromptTab(page);
  return value;
}

test('typing updates the sliders after a pause', async ({ page }) => {
  await ready(page);
  await setText(page, 'ความสว่าง: สว่างขึ้น (+42)');
  await expect(page.getByText('ทุกบรรทัดอ่านได้')).toBeVisible();
  await page.waitForTimeout(250);
  expect(await sliderValue(page, 'ความสว่าง (EV)')).toBe('42');
});

test('warnings show their line, suggest a heading, and jump to the line', async ({ page }) => {
  await ready(page);
  await setText(page, 'ความสว่าง: 10\nความสวาง: 20\nไม่มีโคลอน');
  await expect(page.getByText('2 บรรทัดที่อ่านไม่ได้')).toBeVisible();
  await expect(page.getByText('หมายถึง “ความสว่าง” หรือเปล่า')).toBeVisible();
  await expect(page.locator('.cm-lintRange-warning')).toHaveCount(2);
  await page.getByRole('button', { name: /ไม่มีเครื่องหมาย/ }).click();
  await expect(editor(page)).toBeFocused();
  await page.keyboard.insertText('แทนแล้ว: 1');
  await expect(editor(page)).not.toContainText('ไม่มีโคลอน');
});

test('autocomplete offers headings, then levels', async ({ page }) => {
  await ready(page);
  await setText(page, '');
  await page.keyboard.type('ความสว');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('ความสว่าง');
  await page.waitForTimeout(150); // the popup ignores Enter for its first moments
  await page.keyboard.press('Enter');
  await expect(editor(page)).toContainText('ความสว่าง:');
  await page.keyboard.type('เล็ก');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('เล็กน้อย');
});

test('long text scrolls inside its box, keeping the toolbar on screen', async ({ page }) => {
  await ready(page);
  await setText(page, Array.from({ length: 200 }, (_, i) => `เงา: ${i}`).join('\n'));
  await expect(page.getByRole('button', { name: 'แทรกแม่แบบ' })).toBeInViewport();
  const box = (await page.locator('.prompt-editor').boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

test('Ctrl+Enter reads the prompt without waiting', async ({ page }) => {
  await ready(page);
  await setText(page, 'ไม่มีโคลอน');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('1 บรรทัดที่อ่านไม่ได้')).toBeVisible({ timeout: 100 });
});

test('moving a slider rewrites the text and keeps the notes', async ({ page }) => {
  await ready(page);
  await setText(page, '# ชื่อ: ของฉัน\nเงา: ยก (+10)\n\n[หมายเหตุ]\nโน้ตของฉัน');
  await page.waitForTimeout(250);
  await openSlidersTab(page);
  const slider = page.getByRole('slider', { name: 'ความสว่าง (EV)' });
  await slider.fill('33');
  await slider.dispatchEvent('pointerup');
  await openPromptTab(page);
  const text = await editor(page).innerText();
  expect(text).toContain('# ชื่อ: ของฉัน');
  expect(text).toContain('(+33)');
  expect(text).toContain('(+10)');
  expect(text).toContain('โน้ตของฉัน');
  await expect(page.getByRole('heading', { name: 'หมายเหตุ' })).toBeVisible();
});

test('undo restores the text as well as the sliders', async ({ page }) => {
  await ready(page);
  await setText(page, 'เงา: ยก (+77)');
  await expect(page.getByRole('button', { name: 'ย้อน' })).toBeEnabled();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'ย้อน' }).click();
  await expect(editor(page)).not.toContainText('+77');
  await expect(editor(page)).toContainText('ทุ่งเขียว Cinematic');
});

test('choosing a preset shows its text and notes', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: /^พอร์ตเทรตเด็กสดใส/ }).click();
  await expect(editor(page)).toContainText('แก้สีเพี้ยน: มาก (70)');
  await expect(page.locator('.notes-panel')).toContainText('ทำไม่ได้ใน MVP');
});

test('a reply pasted from chat, with code fences, changes the preview', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'หลังปรับ' }).click();
  const before = await after(page).screenshot();
  await setText(
    page,
    '```text\n# ชื่อ: จากแชต\n# แท็ก: แชต\nความอิ่มสี: ขาวดำ (-100)\nเงา: ลึก ปานกลาง (−30)\n```',
  );
  await expect(page.getByText('ทุกบรรทัดอ่านได้')).toBeVisible();
  await page.waitForTimeout(350);
  expect((await after(page).screenshot()).equals(before)).toBe(false);
  expect(await sliderValue(page, 'เงา (ลบ = ลึกขึ้น)')).toBe('-30');
});

test('every seed file attaches with no warnings and matches its preset', async ({ page }) => {
  await ready(page);
  const files = readdirSync(SEED);
  expect(files).toHaveLength(6);
  for (const file of files) {
    await attachInput(page).setInputFiles(`${SEED}/${file}`);
    await expect(page.getByText('ทุกบรรทัดอ่านได้')).toBeVisible();
    const name = /# ชื่อ: (.+)/.exec(readFileSync(`${SEED}/${file}`, 'utf8'))![1]!.trim();
    await expect(editor(page)).toContainText(name);
    const preset = presets.find((p) => p.name === name)!;

    await openSlidersTab(page);
    await page.evaluate(() => {
      for (const details of document.querySelectorAll('details')) details.open = true;
    });
    const values = await page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll<HTMLInputElement>('input[id^=param-]')].map((input) => [
          input.id.replace('param-', ''),
          Number(input.value),
        ]),
      ),
    );
    expect(values, file).toEqual(preset.params);
    await openPromptTab(page);
  }
});

test('attaching several files imports them into the library', async ({ page }) => {
  await ready(page);
  await attachInput(page).setInputFiles([
    `${SEED}/teal-orange.sgp.txt`,
    `${SEED}/bw-high-contrast.sgp.txt`,
  ]);
  await expect(page.locator('.toast')).toContainText('นำเข้า 2 พร้อมต์');
  const mine = page.getByRole('list', { name: 'พร้อมต์ของฉัน' });
  await expect(mine.getByRole('button', { name: /^Teal & Orange/ })).toBeVisible();
  await page.reload();
  await expect(mine.getByRole('button', { name: /^ขาวดำคอนทราสต์สูง/ })).toBeVisible();
});

test('a dropped prompt file opens in the editor', async ({ page }) => {
  await ready(page);
  const text = readFileSync(`${SEED}/teal-orange.sgp.txt`, 'utf8');
  const transfer = await page.evaluateHandle((content) => {
    const data = new DataTransfer();
    data.items.add(new File([content], 'teal.sgp.txt', { type: 'text/plain' }));
    return data;
  }, text);
  await page.dispatchEvent('body', 'drop', { dataTransfer: transfer });
  await expect(editor(page)).toContainText('Teal & Orange');
});

test('bad files give a helpful message', async ({ page }) => {
  await ready(page);
  await attachInput(page).setInputFiles({
    name: 'binary.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from([0xff, 0xfe, 0x00, 0x80]),
  });
  await expect(page.locator('.toast')).toContainText('ไม่ใช่ข้อความ UTF-8');
  await attachInput(page).setInputFiles({
    name: 'big.txt',
    mimeType: 'text/plain',
    buffer: Buffer.alloc(70_000, 'a'),
  });
  await expect(page.locator('.toast').last()).toContainText('ใหญ่เกิน 64 KB');
});

test('the template asks first, then reads as neutral', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'แทรกแม่แบบ' }).click();
  await page.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(editor(page)).toContainText('ทุ่งเขียว Cinematic');

  await page.getByRole('button', { name: 'แทรกแม่แบบ' }).click();
  await page.getByRole('button', { name: 'แทนข้อความ' }).click();
  await expect(editor(page)).toContainText('ความเข้มรวม: ไม่ปรับ');
  await expect(page.getByText('ทุกบรรทัดอ่านได้')).toBeVisible();
  expect(await sliderValue(page, 'คอนทราสต์')).toBe('0');
});

test('saving keeps notes and tags typed in the prompt, and text survives', async ({ page }) => {
  await ready(page);
  await setText(page, '# ชื่อ: แชร์ได้\n# แท็ก: พิเศษ\nเงา: ยก (+15)\n[หมายเหตุ]\nจำไว้');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('มีค่าที่ยังไม่บันทึก')).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(page.getByLabel('ชื่อพร้อมต์')).toHaveValue('แชร์ได้');
  await page.getByRole('button', { name: 'บันทึกเป็นพร้อมต์ใหม่' }).click();
  await expect(page.getByText('มีค่าที่ยังไม่บันทึก')).toHaveCount(0);
  await page.waitForTimeout(100); // lets the last-prompt setting reach IndexedDB

  await page.reload();
  await expect(page.getByTestId('stage-info')).not.toBeEmpty();
  await openPromptTab(page);
  await expect(editor(page)).toContainText('# แท็ก: พิเศษ');
  await expect(page.getByText('จำไว้').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'พิเศษ', exact: true })).toBeVisible();
});

test('a note edit alone counts as unsaved', async ({ page }) => {
  await ready(page);
  await setText(page, '[หมายเหตุ]\nโน้ตใหม่');
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('มีค่าที่ยังไม่บันทึก')).toBeVisible();
});

test('the prompt exports as a file that reads back', async ({ page }) => {
  await ready(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /ส่งออกเป็นไฟล์พร้อมต์/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('ทุ่งเขียว Cinematic.sgp.txt');
  await attachInput(page).setInputFiles(await download.path());
  await expect(page.getByText('ทุกบรรทัดอ่านได้')).toBeVisible();
  await expect(editor(page)).toContainText('ใบไม้โทนทีล: มาก (60)');
});

test.describe('clipboard', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('copies the prompt as text', async ({ page }) => {
    await ready(page);
    await page.getByRole('button', { name: 'คัดลอกเป็นข้อความ' }).click();
    await expect(page.locator('.toast')).toContainText('คัดลอกพร้อมต์แล้ว');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('# ชื่อ: ทุ่งเขียว Cinematic');
  });

  test('the chat instruction carries the free text, and says no image is sent', async ({
    page,
  }) => {
    await ready(page);
    await page.getByRole('button', { name: 'ให้แชตช่วยเรียบเรียง' }).click();
    await expect(page.getByText('ไม่แนบภาพ')).toBeVisible();
    await page.getByLabel('พร้อมต์อิสระของคุณ').fill('warm sunset film');
    const shown = await page.getByLabel('ข้อความที่จะถูกคัดลอก').inputValue();
    expect(shown).toContain('warm sunset film');
    expect(shown).not.toContain('{{FREE_PROMPT}}');
    expect(shown.startsWith('<!--')).toBe(false);

    await page.getByRole('button', { name: 'คัดลอกคำสั่ง' }).click();
    await expect(page.getByText('คัดลอกแล้ว นำไปวางในแชต Claude ได้เลย')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.replace(/\r\n/g, '\n')).toBe(shown);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('the prompt tab works without sideways scrolling', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'พร้อมต์', exact: true }).click();
    await expect(editor(page)).toBeVisible();
    await editor(page).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test('using the prompt editor sends nothing off the origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/^(https?|wss?):$/.test(url.protocol) && url.origin !== origin) external.push(url.href);
  });
  await ready(page);
  await setText(page, 'เงา: ยก (+15)');
  await page.getByRole('button', { name: 'ให้แชตช่วยเรียบเรียง' }).click();
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
});
