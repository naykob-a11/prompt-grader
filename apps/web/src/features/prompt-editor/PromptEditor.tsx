import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { Annotation, EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { t } from '../../i18n';
import { editText, parseNow } from '../../services/promptSync';
import { promptStore } from '../../store/promptStore';
import { sgpCompletions, sgpHighlight, sgpLanguage } from './sgpLanguage';

/** Marks a change that came from the store, so it is not sent back as typing. */
const fromStore = Annotation.define<boolean>();

/** Shows the warnings from the last parse as underlines with tooltips. */
function showWarnings(view: EditorView): void {
  const { doc } = view.state;
  const diagnostics: Diagnostic[] = promptStore
    .getState()
    .warnings.filter((warning) => warning.line <= doc.lines)
    .map((warning) => {
      const line = doc.line(warning.line);
      return { from: line.from, to: line.to, severity: 'warning', message: warning.message };
    });
  view.dispatch(setDiagnostics(view.state, diagnostics));
}

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--bg)', color: 'var(--fg)' },
  '.cm-scroller': { fontFamily: 'var(--font-body)', lineHeight: '1.6' },
  '.cm-gutters': { backgroundColor: 'var(--panel)', color: 'var(--muted)', border: 'none' },
  '.cm-content': { caretColor: 'var(--fg)' },
  '.cm-cursor': { borderLeftColor: 'var(--fg)' },
  '&.cm-focused': { outline: '2px solid var(--accent)' },
});

export function PromptEditor() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    // CodeMirror adds a <style> tag to a document, which `style-src 'self'` blocks. In a shadow
    // root it uses a constructed stylesheet instead, so the policy can stay strict.
    const root = host.current.shadowRoot ?? host.current.attachShadow({ mode: 'open' });
    const view = new EditorView({
      root,
      parent: root,
      state: EditorState.create({
        doc: promptStore.getState().text,
        extensions: [
          history(),
          lineNumbers(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': t('editor.label') }),
          placeholder(t('editor.placeholder')),
          sgpLanguage,
          syntaxHighlighting(sgpHighlight),
          autocompletion({ override: [sgpCompletions] }),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                parseNow();
                return true;
              },
            },
            ...completionKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            const typed =
              update.docChanged && !update.transactions.some((tr) => tr.annotation(fromStore));
            if (typed) editText(update.state.doc.toString());
          }),
          theme,
        ],
      }),
    });

    const unsubscribe = promptStore.subscribe((state, previous) => {
      const current = view.state.doc.toString();
      if (state.text !== current) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: state.text },
          annotations: fromStore.of(true),
        });
      }
      if (state.warnings !== previous.warnings) showWarnings(view);
      if (state.jumpTo && state.jumpTo !== previous.jumpTo) {
        const line = view.state.doc.line(Math.min(state.jumpTo.line, view.state.doc.lines));
        view.dispatch({
          selection: EditorSelection.range(line.from, line.to),
          scrollIntoView: true,
        });
        view.focus();
      }
    });
    showWarnings(view);

    return () => {
      unsubscribe();
      view.destroy();
    };
  }, []);

  return <div ref={host} className="prompt-editor" />;
}
