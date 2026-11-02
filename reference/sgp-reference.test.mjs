// Run: node --test reference/sgp-reference.test.mjs
// These cases are the acceptance tests for the port in packages/engine/src/sgp/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadDefaults, parseSGP, serializeSGP, defaultParams } from './sgp-reference.mjs';

const { schema, vocab } = loadDefaults();
const D = defaultParams(schema);
const changed = (p) => Object.fromEntries(Object.entries(p).filter(([k, v]) => v !== D[k]));
const presets = JSON.parse(readFileSync(new URL('../seed/builtin-presets.json', import.meta.url), 'utf8')).presets;

test('round-trip: serialize then parse gives identical params for every built-in preset', () => {
  for (const p of presets) {
    const r = parseSGP(serializeSGP({ name: p.name, tags: p.tags, params: p.params }, schema, vocab), schema, vocab);
    assert.deepEqual(r.params, { ...D, ...p.params }, p.id);
    assert.equal(r.warnings.length, 0, p.id);
    assert.equal(r.name, p.name);
  }
});

test('seed structured prompts parse without warnings', () => {
  const dir = new URL('../seed/structured-prompts/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const r = parseSGP(readFileSync(new URL(f, dir), 'utf8'), schema, vocab);
    assert.equal(r.warnings.length, 0, f);
    assert.ok(r.matched > 0, f);
  }
});

test('empty text gives neutral params', () => {
  assert.deepEqual(parseSGP('', schema, vocab).params, D);
});

test('Thai words map to the intensity scale with direction', () => {
  const r = parseSGP('ความสว่าง: สว่างขึ้น เล็กน้อย\nเงา: ลึก มาก\nอุณหภูมิ: อุ่น\nคอนทราสต์: นุ่ม นิดเดียว', schema, vocab);
  assert.deepEqual(changed(r.params), { exposure: 20, shadows: -65, temp: 35, contrast: -10 });
});

test('numbers win over words; unsigned number + negative word is negative', () => {
  const r = parseSGP('เงา: ยก มาก (+12)\nไฮไลต์: ลด 30\nเกรน: 999', schema, vocab);
  assert.deepEqual(changed(r.params), { shadows: 12, highlights: -30, grain: 100 });
});

test('composite tint and band lines', () => {
  const r = parseSGP('สีเงา: เขียวอมฟ้า ชัด\nสีไฮไลต์: 40°, 30\nม่วง: อิ่ม เพิ่ม ปานกลาง, สว่างขึ้น นิดเดียว, เฉด -5', schema, vocab);
  assert.deepEqual(changed(r.params), { shHue: 188, shSat: 50, hiSat: 30, sP: 35, lP: 10, hP: -5 });
  assert.equal(r.params.hiHue, 40);
});

test('special words', () => {
  const r = parseSGP('ความอิ่มสี: ขาวดำ\nระยะหมอก: ยาว', schema, vocab);
  assert.deepEqual(changed(r.params), { saturation: -100, reach: 70 });
});

test('English aliases work', () => {
  const r = parseSGP('exposure: brighter slight\nshadow tint: teal moderate\nblue: sat less moderate', schema, vocab);
  assert.deepEqual(changed(r.params), { exposure: 20, shHue: 188, shSat: 35, sB: -35 });
});

test('unknown keys, missing colon and duplicates produce line-numbered warnings, not errors', () => {
  const r = parseSGP('อะไรสักอย่าง: มาก\nไม่มีโคลอน\nเกรน: เล็กน้อย\nเกรน: มาก', schema, vocab);
  assert.deepEqual(r.warnings.map((w) => w.line), [1, 2, 4]);
  assert.equal(r.params.grain, 65);
});

test('notes and preserve sections are kept as text and never parsed', () => {
  const r = parseSGP('[หมายเหตุ]\nความสว่าง: มากที่สุด\n[ห้ามเปลี่ยน]\nใบหน้า', schema, vocab);
  assert.equal(r.params.exposure, 0);
  assert.equal(r.notes, 'ความสว่าง: มากที่สุด');
  assert.equal(r.preserve, 'ใบหน้า');
});

