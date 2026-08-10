/**
 * Cimple Edit - Main application entry
 */
import { state } from './state.js';
import { registerFalkonLanguage } from './falkon-lang.js';
import * as editor from './editor.js';
import * as fileExplorer from './file-explorer.js';
import * as panels from './panels.js';
import * as find from './find.js';
import * as commandPalette from './command-palette.js';
import * as terminal from './terminal.js';
import * as run from './run.js';
import * as themes from './themes.js';
import * as zenMode from './zen-mode.js';
import * as breadcrumbs from './breadcrumbs.js';
import * as autosave from './autosave.js';
import * as workspace from './workspace.js';

const contextMenu = document.getElementById('context-menu');
const workspacePathEl = document.getElementById('workspace-path');
const workspaceBranchEl = document.getElementById('workspace-branch');
const workspaceStatusEl = document.getElementById('workspace-status');
const workspaceOpenBtn = document.getElementById('workspace-open-btn');
const workspaceRefreshBtn = document.getElementById('workspace-refresh-btn');
const workspaceRevealBtn = document.getElementById('workspace-reveal-btn');

// Init state - start empty to show welcome screen
state.tabs = [];
state.activeTabId = null;

// Initial content removed to show welcome screen

// Init modules
panels.init();
terminal.init();
run.init();
workspace.onWorkspaceChange(() => {
  updateWorkspaceHeader();
});

if (window.monacoReady) {
  window.monacoReady.then((monaco) => {
    registerFalkonLanguage(monaco);
    editor.initMonaco(monaco);
    editor.renderTabs();
    editor.editorFromTab();
    breadcrumbs.update();
    editor.onDidChangeContent(() => {
      autosave.onContentChange();
      breadcrumbs.update();
    });
  }).catch((err) => {
    console.error('Monaco failed to load', err);
  });
}

function updateWorkspaceHeader() {
  const path = state.workspacePath;
  const branch = state.gitBranch;
  const dirty = Boolean(state.gitStatus);
  if (workspacePathEl) workspacePathEl.textContent = path || 'No folder opened';
  if (workspaceBranchEl) workspaceBranchEl.textContent = branch ? `⎇ ${branch}` : 'No branch';
  if (workspaceStatusEl) {
    if (!path) {
      workspaceStatusEl.textContent = 'Not a repo';
      workspaceStatusEl.classList.remove('clean', 'dirty');
    } else if (!branch) {
      workspaceStatusEl.textContent = 'Not a repo';
      workspaceStatusEl.classList.remove('clean', 'dirty');
    } else {
      workspaceStatusEl.textContent = dirty ? 'Dirty' : 'Clean';
      workspaceStatusEl.classList.toggle('dirty', dirty);
      workspaceStatusEl.classList.toggle('clean', !dirty);
    }
  }
}

workspaceOpenBtn?.addEventListener('click', () => fileExplorer.openFolder());
workspaceRefreshBtn?.addEventListener('click', () => workspace.refreshGit());
workspaceRevealBtn?.addEventListener('click', () => {
  document.querySelector('.activity-item[data-view="explorer"]')?.click();
  fileExplorer.refreshFolder();
});
document.getElementById('source-refresh-btn')?.addEventListener('click', () => workspace.refreshGit());
document.getElementById('new-file-btn')?.addEventListener('click', () => fileExplorer.createFile());
document.getElementById('new-folder-btn')?.addEventListener('click', () => fileExplorer.createFolder());
document.getElementById('refresh-btn')?.addEventListener('click', () => fileExplorer.refreshFolder());

// Global shortcuts
function cycleEditorTabs(direction = 1) {
  const tabs = state.tabs;
  if (!tabs.length) return;
  const currentIndex = tabs.findIndex(t => t.id === state.activeTabId);
  if (currentIndex === -1) return;
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  editor.switchTab(tabs[nextIndex].id);
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'P') { e.preventDefault(); commandPalette.show(); return; }
  if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
    e.preventDefault();
    document.querySelector('.activity-item[data-view="search"]')?.click();
    document.getElementById('find-input')?.focus();
    return;
  }
  if (e.ctrlKey && e.key === 'K' && e.key === 'Z') { e.preventDefault(); zenMode.toggle(); return; }
  if (e.ctrlKey && e.key === 'K') return; // K chord
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    cycleEditorTabs(e.shiftKey ? -1 : 1);
    return;
  }
  if (e.ctrlKey && !e.shiftKey && e.key === 'w') {
    e.preventDefault();
    const tab = editor.getActiveTab();
    if (tab) editor.closeTab(tab.id);
    return;
  }
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault(); (async () => {
      const tab = editor.getActiveTab();
      if (tab?.path) await fileExplorer.saveFile(tab);
      else await fileExplorer.saveFileAs(tab);
    })(); return;
  }
  if (e.ctrlKey && e.key === 'n') { e.preventDefault(); editor.addTab(); return; }
  if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); find.showFindWidget(); return; }
  if (e.ctrlKey && (e.key === '`' || e.key === 'Backquote')) { e.preventDefault(); const panel = document.getElementById('bottom-panel'); if (panel) { state.panelVisible = !panel.classList.contains('hidden'); panel.classList.toggle('hidden', !state.panelVisible); } return; }
});

