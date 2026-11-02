import { DEFAULT_PARAMS, PARAMS, type ParamDef, type ParamKey, type Params } from '../schema';
import { suggestHeading } from './suggest';
import {
  attributes,
  bandWords,
  headings,
  message,
  metaKinds,
  norm,
  scan,
  sectionKinds,
  tintWords,
  vocab,
  wordsFor,
  type BandEntry,
  type TintEntry,
  type Word,
} from './vocabulary';

export interface SgpWarning {
  line: number;
  message: string;
  suggestion?: string;
}

export interface SgpResult {
  params: Params;
  name: string;
  tags: string[];
  notes: string;
  preserve: string;
  warnings: SgpWarning[];
  matched: number;
}

type ScalarResult = { value: number; warn?: string } | { error: string };
type Settings = Partial<Record<ParamKey, number>>;

const MAX_NAME = 80;
const MAX_TAGS = 20;
/** Suggestions are costly, and a file with thousands of bad lines must still parse quickly. */
const MAX_SUGGESTIONS = 20;
const NUMBER = new RegExp(`([+-]?)(\\d+(?:\\.\\d+)?)\\s*(${vocab.degreeWords.join('|')})?`, 'g');

const DEFS = new Map<string, ParamDef>(PARAMS.map((p) => [p.key, p]));
const defOf = (key: string) => DEFS.get(key)!;

const clampTo = (d: ParamDef, v: number) => Math.round(Math.min(d.max, Math.max(d.min, v))) + 0;

/** Contents of the last closed (...) group, or null. Scans once so unbalanced input stays linear. */
function lastParenGroup(s: string): string | null {
  let group: string | null = null;
  for (let open = s.indexOf('('); open >= 0;) {
    const close = s.indexOf(')', open + 1);
    if (close < 0) break;
    group = s.slice(open + 1, close);
    open = s.indexOf('(', close + 1);
  }
  return group;
}

interface Num {
  value: number;
  signed: boolean;
  degree: boolean;
}

/** Numbers in a value, preferring those inside the last (...) group. */
function numbers(raw: string): Num[] {
  const s = raw.replace(/[−–]/g, '-').replace(/([+-])\s+/g, '$1');
  const src = lastParenGroup(s) ?? s;
  return [...src.matchAll(NUMBER)].map((m) => ({
    value: Number((m[1] === '-' ? '-' : '') + m[2]),
    signed: m[1] !== '',
    degree: !!m[3],
  }));
}

const has = (hits: readonly Word[], kind: Word['kind']) => hits.some((h) => h.kind === kind);
const first = (hits: readonly Word[], kind: Word['kind']) => hits.find((h) => h.kind === kind);

function parseScalar(raw: string, d: ParamDef, words: readonly Word[]): ScalarResult {
  const hits = scan(norm(raw), words);
  const neg = has(hits, 'neg');
  const pos = has(hits, 'pos');
  const nums = numbers(raw).filter((x) => !x.degree);
  const num = nums[0];
  if (num) {
    if (!num.signed && neg && d.min >= 0) return { value: d.min, warn: message('noNegative') };
    return { value: clampTo(d, !num.signed && neg ? -Math.abs(num.value) : num.value) };
  }
  if (has(hits, 'neutral')) return { value: d.default };
  const special = first(hits, 'special');
  if (special) return { value: clampTo(d, special.value) };
  const level = first(hits, 'int');
  if (!level && !pos && !neg) return { error: message('noValue') };
  const magnitude = level ? level.value : vocab.defaultIntensity;
  if (d.min >= 0) {
    if (neg) return { value: d.min, warn: message('noNegative') };
    return { value: clampTo(d, magnitude) };
  }
  return { value: clampTo(d, neg ? -magnitude : magnitude) };
}

function parseTint(raw: string, t: TintEntry): { set: Settings } | { error: string } {
  const hueDef = defOf(t.hueKey);
  const satDef = defOf(t.satKey);
  const hits = scan(norm(raw), tintWords);
  if (has(hits, 'neutral')) return { set: { [t.satKey]: 0 } };

  const nums = numbers(raw);
  const set: Settings = {};
  const degree = nums.find((x) => x.degree && Number.isFinite(x.value));
  const color = first(hits, 'color');
  if (degree) {
    const inRange = degree.value >= 0 && degree.value <= 360;
    set[t.hueKey] = clampTo(hueDef, inRange ? degree.value : ((degree.value % 360) + 360) % 360);
  } else if (color) {
    set[t.hueKey] = color.value;
  }
  const strength = nums.find((x) => !x.degree);
  const level = first(hits, 'int');
  set[t.satKey] = strength
    ? clampTo(satDef, strength.value)
    : level
      ? level.value
      : vocab.defaultIntensity;
  if (!(t.hueKey in set)) return { error: message('tintNeedsColor') };
  return { set };
}

