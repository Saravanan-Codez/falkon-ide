import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { localize } from "../../../../../nls.js";
import { ChatEntitlement } from "../../../../services/chat/common/chatEntitlementService.js";
var SessionTypeAvailability = /* @__PURE__ */ ((SessionTypeAvailability2) => {
  SessionTypeAvailability2[SessionTypeAvailability2["Available"] = 0] = "Available";
  SessionTypeAvailability2[SessionTypeAvailability2["SignInRequired"] = 1] = "SignInRequired";
  SessionTypeAvailability2[SessionTypeAvailability2["UpgradeRequired"] = 2] = "UpgradeRequired";
  SessionTypeAvailability2[SessionTypeAvailability2["NoModels"] = 3] = "NoModels";
  return SessionTypeAvailability2;
})(SessionTypeAvailability || {});
function getSessionTypeAvailability(chatSessionsService, chatEntitlementService, languageModelsService, type) {
  if (!chatSessionsService.getChatSessionContribution(type)) {
    return 0 /* Available */;
  }
  const entitlement = chatEntitlementService.entitlement;
  if (entitlement === ChatEntitlement.Unknown && !chatEntitlementService.anonymous && chatSessionsService.requiresCopilotSignInForSessionType(type)) {
    return 1 /* SignInRequired */;
  }
  if (hasModelsTargetingSessionType(languageModelsService, type) || chatSessionsService.supportsAutoModelForSessionType(type)) {
    return 0 /* Available */;
  }
  const canUpgrade = entitlement === ChatEntitlement.Free || entitlement === ChatEntitlement.EDU;
  if (canUpgrade) {
    return 2 /* UpgradeRequired */;
  }
  return chatSessionsService.requiresCustomModelsForSessionType(type) ? 3 /* NoModels */ : 0 /* Available */;
}
function hasModelsTargetingSessionType(languageModelsService, type) {
  return languageModelsService.getLanguageModelIds().some((id) => {
    const metadata = languageModelsService.lookupLanguageModel(id);
    return metadata?.targetChatSessionType === type;
  });
}
function getSessionTypeUnavailableDescription(availability) {
  switch (availability) {
    case 1 /* SignInRequired */:
      return new MarkdownString(
        localize("chat.sessionType.signInLink", "[Sign in](command:workbench.action.chat.triggerSetup)"),
        { isTrusted: { enabledCommands: ["workbench.action.chat.triggerSetup"] } }
      );
    case 2 /* UpgradeRequired */:
      return new MarkdownString(
        localize("chat.sessionType.upgradeLink", "[Upgrade](command:workbench.action.chat.upgradePlan)"),
        { isTrusted: { enabledCommands: ["workbench.action.chat.upgradePlan"] } }
      );
    case 3 /* NoModels */:
      return new MarkdownString(localize("chat.sessionType.noModels", "No models available"));
    default:
      return void 0;
  }
}
function getSessionTypeUnavailableHover(availability) {
  switch (availability) {
    case 1 /* SignInRequired */: {
      const hover = new MarkdownString("", { isTrusted: { enabledCommands: ["workbench.action.chat.triggerSetup"] }, supportThemeIcons: true });
      hover.appendMarkdown(localize("chat.sessionType.signInHover", "[Sign in to GitHub Copilot](command:workbench.action.chat.triggerSetup) to use this agent."));
      return hover;
    }
    case 2 /* UpgradeRequired */: {
      const hover = new MarkdownString("", { isTrusted: { enabledCommands: ["workbench.action.chat.upgradePlan"] }, supportThemeIcons: true });
      hover.appendMarkdown(localize("chat.sessionType.upgradeHover", "[Upgrade to GitHub Copilot Pro](command:workbench.action.chat.upgradePlan) to use this agent."));
      return hover;
    }
    case 3 /* NoModels */:
      return new MarkdownString(localize("chat.sessionType.noModelsHover", "No models are available for this agent."));
    default:
      return void 0;
  }
}
function getSessionTypeUnavailableLabel(availability) {
  switch (availability) {
    case 1 /* SignInRequired */:
      return localize("chat.sessionType.signInMobile", "Requires sign in");
    case 2 /* UpgradeRequired */:
      return localize("chat.sessionType.upgradeMobile", "Requires GitHub Copilot Pro");
    case 3 /* NoModels */:
      return localize("chat.sessionType.noModels", "No models available");
    default:
      return void 0;
  }
}
export {
  SessionTypeAvailability,
  getSessionTypeAvailability,
  getSessionTypeUnavailableDescription,
  getSessionTypeUnavailableHover,
  getSessionTypeUnavailableLabel
};
