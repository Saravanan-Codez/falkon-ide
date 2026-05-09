/**
 * Git / Source Control integration
 */
import { state } from './state.js';
import { escapeHtml } from './utils.js';

const { invoke } = window.electronAPI;

async function openSourceFile(filePath) {
  try {
    const fileExplorer = await import('./file-explorer.js');
    await fileExplorer.openFile(filePath);
  } catch (err) {
    console.error('openSourceFile', err);
  }
}

function buildSection(title, items) {
  if (!items.length) return '';
  const rows = items.map(item => `
    <div class="source-item" data-path="${escapeHtml(item.path)}">
      <span class="source-badge">${escapeHtml(item.badge)}</span>
      <span class="source-item-name">${escapeHtml(item.path)}</span>
    </div>
  `).join('');
  return `
    <div class="source-section">
      <div class="source-section-title">${title}</div>
      <div class="source-section-body">
        ${rows}
      </div>
    </div>
  `;
}

function attachInteractions(listEl) {
  listEl.querySelectorAll('.source-item').forEach(item => {
    const target = item.dataset.path;
    item.addEventListener('click', () => {
      if (target) {
        openSourceFile(target);
      }
    });
  });
}

export async function refreshSourceList() {
  const listEl = document.getElementById('source-list');
  if (!listEl) return;
  const cwd = state.workspacePath;
  if (!cwd) {
    listEl.innerHTML = '<p class="source-hint">Open a folder to see changes.</p>';
    return;
  }
  try {
    const isRepo = await invoke('git-is-repo', cwd);
    if (!isRepo) {
      listEl.innerHTML = '<p class="source-hint">Not a Git repository.</p>';
      return;
    }
    const status = await invoke('git-status', cwd);
    const lines = (status || '').trim().split('\n').filter(Boolean);
    const staged = [];
    const unstaged = [];
    const untracked = [];
    for (const line of lines) {
      const mode = line.substring(0, 2);
      const file = line.substring(3).trim();
      if (!mode) continue;
      if (mode === '??') {
        untracked.push({ path: file, badge: '??' });
        continue;
      }
      if (mode[0] && mode[0] !== ' ') {
        staged.push({ path: file, badge: mode[0] });
      }
      if (mode[1] && mode[1] !== ' ') {
        unstaged.push({ path: file, badge: mode[1] });
      }
    }
    const html = buildSection('Staged Changes', staged)
      + buildSection('Unstaged Changes', unstaged)
      + buildSection('Untracked Files', untracked);
    listEl.innerHTML = html || '<p class="source-hint">No changes.</p>';
    attachInteractions(listEl);
  } catch (err) {
    listEl.innerHTML = '<p class="source-hint">Error reading Git status.</p>';
  }
}

