import {
  BUILTIN_PRESETS,
  SCHEMA_VERSION,
  migrateParams,
  serializeSGP,
  type Params,
} from '@prompt-grader/engine';
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
  source?: PromptRecord['source'];
}

/** The parts of a saved prompt that the editor can change. */
export type PromptContent = Pick<PromptRecord, 'params' | 'tags' | 'notes' | 'preserve'>;

const textOf = (record: Pick<PromptRecord, 'name' | keyof PromptContent>) => {
  const { name, params, tags, notes, preserve } = record;
  return serializeSGP({
    name,
    params,
    tags,
    ...(notes !== undefined && { notes }),
    ...(preserve !== undefined && { preserve }),
  });
};

export interface LibraryState {
  prompts: PromptRecord[];
  query: string;
  tag: string | null;
  /** True while the form that names a new prompt is open. */
  naming: boolean;

  load(): Promise<void>;
  create(input: NewPrompt): Promise<PromptRecord>;
  saveContent(id: string, content: PromptContent): Promise<void>;
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
        const prompts = rows.map((row) => {
          const migrated = {
            ...row,
            params: migrateParams(row.params, row.schemaVersion),
            schemaVersion: SCHEMA_VERSION,
          };
          // Prompts saved before the SGP serializer existed have no text yet.
          return { ...migrated, prompt: row.prompt || textOf(migrated) };
        });
        set({ prompts: prompts.sort(newestFirst) });
      },

      create: async ({ name, params, tags = [], source = 'user', ...text }) => {
        const now = Date.now();
        const unique = uniqueName(name, new Set(get().prompts.map((p) => p.name)));
        const record: PromptRecord = {
          id: ulid(now),
          name: unique,
          prompt: textOf({ name: unique, params, tags, ...text }),
          params,
          schemaVersion: SCHEMA_VERSION,
          tags,
          source,
          createdAt: now,
          updatedAt: now,
          ...text,
        };
        await db.prompts.add(record);
        set((s) => ({ prompts: [record, ...s.prompts].sort(newestFirst) }));
        return record;
      },

      saveContent: (id, content) => {
        const current = get().prompts.find((p) => p.id === id)!;
        const next = { ...current, ...content };
        return patch(id, { ...content, prompt: textOf(next), schemaVersion: SCHEMA_VERSION });
      },

      rename: (id, name) => {
        const current = get().prompts.find((p) => p.id === id)!;
        const others = get().prompts.filter((p) => p.id !== id);
        const unique = uniqueName(name, new Set(others.map((p) => p.name)));
        return patch(id, { name: unique, prompt: textOf({ ...current, name: unique }) });
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
