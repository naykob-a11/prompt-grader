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
