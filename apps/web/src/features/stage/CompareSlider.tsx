import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '../../i18n';

interface CompareSliderProps {
  /** Divider position, 0 to 100 percent from the left. */
  position: number;
  onChange(position: number): void;
}

const clamp = (v: number) => Math.min(100, Math.max(0, v));

export function CompareSlider({ position, onChange }: CompareSliderProps) {
  const dragging = useRef(false);

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.parentElement!.getBoundingClientRect();
    onChange(clamp(((event.clientX - box.left) / box.width) * 100));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'ArrowLeft') onChange(clamp(position - step));
    else if (event.key === 'ArrowRight') onChange(clamp(position + step));
    else return;
    event.preventDefault();
  };

  return (
    <>
      <span className="compare-tag compare-tag-before">{t('stage.before')}</span>
      <span className="compare-tag compare-tag-after">{t('stage.after')}</span>
      <div
        className="compare-divider"
        role="slider"
        tabIndex={0}
        aria-label={t('stage.divider')}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        style={{ left: `${position}%` }}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragging.current) moveTo(event);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      />
    </>
  );
}
