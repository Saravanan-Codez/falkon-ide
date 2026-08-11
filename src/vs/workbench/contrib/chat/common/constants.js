import { Schemas } from "../../../../base/common/network.js";
import { IChatSessionsService, isAgentHostTarget, localChatSessionType, SessionType } from "./chatSessionsService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { isVirtualWorkspace } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { ContextKeyExpr, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { ChatEntitlementContextKeys } from "../../../services/chat/common/chatEntitlementService.js";
import { IsAuxiliaryWindowContext, IsSessionsWindowContext } from "../../../common/contextkeys.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { LocalChatSessionUri } from "./model/chatUri.js";
import { clearUserSelectedSessionType, getRememberedSessionType, hasPreferredCopilotHarness, storeUserSelectedSessionType } from "./chatSessionTypePreference.js";
import { IAgentHostEnablementService } from "../../../../platform/agentHost/common/agentHostEnablementService.js";
import { ChatAIDisabledSettingId } from "../../../../platform/chat/common/chatSettings.js";
var BYOKUtilityModelDefault = /* @__PURE__ */ ((BYOKUtilityModelDefault2) => {
  BYOKUtilityModelDefault2["None"] = "none";
  BYOKUtilityModelDefault2["MainAgent"] = "mainAgent";
  BYOKUtilityModelDefault2["Copilot"] = "copilot";
  return BYOKUtilityModelDefault2;
})(BYOKUtilityModelDefault || {});
var ChatConfiguration = /* @__PURE__ */ ((ChatConfiguration2) => {
  ChatConfiguration2["PluginsEnabled"] = "chat.plugins.enabled";
  ChatConfiguration2["PluginLocations"] = "chat.pluginLocations";
  ChatConfiguration2["PluginMarketplaces"] = "chat.plugins.marketplaces";
  ChatConfiguration2["ExtraMarketplaces"] = "chat.plugins.extraMarketplaces";
  ChatConfiguration2["StrictMarketplaces"] = "chat.plugins.strictMarketplaces";
  ChatConfiguration2["EnabledPlugins"] = "chat.plugins.enabledPlugins";
  ChatConfiguration2["AgentEnabled"] = "chat.agent.enabled";
  ChatConfiguration2["PlanAgentDefaultModel"] = "chat.planAgent.defaultModel";
  ChatConfiguration2["ExploreAgentDefaultModel"] = "chat.exploreAgent.defaultModel";
  ChatConfiguration2["UtilityModel"] = "chat.utilityModel";
  ChatConfiguration2["UtilitySmallModel"] = "chat.utilitySmallModel";
  ChatConfiguration2["BYOKUtilityModelDefault"] = "chat.byokUtilityModelDefault";
  ChatConfiguration2["RequestQueueingDefaultAction"] = "chat.requestQueuing.defaultAction";
  ChatConfiguration2["AgentStatusEnabled"] = "chat.agentsControl.enabled";
  ChatConfiguration2["EditorAssociations"] = "chat.editorAssociations";
  ChatConfiguration2["UnifiedAgentsBar"] = "chat.unifiedAgentsBar.enabled";
  ChatConfiguration2["AgentSessionProjectionEnabled"] = "chat.agentSessionProjection.enabled";
  ChatConfiguration2["MigrateLegacyCopilotCliSessions"] = "chat.agentSessions.migrateLegacyCopilotCli";
  ChatConfiguration2["ExtensionToolsEnabled"] = "chat.extensionTools.enabled";
  ChatConfiguration2["RepoInfoEnabled"] = "chat.repoInfo.enabled";
  ChatConfiguration2["EditRequests"] = "chat.editRequests";
  ChatConfiguration2["InlineReferencesStyle"] = "chat.inlineReferences.style";
  ChatConfiguration2["AutoReply"] = "chat.autoReply";
  ChatConfiguration2["GlobalAutoApprove"] = "chat.tools.global.autoApprove";
  ChatConfiguration2["AutoApproveEdits"] = "chat.tools.edits.autoApprove";
  ChatConfiguration2["AutoApprovedUrls"] = "chat.tools.urls.autoApprove";
  ChatConfiguration2["EligibleForAutoApproval"] = "chat.tools.eligibleForAutoApproval";
  ChatConfiguration2["EnableMath"] = "chat.math.enabled";
  ChatConfiguration2["CheckpointsEnabled"] = "chat.checkpoints.enabled";
  ChatConfiguration2["ThinkingStyle"] = "chat.agent.thinkingStyle";
  ChatConfiguration2["ThinkingGenerateTitles"] = "chat.agent.thinking.generateTitles";
  ChatConfiguration2["TerminalToolsInThinking"] = "chat.agent.thinking.terminalTools";
  ChatConfiguration2["CollapseCompletedResponses"] = "chat.agent.collapseCompletedResponses";
  ChatConfiguration2["SimpleTerminalCollapsible"] = "chat.tools.terminal.simpleCollapsible";
  ChatConfiguration2["CompressOutputEnabled"] = "chat.tools.compressOutput.enabled";
  ChatConfiguration2["ThinkingPhrases"] = "chat.agent.thinking.phrases";
  ChatConfiguration2["AutoExpandToolFailures"] = "chat.tools.autoExpandFailures";
  ChatConfiguration2["TodosShowWidget"] = "chat.tools.todos.showWidget";
  ChatConfiguration2["NotifyWindowOnConfirmation"] = "chat.notifyWindowOnConfirmation";
  ChatConfiguration2["NotifyWindowOnResponseReceived"] = "chat.notifyWindowOnResponseReceived";
  ChatConfiguration2["ChatViewSessionsEnabled"] = "chat.viewSessions.enabled";
  ChatConfiguration2["SessionSyncEnabled"] = "chat.sessionSync.enabled";
  ChatConfiguration2["SessionSyncExcludeRepositories"] = "chat.sessionSync.excludeRepositories";
  ChatConfiguration2["ChatViewSessionsGrouping"] = "chat.viewSessions.grouping";
  ChatConfiguration2["ChatViewSessionsOrientation"] = "chat.viewSessions.orientation";
  ChatConfiguration2["ChatViewProgressBadgeEnabled"] = "chat.viewProgressBadge.enabled";
  ChatConfiguration2["ChatContextUsageEnabled"] = "chat.contextUsage.enabled";
  ChatConfiguration2["Verbose"] = "chat.verbose";
  ChatConfiguration2["ProgressBorder"] = "chat.progressBorder.enabled";
  ChatConfiguration2["SubagentToolCustomAgents"] = "chat.customAgentInSubagent.enabled";
  ChatConfiguration2["SubagentsAllowInvocationsFromSubagents"] = "chat.subagents.allowInvocationsFromSubagents";
  ChatConfiguration2["SubagentsUseRichRendering"] = "chat.subagents.useRichRendering";
  ChatConfiguration2["ShowCodeBlockProgressAnimation"] = "chat.agent.codeBlockProgress";
  ChatConfiguration2["RestoreLastPanelSession"] = "chat.restoreLastPanelSession";
  ChatConfiguration2["ExitAfterDelegation"] = "chat.exitAfterDelegation";
  ChatConfiguration2["ExplainChangesEnabled"] = "chat.editing.explainChanges.enabled";
  ChatConfiguration2["RevealNextChangeOnResolve"] = "chat.editing.revealNextChangeOnResolve";
  ChatConfiguration2["OpenChangedFileInDiffEditor"] = "chat.editing.openChangedFileInDiffEditor";
  ChatConfiguration2["GrowthNotificationEnabled"] = "chat.growthNotification.enabled";
  ChatConfiguration2["TitleBarSignInEnabled"] = "chat.titleBar.signIn.enabled";
  ChatConfiguration2["TitleBarOpenInAgentsWindowEnabled"] = "chat.titleBar.openInAgentsWindow.enabled";
  ChatConfiguration2["ChatCustomizationsStructuredPreviewEnabled"] = "chat.customizations.structuredPreview.enabled";
  ChatConfiguration2["ChatCustomizationsPromptMigrationEnabled"] = "chat.customizations.promptMigration.enabled";
  ChatConfiguration2["AutopilotAdvancedEnabled"] = "chat.autopilot.advanced.enabled";
  ChatConfiguration2["DefaultPermissionLevel"] = "chat.permissions.default";
  ChatConfiguration2["AssistedPermissionsEnabled"] = "chat.assistedPermissions.enabled";
  ChatConfiguration2["PermissionsSandboxToggleEnabled"] = "chat.experimental.permissionsSandboxToggle.enabled";
  ChatConfiguration2["DefaultConfiguration"] = "chat.defaultConfiguration";
  ChatConfiguration2["DefaultModel"] = "chat.defaultModel";
  ChatConfiguration2["ImageCarouselEnabled"] = "imageCarousel.chat.enabled";
  ChatConfiguration2["ArtifactsEnabled"] = "chat.artifacts.enabled";
  ChatConfiguration2["ArtifactsRulesByMimeType"] = "chat.artifacts.rules.byMimeType";
  ChatConfiguration2["ArtifactsRulesByFilePath"] = "chat.artifacts.rules.byFilePath";
  ChatConfiguration2["ArtifactsRulesByMemoryFilePath"] = "chat.artifacts.rules.byMemoryFilePath";
  ChatConfiguration2["ToolConfirmationCarousel"] = "chat.tools.confirmationCarousel.enabled";
  ChatConfiguration2["ToolRiskAssessmentEnabled"] = "chat.tools.riskAssessment.enabled";
  ChatConfiguration2["ToolRiskAssessmentModel"] = "chat.tools.riskAssessment.model";
  ChatConfiguration2["DefaultNewSessionMode"] = "chat.newSession.defaultMode";
  ChatConfiguration2["EditorPreferCopilotHarness"] = "chat.editor.preferCopilotHarness";
  ChatConfiguration2["DefaultToCopilotHarness"] = "chat.defaultToCopilotHarness";
  ChatConfiguration2["EditorLocalAgentEnabled"] = "chat.editor.localAgent.enabled";
  ChatConfiguration2["AgentsHandoffTipMode"] = "chat.agentsHandoffTip.mode";
  ChatConfiguration2["TurnStatusPills"] = "chat.turnStatusPills";
  ChatConfiguration2["IncrementalRendering"] = "chat.experimental.incrementalRendering.enabled";
  ChatConfiguration2["IncrementalRenderingStyle"] = "chat.experimental.incrementalRendering.animationStyle";
  ChatConfiguration2["IncrementalRenderingBuffering"] = "chat.experimental.incrementalRendering.buffering";
  ChatConfiguration2["CollectInstructionsInExtension"] = "chat.experimental.collectInstructionsInExtension";
  ChatConfiguration2["ImplicitContextActiveEditor"] = "chat.implicitContext.includeActiveEditor";
  return ChatConfiguration2;
})(ChatConfiguration || {});
var ChatModeKind = /* @__PURE__ */ ((ChatModeKind2) => {
  ChatModeKind2["Ask"] = "ask";
  ChatModeKind2["Edit"] = "edit";
  ChatModeKind2["Agent"] = "agent";
  return ChatModeKind2;
})(ChatModeKind || {});
var ChatPermissionLevel = /* @__PURE__ */ ((ChatPermissionLevel2) => {
  ChatPermissionLevel2["Default"] = "default";
  ChatPermissionLevel2["Assisted"] = "assisted";
  ChatPermissionLevel2["AutoApprove"] = "autoApprove";
  ChatPermissionLevel2["Autopilot"] = "autopilot";
  return ChatPermissionLevel2;
})(ChatPermissionLevel || {});
const chatPermissionLevels = new Set(Object.values(ChatPermissionLevel));
function isChatPermissionLevel(level) {
  return chatPermissionLevels.has(level);
}
var ChatDefaultPermissionLevel = /* @__PURE__ */ ((ChatDefaultPermissionLevel2) => {
  ChatDefaultPermissionLevel2["Default"] = "default";
  ChatDefaultPermissionLevel2["Assisted"] = "assisted";
  ChatDefaultPermissionLevel2["AllowAll"] = "allowAll";
  return ChatDefaultPermissionLevel2;
})(ChatDefaultPermissionLevel || {});
function getChatPermissionLevelFromDefaultConfiguration(value) {
  switch (value) {
    case "default" /* Default */:
      return "default" /* Default */;
    case "assisted" /* Assisted */:
      return "assisted" /* Assisted */;
    case "allowAll" /* AllowAll */:
    case "autoApprove" /* AutoApprove */:
      return "autoApprove" /* AutoApprove */;
    default:
      return void 0;
  }
}
function isAutoApproveLevel(level) {
  return level === "autoApprove" /* AutoApprove */ || level === "autopilot" /* Autopilot */;
}
function isAutopilotLevel(level) {
  return level === "autopilot" /* Autopilot */;
}
var ThinkingDisplayMode = /* @__PURE__ */ ((ThinkingDisplayMode2) => {
  ThinkingDisplayMode2["Collapsed"] = "collapsed";
  ThinkingDisplayMode2["CollapsedPreview"] = "collapsedPreview";
  ThinkingDisplayMode2["FixedScrolling"] = "fixedScrolling";
  return ThinkingDisplayMode2;
})(ThinkingDisplayMode || {});
var CollapsedToolsDisplayMode = /* @__PURE__ */ ((CollapsedToolsDisplayMode2) => {
  CollapsedToolsDisplayMode2["Off"] = "off";
  CollapsedToolsDisplayMode2["WithThinking"] = "withThinking";
  CollapsedToolsDisplayMode2["Always"] = "always";
  return CollapsedToolsDisplayMode2;
})(CollapsedToolsDisplayMode || {});
var ChatNotificationMode = /* @__PURE__ */ ((ChatNotificationMode2) => {
  ChatNotificationMode2["Off"] = "off";
  ChatNotificationMode2["WindowNotFocused"] = "windowNotFocused";
  ChatNotificationMode2["Always"] = "always";
  return ChatNotificationMode2;
})(ChatNotificationMode || {});
var ChatAgentLocation = /* @__PURE__ */ ((ChatAgentLocation2) => {
  ChatAgentLocation2["Chat"] = "panel";
  ChatAgentLocation2["Terminal"] = "terminal";
  ChatAgentLocation2["Notebook"] = "notebook";
  ChatAgentLocation2["EditorInline"] = "editor";
  return ChatAgentLocation2;
})(ChatAgentLocation || {});
((ChatAgentLocation2) => {
  function fromRaw(value) {
    switch (value) {
      case "panel":
        return "panel" /* Chat */;
      case "terminal":
        return "terminal" /* Terminal */;
      case "notebook":
        return "notebook" /* Notebook */;
      case "editor":
        return "editor" /* EditorInline */;
    }
    return "panel" /* Chat */;
  }
  ChatAgentLocation2.fromRaw = fromRaw;
})(ChatAgentLocation || (ChatAgentLocation = {}));
const chatAlwaysUnsupportedFileSchemes = /* @__PURE__ */ new Set([
  Schemas.vscodeChatEditor,
  Schemas.walkThrough,
  Schemas.vscodeLocalChatSession,
  Schemas.vscodeSettings,
  Schemas.webviewPanel,
  Schemas.vscodeUserData,
  Schemas.extension,
  "ccreq",
  "openai-codex"
  // Codex session custom editor scheme
]);
function isSupportedChatFileScheme(accessor, scheme) {
  const chatService = accessor.get(IChatSessionsService);
  if (chatAlwaysUnsupportedFileSchemes.has(scheme)) {
    return false;
  }
  if (chatService.getContentProviderSchemes().includes(scheme)) {
    return false;
  }
  return true;
}
function getComputedDefaultSessionType(configurationService, chatSessionsService, workspace, agentHostEnabled) {
  if (isVirtualWorkspace(workspace)) {
    return localChatSessionType;
  }
  if (agentHostEnabled && configurationService.getValue("chat.defaultToCopilotHarness" /* DefaultToCopilotHarness */)) {
    return SessionType.AgentHostCopilot;
  }
  if (isEditorLocalAgentEnabled(configurationService, workspace)) {
    return localChatSessionType;
  }
  return getVisibleNonLocalEditorChatSessionTypes(configurationService, chatSessionsService, workspace)[0] ?? localChatSessionType;
}
function getComputedDefaultSessionResource(configurationService, chatSessionsService, workspace, agentHostEnabled) {
  const defaultType = getComputedDefaultSessionType(configurationService, chatSessionsService, workspace, agentHostEnabled);
  return defaultType === localChatSessionType ? LocalChatSessionUri.getNewSessionUri() : URI.from({ scheme: defaultType, path: `/untitled-${generateUuid()}` });
}
function isNewChatSessionTypeUsable(sessionType, configurationService, chatSessionsService, workspace) {
  if (sessionType === localChatSessionType) {
    return isEditorLocalAgentEnabled(configurationService, workspace);
  }
  if (isAgentHostTarget(sessionType)) {
    return true;
  }
  return isVisibleEditorChatSessionType(sessionType, configurationService, chatSessionsService, workspace);
}
function getDefaultNewChatSessionType(configurationService, chatSessionsService, storageService, workspace, agentHostEnabled, options) {
  if (options?.explicitOverride) {
    return options.explicitOverride;
  }
  if (isVirtualWorkspace(workspace)) {
    return localChatSessionType;
  }
  const remembered = getUsableRememberedSessionType(storageService, configurationService, chatSessionsService, workspace);
  if (remembered) {
    return remembered;
  }
  if (options?.currentSessionType && isNewChatSessionTypeUsable(options.currentSessionType, configurationService, chatSessionsService, workspace)) {
    return options.currentSessionType;
  }
  return getComputedDefaultSessionType(configurationService, chatSessionsService, workspace, agentHostEnabled);
}
function resolveDefaultNewChatSessionType(accessor, options) {
  const configurationService = accessor.get(IConfigurationService);
  const chatSessionsService = accessor.get(IChatSessionsService);
  const storageService = accessor.get(IStorageService);
  const workspace = accessor.get(IWorkspaceContextService).getWorkspace();
  const agentHostEnabled = accessor.get(IAgentHostEnablementService).enabled.get();
  if (options?.explicitOverride) {
    return { sessionType: options.explicitOverride, isPreferCopilotHarnessSwap: false };
  }
  if (isVirtualWorkspace(workspace)) {
    return { sessionType: localChatSessionType, isPreferCopilotHarnessSwap: false };
  }
  const remembered = getUsableRememberedSessionType(storageService, configurationService, chatSessionsService, workspace);
  if (remembered && remembered !== localChatSessionType) {
    return { sessionType: remembered, isPreferCopilotHarnessSwap: false };
  }
  if (options?.currentSessionType === localChatSessionType && agentHostEnabled && configurationService.getValue("chat.editor.preferCopilotHarness" /* EditorPreferCopilotHarness */) && !hasPreferredCopilotHarness(storageService)) {
    return { sessionType: SessionType.AgentHostCopilot, isPreferCopilotHarnessSwap: true };
  }
  return { sessionType: getDefaultNewChatSessionType(configurationService, chatSessionsService, storageService, workspace, agentHostEnabled, options), isPreferCopilotHarnessSwap: false };
}
function getUsableRememberedSessionType(storageService, configurationService, chatSessionsService, workspace) {
  const remembered = getRememberedSessionType(storageService);
  return remembered && isNewChatSessionTypeUsable(remembered, configurationService, chatSessionsService, workspace) ? remembered : void 0;
}
function getDefaultNewChatSessionResource(configurationService, chatSessionsService, storageService, workspace, agentHostEnabled, options) {
  const defaultType = getDefaultNewChatSessionType(configurationService, chatSessionsService, storageService, workspace, agentHostEnabled, options);
  return defaultType === localChatSessionType ? LocalChatSessionUri.getNewSessionUri() : URI.from({ scheme: defaultType, path: `/untitled-${generateUuid()}` });
}
function recordUserSelectedSessionType(storageService, configurationService, chatSessionsService, workspace, sessionType, agentHostEnabled) {
  if (sessionType === getComputedDefaultSessionType(configurationService, chatSessionsService, workspace, agentHostEnabled)) {
    clearUserSelectedSessionType(storageService);
  } else {
    storeUserSelectedSessionType(storageService, sessionType);
  }
}
function isEditorLocalAgentEnabled(configurationService, workspace) {
  return isVirtualWorkspace(workspace) || (configurationService.getValue("chat.editor.localAgent.enabled" /* EditorLocalAgentEnabled */) ?? true);
}
function isVisibleEditorChatSessionType(sessionType, configurationService, chatSessionsService, workspace) {
  if (sessionType === localChatSessionType) {
    return isEditorLocalAgentEnabled(configurationService, workspace) || getVisibleNonLocalEditorChatSessionTypes(configurationService, chatSessionsService, workspace).length === 0;
  }
  if (sessionType === SessionType.CopilotCLI) {
    return false;
  }
  return !!chatSessionsService.getChatSessionContribution(sessionType);
}
function getVisibleNonLocalEditorChatSessionTypes(configurationService, chatSessionsService, workspace) {
  const sessionTypes = /* @__PURE__ */ new Set();
  for (const contribution of chatSessionsService.getAllChatSessionContributions()) {
    if (contribution.type !== localChatSessionType && isVisibleEditorChatSessionType(contribution.type, configurationService, chatSessionsService, workspace)) {
      sessionTypes.add(contribution.type);
    }
  }
  return Array.from(sessionTypes);
}
const MANAGE_CHAT_COMMAND_ID = "workbench.action.chat.manage";
const CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID = "workbench.action.chat.openAgentHostChat";
const CHAT_SUBAGENT_RESOURCE_QUERY_PARAM = "subagentChatResource";
const OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID = "workbench.action.openWorkspaceInAgentsWindow";
const OPEN_AGENTS_WINDOW_COMMAND_ID = "workbench.action.openAgentsWindow";
const OPEN_AGENTS_WINDOW_PRECONDITION = ContextKeyExpr.and(
  ChatEntitlementContextKeys.Setup.hidden.negate(),
  ChatEntitlementContextKeys.Setup.disabledInWorkspace.negate(),
  IsSessionsWindowContext.negate(),
  ContextKeyExpr.has(`config.${"chat.agent.enabled" /* AgentEnabled */}`),
  IsAuxiliaryWindowContext.negate()
);
const ChatEditorTitleMaxLength = 30;
const CHAT_TERMINAL_OUTPUT_MAX_PREVIEW_LINES = 1e3;
const CONTEXT_MODELS_EDITOR = new RawContextKey("inModelsEditor", false);
const CONTEXT_MODELS_SEARCH_FOCUS = new RawContextKey("inModelsSearch", false);
export {
  BYOKUtilityModelDefault,
  CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID,
  CHAT_SUBAGENT_RESOURCE_QUERY_PARAM,
  CHAT_TERMINAL_OUTPUT_MAX_PREVIEW_LINES,
  CONTEXT_MODELS_EDITOR,
  CONTEXT_MODELS_SEARCH_FOCUS,
  ChatAIDisabledSettingId,
  ChatAgentLocation,
  ChatConfiguration,
  ChatDefaultPermissionLevel,
  ChatEditorTitleMaxLength,
  ChatModeKind,
  ChatNotificationMode,
  ChatPermissionLevel,
  CollapsedToolsDisplayMode,
  MANAGE_CHAT_COMMAND_ID,
  OPEN_AGENTS_WINDOW_COMMAND_ID,
  OPEN_AGENTS_WINDOW_PRECONDITION,
  OPEN_WORKSPACE_IN_AGENTS_WINDOW_COMMAND_ID,
  ThinkingDisplayMode,
  getChatPermissionLevelFromDefaultConfiguration,
  getComputedDefaultSessionResource,
  getComputedDefaultSessionType,
  getDefaultNewChatSessionResource,
  getDefaultNewChatSessionType,
  isAutoApproveLevel,
  isAutopilotLevel,
  isChatPermissionLevel,
  isEditorLocalAgentEnabled,
  isNewChatSessionTypeUsable,
  isSupportedChatFileScheme,
  isVisibleEditorChatSessionType,
  recordUserSelectedSessionType,
  resolveDefaultNewChatSessionType
};
