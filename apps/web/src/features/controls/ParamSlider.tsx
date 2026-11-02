import { DEFAULT_PARAMS, type ParamDef, type ParamKey } from '@prompt-grader/engine';
import type { CSSProperties, KeyboardEvent } from 'react';
import { locale, t } from '../../i18n';
import { editorStore, useEditor } from '../../store/editorStore';

const SHIFT_STEP = 10;

function display(def: ParamDef, value: number): string {
  if (def.kind === 'hue') return `${value}°`;
  return def.kind === 'signed' && value > 0 ? `+${value}` : String(value);
}

function spoken(def: ParamDef, value: number): string {
  if (def.kind === 'hue') return t('param.degrees', { value });
  if (def.kind === 'signed' && value > 0) return t('param.positive', { value });
  if (def.kind === 'signed' && value < 0) return t('param.negative', { value: -value });
  return String(value);
}

interface ParamFieldProps {
  def: ParamDef;
  value: number;
  onChange(value: number): void;
  onReset(): void;
  onCommit?(): void;
  idPrefix?: string;
}

/** A slider that holds no state, for wherever the value lives. */
export function ParamField({
  def,
  value,
  onChange,
  onReset,
  onCommit,
  idPrefix = 'param',
}: ParamFieldProps) {
  const key = def.key as ParamKey;
  const id = `${idPrefix}-${def.key}`;
  const neutral = ((DEFAULT_PARAMS[key] - def.min) / (def.max - def.min)) * 100;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!event.shiftKey) return;
    const direction = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    const next = value + direction * SHIFT_STEP;
    onChange(Math.min(def.max, Math.max(def.min, next)));
  };

  return (
    <div
      className="param"
      data-kind={def.kind}
      style={{ '--neutral': `${neutral}%` } as CSSProperties}
    >
      <label htmlFor={id} onDoubleClick={onReset}>
        {def.label[locale]}
      </label>
      {def.kind === 'hue' && (
        <span className="param-swatch" style={{ backgroundColor: `hsl(${value} 80% 50%)` }} />
      )}
      <span className="param-value" aria-hidden="true">
        {display(def, value)}
      </span>
      <div className="param-track">
        <input
          id={id}
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          aria-valuetext={spoken(def, value)}
          title={def.desc}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          onKeyDown={onKeyDown}
          onKeyUp={onCommit}
          onPointerUp={onCommit}
          onBlur={onCommit}
        />
      </div>
    </div>
  );
}

export function ParamSlider({ def }: { def: ParamDef }) {
  const key = def.key as ParamKey;
  const value = useEditor((s) => s.params[key]);
  const { setParam, commitEdit, resetParam } = editorStore.getState();
  return (
    <ParamField
      def={def}
      value={value}
      onChange={(next) => setParam(key, next)}
      onReset={() => resetParam(key)}
      onCommit={commitEdit}
    />
  );
}
