import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import * as reference from '../../../reference/sgp-reference.mjs';
import {
  BUILTIN_PRESETS,
  buildBridgeInstruction,
  buildTemplate,
  DEFAULT_PARAMS,
  PARAM_KEYS,
  PARAMS,
  parseSGP,
  serializeSGP,
  suggestHeading,
  type Params,
} from '../src';
import { vocab } from '../src/sgp/vocabulary';
import { ROOT } from './support/images';

const D = DEFAULT_PARAMS;
const changed = (p: Params) =>
  Object.fromEntries(Object.entries(p).filter(([k, v]) => v !== D[k as keyof Params]));
const seedDir = resolve(ROOT, 'seed/structured-prompts');
const seedFile = (f: string) => readFileSync(resolve(seedDir, f), 'utf8');
const bridgeFile = () => readFileSync(resolve(ROOT, 'seed/sgp-bridge-instruction.md'), 'utf8');

describe('acceptance cases from reference/sgp-reference.test.mjs', () => {
  test('round-trip: serialize then parse gives identical params for every built-in preset', () => {
    for (const p of BUILTIN_PRESETS) {
      const r = parseSGP(serializeSGP({ name: p.name, tags: p.tags, params: p.params }));
      expect(r.params, p.id).toEqual(p.params);
      expect(r.warnings, p.id).toEqual([]);
      expect(r.name).toBe(p.name);
    }
  });

  test('seed structured prompts parse without warnings', () => {
    for (const f of readdirSync(seedDir)) {
      const r = parseSGP(seedFile(f));
      expect(r.warnings, f).toEqual([]);
      expect(r.matched, f).toBeGreaterThan(0);
    }
  });

  test('empty text gives neutral params', () => {
    expect(parseSGP('').params).toEqual(D);
  });

  test('Thai words map to the intensity scale with direction', () => {
    const r = parseSGP(
      'ความสว่าง: สว่างขึ้น เล็กน้อย\nเงา: ลึก มาก\nอุณหภูมิ: อุ่น\nคอนทราสต์: นุ่ม นิดเดียว',
    );
    expect(changed(r.params)).toEqual({ exposure: 20, shadows: -65, temp: 35, contrast: -10 });
  });

  test('numbers win over words; unsigned number + negative word is negative', () => {
    const r = parseSGP('เงา: ยก มาก (+12)\nไฮไลต์: ลด 30\nเกรน: 999');
    expect(changed(r.params)).toEqual({ shadows: 12, highlights: -30, grain: 100 });
  });

  test('composite tint and band lines', () => {
    const r = parseSGP(
      'สีเงา: เขียวอมฟ้า ชัด\nสีไฮไลต์: 40°, 30\nม่วง: อิ่ม เพิ่ม ปานกลาง, สว่างขึ้น นิดเดียว, เฉด -5',
    );
    expect(changed(r.params)).toEqual({
      shHue: 188,
      shSat: 50,
      hiSat: 30,
      sP: 35,
      lP: 10,
      hP: -5,
    });
    expect(r.params.hiHue).toBe(40);
  });

  test('special words', () => {
    const r = parseSGP('ความอิ่มสี: ขาวดำ\nระยะหมอก: ยาว');
    expect(changed(r.params)).toEqual({ saturation: -100, reach: 70 });
  });

  test('English aliases work', () => {
    const r = parseSGP(
      'exposure: brighter slight\nshadow tint: teal moderate\nblue: sat less moderate',
    );
    expect(changed(r.params)).toEqual({ exposure: 20, shHue: 188, shSat: 35, sB: -35 });
  });

  test('unknown keys, missing colon and duplicates produce line-numbered warnings', () => {
    const r = parseSGP('อะไรสักอย่าง: มาก\nไม่มีโคลอน\nเกรน: เล็กน้อย\nเกรน: มาก');
    expect(r.warnings.map((w) => w.line)).toEqual([1, 2, 4]);
    expect(r.params.grain).toBe(65);
  });

  test('notes and preserve sections are kept as text and never parsed', () => {
    const r = parseSGP('[หมายเหตุ]\nความสว่าง: มากที่สุด\n[ห้ามเปลี่ยน]\nใบหน้า');
    expect(r.params.exposure).toBe(0);
    expect(r.notes).toBe('ความสว่าง: มากที่สุด');
    expect(r.preserve).toBe('ใบหน้า');
  });

  test('one-sided parameter with a negative word goes to its minimum with a warning', () => {
    const r = parseSGP('เกรน: ลด');
    expect(r.params.grain).toBe(0);
    expect(r.warnings).toHaveLength(1);
  });

  test('a negative word beats an unsigned number on a one-sided parameter', () => {
    const r = parseSGP('เกรน: ลด 30\nความเข้มรวม: ลด\nระยะหมอก: ลด');
    expect([r.params.grain, r.params.amount, r.params.reach]).toEqual([0, 0, 0]);
    expect(r.warnings).toHaveLength(3);
  });

  test('a degree too long to be a finite number never yields NaN', () => {
    const huge = '9'.repeat(400);
    const named = parseSGP(`สีเงา: เขียว เล็กน้อย (${huge}°, 20)`);
    expect([named.params.shHue, named.params.shSat]).toEqual([125, 20]);
    const bare = parseSGP(`สีเงา: (${huge}°, 20)`);
    expect(bare.params.shHue).toBe(D.shHue);
    expect(bare.warnings).toHaveLength(1);
  });

  test('text sections round-trip verbatim and can never set a parameter', () => {
    const notes =
      'ดู https://example.com/a\n\n// คงไว้\n# ชื่อ: ถูกแทน\n[แสง]\nความสว่าง: มาก\n\\เดิม\n```';
    const preserve = '[ใบหน้า]\n# ท่าทาง';
    const r = parseSGP(serializeSGP({ name: 'เดิม', params: D, notes, preserve }));
    expect(r.notes).toBe(notes);
    expect(r.preserve).toBe(preserve);
    expect(r.name).toBe('เดิม');
    expect(r.params).toEqual(D);
    expect(r.warnings).toEqual([]);
  });

  test('names and tags stay on one line and can never set a parameter', () => {
    const text = serializeSGP({ name: 'ก//ข\nเงา: มาก', tags: ['ค,ง\nเกรน: มาก'], params: D });
    const r = parseSGP(text);
    expect(r.name).toBe('ก//ข เงา: มาก');
    expect(r.tags).toEqual(['ค ง เกรน: มาก']);
    expect(r.params).toEqual(D);
    expect(r.warnings).toEqual([]);
  });

  test('a 64 KB hostile line parses in linear time', () => {
    for (const value of ['a' + ' '.repeat(64000) + 'b', '('.repeat(64000), '+ '.repeat(32000)]) {
      const t0 = performance.now();
      parseSGP(`เงา: ${value}`);
      expect(performance.now() - t0, value.slice(0, 8)).toBeLessThan(500);
    }
  });

  test('a reply pasted from chat with code fences and unicode minus parses cleanly', () => {
    const r = parseSGP('```text\n# ชื่อ: ทดสอบ\nเงา: ลึก ปานกลาง (−30)\n```');
    expect(r.warnings).toEqual([]);
    expect(r.params.shadows).toBe(-30);
    expect(r.name).toBe('ทดสอบ');
  });
});

