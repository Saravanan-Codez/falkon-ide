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
import { localize } from "../../../nls.js";
import { ILoggerService } from "../../../platform/log/common/log.js";
import { LogService } from "../../../platform/log/common/logService.js";
import { IExtHostInitDataService } from "./extHostInitDataService.js";
let ExtHostLogService = class extends LogService {
  constructor(isWorker, loggerService, initData) {
    const id = initData.remote.isRemote ? "remoteexthost" : isWorker ? "workerexthost" : "exthost";
    const name = initData.remote.isRemote ? localize("remote", "Extension Host (Remote)") : isWorker ? localize("worker", "Extension Host (Worker)") : localize("local", "Extension Host");
    super(loggerService.createLogger(id, { name }));
  }
};
ExtHostLogService = __decorateClass([
  __decorateParam(1, ILoggerService),
  __decorateParam(2, IExtHostInitDataService)
], ExtHostLogService);
export {
  ExtHostLogService
};
