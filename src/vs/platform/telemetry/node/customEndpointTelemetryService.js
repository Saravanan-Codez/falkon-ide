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
import { FileAccess } from "../../../base/common/network.js";
import { Client as TelemetryClient } from "../../../base/parts/ipc/node/ipc.cp.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { ILoggerService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { ITelemetryService } from "../common/telemetry.js";
import { TelemetryAppenderClient } from "../common/telemetryIpc.js";
import { TelemetryLogAppender } from "../common/telemetryLogAppender.js";
import { TelemetryService } from "../common/telemetryService.js";
let CustomEndpointTelemetryService = class {
  constructor(configurationService, telemetryService, loggerService, environmentService, productService) {
    this.configurationService = configurationService;
    this.telemetryService = telemetryService;
    this.loggerService = loggerService;
    this.environmentService = environmentService;
    this.productService = productService;
    this.customTelemetryServices = /* @__PURE__ */ new Map();
  }
  getCustomTelemetryService(endpoint) {
    if (!this.customTelemetryServices.has(endpoint.id)) {
      const telemetryInfo = /* @__PURE__ */ Object.create(null);
      telemetryInfo["common.vscodemachineid"] = this.telemetryService.machineId;
      telemetryInfo["common.vscodesessionid"] = this.telemetryService.sessionId;
      const args = [endpoint.id, JSON.stringify(telemetryInfo), endpoint.aiKey];
      const client = new TelemetryClient(
        FileAccess.asFileUri("bootstrap-fork").fsPath,
        {
          serverName: "Debug Telemetry",
          timeout: 1e3 * 60 * 5,
          args,
          env: {
            ELECTRON_RUN_AS_NODE: 1,
            VSCODE_PIPE_LOGGING: "true",
            VSCODE_ESM_ENTRYPOINT: "vs/workbench/contrib/debug/node/telemetryApp"
          }
        }
      );
      const channel = client.getChannel("telemetryAppender");
      const appenders = [
        new TelemetryAppenderClient(channel),
        new TelemetryLogAppender(`[${endpoint.id}] `, false, this.loggerService, this.environmentService, this.productService)
      ];
      this.customTelemetryServices.set(endpoint.id, new TelemetryService({
        appenders,
        sendErrorTelemetry: endpoint.sendErrorTelemetry
      }, this.configurationService, this.productService));
    }
    return this.customTelemetryServices.get(endpoint.id);
  }
  publicLog(telemetryEndpoint, eventName, data) {
    const customTelemetryService = this.getCustomTelemetryService(telemetryEndpoint);
    customTelemetryService.publicLog(eventName, data);
  }
  publicLogError(telemetryEndpoint, errorEventName, data) {
    const customTelemetryService = this.getCustomTelemetryService(telemetryEndpoint);
    customTelemetryService.publicLogError(errorEventName, data);
  }
};
CustomEndpointTelemetryService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, ILoggerService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, IProductService)
], CustomEndpointTelemetryService);
export {
  CustomEndpointTelemetryService
};
