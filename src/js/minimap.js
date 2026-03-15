/**
 * Minimap - High-level file overview
 */
import { state } from './state.js';
import * as editor from './editor.js';

const minimapEl = document.getElementById('minimap');
const editorEl = document.getElementById('code-editor');
const highlightLayer = document.getElementById('highlight-layer');

let updateTimeout = null;

export function update() {
  if (updateTimeout) clearTimeout(updateTimeout);
  updateTimeout = setTimeout(performUpdate, 150);
}

function performUpdate() {
  if (!minimapEl || !highlightLayer) return;
  const text = editor.getActiveContent();

  let html = '';
  let lineCount = 0;
  let pos = 0;
  const maxLines = 1000;
  const maxLen = 100;

  while (lineCount < maxLines && pos < text.length) {
    let nextNewline = text.indexOf('\n', pos);
    if (nextNewline === -1) nextNewline = text.length;
    const lineLength = nextNewline - pos;
    const width = Math.min((lineLength / maxLen) * 100, 100);
    html += `<div class="minimap-line" style="width: ${width}%" data-line="${lineCount + 1}"></div>`;
    pos = nextNewline + 1;
    lineCount++;
  }

  minimapEl.innerHTML = html;
}

export function init() {
  if (!minimapEl || !editorEl) return;
  minimapEl.addEventListener('click', (e) => {
    const line = e.target?.dataset?.line;
    if (!line) return;
    const lineNum = parseInt(line, 10);
    const text = editor.getActiveContent();

    let idx = 0;
    let currentLine = 1;
    while (currentLine < lineNum) {
      const nextNewline = text.indexOf('\n', idx);
      if (nextNewline === -1) break;
      idx = nextNewline + 1;
      currentLine++;
    }

    editorEl.focus();
    editorEl.setSelectionRange(idx, idx);
    editorEl.scrollTop = (lineNum - 5) * 25.6;
  });
}
