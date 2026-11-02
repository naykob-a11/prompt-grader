import { useState, type FormEvent } from 'react';
import { t } from '../../i18n';
import { saveAsNew, saveCurrent } from '../../services/prompts';
import { hasUnsavedChanges, useEditor } from '../../store/editorStore';
import { libraryStore, useLibrary } from '../../store/libraryStore';
import { hasUnsavedMeta, promptStore, usePrompt } from '../../store/promptStore';

function NameForm() {
  const [name, setName] = useState(promptStore.getState().meta.name || t('library.newName'));
  const { setNaming } = libraryStore.getState();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) void saveAsNew(trimmed);
  };

  return (
    <form className="save-form" onSubmit={onSubmit}>
      <label htmlFor="new-prompt-name">{t('library.nameLabel')}</label>
      <input
        autoFocus
        id="new-prompt-name"
        maxLength={80}
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setNaming(false);
        }}
      />
      <div className="save-actions">
        <button type="submit" className="primary">
          {t('library.saveNew')}
        </button>
        <button type="button" onClick={() => setNaming(false)}>
          {t('library.cancel')}
        </button>
      </div>
    </form>
  );
}

export function SaveBar() {
  const naming = useLibrary((s) => s.naming);
  const paramsChanged = useEditor(hasUnsavedChanges);
  const metaChanged = usePrompt(hasUnsavedMeta);
  const dirty = paramsChanged || metaChanged;
  const promptId = useEditor((s) => s.promptId);
  const canOverwrite = useLibrary((s) => s.prompts.some((p) => p.id === promptId));

  if (naming) return <NameForm />;

  return (
    <div className="save-bar">
      {dirty && (
        <p className="save-status" role="status">
          {t('library.unsaved')}
        </p>
      )}
      <div className="save-actions">
        {dirty && canOverwrite && (
          <button type="button" onClick={() => void saveCurrent()}>
            {t('library.saveOver')}
          </button>
        )}
        <button
          type="button"
          className={dirty ? 'primary' : ''}
          onClick={() => libraryStore.getState().setNaming(true)}
        >
          {t('library.new')}
        </button>
      </div>
    </div>
  );
}
