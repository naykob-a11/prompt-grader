import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { findExifSegment, insertExif } from '../../apps/web/src/services/exif';
import { buildExif, exifTags } from './support/exifFixture';

const FIXTURE = 'tests/fixtures/images/synthetic-ramps.png';
const GOLDEN_B1 = 'tests/golden/b1__synthetic-ramps.png';

const imageInput = (page: Page) => page.locator('.topbar input[type=file]');
const info = (page: Page) => page.getByTestId('stage-info');
const exportNow = (page: Page) =>
  page.getByRole('button', { name: 'ส่งออกภาพความละเอียดเต็ม' }).click();

async function openFixture(page: Page) {
  await page.goto('/');
  await imageInput(page).setInputFiles(FIXTURE);
  await expect(info(page)).toContainText('synthetic-ramps.png');
}

async function exportedBytes(page: Page) {
  const [download] = await Promise.all([page.waitForEvent('download'), exportNow(page)]);
  return { name: download.suggestedFilename(), bytes: readFileSync(await download.path()) };
}

async function choosePng(page: Page) {
  await page.getByRole('button', { name: 'ส่งออก', exact: true }).click();
  await page.getByRole('radio', { name: 'PNG' }).check();
}

function maxDifference(a: PNG, b: PNG) {
  expect([a.width, a.height]).toEqual([b.width, b.height]);
  let max = 0;
  for (let i = 0; i < a.data.length; i++) max = Math.max(max, Math.abs(a.data[i]! - b.data[i]!));
  return max;
}

/** Width and height from the start-of-frame marker of a JPEG. */
function jpegSize(bytes: Buffer) {
  let at = 2;
  while (at < bytes.length) {
    const marker = bytes[at + 1]!;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
    }
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  throw new Error('no frame header');
}

/** Drops a generated picture on the app, without passing megabytes through the test. */
async function dropGenerated(page: Page, width: number, height: number) {
  const transfer = await page.evaluateHandle(
    async ([w, h]) => {
      const canvas = new OffscreenCanvas(w!, h!);
      const context = canvas.getContext('2d')!;
      const gradient = context.createLinearGradient(0, 0, w!, h!);
      gradient.addColorStop(0, '#203040');
      gradient.addColorStop(0.5, '#80a060');
      gradient.addColorStop(1, '#e0c090');
      context.fillStyle = gradient;
      context.fillRect(0, 0, w!, h!);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
      const data = new DataTransfer();
      data.items.add(new File([blob], 'huge.jpg', { type: 'image/jpeg' }));
      return data;
    },
    [width, height],
  );
  await page.dispatchEvent('body', 'drop', { dataTransfer: transfer });
  await expect(info(page)).toContainText('huge.jpg', { timeout: 60_000 });
}

test('neutral values export the exact pixels of the original', async ({ page }) => {
  await openFixture(page);
  await page.getByRole('button', { name: 'ล้างค่าเป็นกลาง' }).click();
  await choosePng(page);
  const { bytes } = await exportedBytes(page);
  expect(maxDifference(PNG.sync.read(bytes), PNG.sync.read(readFileSync(FIXTURE)))).toBe(0);
});

test('the export matches the CPU reference, and keeps the size and a useful name', async ({
  page,
}) => {
  await openFixture(page);
  await choosePng(page);
  const { name, bytes } = await exportedBytes(page);
  expect(name).toBe('synthetic-ramps_ทุ่งเขียว Cinematic.png');
  expect(maxDifference(PNG.sync.read(bytes), PNG.sync.read(readFileSync(GOLDEN_B1)))).toBeLessThan(
    3,
  );
});

test('without WebGL2, the worker exports the same pixels as the reference', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      return args[0] === 'webgl2' ? null : original.apply(this, args);
    } as typeof original;
  });
  await openFixture(page);
  await choosePng(page);
  const { bytes } = await exportedBytes(page);
  expect(maxDifference(PNG.sync.read(bytes), PNG.sync.read(readFileSync(GOLDEN_B1)))).toBe(0);
});

