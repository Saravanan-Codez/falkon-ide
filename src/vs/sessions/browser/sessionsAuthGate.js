import { Event } from "../../base/common/event.js";
import { observableFromEvent } from "../../base/common/observable.js";
import { AgentHostAllowSignedOutWhenUsableSettingId } from "../../platform/agentHost/common/agentService.js";
import { SessionTypeAuthRequirement } from "../services/sessions/common/session.js";
function isAllowSignedOutWhenUsableEnabled(configurationService) {
  return configurationService.getValue(AgentHostAllowSignedOutWhenUsableSettingId) === true;
}
var ConditionalAuthState = /* @__PURE__ */ ((ConditionalAuthState2) => {
  ConditionalAuthState2[ConditionalAuthState2["Unresolved"] = 0] = "Unresolved";
  ConditionalAuthState2[ConditionalAuthState2["SignedIn"] = 1] = "SignedIn";
  ConditionalAuthState2[ConditionalAuthState2["SignedOut"] = 2] = "SignedOut";
  return ConditionalAuthState2;
})(ConditionalAuthState || {});
function conditionalAuthState(accountResolved, signedIn) {
  if (!accountResolved) {
    return 0 /* Unresolved */;
  }
  return signedIn ? 1 /* SignedIn */ : 2 /* SignedOut */;
}
function observeUsableWithoutGitHub(sessionsManagementService, configurationService) {
  return observableFromEvent(
    Event.any(
      Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(AgentHostAllowSignedOutWhenUsableSettingId)),
      sessionsManagementService.onDidChangeSessionTypes
    ),
    () => isAllowSignedOutWhenUsableEnabled(configurationService) && sessionsManagementService.getAllProviderSessionTypes().some((type) => type.sessionType.authRequirement === SessionTypeAuthRequirement.None)
  );
}
function shouldShowDiscoveredConfigNudge(context) {
  return !context.signedIn && context.allowSignedOutWhenUsable && context.usableWithoutGitHub && !context.muted;
}
export {
  ConditionalAuthState,
  conditionalAuthState,
  isAllowSignedOutWhenUsableEnabled,
  observeUsableWithoutGitHub,
  shouldShowDiscoveredConfigNudge
};
