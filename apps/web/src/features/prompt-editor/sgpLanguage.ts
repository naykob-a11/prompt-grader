import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { HighlightStyle, StreamLanguage, type StringStream } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { editorWords } from '@prompt-grader/engine';

const words = editorWords();

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const longestFirst = (list: readonly string[]) => [...list].sort((a, b) => b.length - a.length);
const LEVEL = new RegExp(`^(?:${longestFirst(words.allLevels).map(escape).join('|')})`, 'i');
const NUMBER = new RegExp(`^[+\\-−–]?\\d+(?:\\.\\d+)?\\s*(?:${words.degrees.join('|')})?`);

interface LineState {
  /** True once the line's colon has passed, so what follows is its value. */
  inValue: boolean;
}

export const sgpLanguage = StreamLanguage.define<LineState>({
  startState: () => ({ inValue: false }),

  token(stream: StringStream, state: LineState) {
    if (stream.sol()) {
      state.inValue = false;
      if (stream.match(/^\s*#.*/)) return 'meta';
      if (stream.match(/^\s*\[.*\]\s*$/)) return 'heading';
    }
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (!state.inValue) {
      if (stream.match(/^[^:：/]+(?=[:：])/)) return 'propertyName';
      if (stream.match(/^[:：]/)) {
        state.inValue = true;
        return null;
      }
      stream.next();
      return null;
    }
    if (stream.match(NUMBER)) return 'number';
    if (stream.match(LEVEL)) return 'keyword';
    stream.next();
    return null;
  },
});

export const sgpHighlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--accent)', fontWeight: '600' },
  { tag: tags.propertyName, color: 'var(--fg)', fontWeight: '600' },
  { tag: tags.number, color: 'var(--accent)', fontFamily: 'var(--font-mono)' },
  { tag: tags.keyword, color: 'var(--accent)' },
  { tag: tags.meta, color: 'var(--muted)' },
  { tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
]);

const headingOptions = words.headings.map((label) => ({
  label,
  type: 'property',
  apply: `${label}: `,
}));
const valueOptions = [
  ...words.levels.map((label) => ({ label, type: 'keyword' })),
  ...[...new Set(words.directions)].map((label) => ({ label, type: 'text' })),
  ...words.colors.map((label) => ({ label, type: 'constant' })),
];

/** Offers headings before a line's colon, and levels and directions after it. */
export function sgpCompletions(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[^\s:：,()]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const before = context.state.doc.lineAt(context.pos).text;
  const column = context.pos - context.state.doc.lineAt(context.pos).from;
  if (before.startsWith('#') || before.startsWith('[')) return null;
  const inValue = /[:：]/.test(before.slice(0, column));
  return { from: word.from, options: inValue ? valueOptions : headingOptions };
}
