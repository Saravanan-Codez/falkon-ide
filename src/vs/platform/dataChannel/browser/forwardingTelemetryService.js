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
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IDataChannelService } from "../common/dataChannel.js";
class InterceptingTelemetryService {
  constructor(_baseService, _intercept) {
    this._baseService = _baseService;
    this._intercept = _intercept;
  }
  get telemetryLevel() {
    return this._baseService.telemetryLevel;
  }
  get sessionId() {
    return this._baseService.sessionId;
  }
  get machineId() {
    return this._baseService.machineId;
  }
  get sqmId() {
    return this._baseService.sqmId;
  }
  get devDeviceId() {
    return this._baseService.devDeviceId;
  }
  get firstSessionDate() {
    return this._baseService.firstSessionDate;
  }
  get msftInternal() {
    return this._baseService.msftInternal;
  }
  get sendErrorTelemetry() {
    return this._baseService.sendErrorTelemetry;
  }
  publicLog(eventName, data) {
    this._intercept(eventName, data);
    this._baseService.publicLog(eventName, data);
  }
  publicLog2(eventName, data) {
    this._intercept(eventName, data);
    this._baseService.publicLog2(eventName, data);
  }
  publicLogError(errorEventName, data) {
    this._intercept(errorEventName, data);
    this._baseService.publicLogError(errorEventName, data);
  }
  publicLogError2(eventName, data) {
    this._intercept(eventName, data);
    this._baseService.publicLogError2(eventName, data);
  }
  setExperimentProperty(name, value) {
    this._baseService.setExperimentProperty(name, value);
  }
  setCommonProperty(name, value) {
    this._baseService.setCommonProperty(name, value);
  }
}
let DataChannelForwardingTelemetryService = class extends InterceptingTelemetryService {
  constructor(telemetryService, dataChannelService) {
    super(telemetryService, (eventName, data) => {
      let forward = true;
      if (data && shouldForwardToChannel in data) {
        forward = Boolean(data[shouldForwardToChannel]);
      }
      if (forward) {
        dataChannelService.getDataChannel("editTelemetry").sendData({ eventName, data: data ?? {} });
      }
    });
  }
};
DataChannelForwardingTelemetryService = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IDataChannelService)
], DataChannelForwardingTelemetryService);
const shouldForwardToChannel = /* @__PURE__ */ Symbol("shouldForwardToChannel");
function forwardToChannelIf(value) {
  return {
    // This will not be sent via telemetry, it is just a marker
    [shouldForwardToChannel]: value
  };
}
function isCopilotLikeExtension(extensionId) {
  if (!extensionId) {
    return false;
  }
  const extIdLowerCase = extensionId.toLowerCase();
  return extIdLowerCase === "github.copilot" || extIdLowerCase === "github.copilot-chat";
}
export {
  DataChannelForwardingTelemetryService,
  InterceptingTelemetryService,
  forwardToChannelIf,
  isCopilotLikeExtension
};
