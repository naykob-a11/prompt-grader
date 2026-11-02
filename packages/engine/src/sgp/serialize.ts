import { DEFAULT_PARAMS, PARAMS, type ParamDef, type ParamKey, type Params } from '../schema';
import { vocab, type ParamEntry } from './vocabulary';

export interface SgpDocument {
  name?: string;
  tags?: readonly string[];
  params: Params;
  notes?: string;
  preserve?: string;
}

// Section order and line shapes are normative: the round-trip guarantee depends on them.
const SECTIONS: readonly (readonly [string, readonly string[]])[] = [
  ['light', ['exposure', 'contrast', 'highlights', 'shadows', 'dehaze']],
  ['color', ['temp', 'tint', 'castFix', 'saturation', 'vibrance', 'guard']],
  ['foliage', ['teal', 'forest', 'sun']],
  ['split', ['@tint:shHue', '@tint:hiHue']],
  ['bands', ['@band:R', '@band:Y', '@band:G', '@band:A', '@band:B', '@band:P']],
  ['atmosphere', ['haze', 'reach', 'hazeTemp', 'fade', 'grain', 'vignette']],
  ['detail', ['sharpen', 'denoise']],
];

const DEFS = new Map<string, ParamDef>(PARAMS.map((p) => [p.key, p]));
const ENTRIES = new Map<string, ParamEntry>(vocab.params.map((p) => [p.key, p]));

const signed = (v: number) => (v > 0 ? `+${v}` : String(v));
const metaValue = (s: string) => s.replace(/\s+/g, ' ').trim();
const metaTag = (s: string) => s.replace(/[,،、\s]+/g, ' ').trim();

/** Text-section lines; anything the parser would read as structure gets a leading backslash. */
const textLines = (text: string) =>
  text
    .trim()
    .split(/\r\n?|\n/)
    .map((line) => line.trim())
    .map((line) => (/^(\\|\[|#|```)/.test(line) ? `\\${line}` : line));

function nearestIntensity(magnitude: number): string {
  let best = vocab.intensity[0]!;
  for (const x of vocab.intensity) {
    if (Math.abs(x.value - magnitude) < Math.abs(best.value - magnitude)) best = x;
  }
  return best.words[0]!;
}

function nearestColor(hue: number): string {
  let best = vocab.colors[0]!;
  let bestDistance = 999;
  for (const c of vocab.colors) {
    const d = Math.abs(c.hue - hue);
    const wrapped = Math.min(d, 360 - d);
    if (wrapped < bestDistance) {
      bestDistance = wrapped;
      best = c;
    }
  }
  return best.words[0]!;
}

function scalarLine(key: string, p: Params): string | null {
  const d = DEFS.get(key)!;
  const entry = ENTRIES.get(key)!;
  const v = p[key as ParamKey];
  const label = entry.aliases[0]!;
  if (v === d.default) return null;
  const special = entry.special && Object.entries(entry.special).find(([, x]) => x === v);
  if (special) return `${label}: ${special[0]} (${d.min < 0 ? signed(v) : v})`;
  if (v === 0) return `${label}: ${vocab.neutral[0]} (0)`;
  if (d.min >= 0) {
    if (entry.special) {
      const [word] = Object.entries(entry.special).reduce((a, b) =>
        Math.abs(b[1] - v) < Math.abs(a[1] - v) ? b : a,
      );
      return `${label}: ${word} (${v})`;
    }
    return `${label}: ${nearestIntensity(v)} (${v})`;
  }
  const direction =
    v > 0 ? (entry.positive ?? vocab.positive)[0] : (entry.negative ?? vocab.negative)[0];
  return `${label}: ${direction} ${nearestIntensity(Math.abs(v))} (${signed(v)})`;
}

function tintLine(hueKey: string, p: Params): string | null {
  const t = vocab.tints.find((x) => x.hueKey === hueKey)!;
  const hue = p[t.hueKey];
  const sat = p[t.satKey];
  const label = t.aliases[0]!;
  if (sat !== 0) return `${label}: ${nearestColor(hue)} ${nearestIntensity(sat)} (${hue}°, ${sat})`;
  if (hue === DEFAULT_PARAMS[t.hueKey]) return null;
  return `${label}: ${nearestColor(hue)} (${hue}°, 0)`;
}

function bandLine(id: string, p: Params): string | null {
  const band = vocab.bands.find((x) => x.id === id)!;
  const parts: string[] = [];
  for (const prefix of ['s', 'l', 'h'] as const) {
    const v = p[`${prefix}${band.id}`];
    if (!v) continue;
    const attribute = vocab.bandAttributes.find((x) => x.prefix === prefix)!.aliases[1];
    const direction = v > 0 ? vocab.positive[0] : vocab.negative[0];
    parts.push(`${attribute} ${direction} ${nearestIntensity(Math.abs(v))} (${signed(v)})`);
  }
  return parts.length ? `${band.aliases[1]}: ${parts.join(', ')}` : null;
}

function settingLine(key: string, p: Params): string | null {
  if (key.startsWith('@tint:')) return tintLine(key.slice(6), p);
  if (key.startsWith('@band:')) return bandLine(key.slice(6), p);
  return scalarLine(key, p);
}

/** Writes SGP text. parseSGP(serializeSGP(doc)).params always equals doc.params. */
export function serializeSGP(doc: SgpDocument): string {
  const p = { ...DEFAULT_PARAMS, ...doc.params };
  const out: string[] = [];
  if (doc.name) out.push(`# ${vocab.meta.name[0]}: ${metaValue(doc.name)}`);
  if (doc.tags?.length) out.push(`# ${vocab.meta.tags[0]}: ${doc.tags.map(metaTag).join(', ')}`);
  out.push(`# ${vocab.meta.version[0]}: ${vocab.version}`);

  if (p.amount !== DEFAULT_PARAMS.amount) {
    out.push('', `${ENTRIES.get('amount')!.aliases[0]}: ${p.amount}`);
  }
  for (const [title, keys] of SECTIONS) {
    const lines = keys.map((k) => settingLine(k, p)).filter((l) => l !== null);
    if (lines.length) out.push('', `[${vocab.sectionTitles[title]}]`, ...lines);
  }
  if (doc.notes) out.push('', `[${vocab.sections.notes[0]}]`, ...textLines(doc.notes));
  if (doc.preserve) out.push('', `[${vocab.sections.preserve[0]}]`, ...textLines(doc.preserve));
  return `${out.join('\n')}\n`;
}
