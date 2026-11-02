import { BUILTIN_PRESETS } from '@prompt-grader/engine';
import { t } from '../../i18n';
import { editorStore, useEditor } from '../../store/editorStore';
import './library.css';
import { PromptItem } from './PromptItem';

export function LibraryPanel() {
  const presetId = useEditor((s) => s.presetId);
  return (
    <>
      <h2 className="library-title">{t('library.builtin')}</h2>
      <ul className="prompt-list" aria-label={t('library.label')}>
        {BUILTIN_PRESETS.map((preset) => (
          <li key={preset.id}>
            <PromptItem
              name={preset.name}
              text={preset.prompt}
              current={preset.id === presetId}
              onSelect={() => editorStore.getState().selectPreset(preset.id)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
