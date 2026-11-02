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
  /** The original file, which an export reads again at full size. Null for the sample. */
  file: File | null;
  /** Preview pixels, at most VITE_PREVIEW_MAX_SIDE on the long side. */
  preview: RawImage;
  ctx: GradeContext;
  width: number;
  height: number;
  isSample: boolean;
}

/** A library entry as the editor needs it. */
export interface PromptRef {
  id: string;
  params: Params;
}

interface Snapshot {
  params: Params;
  promptId: string | null;
  /** The parameters saved in the current prompt, which unsaved changes are measured from. */
  baseline: Params | null;
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
  selectPrompt(prompt: PromptRef): void;
  /** Selects a prompt without an undo step, for restoring the last session. */
  restorePrompt(prompt: PromptRef): void;
  /** Records that the current parameters are now saved in this prompt. */
  markSaved(prompt: PromptRef): void;
  /** Detaches the editor from a deleted prompt, keeping the current parameters. */
  forgetPrompt(id: string): void;
  /** Starts unsaved work that belongs to no prompt, such as an attached file. */
  detachPrompt(): void;
  setParam(key: ParamKey, value: number): void;
  /** Replaces all parameters as one undo step, keeping the current prompt. */
  applyParams(params: Params): void;
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

/** True when the sliders differ from what is saved in the current prompt. */
export const hasUnsavedChanges = (s: Pick<EditorState, 'params' | 'baseline'>) =>
  !sameParams(s.params, s.baseline ?? DEFAULT_PARAMS);

export interface EditorOptions {
  undoLimit: number;
  presetId: string;
  compareMode: CompareMode;
}

export function createEditorStore({ undoLimit, presetId, compareMode }: EditorOptions) {
  const preset = BUILTIN_PRESETS.find((p) => p.id === presetId);
  return createStore<EditorState>()((set, get) => {
    const snapshot = (): Snapshot => {
      const { params, promptId, baseline } = get();
      return { params, promptId, baseline };
    };
    const remember = (past: Snapshot[], entry: Snapshot) => [...past, entry].slice(-undoLimit);

    /** Applies a change as one undo step, unless it changes nothing. */
    const applyStep = (next: Snapshot) => {
      const { params, promptId, past } = get();
      if (sameParams(params, next.params) && promptId === next.promptId) return;
      set({ ...next, past: remember(past, snapshot()), future: [], editBase: null });
    };

    return {
      image: null,
      params: preset?.params ?? DEFAULT_PARAMS,
      promptId: preset?.id ?? null,
      baseline: preset?.params ?? null,
      past: [],
      future: [],
      editBase: null,
      compareMode,
      peeking: false,

      setImage: (image) => set({ image, past: [], future: [], editBase: null }),

      selectPrompt: ({ id, params }) => applyStep({ params, promptId: id, baseline: params }),

      restorePrompt: ({ id, params }) => set({ params, promptId: id, baseline: params }),

      markSaved: ({ id, params }) => set({ promptId: id, baseline: params }),

      forgetPrompt: (id) => {
        if (get().promptId === id) set({ promptId: null, baseline: null });
      },

      detachPrompt: () => set({ promptId: null, baseline: null }),

      setParam: (key, value) =>
        set((s) => ({
          params: { ...s.params, [key]: value },
          editBase: s.editBase ?? snapshot(),
        })),

      applyParams: (params) => {
        const { promptId, baseline } = get();
        applyStep({ params, promptId, baseline });
      },

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
        const { params, promptId, baseline } = get();
        applyStep({ params: { ...params, [key]: DEFAULT_PARAMS[key] }, promptId, baseline });
      },

      resetAll: () => applyStep({ params: DEFAULT_PARAMS, promptId: null, baseline: null }),

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
