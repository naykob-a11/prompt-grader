import {
  BUILTIN_PRESETS,
  DEFAULT_PARAMS,
  type GradeContext,
  type ParamKey,
  type Params,
  type RawImage,
} from '@prompt-grader/engine';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { env } from '../config/env';

export type CompareMode = 'split' | 'after' | 'before';
const COMPARE_ORDER: readonly CompareMode[] = ['split', 'after', 'before'];

export interface OpenImage {
  name: string;
  /** Preview pixels, at most VITE_PREVIEW_MAX_SIDE on the long side. */
  preview: RawImage;
  ctx: GradeContext;
  width: number;
  height: number;
  isSample: boolean;
}

interface Snapshot {
  params: Params;
  presetId: string | null;
}

export interface EditorState extends Snapshot {
  image: OpenImage | null;
  past: Snapshot[];
  future: Snapshot[];
  /** The state before the slider drag in progress, which becomes one undo step on commit. */
  editBase: Snapshot | null;
  compareMode: CompareMode;
  /** True while the user holds the key that shows the original. */
  peeking: boolean;

  setImage(image: OpenImage): void;
  selectPreset(id: string): void;
  setParam(key: ParamKey, value: number): void;
  commitEdit(): void;
  resetParam(key: ParamKey): void;
  resetAll(): void;
  undo(): void;
  redo(): void;
  setCompareMode(mode: CompareMode): void;
  cycleCompareMode(): void;
  setPeeking(peeking: boolean): void;
}

const sameParams = (a: Params, b: Params) =>
  (Object.keys(a) as ParamKey[]).every((key) => a[key] === b[key]);

export interface EditorOptions {
  undoLimit: number;
  presetId: string;
  compareMode: CompareMode;
}

export function createEditorStore({ undoLimit, presetId, compareMode }: EditorOptions) {
  const preset = BUILTIN_PRESETS.find((p) => p.id === presetId);
  return createStore<EditorState>()((set, get) => {
    const snapshot = (): Snapshot => ({ params: get().params, presetId: get().presetId });
    const remember = (past: Snapshot[], entry: Snapshot) => [...past, entry].slice(-undoLimit);

    /** Applies a change as one undo step, unless it changes nothing. */
    const applyStep = (next: Snapshot) => {
      const { params, presetId: current, past } = get();
      if (sameParams(params, next.params) && current === next.presetId) return;
      set({ ...next, past: remember(past, snapshot()), future: [], editBase: null });
    };

    return {
      image: null,
      params: preset?.params ?? DEFAULT_PARAMS,
      presetId: preset?.id ?? null,
      past: [],
      future: [],
      editBase: null,
      compareMode,
      peeking: false,

      setImage: (image) => set({ image, past: [], future: [], editBase: null }),

      selectPreset: (id) => {
        const next = BUILTIN_PRESETS.find((p) => p.id === id);
        if (next) applyStep({ params: next.params, presetId: next.id });
      },

      setParam: (key, value) =>
        set((s) => ({
          params: { ...s.params, [key]: value },
          presetId: null,
          editBase: s.editBase ?? { params: s.params, presetId: s.presetId },
        })),

      commitEdit: () => {
        const { editBase, params, past } = get();
        if (!editBase) return;
        if (sameParams(editBase.params, params)) {
          set({ ...editBase, editBase: null });
          return;
        }
        set({ past: remember(past, editBase), future: [], editBase: null });
      },

      resetParam: (key) => {
        const { params } = get();
        applyStep({ params: { ...params, [key]: DEFAULT_PARAMS[key] }, presetId: null });
      },

      resetAll: () => applyStep({ params: DEFAULT_PARAMS, presetId: null }),

      undo: () => {
        get().commitEdit();
        const { past, future } = get();
        const entry = past.at(-1);
        if (!entry) return;
        set({ ...entry, past: past.slice(0, -1), future: [...future, snapshot()] });
      },

      redo: () => {
        const { past, future } = get();
        const entry = future.at(-1);
        if (!entry) return;
        set({ ...entry, past: [...past, snapshot()], future: future.slice(0, -1) });
      },

      setCompareMode: (mode) => set({ compareMode: mode }),

      cycleCompareMode: () =>
        set((s) => ({
          compareMode:
            COMPARE_ORDER[(COMPARE_ORDER.indexOf(s.compareMode) + 1) % COMPARE_ORDER.length]!,
        })),

      setPeeking: (peeking) => set({ peeking }),
    };
  });
}

export const editorStore = createEditorStore({
  undoLimit: env.VITE_UNDO_LIMIT,
  presetId: env.VITE_DEFAULT_PRESET_ID,
  compareMode: env.VITE_DEFAULT_COMPARE_MODE,
});

export const useEditor = <T>(selector: (state: EditorState) => T): T =>
  useStore(editorStore, selector);
