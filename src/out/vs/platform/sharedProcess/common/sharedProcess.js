const SharedProcessLifecycle = {
  exit: "vscode:electron-main->shared-process=exit",
  ipcReady: "vscode:shared-process->electron-main=ipc-ready",
  initDone: "vscode:shared-process->electron-main=init-done"
};
const SharedProcessChannelConnection = {
  request: "vscode:createSharedProcessChannelConnection",
  response: "vscode:createSharedProcessChannelConnectionResult"
};
const SharedProcessRawConnection = {
  request: "vscode:createSharedProcessRawConnection",
  response: "vscode:createSharedProcessRawConnectionResult"
};
export {
  SharedProcessChannelConnection,
  SharedProcessLifecycle,
  SharedProcessRawConnection
};
