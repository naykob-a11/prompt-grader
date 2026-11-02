import type { RawImage } from './types';

/** The padding each tile needs: 1 px for the 3x3 detail kernel, plus 1 px of margin. */
export const TILE_PADDING = 2;

export interface Tile {
  /** The pixels this tile outputs, in full-image coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The region to upload, which is the output plus padding clipped to the image. */
  srcX: number;
  srcY: number;
  srcWidth: number;
  srcHeight: number;
}

/** Covers a W x H image with tiles whose padded region never exceeds `maxTexture`. */
export function planTiles(
  W: number,
  H: number,
  maxTexture: number,
  padding = TILE_PADDING,
): Tile[] {
  const core = maxTexture - padding * 2;
  if (core <= 0) throw new Error(`tile size ${maxTexture} is too small for padding ${padding}`);
  const tiles: Tile[] = [];
  for (let y = 0; y < H; y += core) {
    const height = Math.min(core, H - y);
    const srcY = Math.max(0, y - padding);
    const srcBottom = Math.min(H, y + height + padding);
    for (let x = 0; x < W; x += core) {
      const width = Math.min(core, W - x);
      const srcX = Math.max(0, x - padding);
      const srcRight = Math.min(W, x + width + padding);
      tiles.push({
        x,
        y,
        width,
        height,
        srcX,
        srcY,
        srcWidth: srcRight - srcX,
        srcHeight: srcBottom - srcY,
      });
    }
  }
  return tiles;
}

/** Whole-width strips for the CPU, with one row of padding for the 3x3 detail kernel. */
export function planStrips(W: number, H: number, rows: number): Tile[] {
  const strips: Tile[] = [];
  for (let y = 0; y < H; y += rows) {
    const height = Math.min(rows, H - y);
    const srcY = Math.max(0, y - 1);
    const srcBottom = Math.min(H, y + height + 1);
    strips.push({
      x: 0,
      y,
      width: W,
      height,
      srcX: 0,
      srcY,
      srcWidth: W,
      srcHeight: srcBottom - srcY,
    });
  }
  return strips;
}

/** Copies a tile's padded region out of a whole image. */
export function cropTile(image: RawImage, tile: Tile): Uint8ClampedArray {
  const out = new Uint8ClampedArray(tile.srcWidth * tile.srcHeight * 4);
  for (let row = 0; row < tile.srcHeight; row++) {
    const start = ((tile.srcY + row) * image.width + tile.srcX) * 4;
    out.set(image.data.subarray(start, start + tile.srcWidth * 4), row * tile.srcWidth * 4);
  }
  return out;
}
