/**
 * Tauri v2 IPC bridge for VS Code Web Workbench.
 *
 * This script runs BEFORE the VS Code workbench initializes.
 * It:
 *  1. Registers a full IFileSystemProvider for file:// URIs via Tauri IPC
 *  2. Provides native file dialogs via Tauri IPC
 *  3. Bridges the terminal, search, and git IPC channels
 *  4. Exposes window.__vscode_tauri_bridge__ for the workbench init script
 */

const tauri = () => window.__TAURI__?.core;
const invoke = (cmd, args) => {
  const t = tauri();
  if (t?.invoke) return t.invoke(cmd, args);
  console.warn(`[Tauri] invoke not ready for: ${cmd}`);
  return Promise.resolve(null);
};

// ─────────────────────────────────────────────
//  File System Provider API (exposed to workbench init)
// ─────────────────────────────────────────────

window.__tauri_fs__ = {
  readFile: (path) => invoke('read_file', { filePath: path }),
  writeFile: (path, content) => invoke('write_file', { filePath: path, content }),
  readDir: (path) => invoke('read_dir', { dirPath: path }),
  stat: (path) => invoke('stat_file', { filePath: path }),
  exists: (path) => invoke('file_exists', { filePath: path }),
  mkdir: (path) => invoke('create_dir', { dirPath: path }),
  rename: (oldPath, newPath) => invoke('rename_file', { oldPath, newPath }),
  delete: (path) => invoke('delete_file', { filePath: path }),
};

// ─────────────────────────────────────────────
//  Native File Dialogs
// ─────────────────────────────────────────────

window.__tauri_dialogs__ = {
  openFolder: () => invoke('open_folder_dialog', {}),
  openFile: (filters) => invoke('open_file_dialog', { filters: filters ?? [] }),
  saveFile: (defaultName) => invoke('save_file_dialog', { defaultName: defaultName ?? null }),
};

// ─────────────────────────────────────────────
//  Terminal (PTY)
// ─────────────────────────────────────────────

window.__tauri_terminal__ = {
  create: (cwd, rows, cols) => invoke('terminal_create', {
    cwd: (typeof cwd === 'string' && cwd.length > 0) ? cwd : null,
    rows: (typeof rows === 'number') ? rows : 24,
    cols: (typeof cols === 'number') ? cols : 80
  }),
  write: (id, data) => invoke('terminal_write', { id, data }),
  resize: (id, rows, cols) => invoke('terminal_resize', {
    id,
    rows: (typeof rows === 'number') ? rows : 24,
    cols: (typeof cols === 'number') ? cols : 80
  }),
  kill: (id) => invoke('terminal_kill', { id }),
  onData: (id, cb) => {
    if (window.__TAURI__?.event?.listen) {
      return window.__TAURI__.event.listen(`terminal-data-${id}`, (e) => cb(e.payload));
    }
    return () => {};
  },
  onExit: (id, cb) => {
    if (window.__TAURI__?.event?.listen) {
      return window.__TAURI__.event.listen(`terminal-exit-${id}`, cb);
    }
    return () => {};
  },
};

// ─────────────────────────────────────────────
//  Search
// ─────────────────────────────────────────────

window.__tauri_search__ = {
  searchText: (workspace, pattern, opts) => invoke('search_text', {
    workspace, pattern,
    include: opts?.include ?? null,
    exclude: opts?.exclude ?? null,
    caseSensitive: opts?.caseSensitive ?? false,
    maxResults: opts?.maxResults ?? 500,
  }),
  searchFiles: (workspace, pattern) => invoke('search_files', { workspace, pattern }),
};

// ─────────────────────────────────────────────
//  Git SCM
// ─────────────────────────────────────────────

window.__tauri_git__ = {
  branch: (cwd) => invoke('git_branch', { cwd: cwd ?? null }),
  status: (cwd) => invoke('git_status', { cwd: cwd ?? null }),
  isRepo: (cwd) => invoke('git_is_repo', { cwd: cwd ?? null }),
  log: (cwd, max) => invoke('git_log', { cwd, max: max ?? 50 }),
  diff: (cwd, staged) => invoke('git_diff', { cwd, staged: staged ?? false }),
  stage: (cwd, path) => invoke('git_stage', { cwd, path }),
  unstage: (cwd, path) => invoke('git_unstage', { cwd, path }),
  commit: (cwd, message) => invoke('git_commit', { cwd, message }),
  push: (cwd) => invoke('git_push', { cwd }),
  pull: (cwd) => invoke('git_pull', { cwd }),
  checkout: (cwd, branch, create) => invoke('git_checkout', { cwd, branch, create: create ?? false }),
};

// ─────────────────────────────────────────────
//  Settings persistence
// ─────────────────────────────────────────────

window.__tauri_settings__ = {
  read: () => invoke('read_settings', {}),
  write: (content) => invoke('write_settings', { content }),
  readKeybindings: () => invoke('read_keybindings', {}),
};

// ─────────────────────────────────────────────
//  Window Controls
// ─────────────────────────────────────────────

window.__tauri_window__ = {
  minimize: () => invoke('window_minimize', {}),
  toggleMaximize: () => invoke('window_toggle_maximize', {}),
  close: () => invoke('window_close', {}),
};

// ─────────────────────────────────────────────
//  Legacy electronAPI shim (for any remaining calls)
// ─────────────────────────────────────────────

window.electronAPI = {
  invoke: async (channel, ...args) => {
    switch (channel) {
      case 'read-file': return window.__tauri_fs__.readFile(args[0]);
      case 'write-file':
      case 'save-file': return window.__tauri_fs__.writeFile(args[0], args[1]);
      case 'read-dir': return window.__tauri_fs__.readDir(args[0]);
      case 'stat-file': return window.__tauri_fs__.stat(args[0]);
      case 'file-exists': return window.__tauri_fs__.exists(args[0]);
      case 'create-dir':
      case 'create-folder': return window.__tauri_fs__.mkdir(args[0]);
      case 'rename-file': return window.__tauri_fs__.rename(args[0], args[1]);
      case 'delete-file': return window.__tauri_fs__.delete(args[0]);
      case 'open-folder': return window.__tauri_dialogs__.openFolder();
      case 'open-file': return window.__tauri_dialogs__.openFile(args[0]);
      case 'save-file-dialog': return window.__tauri_dialogs__.saveFile(args[0]);
      case 'git-branch': return window.__tauri_git__.branch(args[0]);
      case 'git-status': return window.__tauri_git__.status(args[0]);
      case 'git-is-repo': return window.__tauri_git__.isRepo(args[0]);
      case 'run-falkon':
      case 'run-cimple': return invoke('run_falkon', { entry: args[0] || '', options: args[1] || {} });
      default:
        console.warn(`[electronAPI] Unknown channel: ${channel}`);
        return null;
    }
  },
  on: () => () => {},
  process: { platform: navigator.platform || 'Win32', env: {} }
};

console.log('[Tauri Shim] All IPC bridges registered:', {
  fs: !!window.__tauri_fs__,
  dialogs: !!window.__tauri_dialogs__,
  terminal: !!window.__tauri_terminal__,
  search: !!window.__tauri_search__,
  git: !!window.__tauri_git__,
  settings: !!window.__tauri_settings__,
});
