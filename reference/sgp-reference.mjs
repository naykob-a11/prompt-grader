// Reference implementation of the Structured Grading Prompt (SGP) parser and serializer.
// Spec: docs/06-structured-prompt-format.md. Vocabulary: seed/sgp-vocabulary.json.
// This file is the behavioral reference for packages/engine/src/sgp/*. Do not edit it
// when porting; if the port must differ, update the spec and this file together.
//
// Usage (Node >= 20):
//   import { loadDefaults, parseSGP, serializeSGP } from './sgp-reference.mjs';
//   const { schema, vocab } = loadDefaults();
//   const result = parseSGP(text, schema, vocab);   // { params, name, tags, notes, preserve, warnings, matched }

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function loadDefaults() {
  const schema = JSON.parse(readFileSync(join(here, '../seed/parameter-schema.json'), 'utf8'));
  const vocab = JSON.parse(readFileSync(join(here, '../seed/sgp-vocabulary.json'), 'utf8'));
  return { schema, vocab };
}

// ---------- helpers ----------
const norm = (s) => s.normalize('NFC').toLowerCase().replace(/[−–]/g, '-').replace(/\s+/g, '');
const byLenDesc = (a, b) => b.length - a.length;

function paramDefs(schema) {
  const defs = {};
  for (const g of schema.groups) for (const p of g.params) defs[p.key] = p;
  return defs;
}
export function defaultParams(schema) {
  const out = {};
  for (const [k, d] of Object.entries(paramDefs(schema))) out[k] = d.default;
  return out;
}
const clampTo = (d, v) => Math.round(Math.min(d.max, Math.max(d.min, v))) + 0; // +0 normalizes -0

/** Find words (normalized) in a normalized string, longest first, consuming each match. */
function scan(text, dict) {
  // dict: array of {word, ...payload}; returns matched payloads in order of length priority
  let rest = text;
  const hits = [];
  for (const entry of [...dict].sort((a, b) => byLenDesc(a.w, b.w))) {
    if (!entry.w) continue;
    const i = rest.indexOf(entry.w);
    if (i >= 0) {
      hits.push(entry);
      rest = rest.slice(0, i) + '\u0000'.repeat(entry.w.length) + rest.slice(i + entry.w.length);
    }
  }
  return hits;
}

/** Contents of the last closed (...) group, or null. Scans once so unbalanced input stays linear. */
function lastParenGroup(s) {
  let group = null;
  for (let open = s.indexOf('('); open >= 0;) {
    const close = s.indexOf(')', open + 1);
    if (close < 0) break;
    group = s.slice(open + 1, close);
    open = s.indexOf('(', close + 1);
  }
  return group;
}

/** Numbers: prefer those inside the last (...) group; returns [{value, signed, degree}] */
function numbers(raw) {
  const s = raw.replace(/[−–]/g, '-').replace(/([+-])\s+/g, '$1');
  const group = lastParenGroup(s);
  const src = group === null ? s : group;
  const out = [];
  for (const m of src.matchAll(/([+-]?)(\d+(?:\.\d+)?)\s*(°|องศา)?/g)) {
    out.push({ value: Number((m[1] === '-' ? '-' : '') + m[2]), signed: m[1] !== '', degree: !!m[3] });
  }
  return out;
}

function buildIndex(vocab) {
  const intensity = vocab.intensity.flatMap((x) => x.words.map((w) => ({ w: norm(w), kind: 'int', value: x.value })));
  const generic = [
    ...vocab.positive.map((w) => ({ w: norm(w), kind: 'pos' })),
    ...vocab.negative.map((w) => ({ w: norm(w), kind: 'neg' })),
    ...vocab.neutral.map((w) => ({ w: norm(w), kind: 'neutral' })),
  ];
  const colors = vocab.colors.flatMap((c) => c.words.map((w) => ({ w: norm(w), kind: 'color', hue: c.hue })));
  const keys = new Map(); // normalized alias -> descriptor
  for (const p of vocab.params) for (const a of p.aliases) keys.set(norm(a), { type: 'param', def: p });
  for (const t of vocab.tints) for (const a of t.aliases) keys.set(norm(a), { type: 'tint', def: t });
  for (const b of vocab.bands) for (const a of b.aliases) keys.set(norm(a), { type: 'band', def: b });
  const attrs = vocab.bandAttributes.flatMap((x) => x.aliases.map((a) => ({ w: norm(a), prefix: x.prefix }))).sort((a, b) => byLenDesc(a.w, b.w));
  const sectionKind = new Map();
  for (const [kind, list] of Object.entries(vocab.sections)) for (const a of list) sectionKind.set(norm(a), kind);
  const meta = new Map();
  for (const [kind, list] of Object.entries(vocab.meta)) for (const a of list) meta.set(norm(a), kind);
  return { intensity, generic, colors, keys, attrs, sectionKind, meta, defaultIntensity: vocab.defaultIntensity };
}

