import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './images';

type RawParams = Readonly<Record<string, number>>;

export interface Prototype {
  grayWorld(data: Uint8ClampedArray): number[];
  /** The same path as render() in the prototype, for one image at full size. */
  run(data: Uint8ClampedArray, w: number, h: number, params: RawParams): Uint8ClampedArray;
}

/** Evaluates the untouched engine section of the prototype, so tests compare against the real thing. */
export function loadPrototype(): Prototype {
  const html = readFileSync(resolve(ROOT, 'reference/prototype-v3.html'), 'utf8');
  const start = html.indexOf('// ================= grading engine =================');
  const end = html.indexOf('// ================= sliders =================');
  if (start < 0 || end < 0) throw new Error('engine section not found in the prototype');
  return new Function(`
    ${html.slice(start, end)}
    return {
      grayWorld,
      run(data, w, h, q) {
        WBG = grayWorld(data);
        let s = data;
        if (q.sharpen || q.denoise) { s = new Uint8ClampedArray(data); detail(s, w, h, q, 0, h); }
        const out = new Uint8ClampedArray(data.length);
        grade(s, out, w, h, 0, w, h, q);
        return out;
      },
    };
  `)() as Prototype;
}
