/**
 * Auto-complete / IntelliSense for Cimple
 */
import { CIMPLE_KEYWORDS, CIMPLE_BUILTINS } from './syntax.js';
import * as editor from './editor.js';
import { escapeHtml } from './utils.js';

const editorEl = document.getElementById('code-editor');
let popupEl = null;

const suggestions = [...CIMPLE_KEYWORDS, ...CIMPLE_BUILTINS];

function createPopup() {
  if (popupEl) return popupEl;
  popupEl = document.createElement('div');
  popupEl.className = 'autocomplete-popup';
  popupEl.id = 'autocomplete-popup';
  document.body.appendChild(popupEl);
  return popupEl;
}

function getWordBeforeCaret() {
  const text = editor.getActiveContent();
  const pos = editorEl.selectionStart;
  let start = pos;
  while (start > 0 && /[a-zA-Z0-9_]/.test(text[start - 1])) start--;
  return { word: text.slice(start, pos), start };
}

export function show() {
  const { word, start } = getWordBeforeCaret();
  const filtered = suggestions.filter(s => s.startsWith(word) && s !== word);
  if (filtered.length === 0) {
    hide();
    return;
  }
  const popup = createPopup();
  popup.innerHTML = filtered.slice(0, 10).map((s, i) => `
    <div class="autocomplete-item ${i === 0 ? 'selected' : ''}" data-word="${s}">${escapeHtml(s)}</div>
  `).join('');

  const rect = editorEl.getBoundingClientRect();
  popup.style.top = (rect.top + 50) + 'px';
  popup.style.left = rect.left + 'px';
  popup.classList.add('visible');

  popup.querySelectorAll('.autocomplete-item').forEach((el, i) => {
    el.addEventListener('click', () => insert(el.dataset.word, word.length));
    el.addEventListener('mouseenter', () => {
      popup.querySelectorAll('.autocomplete-item').forEach((e, j) => e.classList.toggle('selected', j === i));
    });
  });
}

export function hide() {
  popupEl?.classList.remove('visible');
}

export function insert(word, replaceLen) {
  const text = editor.getActiveContent();
  const pos = editorEl.selectionStart;
  const start = pos - replaceLen;
  const newText = text.slice(0, start) + word + text.slice(pos);
  editor.setActiveContent(newText);
  editorEl.value = newText;
  editorEl.setSelectionRange(start + word.length, start + word.length);
  hide();
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, function(m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}
