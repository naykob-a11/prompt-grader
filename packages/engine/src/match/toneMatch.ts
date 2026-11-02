import { gradePixels } from '../cpu/grade';
import { DEFAULT_PARAMS, clamp, type ParamKey, type Params } from '../schema';
import type { GradeContext, RawImage } from '../types';

/** Long side of the thumbnails that are compared. Spec: docs/04 section 5. */
export const MATCH_SIDE = 128;

const LEVELS = [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98];
const ZONES = 3;
const DESCRIPTOR_SIZE = LEVELS.length + ZONES * 3;
const BINS = 512;
const MIN_ALPHA = 128;

/** The penalty for a parameter at its limit, in the units of the squared distance. */
const PENALTY = 1;
const STEPS = [32, 16, 8, 4, 2, 1];
const SWEEPS_PER_STEP = 3;

/** The search stays inside these limits so a very different scene cannot wreck the photo. */
const SCALARS: readonly (readonly [ParamKey, number, number])[] = [
  ['exposure', -70, 70],
  ['contrast', -50, 50],
  ['highlights', -60, 60],
  ['shadows', -60, 60],
  ['saturation', -60, 50],
  ['temp', -50, 50],
  ['tint', -30, 30],
  ['fade', 0, 50],
];
const SATURATION = SCALARS.findIndex(([key]) => key === 'saturation');
const TINTS: readonly (readonly [ParamKey, ParamKey])[] = [
  ['shHue', 'shSat'],
  ['hiHue', 'hiSat'],
];
const TINT_LIMIT = 70;
const VARIABLES = SCALARS.length + TINTS.length * 2;

const HUE_BINS = 12;
const MIN_HUE_CHROMA = 6;
/** Mean chroma under which a reference counts as black and white. */
const MONOCHROME_CHROMA = 4;
/** How much of a difference is taken, for scenes that share no colors and all of them. */
const COLOR_TRANSFER = [0.35, 1] as const;
const LIGHT_TRANSFER = [0.75, 1] as const;

const LINEAR = Float64Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
});

const labF = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

/** Opaque pixels as CIELAB, three values each. Returns how many there are. */
function toLab(data: Uint8ClampedArray, lab: Float32Array): number {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < MIN_ALPHA) continue;
    const r = LINEAR[data[i]!]!;
    const g = LINEAR[data[i + 1]!]!;
    const b = LINEAR[data[i + 2]!]!;
    const fx = labF((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const fy = labF(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const fz = labF((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    lab[n * 3] = 116 * fy - 16;
    lab[n * 3 + 1] = 500 * (fx - fy);
    lab[n * 3 + 2] = 200 * (fy - fz);
    n++;
  }
  return n;
}

/**
 * Lightness at fixed percentiles, then the mean a, b and chroma of the darkest, middle and
 * brightest third of the image's own pixels, which keeps two different scenes comparable.
 */
function describeLab(lab: Float32Array, n: number, bins: Uint32Array, out: Float64Array): void {
  out.fill(0);
  if (n === 0) return;
  bins.fill(0);
  for (let i = 0; i < n; i++) {
    const bin = Math.floor((lab[i * 3]! / 100) * (BINS - 1));
    bins[bin < 0 ? 0 : bin >= BINS ? BINS - 1 : bin]!++;
  }

  const lightnessAt = (fraction: number) => {
    const target = fraction * n;
    let seen = 0;
    for (let bin = 0; bin < BINS; bin++) {
      seen += bins[bin]!;
      if (seen >= target) return (bin / (BINS - 1)) * 100;
    }
    return 100;
  };
  LEVELS.forEach((level, i) => (out[i] = lightnessAt(level)));

  const low = lightnessAt(1 / ZONES);
  const high = lightnessAt(2 / ZONES);
  const base = LEVELS.length;
  let lowCount = 0;
  let midCount = 0;
  let highCount = 0;
  for (let i = 0; i < n; i++) {
    const l = lab[i * 3]!;
    const a = lab[i * 3 + 1]!;
    const b = lab[i * 3 + 2]!;
    const zone = l < low ? 0 : l < high ? 1 : 2;
    if (zone === 0) lowCount++;
    else if (zone === 1) midCount++;
    else highCount++;
    out[base + zone * 3] = out[base + zone * 3]! + a;
    out[base + zone * 3 + 1] = out[base + zone * 3 + 1]! + b;
    out[base + zone * 3 + 2] = out[base + zone * 3 + 2]! + Math.sqrt(a * a + b * b);
  }
  [lowCount, midCount, highCount].forEach((count, zone) => {
    for (let k = 0; k < 3; k++) {
      out[base + zone * 3 + k] = out[base + zone * 3 + k]! / Math.max(1, count);
    }
  });
}

function squaredDistance(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < DESCRIPTOR_SIZE; i++) sum += (a[i]! - b[i]!) ** 2;
  return sum / DESCRIPTOR_SIZE;
}

function describe(data: Uint8ClampedArray): Float64Array {
  const lab = new Float32Array((data.length / 4) * 3);
  const out = new Float64Array(DESCRIPTOR_SIZE);
  describeLab(lab, toLab(data, lab), new Uint32Array(BINS), out);
  return out;
}

/** Root mean square difference of two images' tones, in CIELAB units. */
export function toneDistance(a: RawImage, b: RawImage): number {
  return Math.sqrt(squaredDistance(describe(a.data), describe(b.data)));
}

/** Chroma-weighted shares of the hue circle, and the mean chroma of the image. */
function huesOf(lab: Float32Array, n: number): { shares: Float64Array; chroma: number } {
  const shares = new Float64Array(HUE_BINS);
  let total = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = lab[i * 3 + 1]!;
    const b = lab[i * 3 + 2]!;
    const chroma = Math.sqrt(a * a + b * b);
    sum += chroma;
    if (chroma < MIN_HUE_CHROMA) continue;
    const turn = Math.atan2(b, a) / (2 * Math.PI) + 0.5;
    shares[Math.min(HUE_BINS - 1, Math.floor(turn * HUE_BINS))]! += chroma;
    total += chroma;
  }
  if (total > 0) for (let i = 0; i < HUE_BINS; i++) shares[i] = shares[i]! / total;
  return { shares, chroma: sum / Math.max(1, n) };
}

/** 1 when two images hold the same colors in the same amounts, 0 when they share none. */
function colorOverlap(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < HUE_BINS; i++) sum += Math.min(a[i]!, b[i]!);
  return sum;
}

