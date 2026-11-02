import { t } from '../../i18n';
import { promptStore, usePrompt } from '../../store/promptStore';

export function WarningList() {
  const warnings = usePrompt((s) => s.warnings);

  if (warnings.length === 0) return <p className="warning-none">{t('editor.allRead')}</p>;

  return (
    <div className="warning-list">
      <p className="warning-count" role="status">
        {t('editor.warnings', { count: warnings.length })}
      </p>
      <ul>
        {warnings.map((warning, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => promptStore.setState({ jumpTo: { line: warning.line } })}
            >
              <span className="warning-line">{warning.line}</span>
              <span>
                {warning.message}
                {warning.suggestion && (
                  <span className="warning-suggestion">
                    {' '}
                    {t('editor.suggest', { suggestion: warning.suggestion })}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
