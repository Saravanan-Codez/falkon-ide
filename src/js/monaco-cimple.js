import { CIMPLE_KEYWORDS, CIMPLE_BUILTINS } from './syntax.js';

export function registerCimpleLanguage(monaco) {
  if (!monaco?.languages) return;
  monaco.languages.register({ id: 'cimple' });

  monaco.languages.setMonarchTokensProvider('cimple', {
    tokenizer: {
      root: [
        [/\b(?:def|class|if|elif|else|for|while|in|return|yield|break|continue|pass|raise|try|except|finally|with|as|import|from|and|or|not|True|False|None|lambda|assert|global|nonlocal|del|match|case|async|await)\b/, 'keyword.cimple'],
        [/\b(?:print|len|range|str|int|float|bool|list|dict|set|tuple|input|open|type|isinstance|enumerate|zip|map|filter|sum|min|max|abs|round|sorted|reversed|iter|next|super|property|staticmethod|classmethod|getattr|setattr|hasattr|any|all|dir|vars|id|hash)\b/, 'builtin.cimple'],
        [/"""[\s\S]*?"""/, 'string.cimple'],
        [/'''[\s\S]*?'''/, 'string.cimple'],
        [/"([^"\\]|\\.)*"/, 'string.cimple'],
        [/'([^'\\]|\\.)*'/, 'string.cimple'],
        [/#[^\n]*/, 'comment.cimple'],
        [/\b\d+(\.\d+)?([eE][\+\-]?\d+)?\b/, 'number.cimple'],
      ]
    }
  });

  monaco.languages.setLanguageConfiguration('cimple', {
    comments: { lineComment: '#' },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  });

  monaco.languages.registerCompletionItemProvider('cimple', {
    provideCompletionItems: () => {
      const suggestions = [];
      CIMPLE_KEYWORDS.forEach(word => {
        suggestions.push({
          label: word,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: word
        });
      });
      CIMPLE_BUILTINS.forEach(word => {
        suggestions.push({
          label: word,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: word
        });
      });
      suggestions.push({
        label: 'def',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: 'def ${1:name}(${2:args}):\n    ${3:pass}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      });
      return { suggestions };
    }
  });
}
