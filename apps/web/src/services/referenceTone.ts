import { MATCH_SIDE, serializeSGP } from '@prompt-grader/engine';
import { matchToneInWorker } from '@prompt-grader/engine/match';
import { env } from '../config/env';
import { t } from '../i18n';
import { showToast } from '../shared/toast';
import { editorStore } from '../store/editorStore';
import { decodeImage, sampleImage } from './imageIO';
import { replaceText } from './promptSync';

const MAX_NAME_LENGTH = 80;

const baseName = (fileName: string) => fileName.replace(/\.[^.]*$/, '');

/** Writes a prompt that brings the open image to the tone of `file`. The file is not kept. */
export async function createPromptFromReference(file: File): Promise<boolean> {
  const { image } = editorStore.getState();
  if (!image) return false;

  let reference;
  try {
    reference = await decodeImage(file, env.VITE_PREVIEW_MAX_SIDE);
  } catch {
    showToast(t('error.notImage'), 'error');
    return false;
  }

  try {
    const params = await matchToneInWorker(
      sampleImage(image.preview, MATCH_SIDE),
      sampleImage(reference.preview, MATCH_SIDE),
    );
    // Another photo may have been opened meanwhile, and these values were measured for this one.
    if (editorStore.getState().image !== image) return false;

    const name = baseName(file.name);
    editorStore.getState().detachPrompt();
    replaceText(
      serializeSGP({
        name: t('reference.promptName', { name }).slice(0, MAX_NAME_LENGTH),
        tags: [t('reference.tag')],
        notes: t('reference.notes', { name }),
        params,
      }),
    );
    showToast(t('reference.done', { name }));
    return true;
  } catch {
    showToast(t('error.reference'), 'error');
    return false;
  }
}
