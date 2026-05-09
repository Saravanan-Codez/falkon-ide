/**
 * Find & Replace - Floating widget and sidebar panel
 */
import { state } from './state.js';
import * as editor from './editor.js';
const findWidget = document.getElementById('find-widget');

function getFindRegex(useSidebar) {
  const findInput = useSidebar
    ? document.getElementById('find-input')
    : document.getElementById('editor-find-input');
  const caseEl = document.getElementById('find-case');
  const regexEl = document.getElementById('find-regex');
  const wholeEl = document.getElementById('find-whole');
  const caseSensitive = caseEl?.checked ?? false;
  const useRegex = regexEl?.checked ?? false;
  const wholeWord = wholeEl?.checked ?? false;
  let pattern = (findInput?.value) || '';
  if (!pattern && useRegex) return null;
  if (!useRegex) pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (wholeWord) pattern = '\\b' + pattern + '\\b';
  try {
    const regex = new RegExp(pattern, 'g' + (caseSensitive ? '' : 'i'));
    // Security check: if the regex can match an empty string, it can cause OOM or infinite loops
    if (regex.test('')) return null;
    return regex;
  } catch {
    return null;
  }
}

export function findInEditor(forward = true, useSidebar = false) {
  const regex = getFindRegex(useSidebar);
  const text = editor.getActiveContent();
  if (!regex) return;
  const matches = [];
  let m;
  regex.lastIndex = 0;
  while ((m = regex.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length });
    // Advance lastIndex if match is zero-width to prevent infinite loop
    if (m[0].length === 0) {
      regex.lastIndex++;
    }
    // Prevent excessive matches from freezing the UI
    if (matches.length > 5000) break;
  }
  state.findMatches = matches;
  const selection = editor.getSelectionOffsets();
  const cursor = selection.end ?? 0;
  let idx = forward
    ? matches.findIndex(m => m.start >= (selection.end ?? cursor))
    : [...matches].reverse().findIndex(m => m.end <= (selection.start ?? cursor));
  if (forward && idx === -1) idx = 0;
  if (!forward && idx === -1) idx = matches.length - 1;
  if (!forward && matches.length) idx = matches.length - 1 - idx;
  state.currentFindIndex = matches.length ? Math.max(0, idx) : -1;
  const countEl = document.getElementById('editor-find-count');
  if (countEl) countEl.textContent = matches.length ? `${state.currentFindIndex + 1}/${matches.length}` : '0/0';
  if (matches.length && state.currentFindIndex >= 0) {
    const { start, end } = matches[state.currentFindIndex];
    editor.focusEditor();
    editor.setSelectionOffsets(start, end);
    editor.updateCursorInfo();
  }
}

export function replaceInEditor(oneOnly, useSidebar = false) {
  const replaceInput = useSidebar
    ? document.getElementById('replace-input')
    : document.getElementById('editor-replace-input');
  const replaceValue = replaceInput?.value ?? '';
  const text = editor.getActiveContent();
  const regex = getFindRegex(useSidebar);
  if (!regex) return;
  if (oneOnly && state.findMatches.length && state.currentFindIndex >= 0) {
    const { start, end } = state.findMatches[state.currentFindIndex];
    const newText = text.slice(0, start) + replaceValue + text.slice(end);
    editor.setActiveContent(newText);
    editor.setSelectionOffsets(start, start + replaceValue.length);
    findInEditor(true, useSidebar);
    return;
  }
  const newText = text.replace(regex, replaceValue);
  editor.setActiveContent(newText);
  const countEl = document.getElementById('editor-find-count');
  if (countEl) countEl.textContent = '0/0';
  state.findMatches = [];
  state.currentFindIndex = -1;
}

export function showFindWidget() {
  if (findWidget) findWidget.classList.add('visible');
  const inp = document.getElementById('editor-find-input');
  if (inp) inp.focus();
  findInEditor(true, false);
}

export function hideFindWidget() {
  if (findWidget) findWidget.classList.remove('visible');
  editor.focusEditor();
}

export function getFindRegexSidebar() {
  return getFindRegex(true);
}
