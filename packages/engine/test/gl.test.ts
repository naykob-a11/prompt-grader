import { expect, test } from 'vitest';
import { PARAM_KEYS } from '../src';
import detailFrag from '../src/gl/shaders/detail.frag?raw';
import gradeFrag from '../src/gl/shaders/grade.frag?raw';
import { cropTile, planStrips, planTiles, TILE_PADDING } from '../src/tiles';
import { withParamUniforms } from '../src/gl/uniforms';

test('the grade shader uses every parameter except the two owned by the detail pass', () => {
  const detailOnly = new Set(['sharpen', 'denoise']);
  const missing = PARAM_KEYS.filter((k) => !detailOnly.has(k) && !gradeFrag.includes(`u_${k}`));
  expect(missing).toEqual([]);
  expect(detailFrag).toContain('u_sharpen');
  expect(detailFrag).toContain('u_denoise');
});

test('uniforms are generated from the schema, in place of the placeholder', () => {
  const source = withParamUniforms(gradeFrag);
  expect(source).not.toContain('@param-uniforms');
  for (const k of PARAM_KEYS) expect(source).toContain(`uniform float u_${k};`);
  expect(() => withParamUniforms('void main() {}')).toThrow();
});

test.each([
  [512, 256, 64],
  [1000, 1000, 4096],
  [4096, 4096, 4096],
  [8001, 6003, 4096],
  [1, 1, 16],
])('tiles for %i x %i at %i cover every pixel exactly once', (W, H, size) => {
  const hits = new Uint8Array(W * H);
  for (const t of planTiles(W, H, size)) {
    expect(t.srcWidth).toBeLessThanOrEqual(size);
    expect(t.srcHeight).toBeLessThanOrEqual(size);
    expect(t.srcX).toBeGreaterThanOrEqual(0);
    expect(t.srcY).toBeGreaterThanOrEqual(0);
    expect(t.srcX + t.srcWidth).toBeLessThanOrEqual(W);
    expect(t.srcY + t.srcHeight).toBeLessThanOrEqual(H);
    // Padded on every side that is not the image edge, so the kernel sees real neighbours.
    if (t.x > 0) expect(t.x - t.srcX).toBe(TILE_PADDING);
    if (t.y > 0) expect(t.y - t.srcY).toBe(TILE_PADDING);
    if (t.x + t.width < W) expect(t.srcX + t.srcWidth - t.x - t.width).toBe(TILE_PADDING);
    if (t.y + t.height < H) expect(t.srcY + t.srcHeight - t.y - t.height).toBe(TILE_PADDING);
    for (let y = t.y; y < t.y + t.height; y++) hits.fill(1, y * W + t.x, y * W + t.x + t.width);
  }
  expect(hits.every((v) => v === 1)).toBe(true);
});

test('a tile too small for its padding is refused', () => {
  expect(() => planTiles(10, 10, 4)).toThrow();
});

test('strips cover every row once, padded by one row between neighbours', () => {
  const strips = planStrips(100, 25, 10);
  expect(strips.map((s) => [s.y, s.height])).toEqual([
    [0, 10],
    [10, 10],
    [20, 5],
  ]);
  expect(strips.map((s) => s.y - s.srcY)).toEqual([0, 1, 1]);
  expect(strips.map((s) => s.srcHeight)).toEqual([11, 12, 6]);
  expect(strips.every((s) => s.x === 0 && s.width === 100 && s.srcWidth === 100)).toBe(true);
});

test('cropTile copies the padded region, row by row', () => {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < 16; i++) data[i * 4] = i;
  const image = { data, width: 4, height: 4 };
  const tile = { x: 1, y: 1, width: 1, height: 1, srcX: 1, srcY: 1, srcWidth: 2, srcHeight: 2 };
  expect([...cropTile(image, tile)].filter((_, i) => i % 4 === 0)).toEqual([5, 6, 9, 10]);
});
