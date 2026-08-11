import { multiplexProperties } from "./agentHostRestrictedTelemetry.js";
var TelemetryDestination = /* @__PURE__ */ ((TelemetryDestination2) => {
  TelemetryDestination2[TelemetryDestination2["EnhancedGH"] = 1] = "EnhancedGH";
  TelemetryDestination2[TelemetryDestination2["InternalMSFT"] = 2] = "InternalMSFT";
  return TelemetryDestination2;
})(TelemetryDestination || {});
const targetDestinations = /* @__PURE__ */ new Map([
  ["engine.messages", 1 /* EnhancedGH */],
  ["engine.messages.length", 1 /* EnhancedGH */ | 2 /* InternalMSFT */],
  ["conversation.repetition.detected", 1 /* EnhancedGH */],
  ["model.message.added", 2 /* InternalMSFT */],
  ["model.modelCall.input", 2 /* InternalMSFT */],
  ["model.modelCall.output", 2 /* InternalMSFT */],
  ["model.request.added", 2 /* InternalMSFT */],
  ["model.request.options.added", 2 /* InternalMSFT */]
]);
class AgentHostGitHubTelemetryRouter {
  constructor(_telemetryService) {
    this._telemetryService = _telemetryService;
  }
  isTarget(notification) {
    return targetDestinations.has(notification.event.kind);
  }
  async route(notification, context, additionalProperties) {
    const { event } = notification;
    const eventName = event.kind;
    const destinations = targetDestinations.get(eventName);
    if (destinations === void 0) {
      return false;
    }
    if (!notification.restricted) {
      return true;
    }
    if (!context) {
      return true;
    }
    const properties = {
      ...event.properties,
      ...event.model_call_id && event.properties.modelCallId === void 0 ? { modelCallId: event.model_call_id } : {},
      ...additionalProperties
    };
    const multiplexedProperties = await multiplexProperties(properties);
    if (destinations & 1 /* EnhancedGH */ && context.restrictedTelemetryEnabled) {
      this._telemetryService.sendEnhancedGHTelemetryEventForContext(context, eventName, multiplexedProperties, event.metrics);
    }
    if (destinations & 2 /* InternalMSFT */ && context.isInternal) {
      this._telemetryService.sendInternalMSFTTelemetryEventForContext(context, eventName, multiplexedProperties, event.metrics);
    }
    return true;
  }
}
export {
  AgentHostGitHubTelemetryRouter
};
