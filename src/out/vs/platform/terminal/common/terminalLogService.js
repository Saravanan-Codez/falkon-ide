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
import { Disposable } from "../../../base/common/lifecycle.js";
import { Event } from "../../../base/common/event.js";
import { localize } from "../../../nls.js";
import { ILoggerService, LogLevel } from "../../log/common/log.js";
import { IWorkspaceContextService } from "../../workspace/common/workspace.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { joinPath } from "../../../base/common/resources.js";
let TerminalLogService = class extends Disposable {
  constructor(_loggerService, workspaceContextService, environmentService) {
    super();
    this._loggerService = _loggerService;
    this._logger = this._loggerService.createLogger(joinPath(environmentService.logsHome, "terminal.log"), { id: "terminal", name: localize("terminalLoggerName", "Terminal") });
    this._register(Event.runAndSubscribe(workspaceContextService.onDidChangeWorkspaceFolders, () => {
      this._workspaceId = workspaceContextService.getWorkspace().id.substring(0, 7);
    }));
  }
  get onDidChangeLogLevel() {
    return this._logger.onDidChangeLogLevel;
  }
  getLevel() {
    return this._logger.getLevel();
  }
  setLevel(level) {
    this._logger.setLevel(level);
  }
  flush() {
    this._logger.flush();
  }
  trace(message, ...args) {
    this._logger.trace(this._formatMessage(message), args);
  }
  debug(message, ...args) {
    this._logger.debug(this._formatMessage(message), args);
  }
  info(message, ...args) {
    this._logger.info(this._formatMessage(message), args);
  }
  warn(message, ...args) {
    this._logger.warn(this._formatMessage(message), args);
  }
  error(message, ...args) {
    if (message instanceof Error) {
      this._logger.error(this._formatMessage(""), message, args);
      return;
    }
    this._logger.error(this._formatMessage(message), args);
  }
  _formatMessage(message) {
    if (this._logger.getLevel() === LogLevel.Trace) {
      return `[${this._workspaceId}] ${message}`;
    }
    return message;
  }
};
TerminalLogService = __decorateClass([
  __decorateParam(0, ILoggerService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IEnvironmentService)
], TerminalLogService);
export {
  TerminalLogService
};
