import { useRef, useState, type RefObject } from 'react';
import { t, type MessageKey } from '../../i18n';
import { downloadBlob } from '../../services/download';
import { exportFileName, exportImage } from '../../services/exportImage';
import { showToast } from '../../shared/toast';
import { editorStore, useEditor } from '../../store/editorStore';
import { exportStore, setExportSetting, useExportSettings } from '../../store/exportStore';
import { usePrompt } from '../../store/promptStore';
import './export.css';

const FORMATS: readonly { id: 'jpeg' | 'png' | 'webp'; label: MessageKey }[] = [
  { id: 'jpeg', label: 'export.jpeg' },
  { id: 'png', label: 'export.png' },
  { id: 'webp', label: 'export.webp' },
];

export function ExportDialog({ dialog }: { dialog: RefObject<HTMLDialogElement> }) {
  const image = useEditor((s) => s.image);
  const promptName = usePrompt((s) => s.meta.name);
  const format = useExportSettings((s) => s.exportFormat);
  const quality = useExportSettings((s) => s.jpegQuality);
  const keepExif = useExportSettings((s) => s.keepExif);
  const stripGps = useExportSettings((s) => s.stripGps);
  const [percent, setPercent] = useState<number | null>(null);
  const running = useRef<AbortController | null>(null);

  const fileName = image ? exportFileName(image.name, promptName, format) : '';
  const busy = percent !== null;

  const start = async () => {
    if (!image) return;
    const controller = new AbortController();
    running.current = controller;
    setPercent(0);
    try {
      const blob = await exportImage(image, editorStore.getState().params, exportStore.getState(), {
        signal: controller.signal,
        onProgress: (fraction) => setPercent(Math.round(fraction * 100)),
      });
      downloadBlob(fileName, blob);
      dialog.current?.close();
    } catch {
      if (!controller.signal.aborted) showToast(t('error.export'), 'error');
    } finally {
      running.current = null;
      setPercent(null);
    }
  };

  return (
    <dialog
      ref={dialog}
      className="dialog export"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <h2>{t('export.title')}</h2>

      <fieldset disabled={busy}>
        <legend>{t('export.format')}</legend>
        <div className="export-formats">
          {FORMATS.map((item) => (
            <label key={item.id}>
              <input
                type="radio"
                name="export-format"
                checked={format === item.id}
                onChange={() => setExportSetting('exportFormat', item.id)}
              />
              {t(item.label)}
            </label>
          ))}
        </div>

        {format !== 'png' && (
          <label className="export-quality">
            <span>{t('export.quality', { value: quality })}</span>
            <input
              type="range"
              min={60}
              max={100}
              value={quality}
              onChange={(event) =>
                setExportSetting('jpegQuality', event.currentTarget.valueAsNumber)
              }
            />
          </label>
        )}

        {format === 'jpeg' && (
          <>
            <label className="export-check">
              <input
                type="checkbox"
                checked={keepExif}
                onChange={(event) => setExportSetting('keepExif', event.currentTarget.checked)}
              />
              {t('export.keepExif')}
            </label>
            <label className="export-check">
              <input
                type="checkbox"
                checked={stripGps}
                disabled={!keepExif}
                onChange={(event) => setExportSetting('stripGps', event.currentTarget.checked)}
              />
              {t('export.stripGps')}
            </label>
          </>
        )}
      </fieldset>

      {image && (
        <p className="export-info">
          {t('export.fileName', { name: fileName, width: image.width, height: image.height })}
        </p>
      )}

      {busy && (
        <div role="status">
          <progress max={100} value={percent} aria-label={t('export.button')} />
          <p className="export-info">{t('export.progress', { percent })}</p>
        </div>
      )}

      <div className="save-actions">
        {busy ? (
          <button type="button" onClick={() => running.current?.abort()}>
            {t('library.cancel')}
          </button>
        ) : (
          <>
            <button type="button" className="primary" onClick={() => void start()}>
              {t('export.button')}
            </button>
            <button type="button" onClick={() => dialog.current?.close()}>
              {t('shortcuts.close')}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
