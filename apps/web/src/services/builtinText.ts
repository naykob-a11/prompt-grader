import { parseSGP } from '@prompt-grader/engine';

const files = import.meta.glob('../../../../seed/structured-prompts/*.sgp.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Notes from the seed structured prompts, by preset name. */
export const BUILTIN_TEXT = new Map(
  Object.values(files).map((text) => {
    const { name, notes, preserve } = parseSGP(text);
    return [name, { notes, preserve }] as const;
  }),
);
