import { useEffect, useRef, useState, type DragEvent, type RefObject } from 'react';
import { t, type MessageKey } from '../../i18n';
import {
  draftFromReference,
  saveReferenceDraft,
  type ReferenceDraft,
} from '../../services/referenceTone';
import { DraftEditor } from './DraftEditor';
import './reference.css';
import { useDraftPreview } from './useDraftPreview';

interface Reference {
  url: string;
  name: string;
}

/**
 * A prompt is prepared here apart from the editor, so nothing changes until it is saved. The
 * draft stays while the page is open, and closing the window does not lose it.
 */
export function ReferenceWindow({ dialog }: { dialog: RefObject<HTMLDialogElement> }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [reference, setReference] = useState<Reference | null>(null);
  const [draft, setDraft] = useState<ReferenceDraft | null>(null);
  /** Remounts the editor for a new measurement, whose text starts afresh. */
  const [revision, setRevision] = useState(0);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useDraftPreview(canvas, draft?.params ?? null);

  useEffect(() => {
    return () => {
      if (reference) URL.revokeObjectURL(reference.url);
    };
  }, [reference]);

  const choose = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setProblem(null);
    const result = await draftFromReference(file);
    if (typeof result === 'string') {
      setProblem(result);
    } else {
      setReference({ url: URL.createObjectURL(file), name: file.name });
      setDraft(result);
      setRevision((value) => value + 1);
    }
    setBusy(false);
  };

  // Without this the window's own handler would open the file as the photo to edit.
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void choose(event.dataTransfer.files[0]);
  };

  const save = async () => {
    if (!draft) return;
    setProblem(null);
    if (await saveReferenceDraft(draft)) dialog.current?.close();
    else setProblem('error.storage');
  };

  return (
    <dialog
      ref={dialog}
      className="dialog reference-window"
      onDrop={onDrop}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <h2>{t('reference.title')}</h2>
      {!draft && <p className="draft-note">{t('reference.hint')}</p>}

      {draft && reference && (
        <div className="reference-body">
          <div className="reference-images">
            <figure>
              <img src={reference.url} alt={t('reference.imageAlt', { name: reference.name })} />
              <figcaption>{t('reference.imageLabel', { name: reference.name })}</figcaption>
            </figure>
            <figure>
              <canvas ref={setCanvas} aria-label={t('reference.result')} />
              <figcaption>{t('reference.result')}</figcaption>
            </figure>
          </div>
          <DraftEditor key={revision} draft={draft} onChange={setDraft} />
        </div>
      )}

      {busy && (
        <p className="draft-note" role="status">
          {t('reference.working')}
        </p>
      )}
      {problem && (
        <p className="draft-problem" role="alert">
          {t(problem)}
        </p>
      )}

      <div className="save-actions">
        {draft && (
          <button
            type="button"
            className="primary"
            disabled={busy || !draft.name.trim()}
            onClick={() => void save()}
          >
            {t('reference.save')}
          </button>
        )}
        <button
          type="button"
          className={draft ? '' : 'primary'}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {t(draft ? 'reference.change' : 'reference.choose')}
        </button>
        <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>
          {t('shortcuts.close')}
        </button>
      </div>
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="reference-input"
        onChange={(event) => {
          void choose(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
    </dialog>
  );
}
