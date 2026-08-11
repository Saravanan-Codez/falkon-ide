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
import { isSigPipeError, onUnexpectedError, setUnexpectedErrorHandler } from "../../../base/common/errors.js";
import BaseErrorTelemetry from "../common/errorTelemetry.js";
import { ITelemetryService } from "../common/telemetry.js";
let ErrorTelemetry = class extends BaseErrorTelemetry {
  constructor(logService, telemetryService) {
    super(telemetryService);
    this.logService = logService;
  }
  installErrorListeners() {
    setUnexpectedErrorHandler((error) => this.onUnexpectedError(error));
    process.on("uncaughtException", (error) => {
      if (!isSigPipeError(error)) {
        onUnexpectedError(error);
      }
    });
    process.on("unhandledRejection", (reason) => onUnexpectedError(reason));
  }
  onUnexpectedError(error) {
    this.logService.error(`[uncaught exception in main]: ${error}`);
    if (error.stack) {
      this.logService.error(error.stack);
    }
  }
};
ErrorTelemetry = __decorateClass([
  __decorateParam(1, ITelemetryService)
], ErrorTelemetry);
export {
  ErrorTelemetry as default
};
