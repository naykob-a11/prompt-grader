import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('stage-info')).not.toBeEmpty();
}

async function expectNoViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    where: v.nodes.slice(0, 3).map((node) => node.target.join(' ')),
    why: v.nodes[0]?.failureSummary?.slice(0, 200),
  }));
  expect(summary, label).toEqual([]);
}

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [360, 1440]) {
    test.describe(`${colorScheme} at ${width} px`, () => {
      test.use({ colorScheme, viewport: { width, height: 800 } });
      const narrow = width < 820;

      test('the editor has no accessibility violations', async ({ page }) => {
        await ready(page);
        await expectNoViolations(page, 'library');
        const tab = narrow ? 'ปรับ' : 'แถบเลื่อน';
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await expectNoViolations(page, 'sliders');
      });

      test('the prompt panel has no accessibility violations', async ({ page }) => {
        await ready(page);
        await page.getByRole('tab', { name: 'พร้อมต์', exact: true }).click();
        const editor = page.getByRole('textbox', { name: 'ข้อความพร้อมต์' });
        await editor.click();
        await page.keyboard.press('Control+Home');
        await page.keyboard.insertText('หัวข้อผิด: มาก\n');
        await expect(page.getByText('1 บรรทัดที่อ่านไม่ได้')).toBeVisible();
        await expectNoViolations(page, 'prompt panel');
      });

      test('the dialogs have no accessibility violations', async ({ page }) => {
        await ready(page);
        await page.getByRole('button', { name: 'ส่งออก', exact: true }).click();
        await expectNoViolations(page, 'export dialog');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'ทางลัด' }).click();
        await expectNoViolations(page, 'shortcuts dialog');
      });
    });
  }
}

test('every action can be reached with the keyboard alone', async ({ page }) => {
  await ready(page);
  const reached = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.getAttribute('aria-label') ?? el?.innerText?.trim().split('\n')[0] ?? '';
    });
    reached.add(label);
  }
  for (const name of ['เปิดภาพ', 'ส่งออก', 'ล้างค่าเป็นกลาง', 'ทางลัด', 'เส้นแบ่งก่อนและหลัง']) {
    expect([...reached], name).toContain(name);
  }
});

test('focus is clearly visible', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline).toEqual({ style: 'solid', width: '2px' });
});

test('sliders work from the keyboard and speak their value', async ({ page }) => {
  await ready(page);
  const slider = page.getByRole('slider', { name: 'ความสว่าง (EV)' });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'บวก 1');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'บวก 11');
});

test('Escape closes a dialog and focus returns to its button', async ({ page }) => {
  await ready(page);
  const button = page.getByRole('button', { name: 'ทางลัด' });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'ทางลัดคีย์บอร์ด' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'ทางลัดคีย์บอร์ด' })).toBeHidden();
  await expect(button).toBeFocused();
});

test('phones show that work is unsaved from any tab', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await ready(page);
  await page.getByRole('tab', { name: 'ปรับ', exact: true }).click();
  await page.getByRole('slider', { name: 'ความสว่าง (EV)' }).fill('10');
  await expect(page.getByRole('tab', { name: /มีค่าที่ยังไม่บันทึก/ })).toBeVisible();
});