function parseBand(raw: string, band: BandEntry): { set: Settings; warnings: string[] } {
  const set: Settings = {};
  const warnings: string[] = [];
  for (const part of raw.split(/[,،、]/)) {
    const p = part.trim();
    if (!p) continue;
    const normalized = norm(p);
    const attribute = attributes.find((a) => normalized.startsWith(a.w));
    if (!attribute) {
      warnings.push(message('bandNeedsAttribute', { part: p }));
      continue;
    }
    // Strip the attribute word, which may contain spaces in the raw text.
    let rest = p;
    let consumed = 0;
    for (let i = 0; i < p.length && consumed < attribute.w.length; i++) {
      if (!/\s/.test(p[i]!)) {
        consumed++;
        rest = p.slice(i + 1);
      }
    }
    const key = `${attribute.prefix}${band.id}` as ParamKey;
    const result = parseScalar(rest, defOf(key), bandWords);
    if ('error' in result) warnings.push(`${p}: ${result.error}`);
    else set[key] = result.value;
  }
  return { set, warnings };
}

/** Reads SGP text. Never throws: anything it cannot read becomes a line-numbered warning. */
export function parseSGP(text: string): SgpResult {
  const params = { ...DEFAULT_PARAMS };
  const result: SgpResult = {
    params,
    name: '',
    tags: [],
    notes: '',
    preserve: '',
    warnings: [],
    matched: 0,
  };
  const seen = new Map<ParamKey, number>();
  const notes: string[] = [];
  const preserve: string[] = [];
  let section: 'settings' | 'notes' | 'preserve' = 'settings';
  let suggestions = 0;

  const warn = (line: number, text: string) => result.warnings.push({ line, message: text });
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i]!.trim();
    const inText = section !== 'settings';
    const keep = section === 'notes' ? notes : preserve;

    if (inText && raw.startsWith('\\')) {
      keep.push(raw.slice(1));
      continue;
    }
    if (inText && (!raw || raw.startsWith('//'))) {
      keep.push(raw);
      continue;
    }

    let line = raw.replace(/\/\/.*$/, '').trim();
    if (!line || line.startsWith('```')) continue; // fences come from replies pasted from chat

    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      section = sectionKinds.get(norm(header[1]!)) ?? 'settings';
      continue;
    }

    if (line.startsWith('#')) {
      const meta = raw.replace(/^#+/, '').match(/^([^:：]+)[:：](.*)$/);
      if (meta) {
        const kind = metaKinds.get(norm(meta[1]!));
        if (kind === 'name') result.name = meta[2]!.trim().slice(0, MAX_NAME);
        if (kind === 'tags') {
          result.tags = meta[2]!
            .split(/[,،、]/)
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, MAX_TAGS);
        }
      }
      continue;
    }

    if (inText) {
      keep.push(raw);
      continue;
    }

    line = line.replace(/^[-*•]\s*/, '');
    const setting = line.match(/^([^:：]+)[:：](.*)$/);
    if (!setting) {
      warn(lineNo, message('noColon'));
      continue;
    }
    const label = setting[1]!.trim();
    const value = setting[2]!.trim();
    const heading = headings.get(norm(setting[1]!));
    if (!heading) {
      const suggestion = suggestions < MAX_SUGGESTIONS ? suggestHeading(label) : undefined;
      suggestions++;
      result.warnings.push({
        line: lineNo,
        message: message('unknownHeading', { heading: label }),
        ...(suggestion !== undefined && { suggestion }),
      });
      continue;
    }

    let set: Settings = {};
    if (heading.type === 'param') {
      const parsed = parseScalar(value, defOf(heading.def.key), wordsFor(heading.def.key));
      if ('error' in parsed) {
        warn(lineNo, `${label}: ${parsed.error}`);
        continue;
      }
      if (parsed.warn) warn(lineNo, `${label}: ${parsed.warn}`);
      set[heading.def.key] = parsed.value;
    } else if (heading.type === 'tint') {
      const parsed = parseTint(value, heading.def);
      if ('error' in parsed) {
        warn(lineNo, `${label}: ${parsed.error}`);
        continue;
      }
      set = parsed.set;
    } else {
      const parsed = parseBand(value, heading.def);
      for (const text of parsed.warnings) warn(lineNo, text);
      set = parsed.set;
    }

    for (const [k, v] of Object.entries(set) as [ParamKey, number][]) {
      const earlier = seen.get(k);
      if (earlier !== undefined) warn(lineNo, message('duplicate', { key: k, line: earlier }));
      seen.set(k, lineNo);
      params[k] = v;
      result.matched++;
    }
  }

  result.notes = notes.join('\n').trim();
  result.preserve = preserve.join('\n').trim();
  return result;
}
