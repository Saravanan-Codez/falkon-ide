/**
 * Breadcrumbs - Folder > Subfolder > file.cimple
 */
import { state } from './state.js';
import * as editor from './editor.js';
import * as fileExplorer from './file-explorer.js';
import * as workspaceModule from './workspace.js';
import { escapeHtml } from './utils.js';

const { path } = window.electronAPI;
const breadcrumbsEl = document.getElementById('breadcrumbs');

export function update() {
  if (!breadcrumbsEl) return;
  const tab = editor.getActiveTab();
  const workspace = workspaceModule.getWorkspacePath();
  if (!tab?.path || !workspace) {
    breadcrumbsEl.innerHTML = `<span class="breadcrumb-item">${escapeHtml(tab?.title || 'Untitled')}</span>`;
    return;
  }
  const relative = path.relative(workspace, tab.path);
  const parts = relative.split(/[/\\]/).filter(Boolean);
  if (parts.length === 0) parts.push(tab.title);
  breadcrumbsEl.innerHTML = parts.map((p, i) => {
    const fullPath = path.join(workspace, ...parts.slice(0, i + 1));
    return `<span class="breadcrumb-item" data-path="${escapeHtml(fullPath)}">${escapeHtml(p)}</span>`;
  }).join('<span class="breadcrumb-sep">/</span>');

  breadcrumbsEl.querySelectorAll('.breadcrumb-item[data-path]').forEach(el => {
    el.addEventListener('click', () => {
      const p = el.dataset.path;
      if (p && path.extname(p)) fileExplorer.openFile(p);
    });
  });
}