test('JPEG and WebP use their own format and extension', async ({ page }) => {
  await openFixture(page);
  await page.keyboard.press('Control+e');
  const jpeg = await exportedBytes(page);
  expect(jpeg.name.endsWith('.jpg')).toBe(true);
  expect(jpegSize(jpeg.bytes)).toEqual({ width: 512, height: 256 });

  await page.keyboard.press('Control+e');
  await page.getByRole('radio', { name: 'WebP' }).check();
  const webp = await exportedBytes(page);
  expect(webp.name.endsWith('.webp')).toBe(true);
  expect(webp.bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
});

test('the sample image exports too', async ({ page }) => {
  await page.goto('/');
  await expect(info(page)).toContainText('ภาพตัวอย่าง');
  await page.keyboard.press('Control+e');
  const { bytes } = await exportedBytes(page);
  expect(jpegSize(bytes)).toEqual({ width: 960, height: 640 });
});

test.describe('EXIF', () => {
  const SECRET = 'LATITUDE-13.7563';

  /** A rotated 3 x 2 JPEG whose EXIF holds a camera name, a location and a thumbnail. */
  async function rotatedJpeg(page: Page) {
    const base64 = await page.evaluate(async () => {
      const canvas = new OffscreenCanvas(3, 2);
      canvas.getContext('2d')!.fillRect(0, 0, 3, 2);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg' });
      return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
    });
    const exif = buildExif({
      little: true,
      orientation: 6,
      gpsText: SECRET,
      thumbnail: 'OLD-THUMB',
    });
    return Buffer.from(insertExif(Buffer.from(base64, 'base64'), exif));
  }

  async function openRotated(page: Page) {
    await page.goto('/');
    await imageInput(page).setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: await rotatedJpeg(page),
    });
    await expect(info(page)).toContainText('photo.jpg · 2 × 3 px');
  }

  test('rotates the picture, and removes the location by default', async ({ page }) => {
    await openRotated(page);
    await page.keyboard.press('Control+e');
    const { bytes } = await exportedBytes(page);

    expect(jpegSize(bytes)).toEqual({ width: 2, height: 3 });
    const segment = findExifSegment(bytes)!;
    expect(exifTags(segment)).toEqual({ orientation: 1, hasGps: false, make: 'CAMERA' });
    expect(bytes.includes(SECRET)).toBe(false);
    expect(bytes.includes('OLD-THUMB')).toBe(false);
  });

  test('keeps the location only when asked', async ({ page }) => {
    await openRotated(page);
    await page.keyboard.press('Control+e');
    await page.getByRole('checkbox', { name: 'ตัดพิกัด GPS ออก' }).uncheck();
    const { bytes } = await exportedBytes(page);
    expect(bytes.includes(SECRET)).toBe(true);
  });

  test('can leave out EXIF altogether', async ({ page }) => {
    await openRotated(page);
    await page.keyboard.press('Control+e');
    await page.getByRole('checkbox', { name: 'คงข้อมูล EXIF ของกล้องไว้' }).uncheck();
    const { bytes } = await exportedBytes(page);
    expect(findExifSegment(bytes)).toBeNull();
    expect(bytes.includes(SECRET)).toBe(false);
  });
});

test('export choices are remembered', async ({ page }) => {
  await openFixture(page);
  await choosePng(page);
  await page.waitForTimeout(100);
  await page.reload();
  await expect(info(page)).not.toBeEmpty();
  await page.keyboard.press('Control+e');
  await expect(page.getByRole('radio', { name: 'PNG' })).toBeChecked();
});

test('a 48 MP image exports at full size without crashing', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  await dropGenerated(page, 8000, 6000);
  // A preset with sharpening, so the detail pass runs across the tile seams at full size.
  await page.getByRole('button', { name: /^พอร์ตเทรตเด็กสดใส/ }).click();
  await page.keyboard.press('Control+e');
  await expect(page.getByRole('progressbar')).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download', { timeout: 280_000 });
  const started = Date.now();
  await exportNow(page);
  await expect(page.getByRole('progressbar')).toBeVisible();
  const download = await downloadPromise;
  console.log(`48 MP export: ${((Date.now() - started) / 1000).toFixed(1)} s`);
  expect(jpegSize(readFileSync(await download.path()))).toEqual({ width: 8000, height: 6000 });
});

test('cancel stops the export and downloads nothing', async ({ page }) => {
  test.setTimeout(120_000);
  // Holds each tile back, so the export is certain to be running when Cancel is pressed.
  await page.addInitScript(() => {
    const prototype = OffscreenCanvasRenderingContext2D.prototype;
    const original = prototype.putImageData;
    prototype.putImageData = function (
      this: OffscreenCanvasRenderingContext2D,
      ...args: Parameters<typeof original>
    ) {
      const until = performance.now() + 400;
      while (performance.now() < until);
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/');
  await dropGenerated(page, 6000, 4000);
  let downloaded = false;
  page.on('download', () => (downloaded = true));

  await page.keyboard.press('Control+e');
  await exportNow(page);
  await expect(page.getByRole('progressbar')).toBeVisible();
  await page.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(page.getByRole('button', { name: 'ส่งออกภาพความละเอียดเต็ม' })).toBeVisible({
    timeout: 60_000,
  });
  await page.waitForTimeout(500);
  expect(downloaded).toBe(false);
});
