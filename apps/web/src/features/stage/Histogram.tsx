import { gradeImage, histogram, type Histogram as Bins } from '@prompt-grader/engine';
import { useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n';
import { sampleImage } from '../../services/imageIO';
import { useEditor } from '../../store/editorStore';

const SAMPLE_SIDE = 256;
const DEBOUNCE_MS = 120;
const WIDTH = 255;
const HEIGHT = 100;

function toPath(bins: Uint32Array): string {
  // Bins 0 and 255 collect clipped pixels and would flatten the rest of the curve.
  let peak = 1;
  for (let i = 1; i < 255; i++) peak = Math.max(peak, bins[i]!);
  const points = Array.from(bins, (count, i) => {
    const level = Math.min(1, Math.sqrt(count / peak));
    return `L${i},${(HEIGHT * (1 - level)).toFixed(1)}`;
  });
  return `M0,${HEIGHT} ${points.join(' ')} L${WIDTH},${HEIGHT} Z`;
}

/** Graded on a small CPU sample, so reading it back never slows the GPU preview. */
export function Histogram() {
  const image = useEditor((s) => s.image);
  const params = useEditor((s) => s.params);
  const [bins, setBins] = useState<Bins | null>(null);
  const sample = useMemo(() => image && sampleImage(image.preview, SAMPLE_SIDE), [image]);

  useEffect(() => {
    if (!image || !sample) return;
    const timer = setTimeout(() => {
      const ctx = { ...image.ctx, fullWidth: sample.width, fullHeight: sample.height };
      setBins(histogram(gradeImage(sample.data, sample.width, sample.height, params, ctx)));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [image, sample, params]);

  return (
    <details className="histogram" open>
      <summary>{t('stage.histogram')}</summary>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        {bins && (
          <>
            <path className="hist-l" d={toPath(bins.l)} />
            <path className="hist-r" d={toPath(bins.r)} />
            <path className="hist-g" d={toPath(bins.g)} />
            <path className="hist-b" d={toPath(bins.b)} />
          </>
        )}
      </svg>
    </details>
  );
}
