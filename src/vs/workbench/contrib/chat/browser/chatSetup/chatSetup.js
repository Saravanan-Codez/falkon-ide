import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import product from "../../../../../platform/product/common/product.js";
import { localize } from "../../../../../nls.js";
import { EnablementState } from "../../../../services/extensionManagement/common/extensionManagement.js";
const defaultChat = {
  chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? "",
  chatRefreshTokenCommand: product.defaultChatAgent?.chatRefreshTokenCommand ?? "",
  providerExtensionId: product.defaultChatAgent?.providerExtensionId ?? ""
};
var ChatSetupAnonymous = /* @__PURE__ */ ((ChatSetupAnonymous2) => {
  ChatSetupAnonymous2[ChatSetupAnonymous2["Disabled"] = 0] = "Disabled";
  ChatSetupAnonymous2[ChatSetupAnonymous2["EnabledWithDialog"] = 1] = "EnabledWithDialog";
  ChatSetupAnonymous2[ChatSetupAnonymous2["EnabledWithoutDialog"] = 2] = "EnabledWithoutDialog";
  return ChatSetupAnonymous2;
})(ChatSetupAnonymous || {});
var ChatSetupStep = /* @__PURE__ */ ((ChatSetupStep2) => {
  ChatSetupStep2[ChatSetupStep2["Initial"] = 1] = "Initial";
  ChatSetupStep2[ChatSetupStep2["SigningIn"] = 2] = "SigningIn";
  ChatSetupStep2[ChatSetupStep2["Installing"] = 3] = "Installing";
  return ChatSetupStep2;
})(ChatSetupStep || {});
var ChatSetupStrategy = /* @__PURE__ */ ((ChatSetupStrategy2) => {
  ChatSetupStrategy2[ChatSetupStrategy2["Canceled"] = 0] = "Canceled";
  ChatSetupStrategy2[ChatSetupStrategy2["DefaultSetup"] = 1] = "DefaultSetup";
  ChatSetupStrategy2[ChatSetupStrategy2["SetupWithoutEnterpriseProvider"] = 2] = "SetupWithoutEnterpriseProvider";
  ChatSetupStrategy2[ChatSetupStrategy2["SetupWithEnterpriseProvider"] = 3] = "SetupWithEnterpriseProvider";
  ChatSetupStrategy2[ChatSetupStrategy2["SetupWithGoogleProvider"] = 4] = "SetupWithGoogleProvider";
  ChatSetupStrategy2[ChatSetupStrategy2["SetupWithAppleProvider"] = 5] = "SetupWithAppleProvider";
  return ChatSetupStrategy2;
})(ChatSetupStrategy || {});
class ChatSetupError extends Error {
  constructor(originalError, userNotified) {
    super(originalError.message, { cause: originalError });
    this.originalError = originalError;
    this.userNotified = userNotified;
    this.name = originalError.name;
  }
}
function refreshTokens(commandService) {
  commandService.executeCommand(defaultChat.chatRefreshTokenCommand).catch(() => {
  });
}
function buildUpgradeUrlWithRedirect(baseUpgradeUrl, urlProtocol, quality) {
  const vscodeUri = `${urlProtocol}://${defaultChat.chatExtensionId}/upgrade-success`;
  const redirectHost = quality === "stable" ? "vscode.dev" : "insiders.vscode.dev";
  const returnTo = `https://${redirectHost}/redirect?url=${encodeURIComponent(vscodeUri)}`;
  const separator = baseUpgradeUrl.includes("?") ? "&" : "?";
  return `${baseUpgradeUrl}${separator}return_to=${encodeURIComponent(returnTo)}`;
}
async function maybeEnableAuthExtension(extensionsWorkbenchService, logService) {
  if (!defaultChat.providerExtensionId) {
    return false;
  }
  const providerExtension = extensionsWorkbenchService.local.find(
    (e) => ExtensionIdentifier.equals(e.identifier.id, defaultChat.providerExtensionId)
  );
  if (!providerExtension) {
    return false;
  }
  if (providerExtension.enablementState === EnablementState.DisabledGlobally || providerExtension.enablementState === EnablementState.DisabledWorkspace) {
    logService.info(`[chat setup] auth provider extension '${defaultChat.providerExtensionId}' is disabled, re-enabling it`);
    try {
      await extensionsWorkbenchService.setEnablement([providerExtension], EnablementState.EnabledGlobally);
      await extensionsWorkbenchService.updateRunningExtensions(localize("enableAuthExtension", "Enabling GitHub Authentication"));
      return true;
    } catch (error) {
      logService.error(`[chat setup] failed to re-enable auth provider extension '${defaultChat.providerExtensionId}'`, error);
      return false;
    }
  }
  return false;
}
export {
  ChatSetupAnonymous,
  ChatSetupError,
  ChatSetupStep,
  ChatSetupStrategy,
  buildUpgradeUrlWithRedirect,
  maybeEnableAuthExtension,
  refreshTokens
};
