// Tauri compatibility shim exposing a minimal `window.electronAPI` used by the app.
import { open, save } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';

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

function throwUnimplemented(channel) {
  return Promise.reject(new Error(`${channel} is not implemented in the Tauri shim yet`));
}

window.electronAPI = {
  invoke: async (channel, ...args) => {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));

    switch (channel) {
      case 'open-folder':
        return open({ directory: true });
      case 'open-file':
        return open({ multiple: false, filters: [{ name: 'Cimple', extensions: ['cimple', 'cpl', 'py'] }, { name: 'All Files', extensions: ['*'] }] });
      case 'create-file': {
        const options = args[0] || {};
        const defaultPath = options.defaultPath;
        const filePath = await save({ defaultPath, filters: [{ name: 'Cimple', extensions: ['cimple', 'cpl', 'py'] }, { name: 'All Files', extensions: ['*'] }] });
        if (!filePath) return null;
        const content = typeof options.content === 'string' ? options.content : '';
        await invoke('write_file', { filePath, content });
        return filePath;
      }
      case 'open-recent':
      case 'show-open-recent':
        return null; // not implemented
      case 'read-file':
        return invoke('read_file', { filePath: args[0] });
      case 'write-file':
      case 'save-file':
        return invoke('write_file', { filePath: args[0], content: args[1] });
      case 'read-dir':
        return invoke('read_dir', { dirPath: args[0] });
      case 'file-exists':
        return invoke('file_exists', { filePath: args[0] });
      case 'create-temp-file':
        return invoke('create_temp_file', { content: args[0] || '' });
      case 'delete-file':
        return invoke('delete_file', { filePath: args[0] });
      case 'git-branch':
        return invoke('git_branch', { cwd: args[0] || null });
      case 'git-status':
        return invoke('git_status', { cwd: args[0] || null });
      case 'git-is-repo':
        return invoke('git_is_repo', { cwd: args[0] || null });
      case 'run-cimple':
      case 'run-falkon':
        return invoke('run_falkon', { entry: args[0] || '', options: args[1] || {} });
      default:
        return throwUnimplemented(channel);
    }
  },
  on: (channel, callback) => {
    if (!ALLOWED_ON_CHANNELS.includes(channel)) return () => {};
    // For now, terminal events are not emitted from Rust; keep a noop.
    return () => {};
  },
  process: {
    platform: navigator.platform || '',
    env: {}
  }
};
