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
import { ILogService } from "../../../../platform/log/common/log.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { Client as MessagePortClient } from "../../../../base/parts/ipc/common/ipc.mp.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ProxyChannel } from "../../../../base/parts/ipc/common/ipc.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { acquirePort } from "../../../../base/parts/ipc/electron-browser/ipc.mp.js";
import { ipcUtilityProcessWorkerChannelName } from "../../../../platform/utilityProcess/common/utilityProcessWorkerService.js";
import { Barrier, timeout } from "../../../../base/common/async.js";
const IUtilityProcessWorkerWorkbenchService = createDecorator("utilityProcessWorkerWorkbenchService");
let UtilityProcessWorkerWorkbenchService = class extends Disposable {
  constructor(windowId, logService, mainProcessService) {
    super();
    this.windowId = windowId;
    this.logService = logService;
    this.mainProcessService = mainProcessService;
    this._utilityProcessWorkerService = void 0;
    this.restoredBarrier = new Barrier();
  }
  get utilityProcessWorkerService() {
    if (!this._utilityProcessWorkerService) {
      const channel = this.mainProcessService.getChannel(ipcUtilityProcessWorkerChannelName);
      this._utilityProcessWorkerService = ProxyChannel.toService(channel);
    }
    return this._utilityProcessWorkerService;
  }
  async createWorker(process) {
    this.logService.trace("Renderer->UtilityProcess#createWorker");
    await Promise.race([this.restoredBarrier.wait(), timeout(2e3)]);
    const nonce = generateUuid();
    const responseChannel = "vscode:createUtilityProcessWorkerMessageChannelResult";
    const portPromise = acquirePort(void 0, responseChannel, nonce);
    const onDidTerminate = this.utilityProcessWorkerService.createWorker({
      process,
      reply: { windowId: this.windowId, channel: responseChannel, nonce }
    });
    const disposables = new DisposableStore();
    disposables.add(toDisposable(() => {
      this.logService.trace("Renderer->UtilityProcess#disposeWorker", process);
      this.utilityProcessWorkerService.disposeWorker({
        process,
        reply: { windowId: this.windowId }
      });
    }));
    const port = await portPromise;
    const client = disposables.add(new MessagePortClient(port, `window:${this.windowId},module:${process.moduleId}`));
    this.logService.trace("Renderer->UtilityProcess#createWorkerChannel: connection established");
    onDidTerminate.then(({ reason }) => {
      if (reason?.code === 0) {
        this.logService.trace(`[UtilityProcessWorker]: terminated normally with code ${reason.code}, signal: ${reason.signal}`);
      } else {
        this.logService.error(`[UtilityProcessWorker]: terminated unexpectedly with code ${reason?.code}, signal: ${reason?.signal}`);
      }
    });
    return { client, onDidTerminate, dispose: () => disposables.dispose() };
  }
  notifyRestored() {
    if (!this.restoredBarrier.isOpen()) {
      this.restoredBarrier.open();
    }
  }
};
UtilityProcessWorkerWorkbenchService = __decorateClass([
  __decorateParam(1, ILogService),
  __decorateParam(2, IMainProcessService)
], UtilityProcessWorkerWorkbenchService);
export {
  IUtilityProcessWorkerWorkbenchService,
  UtilityProcessWorkerWorkbenchService
};
