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
import { ILogService } from "../../../../log/common/log.js";
import { TerminalAutoResponder } from "./terminalAutoResponder.js";
let AutoRepliesPtyServiceContribution = class {
  constructor(_logService) {
    this._logService = _logService;
    this._autoReplies = /* @__PURE__ */ new Map();
    this._terminalProcesses = /* @__PURE__ */ new Map();
    this._autoResponders = /* @__PURE__ */ new Map();
  }
  async installAutoReply(match, reply) {
    this._autoReplies.set(match, reply);
    for (const persistentProcessId of this._autoResponders.keys()) {
      const process = this._terminalProcesses.get(persistentProcessId);
      if (!process) {
        this._logService.error("Could not find terminal process to install auto reply");
        continue;
      }
      this._processInstallAutoReply(persistentProcessId, process, match, reply);
    }
  }
  async uninstallAllAutoReplies() {
    for (const match of this._autoReplies.keys()) {
      for (const processAutoResponders of this._autoResponders.values()) {
        processAutoResponders.get(match)?.dispose();
        processAutoResponders.delete(match);
      }
    }
  }
  handleProcessReady(persistentProcessId, process) {
    this._terminalProcesses.set(persistentProcessId, process);
    this._autoResponders.set(persistentProcessId, /* @__PURE__ */ new Map());
    for (const [match, reply] of this._autoReplies.entries()) {
      this._processInstallAutoReply(persistentProcessId, process, match, reply);
    }
  }
  handleProcessDispose(persistentProcessId) {
    const processAutoResponders = this._autoResponders.get(persistentProcessId);
    if (processAutoResponders) {
      for (const e of processAutoResponders.values()) {
        e.dispose();
      }
      processAutoResponders.clear();
    }
    this._autoResponders.delete(persistentProcessId);
    this._terminalProcesses.delete(persistentProcessId);
  }
  handleProcessInput(persistentProcessId, data) {
    const processAutoResponders = this._autoResponders.get(persistentProcessId);
    if (processAutoResponders) {
      for (const listener of processAutoResponders.values()) {
        listener.handleInput();
      }
    }
  }
  handleProcessResize(persistentProcessId, cols, rows) {
    const processAutoResponders = this._autoResponders.get(persistentProcessId);
    if (processAutoResponders) {
      for (const listener of processAutoResponders.values()) {
        listener.handleResize();
      }
    }
  }
  _processInstallAutoReply(persistentProcessId, terminalProcess, match, reply) {
    const processAutoResponders = this._autoResponders.get(persistentProcessId);
    if (processAutoResponders) {
      processAutoResponders.get(match)?.dispose();
      processAutoResponders.set(match, new TerminalAutoResponder(terminalProcess, match, reply, this._logService));
    }
  }
};
AutoRepliesPtyServiceContribution = __decorateClass([
  __decorateParam(0, ILogService)
], AutoRepliesPtyServiceContribution);
export {
  AutoRepliesPtyServiceContribution
};
