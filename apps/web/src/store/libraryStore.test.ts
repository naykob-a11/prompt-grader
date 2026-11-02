import 'fake-indexeddb/auto';
import { BUILTIN_PRESETS, DEFAULT_PARAMS } from '@prompt-grader/engine';
import { beforeEach, describe, expect, test } from 'vitest';
import { PromptDb } from '../storage/db';
import { loadSettings, saveSetting } from '../storage/settings';
import { BUILTIN_VIEWS, createLibraryStore, matches, toView } from './libraryStore';

let db: PromptDb;
let store: ReturnType<typeof createLibraryStore>;
let dbCount = 0;

beforeEach(() => {
  db = new PromptDb(`test-${++dbCount}`);
  store = createLibraryStore(db);
});

const reopened = async () => {
  const next = createLibraryStore(db);
  await next.getState().load();
  return next.getState().prompts;
};

describe('library store', () => {
  test('a created prompt survives reopening the database', async () => {
    const params = { ...DEFAULT_PARAMS, shadows: 30 };
    await store.getState().create({ name: 'ของฉัน', params, tags: ['ก'] });
    const [saved] = await reopened();
    expect(saved).toMatchObject({ name: 'ของฉัน', params, tags: ['ก'], source: 'user' });
  });

  test('new names never collide', async () => {
    const { create } = store.getState();
    await create({ name: 'ซ้ำ', params: DEFAULT_PARAMS });
    const second = await create({ name: 'ซ้ำ', params: DEFAULT_PARAMS });
    expect(second.name).toBe('ซ้ำ (2)');
  });

  test('saving parameters updates the row and its time', async () => {
    const record = await store.getState().create({ name: 'ก', params: DEFAULT_PARAMS });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await store.getState().saveParams(record.id, { ...DEFAULT_PARAMS, grain: 9 });
    const [saved] = await reopened();
    expect(saved!.params.grain).toBe(9);
    expect(saved!.updatedAt).toBeGreaterThan(record.updatedAt);
  });

  test('rename keeps names unique but may keep its own name', async () => {
    const { create, rename } = store.getState();
    const a = await create({ name: 'ก', params: DEFAULT_PARAMS });
    await create({ name: 'ข', params: DEFAULT_PARAMS });
    await rename(a.id, 'ก');
    expect((await reopened()).find((p) => p.id === a.id)!.name).toBe('ก');
    await rename(a.id, 'ข');
    expect((await reopened()).find((p) => p.id === a.id)!.name).toBe('ข (2)');
  });

  test('remove deletes the row', async () => {
    const record = await store.getState().create({ name: 'ก', params: DEFAULT_PARAMS });
    await store.getState().remove(record.id);
    expect(await reopened()).toEqual([]);
  });

  test('rows saved by an older schema are migrated on load', async () => {
    const record = await store.getState().create({ name: 'ก', params: DEFAULT_PARAMS });
    const legacy = { ...record, schemaVersion: 1, params: { cream: 30 } as never };
    await db.prompts.put(legacy);
    expect((await reopened())[0]!.params.hiSat).toBe(30);
  });
});

describe('filtering', () => {
  const view = BUILTIN_VIEWS[0]!;

  test('every built-in preset has a view', () => {
    expect(BUILTIN_VIEWS.map((v) => v.id)).toEqual(BUILTIN_PRESETS.map((p) => p.id));
  });

  test('matches the name or text, ignoring case', () => {
    expect(matches(view, view.name, null)).toBe(true);
    expect(matches(view, 'CINEMATIC', null)).toBe(true);
    expect(matches(view, 'ไม่มีคำนี้', null)).toBe(false);
  });

  test('a tag narrows the list', () => {
    expect(matches(view, '', view.tags[0]!)).toBe(true);
    expect(matches(view, '', 'แท็กอื่น')).toBe(false);
  });

  test('the row text falls back from the free text to the notes', () => {
    const base = {
      id: 'x',
      name: 'ก',
      prompt: 'สร้าง',
      params: DEFAULT_PARAMS,
      schemaVersion: 3,
      tags: [],
      source: 'user' as const,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(toView(base).text).toBe('สร้าง');
    expect(toView({ ...base, notes: 'โน้ต' }).text).toBe('โน้ต');
    expect(toView({ ...base, notes: 'โน้ต', freeText: 'อิสระ' }).text).toBe('อิสระ');
  });
});

describe('settings', () => {
  test('saved values override the defaults and survive', async () => {
    await saveSetting(db, 'compareMode', 'before');
    expect((await loadSettings(db)).compareMode).toBe('before');
  });

  test('defaults come from the environment', async () => {
    expect(await loadSettings(db)).toMatchObject({ jpegQuality: 95, stripGps: true });
  });

  test('corrupt or unknown rows are ignored', async () => {
    await db.settings.bulkPut([
      { key: 'jpegQuality', value: 5000 },
      { key: 'somethingElse', value: 1 },
    ]);
    const settings = await loadSettings(db);
    expect(settings.jpegQuality).toBe(95);
    expect('somethingElse' in settings).toBe(false);
  });
});
