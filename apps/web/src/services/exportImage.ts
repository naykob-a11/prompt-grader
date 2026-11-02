import type { GradeContext, Params } from '@prompt-grader/engine';
import {
  createExportGrader,
  cropTile,
  GpuLostError,
  type Tile,
} from '@prompt-grader/engine/renderer';
import { env } from '../config/env';
import type { OpenImage } from '../store/editorStore';
import type { ExportSettings } from '../store/exportStore';
import { findExifSegment, insertExif, sanitizeExif } from './exif';
import { safeFileName } from './promptFiles';

const FORMATS = {
  jpeg: { mime: 'image/jpeg', extension: 'jpg' },
  png: { mime: 'image/png', extension: 'png' },
  webp: { mime: 'image/webp', extension: 'webp' },
};

/** EXIF lives near the start of a JPEG, so the whole file need not be read for it. */
const EXIF_SEARCH_BYTES = 256 * 1024;
const GRADING_SHARE = 0.95;

interface Progress {
  signal: AbortSignal;
  onProgress(fraction: number): void;
}

interface Source {
  read(tile: Tile): Uint8ClampedArray;
  close(): void;
}

/** Reads the picture tile by tile, so a 48 MP photo is never held twice in memory. */
async function openSource(image: OpenImage): Promise<Source> {
  if (!image.file) {
    return { read: (tile) => cropTile(image.preview, tile), close: () => undefined };
  }
  const bitmap = await createImageBitmap(image.file, { imageOrientation: 'from-image' });
  const canvas = new OffscreenCanvas(1, 1);
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  return {
    read(tile) {
      canvas.width = tile.srcWidth;
      canvas.height = tile.srcHeight;
      context.drawImage(bitmap, -tile.srcX, -tile.srcY);
      return context.getImageData(0, 0, tile.srcWidth, tile.srcHeight).data;
    },
    close: () => bitmap.close(),
  };
}

async function gradeInto(
  output: OffscreenCanvasRenderingContext2D,
  source: Source,
  params: Params,
  ctx: GradeContext,
  forceCpu: boolean,
  { signal, onProgress }: Progress,
): Promise<void> {
  const grader = createExportGrader({ forceCpu, tileSize: env.VITE_EXPORT_TILE_SIZE });
  try {
    const tiles = grader.plan(ctx.fullWidth, ctx.fullHeight);
    for (const [index, tile] of tiles.entries()) {
      signal.throwIfAborted();
      const pixels = await grader.grade(source.read(tile), tile, params, ctx);
      const data = new ImageData(pixels as ImageDataArray, tile.width, tile.height);
      output.putImageData(data, tile.x, tile.y);
      onProgress(((index + 1) / tiles.length) * GRADING_SHARE);
      // Lets the page repaint and notice a press of Cancel.
      await new Promise((resolve) => setTimeout(resolve));
    }
  } finally {
    grader.dispose();
  }
}

async function withExif(blob: Blob, file: File, stripGps: boolean): Promise<Blob> {
  const head = new Uint8Array(await file.slice(0, EXIF_SEARCH_BYTES).arrayBuffer());
  const segment = findExifSegment(head);
  const clean = segment && sanitizeExif(segment, { stripGps });
  if (!clean) return blob;
  const jpeg = insertExif(new Uint8Array(await blob.arrayBuffer()), clean);
  return new Blob([jpeg as BlobPart], { type: blob.type });
}

export function exportFileName(imageName: string, promptName: string, format: string): string {
  const base = imageName.replace(/\.[^.]+$/, '');
  const suffix = promptName ? `_${promptName}` : '';
  const extension = FORMATS[format as keyof typeof FORMATS].extension;
  return `${safeFileName(`${base}${suffix}`)}.${extension}`;
}

/** Grades the picture at full size and encodes it. */
export async function exportImage(
  image: OpenImage,
  params: Params,
  settings: ExportSettings,
  progress: Progress,
): Promise<Blob> {
  const { exportFormat, jpegQuality, keepExif, stripGps } = settings;
  const { width, height } = image;
  const ctx = { wbGains: image.ctx.wbGains, fullWidth: width, fullHeight: height };
  const canvas = new OffscreenCanvas(width, height);
  const output = canvas.getContext('2d', { willReadFrequently: true })!;
  const source = await openSource(image);
  try {
    try {
      await gradeInto(output, source, params, ctx, env.VITE_FORCE_CPU_ENGINE, progress);
    } catch (error) {
      if (!(error instanceof GpuLostError)) throw error;
      await gradeInto(output, source, params, ctx, true, progress);
    }
  } finally {
    source.close();
  }

  const isJpeg = exportFormat === 'jpeg';
  if (isJpeg) {
    // JPEG has no transparency; without this, transparent areas turn black.
    output.globalCompositeOperation = 'destination-over';
    output.fillStyle = '#fff';
    output.fillRect(0, 0, width, height);
  }
  const blob = await canvas.convertToBlob({
    type: FORMATS[exportFormat].mime,
    quality: jpegQuality / 100,
  });
  progress.signal.throwIfAborted();
  const result =
    isJpeg && keepExif && image.file ? await withExif(blob, image.file, stripGps) : blob;
  progress.onProgress(1);
  return result;
}
