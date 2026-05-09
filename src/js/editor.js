/**
 * Editor core - Monaco wrapper
 */
import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { registerCimpleLanguage } from './monaco-cimple.js';

let monacoApi = null;
let editorInstance = null;
let contentListeners = [];
let resolveReady = null;
const readyPromise = new Promise((resolve) => { resolveReady = resolve; });

const cursorPosEl = document.getElementById('cursor-pos');
const selectionInfoEl = document.getElementById('selection-info');
const tabsContainer = document.getElementById('tabs-container');

const SETTINGS_KEY = 'cimple.editorSettings';
const DEFAULT_SETTINGS = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: 'on',
  minimap: true,
  renderWhitespace: 'selection'
};

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (stored && typeof stored === 'object') return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(next) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function getActiveModel() {
  return editorInstance?.getModel() || null;
}

function getLanguageFromPath(filePath) {
  if (!filePath) return 'cimple';
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.cimple') || lower.endsWith('.cpl')) return 'cimple';
  return 'plaintext';
}

function ensureEditor() {
  if (!editorInstance) throw new Error('Editor not initialized');
}

export function initMonaco(monaco) {
  monacoApi = monaco;
  const container = document.getElementById('monaco-editor');
  if (!container) return;

  registerCimpleLanguage(monacoApi);

  monacoApi.editor.defineTheme('cimple-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword.cimple', foreground: 'c678dd' },
      { token: 'string.cimple', foreground: '98c379' },
      { token: 'number.cimple', foreground: 'd19a66' },
      { token: 'comment.cimple', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'function.cimple', foreground: '61afef' },
      { token: 'builtin.cimple', foreground: '56b6c2' }
    ],
    colors: {
      'editor.background': '#0f111a'
    }
  });

  const settings = loadSettings();
  editorInstance = monacoApi.editor.create(container, {
    language: 'cimple',
    theme: 'cimple-dark',
    automaticLayout: true,
    fontSize: settings.fontSize,
    tabSize: settings.tabSize,
    insertSpaces: true,
    wordWrap: settings.wordWrap,
    minimap: { enabled: settings.minimap },
    renderWhitespace: settings.renderWhitespace
  });

  editorInstance.onDidChangeCursorPosition(updateCursorInfo);
  editorInstance.onDidChangeCursorSelection(updateCursorInfo);

  editorInstance.onDidChangeModelContent(() => {
    const tab = getActiveTab();
    if (tab) {
      tab.dirty = true;
      tab.content = getActiveContent();
      updateTabDirty(tab.id);
    }
    contentListeners.forEach(fn => fn());
  });

  if (!state.tabs.length) {
    addTab();
  } else {
    editorFromTab();
  }

  if (resolveReady) resolveReady();
}

export function whenReady() {
  return readyPromise;
}

export function onDidChangeContent(listener) {
  contentListeners.push(listener);
  return () => {
    contentListeners = contentListeners.filter(fn => fn !== listener);
  };
}

export function getEditor() { return editorInstance; }

export function getActiveContent() {
  const model = getActiveModel();
  return model ? model.getValue() : '';
}

export function setActiveContent(value) {
  const tab = getActiveTab();
  const model = getActiveModel();
  if (model) {
    model.setValue(value ?? '');
  }
  if (tab) {
    tab.content = value ?? '';
    tab.dirty = true;
    updateTabDirty(tab.id);
  }
  updateCursorInfo();
}

export function getActiveTab() {
  return state.tabs.find(t => t.id === state.activeTabId);
}

export function getSelectionOffsets() {
  const model = getActiveModel();
  if (!editorInstance || !model) return { start: 0, end: 0 };
  const sel = editorInstance.getSelection();
  if (!sel) return { start: 0, end: 0 };
  const start = model.getOffsetAt(sel.getStartPosition());
  const end = model.getOffsetAt(sel.getEndPosition());
  return { start, end };
}

export function setSelectionOffsets(start, end) {
  if (!editorInstance) return;
  const model = getActiveModel();
  if (!model) return;
  const startPos = model.getPositionAt(Math.max(0, start));
  const endPos = model.getPositionAt(Math.max(0, end));
  const range = new monacoApi.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
  editorInstance.setSelection(range);
  editorInstance.revealRangeInCenter(range);
}

export function focusEditor() {
  editorInstance?.focus();
}

export function updateLineNumbers() {
  // handled by Monaco
}

export function updateHighlight() {
  // handled by Monaco
}

export function updateCursorInfo() {
  if (!editorInstance || !cursorPosEl) return;
  const model = getActiveModel();
  if (!model) return;
  const pos = editorInstance.getPosition();
  if (!pos) return;
  cursorPosEl.textContent = `Ln ${pos.lineNumber}, Col ${pos.column}`;

  if (selectionInfoEl) {
    const sel = editorInstance.getSelection();
    if (sel && !sel.isEmpty()) {
      const start = model.getOffsetAt(sel.getStartPosition());
      const end = model.getOffsetAt(sel.getEndPosition());
      const text = model.getValue();
      let selLinesCount = 1;
      let idx = text.indexOf('\n', start);
      while (idx !== -1 && idx < end) {
        selLinesCount++;
        idx = text.indexOf('\n', idx + 1);
      }
      selectionInfoEl.style.display = 'inline';
      selectionInfoEl.textContent = selLinesCount > 1 ? `${selLinesCount} lines selected` : `${end - start} selected`;
    } else {
      selectionInfoEl.style.display = 'none';
    }
  }
}

