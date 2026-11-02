import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { env } from './config/env';
import { Controls } from './features/controls/Controls';
import { ExportDialog } from './features/export/ExportDialog';
import { LibraryPanel } from './features/library/LibraryPanel';
import { ReferenceWindow } from './features/reference/ReferenceWindow';
import { Stage } from './features/stage/Stage';
import { t, type MessageKey } from './i18n';
import { openImageFile, openSampleImage } from './services/openImage';
import { attachFiles, isPromptFile } from './services/promptFiles';
import { hasUnsavedWork, initLibrary, saveCurrent } from './services/prompts';
import { Toasts } from './shared/toast';
import { useHotkeys, type HotkeyHandlers } from './shared/useHotkeys';
import { editorStore, hasUnsavedChanges, useEditor } from './store/editorStore';

const PromptPanel = lazy(() => import('./features/prompt-editor/PromptPanel'));

type Side = 'controls' | 'prompt';
type Tab = 'library' | Side;

/** Phones show everything as tabs; wider screens keep the library in its own column. */
const TABS: readonly { id: Tab; label: MessageKey }[] = [
  { id: 'library', label: 'tabs.library' },
  { id: 'controls', label: 'tabs.controls' },
  { id: 'prompt', label: 'tabs.prompt' },
];

const SIDE_TABS: readonly { id: Side; label: MessageKey }[] = [
  { id: 'prompt', label: 'tabs.prompt' },
  { id: 'controls', label: 'tabs.sliders' },
];

const SHORTCUTS: readonly { keys: string; label: MessageKey }[] = [
  { keys: 'O', label: 'shortcuts.open' },
  { keys: '\\', label: 'shortcuts.peek' },
  { keys: 'C', label: 'shortcuts.compare' },
  { keys: 'Ctrl+Z', label: 'shortcuts.undo' },
  { keys: 'Ctrl+Shift+Z', label: 'shortcuts.redo' },
  { keys: 'Ctrl+S', label: 'shortcuts.save' },
  { keys: 'Ctrl+E', label: 'shortcuts.export' },
];

// initLibrary subscribes for the page's lifetime, so it must run once despite StrictMode.
let libraryStarted = false;

/** Text files become prompts; anything else is tried as an image. */
function openFiles(list: FileList | null | undefined): void {
  const files = Array.from(list ?? []);
  const prompts = files.filter(isPromptFile);
  if (prompts.length > 0) {
    void attachFiles(prompts);
    return;
  }
  const image = files.find((file) => file.type.startsWith('image/')) ?? files[0];
  if (image) void openImageFile(image);
}

export default function App() {
  const [tab, setTab] = useState<Tab>('library');
  const [side, setSide] = useState<Side>('controls');
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const fileInput = useRef<HTMLInputElement>(null);
  const shortcuts = useRef<HTMLDialogElement>(null);
  const exportDialog = useRef<HTMLDialogElement>(null);
  const referenceDialog = useRef<HTMLDialogElement>(null);
  const hasImage = useEditor((s) => s.image !== null);
  const unsaved = useEditor(hasUnsavedChanges);

  useEffect(() => {
    if (env.VITE_SHOW_SAMPLE_IMAGE && !editorStore.getState().image) openSampleImage();
    if (!libraryStarted) {
      libraryStarted = true;
      void initLibrary();
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedWork()) event.preventDefault();
    };
    const onDragOver = (event: DragEvent) => event.preventDefault();
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      openFiles(event.dataTransfer?.files);
    };
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      openFiles(event.clipboardData?.files);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  const hotkeys = useMemo<HotkeyHandlers>(
    () => ({
      onKeyDown(event) {
        const store = editorStore.getState();
        if (event.ctrlKey || event.metaKey) {
          const key = event.key.toLowerCase();
          if (key === 's') void saveCurrent();
          else if (key === 'e') exportDialog.current?.showModal();
          else if (key === 'z' && event.shiftKey) store.redo();
          else if (key === 'z') store.undo();
          else return false;
          return true;
        }
        if (event.key === '\\') store.setPeeking(true);
        else if (event.key === 'o') fileInput.current?.click();
        else if (event.key === 'c') store.cycleCompareMode();
        else return false;
        return true;
      },
      onKeyUp(event) {
        if (event.key === '\\') editorStore.getState().setPeeking(false);
      },
    }),
    [],
  );
  useHotkeys(hotkeys);

  return (
    <div className="app">
      <header className="topbar">
        <h1>{t('app.title')}</h1>
        <button type="button" className="primary" onClick={() => fileInput.current?.click()}>
          {t('top.open')}
        </button>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void openImageFile(file);
            event.currentTarget.value = '';
          }}
        />
        <button
          type="button"
          disabled={!hasImage}
          onClick={() => referenceDialog.current?.showModal()}
        >
          {t('top.reference')}
        </button>
        <button
          type="button"
          disabled={!hasImage}
          onClick={() => exportDialog.current?.showModal()}
        >
          {t('top.export')}
        </button>
        <button type="button" disabled={!canUndo} onClick={() => editorStore.getState().undo()}>
          {t('top.undo')}
        </button>
        <button type="button" disabled={!canRedo} onClick={() => editorStore.getState().redo()}>
          {t('top.redo')}
        </button>
        <button type="button" onClick={() => editorStore.getState().resetAll()}>
          {t('top.reset')}
        </button>
        <button type="button" onClick={() => shortcuts.current?.showModal()}>
          {t('top.shortcuts')}
        </button>
      </header>

      <main className="workspace">
        <Stage />
        <div className="tabs" role="tablist" aria-label={t('tabs.label')}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => {
                setTab(item.id);
                if (item.id !== 'library') setSide(item.id);
              }}
            >
              {t(item.label)}
              {item.id === 'library' && unsaved && (
                <span className="tab-dot">
                  <span className="visually-hidden">{t('library.unsaved')}</span>
                </span>
              )}
            </button>
          ))}
        </div>
        <section className="panel panel-library" data-active={tab === 'library'}>
          <LibraryPanel />
        </section>
        <section className="panel panel-controls" data-active={tab !== 'library'}>
          <div className="side-tabs" role="tablist" aria-label={t('tabs.label')}>
            {SIDE_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={side === item.id}
                onClick={() => {
                  setSide(item.id);
                  setTab(item.id);
                }}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
          {side === 'controls' ? (
            <Controls />
          ) : (
            <Suspense fallback={null}>
              <PromptPanel />
            </Suspense>
          )}
        </section>
      </main>

      <dialog ref={shortcuts} className="dialog">
        <h2>{t('shortcuts.title')}</h2>
        <dl className="shortcut-list">
          {SHORTCUTS.map((item) => (
            <div key={item.keys} className="visually-contents">
              <dt>{item.keys}</dt>
              <dd>{t(item.label)}</dd>
            </div>
          ))}
        </dl>
        <form method="dialog">
          <button type="submit">{t('shortcuts.close')}</button>
        </form>
      </dialog>

      <ReferenceWindow dialog={referenceDialog} />
      <ExportDialog dialog={exportDialog} />
      <Toasts />
    </div>
  );
}
