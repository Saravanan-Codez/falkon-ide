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
import { parse } from "../../../base/common/path.js";
import { debounce, throttle } from "../../../base/common/decorators.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { listProcesses } from "../../../base/node/ps.js";
import { ILogService } from "../../log/common/log.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["InactiveThrottleDuration"] = 5e3] = "InactiveThrottleDuration";
  Constants2[Constants2["ActiveDebounceDuration"] = 1e3] = "ActiveDebounceDuration";
  return Constants2;
})(Constants || {});
const ignoreProcessNames = [];
let ChildProcessMonitor = class extends Disposable {
  constructor(_pid, _logService) {
    super();
    this._pid = _pid;
    this._logService = _logService;
    this._hasChildProcesses = false;
    this._onDidChangeHasChildProcesses = this._register(new Emitter());
    /**
     * An event that fires when whether the process has child processes changes.
     */
    this.onDidChangeHasChildProcesses = this._onDidChangeHasChildProcesses.event;
  }
  set hasChildProcesses(value) {
    if (this._hasChildProcesses !== value) {
      this._hasChildProcesses = value;
      this._logService.debug("ChildProcessMonitor: Has child processes changed", value);
      this._onDidChangeHasChildProcesses.fire(value);
    }
  }
  /**
   * Whether the process has child processes.
   */
  get hasChildProcesses() {
    return this._hasChildProcesses;
  }
  /**
   * Updates the pid to monitor. This is needed when the pid is not available
   * immediately after spawn (e.g. node-pty deferred conpty connection).
   */
  setPid(pid) {
    this._pid = pid;
  }
  /**
   * Input was triggered on the process.
   */
  handleInput() {
    this._refreshActive();
  }
  /**
   * Output was triggered on the process.
   */
  handleOutput() {
    this._refreshInactive();
  }
  async _refreshActive() {
    if (this._store.isDisposed) {
      return;
    }
    try {
      const processItem = await listProcesses(this._pid);
      this.hasChildProcesses = this._processContainsChildren(processItem);
    } catch (e) {
      this._logService.debug("ChildProcessMonitor: Fetching process tree failed", e);
    }
  }
  _refreshInactive() {
    this._refreshActive();
  }
  _processContainsChildren(processItem) {
    if (!processItem.children) {
      return false;
    }
    if (processItem.children.length === 1) {
      const item = processItem.children[0];
      let cmd;
      if (item.cmd.startsWith(`"`)) {
        cmd = item.cmd.substring(1, item.cmd.indexOf(`"`, 1));
      } else {
        const spaceIndex = item.cmd.indexOf(` `);
        if (spaceIndex === -1) {
          cmd = item.cmd;
        } else {
          cmd = item.cmd.substring(0, spaceIndex);
        }
      }
      return ignoreProcessNames.indexOf(parse(cmd).name) === -1;
    }
    return processItem.children.length > 0;
  }
};
__decorateClass([
  debounce(1e3 /* ActiveDebounceDuration */)
], ChildProcessMonitor.prototype, "_refreshActive", 1);
__decorateClass([
  throttle(5e3 /* InactiveThrottleDuration */)
], ChildProcessMonitor.prototype, "_refreshInactive", 1);
ChildProcessMonitor = __decorateClass([
  __decorateParam(1, ILogService)
], ChildProcessMonitor);
export {
  ChildProcessMonitor,
  ignoreProcessNames
};
