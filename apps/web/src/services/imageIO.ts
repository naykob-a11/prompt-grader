import type { RawImage } from '@prompt-grader/engine';

export interface DecodedImage {
  preview: RawImage;
  width: number;
  height: number;
}

/** Decodes a file, applying its EXIF orientation, and scales it down for the preview. */
export async function decodeImage(file: Blob, maxSide: number): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, w, h);
    return {
      preview: { data: context.getImageData(0, 0, w, h).data, width: w, height: h },
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}

/** Nearest-neighbour reduction, for statistics rather than display. */
export function sampleImage(image: RawImage, maxSide: number): RawImage {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.floor((y / height) * image.height);
    for (let x = 0; x < width; x++) {
      const sx = Math.floor((x / width) * image.width);
      const from = (sy * image.width + sx) * 4;
      const to = (y * width + x) * 4;
      data[to] = image.data[from]!;
      data[to + 1] = image.data[from + 1]!;
      data[to + 2] = image.data[from + 2]!;
      data[to + 3] = image.data[from + 3]!;
    }
  }
  return { data, width, height };
}
