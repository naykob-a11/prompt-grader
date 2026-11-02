import raw from '../../../../seed/sgp-vocabulary.json';
import type { ParamKey } from '../schema';

export interface ParamEntry {
  key: ParamKey;
  aliases: string[];
  positive?: string[];
  negative?: string[];
  special?: Record<string, number>;
}

export interface TintEntry {
  hueKey: ParamKey;
  satKey: ParamKey;
  aliases: string[];
}

export interface BandEntry {
  id: 'R' | 'Y' | 'G' | 'A' | 'B' | 'P';
  aliases: string[];
}

export interface Vocabulary {
  version: number;
  intensity: { value: number; words: string[] }[];
  defaultIntensity: number;
  positive: string[];
  negative: string[];
  neutral: string[];
  degreeWords: string[];
  colors: { hue: number; words: string[] }[];
  params: ParamEntry[];
  tints: TintEntry[];
  bands: BandEntry[];
  bandAttributes: { prefix: 's' | 'l' | 'h'; aliases: string[] }[];
  sectionTitles: Record<string, string>;
  messages: Record<string, string>;
  sections: { notes: string[]; preserve: string[] };
  meta: { name: string[]; tags: string[]; version: string[] };
}

export const vocab = raw as unknown as Vocabulary;

/** Thai has no word spaces, so matching is on text with all whitespace removed. */
export const norm = (s: string) =>
  s.normalize('NFC').toLowerCase().replace(/[−–]/g, '-').replace(/\s+/g, '');

export type WordKind = 'int' | 'pos' | 'neg' | 'neutral' | 'color' | 'special';

export interface Word {
  w: string;
  kind: WordKind;
  value: number;
}

const word = (w: string, kind: WordKind, value = 0): Word => ({ w: norm(w), kind, value });
const longestFirst = (words: Word[]) =>
  words.filter((x) => x.w).sort((a, b) => b.w.length - a.w.length);

/** Finds dictionary words in normalized text, longest first, consuming each match. */
export function scan(text: string, sortedWords: readonly Word[]): Word[] {
  let rest = text;
  const hits: Word[] = [];
  for (const entry of sortedWords) {
    const i = rest.indexOf(entry.w);
    if (i >= 0) {
      hits.push(entry);
      rest = rest.slice(0, i) + '\u0000'.repeat(entry.w.length) + rest.slice(i + entry.w.length);
    }
  }
  return hits;
}

const intensity = vocab.intensity.flatMap((x) => x.words.map((w) => word(w, 'int', x.value)));
const generic = [
  ...vocab.positive.map((w) => word(w, 'pos')),
  ...vocab.negative.map((w) => word(w, 'neg')),
  ...vocab.neutral.map((w) => word(w, 'neutral')),
];
const colors = vocab.colors.flatMap((c) => c.words.map((w) => word(w, 'color', c.hue)));

/** Words for values with no parameter of their own, such as colour-band attributes. */
export const bandWords = longestFirst([...intensity, ...generic]);
export const tintWords = longestFirst([...colors, ...intensity, ...generic]);

/** Built once: the parser looks these up for every line. */
const paramWords = new Map(
  vocab.params.map((p) => [
    p.key,
    longestFirst([
      ...intensity,
      ...generic,
      ...(p.positive ?? []).map((w) => word(w, 'pos')),
      ...(p.negative ?? []).map((w) => word(w, 'neg')),
      ...Object.entries(p.special ?? {}).map(([w, v]) => word(w, 'special', v)),
    ]),
  ]),
);

export const wordsFor = (key: ParamKey): readonly Word[] => paramWords.get(key) ?? bandWords;

export type Heading =
  | { type: 'param'; def: ParamEntry }
  | { type: 'tint'; def: TintEntry }
  | { type: 'band'; def: BandEntry };

export const headings = new Map<string, Heading>();
for (const def of vocab.params) {
  for (const alias of def.aliases) headings.set(norm(alias), { type: 'param', def });
}
for (const def of vocab.tints) {
  for (const alias of def.aliases) headings.set(norm(alias), { type: 'tint', def });
}
for (const def of vocab.bands) {
  for (const alias of def.aliases) headings.set(norm(alias), { type: 'band', def });
}

export const attributes = vocab.bandAttributes
  .flatMap((x) => x.aliases.map((a) => ({ w: norm(a), prefix: x.prefix })))
  .sort((a, b) => b.w.length - a.w.length);

export const sectionKinds = new Map<string, 'notes' | 'preserve'>([
  ...vocab.sections.notes.map((a) => [norm(a), 'notes'] as const),
  ...vocab.sections.preserve.map((a) => [norm(a), 'preserve'] as const),
]);

export const metaKinds = new Map<string, 'name' | 'tags' | 'version'>([
  ...vocab.meta.name.map((a) => [norm(a), 'name'] as const),
  ...vocab.meta.tags.map((a) => [norm(a), 'tags'] as const),
  ...vocab.meta.version.map((a) => [norm(a), 'version'] as const),
]);

/** Fills `{name}` placeholders in a message from the vocabulary file. */
export function message(key: string, vars: Record<string, string | number> = {}): string {
  return (vocab.messages[key] ?? key).replace(/\{(\w+)\}/g, (m, name: string) =>
    String(vars[name] ?? m),
  );
}

/** Canonical headings and value words, for editor highlighting and autocomplete. */
export function editorWords() {
  return {
    headings: [
      ...vocab.params.map((p) => p.aliases[0]!),
      ...vocab.tints.map((t) => t.aliases[0]!),
      ...vocab.bands.map((b) => b.aliases[1] ?? b.aliases[0]!),
    ],
    degrees: vocab.degreeWords,
    levels: vocab.intensity.map((x) => x.words[0]!),
    allLevels: vocab.intensity.flatMap((x) => x.words),
    directions: [
      ...vocab.positive,
      ...vocab.negative,
      ...vocab.neutral,
      ...vocab.params.flatMap((p) => [...(p.positive ?? []), ...(p.negative ?? [])]),
    ],
    colors: vocab.colors.map((c) => c.words[0]!),
  };
}
