import { buildTemplate } from '@prompt-grader/engine';
import { useRef, useState } from 'react';
import { env } from '../../config/env';
import { t } from '../../i18n';
import { attachFiles, copyPromptText, exportPromptFile } from '../../services/promptFiles';
import { replaceText } from '../../services/promptSync';
import { editorStore } from '../../store/editorStore';
import { ChatBridgeDialog } from './ChatBridgeDialog';
import { NotesPanel } from './NotesPanel';
import './promptEditor.css';
import { PromptEditor } from './PromptEditor';
import { WarningList } from './WarningList';

// Loaded on demand because CodeMirror is the largest part of the app.
export default function PromptPanel() {
  const fileInput = useRef<HTMLInputElement>(null);
  const bridge = useRef<HTMLDialogElement>(null);
  const [confirmingTemplate, setConfirmingTemplate] = useState(false);

  const insertTemplate = () => {
    setConfirmingTemplate(false);
    editorStore.getState().detachPrompt();
    replaceText(buildTemplate());
  };

  return (
    <div className="prompt-panel">
      <h2 className="visually-hidden">{t('editor.label')}</h2>
      <div className="prompt-toolbar">
        <button type="button" onClick={() => fileInput.current?.click()}>
          {t('editor.attach')}
        </button>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          multiple
          accept=".txt,.md,text/plain,text/markdown"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void attachFiles(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = '';
          }}
        />
        <button type="button" onClick={() => setConfirmingTemplate(true)}>
          {t('editor.template')}
        </button>
        {env.VITE_FEATURE_CHAT_BRIDGE && (
          <button type="button" onClick={() => bridge.current?.showModal()}>
            {t('editor.chat')}
          </button>
        )}
        <button type="button" onClick={exportPromptFile}>
          {t('export.prompt')}
        </button>
        <button type="button" onClick={() => void copyPromptText()}>
          {t('editor.copy')}
        </button>
      </div>

      {confirmingTemplate && (
        <div className="prompt-confirm-template" role="group">
          <span>{t('editor.templateConfirm')}</span>
          <button type="button" className="primary" onClick={insertTemplate}>
            {t('editor.templateYes')}
          </button>
          <button type="button" onClick={() => setConfirmingTemplate(false)}>
            {t('library.cancel')}
          </button>
        </div>
      )}

      <PromptEditor />
      <WarningList />
      <NotesPanel />
      {env.VITE_FEATURE_CHAT_BRIDGE && <ChatBridgeDialog dialog={bridge} />}
    </div>
  );
}
