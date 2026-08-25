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
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { CommandsRegistry } from "../../../platform/commands/common/commands.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
import { IProductService } from "../../../platform/product/common/productService.js";
import { ITelemetryService, TelemetryLevel, TELEMETRY_OLD_SETTING_ID, TELEMETRY_SETTING_ID } from "../../../platform/telemetry/common/telemetry.js";
import { supportsTelemetry } from "../../../platform/telemetry/common/telemetryUtils.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
let MainThreadTelemetry = class extends Disposable {
  constructor(extHostContext, _telemetryService, _configurationService, _environmentService, _productService) {
    super();
    this._telemetryService = _telemetryService;
    this._configurationService = _configurationService;
    this._environmentService = _environmentService;
    this._productService = _productService;
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostTelemetry);
    if (supportsTelemetry(this._productService, this._environmentService)) {
      this._register(this._configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(TELEMETRY_SETTING_ID) || e.affectsConfiguration(TELEMETRY_OLD_SETTING_ID)) {
          this._proxy.$onDidChangeTelemetryLevel(this.telemetryLevel);
        }
      }));
    }
    this._proxy.$initializeTelemetryLevel(this.telemetryLevel, supportsTelemetry(this._productService, this._environmentService), this._productService.enabledTelemetryLevels);
  }
  get telemetryLevel() {
    if (!supportsTelemetry(this._productService, this._environmentService)) {
      return TelemetryLevel.NONE;
    }
    return this._telemetryService.telemetryLevel;
  }
  $publicLog(eventName, data = /* @__PURE__ */ Object.create(null)) {
    data[MainThreadTelemetry._name] = true;
    this._telemetryService.publicLog(eventName, data);
  }
  $publicLog2(eventName, data) {
    this.$publicLog(eventName, data);
  }
};
MainThreadTelemetry._name = "pluginHostTelemetry";
MainThreadTelemetry = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadTelemetry),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, IProductService)
], MainThreadTelemetry);
const CAPI_ASSIGNMENT_CONTEXT_PROPERTY = "capi.assignmentcontext";
const SET_CAPI_ASSIGNMENT_CONTEXT_COMMAND = "_telemetry.setCapiAssignmentContext";
const MAX_CAPI_ASSIGNMENT_CONTEXT_LENGTH = 8 * 1024;
const CAPI_ASSIGNMENT_CONTEXT_ENTRY_PATTERN = /^[^:;\s\x00-\x1F\x7F]+:[^;\x00-\x1F\x7F]+$/;
function isValidCapiAssignmentContext(value) {
  if (value.length === 0 || value.length > MAX_CAPI_ASSIGNMENT_CONTEXT_LENGTH) {
    return false;
  }
  const entries = value.endsWith(";") ? value.slice(0, -1).split(";") : value.split(";");
  return entries.length > 0 && entries.every((entry) => CAPI_ASSIGNMENT_CONTEXT_ENTRY_PATTERN.test(entry));
}
CommandsRegistry.registerCommand(SET_CAPI_ASSIGNMENT_CONTEXT_COMMAND, function(accessor, value) {
  if (typeof value !== "string" || !isValidCapiAssignmentContext(value)) {
    return;
  }
  accessor.get(ITelemetryService).setExperimentProperty(CAPI_ASSIGNMENT_CONTEXT_PROPERTY, value);
});
export {
  CAPI_ASSIGNMENT_CONTEXT_PROPERTY,
  MainThreadTelemetry,
  SET_CAPI_ASSIGNMENT_CONTEXT_COMMAND,
  isValidCapiAssignmentContext
};
