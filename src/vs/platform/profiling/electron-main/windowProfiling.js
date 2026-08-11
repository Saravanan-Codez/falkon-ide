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
import { timeout } from "../../../base/common/async.js";
import { ILogService } from "../../log/common/log.js";
let WindowProfiler = class {
  constructor(_window, _sessionId, _logService) {
    this._window = _window;
    this._sessionId = _sessionId;
    this._logService = _logService;
  }
  async inspect(duration) {
    await this._connect();
    const inspector = this._window.webContents.debugger;
    await inspector.sendCommand("Profiler.start");
    this._logService.warn("[perf] profiling STARTED", this._sessionId);
    await timeout(duration);
    const data = await inspector.sendCommand("Profiler.stop");
    this._logService.warn("[perf] profiling DONE", this._sessionId);
    await this._disconnect();
    return data.profile;
  }
  async _connect() {
    const inspector = this._window.webContents.debugger;
    inspector.attach();
    await inspector.sendCommand("Profiler.enable");
  }
  async _disconnect() {
    const inspector = this._window.webContents.debugger;
    await inspector.sendCommand("Profiler.disable");
    inspector.detach();
  }
};
WindowProfiler = __decorateClass([
  __decorateParam(2, ILogService)
], WindowProfiler);
export {
  WindowProfiler
};
