import { parseSGP, serializeSGP } from '@prompt-grader/engine';
import { env } from '../config/env';
import { t } from '../i18n';
import { editorStore } from '../store/editorStore';
import { libraryStore } from '../store/libraryStore';
import { EMPTY_META, promptStore, type PromptMeta } from '../store/promptStore';
import { BUILTIN_TEXT } from './builtinText';
import { BUILTIN_VIEWS } from '../store/libraryStore';

let timer: ReturnType<typeof setTimeout> | undefined;
/** True while text is driving the parameters, so the change is not written back as text. */
let applyingText = false;

function metaFor(id: string): PromptMeta | null {
  const record = libraryStore.getState().prompts.find((p) => p.id === id);
  if (record) {
    const { name, tags, notes = '', preserve = '' } = record;
    return { name, tags, notes, preserve };
  }
  const builtin = BUILTIN_VIEWS.find((view) => view.id === id);
  if (!builtin) return null;
  return {
    ...EMPTY_META,
    name: builtin.name,
    tags: builtin.tags,
    ...BUILTIN_TEXT.get(builtin.name),
  };
}

/** Rewrites the text from the sliders, keeping the name, tags and text sections. */
function writeText(): void {
  clearTimeout(timer);
  timer = undefined;
  const { params } = editorStore.getState();
  const { meta } = promptStore.getState();
  promptStore.setState({ text: serializeSGP({ ...meta, params }), warnings: [] });
}

/** Reads text still waiting for the typing pause, so a save never misses it. */
export function flushTyping(): void {
  if (timer !== undefined) parseNow();
}

/** Reads the text now, updating the sliders and the warnings. */
export function parseNow(): void {
  clearTimeout(timer);
  timer = undefined;
  const { text, meta } = promptStore.getState();
  if (text.length > env.VITE_MAX_PROMPT_BYTES) {
    promptStore.setState({ warnings: [{ line: 1, message: t('error.promptTooLarge') }] });
    return;
  }
  const result = parseSGP(text);
  promptStore.setState({
    warnings: result.warnings,
    meta: {
      name: result.name || meta.name,
      tags: result.tags,
      notes: result.notes,
      preserve: result.preserve,
    },
  });
  applyingText = true;
  editorStore.getState().applyParams(result.params);
  applyingText = false;
}

/** For typing: reads the text once the user pauses. */
export function editText(text: string): void {
  promptStore.setState({ text });
  clearTimeout(timer);
  timer = setTimeout(parseNow, env.VITE_PARSE_DEBOUNCE_MS);
}

/** For text arriving all at once, such as a template or an attached file. */
export function replaceText(text: string): void {
  promptStore.setState({ text });
  parseNow();
}

/** Records that the current meta is now what is saved. */
export function markMetaSaved(): void {
  promptStore.setState((s) => ({ savedMeta: s.meta }));
}

export function startPromptSync(): void {
  const load = (id: string | null) => {
    const meta = id ? metaFor(id) : null;
    if (meta) promptStore.setState({ meta, savedMeta: meta });
    writeText();
  };

  load(editorStore.getState().promptId);
  editorStore.subscribe((state, previous) => {
    if (applyingText) return;
    if (state.promptId !== previous.promptId) load(state.promptId);
    else if (state.params !== previous.params) writeText();
  });
}
