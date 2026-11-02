import { describe, expect, test } from 'vitest';
import { findExifSegment, insertExif, sanitizeExif } from './exif';
import { buildExif, exifTags } from '../../../../tests/e2e/support/exifFixture';

const SECRET = 'SECRET-LOCATION!';
const contains = (bytes: Uint8Array, text: string) =>
  Buffer.from(bytes).includes(Buffer.from(text, 'latin1'));

/** SOI, a minimal JFIF header, an optional segment, and end of image. */
function jpegWith(segment: Uint8Array | null): Uint8Array {
  const jfif = [0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46];
  return Uint8Array.from([0xff, 0xd8, ...jfif, ...(segment ?? []), 0xff, 0xda, 0, 2, 0xff, 0xd9]);
}

describe.each([
  ['little-endian', true],
  ['big-endian', false],
])('%s EXIF', (_name, little) => {
  const exif = buildExif({ little, orientation: 6, gpsText: SECRET, thumbnail: 'THUMBNAIL-BYTES' });

  test('finds the segment in a JPEG', () => {
    expect(findExifSegment(jpegWith(exif))).toEqual(exif);
  });

  test('sets the orientation to normal', () => {
    expect(exifTags(sanitizeExif(exif, { stripGps: false })!).orientation).toBe(1);
  });

  test('erases the location from the bytes, and keeps other tags', () => {
    expect(contains(exif, SECRET)).toBe(true);
    const clean = sanitizeExif(exif, { stripGps: true })!;
    expect(contains(clean, SECRET)).toBe(false);
    const tags = exifTags(clean);
    expect(tags.hasGps).toBe(false);
    expect(tags.make).toBe('CAMERA');
  });

  test('keeps the location when asked to', () => {
    const kept = sanitizeExif(exif, { stripGps: false })!;
    expect(contains(kept, SECRET)).toBe(true);
    expect(exifTags(kept).hasGps).toBe(true);
  });

  test('drops the thumbnail, which shows the ungraded picture', () => {
    expect(contains(exif, 'THUMBNAIL-BYTES')).toBe(true);
    expect(contains(sanitizeExif(exif, { stripGps: false })!, 'THUMBNAIL-BYTES')).toBe(false);
  });

  test('does not change the original bytes', () => {
    const before = exif.slice();
    sanitizeExif(exif, { stripGps: true });
    expect(exif).toEqual(before);
  });
});

describe('malformed input', () => {
  test('a JPEG with no EXIF has no segment', () => {
    expect(findExifSegment(jpegWith(null))).toBeNull();
  });

  test('other files have no segment', () => {
    expect(findExifSegment(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(findExifSegment(new Uint8Array())).toBeNull();
  });

  test('a truncated or corrupt segment gives null, never an exception', () => {
    const exif = buildExif({ little: true, orientation: 6, gpsText: SECRET });
    expect(sanitizeExif(exif.slice(0, 20), { stripGps: true })).toBeNull();
    expect(sanitizeExif(new Uint8Array(4), { stripGps: true })).toBeNull();
  });

  test('random corruption never throws, and never leaves a broken export', () => {
    const exif = buildExif({ little: true, orientation: 6, gpsText: SECRET, thumbnail: 'THUMB' });
    let seed = 99;
    const rnd = (n: number) => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) % n;
    for (let run = 0; run < 2000; run++) {
      const bytes = exif.slice();
      for (let i = 0; i < 6; i++) bytes[rnd(bytes.length)] = rnd(256);
      expect(() => sanitizeExif(bytes, { stripGps: true })).not.toThrow();
      expect(() => findExifSegment(jpegWith(bytes))).not.toThrow();
    }
  });
});

describe('insertExif', () => {
  const exif = buildExif({ little: true, orientation: 1 });

  test('goes after the JFIF header', () => {
    const jpeg = jpegWith(null);
    const out = insertExif(jpeg, exif);
    expect(out.length).toBe(jpeg.length + exif.length);
    expect(findExifSegment(out)).toEqual(exif);
  });

  test('works without a JFIF header', () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    expect(findExifSegment(insertExif(jpeg, exif))).toEqual(exif);
  });

  test('leaves anything that is not a JPEG alone', () => {
    const png = new Uint8Array([0x89, 0x50]);
    expect(insertExif(png, exif)).toBe(png);
  });
});
