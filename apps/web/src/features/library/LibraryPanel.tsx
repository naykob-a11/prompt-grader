import { useMemo } from 'react';
import { t } from '../../i18n';
import { useEditor } from '../../store/editorStore';
import {
  BUILTIN_VIEWS,
  libraryStore,
  matches,
  toView,
  useLibrary,
  type PromptView,
} from '../../store/libraryStore';
import { ImportExport } from './ImportExport';
import './library.css';
import { PromptItem } from './PromptItem';
import { ReferenceTone } from './ReferenceTone';
import { SaveBar } from './SaveBar';

function PromptList({ views, label }: { views: readonly PromptView[]; label: string }) {
  const promptId = useEditor((s) => s.promptId);
  return (
    <ul className="prompt-list" aria-label={label}>
      {views.map((view) => (
        <li key={view.id}>
          <PromptItem view={view} current={view.id === promptId} />
        </li>
      ))}
    </ul>
  );
}

export function LibraryPanel() {
  const prompts = useLibrary((s) => s.prompts);
  const query = useLibrary((s) => s.query);
  const tag = useLibrary((s) => s.tag);
  const { setQuery, setTag } = libraryStore.getState();

  const mine = useMemo(() => prompts.map(toView), [prompts]);
  const tags = useMemo(
    () => [...new Set([...mine, ...BUILTIN_VIEWS].flatMap((view) => view.tags))],
    [mine],
  );
  const visibleMine = mine.filter((view) => matches(view, query, tag));
  const visibleBuiltin = BUILTIN_VIEWS.filter((view) => matches(view, query, tag));
  const nothingFound = visibleMine.length + visibleBuiltin.length === 0;

  return (
    <>
      <h2 className="visually-hidden">{t('library.label')}</h2>
      <SaveBar />
      <ReferenceTone />

      <input
        type="search"
        className="library-search"
        aria-label={t('library.search')}
        placeholder={t('library.search')}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      <div className="tag-list" role="group" aria-label={t('library.tags')}>
        {tags.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={tag === name}
            onClick={() => setTag(tag === name ? null : name)}
          >
            {name}
          </button>
        ))}
      </div>

      {nothingFound && <p className="library-empty">{t('library.noMatch')}</p>}

      <h3 className="library-title">{t('library.mine')}</h3>
      {mine.length === 0 && <p className="library-empty">{t('library.empty')}</p>}
      <PromptList views={visibleMine} label={t('library.mine')} />

      <h3 className="library-title">{t('library.builtin')}</h3>
      <PromptList views={visibleBuiltin} label={t('library.builtin')} />

      <ImportExport />
    </>
  );
}
