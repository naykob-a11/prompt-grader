import { luminance, smoothstep } from '../math';
import type { Params } from '../schema';

/**
 * Edge-aware denoise and unsharp mask (3x3) in place on rows [from, to) of RGBA `data`.
 * Rows outside that range are read as padding, so strips stay seamless. Spec: docs/04 section 1.
 */
export function detail(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  params: Pick<Params, 'sharpen' | 'denoise'>,
  from: number,
  to: number,
): void {
  const sh = params.sharpen / 100;
  const dn = params.denoise / 100;
  if (!sh && !dn) return;

  const src = new Float32Array(w * h * 3);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    src[i * 3] = data[j]!;
    src[i * 3 + 1] = data[j + 1]!;
    src[i * 3 + 2] = data[j + 2]!;
  }

  for (let y = from; y < to; y++) {
    const yUp = y > 0 ? y - 1 : 0;
    const yDown = y < h - 1 ? y + 1 : h - 1;
    for (let x = 0; x < w; x++) {
      const xLeft = x > 0 ? x - 1 : 0;
      const xRight = x < w - 1 ? x + 1 : w - 1;
      let br = 0;
      let bg = 0;
      let bb = 0;
      for (let a = 0; a < 3; a++) {
        const row = (a === 0 ? yUp : a === 1 ? y : yDown) * w;
        for (let b = 0; b < 3; b++) {
          const k = (row + (b === 0 ? xLeft : b === 1 ? x : xRight)) * 3;
          br += src[k]!;
          bg += src[k + 1]!;
          bb += src[k + 2]!;
        }
      }
      br /= 9;
      bg /= 9;
      bb /= 9;
      const c = (y * w + x) * 3;
      const o = (y * w + x) * 4;
      const pr = src[c]!;
      const pg = src[c + 1]!;
      const pb = src[c + 2]!;
      const dl = Math.abs(luminance(pr - br, pg - bg, pb - bb)) / 255;
      const wn = dn * 0.85 * (1 - smoothstep(0.015, 0.07, dl));
      const ws = sh * 1.6 * smoothstep(0.01, 0.045, dl);
      data[o] = pr + (br - pr) * wn + (pr - br) * ws;
      data[o + 1] = pg + (bg - pg) * wn + (pg - bg) * ws;
      data[o + 2] = pb + (bb - pb) * wn + (pb - bb) * ws;
    }
  }
}
