// Builds and reads small EXIF segments, for tests of the EXIF copy.

interface ExifOptions {
  little: boolean;
  orientation: number;
  gpsText?: string;
  thumbnail?: string;
}

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

/** An APP1 segment holding IFD0 (make, orientation, GPS link) and optionally a thumbnail IFD. */
export function buildExif({ little, orientation, gpsText, thumbnail }: ExifOptions): Uint8Array {
  const tiff = new Uint8Array(512);
  const view = new DataView(tiff.buffer);
  const u16 = (at: number, v: number) => view.setUint16(at, v, little);
  const u32 = (at: number, v: number) => view.setUint32(at, v, little);
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    u16(at, tag);
    u16(at + 2, type);
    u32(at + 4, count);
    if (type === 3) u16(at + 8, value);
    else u32(at + 8, value);
  };

  tiff.set(little ? [0x49, 0x49] : [0x4d, 0x4d]);
  u16(2, 42);
  u32(4, 8);

  const IFD0 = 8;
  const MAKE = 200;
  const GPS_IFD = 240;
  const GPS_VALUE = 300;
  const IFD1 = 360;
  const THUMB = 420;
  const hasGps = gpsText !== undefined;

  // TIFF requires tags in ascending order.
  u16(IFD0, hasGps ? 3 : 2);
  entry(IFD0 + 2, 0x010f, 2, 7, MAKE);
  entry(IFD0 + 14, 0x0112, 3, 1, orientation);
  if (hasGps) entry(IFD0 + 26, 0x8825, 4, 1, GPS_IFD);
  u32(IFD0 + 2 + (hasGps ? 3 : 2) * 12, thumbnail ? IFD1 : 0);
  tiff.set(ascii('CAMERA\0'), MAKE);

  if (hasGps) {
    u16(GPS_IFD, 1);
    entry(GPS_IFD + 2, 0x0002, 2, gpsText.length, GPS_VALUE);
    tiff.set(ascii(gpsText), GPS_VALUE);
  }
  if (thumbnail) {
    u16(IFD1, 2);
    entry(IFD1 + 2, 0x0201, 4, 1, THUMB);
    entry(IFD1 + 14, 0x0202, 4, 1, thumbnail.length);
    tiff.set(ascii(thumbnail), THUMB);
  }

  const payload = 6 + tiff.length;
  return Uint8Array.from([
    0xff,
    0xe1,
    ((payload + 2) >> 8) & 0xff,
    (payload + 2) & 0xff,
    ...ascii('Exif\0\0'),
    ...tiff,
  ]);
}

/** Reads back what the tests care about from an APP1 segment. */
export function exifTags(segment: Uint8Array) {
  const view = new DataView(segment.buffer, segment.byteOffset + 10);
  const little = view.getUint16(0) === 0x4949;
  const ifd0 = view.getUint32(4, little);
  const tags = new Map<number, number>();
  for (let i = 0; i < view.getUint16(ifd0, little); i++) {
    const at = ifd0 + 2 + i * 12;
    const short = view.getUint16(at + 2, little) === 3;
    const value = short ? view.getUint16(at + 8, little) : view.getUint32(at + 8, little);
    tags.set(view.getUint16(at, little), value);
  }
  const makeAt = tags.get(0x010f);
  const make = makeAt
    ? String.fromCharCode(...segment.subarray(10 + makeAt, 10 + makeAt + 6))
    : undefined;
  return { orientation: tags.get(0x0112), hasGps: tags.has(0x8825), make };
}
