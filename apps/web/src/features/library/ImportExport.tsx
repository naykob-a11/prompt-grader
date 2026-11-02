import { useRef } from 'react';
import { t } from '../../i18n';
import { exportLibrary, importLibrary } from '../../services/prompts';
import { useLibrary } from '../../store/libraryStore';

export function ImportExport() {
  const input = useRef<HTMLInputElement>(null);
  const hasPrompts = useLibrary((s) => s.prompts.length > 0);

  return (
    <div className="import-export">
      <button type="button" onClick={() => input.current?.click()}>
        {t('library.import')}
      </button>
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void importLibrary(file);
          event.currentTarget.value = '';
        }}
      />
      <button type="button" disabled={!hasPrompts} onClick={exportLibrary}>
        {t('library.export')}
      </button>
    </div>
  );
}