// K chord for theme (Ctrl+K Ctrl+T)
let kChord = false;
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'k') { kChord = true; return; }
  if (kChord && e.ctrlKey && e.key === 't') {
    e.preventDefault();
    commandPalette.show();
    setTimeout(() => {
      const inp = document.getElementById('command-input');
      if (inp) { inp.value = 'theme'; inp.dispatchEvent(new Event('input')); }
    }, 50);
    kChord = false;
  }
});
document.addEventListener('keyup', (e) => { if (!e.ctrlKey) kChord = false; });

// Context menu is handled by Monaco
document.addEventListener('click', () => contextMenu?.classList.remove('visible'));

// Find widget buttons
document.getElementById('editor-find-input')?.addEventListener('input', () => find.findInEditor(true, false));
document.getElementById('editor-find-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') find.findInEditor(!e.shiftKey, false);
  if (e.key === 'Escape') find.hideFindWidget();
});
document.getElementById('editor-find-next')?.addEventListener('click', () => find.findInEditor(true, false));
document.getElementById('editor-find-prev')?.addEventListener('click', () => find.findInEditor(false, false));
document.getElementById('editor-find-close')?.addEventListener('click', find.hideFindWidget);
document.getElementById('editor-replace-one')?.addEventListener('click', () => find.replaceInEditor(true, false));
document.getElementById('editor-replace-all')?.addEventListener('click', () => find.replaceInEditor(false, false));

// Top search bar / Command Center
document.getElementById('command-center')?.addEventListener('click', () => commandPalette.show());

// Toggle Sidebar
document.getElementById('toggle-sidebar-btn')?.addEventListener('click', () => {
  const sidebar = document.getElementById('primary-sidebar');
  const resizer = document.getElementById('sidebar-resizer');
  if (sidebar) sidebar.classList.toggle('hidden');
  if (resizer) resizer.classList.toggle('hidden');
});

// Settings button
document.getElementById('settings-btn')?.addEventListener('click', () => {
  commandPalette.show();
  setTimeout(() => {
    const inp = document.getElementById('command-input');
    if (inp) { inp.value = 'settings'; inp.dispatchEvent(new Event('input')); }
  }, 50);
});

// Welcome screen actions
document.getElementById('welcome-new-file')?.addEventListener('click', (e) => { e.preventDefault(); editor.addTab(); });
document.getElementById('welcome-open-file')?.addEventListener('click', (e) => { e.preventDefault(); fileExplorer.openFile(); });
document.getElementById('welcome-open-folder')?.addEventListener('click', (e) => { e.preventDefault(); fileExplorer.openFolder(); });
document.getElementById('open-folder-sidebar')?.addEventListener('click', () => fileExplorer.openFolder());
document.getElementById('open-recent-sidebar')?.addEventListener('click', () => fileExplorer.openRecent());

// Sidebar search with debounce
const sidebarFindInput = document.getElementById('find-input');
let searchTimeout = null;
if (sidebarFindInput) {
  sidebarFindInput.addEventListener('input', () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const regex = find.getFindRegexSidebar();
      const text = editor.getActiveContent();
      const countEl = document.getElementById('find-count');
      if (!regex || !sidebarFindInput.value) { countEl.textContent = ''; return; }
      const matches = text.match(regex);
      countEl.textContent = matches ? matches.length + ' matches' : '0';
    }, 200);
  });
}
document.getElementById('replace-next')?.addEventListener('click', () => find.findInEditor(true, true));
document.getElementById('replace-prev')?.addEventListener('click', () => {
  const regex = find.getFindRegexSidebar();
  if (!regex) return;
  const text = editor.getActiveContent();
  const selection = editor.getSelectionOffsets();
  const cursor = selection.start ?? 0;
  const before = text.slice(0, cursor);
  const matches = [...before.matchAll(new RegExp(regex.source, regex.flags))];
  const last = matches[matches.length - 1];
  if (last) {
    editor.setSelectionOffsets(last.index, last.index + last[0].length);
    editor.focusEditor();
    editor.updateCursorInfo();
  }
});
document.getElementById('replace-one')?.addEventListener('click', () => find.replaceInEditor(true, true));
document.getElementById('replace-all')?.addEventListener('click', () => {
  const regex = find.getFindRegexSidebar();
  const replaceInput = document.getElementById('replace-input');
  const replaceValue = replaceInput?.value ?? '';
  if (!regex) return;
  const text = editor.getActiveContent();
  const newText = text.replace(regex, replaceValue);
  editor.setActiveContent(newText);
  document.getElementById('find-count').textContent = '0';
});

// Spawn terminal when panel opens
document.querySelector('.panel-tab[data-tab="terminal"]')?.addEventListener('click', () => {
  terminal.spawnTerminal();
});

// Tab switch -> breadcrumbs
document.addEventListener('tab-switched', () => breadcrumbs.update());

// Initial render
editor.refreshGitStatus();
workspace.notify('bootstrap');




