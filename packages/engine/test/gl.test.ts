import { expect, test } from 'vitest';
import { PARAM_KEYS } from '../src';
import detailFrag from '../src/gl/shaders/detail.frag?raw';
import gradeFrag from '../src/gl/shaders/grade.frag?raw';
import { planTiles, TILE_PADDING } from '../src/gl/tiles';
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
