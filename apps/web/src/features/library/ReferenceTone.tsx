import { useEffect, useRef, useState, type DragEvent } from 'react';
import { t } from '../../i18n';
import { createPromptFromReference } from '../../services/referenceTone';
import { useEditor } from '../../store/editorStore';

interface Reference {
  url: string;
  name: string;
}

export function ReferenceTone() {
  const hasImage = useEditor((s) => s.image !== null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<Reference | null>(null);

  useEffect(() => {
    return () => {
      if (reference) URL.revokeObjectURL(reference.url);
    };
  }, [reference]);

  const choose = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    const matched = await createPromptFromReference(file);
    if (matched) setReference({ url: URL.createObjectURL(file), name: file.name });
    setBusy(false);
  };

  // Without this the window's own handler would open the file as the photo to edit.
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (hasImage) void choose(event.dataTransfer.files[0]);
  };

  return (
    <section className="reference-tone" aria-label={t('reference.title')} onDrop={onDrop}>
      <h3 className="library-title">{t('reference.title')}</h3>
      <p className="library-empty">{t('reference.hint')}</p>
      {reference && (
        <figure className="reference-preview">
          <img src={reference.url} alt={t('reference.imageAlt', { name: reference.name })} />
          <figcaption>{reference.name}</figcaption>
        </figure>
      )}
      <button type="button" disabled={!hasImage || busy} onClick={() => fileInput.current?.click()}>
        {t(reference ? 'reference.change' : 'reference.choose')}
      </button>
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
      {busy && (
        <p className="library-empty" role="status">
          {t('reference.working')}
        </p>
      )}
    </section>
  );
}
