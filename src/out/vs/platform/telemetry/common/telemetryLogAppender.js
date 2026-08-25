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
import { localize } from "../../../nls.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { ILoggerService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { TelemetryLogGroup, isLoggingOnly, telemetryLogId, validateTelemetryData } from "./telemetryUtils.js";
let TelemetryLogAppender = class extends Disposable {
  constructor(prefix, remote, loggerService, environmentService, productService) {
    super();
    this.prefix = prefix;
    const id = remote ? "remoteTelemetry" : telemetryLogId;
    const logger = loggerService.getLogger(id);
    if (logger) {
      this.logger = this._register(logger);
    } else {
      const justLoggingAndNotSending = isLoggingOnly(productService, environmentService);
      const logSuffix = justLoggingAndNotSending ? " (Not Sent)" : "";
      this.logger = this._register(loggerService.createLogger(
        id,
        {
          name: localize("telemetryLog", "Telemetry{0}", logSuffix),
          group: TelemetryLogGroup,
          hidden: true
        }
      ));
    }
  }
  flush() {
    return Promise.resolve();
  }
  log(eventName, data) {
    this.logger.trace(`${this.prefix}telemetry/${eventName}`, validateTelemetryData(data));
  }
};
TelemetryLogAppender = __decorateClass([
  __decorateParam(2, ILoggerService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, IProductService)
], TelemetryLogAppender);
export {
  TelemetryLogAppender
};
