import { t } from '../../i18n';
import { usePrompt } from '../../store/promptStore';

export function NotesPanel() {
  const notes = usePrompt((s) => s.meta.notes);
  const preserve = usePrompt((s) => s.meta.preserve);
  if (!notes && !preserve) return null;

  return (
    <div className="notes-panel">
      {notes && (
        <section>
          <h3>{t('editor.notes')}</h3>
          <p>{notes}</p>
        </section>
      )}
      {preserve && (
        <section>
          <h3>{t('editor.preserve')}</h3>
          <p>{preserve}</p>
        </section>
      )}
    </div>
  );
}
