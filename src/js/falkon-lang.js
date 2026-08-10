// Falkon Language definition and auto-complete provider for Monaco Editor

export const FALKON_LANG_ID = 'falkon';

export const falkonLanguageDef = {
  defaultToken: '',
  tokenPostfix: '.falkon',

  keywords: [
    'fn', 'func', 'function', 'let', 'const', 'var', 'if', 'else', 'elif',
    'while', 'for', 'in', 'return', 'import', 'from', 'export', 'class',
    'struct', 'enum', 'trait', 'impl', 'pub', 'priv', 'async', 'await',
    'try', 'catch', 'throw', 'match', 'case', 'break', 'continue', 'as',
    'true', 'false', 'null', 'nil', 'none'
  ],

  typeKeywords: [
    'int', 'float', 'string', 'bool', 'array', 'dict', 'map', 'set', 'void', 'any', 'auto'
  ],

  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
    '<<', '>>', '+=', '-=', '*=', '/=', '=>', '->'
  ],

  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  tokenizer: {
    root: [
      [/[a-z_$][\w$]*/, {
        cases: {
          '@typeKeywords': 'keyword.type',
          '@keywords': 'keyword',
          '@default': 'identifier'
        }
      }],
      [/[A-Z][\w\$]*/, 'type.identifier'],
      { include: '@whitespace' },
      [/[{}()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],
      [/[;,.]/, 'delimiter'],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string']
    ],
    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/\/\*/, 'comment', '@comment'],
      [/\/\/.*$/, 'comment'],
      [/#.*$/, 'comment']
    ],
    comment: [
      [/[^\/*]+/, 'comment'],
      [/\/\*/, 'comment', '@push'],
      ["\\*/", 'comment', '@pop'],
      [/[/*]/, 'comment']
    ]
  }
};

export const falkonCompletionProvider = {
  provideCompletionItems: (model, position) => {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn
    };

    const suggestions = [
      {
        label: 'fn',
        kind: 14, // Snippet
        insertText: 'fn ${1:name}(${2:args}) {\n\t${0}\n}',
        insertTextRules: 4,
        documentation: 'Function declaration',
        range
      },
      {
        label: 'let',
        kind: 14,
        insertText: 'let ${1:varName} = ${2:value};',
        insertTextRules: 4,
        documentation: 'Variable declaration',
        range
      },
      {
        label: 'print',
        kind: 1, // Function
        insertText: 'print(${1:msg});',
        insertTextRules: 4,
        documentation: 'Print message to standard output',
        range
      },
      {
        label: 'if',
        kind: 14,
        insertText: 'if ${1:condition} {\n\t${0}\n}',
        insertTextRules: 4,
        documentation: 'If statement',
        range
      }
    ];

    return { suggestions };
  }
};

export function registerFalkonLanguage(monaco) {
  if (!monaco) return;
  if (!monaco.languages.getLanguages().some(lang => lang.id === FALKON_LANG_ID)) {
    monaco.languages.register({ id: FALKON_LANG_ID, extensions: ['.falkon', '.flk'] });
    monaco.languages.setMonarchTokensProvider(FALKON_LANG_ID, falkonLanguageDef);
    monaco.languages.registerCompletionItemProvider(FALKON_LANG_ID, falkonCompletionProvider);
  }
}
