const { contextBridge, ipcRenderer } = require('electron');
const platform = typeof process !== 'undefined' ? process.platform : '';
const env = (typeof process !== 'undefined' && process.env) ? {
  SHELL: process.env.SHELL,
  POWERSHELL: process.env.POWERSHELL,
  COMSPEC: process.env.COMSPEC
} : {};

const ALLOWED_INVOKE_CHANNELS = [
  'open-folder', 'open-file', 'save-file', 'read-file', 'read-dir',
  'write-file', 'file-exists', 'create-temp-file', 'delete-file',
  'show-open-recent', 'create-file', 'create-folder',
  'terminal-spawn', 'terminal-write', 'terminal-kill', 'terminal-sigint',
  'git-branch', 'git-status', 'git-is-repo', 'run-cimple'
];

const ALLOWED_ON_CHANNELS = [
  'terminal-data', 'terminal-exit', 'run-output'
];

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
  on: (channel, callback) => {
    if (ALLOWED_ON_CHANNELS.includes(channel)) {
      const subscription = (event, ...args) => callback(event, ...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
  process: {
    platform,
    env
  }
});

window.addEventListener('DOMContentLoaded', () => {
    const versions = typeof process !== 'undefined' ? process.versions : {};
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, versions[type] || '')
    }
})







