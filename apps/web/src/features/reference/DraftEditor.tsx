import {
  DEFAULT_PARAMS,
  MATCHED_KEYS,
  PARAMS,
  parseSGP,
  serializeSGP,
  type ParamDef,
  type SgpWarning,
} from '@prompt-grader/engine';
import { useState } from 'react';
import { env } from '../../config/env';
import { t } from '../../i18n';
import type { ReferenceDraft } from '../../services/referenceTone';
import { ParamField } from '../controls/ParamSlider';

const DEFS: readonly ParamDef[] = MATCHED_KEYS.map((key) => PARAMS.find((p) => p.key === key)!);

interface DraftEditorProps {
  draft: ReferenceDraft;
  onChange(draft: ReferenceDraft): void;
}

/** Name, sliders and prompt text for a draft, each kept in step with the others. */
export function DraftEditor({ draft, onChange }: DraftEditorProps) {
  const [text, setText] = useState(() => serializeSGP(draft));
  const [warnings, setWarnings] = useState<readonly SgpWarning[]>([]);

  const replace = (next: ReferenceDraft) => {
    onChange(next);
    setText(serializeSGP(next));
    setWarnings([]);
  };

  const editText = (value: string) => {
    setText(value);
    if (value.length > env.VITE_MAX_PROMPT_BYTES) {
      setWarnings([{ line: 1, message: t('error.promptTooLarge') }]);
      return;
    }
    const parsed = parseSGP(value);
    setWarnings(parsed.warnings);
    onChange({
      name: parsed.name || draft.name,
      tags: parsed.tags,
      notes: parsed.notes,
      preserve: parsed.preserve,
      params: parsed.params,
    });
  };

  return (
    <div className="draft-editor">
      <label className="draft-field">
        <span>{t('library.nameLabel')}</span>
        <input
          maxLength={80}
          value={draft.name}
          onChange={(event) => replace({ ...draft, name: event.currentTarget.value })}
        />
      </label>

      <h3 className="draft-title">{t('reference.adjust')}</h3>
      <div className="draft-sliders">
        {DEFS.map((def) => {
          const key = def.key as keyof typeof DEFAULT_PARAMS;
          const setValue = (value: number) =>
            replace({ ...draft, params: { ...draft.params, [key]: value } });
          return (
            <ParamField
              key={key}
              def={def}
              idPrefix="draft"
              value={draft.params[key]}
              onChange={setValue}
              onReset={() => setValue(DEFAULT_PARAMS[key])}
            />
          );
        })}
      </div>

      <label className="draft-field">
        <span>{t('editor.label')}</span>
        <textarea
          rows={10}
          spellCheck={false}
          value={text}
          onChange={(event) => editText(event.currentTarget.value)}
        />
      </label>
      {warnings.length === 0 ? (
        <p className="draft-note">{t('editor.allRead')}</p>
      ) : (
        <ul className="draft-warnings" aria-label={t('editor.warnings', { count: warnings.length })}>
          {warnings.map((warning) => (
            <li key={`${warning.line}:${warning.message}`}>
              {t('reference.warning', { line: warning.line, message: warning.message })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
