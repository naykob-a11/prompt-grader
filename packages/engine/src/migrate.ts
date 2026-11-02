import { clamp, type Params } from './schema';

/** Upgrades saved parameters from an older schema version so they keep their look. */
export function migrateParams(input: Readonly<Record<string, unknown>>, from: number): Params {
  const p: Record<string, unknown> = { ...input };

  if (from < 2) {
    if (p.cream !== undefined) {
      p.hiHue = 40;
      p.hiSat = p.cream;
    }
    if (p.shadowTeal !== undefined) {
      p.shHue = 188;
      p.shSat = p.shadowTeal;
    }
    if (p.depth !== undefined) p.shadows = Math.round(-Number(p.depth) * 0.8);
  }

  // v2 to v3 only added keys, which clamp() fills with their neutral values.
  return clamp(p);
}
