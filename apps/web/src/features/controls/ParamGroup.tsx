import {
  DEFAULT_PARAMS,
  type ParamDef,
  type ParamGroup as Group,
  type ParamKey,
} from '@prompt-grader/engine';
import type { ReactEventHandler } from 'react';
import { locale, t } from '../../i18n';
import { useEditor } from '../../store/editorStore';
import { ParamSlider } from './ParamSlider';

const STORAGE_PREFIX = 'prompt-grader.group.';

function readOpen(id: string, fallback: boolean): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + id);
    return saved === null ? fallback : saved === 'true';
  } catch {
    return fallback;
  }
}

function saveOpen(id: string, open: boolean): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, String(open));
  } catch {
    // Storage can be blocked; the group then opens with its default next time.
  }
}

interface ParamGroupProps {
  group: Group;
  params: readonly ParamDef[];
  defaultOpen: boolean;
}

export function ParamGroup({ group, params, defaultOpen }: ParamGroupProps) {
  const changed = useEditor((s) =>
    params.some((p) => s.params[p.key as ParamKey] !== DEFAULT_PARAMS[p.key as ParamKey]),
  );
  const onToggle: ReactEventHandler<HTMLDetailsElement> = (event) =>
    saveOpen(group.id, event.currentTarget.open);

  return (
    <details className="group" open={readOpen(group.id, defaultOpen)} onToggle={onToggle}>
      <summary>
        <span className="group-title">{group.label[locale]}</span>
        {changed && <span className="group-dot" title={t('controls.hasChanges')} />}
      </summary>
      {params.map((def) => (
        <ParamSlider key={def.key} def={def} />
      ))}
    </details>
  );
}
