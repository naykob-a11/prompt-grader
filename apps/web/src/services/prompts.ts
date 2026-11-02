import { env } from '../config/env';
import { t } from '../i18n';
import { showToast } from '../shared/toast';
import { db } from '../storage/db';
import { LibraryFileError, parseLibraryFile, serializeLibrary } from '../storage/libraryFile';
import { loadSettings, saveSetting } from '../storage/settings';
import { editorStore, hasUnsavedChanges } from '../store/editorStore';
import { BUILTIN_VIEWS, libraryStore, toView, type PromptView } from '../store/libraryStore';
import { hasUnsavedMeta, promptStore } from '../store/promptStore';
import { BUILTIN_TEXT } from './builtinText';
import { downloadText } from './download';
import { flushTyping, markMetaSaved, startPromptSync } from './promptSync';

const DAY_MS = 86_400_000;

function allViews(): PromptView[] {
  return [...libraryStore.getState().prompts.map(toView), ...BUILTIN_VIEWS];
}

/** The library keeps working in memory if browser storage is blocked. */
const reportStorageError = () => showToast(t('error.storage'), 'error');

/** Loads saved prompts and settings, then keeps the settings in step with the editor. */
export async function initLibrary(): Promise<void> {
  startPromptSync();
  try {
    await libraryStore.getState().load();
    const settings = await loadSettings(db);
    const editor = editorStore.getState();
    editor.setCompareMode(settings.compareMode);
    const last = allViews().find((view) => view.id === settings.lastPromptId);
    if (last) editor.restorePrompt(last);
    remindToBackUp(settings.lastBackupAt);
  } catch {
    reportStorageError();
  }

  editorStore.subscribe((state, previous) => {
    if (state.compareMode !== previous.compareMode) {
      saveSetting(db, 'compareMode', state.compareMode).catch(reportStorageError);
    }
    if (state.promptId && state.promptId !== previous.promptId) {
      saveSetting(db, 'lastPromptId', state.promptId).catch(reportStorageError);
    }
  });
}

function remindToBackUp(lastBackupAt: number): void {
  const days = env.VITE_BACKUP_REMINDER_DAYS;
  const newest = libraryStore.getState().prompts[0];
  if (!days || !newest) return;
  if (Date.now() - Math.max(lastBackupAt, newest.createdAt) > days * DAY_MS) {
    showToast(t('library.backupReminder'));
  }
}

export function selectPrompt(view: PromptView): void {
  editorStore.getState().selectPrompt(view);
}

export async function saveAsNew(name: string): Promise<void> {
  flushTyping();
  const { params } = editorStore.getState();
  const { tags, notes, preserve } = promptStore.getState().meta;
  try {
    const record = await libraryStore.getState().create({ name, params, tags, notes, preserve });
    editorStore.getState().markSaved(record);
    libraryStore.getState().setNaming(false);
  } catch {
    reportStorageError();
  }
}

/** Saves over the current prompt, or asks for a name when that would overwrite a built-in. */
export async function saveCurrent(): Promise<void> {
  flushTyping();
  const { promptId, params } = editorStore.getState();
  const mine = libraryStore.getState().prompts.some((p) => p.id === promptId);
  if (!promptId || !mine) {
    libraryStore.getState().setNaming(true);
    return;
  }
  const { tags, notes, preserve } = promptStore.getState().meta;
  try {
    await libraryStore.getState().saveContent(promptId, { params, tags, notes, preserve });
    editorStore.getState().markSaved({ id: promptId, params });
    markMetaSaved();
    showToast(t('library.saved'));
  } catch {
    reportStorageError();
  }
}

export async function duplicatePrompt(view: PromptView): Promise<void> {
  const source = libraryStore.getState().prompts.find((p) => p.id === view.id);
  const seed = BUILTIN_TEXT.get(view.name);
  const { name, params, tags } = view;
  try {
    const record = await libraryStore.getState().create({
      name,
      params,
      tags,
      ...(source
        ? {
            ...(source.notes !== undefined && { notes: source.notes }),
            ...(source.preserve !== undefined && { preserve: source.preserve }),
            ...(source.freeText !== undefined && { freeText: source.freeText }),
          }
        : { ...seed, freeText: view.text }),
    });
    editorStore.getState().selectPrompt(record);
  } catch {
    reportStorageError();
  }
}

export async function deletePrompt(id: string): Promise<void> {
  try {
    await libraryStore.getState().remove(id);
    editorStore.getState().forgetPrompt(id);
  } catch {
    reportStorageError();
  }
}

export async function renamePrompt(id: string, name: string): Promise<void> {
  await libraryStore.getState().rename(id, name).catch(reportStorageError);
}

export async function importLibrary(file: File): Promise<void> {
  const limits = { maxBytes: env.VITE_MAX_LIBRARY_BYTES, maxItems: env.VITE_MAX_LIBRARY_ITEMS };
  try {
    if (file.size > limits.maxBytes) throw new LibraryFileError('tooLarge');
    const names = libraryStore.getState().prompts.map((p) => p.name);
    const { records, skipped } = parseLibraryFile(await file.text(), names, limits);
    await libraryStore.getState().addAll(records);
    showToast(t('library.imported', { count: records.length, skipped }));
  } catch (error) {
    if (error instanceof LibraryFileError) {
      showToast(
        t(error.problem === 'tooLarge' ? 'error.libraryTooLarge' : 'error.notLibrary'),
        'error',
      );
    } else {
      reportStorageError();
    }
  }
}

export function exportLibrary(): void {
  const date = new Date().toISOString().slice(0, 10);
  downloadText(
    `prompt-library-${date}.json`,
    serializeLibrary(libraryStore.getState().prompts),
    'application/json',
  );
  saveSetting(db, 'lastBackupAt', Date.now()).catch(reportStorageError);
}

/** True when the current work differs from what is saved. */
export const hasUnsavedWork = (): boolean =>
  hasUnsavedChanges(editorStore.getState()) || hasUnsavedMeta(promptStore.getState());
