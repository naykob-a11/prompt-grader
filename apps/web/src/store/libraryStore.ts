import { BUILTIN_PRESETS, SCHEMA_VERSION, migrateParams, type Params } from '@prompt-grader/engine';
import { ulid } from 'ulid';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { db as defaultDb, type PromptDb, type PromptRecord } from '../storage/db';
import { uniqueName } from '../storage/libraryFile';

/** One row in the library, whether built in or saved by the user. */
export interface PromptView {
  id: string;
  name: string;
  text: string;
  tags: string[];
  params: Params;
  builtin: boolean;
}

export const BUILTIN_VIEWS: readonly PromptView[] = BUILTIN_PRESETS.map((p) => ({
  id: p.id,
  name: p.name,
  text: p.prompt,
  tags: p.tags,
  params: p.params,
  builtin: true,
}));

export const toView = (record: PromptRecord): PromptView => ({
  id: record.id,
  name: record.name,
  text: record.freeText || record.notes || record.prompt,
  tags: record.tags,
  params: record.params,
  builtin: false,
});

export function matches(view: PromptView, query: string, tag: string | null): boolean {
  if (tag && !view.tags.includes(tag)) return false;
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return `${view.name}\n${view.text}`.toLocaleLowerCase().includes(needle);
}

export interface NewPrompt {
  name: string;
  params: Params;
  tags?: string[];
  freeText?: string;
  notes?: string;
  preserve?: string;
}

export interface LibraryState {
  prompts: PromptRecord[];
  query: string;
  tag: string | null;
  /** True while the form that names a new prompt is open. */
  naming: boolean;

  load(): Promise<void>;
  create(input: NewPrompt): Promise<PromptRecord>;
  saveParams(id: string, params: Params): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  addAll(records: PromptRecord[]): Promise<void>;
  setQuery(query: string): void;
  setTag(tag: string | null): void;
  setNaming(naming: boolean): void;
}

const newestFirst = (a: PromptRecord, b: PromptRecord) =>
  b.updatedAt - a.updatedAt || b.id.localeCompare(a.id);

export function createLibraryStore(db: PromptDb) {
  return createStore<LibraryState>()((set, get) => {
    const patch = async (id: string, change: Partial<PromptRecord>) => {
      const updatedAt = Date.now();
      await db.prompts.update(id, { ...change, updatedAt });
      set((s) => ({
        prompts: s.prompts
          .map((p) => (p.id === id ? { ...p, ...change, updatedAt } : p))
          .sort(newestFirst),
      }));
    };

    return {
      prompts: [],
      query: '',
      tag: null,
      naming: false,

      load: async () => {
        const rows = await db.prompts.toArray();
        const prompts = rows.map((row) => ({
          ...row,
          params: migrateParams(row.params, row.schemaVersion),
          schemaVersion: SCHEMA_VERSION,
        }));
        set({ prompts: prompts.sort(newestFirst) });
      },

      create: async ({ name, params, tags = [], ...text }) => {
        const now = Date.now();
        const record: PromptRecord = {
          id: ulid(now),
          name: uniqueName(name, new Set(get().prompts.map((p) => p.name))),
          // Phase P5 fills this in with serializeSGP().
          prompt: '',
          params,
          schemaVersion: SCHEMA_VERSION,
          tags,
          source: 'user',
          createdAt: now,
          updatedAt: now,
          ...text,
        };
        await db.prompts.add(record);
        set((s) => ({ prompts: [record, ...s.prompts].sort(newestFirst) }));
        return record;
      },

      saveParams: (id, params) => patch(id, { params, schemaVersion: SCHEMA_VERSION }),

      rename: (id, name) => {
        const others = get().prompts.filter((p) => p.id !== id);
        return patch(id, { name: uniqueName(name, new Set(others.map((p) => p.name))) });
      },

      remove: async (id) => {
        await db.prompts.delete(id);
        set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) }));
      },

      addAll: async (records) => {
        await db.prompts.bulkAdd(records);
        set((s) => ({ prompts: [...records, ...s.prompts].sort(newestFirst) }));
      },

      setQuery: (query) => set({ query }),
      setTag: (tag) => set({ tag }),
      setNaming: (naming) => set({ naming }),
    };
  });
}

export const libraryStore = createLibraryStore(defaultDb);

export const useLibrary = <T>(selector: (state: LibraryState) => T): T =>
  useStore(libraryStore, selector);
