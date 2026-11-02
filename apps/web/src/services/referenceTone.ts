import { MATCH_SIDE, type Params } from '@prompt-grader/engine';
import { matchToneInWorker } from '@prompt-grader/engine/match';
import { env } from '../config/env';
import { t, type MessageKey } from '../i18n';
import { showToast } from '../shared/toast';
import { editorStore } from '../store/editorStore';
import { libraryStore } from '../store/libraryStore';
import { decodeImage, sampleImage } from './imageIO';

const MAX_NAME_LENGTH = 80;

const baseName = (fileName: string) => fileName.replace(/\.[^.]*$/, '');

/** A prompt being prepared in the reference window, not yet in the editor or the library. */
export interface ReferenceDraft {
  name: string;
  tags: string[];
  notes: string;
  preserve: string;
  params: Params;
}

/** Measures `file` against the open image. Returns the problem as a message when it fails. */
export async function draftFromReference(file: File): Promise<ReferenceDraft | MessageKey> {
  const { image } = editorStore.getState();
  if (!image) return 'error.reference';

  let reference;
  try {
    reference = await decodeImage(file, env.VITE_PREVIEW_MAX_SIDE);
  } catch {
    return 'error.notImage';
  }

  try {
    const params = await matchToneInWorker(
      sampleImage(image.preview, MATCH_SIDE),
      sampleImage(reference.preview, MATCH_SIDE),
    );
    const name = baseName(file.name);
    return {
      name: t('reference.promptName', { name }).slice(0, MAX_NAME_LENGTH),
      tags: [t('reference.tag')],
      notes: t('reference.notes', { name }),
      preserve: '',
      params,
    };
  } catch {
    return 'error.reference';
  }
}

/** Adds the draft to the library and applies it to the open image as one undo step. */
export async function saveReferenceDraft(draft: ReferenceDraft): Promise<boolean> {
  try {
    const record = await libraryStore.getState().create(draft);
    editorStore.getState().selectPrompt(record);
    showToast(t('reference.saved', { name: record.name }));
    return true;
  } catch {
    return false;
  }
}