/**
 * Parse a scalar value for parameter def `d`.
 * pdef: vocab param entry (may carry positive/negative/special); returns {value} or {error}
 */
const NO_NEGATIVE = 'ค่านี้ไม่มีทิศลบ ใช้ค่าต่ำสุดแทน';

function parseScalar(raw, d, pdef, idx) {
  const n = norm(raw);
  const dict = [
    ...idx.intensity,
    ...idx.generic,
    ...((pdef && pdef.positive) || []).map((w) => ({ w: norm(w), kind: 'pos' })),
    ...((pdef && pdef.negative) || []).map((w) => ({ w: norm(w), kind: 'neg' })),
    ...Object.entries((pdef && pdef.special) || {}).map(([w, v]) => ({ w: norm(w), kind: 'special', value: v })),
  ];
  const hits = scan(n, dict);
  const nums = numbers(raw).filter((x) => !x.degree);
  const neg = hits.some((h) => h.kind === 'neg');
  const pos = hits.some((h) => h.kind === 'pos');
  if (nums.length) {
    const x = nums[0];
    if (!x.signed && neg && d.min >= 0) return { value: d.min, warn: NO_NEGATIVE };
    let v = x.value;
    if (!x.signed && neg) v = -Math.abs(v);
    return { value: clampTo(d, v) };
  }
  if (hits.some((h) => h.kind === 'neutral')) return { value: d.default };
  const sp = hits.find((h) => h.kind === 'special');
  if (sp) return { value: clampTo(d, sp.value) };
  const it = hits.find((h) => h.kind === 'int');
  if (!it && !pos && !neg) return { error: 'ไม่พบคำบอกระดับหรือตัวเลข' };
  const mag = it ? it.value : idx.defaultIntensity;
  if (d.min >= 0) {
    if (neg) return { value: d.min, warn: NO_NEGATIVE };
    return { value: clampTo(d, mag) };
  }
  return { value: clampTo(d, neg ? -mag : mag) };
}

function parseTint(raw, t, defs, idx) {
  const hueDef = defs[t.hueKey], satDef = defs[t.satKey];
  const n = norm(raw);
  const hits = scan(n, [...idx.colors, ...idx.intensity, ...idx.generic]);
  if (hits.some((h) => h.kind === 'neutral')) return { set: { [t.satKey]: 0 } };
  const nums = numbers(raw);
  const set = {};
  const deg = nums.find((x) => x.degree && Number.isFinite(x.value));
  const color = hits.find((h) => h.kind === 'color');
  if (deg) set[t.hueKey] = clampTo(hueDef, deg.value >= 0 && deg.value <= 360 ? deg.value : ((deg.value % 360) + 360) % 360);
  else if (color) set[t.hueKey] = color.hue;
  const strength = nums.find((x) => !x.degree);
  const it = hits.find((h) => h.kind === 'int');
  if (strength) set[t.satKey] = clampTo(satDef, strength.value);
  else set[t.satKey] = it ? it.value : idx.defaultIntensity;
  if (!(t.hueKey in set)) return { error: 'ระบุสีด้วยชื่อสีหรือองศา เช่น "เขียวอมฟ้า" หรือ "188°"' };
  return { set };
}

function parseBand(raw, band, defs, idx) {
  const set = {}, warns = [];
  for (const part of raw.split(/[,،、]/)) {
    const p = part.trim();
    if (!p) continue;
    const np = norm(p);
    const attr = idx.attrs.find((a) => np.startsWith(a.w));
    if (!attr) { warns.push(`ไม่รู้ว่า "${p}" ปรับอะไร ขึ้นต้นด้วย อิ่ม / สว่าง / เฉด`); continue; }
    const key = attr.prefix + band.id;
    // strip the attribute word from the raw part
    let rest = p, consumed = 0;
    for (let i = 0; i < p.length && consumed < attr.w.length; i++) if (!/\s/.test(p[i])) { consumed++; rest = p.slice(i + 1); }
    const r = parseScalar(rest, defs[key], null, idx);
    if (r.error) warns.push(`${p}: ${r.error}`); else set[key] = r.value;
  }
  return { set, warns };
}

