/**
 * Workspace helper - manages current folder, recents, and header updates
 */
import { state } from './state.js';
import * as editor from './editor.js';
import * as git from './git.js';
import { safeParse } from './utils.js';

const RECENT_KEY = 'falkon.recentWorkspaces';
const MAX_RECENT = 6;
const emitter = new EventTarget();
const STORAGE = typeof localStorage !== 'undefined' ? localStorage : null;
let suppressGitEvent = false;

function persistRecent(values) {
  if (!STORAGE) return;
  try {
    STORAGE.setItem(RECENT_KEY, JSON.stringify(values));
  } catch {
    // guard
  }
}

function addRecent(path) {
  const items = safeParse(STORAGE?.getItem(RECENT_KEY), []);
  const filtered = items.filter(item => item !== path);
  filtered.unshift(path);
  if (filtered.length > MAX_RECENT) filtered.length = MAX_RECENT;
  persistRecent(filtered);
}

function emit(detail = {}) {
  emitter.dispatchEvent(new CustomEvent('workspace-changed', {
    detail: {
      path: state.workspacePath,
      branch: state.gitBranch,
      dirty: Boolean(state.gitStatus),
      ...detail,
    }
  }));
}

export function onWorkspaceChange(listener) {
  emitter.addEventListener('workspace-changed', listener);
}

export function getRecentWorkspaces() {
  return safeParse(STORAGE?.getItem(RECENT_KEY), []);
}

export async function setWorkspacePath(dir) {
  if (!dir) return;
  if (state.workspacePath === dir) {
    await refreshGit();
    return;
  }
  state.workspacePath = dir;
  addRecent(dir);
  await refreshGit('workspace-opened');
}

export async function refreshGit(reason = 'git-refreshed') {
  if (!state.workspacePath) {
    emit({ reason: 'workspace-empty' });
    return;
  }
  suppressGitEvent = true;
  try {
    await editor.refreshGitStatus();
  } finally {
    suppressGitEvent = false;
  }
  await git.refreshSourceList();
  emit({ reason });
}

export function notify(reason = 'manual') {
  emit({ reason });
}

export function getWorkspacePath() {
  return state.workspacePath;
}

if (typeof document !== 'undefined') {
  document.addEventListener('git-status-updated', () => {
    if (suppressGitEvent) return;
    emit({ reason: 'git-status-updated' });
  });
}
