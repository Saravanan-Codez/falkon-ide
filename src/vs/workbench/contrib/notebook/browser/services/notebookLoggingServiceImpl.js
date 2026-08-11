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
import * as nls from "../../../../../nls.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ILoggerService } from "../../../../../platform/log/common/log.js";
import { windowLogGroup } from "../../../../services/log/common/logConstants.js";
const logChannelId = "notebook.rendering";
let NotebookLoggingService = class extends Disposable {
  static {
    this.ID = "notebook";
  }
  constructor(loggerService) {
    super();
    this._logger = this._register(loggerService.createLogger(logChannelId, { name: nls.localize("renderChannelName", "Notebook"), group: windowLogGroup }));
  }
  trace(category, output) {
    this._logger.trace(`[${category}] ${output}`);
  }
  debug(category, output) {
    this._logger.debug(`[${category}] ${output}`);
  }
  info(category, output) {
    this._logger.info(`[${category}] ${output}`);
  }
  warn(category, output) {
    this._logger.warn(`[${category}] ${output}`);
  }
  error(category, output) {
    this._logger.error(`[${category}] ${output}`);
  }
};
NotebookLoggingService = __decorateClass([
  __decorateParam(0, ILoggerService)
], NotebookLoggingService);
export {
  NotebookLoggingService
};
