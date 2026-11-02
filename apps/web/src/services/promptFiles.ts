import { parseSGP } from '@prompt-grader/engine';
import { env } from '../config/env';
import { t } from '../i18n';
import { showToast } from '../shared/toast';
import { editorStore } from '../store/editorStore';
import { libraryStore } from '../store/libraryStore';
import { promptStore } from '../store/promptStore';
import { copyText } from './clipboard';
import { downloadText } from './download';
import { replaceText } from './promptSync';

export type PromptFileProblem = 'tooLarge' | 'notText';

export class PromptFileError extends Error {
  constructor(readonly problem: PromptFileProblem) {
    super(problem);
  }
}

export const isPromptFile = (file: File) => /\.(txt|md)$/i.test(file.name);

const baseName = (fileName: string) => fileName.replace(/(\.sgp)?\.(txt|md)$/i, '');

/** Removes what file systems forbid, including path separators and control characters. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\p{Cc}]/gu, ' ').trim();
  return cleaned.replace(/[. ]+$/, '') || 'prompt';
}

/** Reads an untrusted text file, with its size and encoding checked. */
export async function readPromptFile(
  file: Pick<File, 'size' | 'arrayBuffer'>,
  maxBytes = env.VITE_MAX_PROMPT_BYTES,
  maxLines = env.VITE_MAX_PROMPT_LINES,
): Promise<string> {
  if (file.size > maxBytes) throw new PromptFileError('tooLarge');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new PromptFileError('notText');
  }
  if (text.split('\n').length > maxLines) throw new PromptFileError('tooLarge');
  return text;
}

const problemMessage = (error: unknown) =>
  t(
    error instanceof PromptFileError && error.problem === 'tooLarge'
      ? 'error.tooLarge'
      : 'error.notText',
  );

/** One file opens in the editor; several go straight into the library. */
export async function attachFiles(files: readonly File[]): Promise<void> {
  const [only] = files;
  if (!only) return;
  if (files.length === 1) {
    try {
      const text = await readPromptFile(only);
      editorStore.getState().detachPrompt();
      replaceText(text);
      const { meta } = promptStore.getState();
      if (!meta.name) promptStore.setState({ meta: { ...meta, name: baseName(only.name) } });
    } catch (error) {
      showToast(problemMessage(error), 'error');
    }
    return;
  }

  let count = 0;
  let warnings = 0;
  let failed = 0;
  for (const file of files) {
    try {
      const parsed = parseSGP(await readPromptFile(file));
      const { name, tags, notes, preserve, params } = parsed;
      await libraryStore.getState().create({
        name: name || baseName(file.name),
        params,
        tags,
        notes,
        preserve,
        source: 'import',
      });
      count++;
      warnings += parsed.warnings.length;
    } catch {
      failed++;
    }
  }
  showToast(t('library.importedFiles', { count, warnings, failed }));
}

export function exportPromptFile(): void {
  const { text, meta } = promptStore.getState();
  downloadText(`${safeFileName(meta.name)}.sgp.txt`, text, 'text/plain;charset=utf-8');
}

export async function copyPromptText(): Promise<void> {
  const copied = await copyText(promptStore.getState().text);
  showToast(t(copied ? 'editor.copied' : 'editor.copyFailed'), copied ? 'info' : 'error');
}
