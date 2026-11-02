import type { SgpWarning } from '@prompt-grader/engine';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** The parts of a prompt that are not parameters. */
export interface PromptMeta {
  name: string;
  tags: string[];
  notes: string;
  preserve: string;
}

export const EMPTY_META: PromptMeta = { name: '', tags: [], notes: '', preserve: '' };

export interface PromptTextState {
  text: string;
  warnings: SgpWarning[];
  meta: PromptMeta;
  /** The meta as saved, which unsaved note or tag edits are measured from. */
  savedMeta: PromptMeta;
  /** A line the editor should jump to, set by the warning list. */
  jumpTo: { line: number } | null;
}

export const promptStore = createStore<PromptTextState>()(() => ({
  text: '',
  warnings: [],
  meta: EMPTY_META,
  savedMeta: EMPTY_META,
  jumpTo: null,
}));

export const usePrompt = <T>(selector: (state: PromptTextState) => T): T =>
  useStore(promptStore, selector);

const contentOf = ({ tags, notes, preserve }: PromptMeta) =>
  JSON.stringify([tags, notes, preserve]);

export const hasUnsavedMeta = (s: Pick<PromptTextState, 'meta' | 'savedMeta'>) =>
  contentOf(s.meta) !== contentOf(s.savedMeta);
