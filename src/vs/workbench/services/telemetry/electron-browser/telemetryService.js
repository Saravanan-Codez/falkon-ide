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
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { supportsTelemetry, NullTelemetryService, getPiiPathsFromEnvironment, isInternalTelemetry } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-browser/environmentService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ISharedProcessService } from "../../../../platform/ipc/electron-browser/services.js";
import { TelemetryAppenderClient } from "../../../../platform/telemetry/common/telemetryIpc.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { resolveWorkbenchCommonProperties } from "../common/workbenchCommonProperties.js";
import { TelemetryService as BaseTelemetryService } from "../../../../platform/telemetry/common/telemetryService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { process } from "../../../../base/parts/sandbox/electron-browser/globals.js";
import { experimentsEnabled } from "../common/workbenchTelemetryUtils.js";
import { IRequestService, NO_FETCH_TELEMETRY } from "../../../../platform/request/common/request.js";
let TelemetryService = class extends Disposable {
  get sessionId() {
    return this.impl.sessionId;
  }
  get machineId() {
    return this.impl.machineId;
  }
  get sqmId() {
    return this.impl.sqmId;
  }
  get devDeviceId() {
    return this.impl.devDeviceId;
  }
  get firstSessionDate() {
    return this.impl.firstSessionDate;
  }
  get msftInternal() {
    return this.impl.msftInternal;
  }
  constructor(environmentService, productService, sharedProcessService, storageService, configurationService, requestService) {
    super();
    if (supportsTelemetry(productService, environmentService)) {
      const isInternal = isInternalTelemetry(productService, configurationService);
      const channel = sharedProcessService.getChannel("telemetryAppender");
      const config = {
        appenders: [new TelemetryAppenderClient(channel)],
        commonProperties: resolveWorkbenchCommonProperties(
          storageService,
          productService,
          environmentService,
          environmentService.os.release,
          environmentService.os.hostname,
          environmentService.machineId,
          environmentService.sqmId,
          environmentService.devDeviceId,
          isInternal,
          process
        ),
        piiPaths: getPiiPathsFromEnvironment(environmentService),
        sendErrorTelemetry: true,
        waitForExperimentProperties: experimentsEnabled(configurationService, productService, environmentService)
      };
      this.impl = this._register(new BaseTelemetryService(config, configurationService, productService));
    } else {
      this.impl = NullTelemetryService;
    }
    this.sendErrorTelemetry = this.impl.sendErrorTelemetry;
    this._register(requestService.onDidCompleteRequest((e) => {
      if (e.callSite === NO_FETCH_TELEMETRY || productService.quality === "stable") {
        return;
      }
      this.publicLog2("fetchCall", {
        callSite: e.callSite,
        latency: e.latency,
        statusCode: e.statusCode
      });
    }));
  }
  setExperimentProperty(name, value) {
    return this.impl.setExperimentProperty(name, value);
  }
  setCommonProperty(name, value) {
    this.impl.setCommonProperty(name, value);
  }
  get telemetryLevel() {
    return this.impl.telemetryLevel;
  }
  publicLog(eventName, data) {
    this.impl.publicLog(eventName, data);
  }
  publicLog2(eventName, data) {
    this.publicLog(eventName, data);
  }
  publicLogError(errorEventName, data) {
    this.impl.publicLogError(errorEventName, data);
  }
  publicLogError2(eventName, data) {
    this.publicLogError(eventName, data);
  }
};
TelemetryService = __decorateClass([
  __decorateParam(0, INativeWorkbenchEnvironmentService),
  __decorateParam(1, IProductService),
  __decorateParam(2, ISharedProcessService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IRequestService)
], TelemetryService);
registerSingleton(ITelemetryService, TelemetryService, InstantiationType.Delayed);
export {
  TelemetryService
};
