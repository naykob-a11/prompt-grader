import { BUILTIN_PRESETS, DEFAULT_PARAMS } from '@prompt-grader/engine';
import { describe, expect, test } from 'vitest';
import { createEditorStore } from './editorStore';

const b1 = BUILTIN_PRESETS[0]!;
const b2 = BUILTIN_PRESETS[1]!;
const make = (undoLimit = 50) =>
  createEditorStore({ undoLimit, presetId: b1.id, compareMode: 'split' });

function drag(store: ReturnType<typeof make>, value: number) {
  const s = store.getState();
  for (let v = 1; v <= value; v++) s.setParam('exposure', v);
  s.commitEdit();
}

describe('editor store', () => {
  test('starts on the configured preset, or neutral when the id is unknown', () => {
    expect(make().getState().params).toEqual(b1.params);
    const unknown = createEditorStore({ undoLimit: 5, presetId: 'nope', compareMode: 'after' });
    expect(unknown.getState().params).toEqual(DEFAULT_PARAMS);
    expect(unknown.getState().presetId).toBeNull();
  });

  test('a whole slider drag is one undo step', () => {
    const store = make();
    drag(store, 30);
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().params.exposure).toBe(30);
    store.getState().undo();
    expect(store.getState().params).toEqual(b1.params);
    expect(store.getState().presetId).toBe(b1.id);
  });

  test('redo restores the undone state, and a new edit clears redo', () => {
    const store = make();
    drag(store, 30);
    store.getState().undo();
    store.getState().redo();
    expect(store.getState().params.exposure).toBe(30);
    store.getState().undo();
    drag(store, 5);
    expect(store.getState().future).toEqual([]);
  });

  test('choosing a preset is one undo step', () => {
    const store = make();
    store.getState().selectPreset(b2.id);
    expect(store.getState().params).toEqual(b2.params);
    store.getState().undo();
    expect(store.getState().presetId).toBe(b1.id);
  });

  test('history keeps only the configured number of steps', () => {
    const store = make(3);
    for (let i = 1; i <= 6; i++) drag(store, i);
    expect(store.getState().past).toHaveLength(3);
  });

  test('a drag that ends where it began adds no step', () => {
    const store = make();
    const start = store.getState().params.exposure;
    store.getState().setParam('exposure', start + 5);
    store.getState().setParam('exposure', start);
    store.getState().commitEdit();
    expect(store.getState().past).toEqual([]);
    expect(store.getState().presetId).toBe(b1.id);
  });

  test('reset clears to neutral as one step', () => {
    const store = make();
    store.getState().resetAll();
    expect(store.getState().params).toEqual(DEFAULT_PARAMS);
    expect(store.getState().past).toHaveLength(1);
    store.getState().resetAll();
    expect(store.getState().past).toHaveLength(1);
  });

  test('resetParam changes one value', () => {
    const store = make();
    store.getState().resetParam('shadows');
    expect(store.getState().params).toEqual({ ...b1.params, shadows: 0 });
  });

  test('undo commits a drag still in progress first', () => {
    const store = make();
    store.getState().setParam('exposure', 40);
    store.getState().undo();
    expect(store.getState().params).toEqual(b1.params);
  });

  test('opening an image clears history but keeps the grade', () => {
    const store = make();
    drag(store, 30);
    store.getState().setImage({
      name: 'a.png',
      preview: { data: new Uint8ClampedArray(4), width: 1, height: 1 },
      ctx: { wbGains: [1, 1, 1], fullWidth: 1, fullHeight: 1 },
      width: 1,
      height: 1,
      isSample: false,
    });
    expect(store.getState().past).toEqual([]);
    expect(store.getState().params.exposure).toBe(30);
  });

  test('compare mode cycles through all three modes', () => {
    const store = make();
    const seen = [1, 2, 3].map(() => {
      store.getState().cycleCompareMode();
      return store.getState().compareMode;
    });
    expect(seen).toEqual(['after', 'before', 'split']);
  });
});
