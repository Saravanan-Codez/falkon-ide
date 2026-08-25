import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { BrowserViewGroupRemoteService } from "./browserViewGroupRemoteService.js";
import { PlaywrightService } from "./playwrightService.js";
class PlaywrightChannel extends Disposable {
  constructor(ipcServer, mainProcessService, logService, agentNetworkFilterService, telemetryService) {
    super();
    this.logService = logService;
    this.agentNetworkFilterService = agentNetworkFilterService;
    this.telemetryService = telemetryService;
    this._instances = this._register(new DisposableMap());
    this.browserViewGroupRemoteService = new BrowserViewGroupRemoteService(mainProcessService);
    this._register(ipcServer.onDidRemoveConnection((c) => {
      this._instances.deleteAndDispose(c.ctx);
    }));
  }
  listen(ctx, event) {
    const instance = this._instances.get(ctx);
    if (!instance) {
      throw new Error(`Window not initialized for context: ${ctx}`);
    }
    const source = instance[event];
    if (typeof source !== "function") {
      throw new Error(`Event not found: ${event}`);
    }
    return source;
  }
  call(ctx, command, arg) {
    if (command === "__initialize") {
      if (typeof arg !== "number") {
        throw new Error(`Invalid argument for __initialize: expected window ID as number, got ${typeof arg}`);
      }
      if (!this._instances.has(ctx)) {
        const windowId = arg;
        this._instances.set(ctx, new PlaywrightService(windowId, this.browserViewGroupRemoteService, this.logService, this.agentNetworkFilterService, this.telemetryService));
      }
      return Promise.resolve(void 0);
    }
    const instance = this._instances.get(ctx);
    if (!instance) {
      throw new Error(`Window not initialized for context: ${ctx}`);
    }
    const target = instance[command];
    if (typeof target !== "function") {
      throw new Error(`Method not found: ${command}`);
    }
    const methodArgs = Array.isArray(arg) ? arg : [];
    let res = target.apply(instance, methodArgs);
    if (!(res instanceof Promise)) {
      res = Promise.resolve(res);
    }
    return res;
  }
}
export {
  PlaywrightChannel
};
