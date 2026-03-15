/**
 * File Explorer - Open folder, file tree, load/save files
 */
import { state } from './state.js';
import * as editor from './editor.js';
import { escapeHtml } from './utils.js';

const { ipcRenderer } = require('electron');
const path = require('path');

let fileTreeCache = {};

async function loadDir(dirPath, parentEl, depth = 0) {
  try {
    const entries = await ipcRenderer.invoke('read-dir', dirPath);
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const e of sorted) {
      if (e.name.startsWith('.') && e.name !== '.git') continue;
      const item = document.createElement('div');
      item.className = 'tree-item' + (e.isDirectory ? ' tree-folder' : ' tree-file');
      item.dataset.path = path.join(dirPath, e.name);
      item.style.paddingLeft = (depth * 12 + 8) + 'px';
      const icon = e.isDirectory ? '📁' : (e.name.endsWith('.cimple') || e.name.endsWith('.cpl') ? '📄' : '📃');
      item.innerHTML = `<span class="tree-icon">${icon}</span><span class="tree-name">${escapeHtml(e.name)}</span>`;
      parentEl.appendChild(item);
      if (e.isDirectory) {
        item.classList.add('collapsed');
        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          let children = item.querySelector('.tree-children');
          if (item.classList.contains('collapsed')) {
            item.classList.remove('collapsed');
            if (!children) {
              children = document.createElement('div');
              children.className = 'tree-children';
              item.appendChild(children);
              loadDir(item.dataset.path, children, depth + 1);
            } else {
              children.style.display = 'block';
            }
          } else {
            item.classList.add('collapsed');
            if (children) children.style.display = 'none';
          }
        });
      } else {
        item.addEventListener('click', () => openFile(item.dataset.path));
      }
    }
  } catch (err) {
    console.error('loadDir', err);
  }
}


export async function openFolder() {
  const newPath = await ipcRenderer.invoke('open-folder');
  if (!newPath) return;
  const workspaceModule = await import('./workspace.js');
  await workspaceModule.setWorkspacePath(newPath);
  const treeEl = document.getElementById('file-tree');
  const emptyEl = document.getElementById('explorer-empty');
  if (treeEl && emptyEl) {
    emptyEl.style.display = 'none';
    treeEl.style.display = 'block';
    treeEl.innerHTML = '';
    await loadDir(newPath, treeEl);
  }
  document.getElementById('sidebar-title').textContent = 'EXPLORER';
  workspaceModule.notify('folder-refreshed');
}

export async function openFile(filePath) {
  try {
    const content = await ipcRenderer.invoke('read-file', filePath);
    const name = filePath.split(/[/\\]/).pop();
    editor.openTab({ id: 'file-' + filePath, title: name, path: filePath, content, dirty: false });
  } catch (err) {
    console.error('openFile', err);
  }
}

export async function saveFile(tab) {
  if (!tab.path) return saveFileAs(tab);
  try {
    await ipcRenderer.invoke('write-file', tab.path, tab.content);
    tab.dirty = false;
    editor.updateTabDirty(tab.id);
    return tab.path;
  } catch (err) {
    console.error('saveFile', err);
    return null;
  }
}

export async function saveFileAs(tab) {
  const path = await ipcRenderer.invoke('save-file', null, tab.content);
  if (path) {
    tab.path = path;
    tab.title = path.split(/[/\\]/).pop();
    tab.dirty = false;
    editor.updateTabDirty(tab.id);
    editor.renderTabs();
  }
  return path;
}


export async function refreshFolder() {
  const path = state.workspacePath;
  if (!path) return;
  const treeEl = document.getElementById('file-tree');
  const emptyEl = document.getElementById('explorer-empty');
  if (treeEl && emptyEl) {
    emptyEl.style.display = 'none';
    treeEl.style.display = 'block';
    treeEl.innerHTML = '';
    await loadDir(path, treeEl);
  }
  const workspaceModule = await import('./workspace.js');
  await workspaceModule.refreshGit();
}
