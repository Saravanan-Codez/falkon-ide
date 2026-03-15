/**
 * Editor core - Tabs, content, syntax highlight, line numbers, cursor
 */
import { state } from './state.js';
import { highlightCimple } from './syntax.js';
import { escapeHtml, generateId } from './utils.js';
import * as fileExplorer from './file-explorer.js';

const { ipcRenderer } = require('electron');

const editorEl = document.getElementById('code-editor');
const lineNumbersEl = document.getElementById('line-numbers');
const highlightLayer = document.getElementById('highlight-layer');
const cursorPosEl = document.getElementById('cursor-pos');
const selectionInfoEl = document.getElementById('selection-info');
const tabsContainer = document.getElementById('tabs-container');

export function getEditor() { return editorEl; }
export function getActiveContent() {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  return tab ? tab.content : (editorEl?.value || '');
}
export function setActiveContent(value) {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (tab) {
    tab.content = value;
    tab.dirty = true;
    updateTabDirty(tab.id);
  }
  updateLineNumbers();
  updateHighlight();
  updateCursorInfo();
}
export function getActiveTab() {
  return state.tabs.find(t => t.id === state.activeTabId);
}

function tabFromEditor() {
  const tab = state.tabs.find(t => t.id === state.activeTabId);
  if (tab && editorEl) tab.content = editorEl.value;
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

  const content = tab ? tab.content : '';
  if (editorEl) editorEl.value = content;
  updateLineNumbers();
  updateHighlight();
  updateCursorInfo();
}

export function updateLineNumbers() {
  if (!lineNumbersEl) return;
  const text = getActiveContent();
  let count = 1;
  let pos = text.indexOf('\n');
  while (pos !== -1) {
    count++;
    pos = text.indexOf('\n', pos + 1);
  }
  let html = '';
  for (let i = 1; i <= count; i++) {
    html += i + '<br>';
  }
  lineNumbersEl.innerHTML = html;
}

export function updateHighlight() {
  if (!highlightLayer) return;
  const text = getActiveContent();
  highlightLayer.innerHTML = highlightCimple(text).replace(/\n/g, '<br>');
}

export function updateCursorInfo() {
  if (!cursorPosEl || !editorEl) return;
  const text = getActiveContent();
  const start = editorEl.selectionStart;
  const end = editorEl.selectionEnd;

  let line = 1;
  let lastNewline = -1;
  let pos = text.indexOf('\n');
  while (pos !== -1 && pos < start) {
    line++;
    lastNewline = pos;
    pos = text.indexOf('\n', pos + 1);
  }
  const col = start - lastNewline;

  cursorPosEl.textContent = `Ln ${line}, Col ${col}`;
  if (selectionInfoEl) {
    if (start !== end) {
      let selLinesCount = 1;
      let selPos = text.indexOf('\n', start);
      while (selPos !== -1 && selPos < end) {
        selLinesCount++;
        selPos = text.indexOf('\n', selPos + 1);
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
  tabFromEditor();
  state.activeTabId = id;
  renderTabs();
  editorFromTab();
  refreshGitStatus();
  document.dispatchEvent(new CustomEvent('tab-switched'));
}

export function closeTab(id) {
  const idx = state.tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  tabFromEditor();
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
  tabFromEditor();
  const id = options.id || generateId('tab');
  const title_ = title || `Untitled-${state.tabs.length + 1}`;
  state.tabs.push({
    id,
    title: title_,
    path: options.path || null,
    content: options.content ?? '',
    dirty: options.dirty ?? false
  });
  state.activeTabId = id;
  renderTabs();
  editorFromTab();
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

// Sync scroll
if (editorEl) {
  editorEl.addEventListener('scroll', () => {
    if (lineNumbersEl) lineNumbersEl.scrollTop = editorEl.scrollTop;
    if (highlightLayer) {
      highlightLayer.scrollTop = editorEl.scrollTop;
      highlightLayer.scrollLeft = editorEl.scrollLeft;
    }
  });
}

export { tabFromEditor, editorFromTab };
