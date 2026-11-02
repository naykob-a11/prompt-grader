import { buildBridgeInstruction } from '@prompt-grader/engine';
import { useState, type RefObject } from 'react';
import template from '../../../../../seed/sgp-bridge-instruction.md?raw';
import { t } from '../../i18n';
import { copyText } from '../../services/clipboard';

type CopyState = 'idle' | 'copied' | 'refused';

export function ChatBridgeDialog({ dialog }: { dialog: RefObject<HTMLDialogElement> }) {
  const [freeText, setFreeText] = useState('');
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const instruction = buildBridgeInstruction(template, freeText);

  const onCopy = async () => {
    setCopyState((await copyText(instruction)) ? 'copied' : 'refused');
  };

  return (
    <dialog ref={dialog} className="dialog bridge">
      <h2>{t('bridge.title')}</h2>
      <p>{t('bridge.steps')}</p>
      <p className="bridge-privacy">{t('bridge.privacy')}</p>
      <label htmlFor="bridge-free-text">{t('bridge.freeText')}</label>
      <textarea
        id="bridge-free-text"
        rows={4}
        value={freeText}
        onChange={(event) => {
          setFreeText(event.currentTarget.value);
          setCopyState('idle');
        }}
      />
      <label htmlFor="bridge-instruction">{t('bridge.preview')}</label>
      <textarea id="bridge-instruction" rows={6} readOnly value={instruction} />
      <p className="bridge-status" role="status">
        {copyState === 'copied' && t('bridge.copied')}
        {copyState === 'refused' && t('bridge.refused')}
      </p>
      <div className="save-actions">
        <button type="button" className="primary" onClick={() => void onCopy()}>
          {t('bridge.copy')}
        </button>
        <form method="dialog">
          <button type="submit">{t('shortcuts.close')}</button>
        </form>
      </div>
    </dialog>
  );
}