const paramsArb = fc.record(
  Object.fromEntries(
    PARAMS.map((p) => [
      p.key,
      fc.oneof(fc.constant(p.default), fc.integer({ min: p.min, max: p.max })),
    ]),
  ),
) as fc.Arbitrary<Params>;

describe('properties', () => {
  test('round-trip holds for 1,000 random parameter sets', () => {
    fc.assert(
      fc.property(paramsArb, (params) => {
        const r = parseSGP(serializeSGP({ name: 'r', params }));
        expect(r.params).toEqual(params);
        expect(r.warnings).toEqual([]);
      }),
      { numRuns: 1000 },
    );
  });

  test('any text returns values in range, and never throws', () => {
    const valid = (r: ReturnType<typeof parseSGP>) => {
      for (const p of PARAMS) {
        const v = r.params[p.key];
        if (!Number.isInteger(v) || v < p.min || v > p.max) throw new Error(`${p.key} = ${v}`);
      }
    };
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => valid(parseSGP(text))),
      { numRuns: 1000 },
    );
    const words = [
      ...vocab.params.flatMap((p) => p.aliases),
      ...vocab.tints.flatMap((t) => t.aliases),
      ...vocab.bands.flatMap((b) => b.aliases),
      ...vocab.intensity.flatMap((x) => x.words),
      ...vocab.positive,
      ...vocab.negative,
      ...vocab.neutral,
      ...vocab.colors.flatMap((c) => c.words),
      ':',
      '(',
      ')',
      '°',
      ',',
      '-',
      '+',
      '12',
      '999',
      '\n',
      ' ',
      '[หมายเหตุ]',
      '#',
      '//',
      '`'.repeat(3),
    ];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...words), { maxLength: 40 }), (tokens) =>
        valid(parseSGP(tokens.join(' '))),
      ),
      { numRuns: 2000 },
    );
  });

  test('the port matches the reference on vocabulary-shaped text', () => {
    const { schema, vocab: refVocab } = reference.loadDefaults();
    const line = fc
      .tuple(
        fc.constantFrom(
          ...vocab.params.flatMap((p) => p.aliases),
          ...vocab.tints.map((t) => t.aliases[0]!),
          ...vocab.bands.map((b) => b.aliases[0]!),
        ),
        fc.array(
          fc.constantFrom(
            ...vocab.intensity.flatMap((x) => x.words),
            ...vocab.positive,
            ...vocab.negative,
            ...vocab.neutral,
            ...vocab.colors.flatMap((c) => c.words),
            'อิ่ม',
            'สว่าง',
            'เฉด',
            ',',
            '(+25)',
            '-40',
            '120°',
            '35',
          ),
          { maxLength: 6 },
        ),
      )
      .map(([heading, value]) => `${heading}: ${value.join(' ')}`);
    fc.assert(
      fc.property(fc.array(line, { maxLength: 12 }), (lines) => {
        const text = lines.join('\n');
        const ours = parseSGP(text);
        const theirs = reference.parseSGP(text, schema, refVocab);
        expect(ours.params).toEqual(theirs.params);
        expect(ours.warnings.map((w) => [w.line, w.message])).toEqual(
          theirs.warnings.map((w) => [w.line, w.message]),
        );
      }),
      { numRuns: 1500 },
    );
  });

  test('the serializer writes the same text as the reference', () => {
    const { schema, vocab: refVocab } = reference.loadDefaults();
    for (const p of BUILTIN_PRESETS) {
      const doc = { name: p.name, tags: p.tags, params: p.params };
      expect(serializeSGP(doc)).toBe(reference.serializeSGP(doc, schema, refVocab));
    }
  });
});

