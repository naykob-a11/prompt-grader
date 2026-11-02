import { grayWorld, type RawImage } from '@prompt-grader/engine';
import { env } from '../config/env';
import { t } from '../i18n';
import { showToast } from '../shared/toast';
import { editorStore } from '../store/editorStore';
import { decodeImage } from './imageIO';
import { makeSampleImage } from './sampleImage';

function publish(
  name: string,
  file: File | null,
  preview: RawImage,
  width: number,
  height: number,
) {
  editorStore.getState().setImage({
    name,
    file,
    preview,
    ctx: {
      wbGains: grayWorld(preview.data),
      fullWidth: preview.width,
      fullHeight: preview.height,
    },
    width,
    height,
    isSample: file === null,
  });
}

export async function openImageFile(file: File): Promise<void> {
  try {
    const decoded = await decodeImage(file, env.VITE_PREVIEW_MAX_SIDE);
    const megapixels = (decoded.width * decoded.height) / 1e6;
    if (megapixels > env.VITE_MAX_IMAGE_MEGAPIXELS) {
      showToast(t('warning.largeImage', { megapixels: Math.round(megapixels) }));
    }
    publish(file.name, file, decoded.preview, decoded.width, decoded.height);
  } catch {
    showToast(t('error.notImage'), 'error');
  }
}

export function openSampleImage(): void {
  const sample = makeSampleImage();
  publish(t('stage.sample'), null, sample, sample.width, sample.height);
}
