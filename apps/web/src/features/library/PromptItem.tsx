import { useState, type KeyboardEvent } from 'react';
import { t } from '../../i18n';
import { deletePrompt, duplicatePrompt, renamePrompt, selectPrompt } from '../../services/prompts';
import type { PromptView } from '../../store/libraryStore';

type Mode = 'idle' | 'renaming' | 'confirming';

export function PromptItem({ view, current }: { view: PromptView; current: boolean }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [draft, setDraft] = useState(view.name);

  const commitRename = () => {
    setMode('idle');
    const name = draft.trim();
    if (name && name !== view.name) void renamePrompt(view.id, name);
  };

  const onRenameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commitRename();
    if (event.key === 'Escape') setMode('idle');
  };

  return (
    <div className="prompt-row">
      {mode === 'renaming' ? (
        <input
          autoFocus
          className="prompt-rename"
          aria-label={t('library.renameLabel', { name: view.name })}
          maxLength={80}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={onRenameKey}
          onBlur={commitRename}
        />
      ) : (
        <button
          type="button"
          className="prompt-item"
          aria-pressed={current}
          onClick={() => selectPrompt(view)}
        >
          <span className="prompt-name">{view.name}</span>
          <span className="prompt-text">{view.text}</span>
        </button>
      )}

      {mode === 'confirming' ? (
        <div className="prompt-actions" role="group">
          <span className="prompt-confirm">{t('library.deleteConfirm')}</span>
          <button type="button" className="danger" onClick={() => void deletePrompt(view.id)}>
            {t('library.deleteYes')}
          </button>
          <button type="button" onClick={() => setMode('idle')}>
            {t('library.cancel')}
          </button>
        </div>
      ) : (
        <div className="prompt-actions">
          <button
            type="button"
            aria-label={t('library.duplicateLabel', { name: view.name })}
            onClick={() => void duplicatePrompt(view)}
          >
            {t('library.duplicate')}
          </button>
          {!view.builtin && (
            <>
              <button
                type="button"
                aria-label={t('library.renameLabel', { name: view.name })}
                onClick={() => {
                  setDraft(view.name);
                  setMode('renaming');
                }}
              >
                {t('library.rename')}
              </button>
              <button
                type="button"
                aria-label={t('library.deleteLabel', { name: view.name })}
                onClick={() => setMode('confirming')}
              >
                {t('library.delete')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