export function updateTabDirty(tabId) {
  const tabEl = tabsContainer?.querySelector(`.tab[data-id="${tabId}"]`);
  if (!tabEl) return;
  const tab = state.tabs.find(t => t.id === tabId);
  const dirtyEl = tabEl.querySelector('.tab-dirty');
  if (dirtyEl) dirtyEl.style.display = tab?.dirty ? 'inline' : 'none';
}

export function renderTabs() {
  if (!tabsContainer) return;
  tabsContainer.innerHTML = state.tabs.map(t => `
    <div class="tab ${t.id === state.activeTabId ? 'active' : ''}" data-id="${t.id}">
      <span class="tab-icon">cimple</span>
      <span class="tab-title">${escapeHtml(t.title)}</span>
      <span class="tab-dirty" style="display: ${t.dirty ? 'inline' : 'none'}">●</span>
      <span class="tab-close">×</span>
    </div>
  `).join('');
  tabsContainer.querySelectorAll('.tab').forEach(el => {
    const id = el.dataset.id;
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) closeTab(id);
      else switchTab(id);
    });
  });
  document.dispatchEvent(new CustomEvent('tabs-changed'));
}

export function switchTab(id) {
  if (id === state.activeTabId) return;
  state.activeTabId = id;
  editorFromTab();
  renderTabs();
  refreshGitStatus();
  document.dispatchEvent(new CustomEvent('tab-switched'));
}

export function closeTab(id) {
  const idx = state.tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  const tab = state.tabs[idx];
  if (tab?.dirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
  tab?.model?.dispose?.();
  state.tabs.splice(idx, 1);
  if (state.tabs.length === 0) {
    state.activeTabId = null;
  } else if (state.activeTabId === id) {
    state.activeTabId = state.tabs[Math.max(0, idx - 1)].id;
  }
  renderTabs();
  editorFromTab();
  refreshGitStatus();
}

export function addTab(title = null, options = {}) {
  const id = options.id || `tab-${Date.now()}`;
  const title_ = title || `Untitled-${state.tabs.length + 1}`;
  ensureEditor();
  const language = getLanguageFromPath(options.path);
  const uri = options.path
    ? monacoApi.Uri.file(options.path)
    : monacoApi.Uri.parse(`inmemory://${id}`);
  const model = monacoApi.editor.createModel(options.content ?? '', language, uri);

  const tab = {
    id,
    title: title_,
    path: options.path || null,
    content: options.content ?? '',
    dirty: options.dirty ?? false,
    model
  };
  state.tabs.push(tab);
  state.activeTabId = id;
  editorFromTab();
  renderTabs();
  return id;
}

export function openTab(tab) {
  const existing = state.tabs.find(t => t.path && t.path === tab.path);
  if (existing) {
    switchTab(existing.id);
    return;
  }
  addTab(tab.title, tab);
}

export async function refreshGitStatus() {
  const { invoke } = window.electronAPI;
  const cwd = state.workspacePath;
  if (!cwd) {
    state.gitBranch = null;
    state.gitStatus = null;
    document.dispatchEvent(new CustomEvent('git-status-updated', {
      detail: {
        branch: state.gitBranch,
        status: state.gitStatus,
        path: state.workspacePath,
      }
    }));
    return;
  }
  try {
    const isRepo = await invoke('git-is-repo', cwd);
    if (!isRepo) {
      state.gitBranch = null;
      state.gitStatus = null;
    } else {
      state.gitBranch = await invoke('git-branch', cwd);
      state.gitStatus = await invoke('git-status', cwd);
    }
  } catch {
    state.gitBranch = null;
    state.gitStatus = null;
  }
  document.dispatchEvent(new CustomEvent('git-status-updated', {
    detail: {
      branch: state.gitBranch,
      status: state.gitStatus,
      path: state.workspacePath,
    }
  }));
}

function editorFromTab() {
  const welcomeScreen = document.getElementById('welcome-screen');
  const editorContainer = document.getElementById('editor-container');
  const tab = state.tabs.find(t => t.id === state.activeTabId);

  if (!tab) {
    if (welcomeScreen) welcomeScreen.style.display = 'flex';
    if (editorContainer) editorContainer.style.display = 'none';
    return;
  }

  if (welcomeScreen) welcomeScreen.style.display = 'none';
  if (editorContainer) editorContainer.style.display = 'flex';

  if (editorInstance) {
    editorInstance.setModel(tab.model);
    const language = getLanguageFromPath(tab.path);
    monacoApi.editor.setModelLanguage(tab.model, language);
  }
  updateCursorInfo();
}

function tabFromEditor() {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (tab && editorInstance) tab.content = getActiveContent();
}

export { tabFromEditor, editorFromTab };

export function applySettings(next) {
  if (!editorInstance) return;
  const settings = { ...loadSettings(), ...next };
  saveSettings(settings);
  editorInstance.updateOptions({
    fontSize: settings.fontSize,
    tabSize: settings.tabSize,
    wordWrap: settings.wordWrap,
    minimap: { enabled: settings.minimap },
    renderWhitespace: settings.renderWhitespace
  });
}

export function getSettings() {
  return loadSettings();
}
