import type { Params } from '@prompt-grader/engine';
import Dexie, { type Table } from 'dexie';

export interface PromptRecord {
  id: string;
  name: string;
  prompt: string;
  freeText?: string;
  params: Params;
  schemaVersion: number;
  notes?: string;
  preserve?: string;
  tags: string[];
  source: 'user' | 'import';
  createdAt: number;
  updatedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export class PromptDb extends Dexie {
  prompts!: Table<PromptRecord, string>;
  settings!: Table<SettingRow, string>;

  constructor(name = 'prompt-grader') {
    super(name);
    this.version(1).stores({
      prompts: 'id, name, source, updatedAt, *tags',
      settings: 'key',
    });
  }
}

export const db = new PromptDb();
