import { migrateParams, parseSGP, SCHEMA_VERSION, serializeSGP } from '@prompt-grader/engine';
import { ulid } from 'ulid';
import { z } from 'zod';
import type { PromptRecord } from './db';

export const LIBRARY_FORMAT = 'prompt-grader/library';
const LEGACY_FORMAT = 'kreadsi-prompts';
const MAX_NAME = 80;
const MAX_TAGS = 20;

export type LibraryFileProblem = 'tooLarge' | 'invalid';

export class LibraryFileError extends Error {
  constructor(readonly problem: LibraryFileProblem) {
    super(problem);
  }
}

export interface LibraryLimits {
  maxBytes: number;
  maxItems: number;
}

export interface ImportResult {
  records: PromptRecord[];
  skipped: number;
}

const Envelope = z.object({
  format: z.enum([LIBRARY_FORMAT, LEGACY_FORMAT]),
  version: z.number(),
  schemaVersion: z.number().int().positive().optional(),
  prompts: z.array(z.unknown()),
});

const Item = z.object({
  name: z.string(),
  prompt: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
  preserve: z.string().optional(),
  freeText: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const LegacyItem = z.object({
  name: z.string(),
  text: z.string().optional(),
  note: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

/** Returns `name`, or `name (2)`, `name (3)` and so on when it is already taken. */
export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
}

function normalize(item: unknown, legacy: boolean): z.infer<typeof Item> | null {
  if (!legacy) {
    const parsed = Item.safeParse(item);
    return parsed.success ? parsed.data : null;
  }
  const parsed = LegacyItem.safeParse(item);
  if (!parsed.success) return null;
  const { name, text, note, params } = parsed.data;
  return {
    name,
    ...(params && { params }),
    ...(text !== undefined && { freeText: text }),
    ...(note !== undefined && { notes: note }),
  };
}

/** Reads an untrusted library file. Items that do not fit are counted, never fatal. */
export function parseLibraryFile(
  text: string,
  existingNames: Iterable<string>,
  limits: LibraryLimits,
  now = Date.now(),
): ImportResult {
  if (text.length > limits.maxBytes) throw new LibraryFileError('tooLarge');

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new LibraryFileError('invalid');
  }
  const envelope = Envelope.safeParse(raw);
  if (!envelope.success) throw new LibraryFileError('invalid');

  const { format, schemaVersion, prompts } = envelope.data;
  const from = schemaVersion ?? SCHEMA_VERSION;
  const taken = new Set(existingNames);
  const records: PromptRecord[] = [];

  for (const entry of prompts.slice(0, limits.maxItems)) {
    const item = normalize(entry, format === LEGACY_FORMAT);
    const trimmed = item?.name.trim().slice(0, MAX_NAME);
    if (!item || !trimmed || (!item.params && !item.prompt)) continue;

    const name = uniqueName(trimmed, taken);
    taken.add(name);
    const params = item.params ? migrateParams(item.params, from) : parseSGP(item.prompt!).params;
    const tags = (item.tags ?? []).slice(0, MAX_TAGS);
    records.push({
      id: ulid(now),
      name,
      prompt: serializeSGP({
        name,
        params,
        tags,
        ...(item.notes !== undefined && { notes: item.notes }),
        ...(item.preserve !== undefined && { preserve: item.preserve }),
      }),
      params,
      schemaVersion: SCHEMA_VERSION,
      tags,
      source: 'import',
      createdAt: now,
      updatedAt: now,
      ...(item.freeText !== undefined && { freeText: item.freeText }),
      ...(item.notes !== undefined && { notes: item.notes }),
      ...(item.preserve !== undefined && { preserve: item.preserve }),
    });
  }
  return { records, skipped: prompts.length - records.length };
}

export function serializeLibrary(prompts: readonly PromptRecord[], now = new Date()): string {
  return JSON.stringify(
    {
      format: LIBRARY_FORMAT,
      version: 1,
      exportedAt: now.toISOString(),
      schemaVersion: SCHEMA_VERSION,
      prompts: prompts.map(({ name, prompt, params, notes, preserve, freeText, tags }) => ({
        name,
        prompt,
        params,
        notes,
        preserve,
        freeText,
        tags,
      })),
    },
    null,
    2,
  );
}