// ---------- parser ----------
export function parseSGP(text, schema, vocab) {
  const defs = paramDefs(schema);
  const idx = buildIndex(vocab);
  const params = defaultParams(schema);
  const res = { params, name: '', tags: [], notes: '', preserve: '', warnings: [], matched: 0 };
  const seen = new Map();
  let section = 'settings';
  const notes = [], preserve = [];

  text.replace(/\r\n?/g, '\n').split('\n').forEach((line0, i) => {
    const lineNo = i + 1;
    const raw = line0.trim();
    const inText = section === 'notes' || section === 'preserve';
    const keepText = (t) => (section === 'notes' ? notes : preserve).push(t);
    if (inText && raw.startsWith('\\')) { keepText(raw.slice(1)); return; } // escaped by the serializer
    if (inText && (!raw || raw.startsWith('//'))) { keepText(raw); return; }
    let line = raw.replace(/\/\/.*$/, '').trim();
    if (!line || line.startsWith('```')) return; // code fences from a pasted chat reply are ignored
    // section header
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) { section = idx.sectionKind.get(norm(sec[1])) || 'settings'; return; }
    // meta line: "# key: value"
    if (line.startsWith('#')) {
      const m = raw.replace(/^#+/, '').match(/^([^:：]+)[:：](.*)$/);
      if (m) {
        const kind = idx.meta.get(norm(m[1]));
        if (kind === 'name') res.name = m[2].trim().slice(0, 80);
        else if (kind === 'tags') res.tags = m[2].split(/[,،、]/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
      }
      return;
    }
    if (inText) { keepText(raw); return; }
    line = line.replace(/^[-*•]\s*/, '');
    const m = line.match(/^([^:：]+)[:：](.*)$/);
    if (!m) { res.warnings.push({ line: lineNo, message: 'ไม่มีเครื่องหมาย ":" — ข้ามบรรทัดนี้' }); return; }
    const key = idx.keys.get(norm(m[1]));
    if (!key) { res.warnings.push({ line: lineNo, message: `ไม่รู้จักหัวข้อ "${m[1].trim()}"` }); return; }
    const value = m[2].trim();
    let set = {};
    if (key.type === 'param') {
      const d = defs[key.def.key];
      const r = parseScalar(value, d, key.def, idx);
      if (r.error) { res.warnings.push({ line: lineNo, message: `${m[1].trim()}: ${r.error}` }); return; }
      if (r.warn) res.warnings.push({ line: lineNo, message: `${m[1].trim()}: ${r.warn}` });
      set[key.def.key] = r.value;
    } else if (key.type === 'tint') {
      const r = parseTint(value, key.def, defs, idx);
      if (r.error) { res.warnings.push({ line: lineNo, message: `${m[1].trim()}: ${r.error}` }); return; }
      set = r.set;
    } else {
      const r = parseBand(value, key.def, defs, idx);
      r.warns.forEach((w) => res.warnings.push({ line: lineNo, message: w }));
      set = r.set;
    }
    for (const [k, v] of Object.entries(set)) {
      if (seen.has(k)) res.warnings.push({ line: lineNo, message: `ตั้งค่า ${k} ซ้ำ (บรรทัด ${seen.get(k)}) ใช้ค่าบรรทัดล่าสุด` });
      seen.set(k, lineNo);
      params[k] = v;
      res.matched++;
    }
  });
  res.notes = notes.join('\n').trim();
  res.preserve = preserve.join('\n').trim();
  return res;
}

// ---------- serializer ----------
const SECTIONS = [
  ['แสง', ['exposure', 'contrast', 'highlights', 'shadows', 'dehaze']],
  ['สี', ['temp', 'tint', 'castFix', 'saturation', 'vibrance', 'guard']],
  ['ใบไม้', ['teal', 'forest', 'sun']],
  ['โทนเงาและไฮไลต์', ['@tint:shHue', '@tint:hiHue']],
  ['ปรับรายสี', ['@band:R', '@band:Y', '@band:G', '@band:A', '@band:B', '@band:P']],
  ['บรรยากาศและฟิล์ม', ['haze', 'reach', 'hazeTemp', 'fade', 'grain', 'vignette']],
  ['รายละเอียด', ['sharpen', 'denoise']],
];

function nearestIntensity(vocab, mag) {
  let best = vocab.intensity[0];
  for (const x of vocab.intensity) if (Math.abs(x.value - mag) < Math.abs(best.value - mag)) best = x;
  return best.words[0];
}
function nearestColor(vocab, hue) {
  let best = vocab.colors[0], bd = 999;
  for (const c of vocab.colors) { let d = Math.abs(c.hue - hue); d = Math.min(d, 360 - d); if (d < bd) { bd = d; best = c; } }
  return best.words[0];
}
const signed = (v) => (v > 0 ? '+' + v : String(v));
const metaValue = (s) => s.replace(/\s+/g, ' ').trim();
const metaTag = (s) => s.replace(/[,،、\s]+/g, ' ').trim();
/** Text-section lines; anything the parser would read as structure gets a leading backslash. */
const textLines = (t) => t.trim().split(/\r\n?|\n/).map((l) => l.trim()).map((l) => (/^(\\|\[|#|```)/.test(l) ? '\\' + l : l));

export function serializeSGP(preset, schema, vocab) {
  const defs = paramDefs(schema);
  const p = { ...defaultParams(schema), ...preset.params };
  const vp = Object.fromEntries(vocab.params.map((x) => [x.key, x]));
  const out = [];
  if (preset.name) out.push(`# ${vocab.meta.name[0]}: ${metaValue(preset.name)}`);
  if (preset.tags && preset.tags.length) out.push(`# ${vocab.meta.tags[0]}: ${preset.tags.map(metaTag).join(', ')}`);
  out.push(`# ${vocab.meta.version[0]}: ${vocab.version}`);
  if (p.amount !== defs.amount.default) out.push('', `${vp.amount.aliases[0]}: ${p.amount}`);

  const scalarLine = (k) => {
    const d = defs[k], v = p[k], pd = vp[k];
    if (v === d.default) return null;
    if (pd.special) {
      const sp = Object.entries(pd.special).find(([, x]) => x === v);
      if (sp) return `${pd.aliases[0]}: ${sp[0]} (${d.min < 0 ? signed(v) : v})`;
    }
    if (v === 0) return `${pd.aliases[0]}: ${vocab.neutral[0]} (0)`;
    if (d.min >= 0) {
      if (k === 'reach') {
        const sp = Object.entries(pd.special).reduce((a, b) => (Math.abs(b[1] - v) < Math.abs(a[1] - v) ? b : a));
        return `${pd.aliases[0]}: ${sp[0]} (${v})`;
      }
      return `${pd.aliases[0]}: ${nearestIntensity(vocab, v)} (${v})`;
    }
    const dir = v > 0 ? (pd.positive ? pd.positive[0] : vocab.positive[0]) : (pd.negative ? pd.negative[0] : vocab.negative[0]);
    return `${pd.aliases[0]}: ${dir} ${nearestIntensity(vocab, Math.abs(v))} (${signed(v)})`;
  };

  for (const [title, keys] of SECTIONS) {
    const lines = [];
    for (const k of keys) {
      if (k.startsWith('@tint:')) {
        const t = vocab.tints.find((x) => x.hueKey === k.slice(6));
        if (p[t.satKey] === 0) {
          if (p[t.hueKey] !== defs[t.hueKey].default) lines.push(`${t.aliases[0]}: ${nearestColor(vocab, p[t.hueKey])} (${p[t.hueKey]}°, 0)`);
          continue;
        }
        lines.push(`${t.aliases[0]}: ${nearestColor(vocab, p[t.hueKey])} ${nearestIntensity(vocab, p[t.satKey])} (${p[t.hueKey]}°, ${p[t.satKey]})`);
      } else if (k.startsWith('@band:')) {
        const b = vocab.bands.find((x) => x.id === k.slice(6));
        const parts = [];
        for (const a of ['s', 'l', 'h']) {
          const v = p[a + b.id];
          if (!v) continue;
          const attr = vocab.bandAttributes.find((x) => x.prefix === a).aliases[1];
          parts.push(`${attr} ${v > 0 ? vocab.positive[0] : vocab.negative[0]} ${nearestIntensity(vocab, Math.abs(v))} (${signed(v)})`);
        }
        if (parts.length) lines.push(`${b.aliases[1]}: ${parts.join(', ')}`);
      } else {
        const l = scalarLine(k);
        if (l) lines.push(l);
      }
    }
    if (lines.length) out.push('', `[${title}]`, ...lines);
  }
  if (preset.notes) out.push('', `[${vocab.sections.notes[0]}]`, ...textLines(preset.notes));
  if (preset.preserve) out.push('', `[${vocab.sections.preserve[0]}]`, ...textLines(preset.preserve));
  return out.join('\n') + '\n';
}
