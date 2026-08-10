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
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { FileAccess, Schemas } from "../../../base/common/network.js";
import { Client } from "../../../base/parts/ipc/node/ipc.cp.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { parsePtyHostDebugPort } from "../../environment/node/environmentService.js";
let NodePtyHostStarter = class extends Disposable {
  constructor(_reconnectConstants, _environmentService) {
    super();
    this._reconnectConstants = _reconnectConstants;
    this._environmentService = _environmentService;
  }
  start() {
    const opts = {
      serverName: "Pty Host",
      args: ["--type=ptyHost", "--logsPath", this._environmentService.logsHome.with({ scheme: Schemas.file }).fsPath],
      env: {
        VSCODE_ESM_ENTRYPOINT: "vs/platform/terminal/node/ptyHostMain",
        VSCODE_PIPE_LOGGING: "true",
        VSCODE_VERBOSE_LOGGING: "true",
        // transmit console logs from server to client,
        VSCODE_RECONNECT_GRACE_TIME: this._reconnectConstants.graceTime,
        VSCODE_RECONNECT_SHORT_GRACE_TIME: this._reconnectConstants.shortGraceTime,
        VSCODE_RECONNECT_SCROLLBACK: this._reconnectConstants.scrollback
      }
    };
    const ptyHostDebug = parsePtyHostDebugPort(this._environmentService.args, this._environmentService.isBuilt);
    if (ptyHostDebug) {
      if (ptyHostDebug.break && ptyHostDebug.port) {
        opts.debugBrk = ptyHostDebug.port;
      } else if (!ptyHostDebug.break && ptyHostDebug.port) {
        opts.debug = ptyHostDebug.port;
      }
    }
    const client = new Client(FileAccess.asFileUri("bootstrap-fork").fsPath, opts);
    const store = new DisposableStore();
    store.add(client);
    return {
      client,
      store,
      onDidProcessExit: client.onDidProcessExit
    };
  }
};
NodePtyHostStarter = __decorateClass([
  __decorateParam(1, IEnvironmentService)
], NodePtyHostStarter);
export {
  NodePtyHostStarter
};
