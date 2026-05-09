/**
 * Cimple syntax highlighter (Python-like)
 */
import { escapeHtml } from './utils.js';

const CIMPLE_KEYWORDS = new Set([
  'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'in', 'return', 'yield',
  'break', 'continue', 'pass', 'raise', 'try', 'except', 'finally', 'with', 'as',
  'import', 'from', 'and', 'or', 'not', 'True', 'False', 'None', 'lambda', 'assert',
  'global', 'nonlocal', 'del', 'match', 'case', 'async', 'await'
]);

const CIMPLE_BUILTINS = new Set([
  'print', 'len', 'range', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set',
  'tuple', 'input', 'open', 'type', 'isinstance', 'enumerate', 'zip', 'map',
  'filter', 'sum', 'min', 'max', 'abs', 'round', 'sorted', 'reversed', 'iter', 'next',
  'super', 'property', 'staticmethod', 'classmethod', 'getattr', 'setattr', 'hasattr',
  'any', 'all', 'dir', 'vars', 'id', 'hash'
]);

export function highlightCimple(source) {
  if (!source) return '';
  return source.split('\n').map(highlightLine).join('\n');
}

function highlightLine(line) {
  let result = '';
  let i = 0;
  const n = line.length;

  // Track if we're looking for an identifier after 'def' or 'class'
  let expectIdentifier = false;
  let identifierType = ''; // 'hl-function' or 'hl-builtin' (used for class names too)

  while (i < n) {
    const char = line[i];

    // Handle quotes
    if (char === '"' || char === "'") {
      if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
        const q = line.slice(i, i + 3);
        let end = line.indexOf(q, i + 3);
        if (end === -1) end = n;
        else end += 3;
        result += `<span class="hl-string">${escapeHtml(line.slice(i, end))}</span>`;
        i = end;
        continue;
      }
      const q = char;
      let end = i + 1;
      while (end < n && (line[end] !== q || line[end - 1] === '\\')) end++;
      if (end < n) end++;
      result += `<span class="hl-string">${escapeHtml(line.slice(i, end))}</span>`;
      i = end;
      continue;
    }
    // Handle comments
    if (char === '#') {
      result += `<span class="hl-comment">${escapeHtml(line.slice(i))}</span>`;
      break;
    }
    // Handle numbers
    if ((char >= '0' && char <= '9') || char === '.') {
      if (i === 0 || (line[i - 1] <= ' ' || line[i - 1] === '(' || line[i - 1] === '[' || line[i - 1] === '{' || line[i - 1] === ',' || line[i - 1] === '=' || line[i - 1] === ':')) {
        let end = i;
        while (end < n && /[0-9.xXa-fA-F_]/.test(line[end])) end++;
        if (line[end] === '.' && end + 1 < n && /[0-9]/.test(line[end + 1])) {
          end++;
          while (end < n && /[0-9eE+-]/.test(line[end])) end++;
        }
        result += `<span class="hl-number">${escapeHtml(line.slice(i, end))}</span>`;
        i = end;
        continue;
      }
    }
    // Handle decorators
    if (char === '@' && (i === 0 || line[i - 1] <= ' ')) {
      let end = i + 1;
      while (end < n && /[a-zA-Z0-9_]/.test(line[end])) end++;
      result += `<span class="hl-operator">@</span><span class="hl-decorator">${escapeHtml(line.slice(i + 1, end))}</span>`;
      i = end;
      continue;
    }
    // Handle identifiers and keywords
    if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_') {
      let end = i;
      while (end < n && /[a-zA-Z0-9_]/.test(line[end])) end++;
      const word = line.slice(i, end);
      const escaped = escapeHtml(word);

      if (expectIdentifier) {
        result += `<span class="${identifierType}">${escaped}</span>`;
        expectIdentifier = false;
      } else if (CIMPLE_KEYWORDS.has(word)) {
        result += `<span class="hl-keyword">${escaped}</span>`;
        if (word === 'def') {
          expectIdentifier = true;
          identifierType = 'hl-function';
        } else if (word === 'class') {
          expectIdentifier = true;
          identifierType = 'hl-builtin';
        }
      } else if (CIMPLE_BUILTINS.has(word)) {
        result += `<span class="hl-builtin">${escaped}</span>`;
      } else {
        result += escaped;
      }
      i = end;
      continue;
    }
    // Handle operators and symbols
    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '%' || char === '=' || char === '<' || char === '>' || char === '!' || char === '&' || char === '|' || char === '^' || char === '~' || char === '@') {
      result += `<span class="hl-operator">${escapeHtml(char)}</span>`;
      i++;
      continue;
    }
    // Handle brackets, parentheses, and punctuation
    if (char === '(' || char === ')' || char === '[' || char === ']' || char === '{' || char === '}' || char === ':' || char === ',' || char === '.' || char === ';') {
      result += `<span class="hl-symbol">${escapeHtml(char)}</span>`;
      i++;
      continue;
    }
    // Reset expectIdentifier if we hit something else (except space)
    if (char > ' ') {
      expectIdentifier = false;
    }

    result += escapeHtml(char);
    i++;
  }
  return result;
}

export { CIMPLE_KEYWORDS, CIMPLE_BUILTINS };
