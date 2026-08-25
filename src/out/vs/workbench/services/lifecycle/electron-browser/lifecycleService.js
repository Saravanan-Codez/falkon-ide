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
import { handleVetos } from "../../../../platform/lifecycle/common/lifecycle.js";
import { ILifecycleService, WillShutdownJoinerOrder } from "../common/lifecycle.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ipcRenderer } from "../../../../base/parts/sandbox/electron-browser/globals.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { AbstractLifecycleService } from "../common/lifecycleService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { Promises, disposableTimeout, raceCancellation } from "../../../../base/common/async.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
let NativeLifecycleService = class extends AbstractLifecycleService {
  constructor(nativeHostService, storageService, logService) {
    super(logService, storageService);
    this.nativeHostService = nativeHostService;
    this.registerListeners();
  }
  static {
    this.BEFORE_SHUTDOWN_WARNING_DELAY = 5e3;
  }
  static {
    this.WILL_SHUTDOWN_WARNING_DELAY = 800;
  }
  registerListeners() {
    const windowId = this.nativeHostService.windowId;
    ipcRenderer.on("vscode:onBeforeUnload", async (event, ...args) => {
      const reply = args[0];
      this.logService.trace(`[lifecycle] onBeforeUnload (reason: ${reply.reason})`);
      const veto = await this.handleBeforeShutdown(reply.reason);
      if (veto) {
        this.logService.trace("[lifecycle] onBeforeUnload prevented via veto");
        this._onShutdownVeto.fire();
        ipcRenderer.send(reply.cancelChannel, windowId);
      } else {
        this.logService.trace("[lifecycle] onBeforeUnload continues without veto");
        this.shutdownReason = reply.reason;
        ipcRenderer.send(reply.okChannel, windowId);
      }
    });
    ipcRenderer.on("vscode:onWillUnload", async (event, ...args) => {
      const reply = args[0];
      this.logService.trace(`[lifecycle] onWillUnload (reason: ${reply.reason})`);
      await this.handleWillShutdown(reply.reason);
      this._onDidShutdown.fire();
      ipcRenderer.send(reply.replyChannel, windowId);
    });
  }
  async handleBeforeShutdown(reason) {
    const logService = this.logService;
    const vetos = [];
    const pendingVetos = /* @__PURE__ */ new Set();
    let finalVeto = void 0;
    let finalVetoId = void 0;
    this._onBeforeShutdown.fire({
      reason,
      veto(value, id) {
        vetos.push(value);
        if (value === true) {
          logService.info(`[lifecycle]: Shutdown was prevented (id: ${id})`);
        } else if (value instanceof Promise) {
          pendingVetos.add(id);
          value.then((veto) => {
            if (veto === true) {
              logService.info(`[lifecycle]: Shutdown was prevented (id: ${id})`);
            }
          }).finally(() => pendingVetos.delete(id));
        }
      },
      finalVeto(value, id) {
        if (!finalVeto) {
          finalVeto = value;
          finalVetoId = id;
        } else {
          throw new Error(`[lifecycle]: Final veto is already defined (id: ${id})`);
        }
      }
    });
    const longRunningBeforeShutdownWarning = disposableTimeout(() => {
      logService.warn(`[lifecycle] onBeforeShutdown is taking a long time, pending operations: ${Array.from(pendingVetos).join(", ")}`);
    }, NativeLifecycleService.BEFORE_SHUTDOWN_WARNING_DELAY);
    try {
      let veto = await handleVetos(vetos, (error) => this.handleBeforeShutdownError(error, reason));
      if (veto) {
        return veto;
      }
      if (finalVeto) {
        try {
          pendingVetos.add(finalVetoId);
          veto = await finalVeto();
          if (veto) {
            logService.info(`[lifecycle]: Shutdown was prevented by final veto (id: ${finalVetoId})`);
          }
        } catch (error) {
          veto = true;
          this.handleBeforeShutdownError(error, reason);
        }
      }
      return veto;
    } finally {
      longRunningBeforeShutdownWarning.dispose();
    }
  }
  handleBeforeShutdownError(error, reason) {
    this.logService.error(`[lifecycle]: Error during before-shutdown phase (error: ${toErrorMessage(error)})`);
    this._onBeforeShutdownError.fire({ reason, error });
  }
  async handleWillShutdown(reason) {
    this._willShutdown = true;
    const joiners = [];
    const lastJoiners = [];
    const pendingJoiners = /* @__PURE__ */ new Set();
    const cts = new CancellationTokenSource();
    this._onWillShutdown.fire({
      reason,
      token: cts.token,
      joiners: () => Array.from(pendingJoiners.values()),
      join(promiseOrPromiseFn, joiner) {
        pendingJoiners.add(joiner);
        if (joiner.order === WillShutdownJoinerOrder.Last) {
          const promiseFn = typeof promiseOrPromiseFn === "function" ? promiseOrPromiseFn : () => promiseOrPromiseFn;
          lastJoiners.push(() => promiseFn().finally(() => pendingJoiners.delete(joiner)));
        } else {
          const promise = typeof promiseOrPromiseFn === "function" ? promiseOrPromiseFn() : promiseOrPromiseFn;
          promise.finally(() => pendingJoiners.delete(joiner));
          joiners.push(promise);
        }
      },
      force: () => {
        cts.dispose(true);
      }
    });
    const longRunningWillShutdownWarning = disposableTimeout(() => {
      this.logService.warn(`[lifecycle] onWillShutdown is taking a long time, pending operations: ${Array.from(pendingJoiners).map((joiner) => joiner.id).join(", ")}`);
    }, NativeLifecycleService.WILL_SHUTDOWN_WARNING_DELAY);
    try {
      await raceCancellation(Promises.settled(joiners), cts.token);
    } catch (error) {
      this.logService.error(`[lifecycle]: Error during will-shutdown phase in default joiners (error: ${toErrorMessage(error)})`);
    }
    try {
      await raceCancellation(Promises.settled(lastJoiners.map((lastJoiner) => lastJoiner())), cts.token);
    } catch (error) {
      this.logService.error(`[lifecycle]: Error during will-shutdown phase in last joiners (error: ${toErrorMessage(error)})`);
    }
    longRunningWillShutdownWarning.dispose();
  }
  shutdown() {
    return this.nativeHostService.closeWindow();
  }
};
NativeLifecycleService = __decorateClass([
  __decorateParam(0, INativeHostService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, ILogService)
], NativeLifecycleService);
registerSingleton(ILifecycleService, NativeLifecycleService, InstantiationType.Eager);
export {
  NativeLifecycleService
};
