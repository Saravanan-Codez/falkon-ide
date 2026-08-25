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
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { refineServiceDecorator } from "../../instantiation/common/instantiation.js";
import { IProductService } from "../../product/common/productService.js";
import { ITelemetryService, TelemetryLevel } from "./telemetry.js";
import { TelemetryService } from "./telemetryService.js";
import { NullTelemetryServiceShape } from "./telemetryUtils.js";
let ServerTelemetryService = class extends TelemetryService {
  constructor(config, injectedTelemetryLevel, _configurationService, _productService) {
    super(config, _configurationService, _productService);
    this._injectedTelemetryLevel = injectedTelemetryLevel;
  }
  publicLog(eventName, data) {
    if (this._injectedTelemetryLevel < TelemetryLevel.USAGE) {
      return;
    }
    return super.publicLog(eventName, data);
  }
  publicLog2(eventName, data) {
    return this.publicLog(eventName, data);
  }
  publicLogError(errorEventName, data) {
    if (this._injectedTelemetryLevel < TelemetryLevel.ERROR) {
      return Promise.resolve(void 0);
    }
    return super.publicLogError(errorEventName, data);
  }
  publicLogError2(eventName, data) {
    return this.publicLogError(eventName, data);
  }
  async updateInjectedTelemetryLevel(telemetryLevel) {
    if (telemetryLevel === void 0) {
      this._injectedTelemetryLevel = TelemetryLevel.NONE;
      throw new Error("Telemetry level cannot be undefined. This will cause infinite looping!");
    }
    this._injectedTelemetryLevel = this._injectedTelemetryLevel ? Math.min(this._injectedTelemetryLevel, telemetryLevel) : telemetryLevel;
    if (this._injectedTelemetryLevel === TelemetryLevel.NONE) {
      this.dispose();
    }
  }
};
ServerTelemetryService = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IProductService)
], ServerTelemetryService);
const ServerNullTelemetryService = new class extends NullTelemetryServiceShape {
  async updateInjectedTelemetryLevel() {
    return;
  }
  // No-op, telemetry is already disabled
}();
const IServerTelemetryService = refineServiceDecorator(ITelemetryService);
export {
  IServerTelemetryService,
  ServerNullTelemetryService,
  ServerTelemetryService
};
