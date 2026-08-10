/**
 * Command Palette - Ctrl+Shift+P
 */
import { state } from './state.js';
import * as editor from './editor.js';
import * as fileExplorer from './file-explorer.js';
import * as themes from './themes.js';
import * as zenMode from './zen-mode.js';
import * as autosave from './autosave.js';
import { showFindWidget } from './find.js';
import { escapeHtml } from './utils.js';

const commands = [
  { id: 'new-file', label: 'New File', shortcut: 'Ctrl+N', fn: () => editor.addTab() },
  { id: 'open-folder', label: 'Open Folder', shortcut: 'Ctrl+K Ctrl+O', fn: () => fileExplorer.openFolder() },
  { id: 'save', label: 'Save', shortcut: 'Ctrl+S', fn: async () => {
    const tab = editor.getActiveTab();
    if (tab?.path) await fileExplorer.saveFile(tab);
    else await fileExplorer.saveFileAs(tab);
  }},
  { id: 'find', label: 'Find', shortcut: 'Ctrl+F', fn: () => showFindWidget() },
  { id: 'toggle-terminal', label: 'Toggle Terminal', shortcut: 'Ctrl+`', fn: () => {
    const panel = document.getElementById('bottom-panel');
    if (panel) {
      state.panelVisible = !state.panelVisible;
      panel.classList.toggle('hidden', !state.panelVisible);
    }
  }},
  { id: 'zen-mode', label: 'Toggle Zen Mode', shortcut: 'Ctrl+K Z', fn: () => zenMode.toggle() },
  { id: 'autosave', label: 'Toggle Auto Save', fn: () => { state.autoSaveEnabled = !state.autoSaveEnabled; autosave.setEnabled(state.autoSaveEnabled); } },
  { id: 'run-falkon', label: 'Falkon: Run Code', shortcut: 'Ctrl+Shift+R', fn: () => { document.getElementById('run-btn')?.click(); } },
  { id: 'theme-falkon', label: 'Color Theme: Falkon Neon', fn: () => themes.apply('falkon-dark') },
  { id: 'theme-vscode', label: 'Color Theme: VS Code Dark+', fn: () => themes.apply('vscode-dark') },
  { id: 'theme-monokai', label: 'Color Theme: Monokai Pro', fn: () => themes.apply('monokai') },
  { id: 'theme-solarized', label: 'Color Theme: Solarized Dark', fn: () => themes.apply('solarized-dark') },
  { id: 'theme-light', label: 'Color Theme: VS Code Light+', fn: () => themes.apply('light-modern') },
];

let paletteEl = null;
let inputEl = null;
let listEl = null;

function createPalette() {
  if (paletteEl) return paletteEl;
  paletteEl = document.createElement('div');
  paletteEl.id = 'command-palette';
  paletteEl.className = 'command-palette';
  paletteEl.innerHTML = `
    <div class="command-palette-box">
      <input type="text" id="command-input" placeholder="Type a command..." />
      <div class="command-list" id="command-list"></div>
    </div>
  `;
  document.body.appendChild(paletteEl);
  inputEl = paletteEl.querySelector('#command-input');
  listEl = paletteEl.querySelector('#command-list');
  inputEl.addEventListener('input', () => filterCommands(inputEl.value));
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
    if (e.key === 'ArrowDown') { e.preventDefault(); selectNext(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); selectNext(-1); }
    if (e.key === 'Enter') { e.preventDefault(); runSelected(); }
  });
  paletteEl.addEventListener('click', (e) => {
    if (e.target === paletteEl) hide();
  });
  return paletteEl;
}

function filterCommands(query) {
  const q = (query || '').toLowerCase();
  const filtered = q
    ? commands.filter(c => c.label.toLowerCase().includes(q))
    : commands;
  renderList(filtered);
}

function renderList(items) {
  if (!listEl) return;
  listEl.innerHTML = items.map((c, i) => `
    <div class="command-item ${i === 0 ? 'selected' : ''}" data-id="${c.id}">
      <span>${escapeHtml(c.label)}</span>
      ${c.shortcut ? `<span class="shortcut">${escapeHtml(c.shortcut)}</span>` : ''}
    </div>
  `).join('');
  listEl.querySelectorAll('.command-item').forEach((el, i) => {
    el.addEventListener('click', () => {
      const cmd = items[i];
      if (cmd?.fn) { cmd.fn(); hide(); }
    });
  });
}

function selectNext(delta) {
  const items = listEl?.querySelectorAll('.command-item');
  if (!items?.length) return;
  let idx = Array.from(items).findIndex(i => i.classList.contains('selected'));
  idx = (idx + delta + items.length) % items.length;
  items.forEach((i, j) => i.classList.toggle('selected', j === idx));
}

function runSelected() {
  const sel = listEl?.querySelector('.command-item.selected');
  if (sel) sel.click();
}


export function show() {
  createPalette();
  paletteEl.classList.add('visible');
  inputEl.value = '';
  inputEl.placeholder = 'Type a command...';
  filterCommands('');
  setTimeout(() => inputEl.focus(), 50);
}

export async function showQuickOpen() {
  createPalette();
  paletteEl.classList.add('visible');
  inputEl.value = '';
  inputEl.placeholder = 'Type a file name to open...';

  // Gather workspace files if available
  let fileList = [];
  try {
    const rootPath = state.workspacePath;
    if (rootPath && window.electronAPI) {
      const entries = await window.electronAPI.invoke('read-dir', rootPath);
      if (Array.isArray(entries)) {
        fileList = entries.filter(e => !e.isDirectory).map(e => ({
          id: `file:${e.name}`,
          label: e.name,
          shortcut: rootPath,
          fn: async () => {
            const sep = rootPath.includes('\\') ? '\\' : '/';
            const fullPath = `${rootPath}${sep}${e.name}`;
            const content = await window.electronAPI.invoke('read-file', fullPath);
            editor.addTab({ name: e.name, path: fullPath, content: content || '' });
          }
        }));
      }
    }
  } catch (err) {
    console.warn('Quick open scan error', err);
  }

  if (fileList.length) {
    renderList(fileList);
  } else {
    filterCommands('');
  }
  setTimeout(() => inputEl.focus(), 50);
}

export function hide() {
  paletteEl?.classList.remove('visible');
  editor.getEditor()?.focus();
}