test('one-sided parameter with a negative word goes to its minimum with a warning', () => {
  const r = parseSGP('เกรน: ลด', schema, vocab);
  assert.equal(r.params.grain, 0);
  assert.equal(r.warnings.length, 1);
});

test('a negative word beats an unsigned number on a one-sided parameter', () => {
  const r = parseSGP('เกรน: ลด 30\nความเข้มรวม: ลด\nระยะหมอก: ลด', schema, vocab);
  assert.equal(r.params.grain, 0);
  assert.equal(r.params.amount, 0);
  assert.equal(r.params.reach, 0);
  assert.equal(r.warnings.length, 3);
});

test('a degree too long to be a finite number never yields NaN', () => {
  const huge = '9'.repeat(400);
  const named = parseSGP(`สีเงา: เขียว เล็กน้อย (${huge}°, 20)`, schema, vocab);
  assert.equal(named.params.shHue, 125);
  assert.equal(named.params.shSat, 20);
  const bare = parseSGP(`สีเงา: (${huge}°, 20)`, schema, vocab);
  assert.equal(bare.params.shHue, D.shHue);
  assert.equal(bare.warnings.length, 1);
});

test('text sections round-trip verbatim and can never set a parameter', () => {
  const notes = 'ดู https://example.com/a\n\n// คงไว้\n# ชื่อ: ถูกแทน\n[แสง]\nความสว่าง: มาก\n\\เดิม\n```';
  const preserve = '[ใบหน้า]\n# ท่าทาง';
  const r = parseSGP(serializeSGP({ name: 'เดิม', params: D, notes, preserve }, schema, vocab), schema, vocab);
  assert.equal(r.notes, notes);
  assert.equal(r.preserve, preserve);
  assert.equal(r.name, 'เดิม');
  assert.deepEqual(r.params, D);
  assert.equal(r.warnings.length, 0);
});

test('names and tags stay on one line and can never set a parameter', () => {
  const text = serializeSGP({ name: 'ก//ข\nเงา: มาก', tags: ['ค,ง\nเกรน: มาก'], params: D }, schema, vocab);
  const r = parseSGP(text, schema, vocab);
  assert.equal(r.name, 'ก//ข เงา: มาก');
  assert.deepEqual(r.tags, ['ค ง เกรน: มาก']);
  assert.deepEqual(r.params, D);
  assert.equal(r.warnings.length, 0);
});

test('a 64 KB hostile line parses in linear time', () => {
  const n = 64000;
  for (const value of ['a' + ' '.repeat(n) + 'b', '('.repeat(n), '+ '.repeat(n / 2)]) {
    const t0 = performance.now();
    parseSGP(`เงา: ${value}`, schema, vocab);
    assert.ok(performance.now() - t0 < 500, value.slice(0, 8));
  }
});

test('a reply pasted from chat with code fences and unicode minus parses cleanly', () => {
  const r = parseSGP('```text\n# ชื่อ: ทดสอบ\nเงา: ลึก ปานกลาง (−30)\n```', schema, vocab);
  assert.equal(r.warnings.length, 0);
  assert.equal(r.params.shadows, -30);
  assert.equal(r.name, 'ทดสอบ');
});

test('round-trip holds for 500 random parameter sets', () => {
  const defs = schema.groups.flatMap((g) => g.params);
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 500; i++) {
    const params = {};
    for (const d of defs) params[d.key] = rnd() < 0.5 ? d.default : Math.round(d.min + rnd() * (d.max - d.min)) + 0;
    const r = parseSGP(serializeSGP({ name: 'r' + i, params }, schema, vocab), schema, vocab);
    assert.deepEqual(r.params, params, 'set ' + i);
    assert.equal(r.warnings.length, 0, 'set ' + i);
  }
});
