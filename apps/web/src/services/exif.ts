// Copies EXIF from one JPEG to another. Reads untrusted bytes: a DataView throws on any offset
// out of range, and sanitizeExif turns that into "no EXIF" rather than a failed export.

const MARKER = 0xff;
const SOI = 0xd8;
const SOS = 0xda;
const EOI = 0xd9;
const APP0 = 0xe0;
const APP1 = 0xe1;
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0];
/** Marker (2) + length (2) + "Exif\0\0" (6). */
const TIFF_START = 10;
const ENTRY_SIZE = 12;

const TAG_ORIENTATION = 0x0112;
const TAG_GPS_IFD = 0x8825;
const TAG_THUMBNAIL_OFFSET = 0x0201;
const TAG_THUMBNAIL_LENGTH = 0x0202;

/** Bytes per value for each TIFF type, indexed by type number. */
const TYPE_SIZES = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

function segmentLength(jpeg: Uint8Array, at: number): number {
  return 2 + ((jpeg[at + 2]! << 8) | jpeg[at + 3]!);
}

const isJpeg = (bytes: Uint8Array) => bytes[0] === MARKER && bytes[1] === SOI;

/** Returns the whole APP1 EXIF segment of a JPEG, marker included, or null. */
export function findExifSegment(jpeg: Uint8Array): Uint8Array | null {
  if (!isJpeg(jpeg)) return null;
  for (let at = 2; at + 4 <= jpeg.length; at += segmentLength(jpeg, at)) {
    if (jpeg[at] !== MARKER) return null;
    const marker = jpeg[at + 1];
    if (marker === SOS || marker === EOI) return null;
    if (marker === APP1 && EXIF_HEADER.every((byte, i) => jpeg[at + 4 + i] === byte)) {
      const end = at + segmentLength(jpeg, at);
      return end <= jpeg.length ? jpeg.slice(at, end) : null;
    }
  }
  return null;
}

class Tiff {
  private readonly view: DataView;
  private readonly little: boolean;

  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.little = this.view.getUint16(TIFF_START) === 0x4949;
    if (!this.little && this.view.getUint16(TIFF_START) !== 0x4d4d) throw new Error('not TIFF');
    if (this.u16(2) !== 42) throw new Error('not TIFF');
  }

  u16 = (at: number) => this.view.getUint16(TIFF_START + at, this.little);
  u32 = (at: number) => this.view.getUint32(TIFF_START + at, this.little);
  setU16 = (at: number, v: number) => this.view.setUint16(TIFF_START + at, v, this.little);
  setU32 = (at: number, v: number) => this.view.setUint32(TIFF_START + at, v, this.little);

  zero(at: number, length: number): void {
    const start = TIFF_START + at;
    if (start + length > this.bytes.length) throw new RangeError('outside the segment');
    this.bytes.fill(0, start, start + length);
  }

  entries(ifd: number): number[] {
    return Array.from({ length: this.u16(ifd) }, (_, i) => ifd + 2 + i * ENTRY_SIZE);
  }

  find(ifd: number, tag: number): number | undefined {
    return this.entries(ifd).find((entry) => this.u16(entry) === tag);
  }

  /** Blanks a directory and any values it stores outside its table. */
  eraseIfd(ifd: number): void {
    const entries = this.entries(ifd);
    for (const entry of entries) {
      const size = (TYPE_SIZES[this.u16(entry + 2)] ?? 0) * this.u32(entry + 4);
      if (size > 4) this.zero(this.u32(entry + 8), size);
    }
    this.zero(ifd, 2 + entries.length * ENTRY_SIZE + 4);
  }

  /** Deletes one entry from a directory, keeping the link to the next directory. */
  removeEntry(ifd: number, entry: number): void {
    const end = ifd + 2 + this.u16(ifd) * ENTRY_SIZE + 4;
    this.bytes.copyWithin(TIFF_START + entry, TIFF_START + entry + ENTRY_SIZE, TIFF_START + end);
    this.zero(end - ENTRY_SIZE, ENTRY_SIZE);
    this.setU16(ifd, this.u16(ifd) - 1);
  }
}

/**
 * Prepares an EXIF segment for a graded copy. The orientation becomes normal, because the pixels
 * are already upright. The embedded thumbnail goes, because it shows the ungraded image. With
 * `stripGps`, the location is erased from the bytes, not just unlinked.
 */
export function sanitizeExif(
  segment: Uint8Array,
  { stripGps }: { stripGps: boolean },
): Uint8Array | null {
  try {
    const tiff = new Tiff(segment.slice());
    const ifd0 = tiff.u32(4);

    const orientation = tiff.find(ifd0, TAG_ORIENTATION);
    if (orientation !== undefined) tiff.setU16(orientation + 8, 1);

    const next = ifd0 + 2 + tiff.u16(ifd0) * ENTRY_SIZE;
    const ifd1 = tiff.u32(next);
    if (ifd1 !== 0) {
      const offset = tiff.find(ifd1, TAG_THUMBNAIL_OFFSET);
      const length = tiff.find(ifd1, TAG_THUMBNAIL_LENGTH);
      if (offset !== undefined && length !== undefined) {
        tiff.zero(tiff.u32(offset + 8), tiff.u32(length + 8));
      }
      tiff.eraseIfd(ifd1);
      tiff.setU32(next, 0);
    }

    const gps = tiff.find(ifd0, TAG_GPS_IFD);
    if (stripGps && gps !== undefined) {
      tiff.eraseIfd(tiff.u32(gps + 8));
      tiff.removeEntry(ifd0, gps);
    }
    return tiff.bytes;
  } catch {
    return null;
  }
}

/** Places an EXIF segment into a JPEG, after its JFIF header if it has one. */
export function insertExif(jpeg: Uint8Array, segment: Uint8Array): Uint8Array {
  if (!isJpeg(jpeg)) return jpeg;
  const at = jpeg[2] === MARKER && jpeg[3] === APP0 ? 2 + segmentLength(jpeg, 2) : 2;
  const out = new Uint8Array(jpeg.length + segment.length);
  out.set(jpeg.subarray(0, at));
  out.set(segment, at);
  out.set(jpeg.subarray(at), at + segment.length);
  return out;
}
