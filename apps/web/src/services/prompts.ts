import { env } from '../config/env';
import { t } from '../i18n';
import { showToast } from '../shared/toast';
import { db } from '../storage/db';
import { LibraryFileError, parseLibraryFile, serializeLibrary } from '../storage/libraryFile';
import { loadSettings, saveSetting } from '../storage/settings';
import { editorStore, hasUnsavedChanges } from '../store/editorStore';
import { BUILTIN_VIEWS, libraryStore, toView, type PromptView } from '../store/libraryStore';

const DAY_MS = 86_400_000;

function allViews(): PromptView[] {
  return [...libraryStore.getState().prompts.map(toView), ...BUILTIN_VIEWS];
}

/** The library keeps working in memory if browser storage is blocked. */
const reportStorageError = () => showToast(t('error.storage'), 'error');

/** Loads saved prompts and settings, then keeps the settings in step with the editor. */
export async function initLibrary(): Promise<void> {
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
  const params = editorStore.getState().params;
  try {
    const record = await libraryStore.getState().create({ name, params });
    editorStore.getState().markSaved(record);
    libraryStore.getState().setNaming(false);
  } catch {
    reportStorageError();
  }
}

/** Saves over the current prompt, or asks for a name when that would overwrite a built-in. */
export async function saveCurrent(): Promise<void> {
  const { promptId, params } = editorStore.getState();
  const mine = libraryStore.getState().prompts.some((p) => p.id === promptId);
  if (!promptId || !mine) {
    libraryStore.getState().setNaming(true);
    return;
  }
  try {
    await libraryStore.getState().saveParams(promptId, params);
    editorStore.getState().markSaved({ id: promptId, params });
    showToast(t('library.saved'));
  } catch {
    reportStorageError();
  }
}

export async function duplicatePrompt(view: PromptView): Promise<void> {
  const source = libraryStore.getState().prompts.find((p) => p.id === view.id);
  const { name, params, tags } = view;
  try {
    const record = await libraryStore.getState().create({
      name,
      params,
      tags,
      ...(source?.notes !== undefined && { notes: source.notes }),
      ...(source?.preserve !== undefined && { preserve: source.preserve }),
      ...(source
        ? source.freeText !== undefined && { freeText: source.freeText }
        : { freeText: view.text }),
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
  const text = serializeLibrary(libraryStore.getState().prompts);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `prompt-library-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  saveSetting(db, 'lastBackupAt', Date.now()).catch(reportStorageError);
}

/** For the browser's leave-page warning. */
export const shouldWarnBeforeLeaving = () => hasUnsavedChanges(editorStore.getState());
