const vscodeGlobal = globalThis.vscode;
const ipcRenderer = vscodeGlobal.ipcRenderer;
const ipcMessagePort = vscodeGlobal.ipcMessagePort;
const webFrame = vscodeGlobal.webFrame;
const process = vscodeGlobal.process;
const context = vscodeGlobal.context;
const webUtils = vscodeGlobal.webUtils;
export {
  context,
  ipcMessagePort,
  ipcRenderer,
  process,
  webFrame,
  webUtils
};
