import { luminance } from '../math';

const clampGain = (v: number) => Math.min(1.35, Math.max(0.75, v));

/** White-balance gains from the mean of mid-tone pixels, sampling every 4th pixel of RGBA data. */
export function grayWorld(data: ArrayLike<number>): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    const pr = data[i]!;
    const pg = data[i + 1]!;
    const pb = data[i + 2]!;
    const L = luminance(pr, pg, pb) / 255;
    if (L > 0.12 && L < 0.9) {
      r += pr;
      g += pg;
      b += pb;
      n++;
    }
  }
  if (!n) return [1, 1, 1];
  r /= n;
  g /= n;
  b /= n;
  const m = (r + g + b) / 3;
  return [clampGain(m / r), clampGain(m / g), clampGain(m / b)];
}
