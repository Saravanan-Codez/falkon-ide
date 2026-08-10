var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { ipcRenderer } from "../../../../base/parts/sandbox/electron-browser/globals.js";
import { URI } from "../../../../base/common/uri.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { registerRemoteContributions } from "./terminalRemote.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ITerminalService } from "../browser/terminal.js";
import { disposableWindowInterval, getActiveWindow } from "../../../../base/browser/dom.js";
let TerminalNativeContribution = class extends Disposable {
  constructor(_fileService, _terminalService, remoteAgentService, nativeHostService) {
    super();
    this._fileService = _fileService;
    this._terminalService = _terminalService;
    ipcRenderer.on("vscode:openFiles", (_, ...args) => {
      this._onOpenFileRequest(args[0]);
    });
    this._register(nativeHostService.onDidResumeOS(() => this._onOsResume()));
    this._terminalService.setNativeDelegate({
      getWindowCount: () => nativeHostService.getWindowCount()
    });
    const connection = remoteAgentService.getConnection();
    if (connection && connection.remoteAuthority) {
      registerRemoteContributions();
    }
  }
  _onOsResume() {
    for (const instance of this._terminalService.instances) {
      instance.xterm?.forceRedraw();
    }
  }
  async _onOpenFileRequest(request) {
    if (request.termProgram === "vscode" && request.filesToWait) {
      const waitMarkerFileUri = URI.revive(request.filesToWait.waitMarkerFileUri);
      await this._whenFileDeleted(waitMarkerFileUri);
      this._terminalService.activeInstance?.focus();
    }
  }
  _whenFileDeleted(path) {
    return new Promise((resolve) => {
      let running = false;
      const interval = disposableWindowInterval(getActiveWindow(), async () => {
        if (!running) {
          running = true;
          const exists = await this._fileService.exists(path);
          running = false;
          if (!exists) {
            interval.dispose();
            resolve(void 0);
          }
        }
      }, 1e3);
    });
  }
};
TerminalNativeContribution = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ITerminalService),
  __decorateParam(2, IRemoteAgentService),
  __decorateParam(3, INativeHostService)
], TerminalNativeContribution);
export {
  TerminalNativeContribution
};
