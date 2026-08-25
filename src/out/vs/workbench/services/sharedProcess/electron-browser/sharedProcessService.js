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
import { Client as MessagePortClient } from "../../../../base/parts/ipc/common/ipc.mp.js";
import { getDelayedChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { SharedProcessChannelConnection, SharedProcessRawConnection } from "../../../../platform/sharedProcess/common/sharedProcess.js";
import { mark } from "../../../../base/common/performance.js";
import { Barrier, timeout } from "../../../../base/common/async.js";
import { acquirePort } from "../../../../base/parts/ipc/electron-browser/ipc.mp.js";
let SharedProcessService = class extends Disposable {
  constructor(windowId, logService) {
    super();
    this.windowId = windowId;
    this.logService = logService;
    this.restoredBarrier = new Barrier();
    this.withSharedProcessConnection = this.connect();
  }
  async connect() {
    this.logService.trace("Renderer->SharedProcess#connect");
    await Promise.race([this.restoredBarrier.wait(), timeout(2e3)]);
    mark("code/willConnectSharedProcess");
    this.logService.trace("Renderer->SharedProcess#connect: before acquirePort");
    const port = await acquirePort(SharedProcessChannelConnection.request, SharedProcessChannelConnection.response);
    mark("code/didConnectSharedProcess");
    this.logService.trace("Renderer->SharedProcess#connect: connection established");
    return this._register(new MessagePortClient(port, `window:${this.windowId}`));
  }
  notifyRestored() {
    if (!this.restoredBarrier.isOpen()) {
      this.restoredBarrier.open();
    }
  }
  getChannel(channelName) {
    return getDelayedChannel(this.withSharedProcessConnection.then((connection) => connection.getChannel(channelName)));
  }
  registerChannel(channelName, channel) {
    this.withSharedProcessConnection.then((connection) => connection.registerChannel(channelName, channel));
  }
  async createRawConnection() {
    await this.withSharedProcessConnection;
    this.logService.trace("Renderer->SharedProcess#createRawConnection: before acquirePort");
    const port = await acquirePort(SharedProcessRawConnection.request, SharedProcessRawConnection.response);
    this.logService.trace("Renderer->SharedProcess#createRawConnection: connection established");
    return port;
  }
};
SharedProcessService = __decorateClass([
  __decorateParam(1, ILogService)
], SharedProcessService);
export {
  SharedProcessService
};
