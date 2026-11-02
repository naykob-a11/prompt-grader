import { hash2, hueOffset, luminance, smoothstep } from '../math';
import type { Params } from '../schema';
import type { GradeContext } from '../types';
import { detail } from './detail';

const BAND_CENTERS = [0, 50, 115, 180, 225, 285];
const BAND_IDS = ['R', 'Y', 'G', 'A', 'B', 'P'] as const;
const BAND_STRIDE = 4;

/** Flat [center, hue, sat, lum] for each band with a non-zero setting. */
function activeBands(q: Params): Float64Array {
  const out: number[] = [];
  BAND_IDS.forEach((id, i) => {
    const hue = q[`h${id}`] / 100;
    const sat = q[`s${id}`] / 100;
    const lum = q[`l${id}`] / 100;
    if (hue || sat || lum) out.push(BAND_CENTERS[i]!, hue, sat, lum);
  });
  return Float64Array.from(out);
}

/**
 * Grades `rows` rows of RGBA pixels. `src` is the output of the detail pass and `orig` the same
 * rows before it, which the final mix blends back to. `y0` is the first row in the full image.
 * Spec: docs/04 section 2.
 */
export function gradePixels(
  orig: Uint8ClampedArray,
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  rows: number,
  y0: number,
  q: Params,
  ctx: GradeContext,
): void {
  const A = q.amount / 100;
  const ex = Math.pow(2, q.exposure / 100);
  const con = q.contrast / 100;
  const sat = q.saturation / 100;
  const vib = q.vibrance / 100;
  const temp = q.temp / 100;
  const tint = q.tint / 100;
  const hiT = q.highlights / 100;
  const shT = q.shadows / 100;
  const teal = q.teal / 100;
  const forest = q.forest / 100;
  const sun = q.sun / 100;
  const [shR, shG, shB] = hueOffset(q.shHue);
  const [hiR, hiG, hiB] = hueOffset(q.hiHue);
  const shS = (q.shSat / 100) * 0.16;
  const hiS = (q.hiSat / 100) * 0.13;
  const guard = q.guard / 100;
  const haze = q.haze / 100;
  const reach = 0.15 + (q.reach / 100) * 0.75;
  const hzT = q.hazeTemp / 100;
  const fade = q.fade / 100;
  const grain = q.grain / 100;
  const vig = q.vignette / 100;
  const bands = activeBands(q);

  const cf = q.castFix / 100;
  const [gainR, gainG, gainB] = ctx.wbGains;
  const wr = (1 + temp * 0.12 + tint * 0.03) * (1 + (gainR - 1) * cf);
  const wg = (1 - tint * 0.08) * (1 + (gainG - 1) * cf);
  const wb = (1 - temp * 0.12 + tint * 0.03) * (1 + (gainB - 1) * cf);

  const dz = (q.dehaze / 100) * 0.18;
  const dzA = 0.8;
  const dzK = 1 / (1 - dz);

  const W = ctx.fullWidth;
  const H = ctx.fullHeight;
  const cx = W / 2;
  const cy = H / 2;
  const inv = 1 / Math.sqrt(cx * cx + cy * cy);

  for (let j = 0; j < rows; j++) {
    const y = y0 + j;
    let hz = 1 - y / H / reach;
    hz = hz > 0 ? Math.pow(hz, 1.5) * haze * 0.6 : 0;
    const dy = y - cy;
    for (let x = 0; x < w; x++) {
      const i = (j * w + x) * 4;

      // 2.1 exposure, white balance, cast fix
      let r = Math.min(1, (src[i]! / 255) * ex * wr);
      let g = Math.min(1, (src[i + 1]! / 255) * ex * wg);
      let b = Math.min(1, (src[i + 2]! / 255) * ex * wb);

      // 2.2 dehaze
      if (dz > 0) {
        r = Math.max(0, (r - dz * dzA) * dzK);
        g = Math.max(0, (g - dz * dzA) * dzK);
        b = Math.max(0, (b - dz * dzA) * dzK);
        r = r > 1 ? 1 : r;
        g = g > 1 ? 1 : g;
        b = b > 1 ? 1 : b;
      }

      // 2.3 HSV stage
      const L0 = luminance(r, g, b);
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const d = mx - mn;
      let h = 0;
      let s = mx ? d / mx : 0;
      let v = mx;
      if (d > 1e-5) {
        if (mx === r) h = ((g - b) / d) % 6;
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }

      const cw = Math.min(1, s * 4);
      let dh = 0;
      let ds = 0;
      let dl = 0;
      for (let k = 0; k < bands.length; k += BAND_STRIDE) {
        let ad = Math.abs(h - bands[k]!);
        if (ad > 180) ad = 360 - ad;
        const wt = ad < 45 ? (1 - ad / 45) * cw : 0;
        if (wt) {
          dh += wt * bands[k + 1]! * 30;
          ds += wt * bands[k + 2]!;
          dl += wt * bands[k + 3]!;
        }
      }

      let fw = 0;
      if (h > 45 && h < 190) {
        fw = h < 80 ? smoothstep(45, 80, h) : h > 150 ? 1 - smoothstep(150, 190, h) : 1;
      }
      fw *= Math.min(1, s * 3.2);
      const lit = smoothstep(0.42, 0.82, L0);
      if (fw > 0) {
        dh +=
          fw * ((1 - lit) * teal * 34 - lit * sun * (h > 80 ? Math.min(28, (h - 72) * 0.55) : 0));
      }

      h += dh;
      h = ((h % 360) + 360) % 360;
      s *= (1 + ds) * (1 - fw * 0.1 * teal * (1 - lit)) * (1 + fw * 0.06 * sun * lit);
      s = vib >= 0 ? s + vib * s * (1 - s) * 1.5 : s * (1 + vib * (1 - s * 0.5));
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      v *= (1 + dl * 0.35) * (1 - fw * forest * 0.22 * (1 - L0) * (1 - lit * 0.6));
      v = v < 0 ? 0 : v > 1 ? 1 : v;

      const c = v * s;
      const hp = h / 60;
      const xx = c * (1 - Math.abs((hp % 2) - 1));
      const m = v - c;
      if (hp < 1) {
        r = c;
        g = xx;
        b = 0;
      } else if (hp < 2) {
        r = xx;
        g = c;
        b = 0;
      } else if (hp < 3) {
        r = 0;
        g = c;
        b = xx;
      } else if (hp < 4) {
        r = 0;
        g = xx;
        b = c;
      } else if (hp < 5) {
        r = xx;
        g = 0;
        b = c;
      } else {
        r = c;
        g = 0;
        b = xx;
      }
      r += m;
      g += m;
      b += m;

      // 2.4 global saturation
      if (sat) {
        const Ls = luminance(r, g, b);
        const f = 1 + sat;
        r = Ls + (r - Ls) * f;
        g = Ls + (g - Ls) * f;
        b = Ls + (b - Ls) * f;
      }

      // 2.5 tone on luminance
      const L = luminance(r, g, b);
      let Ln = L;
      Ln += hiT * 0.2 * smoothstep(0.5, 1, L);
      Ln += shT * 0.25 * (1 - L) * (1 - L) * (1 - smoothstep(0.4, 0.75, L));
      const t = Ln - 0.5;
      Ln = 0.5 + t * (1 + con * 0.7 * (1 - 4 * t * t));
      Ln = Ln < 0 ? 0 : Ln > 1.05 ? 1.05 : Ln;
      if (L > 1e-4) {
        const k = Ln / L;
        r *= k;
        g *= k;
        b *= k;
      } else {
        r = g = b = Ln;
      }

      // 2.6 split toning
      const sw = (1 - Ln) * (1 - Ln) * (1 - smoothstep(0.5, 0.8, Ln)) * shS;
      const hw = smoothstep(0.55, 0.98, Ln) * hiS;
      r += shR * sw + hiR * hw;
      g += shG * sw + hiG * hw;
      b += shB * sw + hiB * hw;

      // 2.7 yellow guard
      if (guard > 0) {
        const yel = Math.min(r, g) - b - 0.1;
        if (yel > 0) {
          const f = yel * guard * 0.55 * smoothstep(0.25, 0.7, Ln);
          r -= f * 0.9;
          g -= f * 0.55;
          b += f * 0.25;
        }
      }

      // 2.8 haze
      if (hz > 0) {
        const tg = 0.55 + luminance(r, g, b) * 0.35;
        r += (tg + hzT * 0.04 - r) * hz;
        g += (tg - g) * hz;
        b += (tg - hzT * 0.05 - b) * hz;
      }

      // 2.9 fade, vignette, grain
      if (fade > 0) {
        const fl = fade * 0.07;
        r = fl + r * (1 - fl * 1.1);
        g = fl + g * (1 - fl * 1.1);
        b = fl + b * (1 - fl * 1.1);
      }
      if (vig > 0) {
        const dx = x - cx;
        const vf = 1 - vig * 0.5 * smoothstep(0.38, 1.05, Math.sqrt(dx * dx + dy * dy) * inv);
        r *= vf;
        g *= vf;
        b *= vf;
      }
      if (grain > 0) {
        const fall = 1 - Math.min(1, Math.abs(luminance(r, g, b) - 0.45) * 1.4);
        const n = (hash2(x, y) + hash2(x + 1, y + 7) - 1) * grain * 0.075 * fall;
        r += n;
        g += n;
        b += n;
      }

      // 2.10 mix with the pixel from before the detail pass
      const r0 = orig[i]! / 255;
      const g0 = orig[i + 1]! / 255;
      const b0 = orig[i + 2]! / 255;
      dst[i] = 255 * (r0 + (r - r0) * A);
      dst[i + 1] = 255 * (g0 + (g - g0) * A);
      dst[i + 2] = 255 * (b0 + (b - b0) * A);
      dst[i + 3] = orig[i + 3]!;
    }
  }
}

/** Runs detail and grade over a whole image, `stripRows` rows at a time. */
export function gradeImage(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  params: Params,
  ctx: GradeContext,
  stripRows = h,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  const hasDetail = params.sharpen > 0 || params.denoise > 0;
  for (let y = 0; y < h; y += stripRows) {
    const rows = Math.min(stripRows, h - y);
    const orig = src.subarray(y * w * 4, (y + rows) * w * 4);
    const out = dst.subarray(y * w * 4, (y + rows) * w * 4);
    if (!hasDetail) {
      gradePixels(orig, orig, out, w, rows, y, params, ctx);
      continue;
    }
    const padTop = y > 0 ? 1 : 0;
    const padBottom = y + rows < h ? 1 : 0;
    const padded = src.slice((y - padTop) * w * 4, (y + rows + padBottom) * w * 4);
    detail(padded, w, rows + padTop + padBottom, params, padTop, padTop + rows);
    const core = padded.subarray(padTop * w * 4, (padTop + rows) * w * 4);
    gradePixels(orig, core, out, w, rows, y, params, ctx);
  }
  return dst;
}