describe('seed files and the chat instruction', () => {
  test('all six seed files match their built-in presets on every parameter', () => {
    const files = readdirSync(seedDir);
    expect(files).toHaveLength(6);
    for (const f of files) {
      const r = parseSGP(seedFile(f));
      const preset = BUILTIN_PRESETS.find((p) => p.name === r.name);
      expect(preset, f).toBeDefined();
      expect(r.params, f).toEqual(preset!.params);
    }
  });

  test('the sample reply in the chat instruction parses with no warnings', () => {
    const sample = /```text\n([\s\S]*?)```/.exec(bridgeFile().replace(/\r\n/g, '\n'))![1]!;
    const r = parseSGP(sample);
    expect(r.warnings).toEqual([]);
    expect(r.params).toEqual(BUILTIN_PRESETS[0]!.params);
  });

  test('the instruction drops its comment and carries the free text, including $ patterns', () => {
    const text = buildBridgeInstruction(bridgeFile(), "  warm $& film $' look  ");
    expect(text.startsWith('<!--')).toBe(false);
    expect(text).toContain("<<<\nwarm $& film $' look\n>>>");
    expect(text).not.toContain('{{FREE_PROMPT}}');
  });

  test('the instruction lists only headings the parser knows', () => {
    const headingLines = bridgeFile()
      .split('\n')
      .filter((l) => l.startsWith('- ') && !l.includes('`'))
      .map((l) => l.slice(2).split(' ')[0]!);
    expect(headingLines.length).toBeGreaterThan(20);
    for (const heading of headingLines) {
      expect(parseSGP(`${heading}: 10`).warnings, heading).toEqual([]);
    }
  });
});

describe('template', () => {
  test('the template lists every parameter and reads as neutral with no warnings', () => {
    const r = parseSGP(buildTemplate());
    expect(r.params).toEqual(D);
    expect(r.warnings).toEqual([]);
  });

  test('every schema key has a heading in the vocabulary', () => {
    const covered = new Set<string>(vocab.params.map((p) => p.key));
    for (const t of vocab.tints) covered.add(t.hueKey).add(t.satKey);
    for (const b of vocab.bands) for (const a of 'hsl') covered.add(a + b.id);
    expect(PARAM_KEYS.filter((k) => !covered.has(k))).toEqual([]);
  });
});

describe('vocabulary', () => {
  test('no word means both directions for one parameter', () => {
    for (const p of vocab.params) {
      const positive = new Set([...vocab.positive, ...(p.positive ?? [])]);
      const both = [...vocab.negative, ...(p.negative ?? [])].filter((w) => positive.has(w));
      expect(both, p.key).toEqual([]);
    }
  });
});

describe('suggestions', () => {
  test('a misspelled heading gets the closest one', () => {
    expect(suggestHeading('ความสวาง')).toBe('ความสว่าง');
    expect(suggestHeading('exposre')).toBe('exposure');
  });

  test('text that resembles nothing gets no suggestion', () => {
    expect(suggestHeading('หัวข้อที่ไม่เหมือนอะไรเลยจริง ๆ นะ')).toBeUndefined();
    expect(suggestHeading('ก'.repeat(100))).toBeUndefined();
  });

  test('unknown headings carry a suggestion in the warning', () => {
    expect(parseSGP('ความสวาง: มาก').warnings[0]!.suggestion).toBe('ความสว่าง');
  });
});

test('2,000 lines parse within 20 ms', () => {
  const text = Array.from({ length: 2000 }, (_, i) => `เงา: ลึก ปานกลาง (${-(i % 100)})`).join(
    '\n',
  );
  const times = Array.from({ length: 7 }, () => {
    const t0 = performance.now();
    parseSGP(text);
    return performance.now() - t0;
  }).sort((a, b) => a - b);
  expect(times[3]).toBeLessThan(20);
});
