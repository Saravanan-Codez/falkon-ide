const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    const subscription = (event, ...args) => callback(event, ...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  path: {
    join: (...args) => path.join(...args),
    dirname: (p) => path.dirname(p),
    relative: (from, to) => path.relative(from, to),
    extname: (p) => path.extname(p)
  },
  process: {
    platform: process.platform,
    env: {
      SHELL: process.env.SHELL,
      POWERSHELL: process.env.POWERSHELL,
      COMSPEC: process.env.COMSPEC
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type])
    }
})
