// Tauri v2 compatibility shim exposing window.electronAPI used by the app.

const ALLOWED_INVOKE_CHANNELS = [
  'open-folder', 'open-file', 'save-file', 'read-file', 'read-dir',
  'write-file', 'file-exists', 'create-temp-file', 'delete-file',
  'show-open-recent', 'create-file', 'create-folder',
  'terminal-spawn', 'terminal-write', 'terminal-kill', 'terminal-sigint',
  'git-branch', 'git-status', 'git-is-repo', 'run-cimple', 'run-falkon'
];

const ALLOWED_ON_CHANNELS = [
  'terminal-data', 'terminal-exit', 'run-output'
];

function tauriInvoke(cmd, args) {
  if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
    return window.__TAURI__.core.invoke(cmd, args);
  }
  console.warn(`[Tauri Shim] window.__TAURI__.core.invoke not found for command ${cmd}`);
  return Promise.resolve(null);
}

window.electronAPI = {
  invoke: async (channel, ...args) => {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));

    switch (channel) {
      case 'open-folder':
      case 'open-file':
      case 'open-recent':
      case 'show-open-recent':
        return null;
      case 'read-file':
        return tauriInvoke('read_file', { filePath: args[0] });
      case 'write-file':
      case 'save-file':
        return tauriInvoke('write_file', { filePath: args[0], content: args[1] });
      case 'read-dir':
        return tauriInvoke('read_dir', { dirPath: args[0] });
      case 'file-exists':
        return tauriInvoke('file_exists', { filePath: args[0] });
      case 'create-temp-file':
        return tauriInvoke('create_temp_file', { content: args[0] || '' });
      case 'delete-file':
        return tauriInvoke('delete_file', { filePath: args[0] });
      case 'git-branch':
        return tauriInvoke('git_branch', { cwd: args[0] || null });
      case 'git-status':
        return tauriInvoke('git_status', { cwd: args[0] || null });
      case 'git-is-repo':
        return tauriInvoke('git_is_repo', { cwd: args[0] || null });
      case 'run-cimple':
      case 'run-falkon':
        return tauriInvoke('run_falkon', { entry: args[0] || '', options: args[1] || {} });
      default:
        return null;
    }
  },
  on: (channel, callback) => {
    return () => {};
  },
  process: {
    platform: navigator.platform || '',
    env: {}
  }
};
