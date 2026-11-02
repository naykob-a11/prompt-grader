import { luminance } from '../math';

export interface Histogram {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  l: Uint32Array;
}

/** 256 bins for each of red, green, blue and luminance, from RGBA data. */
export function histogram(data: ArrayLike<number>): Histogram {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const l = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const pr = data[i]!;
    const pg = data[i + 1]!;
    const pb = data[i + 2]!;
    r[pr]!++;
    g[pg]!++;
    b[pb]!++;
    l[Math.round(luminance(pr, pg, pb))]!++;
  }
  return { r, g, b, l };
}
