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
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import * as extHostProtocol from "./extHost.protocol.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
const IExtHostApiDeprecationService = createDecorator("IExtHostApiDeprecationService");
let ExtHostApiDeprecationService = class {
  constructor(rpc, _extHostLogService) {
    this._extHostLogService = _extHostLogService;
    this._reportedUsages = /* @__PURE__ */ new Set();
    this._telemetryShape = rpc.getProxy(extHostProtocol.MainContext.MainThreadTelemetry);
  }
  report(apiId, extension, migrationSuggestion, options) {
    const key = this.getUsageKey(apiId, extension, options?.usageId);
    if (this._reportedUsages.has(key)) {
      return;
    }
    this._reportedUsages.add(key);
    if (extension.isUnderDevelopment) {
      this._extHostLogService.warn(`[Deprecation Warning] '${apiId}' is deprecated. ${migrationSuggestion}`);
    }
    this._telemetryShape.$publicLog2("extHostDeprecatedApiUsage", {
      extensionId: extension.identifier.value,
      apiId,
      usageId: options?.usageId ?? ""
    });
  }
  getUsageKey(apiId, extension, usageId) {
    const rootKey = `${apiId}-${extension.identifier.value}`;
    return usageId ? `${rootKey}-${usageId}` : rootKey;
  }
};
ExtHostApiDeprecationService = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, ILogService)
], ExtHostApiDeprecationService);
const NullApiDeprecationService = Object.freeze(new class {
  report(_apiId, _extension, _warningMessage) {
  }
}());
export {
  ExtHostApiDeprecationService,
  IExtHostApiDeprecationService,
  NullApiDeprecationService
};
