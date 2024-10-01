import * as monaco from 'monaco-editor';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppSelector } from '../hooks';
import { offerCrateAutocompleteOnUse } from '../selectors';
import { CommonEditorProps } from '../types';
import { themeVsDarkPlus } from './rust_monaco_def';

import * as styles from './Editor.module.css';

function useEditorProp<T>(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  prop: T,
  whenPresent: (
    editor: monaco.editor.IStandaloneCodeEditor,
    model: monaco.editor.ITextModel,
    prop: T,
  ) => void | (() => void),
) {
  useEffect(() => {
    if (!editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    return whenPresent(editor, model, prop);
  }, [editor, prop, whenPresent]);
}

const MonacoEditorCore: React.FC<CommonEditorProps> = (props) => {
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const theme = useAppSelector((s) => s.configuration.monaco.theme);
  const completionProvider = useRef<monaco.IDisposable | null>(null);
  const autocompleteOnUse = useAppSelector(offerCrateAutocompleteOnUse);

  // Replace `initialCode` and `initialTheme` with an "effect event"
  // when those stabilize.
  //
  // https://react.dev/learn/separating-events-from-effects#declaring-an-effect-event
  const initialCode = useRef(props.code);
  const initialTheme = useRef(theme);

  // One-time setup
  useEffect(() => {
    monaco.editor.defineTheme('vscode-dark-plus', themeVsDarkPlus);
  }, []);

  // Construct the editor
  const child = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }

    const editor = monaco.editor.create(node, {
      language: 'rust',
      value: initialCode.current,
      theme: initialTheme.current,
      automaticLayout: true,
      'semanticHighlighting.enabled': true,
    });
    setEditor(editor);

    editor.focus();
  }, []);

  useEditorProp(editor, props.onEditCode, (_editor, model, onEditCode) => {
    model.onDidChangeContent(() => {
      onEditCode(model.getValue());
    });
  });

  useEditorProp(editor, props.execute, (editor, _model, execute) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      execute();
    });
    // Ace's Vim mode runs code with :w, so let's do the same
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      execute();
    });
  });

  useEditorProp(editor, props.code, (editor, model, code) => {
    // Short-circuit if nothing interesting to change.
    if (code === model.getValue()) {
      return;
    }

    editor.executeEdits('redux', [
      {
        text: code,
        range: model.getFullModelRange(),
      },
    ]);
  });

  useEditorProp(editor, theme, (editor, _model, theme) => {
    editor.updateOptions({ theme });
  });

  const autocompleteProps = useMemo(
    () => ({ autocompleteOnUse, crates: props.crates }),
    [autocompleteOnUse, props.crates],
  );

  useEditorProp(editor, autocompleteProps, (_editor, _model, { autocompleteOnUse, crates }) => {
    completionProvider.current = monaco.languages.registerCompletionItemProvider('rust', {
      triggerCharacters: [' '],

      provideCompletionItems(model, position, _context, _token) {
        const word = model.getWordUntilPosition(position);

        function wordBefore(
          word: monaco.editor.IWordAtPosition,
        ): monaco.editor.IWordAtPosition | null {
          const prevPos = { lineNumber: position.lineNumber, column: word.startColumn - 1 };
          return model.getWordAtPosition(prevPos);
        }

        const preWord = wordBefore(word);
        const prePreWord = preWord && wordBefore(preWord);

        const oldStyle = prePreWord?.word === 'extern' && preWord?.word === 'crate';
        const newStyle = autocompleteOnUse && preWord?.word === 'use';

        const triggerPrefix = oldStyle || newStyle;

        if (!triggerPrefix) {
          return { suggestions: [] };
        }

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions = crates.map(({ name, version, id }) => ({
          kind: monaco.languages.CompletionItemKind.Module,
          label: `${name} (${version})`,
          insertText: `${id}; // ${version}`,
          range,
        }));

        return { suggestions };
      },
    });

    return () => {
      completionProvider.current?.dispose();
    };
  });

  return <div className={styles.monaco} ref={child} />;
};

export default MonacoEditorCore;
