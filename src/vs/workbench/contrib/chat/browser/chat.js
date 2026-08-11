import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { CHAT_PROVIDER_ID } from "../common/participants/chatParticipantContribTypes.js";
import { ChatOutline } from "./chatOutline.js";
const IChatWidgetService = createDecorator("chatWidgetService");
const ChatViewPaneTarget = /* @__PURE__ */ Symbol("ChatViewPaneTarget");
const IQuickChatService = createDecorator("quickChatService");
const IChatAccessibilityService = createDecorator("chatAccessibilityService");
function isIChatViewViewContext(context) {
  return typeof context.viewId === "string";
}
function isIChatResourceViewContext(context) {
  return !isIChatViewViewContext(context);
}
const CHAT_WIDGET_VIEW_STATE_CACHE_LIMIT = 100;
function setModelPreservingInputTypedWhileLoading(widget, inputBeforeLoad, setModel) {
  const typedWhileLoading = widget.getInput();
  setModel();
  if (typedWhileLoading && typedWhileLoading !== inputBeforeLoad && !widget.getInput()) {
    widget.setInput(typedWhileLoading);
  }
}
const IChatCodeBlockContextProviderService = createDecorator("chatCodeBlockContextProviderService");
const ChatViewId = `workbench.panel.chat.view.${CHAT_PROVIDER_ID}`;
const ChatViewContainerId = "workbench.panel.chat";
const HasInstalledAgentPluginsContext = new RawContextKey("hasInstalledAgentPlugins", false);
const InstalledAgentPluginsViewId = "workbench.views.agentPlugins.installed";
const UpdateAgentPluginsCommandId = "workbench.agentPlugins.checkForUpdates";
const ForceUpdateAgentPluginsCommandId = "workbench.agentPlugins.forceUpdate";
const RefreshAgentPluginMarketplacesCommandId = "workbench.agentPlugins.refreshMarketplaces";
const UpdatingAgentPluginsContext = new RawContextKey("agentPluginsUpdating", false);
export {
  CHAT_WIDGET_VIEW_STATE_CACHE_LIMIT,
  ChatOutline,
  ChatViewContainerId,
  ChatViewId,
  ChatViewPaneTarget,
  ForceUpdateAgentPluginsCommandId,
  HasInstalledAgentPluginsContext,
  IChatAccessibilityService,
  IChatCodeBlockContextProviderService,
  IChatWidgetService,
  IQuickChatService,
  InstalledAgentPluginsViewId,
  RefreshAgentPluginMarketplacesCommandId,
  UpdateAgentPluginsCommandId,
  UpdatingAgentPluginsContext,
  isIChatResourceViewContext,
  isIChatViewViewContext,
  setModelPreservingInputTypedWhileLoading
};
