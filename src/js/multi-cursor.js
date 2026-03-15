/**
 * Multi-cursor - Alt+Click to add cursors
 * Simplified: Alt+Click adds a secondary selection; typing applies to all
 * Full multi-cursor with textarea is complex; we simulate with multiple selections stored
 */
import * as editor from './editor.js';

const editorEl = document.getElementById('code-editor');
const cursors = [];
let lastAddTime = 0;

export function init() {
  if (!editorEl) return;
  editorEl.addEventListener('click', (e) => {
    if (e.altKey) {
      e.preventDefault();
      const rect = editorEl.getBoundingClientRect();
      // Approximate char position from click - simplified
      const text = editor.getActiveContent();
      const lineHeight = 25.6;
      const charWidth = 8.5;
      const scrollTop = editorEl.scrollTop;
      const scrollLeft = editorEl.scrollLeft;
      const y = e.clientY - rect.top + scrollTop;
      const x = e.clientX - rect.left + scrollLeft;
      const lineIdx = Math.floor(y / lineHeight);
      const colIdx = Math.floor(x / charWidth);

      if (lineIdx >= 0) {
        let idx = 0;
        let currentLine = 0;
        while (currentLine < lineIdx) {
          const nextNewline = text.indexOf('\n', idx);
          if (nextNewline === -1) break;
          idx = nextNewline + 1;
          currentLine++;
        }

        if (currentLine === lineIdx && idx <= text.length) {
          const nextNewline = text.indexOf('\n', idx);
          const lineLength = (nextNewline === -1 ? text.length : nextNewline) - idx;
          const pos = Math.min(colIdx, lineLength);
          idx += pos;
          cursors.push(idx);
          editorEl.setSelectionRange(idx, idx);
          lastAddTime = Date.now();
        }
      }
    }
  });
}
