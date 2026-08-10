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
import { ITelemetryService } from "../../../telemetry/common/telemetry.js";
let CopilotGitHubTelemetryForwarder = class {
  constructor(_isRestrictedTelemetryEnabled, _telemetryService) {
    this._isRestrictedTelemetryEnabled = _isRestrictedTelemetryEnabled;
    this._telemetryService = _telemetryService;
  }
  forward(notification) {
    if (notification.restricted && !this._isRestrictedTelemetryEnabled()) {
      return;
    }
    const event = notification.event;
    const data = {
      ...event.client,
      ...event.properties,
      ...event.metrics,
      created_at: event.created_at,
      model_call_id: event.model_call_id,
      exp_assignment_context: event.exp_assignment_context,
      session_id: event.session_id ?? notification.sessionId,
      sdk_session_id: notification.sessionId,
      copilot_tracking_id: event.copilot_tracking_id,
      kind: event.kind,
      restricted: notification.restricted
    };
    if (event.features) {
      for (const [key, value] of Object.entries(event.features)) {
        if (value !== void 0) {
          data[`feature.${key}`] = value;
        }
      }
    }
    this._telemetryService.publicLog(`copilotCli/${event.kind}`, data);
  }
};
CopilotGitHubTelemetryForwarder = __decorateClass([
  __decorateParam(1, ITelemetryService)
], CopilotGitHubTelemetryForwarder);
export {
  CopilotGitHubTelemetryForwarder
};
