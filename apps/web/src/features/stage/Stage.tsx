import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { env } from '../../config/env';
import { t, type MessageKey } from '../../i18n';
import { useEditor, editorStore, type CompareMode } from '../../store/editorStore';
import { CompareSlider } from './CompareSlider';
import { Histogram } from './Histogram';
import './stage.css';
import { useRenderer } from './useRenderer';

const MODES: readonly { mode: CompareMode; label: MessageKey }[] = [
  { mode: 'split', label: 'stage.split' },
  { mode: 'after', label: 'stage.showAfter' },
  { mode: 'before', label: 'stage.showBefore' },
];

export function Stage() {
  const image = useEditor((s) => s.image);
  const compareMode = useEditor((s) => s.compareMode);
  const peeking = useEditor((s) => s.peeking);
  const mode = peeking ? 'before' : compareMode;

  const [cpuOnly, setCpuOnly] = useState(env.VITE_FORCE_CPU_ENGINE);
  const [after, setAfter] = useState<HTMLCanvasElement | null>(null);
  const useCpu = useCallback(() => setCpuOnly(true), []);
  useRenderer(after, cpuOnly, useCpu);

  const before = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = before.current;
    if (!canvas || !image) return;
    const { data, width, height } = image.preview;
    canvas.width = width;
    canvas.height = height;
    canvas
      .getContext('2d')!
      .putImageData(new ImageData(data as ImageDataArray, width, height), 0, 0);
  }, [image]);

  const [zoomed, setZoomed] = useState(false);
  const [divider, setDivider] = useState(50);

  const view = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = view.current;
    if (!element || !image) return;
    const { width, height } = image.preview;
    const update = () => {
      // clientWidth and clientHeight include the padding around the image.
      const padding = parseFloat(getComputedStyle(element).paddingTop) * 2;
      const scale = Math.min(
        (element.clientWidth - padding) / width,
        (element.clientHeight - padding) / height,
      );
      setFit({ width: Math.floor(width * scale), height: Math.floor(height * scale) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [image]);

  // A mouse drag pans the zoomed image; touch screens scroll natively.
  const pan = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (zoomed && event.pointerType === 'mouse' && event.target instanceof HTMLCanvasElement) {
      pan.current = { x: event.clientX, y: event.clientY };
    }
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pan.current) return;
    event.currentTarget.scrollBy(pan.current.x - event.clientX, pan.current.y - event.clientY);
    pan.current = { x: event.clientX, y: event.clientY };
  };

  const size = zoomed && image ? image.preview : fit;

  return (
    <section className="stage" aria-label={t('stage.label')}>
      <div
        ref={view}
        className="stage-view"
        data-zoomed={zoomed}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (pan.current = null)}
      >
        {!image && <p className="stage-hint">{t('stage.dropHint')}</p>}
        <div
          className="stage-frame"
          hidden={!image}
          style={{ width: size.width, height: size.height }}
        >
          <canvas ref={before} data-testid="stage-before" />
          <canvas
            key={cpuOnly ? 'cpu' : 'gpu'}
            ref={setAfter}
            data-testid="stage-after"
            data-mode={mode}
            hidden={mode === 'before'}
            style={mode === 'split' ? { clipPath: `inset(0 0 0 ${divider}%)` } : undefined}
          />
          {mode === 'split' && <CompareSlider position={divider} onChange={setDivider} />}
        </div>
      </div>

      <div className="stage-bar">
        <span className="stage-info" data-testid="stage-info">
          {image && t('stage.info', { name: image.name, width: image.width, height: image.height })}
        </span>
        <div className="segmented" role="group" aria-label={t('stage.compareLabel')}>
          {MODES.map((item) => (
            <button
              key={item.mode}
              type="button"
              aria-pressed={compareMode === item.mode}
              onClick={() => editorStore.getState().setCompareMode(item.mode)}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
        <button type="button" aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}>
          {t(zoomed ? 'stage.zoomFit' : 'stage.zoom100')}
        </button>
      </div>

      {env.VITE_FEATURE_HISTOGRAM && <Histogram />}
    </section>
  );
}