const blend = ([low, high]: readonly [number, number], t: number) => low + (high - low) * t;

/** Search variables are scalars, then each tint as x, y, so a zero tint can still turn. */
function toParams(x: Float64Array): Params {
  const out: Record<string, number> = { ...DEFAULT_PARAMS };
  SCALARS.forEach(([key], i) => (out[key] = x[i]!));
  TINTS.forEach(([hueKey, satKey], i) => {
    const tx = x[SCALARS.length + i * 2]!;
    const ty = x[SCALARS.length + i * 2 + 1]!;
    const sat = Math.round(Math.min(TINT_LIMIT, Math.hypot(tx, ty)));
    if (sat === 0) return;
    out[hueKey] = (Math.round((Math.atan2(ty, tx) * 180) / Math.PI) + 360) % 360;
    out[satKey] = sat;
  });
  return clamp(out);
}

/** What the source should measure: most of the way to the reference, less for foreign colors. */
function targetFor(source: RawImage, reference: RawImage) {
  const sourceLab = new Float32Array((source.data.length / 4) * 3);
  const referenceLab = new Float32Array((reference.data.length / 4) * 3);
  const sourceCount = toLab(source.data, sourceLab);
  const referenceCount = toLab(reference.data, referenceLab);
  const from = new Float64Array(DESCRIPTOR_SIZE);
  const to = new Float64Array(DESCRIPTOR_SIZE);
  const bins = new Uint32Array(BINS);
  describeLab(sourceLab, sourceCount, bins, from);
  describeLab(referenceLab, referenceCount, bins, to);

  const hues = huesOf(referenceLab, referenceCount);
  const monochrome = hues.chroma < MONOCHROME_CHROMA;
  const overlap = monochrome ? 1 : colorOverlap(huesOf(sourceLab, sourceCount).shares, hues.shares);
  const light = blend(LIGHT_TRANSFER, overlap);
  const color = blend(COLOR_TRANSFER, overlap);
  const target = from.map((value, i) => {
    return value + (to[i]! - value) * (i < LEVELS.length ? light : color);
  });
  return { target, monochrome };
}

/**
 * Finds the parameters that bring `source` closest to the tone of `reference`, by grading
 * `source` and measuring the result. Deterministic, and neutral when the tones already match.
 */
export function matchTone(source: RawImage, reference: RawImage): Params {
  const { width, height } = source;
  const { target, monochrome } = targetFor(source, reference);
  const ctx: GradeContext = { wbGains: [1, 1, 1], fullWidth: width, fullHeight: height };
  const graded = new Uint8ClampedArray(source.data.length);
  const lab = new Float32Array((source.data.length / 4) * 3);
  const bins = new Uint32Array(BINS);
  const current = new Float64Array(DESCRIPTOR_SIZE);

  const lowerLimit = (i: number) => {
    if (i === SATURATION && monochrome) return -100;
    return i < SCALARS.length ? SCALARS[i]![1] : -TINT_LIMIT;
  };
  const upperLimit = (i: number) => (i < SCALARS.length ? SCALARS[i]![2] : TINT_LIMIT);

  const x = new Float64Array(VARIABLES);
  const cost = () => {
    gradePixels(source.data, source.data, graded, width, height, 0, toParams(x), ctx);
    describeLab(lab, toLab(graded, lab), bins, current);
    let penalty = 0;
    for (let i = 0; i < VARIABLES; i++) {
      const limit = x[i]! < 0 ? lowerLimit(i) : upperLimit(i);
      if (limit) penalty += (x[i]! / limit) ** 2;
    }
    return squaredDistance(current, target) + PENALTY * penalty;
  };

  let best = cost();
  for (const step of STEPS) {
    for (let sweep = 0; sweep < SWEEPS_PER_STEP; sweep++) {
      let improved = false;
      for (let i = 0; i < VARIABLES; i++) {
        const start = x[i]!;
        for (const candidate of [start + step, start - step]) {
          if (candidate < lowerLimit(i) || candidate > upperLimit(i)) continue;
          x[i] = candidate;
          const value = cost();
          if (value < best) {
            best = value;
            improved = true;
            break;
          }
          x[i] = start;
        }
      }
      if (!improved) break;
    }
  }
  return toParams(x);
}
