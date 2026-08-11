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
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import { CancellationError } from "../../../../base/common/errors.js";
import { raceTimeout } from "../../../../base/common/async.js";
import { fetchResourceMetadata } from "../../../../base/common/oauth.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { basename, dirname, isAbsolute, join, normalize, resolve, sep } from "../../../../base/common/path.js";
import { extUriBiasedIgnorePathCase, isEqual } from "../../../../base/common/resources.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IInstantiationService } from "../../../instantiation/common/instantiation.js";
import { localize } from "../../../../nls.js";
import { ILogService } from "../../../log/common/log.js";
import { IProductService } from "../../../product/common/productService.js";
import { createSchema, platformRootSchema, platformSessionSchema, schemaProperty, AgentHostCodexMultiRootEnabledConfigKey, AgentHostMcpServersConfigKey } from "../../common/agentHostSchema.js";
import { createPricingMetaFromBilling, normalizeCAPIBilling } from "../../common/agentModelPricing.js";
import { CHATGPT_SUBSCRIPTION_MODEL_SOURCE_ID, createAgentModelSourceMeta } from "../../common/agentModelSource.js";
import { CODEX_ACCOUNT_META_KEY, CODEX_ACCOUNT_SIGN_IN_REQUEST_KEY, CODEX_ACCOUNT_SIGN_OUT_REQUEST_KEY } from "../../common/codexAccount.js";
import { getReasoningEffortDescription, getReasoningEffortLabel } from "../../common/reasoningEffort.js";
import { AgentHostCodexAgentBinaryArgsEnvVar, AgentHostCodexAgentCodexHomeEnvVar, AgentHostCodexAgentSdkRootEnvVar, AgentSession, CODEX_AGENT_PROVIDER_ID } from "../../common/agentService.js";
import { SessionConfigKey } from "../../common/sessionConfigKeys.js";
import { AHP_AUTH_REQUIRED, ProtocolError } from "../../common/state/sessionProtocol.js";
import { ActionType, isChatAction } from "../../common/state/sessionActions.js";
import { parseLeadingSlashCommand } from "../../common/agentHostSlashCommand.js";
import { buildDefaultChatUri, parseChatUri, ToolResultContentType, ResponsePartKind } from "../../common/state/sessionState.js";
import { ActiveClientToolSet } from "../activeClientState.js";
import { McpCustomizationController } from "../shared/mcpCustomizationController.js";
import { buildCodexMcpReadResult, codexMcpListToInventory, codexMcpServersFromConfig, codexMcpToolsChanged, codexStartupErrorNeedsAuth, injectCodexMcpAuthTokens, inventoryToSdkServers, normalizeCodexMcpResourceUrl, translateCodexMcpStartupState } from "./codexMcpServers.js";
import { codexHooksToContainers, codexSelectedCapabilityRootCandidates, codexSkillsToContainers } from "./codexCustomizations.js";
import { CodexClientCustomizationStore, codexAgentRoleToml, codexCustomizationConfigFromPlugins, codexMcpServersFromPlugins, codexSkillCapabilityRoots, codexSkillRootsFromPlugins } from "./codexClientCustomizations.js";
import { buildElicitationRequest, cancelledElicitationResponse, declinedElicitationResponse, elicitationResponseFromAnswers } from "./codexElicitationMapper.js";
import { McpAuthRequiredReason, McpServerStatus } from "../../common/state/protocol/channels-session/state.js";
import { IAgentConfigurationService } from "../agentConfigurationService.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../../files/common/files.js";
import { INativeEnvironmentService } from "../../../environment/common/environment.js";
import { IAgentPluginManager } from "../../common/agentPluginManager.js";
import { parsePlugin } from "../../../agentPlugins/common/pluginParsers.js";
import { IAgentHostGitHubEndpointService } from "../agentHostGitHubEndpointService.js";
import { IAgentHostStateManager } from "../agentHostStateManager.js";
import { IAgentHostCheckpointService } from "../../common/agentHostCheckpointService.js";
import { ICopilotApiService } from "../shared/copilotApiService.js";
import { extractForwardedErrorInfo } from "../shared/proxyChatError.js";
import { IAgentSdkDownloader } from "../agentSdkDownloader.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { PendingRequestRegistry } from "../../common/pendingRequestRegistry.js";
import { IAgentHostOTelService } from "../../common/otel/agentHostOTelService.js";
import { CodexAppServerClient, JsonRpcError, transportFromChildProcess } from "./codexAppServerClient.js";
import { ICodexProxyService } from "./codexProxyService.js";
import { createCodexSessionMapState, extractUserInputText, finalizeCodexTurnMapState, mapAgentMessageDelta, mapCommandExecutionOutputDelta, mapFileChangeOutputDelta, mapFileChangePatchUpdated, mapItemCompleted, mapItemStarted, mapMcpToolCallProgress, mapReasoningSummaryPartAdded, mapReasoningSummaryTextDelta, mapReasoningTextDelta, mapTokenUsageUpdated, mapTurnCompleted, mapTurnStarted } from "./codexMapAppServerEvents.js";
import { unwrapShellInvocation } from "./codexShellCommand.js";
import { planForkedTurnIdMap, resolveForkBoundary } from "./codexForkPlan.js";
import { resolveCodexInput } from "./codexPromptResolver.js";
import { buildUserInputRequest, emptyUserInputResponse, userInputResponseFromAnswers } from "./codexUserInputMapper.js";
import { replayThreadToTurns } from "./codexReplayMapper.js";
import { CodexSessionMetadataStore } from "./codexSessionMetadataStore.js";
import { buildCodexLaunchConfig, buildCodexResumeParams } from "./codexLaunchConfig.js";
import { THREAD_LIST_MAX_PAGES, collectThreadListPages } from "./codexThreadList.js";
import { codexAccountRateLimitFromResponse, codexAccountStateFromResponse } from "./codexAccountState.js";
import { CodexSessionConfigKey, CODEX_DEFAULT_PERMISSIONS_PRESET, CODEX_PERMISSIONS_PRESETS, collaborationModeKind, migrateCodexPermissionValues, narrowAdditionalDirectories, narrowBoolean, narrowPersonality, narrowReasoningEffort, narrowReasoningSummary, narrowWebSearchMode, resolveCodexPermissions } from "./codexSessionConfigKeys.js";
import { formatGuardianDenialNotification, summarizeGuardianReviewAction, toGuardianAssessmentEventJson } from "./codexGuardianReview.js";
import { CODEX_COMPACT_SLASH_COMMAND } from "../codexCompactCommand.js";
const CLIENT_INFO = {
  name: "vscode_agent_host",
  title: "VS Code Agent Host",
  // The codex `clientInfo.version` is informational. Hardcoded to a
  // non-empty placeholder; bumping it isn't required when our code
  // changes.
  version: "0.1.0"
};
const CODEX_THINKING_LEVEL_KEY = "thinkingLevel";
const USER_AGENT_PREFIX = "vscode_codex";
const CODEX_REASONING_EFFORTS = ["minimal", "low", "medium", "high"];
const CODEX_MCP_APP_CAPABILITIES = {
  serverTools: { listChanged: true },
  serverResources: {}
};
const MCP_TOOL_APPROVAL_QUESTION_ID_PREFIX = "mcp_tool_call_approval_";
const MCP_TOOL_APPROVAL_ANSWER_ALLOW = "Allow";
const MCP_TOOL_APPROVAL_ANSWER_DECLINE = "__codex_mcp_decline__";
const CODEX_RESPONSES_ENDPOINT = "/responses";
const CODEX_COPILOT_MODEL_PROVIDER = "vscode-proxy";
const CODEX_OPENAI_MODEL_PROVIDER = "openai";
const CODEX_MODEL_SELECTION_PREFIX = "@provider=";
function toCodexModelSelectionId(modelProvider, modelId) {
  return `${CODEX_MODEL_SELECTION_PREFIX}${encodeURIComponent(modelProvider)}:${encodeURIComponent(modelId)}`;
}
function parseCodexModelSelection(selection) {
  if (!selection.id.startsWith(CODEX_MODEL_SELECTION_PREFIX)) {
    return { modelProvider: CODEX_COPILOT_MODEL_PROVIDER, modelId: selection.id };
  }
  const separator = selection.id.indexOf(":", CODEX_MODEL_SELECTION_PREFIX.length);
  if (separator < CODEX_MODEL_SELECTION_PREFIX.length) {
    return { modelProvider: CODEX_COPILOT_MODEL_PROVIDER, modelId: selection.id };
  }
  try {
    return {
      modelProvider: decodeURIComponent(selection.id.slice(CODEX_MODEL_SELECTION_PREFIX.length, separator)),
      modelId: decodeURIComponent(selection.id.slice(separator + 1))
    };
  } catch {
    return { modelProvider: CODEX_COPILOT_MODEL_PROVIDER, modelId: selection.id };
  }
}
function createCodexModeSchema() {
  const base = platformSessionSchema.definition[SessionConfigKey.Mode].protocol;
  const kept = (base.enum ?? []).flatMap((value, index) => value === "autopilot" ? [] : [index]);
  return schemaProperty({
    ...base,
    enum: kept.map((index) => base.enum[index]),
    enumLabels: base.enumLabels && kept.map((index) => base.enumLabels[index]),
    enumDescriptions: base.enumDescriptions && kept.map((index) => base.enumDescriptions[index])
  });
}
const codexSessionConfigSchema = createSchema({
  [CodexSessionConfigKey.PermissionsPreset]: schemaProperty({
    type: "string",
    title: localize("codex.sessionConfig.permissionsPreset", "Approvals"),
    description: localize("codex.sessionConfig.permissionsPresetDescription", "How much Codex can do on its own before asking for approval."),
    enum: [...CODEX_PERMISSIONS_PRESETS],
    enumLabels: [
      localize("codex.sessionConfig.permissionsPreset.default", "Default Permissions"),
      localize("codex.sessionConfig.permissionsPreset.autoReview", "Auto-Review"),
      localize("codex.sessionConfig.permissionsPreset.fullAccess", "Full Access")
    ],
    enumDescriptions: [
      localize("codex.sessionConfig.permissionsPreset.defaultDescription", "Codex can read and edit files in the workspace and run routine local commands. It asks before using the internet or going beyond the workspace."),
      localize("codex.sessionConfig.permissionsPreset.autoReviewDescription", "Same workspace access as Default, but approval requests are routed through the auto-reviewer instead of prompting you."),
      localize("codex.sessionConfig.permissionsPreset.fullAccessDescription", "Codex can edit files outside the workspace and use the internet without asking. Use only when you want full machine access.")
    ],
    default: CODEX_DEFAULT_PERMISSIONS_PRESET,
    sessionMutable: true
  }),
  [CodexSessionConfigKey.ApprovalPolicy]: schemaProperty({
    type: "string",
    title: localize("codex.sessionConfig.approvalPolicy", "Approvals"),
    description: localize("codex.sessionConfig.approvalPolicyDescription", "How Codex requests approval for tool calls."),
    enum: ["never", "on-request", "untrusted"],
    enumLabels: [
      localize("codex.sessionConfig.approvalPolicy.never", "No Escalations"),
      localize("codex.sessionConfig.approvalPolicy.onRequest", "Ask When Needed"),
      localize("codex.sessionConfig.approvalPolicy.untrusted", "Ask More Often")
    ],
    enumDescriptions: [
      localize("codex.sessionConfig.approvalPolicy.neverDescription", "Never ask for elevated permission; commands that cannot run in the sandbox are rejected."),
      localize("codex.sessionConfig.approvalPolicy.onRequestDescription", "Ask only when Codex determines a command needs elevated permission."),
      localize("codex.sessionConfig.approvalPolicy.untrustedDescription", "Ask before more command categories so you can review actions more closely.")
    ],
    default: "on-request",
    sessionMutable: true
  }),
  [CodexSessionConfigKey.SandboxMode]: schemaProperty({
    type: "string",
    title: localize("codex.sessionConfig.sandboxMode", "Sandbox"),
    description: localize("codex.sessionConfig.sandboxModeDescription", "Filesystem and network restrictions applied to tool calls."),
    enum: ["read-only", "workspace-write", "danger-full-access"],
    enumLabels: [
      localize("codex.sessionConfig.sandboxMode.readOnly", "Read-Only"),
      localize("codex.sessionConfig.sandboxMode.workspaceWrite", "Workspace Write"),
      localize("codex.sessionConfig.sandboxMode.dangerFullAccess", "Full Access (Dangerous)")
    ],
    enumDescriptions: [
      localize("codex.sessionConfig.sandboxMode.readOnlyDescription", "Tool calls can read the workspace but cannot modify files."),
      localize("codex.sessionConfig.sandboxMode.workspaceWriteDescription", "Tool calls can read and write within the workspace; network is controlled separately."),
      localize("codex.sessionConfig.sandboxMode.dangerFullAccessDescription", "Tool calls have unrestricted disk and network access.")
    ],
    default: "workspace-write",
    sessionMutable: true
  }),
  [CodexSessionConfigKey.WebSearchMode]: schemaProperty({
    type: "string",
    title: localize("codex.sessionConfig.webSearchMode", "Web Search"),
    description: localize("codex.sessionConfig.webSearchModeDescription", "Web-search tool availability for the model."),
    enum: ["disabled", "cached", "live"],
    enumLabels: [
      localize("codex.sessionConfig.webSearchMode.disabled", "Disabled"),
      localize("codex.sessionConfig.webSearchMode.cached", "Cached Only"),
      localize("codex.sessionConfig.webSearchMode.live", "Live")
    ],
    default: "disabled",
    sessionMutable: false
  }),
  [CodexSessionConfigKey.ModelReasoningEffort]: schemaProperty({
    type: "string",
    title: localize("codex.sessionConfig.modelReasoningEffort", "Reasoning Effort"),
    description: localize("codex.sessionConfig.modelReasoningEffortDescription", "Controls how much reasoning effort Codex uses."),
    enum: [...CODEX_REASONING_EFFORTS],
    enumLabels: CODEX_REASONING_EFFORTS.map(getReasoningEffortLabel),
    enumDescriptions: CODEX_REASONING_EFFORTS.map((effort) => getReasoningEffortDescription(effort) ?? ""),
    default: "medium",
    sessionMutable: true
  }),
  [SessionConfigKey.Mode]: createCodexModeSchema(),
  [CodexSessionConfigKey.Personality]: schemaProperty({
    type: "string",
    title: localize("codex.sessionConfig.personality", "Personality"),
    description: localize("codex.sessionConfig.personalityDescription", "Tone Codex uses when communicating."),
    enum: ["none", "friendly", "pragmatic"],
    enumLabels: [
      localize("codex.sessionConfig.personality.none", "Default"),
      localize("codex.sessionConfig.personality.friendly", "Friendly"),
      localize("codex.sessionConfig.personality.pragmatic", "Pragmatic")
    ],
    enumDescriptions: [
      localize("codex.sessionConfig.personality.noneDescription", "Use Codex's built-in default tone."),
      localize("codex.sessionConfig.personality.friendlyDescription", "Warmer, more conversational tone."),
      localize("codex.sessionConfig.personality.pragmaticDescription", "Terse, no-nonsense tone focused on actions.")
    ],
    default: "none",
    sessionMutable: true
  }),
  [CodexSessionConfigKey.ReasoningSummary]: schemaProperty({
    type: "string",
    title: localize("codex.sessionConfig.reasoningSummary", "Reasoning Summary"),
    description: localize("codex.sessionConfig.reasoningSummaryDescription", "How Codex summarizes its reasoning in the response stream."),
    enum: ["auto", "concise", "detailed", "none"],
    enumLabels: [
      localize("codex.sessionConfig.reasoningSummary.auto", "Auto"),
      localize("codex.sessionConfig.reasoningSummary.concise", "Concise"),
      localize("codex.sessionConfig.reasoningSummary.detailed", "Detailed"),
      localize("codex.sessionConfig.reasoningSummary.none", "None")
    ],
    default: "auto",
    sessionMutable: true
  }),
  [CodexSessionConfigKey.AdditionalDirectories]: schemaProperty({
    type: "array",
    title: localize("codex.sessionConfig.additionalDirectories", "Additional Writable Directories"),
    description: localize("codex.sessionConfig.additionalDirectoriesDescription", "Absolute paths the sandbox is allowed to write to, in addition to the workspace. Only applies when Sandbox is Workspace Write."),
    items: { type: "string", title: localize("codex.sessionConfig.additionalDirectories.item", "Directory") },
    enumDynamic: true,
    default: [],
    sessionMutable: true
  }),
  [CodexSessionConfigKey.NetworkAccessEnabled]: schemaProperty({
    type: "boolean",
    title: localize("codex.sessionConfig.networkAccessEnabled", "Network"),
    description: localize("codex.sessionConfig.networkAccessEnabledDescription", "Allow sandboxed tool calls to make outbound network requests. Only applies when Sandbox is Workspace Write."),
    default: false,
    sessionMutable: true
  }),
  [SessionConfigKey.Permissions]: platformSessionSchema.definition[SessionConfigKey.Permissions]
});
const codexVisibleSessionConfigSchema = createSchema({
  [SessionConfigKey.Mode]: codexSessionConfigSchema.definition[SessionConfigKey.Mode],
  [CodexSessionConfigKey.PermissionsPreset]: codexSessionConfigSchema.definition[CodexSessionConfigKey.PermissionsPreset],
  [SessionConfigKey.Permissions]: platformSessionSchema.definition[SessionConfigKey.Permissions]
});
const codexSessionConfigDefaults = {
  [CodexSessionConfigKey.PermissionsPreset]: CODEX_DEFAULT_PERMISSIONS_PRESET,
  [CodexSessionConfigKey.ApprovalPolicy]: "on-request",
  [CodexSessionConfigKey.SandboxMode]: "workspace-write",
  [CodexSessionConfigKey.WebSearchMode]: "disabled",
  [CodexSessionConfigKey.ModelReasoningEffort]: "medium",
  [CodexSessionConfigKey.AdditionalDirectories]: [],
  [CodexSessionConfigKey.NetworkAccessEnabled]: false,
  [SessionConfigKey.Mode]: "interactive",
  [CodexSessionConfigKey.Personality]: "none",
  [CodexSessionConfigKey.ReasoningSummary]: "auto"
};
function distinctAbsolutePaths(paths) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const path of paths) {
    const normalized = normalize(path);
    const key = filesystemPathComparisonKey(normalized);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}
function distinctWorkingDirectories(directories) {
  if (!directories) {
    return void 0;
  }
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const directory of directories) {
    const path = normalize(directory.fsPath);
    const key = filesystemPathComparisonKey(path);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(directory);
    }
  }
  return result.length > 0 ? result : void 0;
}
function filesystemPathComparisonKey(path) {
  if (!isAbsolute(path)) {
    return void 0;
  }
  const resource = extUriBiasedIgnorePathCase.removeTrailingPathSeparator(URI.file(path));
  return extUriBiasedIgnorePathCase.getComparisonKey(resource);
}
const CodexPrewarmTtlMs = 6e4;
const CodexSdkPackage = {
  id: "codex",
  displayName: "Codex",
  devOverrideEnvVar: AgentHostCodexAgentSdkRootEnvVar,
  hasSeparateMuslLinuxPackage: false
};
function dynamicToolResponseFromResult(result) {
  const contentItems = [];
  for (const c of result.content ?? []) {
    if (c.type === ToolResultContentType.Text) {
      contentItems.push({ type: "inputText", text: c.text });
    }
  }
  if (contentItems.length === 0) {
    const summary = typeof result.pastTenseMessage === "string" && result.pastTenseMessage.length > 0 ? result.pastTenseMessage : result.success ? "Tool completed with no output." : "Tool failed with no output.";
    contentItems.push({ type: "inputText", text: summary });
  }
  return { contentItems, success: result.success };
}
function toolsSignature(tools) {
  if (!tools || tools.length === 0) {
    return "";
  }
  return tools.map((t) => `${t.name}\0${t.description ?? ""}\0${JSON.stringify(t.inputSchema ?? null)}`).sort().join("");
}
function mcpServersSignature(servers) {
  const names = Object.keys(servers).sort();
  return names.map((name) => `${name}\0${JSON.stringify(servers[name])}`).join("");
}
class CodexActiveClientHandle {
  constructor(_getSession, clientId, displayName, _onToolsSet, _syncCustomizations) {
    this._getSession = _getSession;
    this.clientId = clientId;
    this.displayName = displayName;
    this._onToolsSet = _onToolsSet;
    this._syncCustomizations = _syncCustomizations;
    this._customizations = [];
  }
  get tools() {
    return this._getSession()?.clientToolSet.get(this.clientId) ?? [];
  }
  set tools(tools) {
    this._getSession()?.clientToolSet.set(this.clientId, tools);
    this._onToolsSet(tools);
  }
  get customizations() {
    return this._customizations;
  }
  set customizations(customizations) {
    this._customizations = customizations;
    this._syncCustomizations(customizations);
  }
}
function narrowFileChangeDecision(decision) {
  switch (decision) {
    case "accept":
    case "acceptForSession":
    case "decline":
    case "cancel":
      return decision;
    default:
      return "decline";
  }
}
let CodexAgent = class extends Disposable {
  constructor(_logService, _copilotApiService, _codexProxyService, _configurationService, _gitHubEndpointService, _checkpointService, _agentSdkDownloader, _productService, _pluginManager, _fileService, _environmentService, _instantiationService, _otelService, _stateManager) {
    super();
    this._logService = _logService;
    this._copilotApiService = _copilotApiService;
    this._codexProxyService = _codexProxyService;
    this._configurationService = _configurationService;
    this._gitHubEndpointService = _gitHubEndpointService;
    this._checkpointService = _checkpointService;
    this._agentSdkDownloader = _agentSdkDownloader;
    this._productService = _productService;
    this._pluginManager = _pluginManager;
    this._fileService = _fileService;
    this._environmentService = _environmentService;
    this._instantiationService = _instantiationService;
    this._otelService = _otelService;
    this._stateManager = _stateManager;
    this.id = CODEX_AGENT_PROVIDER_ID;
    this._onDidSessionProgress = this._register(new Emitter());
    this.onDidSessionProgress = this._onDidSessionProgress.event;
    this._onDidMaterializeSession = this._register(new Emitter());
    this.onDidMaterializeSession = this._onDidMaterializeSession.event;
    this._onDidRequireAuth = this._register(new Emitter());
    this.onDidRequireAuth = this._onDidRequireAuth.event;
    this._onMcpNotification = this._register(new Emitter());
    this.onMcpNotification = this._onMcpNotification.event;
    this._models = observableValue(this, []);
    this.models = this._models;
    this._openAIAccountState = { usageSource: "openai", status: "unknown" };
    this._providerConfigurationValues = {};
    this._providerConfigurationWrite = Promise.resolve();
    this._providerConfigurationReady = false;
    /** Keyed by caller-facing sessionId (the URI host). */
    this._sessions = /* @__PURE__ */ new Map();
    /** Inverse map: codex threadId → caller-facing sessionId, for routing codex notifications back to sessions. */
    this._sessionIdByThreadId = /* @__PURE__ */ new Map();
    /**
     * Live subagent (collab-agent) child threads, keyed by the child codex
     * thread id. Populated when a parent session's `spawnAgent` collab tool
     * call completes (carrying the child `receiverThreadIds`); the child's
     * subsequent `turn/*` and `item/*` notifications route here instead of
     * {@link _sessionIdByThreadId}. Removed on the child's `turn/completed`.
     */
    this._subagentsByThreadId = /* @__PURE__ */ new Map();
    /**
     * Connection-global MCP server inventory reported by the codex
     * app-server (`mcpServerStatus/list` + `mcpServer/startupStatus/updated`).
     * Codex owns MCP servers at the process level — shared across every
     * thread — so the inventory lives on the agent and is mirrored onto each
     * session's {@link ICodexSession.mcpController}. Keyed by server name.
     */
    this._mcpInventory = /* @__PURE__ */ new Map();
    /**
     * OAuth bearer tokens acquired for auth-gated http MCP servers, keyed by
     * the server's {@link normalizeCodexMcpResourceUrl | normalized URL}.
     * Populated by {@link handleAuthenticationToken} after the workbench
     * completes the sign-in, then injected into the per-thread `http_headers`
     * by {@link _buildSessionMcpServers}. Process-global: a token for a given
     * server URL applies to every session/thread that uses it (codex runs one
     * shared app-server).
     */
    this._mcpAuthTokens = /* @__PURE__ */ new Map();
    /**
     * Association from a normalized OAuth `resource` (what the workbench
     * authenticates) to the normalized MCP server URL(s) it unlocks. RFC 9728
     * discovery can return a `resource` that differs from the configured server
     * URL (e.g. root `https://host/` for a `https://host/mcp` endpoint), so the
     * token the workbench pushes back is keyed by the resource, not the server
     * URL. Recorded in {@link _surfaceMcpAuthRequired} at discovery time and
     * read by {@link handleAuthenticationToken} to route the token to the right
     * server(s).
     */
    this._mcpAuthServerUrlsByResource = /* @__PURE__ */ new Map();
    this._connection = { kind: "idle" };
    this._connectionGeneration = 0;
    this._copilotModels = [];
    this._codexModels = [];
    // ---- Chat surface ------------------------------------------------------
    //
    // Chat-addressed adoption of the {@link IAgent} surface introduced
    // in gate G-C1. Codex is a SINGLE-CHAT harness: a session owns exactly one
    // (default) chat addressed by its default chat channel URI, so the
    // chat methods simply route to the existing session-addressed
    // implementations. The legacy `(session, chat?)` methods below are kept as a
    // compat shim (removed centrally in gate G-C2) and both surfaces coexist.
    /**
     * The chat-addressed operation surface for the chats within a session.
     * Codex is single-chat: peer-chat operations
     * ({@link IAgentChats.createChat}/{@link IAgentChats.fork})
     * are unsupported and throw, mirroring today's behavior where Codex omits
     * `createChat` (the orchestrator rejected multi-chat for Codex). The
     * remaining methods address the session's single default chat, whose
     * URI is the deterministic default chat channel URI.
     */
    this.chats = {
      createChat: (_chat, _options) => {
        throw new Error("Codex agent does not support multiple chats");
      },
      fork: (_chat, _source, _options) => {
        throw new Error("Codex agent does not support chat forking");
      },
      disposeChat: (_chat) => {
        return Promise.resolve();
      },
      sendMessage: (chat, prompt, workingDirectories, attachments, turnId, _senderClientId) => {
        return this._sendMessage(chat, prompt, attachments, turnId, workingDirectories);
      },
      abort: (chat) => {
        return this._abort(chat);
      },
      changeModel: (chat, model) => {
        return this._changeModel(chat, model);
      },
      changeAgent: (chat, agent) => this._changeAgent(chat, agent),
      getMessages: (chat) => {
        return this.getSessionMessages(chat);
      }
    };
    this._metadataStore = this._instantiationService.createInstance(CodexSessionMetadataStore);
    this._publishAccountInfo({ status: "unknown" });
    this._register(this._stateManager.onDidChangeSessionTitle(({ session, title }) => {
      if (AgentSession.provider(session) === this.id) {
        this._otelService.emitSessionTitleChanged(AgentSession.id(session), session, title);
      }
    }));
    this._register(this._configurationService.onDidRootConfigChange(() => {
      const signInRequest = this._configurationService.getRootConfigValues?.()[CODEX_ACCOUNT_SIGN_IN_REQUEST_KEY];
      if (typeof signInRequest === "string" && signInRequest !== this._lastSignInRequest) {
        this._lastSignInRequest = signInRequest;
        this._configurationService.updateRootConfig({ [CODEX_ACCOUNT_SIGN_IN_REQUEST_KEY]: void 0 });
        void this._signInToChatGPT(signInRequest);
      }
      const signOutRequest = this._configurationService.getRootConfigValues?.()[CODEX_ACCOUNT_SIGN_OUT_REQUEST_KEY];
      if (typeof signOutRequest === "string" && signOutRequest !== this._lastSignOutRequest) {
        this._lastSignOutRequest = signOutRequest;
        this._configurationService.updateRootConfig({ [CODEX_ACCOUNT_SIGN_OUT_REQUEST_KEY]: void 0 });
        void this._signOutOfChatGPT();
      }
      this._queueProviderConfigurationWrite();
    }));
    void this._refreshProviderConfiguration();
  }
  _setOpenAIAccountState(state, _publish = true) {
    this._openAIAccountState = state;
    if (state.status !== "signedIn" || state.authType !== "chatgpt") {
      this._openAIAccountRateLimit = void 0;
    }
    if (_publish) {
      this._publishAccountInfo(this._toAccountInfo(state));
    }
  }
  _publishAccountInfo(account) {
    this._configurationService.publishRootTransientValues?.({ [CODEX_ACCOUNT_META_KEY]: account });
  }
  async _signInToChatGPT(request) {
    try {
      const connection = await this._ensureConnection();
      const account = await this._refreshAccount(connection.client);
      if (account.status === "signedIn" && account.authType === "chatgpt") {
        return;
      }
      const response = await connection.client.request("account/login/start", { type: "chatgpt" });
      if (response.type === "chatgpt") {
        this._publishAccountInfo({ ...this._toAccountInfo(this._openAIAccountState), authUrl: response.authUrl, authUrlNonce: request });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._setOpenAIAccountState({ usageSource: "openai", status: "error", error: message });
    }
  }
  async _signOutOfChatGPT() {
    try {
      const connection = await this._ensureConnection();
      await connection.client.request("account/logout", void 0);
      await this._refreshAccount(connection.client);
      this._queueModelRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._setOpenAIAccountState({ usageSource: "openai", status: "error", error: message });
    }
  }
  _toAccountInfo(state) {
    return {
      status: state.status,
      email: state.authType === "chatgpt" ? state.email : void 0,
      planType: state.authType === "chatgpt" ? state.planType : void 0,
      requiresOpenaiAuth: state.requiresOpenaiAuth,
      rateLimit: state.authType === "chatgpt" ? this._openAIAccountRateLimit : void 0
    };
  }
  _resetSessionForModelProviderChange(session, modelProvider) {
    if (session.threadId === void 0) {
      return;
    }
    this._logService.info(`[Codex:${session.sessionId}] replacing thread ${session.threadId} with a fresh ${modelProvider} thread`);
    this._sessionIdByThreadId.delete(session.threadId);
    session.threadId = void 0;
    session.materializePromise = void 0;
    session.materializedToolsSig = void 0;
    session.materializedMcpSig = void 0;
    session.materializedCustomizationsSig = void 0;
    session.needsResume = false;
    session.hostTurnIdByAppTurnId.clear();
    session.codexTurnIdByHostTurnId.clear();
  }
  // #region Auth
  getProtectedResources() {
    return [
      { ...this._gitHubEndpointService.getCopilotResource(), required: false },
      this._gitHubEndpointService.getRepoResource()
    ];
  }
  async authenticate(resource, token) {
    if (resource === this._gitHubEndpointService.getRepoResource().resource) {
      return true;
    }
    if (resource !== this._gitHubEndpointService.getCopilotResource().resource) {
      return false;
    }
    const changed = this._githubToken !== token;
    this._githubToken = token;
    if (changed && this._connection.kind === "ready" && this._connection.proxyHandle) {
      this._connection.proxyHandle.setToken(token);
      this._queueModelRefresh();
    } else if (changed) {
      this._queueModelRefresh();
    }
    this._logService.info("[Codex] Auth token updated");
    void this._refreshProviderConfiguration();
    return true;
  }
  /**
   * Receives a bearer token the workbench acquired for a protected resource
   * (the `authenticate` command is fanned out to every agent). If the
   * resource maps to one or more configured auth-gated http MCP servers
   * (via the association recorded at discovery time, or a direct URL match),
   * store the token per server URL (so {@link _buildSessionMcpServers} injects
   * it) and reconnect the affected threads so codex picks it up. This is the
   * codex end of the *same* OAuth mechanism the Copilot agent uses: the
   * workbench does the sign-in, the agent injects the resulting bearer.
   * Returns whether the token was consumed by an MCP server (the GitHub agent
   * token flows through {@link authenticate} instead).
   */
  async handleAuthenticationToken(params) {
    const normalizedResource = normalizeCodexMcpResourceUrl(params.resource);
    if (normalizedResource === void 0) {
      return false;
    }
    const serverUrls = new Set(this._mcpAuthServerUrlsByResource.get(normalizedResource) ?? []);
    if (this._isConfiguredHttpServerUrl(normalizedResource)) {
      serverUrls.add(normalizedResource);
    }
    if (serverUrls.size === 0) {
      return false;
    }
    let changed = false;
    for (const serverUrl of serverUrls) {
      if (this._mcpAuthTokens.get(serverUrl) !== params.token) {
        this._mcpAuthTokens.set(serverUrl, params.token);
        changed = true;
      }
    }
    if (!changed) {
      return true;
    }
    this._logService.info(`[Codex] stored MCP auth token for ${params.resource}; reconnecting affected sessions`);
    await this._reconnectSessionsForMcpAuth(serverUrls);
    return true;
  }
  /** Whether `normalizedUrl` is a currently-configured http MCP server (root config or any session's client plugins). */
  _isConfiguredHttpServerUrl(normalizedUrl) {
    if (Object.values(codexMcpServersFromConfig(this._configurationService.getRootValue(platformRootSchema, AgentHostMcpServersConfigKey))).some((server) => server.url !== void 0 && normalizeCodexMcpResourceUrl(server.url) === normalizedUrl)) {
      return true;
    }
    return [...this._sessions.values()].some(
      (session) => [...this._httpMcpServerUrls(session).values()].includes(normalizedUrl)
    );
  }
  /**
   * Reconnects every materialized session whose merged MCP servers include one
   * of `normalizedUrls` so codex re-reads `config.mcp_servers` with the
   * injected `Authorization` header. A thread that has not yet committed a
   * turn is restarted (`thread/start`, lossless); one with history is resumed
   * (`thread/resume` carries the same `config` field, loading history from the
   * rollout) on its next turn via {@link ICodexSession.needsResume}.
   */
  async _reconnectSessionsForMcpAuth(normalizedUrls) {
    for (const session of this._sessions.values()) {
      if (session.disposed || session.threadId === void 0) {
        continue;
      }
      if (![...this._httpMcpServerUrls(session).values()].some((url) => normalizedUrls.has(url))) {
        continue;
      }
      if (!session.firstTurnSent) {
        try {
          await this._restartThreadWithCurrentTools(session);
        } catch (err) {
          this._logService.warn(`[Codex:${session.sessionId}] reconnect after MCP auth failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        session.needsResume = true;
      }
    }
  }
  /**
   * {@link IAgent.refreshModels}. Coalesces onto an in-flight refresh — from
   * an account change or an earlier tick — rather than issuing a
   * second enumeration, and never rejects: {@link _refreshModels} logs and
   * applies its own stale-write guards on failure.
   */
  refreshModels() {
    return this._modelsRefreshPromise ?? this._queueModelRefresh();
  }
  _queueModelRefresh() {
    const refreshPromise = this._refreshModels().finally(() => {
      if (this._modelsRefreshPromise === refreshPromise) {
        this._modelsRefreshPromise = void 0;
      }
    });
    this._modelsRefreshPromise = refreshPromise;
    return refreshPromise;
  }
  _ensureModelProviderAuthenticated(model) {
    const modelProvider = model ? parseCodexModelSelection(model).modelProvider : CODEX_COPILOT_MODEL_PROVIDER;
    if (modelProvider !== CODEX_COPILOT_MODEL_PROVIDER) {
      return;
    }
    const token = this._githubToken;
    if (!token) {
      throw new ProtocolError(
        AHP_AUTH_REQUIRED,
        "Authentication is required to use Codex",
        this.getProtectedResources()
      );
    }
  }
  _defaultModel() {
    const models = this._models.get();
    const chosen = models[0];
    return chosen ? { id: chosen.id } : void 0;
  }
  _supportedModelOrUndefined(model) {
    if (model && this._models.get().some((m) => m.id === model.id)) {
      return model;
    }
    if (model) {
      this._logService.warn(`[Codex] Unknown model '${model.id}'`);
      return void 0;
    }
    return this._defaultModel();
  }
  async _resolveModel(session) {
    if (this._models.get().length === 0 && this._modelsRefreshPromise) {
      await this._modelsRefreshPromise;
    }
    const selected = this._supportedModelOrUndefined(session.model);
    if (selected) {
      session.model = selected;
      return selected;
    }
    throw new Error("Codex has no available models.");
  }
  _createReasoningEffortConfigSchema() {
    return {
      type: "object",
      properties: {
        [CODEX_THINKING_LEVEL_KEY]: {
          type: "string",
          title: localize("codex.modelThinkingLevel.title", "Thinking Level"),
          description: localize("codex.modelThinkingLevel.description", "Controls how much reasoning effort Codex uses."),
          default: "medium",
          enum: [...CODEX_REASONING_EFFORTS],
          enumLabels: CODEX_REASONING_EFFORTS.map(getReasoningEffortLabel),
          enumDescriptions: CODEX_REASONING_EFFORTS.map((effort) => getReasoningEffortDescription(effort) ?? "")
        }
      }
    };
  }
  _getReasoningEffort(session) {
    const modelConfigEffort = narrowReasoningEffort(session.model?.config?.[CODEX_THINKING_LEVEL_KEY]);
    if (modelConfigEffort) {
      return modelConfigEffort;
    }
    const config = this._configurationService.getSessionConfigValues(session.sessionUri.toString());
    return narrowReasoningEffort(config?.[CodexSessionConfigKey.ModelReasoningEffort]) ?? codexSessionConfigDefaults[CodexSessionConfigKey.ModelReasoningEffort];
  }
  _readSessionConfig(session) {
    return codexSessionConfigSchema.validateOrDefault(
      this._configurationService.getSessionConfigValues(session.sessionUri.toString()),
      codexSessionConfigDefaults
    );
  }
  /**
   * Resolve the Codex security axes (approval policy, sandbox, reviewer) for a
   * live or restored session from its RAW persisted config values.
   *
   * The raw values are normalized through {@link migrateCodexPermissionValues}
   * (the same migration the restore path applies) before resolving, so the
   * axes we send to the app-server always match the preset the "Approvals" chip
   * displays. This matters for two legacy shapes:
   * - a session that persisted only `sandboxMode = 'read-only'` is preserved
   *   verbatim, so it is NOT silently escalated back to `workspace-write` on
   *   resume (the chip over-promises, but the session stays more locked down);
   * - a session that persisted `approvalPolicy = 'never'` + `workspace-write`
   *   (which the chip renders as "Default Permissions") is snapped onto the
   *   `default` preset's `on-request` policy so it actually prompts, instead of
   *   running commands unprompted while the chip claims it would ask.
   */
  _resolveSessionPermissions(session) {
    const rawValues = this._configurationService.getSessionConfigValues(session.sessionUri.toString());
    const defaults = {
      approvalPolicy: codexSessionConfigDefaults[CodexSessionConfigKey.ApprovalPolicy],
      sandboxMode: codexSessionConfigDefaults[CodexSessionConfigKey.SandboxMode]
    };
    return resolveCodexPermissions(migrateCodexPermissionValues(rawValues, defaults), defaults);
  }
  _sandboxPolicy(session, config, mode) {
    if (mode === "danger-full-access") {
      return { type: "dangerFullAccess" };
    }
    const networkAccess = narrowBoolean(config[CodexSessionConfigKey.NetworkAccessEnabled]) ?? codexSessionConfigDefaults[CodexSessionConfigKey.NetworkAccessEnabled];
    if (mode === "read-only") {
      return { type: "readOnly", networkAccess: false };
    }
    const additionalDirectories = narrowAdditionalDirectories(config[CodexSessionConfigKey.AdditionalDirectories]) ?? [];
    const writableRoots = this._isMultiRootActive(session) ? distinctAbsolutePaths([
      ...this._runtimeWorkspaceRoots(session),
      ...additionalDirectories
    ]) : [
      ...session.workingDirectory ? [session.workingDirectory.fsPath] : [],
      ...additionalDirectories
    ];
    return {
      type: "workspaceWrite",
      writableRoots,
      networkAccess,
      excludeTmpdirEnvVar: false,
      excludeSlashTmp: false
    };
  }
  _turnStartOptions(session, modelId, developerInstructions) {
    const config = this._readSessionConfig(session);
    const { approvalPolicy, sandboxMode, approvalsReviewer } = this._resolveSessionPermissions(session);
    const sandboxPolicy = this._sandboxPolicy(session, config, sandboxMode);
    const runtimeWorkspaceRoots = this._isMultiRootActive(session) ? this._runtimeWorkspaceRoots(session) : sandboxPolicy.type === "workspaceWrite" ? sandboxPolicy.writableRoots : void 0;
    const effort = this._getReasoningEffort(session);
    const personality = narrowPersonality(config[CodexSessionConfigKey.Personality]) ?? codexSessionConfigDefaults[CodexSessionConfigKey.Personality];
    const summary = narrowReasoningSummary(config[CodexSessionConfigKey.ReasoningSummary]) ?? codexSessionConfigDefaults[CodexSessionConfigKey.ReasoningSummary];
    const mode = collaborationModeKind(config[SessionConfigKey.Mode]);
    const collaborationMode = {
      mode,
      settings: { model: modelId, reasoning_effort: effort ?? null, developer_instructions: developerInstructions ?? null }
    };
    return {
      approvalPolicy,
      sandboxPolicy,
      approvalsReviewer,
      effort,
      personality,
      summary,
      collaborationMode,
      ...runtimeWorkspaceRoots ? { runtimeWorkspaceRoots } : {}
    };
  }
  _runtimeWorkspaceRoots(session) {
    const workingDirectories = session.workingDirectories ?? (session.workingDirectory ? [session.workingDirectory] : []);
    return distinctAbsolutePaths(workingDirectories.map((directory) => directory.fsPath));
  }
  _isMultiRootActive(session) {
    return session.multiRootEnabled && (session.workingDirectories?.length ?? 0) > 1;
  }
  async _selectedCapabilityRoots(session) {
    const candidates = codexSelectedCapabilityRootCandidates(session.workingDirectories ?? []);
    const resolved = await Promise.all(candidates.map(async (candidate) => {
      try {
        const stat = await this._fileService.stat(URI.file(candidate.location.path));
        return stat.isDirectory ? candidate : void 0;
      } catch (error) {
        const result = toFileOperationResult(error);
        if (result !== FileOperationResult.FILE_NOT_FOUND) {
          this._logService.warn(`[Codex] selected capability root metadata lookup failed: id=${candidate.id}, result=${result}`);
        }
        return void 0;
      }
    }));
    return resolved.filter((candidate) => candidate !== void 0);
  }
  async _buildCustomizationLaunch(session) {
    const plugins = session.clientCustomizations.enabledPlugins();
    const customization = await codexCustomizationConfigFromPlugins(plugins, session.agent, this._fileService);
    const config = {};
    if (customization.agentRoles.length > 0) {
      const root = session.customizationDirectory?.fsPath ?? await fs.promises.mkdtemp(join(os.tmpdir(), "vscode-agent-codex-customizations-"));
      const agentsDirectory = join(root, "agents");
      await fs.promises.mkdir(agentsDirectory, { recursive: true });
      const agents = {};
      for (const [index, role] of customization.agentRoles.entries()) {
        const rolePath = join(agentsDirectory, `${index}.toml`);
        await fs.promises.writeFile(rolePath, codexAgentRoleToml(role), "utf8");
        agents[role.name] = { description: role.description, config_file: rolePath };
      }
      config.agents = agents;
      session.customizationDirectory ??= URI.file(root);
    }
    const selectedCapabilityRoots = codexSkillCapabilityRoots(plugins).map((uri, index) => ({
      id: `client-plugin-skills-${index}-${uri.fsPath}`,
      location: { type: "environment", environmentId: "local", path: uri.fsPath }
    }));
    const signature = JSON.stringify({
      agent: session.agent?.uri,
      agentRoles: customization.agentRoles,
      developerInstructions: customization.developerInstructions,
      selectedCapabilityRoots: selectedCapabilityRoots.map((root) => root.location.path)
    });
    return {
      config,
      ...customization.developerInstructions ? { developerInstructions: customization.developerInstructions } : {},
      selectedCapabilityRoots,
      signature
    };
  }
  async _refreshModels() {
    await Promise.all([this._refreshCopilotModels(), this._refreshCodexModels()]);
    this._models.set([...this._copilotModels, ...this._codexModels], void 0);
  }
  async _refreshCopilotModels() {
    const token = this._githubToken;
    if (!token) {
      this._copilotModels = [];
      return;
    }
    try {
      const userAgent = `${USER_AGENT_PREFIX}/${this._productService.version}`;
      const all = await this._copilotApiService.models(token, { headers: { "User-Agent": userAgent }, suppressIntegrationId: true });
      if (this._githubToken !== token) {
        return;
      }
      const configSchema = this._createReasoningEffortConfigSchema();
      const models = all.filter((m) => m.supported_endpoints?.includes(CODEX_RESPONSES_ENDPOINT)).sort((a, b) => Number(b.is_chat_default) - Number(a.is_chat_default)).map((m) => ({
        provider: "copilot",
        id: toCodexModelSelectionId(CODEX_COPILOT_MODEL_PROVIDER, m.id),
        name: m.name ?? m.id,
        maxContextWindow: m.capabilities?.limits?.max_context_window_tokens,
        maxOutputTokens: m.capabilities?.limits?.max_output_tokens,
        maxPromptTokens: m.capabilities?.limits?.max_prompt_tokens,
        supportsVision: !!m.capabilities?.supports?.vision,
        configSchema,
        policyState: m.policy?.state,
        _meta: createPricingMetaFromBilling(
          normalizeCAPIBilling(m.billing),
          typeof m.model_picker_price_category === "string" ? m.model_picker_price_category : void 0
        )
      }));
      this._copilotModels = models;
    } catch (err) {
      this._logService.warn(`[Codex] Failed to refresh models: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  async _refreshCodexModels() {
    try {
      if (this._connection.kind === "idle" && !await this._isSdkResolvableWithoutDownload()) {
        this._codexModels = [];
        return;
      }
      const connection = await this._ensureConnection();
      const account = await this._refreshAccount(connection.client, false);
      if (account.status === "signedOut" || account.status === "error") {
        this._codexModels = [];
        return;
      }
      const configResponse = await connection.client.request("config/read", { includeLayers: false });
      const modelProvider = configResponse.config.model_provider ?? CODEX_OPENAI_MODEL_PROVIDER;
      const usesChatGPTSubscription = modelProvider === CODEX_OPENAI_MODEL_PROVIDER && account.status === "signedIn" && account.authType === "chatgpt";
      const pickerProvider = usesChatGPTSubscription ? "chatgpt" : modelProvider;
      const data = [];
      let cursor = null;
      do {
        const response = await connection.client.request("model/list", { cursor, limit: 100, includeHidden: false });
        data.push(...response.data);
        cursor = response.nextCursor;
      } while (cursor !== null);
      const configSchema = this._createReasoningEffortConfigSchema();
      const models = data.sort((left, right) => Number(right.isDefault) - Number(left.isDefault)).map((model) => ({
        provider: pickerProvider,
        id: toCodexModelSelectionId(modelProvider, model.model),
        name: model.displayName,
        supportsVision: model.inputModalities.includes("image"),
        configSchema,
        _meta: createAgentModelSourceMeta(usesChatGPTSubscription ? CHATGPT_SUBSCRIPTION_MODEL_SOURCE_ID : void 0)
      }));
      this._codexModels = models;
    } catch (err) {
      this._logService.warn(`[Codex] Failed to refresh OpenAI models: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // #endregion
  // #region Connection lifecycle
  /**
   * Lazily spawn the codex app-server, initialize the connection,
   * authenticate via apiKey, and return the ready connection. Idempotent
   * — concurrent callers share the same promise.
   */
  async _ensureConnection() {
    if (this._connection.kind === "ready") {
      return Promise.resolve(this._connection);
    }
    if (this._connection.kind === "starting") {
      return this._connection.promise;
    }
    const generation = this._connectionGeneration;
    const startPromise = this._startConnection();
    const promise = startPromise.then((ready) => {
      if (generation !== this._connectionGeneration) {
        ready.client.dispose();
        ready.proxyHandle.dispose();
        try {
          ready.child.kill("SIGKILL");
        } catch {
        }
        throw new Error("Codex app-server was replaced while starting");
      }
      this._connection = { kind: "ready", ...ready };
      return ready;
    }).catch((err) => {
      if (generation === this._connectionGeneration) {
        this._connection = { kind: "idle" };
      }
      throw err;
    });
    this._connection = { kind: "starting", promise };
    return promise;
  }
  /**
   * Resolve the Codex SDK root — the directory whose
   * `node_modules/@openai/codex-<target>/…` holds the native binary.
   *
   * Mirrors the three-tier resolution in `ClaudeAgentSdkService._loadSdk`:
   *   1. dev override / product download, via the downloader, when the SDK
   *      `isAvailable` (env override || `product.agentSdks.codex`);
   *   2. dev fallback to this repo's `node_modules`, where `@openai/codex`
   *      and its per-host binary package are devDependencies — this is what
   *      lets running-from-source (and dev smoke tests) spawn Codex without
   *      an env-var override.
   *
   * `isAvailable` is already false in dev, so it discriminates the two
   * without injecting `INativeEnvironmentService`. When neither path
   * resolves we defer to the downloader so callers get its actionable
   * "not configured" diagnostic.
   */
  async _resolveSdkRoot() {
    if (this._agentSdkDownloader.isAvailable(CodexSdkPackage)) {
      return this._agentSdkDownloader.loadSdkRoot(CodexSdkPackage, CancellationToken.None);
    }
    const devRoot = await resolveCodexDevSdkRoot();
    if (devRoot) {
      this._logService.info(`[Codex] resolving SDK from repo node_modules (dev fallback): ${devRoot}`);
      return devRoot;
    }
    return this._agentSdkDownloader.loadSdkRoot(CodexSdkPackage, CancellationToken.None);
  }
  async _isSdkResolvableWithoutDownload() {
    if (await this._agentSdkDownloader.isSdkResolvableWithoutDownload?.(CodexSdkPackage)) {
      return true;
    }
    return await resolveCodexDevSdkRoot() !== void 0;
  }
  async _startConnection() {
    const root = await this._resolveSdkRoot();
    const codexTarget = codexPackageSuffix(process.platform, process.arch);
    if (!codexTarget) {
      throw new Error(`Codex: unsupported platform ${process.platform}-${process.arch}`);
    }
    const triple = codexBinaryTriple(codexTarget);
    if (!triple) {
      throw new Error(`Codex: no binary triple known for sdkTarget '${codexTarget}'`);
    }
    const binaryName = process.platform === "win32" ? "codex.exe" : "codex";
    const binaryPath = join(root, "node_modules", `@openai/codex-${codexTarget}`, "vendor", triple, "bin", binaryName);
    try {
      fs.accessSync(binaryPath, fs.constants.X_OK);
    } catch (err) {
      throw new Error(`Codex binary not executable: ${binaryPath} (${err instanceof Error ? err.message : String(err)})`);
    }
    const proxyHandle = await this._codexProxyService.start(this._githubToken ?? "");
    const extraArgs = parseBinaryArgs(process.env[AgentHostCodexAgentBinaryArgsEnvVar]);
    const telemetry = await this._otelService.getNativeSdkTelemetryConfig();
    const launchConfig = buildCodexLaunchConfig(process.env, proxyHandle, extraArgs, telemetry);
    const env = launchConfig.env;
    const userCodexHome = process.env[AgentHostCodexAgentCodexHomeEnvVar];
    if (userCodexHome) {
      env.CODEX_HOME = userCodexHome;
    }
    const args = [...launchConfig.args];
    this._logService.info(`[Codex] spawning with additive model providers ${binaryPath} ${args.join(" ")}`);
    const child = spawn(binaryPath, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => this._logService.info(`[Codex stderr] ${String(chunk).trimEnd()}`));
    const transport = transportFromChildProcess(child);
    const client = new CodexAppServerClient(transport, (level, msg) => {
      this._logService.info(`[CodexClient ${level}] ${msg}`);
    });
    client.onExit((e) => {
      this._logService.warn(`[Codex] app-server exited code=${e.code} signal=${e.signal}`);
      this._handleConnectionLost();
    });
    client.onTransportError((err) => {
      this._logService.error(`[Codex] transport error: ${err.message}`);
      this._handleConnectionLost();
    });
    try {
      await client.request("initialize", {
        clientInfo: CLIENT_INFO,
        capabilities: { experimentalApi: true, requestAttestation: false, optOutNotificationMethods: null }
      });
      client.notify("initialized", void 0);
      void this._refreshAccount(client);
    } catch (err) {
      client.dispose();
      proxyHandle.dispose();
      try {
        child.kill("SIGKILL");
      } catch {
      }
      throw err;
    }
    this._registerIgnoredNotifications(client);
    this._register(client.onNotification("account/login/completed", () => {
      void this._refreshAccount(client).then(() => this._queueModelRefresh());
    }));
    this._register(client.onNotification("account/updated", () => {
      if (this._connection.kind === "ready" && this._connection.client === client) {
        void this._refreshAccount(client);
        this._queueModelRefresh();
      }
    }));
    this._register(client.onNotification("account/rateLimits/updated", () => {
      if (this._connection.kind === "ready" && this._connection.client === client && this._openAIAccountState.status === "signedIn" && this._openAIAccountState.authType === "chatgpt") {
        void this._refreshAccountRateLimits(client);
      }
    }));
    this._register(client.onNotification("turn/started", (params) => this._dispatchByThread(params.threadId, (s) => this._handleTurnStartedNotification(s, params))));
    this._register(client.onNotification("item/started", (params) => this._dispatchByThread(params.threadId, (s) => this._handleItemStarted(s, params))));
    this._register(client.onNotification("item/agentMessage/delta", (params) => this._dispatchByThread(params.threadId, (s) => mapAgentMessageDelta(s.mapState, this._withHostTurnId(s, params)))));
    this._register(client.onNotification("item/commandExecution/outputDelta", (params) => this._dispatchByThread(params.threadId, (s) => mapCommandExecutionOutputDelta(s.mapState, this._withHostTurnId(s, params)))));
    this._register(client.onNotification("item/fileChange/patchUpdated", (params) => this._dispatchByThread(params.threadId, (s) => mapFileChangePatchUpdated(s.mapState, this._withHostTurnId(s, params)))));
    this._register(client.onNotification("item/fileChange/outputDelta", (params) => this._dispatchByThread(params.threadId, (s) => mapFileChangeOutputDelta(s.mapState, this._withHostTurnId(s, params)))));
    this._register(client.onNotification("item/mcpToolCall/progress", (params) => this._dispatchByThread(params.threadId, (s) => mapMcpToolCallProgress(s.mapState, this._withHostTurnId(s, params)))));
    this._register(client.onNotification("item/reasoning/summaryPartAdded", (params) => this._dispatchByThread(params.threadId, (s) => mapReasoningSummaryPartAdded(s.mapState, this._withHostTurnId(s, params)))));
    this._register(client.onNotification("item/reasoning/summaryTextDelta", (params) => this._dispatchByThread(params.threadId, (s) => mapReasoningSummaryTextDelta(s.mapState, this._withHostTurnId(s, params)))));
    this._register(client.onNotification("item/reasoning/textDelta", (params) => this._dispatchByThread(params.threadId, (s) => mapReasoningTextDelta(s.mapState, this._withHostTurnId(s, params)))));
    this._register(client.onNotification("thread/tokenUsage/updated", (params) => this._dispatchByThread(params.threadId, (s) => mapTokenUsageUpdated(this._withHostTurnId(s, params)))));
    this._register(client.onNotification("item/completed", (params) => this._dispatchItemCompleted(params)));
    this._register(client.onNotification("turn/completed", (params) => this._dispatchTurnCompleted(params)));
    this._register(client.onNotification("guardianWarning", (params) => this._dispatchByThread(params.threadId, (s) => this._handleGuardianWarning(s, params))));
    this._register(client.onNotification("item/autoApprovalReview/completed", (params) => {
      void this._handleGuardianReviewCompleted(client, params);
    }));
    this._register(client.onNotification("mcpServer/startupStatus/updated", (params) => this._handleMcpStartupStatus(client, params.name, params.status, params.error)));
    this._register(client.onRequest(
      "item/commandExecution/requestApproval",
      (params) => this._handleCommandApprovalRequestRpc(params)
    ));
    this._register(client.onRequest(
      "item/fileChange/requestApproval",
      (params) => this._handleFileChangeApprovalRequestRpc(params)
    ));
    this._register(client.onRequest(
      "item/permissions/requestApproval",
      (params) => this._handlePermissionsApprovalRequestRpc(params)
    ));
    this._register(client.onRequest(
      "item/tool/call",
      (params) => this._handleDynamicToolCallRpc(params)
    ));
    this._register(client.onRequest(
      "item/tool/requestUserInput",
      (params) => this._handleUserInputRequestRpc(params)
    ));
    this._register(client.onRequest(
      "mcpServer/elicitation/request",
      (params) => this._handleElicitationRequestRpc(params)
    ));
    void this._refreshMcpInventory(client);
    return { client, proxyHandle, child };
  }
  /**
   * Builds the `mcp_servers` object for a session's `thread/start.config`:
   * the workbench's root `mcpServers` config merged with the session's
   * enabled client-plugin MCP servers. Passing them per-thread (rather than
   * as process-global `-c` spawn overrides) means each new session picks up
   * the current root config without restarting the shared app-server, and it
   * merges with (leaves intact) the user's global `~/.codex/config.toml`.
   * Client-plugin servers win a name collision with the root config. Any
   * OAuth bearer token acquired for an auth-gated http server (see
   * {@link handleAuthenticationToken}) is injected as an `Authorization`
   * header so codex connects authenticated.
   */
  _buildSessionMcpServers(session) {
    const root = codexMcpServersFromConfig(this._configurationService.getRootValue(platformRootSchema, AgentHostMcpServersConfigKey));
    const clientPlugins = codexMcpServersFromPlugins(session.clientCustomizations.enabledPlugins());
    return injectCodexMcpAuthTokens({ ...root, ...clientPlugins }, this._mcpAuthTokens);
  }
  /**
   * The normalized URLs of every configured http MCP server (root config +
   * the session's client plugins), keyed by server name. Used to (a) surface
   * an auth-required server's resource for the workbench sign-in and (b)
   * match a workbench-acquired token back to the server(s) it unlocks.
   * Computed from a token-free build so the URLs are the bare server URLs.
   */
  _httpMcpServerUrls(session) {
    const root = codexMcpServersFromConfig(this._configurationService.getRootValue(platformRootSchema, AgentHostMcpServersConfigKey));
    const clientPlugins = codexMcpServersFromPlugins(session.clientCustomizations.enabledPlugins());
    const urls = /* @__PURE__ */ new Map();
    for (const [name, server] of Object.entries({ ...root, ...clientPlugins })) {
      const normalized = server.url !== void 0 ? normalizeCodexMcpResourceUrl(server.url) : void 0;
      if (normalized !== void 0) {
        urls.set(name, normalized);
      }
    }
    return urls;
  }
  /** The bare (un-normalized) URL of a configured http MCP server by name, across all sessions. */
  _mcpServerUrlForName(name) {
    const root = codexMcpServersFromConfig(this._configurationService.getRootValue(platformRootSchema, AgentHostMcpServersConfigKey));
    if (root[name]?.url !== void 0) {
      return root[name].url;
    }
    for (const session of this._sessions.values()) {
      const fromPlugins = codexMcpServersFromPlugins(session.clientCustomizations.enabledPlugins());
      if (fromPlugins[name]?.url !== void 0) {
        return fromPlugins[name].url;
      }
    }
    return void 0;
  }
  /**
   * Map the session's tools into codex `dynamicTools` specs: the agent host's
   * server tools (executed in-process) plus the workbench client's tools
   * (round-tripped to the client). Both are registered with codex the same
   * way — at `thread/start` — and dispatched apart in
   * {@link _handleDynamicToolCallRpc} by name.
   */
  _buildDynamicTools(session) {
    const serverTools = this._serverToolHost?.definitions ?? [];
    const clientTools = session.clientToolSet.merged();
    const seen = /* @__PURE__ */ new Set();
    const all = [];
    for (const t of [...serverTools, ...clientTools]) {
      if (seen.has(t.name)) {
        continue;
      }
      seen.add(t.name);
      all.push(t);
    }
    if (all.length === 0) {
      return void 0;
    }
    return all.map((t) => ({
      type: "function",
      name: t.name,
      description: t.description ?? "",
      inputSchema: t.inputSchema ?? { type: "object" }
    }));
  }
  async _handleDynamicToolCallRpc(params) {
    const sessionId = this._sessionIdByThreadId.get(params.threadId);
    const session = sessionId ? this._sessions.get(sessionId) : void 0;
    if (!session) {
      return { result: this._toolFailure(`Codex tool call for unknown thread ${params.threadId}`) };
    }
    const host = this._serverToolHost;
    if (host && params.namespace === null && host.toolNames.includes(params.tool)) {
      try {
        const text = host.executeTool(session.sessionUri.toString(), params.tool, params.arguments);
        return { result: { contentItems: [{ type: "inputText", text: await text }], success: true } };
      } catch (err) {
        return { result: this._toolFailure(`Server tool ${params.tool} failed: ${err instanceof Error ? err.message : String(err)}`) };
      }
    }
    const toolCallId = session.mapState.itemToToolCall.get(params.callId)?.toolCallId;
    if (toolCallId === void 0) {
      return { result: this._toolFailure(`No pending client tool call for ${params.tool} (callId ${params.callId})`) };
    }
    if (session.clientToolSet.size === 0) {
      return { result: this._toolFailure(`No client available to run ${params.tool}`) };
    }
    try {
      const result = await session.pendingClientToolCalls.register(toolCallId);
      return { result: dynamicToolResponseFromResult(result) };
    } catch (err) {
      if (err instanceof CancellationError) {
        return { result: this._toolFailure(`Client tool ${params.tool} was cancelled`) };
      }
      return { result: this._toolFailure(`Client tool ${params.tool} failed: ${err instanceof Error ? err.message : String(err)}`) };
    }
  }
  _toolFailure(message) {
    this._logService.warn(`[Codex] dynamic tool call failed: ${message}`);
    return { contentItems: [{ type: "inputText", text: message }], success: false };
  }
  async _handleUserInputRequestRpc(params) {
    const sessionId = this._sessionIdByThreadId.get(params.threadId);
    const session = sessionId ? this._sessions.get(sessionId) : void 0;
    if (!session) {
      return { result: emptyUserInputResponse(params.questions) };
    }
    if (!session.currentTurnId) {
      this._logService.warn(`[Codex] user input request without an active turn for threadId=${params.threadId}; returning empty answers`);
      return { result: emptyUserInputResponse(params.questions) };
    }
    const approvalQuestion = params.questions.length === 1 && params.questions[0].id.startsWith(MCP_TOOL_APPROVAL_QUESTION_ID_PREFIX) ? params.questions[0] : void 0;
    if (approvalQuestion) {
      const callId = approvalQuestion.id.slice(MCP_TOOL_APPROVAL_QUESTION_ID_PREFIX.length);
      const entry = session.mapState.itemToToolCall.get(callId);
      if (entry) {
        return this._handleMcpToolApprovalViaCard(session, approvalQuestion, entry);
      }
    }
    const requestId = generateUuid();
    const request = buildUserInputRequest(requestId, params.questions);
    try {
      const result = await session.pendingUserInputs.registerAndFire(requestId, () => {
        this._fire(session.sessionUri, { type: ActionType.ChatInputRequested, request });
      });
      return { result: userInputResponseFromAnswers(params.questions, result.response, result.answers) };
    } catch (err) {
      return { result: emptyUserInputResponse(params.questions) };
    }
  }
  /**
   * Renders an MCP tool-call approval on the normal tool-approval card
   * (a pending-confirmation `ChatToolCallReady` on the originating
   * `mcpToolCall` host tool call) rather than as a chat-input question.
   * The user's Allow/Deny decision is mapped back to the answer string
   * codex expects (`Allow` / `__codex_mcp_decline__`). Mirrors the shell
   * command approval flow ({@link CodexAgent._handleCommandApprovalRequest}).
   */
  async _handleMcpToolApprovalViaCard(session, question, entry) {
    const confirmationTitle = question.question || question.header || "Run MCP tool";
    let decision;
    try {
      decision = await session.pendingCommandApprovals.registerAndFire(entry.toolCallId, () => {
        this._fire(session.sessionUri, {
          type: ActionType.ChatToolCallReady,
          turnId: entry.turnId,
          toolCallId: entry.toolCallId,
          invocationMessage: confirmationTitle,
          toolInput: confirmationTitle,
          confirmationTitle
        });
      });
    } catch (err) {
      decision = "decline";
    }
    const allow = decision === "accept" || decision === "acceptForSession";
    const answer = allow ? MCP_TOOL_APPROVAL_ANSWER_ALLOW : MCP_TOOL_APPROVAL_ANSWER_DECLINE;
    return { result: { answers: { [question.id]: { answers: [answer] } } } };
  }
  async _handleElicitationRequestRpc(params) {
    const sessionId = this._sessionIdByThreadId.get(params.threadId);
    const session = sessionId ? this._sessions.get(sessionId) : void 0;
    this._logService.info(`[Codex] elicitation request threadId=${params.threadId} mode=${params.mode} server=${params.serverName} session=${session ? session.sessionId : "NONE"}`);
    if (!session) {
      this._logService.warn(`[Codex] elicitation request for unknown threadId=${params.threadId}; declining`);
      return { result: declinedElicitationResponse() };
    }
    if (!session.currentTurnId) {
      this._logService.warn(`[Codex] elicitation request without an active turn for threadId=${params.threadId}; declining`);
      return { result: declinedElicitationResponse() };
    }
    const requestId = generateUuid();
    const request = buildElicitationRequest(requestId, params);
    try {
      const result = await session.pendingUserInputs.registerAndFire(requestId, () => {
        this._fire(session.sessionUri, { type: ActionType.ChatInputRequested, request });
      });
      this._logService.info(`[Codex] elicitation resolved requestId=${requestId} response=${result.response}`);
      return { result: elicitationResponseFromAnswers(params, result.response, result.answers) };
    } catch (err) {
      this._logService.info(`[Codex] elicitation cancelled requestId=${requestId}: ${err instanceof Error ? err.message : String(err)}`);
      return { result: cancelledElicitationResponse() };
    }
  }
  _hostTurnId(session, appTurnId) {
    return session.hostTurnIdByAppTurnId.get(appTurnId) ?? appTurnId;
  }
  _withHostTurnId(session, params) {
    const turnId = this._hostTurnId(session, params.turnId);
    return turnId === params.turnId ? params : { ...params, turnId };
  }
  _withHostTurn(session, params) {
    const appTurnId = params.turn.id;
    const hostTurnId = session.currentTurnId ?? this._hostTurnId(session, appTurnId);
    session.hostTurnIdByAppTurnId.set(appTurnId, hostTurnId);
    session.currentAppTurnId = appTurnId;
    return hostTurnId === appTurnId ? params : { ...params, turn: { ...params.turn, id: hostTurnId } };
  }
  _handleTurnStartedNotification(session, params) {
    mapTurnStarted(session.mapState, this._withHostTurn(session, params), session.lastPromptText);
    return [];
  }
  _handleTurnCompletedNotification(session, params) {
    const appTurnId = params.turn.id;
    const hostTurnId = this._hostTurnId(session, appTurnId);
    const out = mapTurnCompleted(session.mapState, this._withHostTurn(session, params), this._clearTurnStopWatch(session));
    session.codexTurnIdByHostTurnId.set(hostTurnId, appTurnId);
    if (session.currentAppTurnId === appTurnId || session.currentTurnId === hostTurnId) {
      session.currentTurnId = void 0;
      session.currentAppTurnId = void 0;
    }
    session.hostTurnIdByAppTurnId.delete(appTurnId);
    this._drainPendingSteering(session);
    if (session.pendingGuardianReviewCards.size > 0) {
      for (const guardianToolCallId of [...session.pendingGuardianReviewCards]) {
        session.pendingCommandApprovals.respond(guardianToolCallId, "cancel");
      }
    }
    return out;
  }
  /**
   * Dispatch a codex `item/started` notification. `userMessage` items are
   * intercepted here (rather than in the pure mapper) because steering
   * promotion needs the agent's per-session turn-correlation state; all
   * other item kinds defer to {@link mapItemStarted}.
   */
  _handleItemStarted(session, params) {
    if (params.item.type === "userMessage") {
      return this._handleSteeredUserMessage(session, params.item.content);
    }
    return mapItemStarted(session.mapState, this._withHostTurnId(session, params));
  }
  /**
   * Codex echoes every user message — the turn opener (already shown by
   * the workbench before `sendMessage`) and any steered input — as a
   * `userMessage` item. Only steered input is buffered in
   * {@link ICodexSession.pendingSteeringFlips}; a buffered match is
   * promoted into its own visible turn and everything else is dropped.
   */
  _handleSteeredUserMessage(session, content) {
    const text = extractUserInputText(content);
    const steering = this._takeMatchingPendingSteering(session, text);
    if (!steering) {
      return [];
    }
    return this._beginSteeringTurn(session, steering);
  }
  /**
   * Pop the buffered steering message whose text matches the echoed
   * `userMessage` content. Matching by content (not FIFO) keeps the
   * mapping correct when several steering messages with different texts
   * are in flight.
   */
  _takeMatchingPendingSteering(session, text) {
    for (const [id, msg] of session.pendingSteeringFlips) {
      if (msg.message.text === text) {
        session.pendingSteeringFlips.delete(id);
        return msg;
      }
    }
    return void 0;
  }
  /**
   * Promote a steered message into its own protocol turn: complete the
   * in-flight turn (so its response parts settle into history) and open a
   * fresh turn whose user message is the steering content. The
   * `queuedMessageId` clears the corresponding pending steering bubble.
   * Subsequent codex items for the same app-server turn are re-mapped to
   * the new host turn id so the steering response lands there.
   */
  _beginSteeringTurn(session, steering) {
    const actions = [];
    const appTurnId = session.currentAppTurnId;
    const previousHostTurnId = session.currentTurnId ?? (appTurnId ? this._hostTurnId(session, appTurnId) : void 0);
    actions.push(...finalizeCodexTurnMapState(session.mapState, "Turn was superseded by a steering message before the tool reported completion"));
    if (previousHostTurnId) {
      actions.push({ type: ActionType.ChatTurnComplete, turnId: previousHostTurnId, duration: this._clearTurnStopWatch(session) });
    }
    const newHostTurnId = generateUuid();
    if (appTurnId) {
      session.hostTurnIdByAppTurnId.set(appTurnId, newHostTurnId);
    }
    session.currentTurnId = newHostTurnId;
    actions.push({
      type: ActionType.ChatTurnStarted,
      turnId: newHostTurnId,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: steering.message,
      queuedMessageId: steering.id
    });
    this._startTurnStopWatch(session);
    return actions;
  }
  /**
   * Clear any steering messages still buffered (never echoed by codex)
   * and fire `steering_consumed` for each so the chat UI removes the
   * lingering pending bubble. Called on turn completion, abort, dispose,
   * and connection loss.
   */
  _drainPendingSteering(session) {
    if (session.pendingSteeringFlips.size === 0) {
      return;
    }
    const ids = [...session.pendingSteeringFlips.keys()];
    session.pendingSteeringFlips.clear();
    for (const id of ids) {
      this._fireSteeringConsumed(session, id);
    }
  }
  _fireSteeringConsumed(session, id) {
    this._onDidSessionProgress.fire({ kind: "steering_consumed", chat: URI.parse(buildDefaultChatUri(session.sessionUri)), id });
  }
  _registerIgnoredNotifications(client) {
    const ignored = [
      "thread/started",
      // thread/start response is authoritative for session materialization.
      "thread/status/changed",
      // Codex thread status is not surfaced in Agent Host state yet.
      "thread/settings/updated",
      // VS Code owns session config; Codex settings echoes are not consumed yet.
      "thread/goal/updated",
      // Goals are not surfaced in the Agent Host UI yet.
      "thread/goal/cleared",
      // Goals are not surfaced in the Agent Host UI yet.
      "thread/compacted",
      // Deprecated completion echo; the contextCompaction item owns UI progress.
      "remoteControl/status/changed",
      // Remote-control state is not part of the VS Code integration.
      "serverRequest/resolved",
      // We resolve requests through JSON-RPC responses, so this echo is informational.
      "item/autoApprovalReview/started"
      // Informational; the completed notification drives the denied-action card.
    ];
    for (const method of ignored) {
      this._register(client.onNotification(method, () => {
      }));
    }
  }
  async _refreshAccount(client, publish = true) {
    try {
      const response = await client.request("account/read", { refreshToken: false });
      const state = codexAccountStateFromResponse(response);
      this._setOpenAIAccountState(state, publish);
      if (publish && state.status === "signedIn" && state.authType === "chatgpt") {
        void this._refreshAccountRateLimits(client, state.email);
      }
      this._logService.info(`[Codex] account/read accountType=${response.account?.type ?? "none"} requiresOpenaiAuth=${response.requiresOpenaiAuth}${state.planType ? ` planType=${state.planType}` : ""}`);
      return state;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._logService.warn(`[Codex] account/read failed: ${message}`);
      const state = { usageSource: "openai", status: "error", error: message };
      this._setOpenAIAccountState(state, publish);
      return state;
    }
  }
  async _refreshAccountRateLimits(client, accountEmail = this._openAIAccountState.email) {
    try {
      const response = await client.request("account/rateLimits/read", void 0);
      if (this._connection.kind !== "ready" || this._connection.client !== client || this._openAIAccountState.status !== "signedIn" || this._openAIAccountState.authType !== "chatgpt" || this._openAIAccountState.email !== accountEmail) {
        return;
      }
      this._openAIAccountRateLimit = codexAccountRateLimitFromResponse(response);
      this._publishAccountInfo(this._toAccountInfo(this._openAIAccountState));
    } catch (error) {
      this._logService.warn(`[Codex] account/rateLimits/read failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async _readProviderConfiguration() {
    const connection = await this._ensureConnection();
    const response = await connection.client.request("config/read", { includeLayers: true });
    const userLayer = response.layers?.find((layer) => layer.name.type === "user" && layer.name.profile === null) ?? response.layers?.find((layer) => layer.name.type === "user");
    const config = userLayer?.config && typeof userLayer.config === "object" && !Array.isArray(userLayer.config) ? userLayer.config : {};
    return {
      "codex.personality": this._readConfigurationValue(config, "personality") ?? "default",
      "codex.autoReviewPolicy": this._readConfigurationValue(config, "auto_review.policy") ?? ""
    };
  }
  async _writeProviderConfiguration(key, value) {
    const connection = await this._ensureConnection();
    await connection.client.request("config/batchWrite", {
      edits: key === "codex.autoReviewPolicy" && value === "" ? [{ keyPath: "auto_review", value: null, mergeStrategy: "replace" }] : key === "codex.personality" && value === "default" ? [{ keyPath: "personality", value: null, mergeStrategy: "replace" }] : [{ keyPath: key === "codex.personality" ? "personality" : "auto_review.policy", value, mergeStrategy: "replace" }],
      expectedVersion: null,
      reloadUserConfig: true
    });
  }
  _refreshProviderConfiguration() {
    return this._providerConfigurationRefresh ??= (async () => {
      try {
        if (this._connection.kind === "idle" && !await this._isSdkResolvableWithoutDownload()) {
          return;
        }
        this._providerConfigurationValues = await this._readProviderConfiguration();
        this._providerConfigurationReady = true;
        this._configurationService.updateRootConfig(this._providerConfigurationValues);
      } catch (error) {
        this._logService.warn(`[Codex] Failed to read config.toml: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this._providerConfigurationRefresh = void 0;
      }
    })();
  }
  _queueProviderConfigurationWrite() {
    if (!this._providerConfigurationReady) {
      return;
    }
    const values = this._configurationService.getRootConfigValues?.() ?? {};
    for (const key of ["codex.personality", "codex.autoReviewPolicy"]) {
      if (values[key] === this._providerConfigurationValues[key]) {
        continue;
      }
      const value = values[key];
      if (value === void 0) {
        continue;
      }
      this._providerConfigurationWrite = this._providerConfigurationWrite.then(async () => {
        if (this._providerConfigurationValues[key] === value) {
          return;
        }
        await this._writeProviderConfiguration(key, value);
        this._providerConfigurationValues[key] = value;
      }).catch((error) => this._logService.error(`[Codex] Failed to update config.toml: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
  _readConfigurationValue(config, keyPath) {
    let value = config;
    for (const segment of keyPath.split(".")) {
      if (!value || Array.isArray(value) || typeof value !== "object") {
        return void 0;
      }
      value = value[segment];
    }
    return value;
  }
  _dispatchByThread(threadId, mapFn) {
    const subagent = this._subagentsByThreadId.get(threadId);
    if (subagent) {
      const actions2 = mapFn(subagent.session);
      for (const action of actions2) {
        this._fireSubagent(subagent, action);
      }
      return;
    }
    const sessionId = this._sessionIdByThreadId.get(threadId);
    const session = sessionId ? this._sessions.get(sessionId) : void 0;
    if (!session) {
      this._logService.trace(`[Codex] Ignoring notification for untracked threadId=${threadId}; likely unclaimed prewarm`);
      return;
    }
    const actions = mapFn(session);
    for (const action of actions) {
      this._fire(session.sessionUri, action);
    }
  }
  /**
   * `item/completed` dispatch. In addition to the normal per-thread mapping,
   * a parent session's completed `spawnAgent` collab tool call now carries
   * the child `receiverThreadIds`, so we register each spawned subagent and
   * emit a `subagent_started` signal (before mapping the completion, so the
   * shared orchestrator has attached the subagent-chat block to the parent
   * tool call by the time it completes).
   */
  _dispatchItemCompleted(params) {
    const subagent = this._subagentsByThreadId.get(params.threadId);
    if (subagent) {
      const actions2 = mapItemCompleted(subagent.session.mapState, this._withHostTurnId(subagent.session, params));
      for (const action of actions2) {
        this._fireSubagent(subagent, action);
      }
      return;
    }
    const sessionId = this._sessionIdByThreadId.get(params.threadId);
    const session = sessionId ? this._sessions.get(sessionId) : void 0;
    if (!session) {
      this._logService.trace(`[Codex] Ignoring item/completed for untracked threadId=${params.threadId}; likely unclaimed prewarm`);
      return;
    }
    this._maybeRegisterSubagents(session, params);
    const actions = mapItemCompleted(session.mapState, this._withHostTurnId(session, params));
    for (const action of actions) {
      this._fire(session.sessionUri, action);
    }
  }
  /**
   * `turn/completed` dispatch. For a subagent child thread, route the turn's
   * flush/orphan actions to the peer chat but suppress its `ChatTurnComplete`
   * — the child chat's turn is closed cleanly (without the parent's
   * checkpoint/changeset/title side effects) by the `subagent_completed`
   * signal, which also tears down the child-thread tracking.
   */
  _dispatchTurnCompleted(params) {
    const subagent = this._subagentsByThreadId.get(params.threadId);
    if (subagent) {
      const actions = this._handleTurnCompletedNotification(subagent.session, params);
      for (const action of actions) {
        if (action.type === ActionType.ChatTurnComplete) {
          continue;
        }
        this._fireSubagent(subagent, action);
      }
      this._subagentsByThreadId.delete(params.threadId);
      subagent.session.pendingCommandApprovals.denyAll("decline");
      this._onDidSessionProgress.fire({
        kind: "subagent_completed",
        chat: URI.parse(buildDefaultChatUri(subagent.session.sessionUri)),
        toolCallId: subagent.toolCallId
      });
      return;
    }
    this._dispatchByThread(params.threadId, (s) => this._handleTurnCompletedNotification(s, params));
  }
  /**
   * When a parent session's `spawnAgent` collab tool call completes it
   * carries the child thread id(s) in `receiverThreadIds`. Register an
   * isolated subagent session for each new child thread and emit a
   * `subagent_started` signal so the shared orchestrator opens the read-only
   * peer chat and attaches its discovery block to the parent tool call.
   */
  _maybeRegisterSubagents(session, params) {
    const item = params.item;
    if (item.type !== "collabAgentToolCall" || item.tool !== "spawnAgent") {
      return;
    }
    const entry = session.mapState.itemToToolCall.get(item.id);
    if (!entry) {
      return;
    }
    const parentChat = URI.parse(buildDefaultChatUri(session.sessionUri));
    const model = item.model || void 0;
    const taskDescription = item.prompt || void 0;
    for (const childThreadId of item.receiverThreadIds) {
      if (this._subagentsByThreadId.has(childThreadId)) {
        continue;
      }
      const subSession = this._createSubagentSession(session, childThreadId);
      this._subagentsByThreadId.set(childThreadId, {
        parentSessionId: session.sessionId,
        toolCallId: entry.toolCallId,
        session: subSession
      });
      this._onDidSessionProgress.fire({
        kind: "subagent_started",
        chat: parentChat,
        toolCallId: entry.toolCallId,
        agentName: model ?? "codex",
        agentDisplayName: model ?? "Subagent",
        taskDescription,
        // Codex surfaces the full delegated instruction as `item.prompt`.
        taskPrompt: typeof item.prompt === "string" && item.prompt.length > 0 ? item.prompt : void 0
      });
      this._logService.trace(`[Codex:${session.sessionId}] subagent spawned thread=${childThreadId} toolCall=${entry.toolCallId} model=${model ?? "(default)"}`);
    }
  }
  /**
   * Build an isolated {@link ICodexSession} used to run the shared event
   * mappers for a subagent child thread. It shares the parent's `sessionUri`
   * (so side effects target the parent's working tree and the fired actions
   * resolve to the parent chat channel) and `acceptedForSession` memo (so the
   * accept-for-session decision spans parent + subagents), but has its own
   * fresh map/turn state and approval registry so the child's events don't
   * collide with the parent's.
   */
  _createSubagentSession(parent, childThreadId) {
    const clientToolSet = new ActiveClientToolSet();
    return {
      sessionId: parent.sessionId,
      threadId: childThreadId,
      sessionUri: parent.sessionUri,
      workingDirectory: parent.workingDirectory,
      workingDirectories: parent.workingDirectories,
      multiRootEnabled: parent.multiRootEnabled,
      managedWorkingDirectory: void 0,
      mapState: createCodexSessionMapState(new Set(this._serverToolHost?.toolNames ?? []), clientToolSet),
      pendingCommandApprovals: new PendingRequestRegistry(),
      acceptedForSession: parent.acceptedForSession,
      handledGuardianReviews: /* @__PURE__ */ new Set(),
      pendingGuardianReviewCards: /* @__PURE__ */ new Set(),
      pendingSteeringFlips: /* @__PURE__ */ new Map(),
      clientToolSet,
      pendingClientToolCalls: new PendingRequestRegistry(),
      pendingUserInputs: new PendingRequestRegistry(),
      materializedToolsSig: void 0,
      materializedMcpSig: void 0,
      materializedCustomizationsSig: void 0,
      firstTurnSent: true,
      model: parent.model,
      agent: parent.agent,
      customizationDirectory: void 0,
      currentTurnId: void 0,
      turnStopWatch: void 0,
      currentAppTurnId: void 0,
      hostTurnIdByAppTurnId: /* @__PURE__ */ new Map(),
      codexTurnIdByHostTurnId: /* @__PURE__ */ new Map(),
      needsResume: false,
      lastPromptText: "",
      disposed: false,
      materializePromise: void 0,
      materializedEventFired: true,
      prewarmTimer: void 0,
      prewarmClaimed: true,
      serverToolsAdvertised: true,
      mcpController: void 0,
      clientCustomizations: new CodexClientCustomizationStore()
    };
  }
  /**
   * Fire a subagent action tagged with the parent `spawnAgent` tool call.
   * The `resource` is the PARENT chat channel (the key the subagent chat is
   * registered under in the orchestrator); `parentToolCallId` routes the
   * action into the child's read-only peer chat.
   */
  _fireSubagent(subagent, action) {
    this._onDidSessionProgress.fire({
      kind: "action",
      resource: URI.parse(buildDefaultChatUri(subagent.session.sessionUri)),
      action,
      parentToolCallId: subagent.toolCallId
    });
  }
  /**
   * Phase 4: handle `item/commandExecution/requestApproval` from
   * codex. Look up the host-side tool call for the item, emit a
   * `ChatToolCallReady` in PendingConfirmation, park on a deferred
   * keyed by toolCallId, and resolve when the user (or the
   * accept-for-session memo) decides. Unknown sessions / items
   * decline silently so codex stops blocking.
   */
  async _handleCommandApprovalRequestRpc(params) {
    const decision = await this._handleCommandApprovalRequest(params);
    return { result: { decision } };
  }
  async _handleCommandApprovalRequest(params) {
    const target = this._resolveApprovalTarget(params.threadId);
    if (!target) {
      this._logService.warn(`[Codex] commandExecution/requestApproval for unknown threadId=${params.threadId}; declining`);
      return "decline";
    }
    const session = target.session;
    const entry = session.mapState.itemToToolCall.get(params.itemId);
    if (!entry) {
      this._logService.warn(`[Codex:${session.sessionId}] commandExecution/requestApproval for unknown itemId=${params.itemId}; declining`);
      return "decline";
    }
    const command = params.command ?? "";
    const displayCommand = unwrapShellInvocation(command);
    if (command && session.acceptedForSession.has(command)) {
      return "acceptForSession";
    }
    const confirmationTitle = params.reason ?? "Run shell command";
    const decision = await session.pendingCommandApprovals.registerAndFire(entry.toolCallId, () => {
      this._fireApproval(target, {
        type: ActionType.ChatToolCallReady,
        turnId: entry.turnId,
        toolCallId: entry.toolCallId,
        invocationMessage: displayCommand,
        toolInput: displayCommand,
        confirmationTitle
      });
    });
    if (decision === "acceptForSession" && command) {
      session.acceptedForSession.add(command);
    }
    return decision;
  }
  async _handleFileChangeApprovalRequestRpc(params) {
    const decision = await this._requestItemApproval(params.threadId, params.itemId, params.reason ?? "Apply file changes");
    return { result: { decision: narrowFileChangeDecision(decision) } };
  }
  async _handlePermissionsApprovalRequestRpc(params) {
    const decision = await this._requestItemApproval(params.threadId, params.itemId, params.reason ?? "Grant elevated permissions");
    const granted = decision === "accept" || decision === "acceptForSession";
    return {
      result: {
        // Grant exactly what was requested on accept; nothing on decline.
        permissions: granted ? { network: params.permissions.network ?? void 0, fileSystem: params.permissions.fileSystem ?? void 0 } : {},
        scope: decision === "acceptForSession" ? "session" : "turn"
      }
    };
  }
  /**
   * Shared approval flow for item-scoped `requestApproval` requests that
   * don't carry their own command string: look up the host tool call for
   * the item, fire a pending-confirmation `ChatToolCallReady`, and resolve
   * when the user (via {@link respondToPermissionRequest}) decides. Declines
   * if the session or item is unknown.
   */
  async _requestItemApproval(threadId, itemId, confirmationTitle) {
    const target = this._resolveApprovalTarget(threadId);
    if (!target) {
      this._logService.warn(`[Codex] approval request for unknown threadId=${threadId}; declining`);
      return "decline";
    }
    const session = target.session;
    const entry = session.mapState.itemToToolCall.get(itemId);
    if (!entry) {
      this._logService.warn(`[Codex:${session.sessionId}] approval request for unknown itemId=${itemId}; declining`);
      return "decline";
    }
    return session.pendingCommandApprovals.registerAndFire(entry.toolCallId, () => {
      this._fireApproval(target, {
        type: ActionType.ChatToolCallReady,
        turnId: entry.turnId,
        toolCallId: entry.toolCallId,
        invocationMessage: confirmationTitle,
        toolInput: confirmationTitle,
        confirmationTitle
      });
    });
  }
  /**
   * Resolve the {@link ICodexSession} that owns a codex thread for an
   * approval request, plus the subagent wrapper when the thread is a
   * collab-agent child. A subagent tool call's pending-confirmation
   * `ChatToolCallReady` must be fired with the parent `spawnAgent` tool call
   * as its `parentToolCallId` (via {@link _fireApproval}) so it lands in the
   * child's read-only peer chat — where the matching `ChatToolCallStart`
   * lives — instead of on the parent session.
   */
  _resolveApprovalTarget(threadId) {
    const subagent = this._subagentsByThreadId.get(threadId);
    if (subagent) {
      return { session: subagent.session, subagent };
    }
    const sessionId = this._sessionIdByThreadId.get(threadId);
    const session = sessionId ? this._sessions.get(sessionId) : void 0;
    return session ? { session } : void 0;
  }
  /** Fire an approval action to the parent session or the subagent peer chat. */
  _fireApproval(target, action) {
    if (target.subagent) {
      this._fireSubagent(target.subagent, action);
    } else {
      this._fire(target.session.sessionUri, action);
    }
  }
  _handleGuardianWarning(session, params) {
    const turnId = session.currentTurnId;
    if (turnId === void 0) {
      this._logService.trace(`[Codex:${session.sessionId}] guardianWarning without active turn; ignoring`);
      return [];
    }
    return [{
      type: ActionType.ChatResponsePart,
      turnId,
      part: {
        kind: ResponsePartKind.SystemNotification,
        content: params.message
      }
    }];
  }
  async _handleGuardianReviewCompleted(client, params) {
    const sessionId = this._sessionIdByThreadId.get(params.threadId);
    const session = sessionId ? this._sessions.get(sessionId) : void 0;
    if (!session) {
      this._logService.trace(`[Codex] autoApprovalReview/completed for unknown threadId=${params.threadId}; ignoring`);
      return;
    }
    if (params.review.status !== "denied") {
      return;
    }
    if (session.handledGuardianReviews.has(params.reviewId)) {
      return;
    }
    const turnId = this._hostTurnId(session, params.turnId);
    if (session.currentTurnId !== turnId) {
      this._logService.trace(`[Codex:${sessionId}] autoApprovalReview/completed for non-current turn ${turnId} (current=${session.currentTurnId ?? "(none)"}); ignoring reviewId=${params.reviewId}`);
      return;
    }
    session.handledGuardianReviews.add(params.reviewId);
    const summary = summarizeGuardianReviewAction(params.action);
    this._fire(session.sessionUri, {
      type: ActionType.ChatResponsePart,
      turnId,
      part: {
        kind: ResponsePartKind.Markdown,
        id: generateUuid(),
        content: formatGuardianDenialNotification(summary, params.review.rationale)
      }
    });
    const toolCallId = generateUuid();
    const invocationMessage = summary.detail || summary.title;
    const confirmationTitle = "Approve anyway";
    session.pendingGuardianReviewCards.add(toolCallId);
    let decision;
    try {
      decision = await session.pendingCommandApprovals.registerAndFire(toolCallId, () => {
        this._fire(session.sessionUri, {
          type: ActionType.ChatToolCallStart,
          turnId,
          toolCallId,
          toolName: "auto_review_denied",
          displayName: summary.title,
          intention: invocationMessage
        });
        this._fire(session.sessionUri, {
          type: ActionType.ChatToolCallReady,
          turnId,
          toolCallId,
          invocationMessage,
          confirmationTitle
        });
      });
    } catch (err) {
      this._logService.trace(`[Codex:${sessionId}] guardian approval cancelled for reviewId=${params.reviewId}: ${err instanceof Error ? err.message : String(err)}`);
      return;
    } finally {
      session.pendingGuardianReviewCards.delete(toolCallId);
    }
    if (decision !== "accept" && decision !== "acceptForSession") {
      return;
    }
    if (session.currentTurnId !== turnId) {
      this._logService.trace(`[Codex:${sessionId}] turn ended before guardian approval could be applied for reviewId=${params.reviewId}`);
      return;
    }
    try {
      await client.request("thread/approveGuardianDeniedAction", {
        threadId: params.threadId,
        event: toGuardianAssessmentEventJson(params)
      });
      this._fire(session.sessionUri, {
        type: ActionType.ChatToolCallComplete,
        turnId,
        toolCallId,
        result: {
          success: true,
          pastTenseMessage: "Approved anyway"
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._logService.warn(`[Codex:${sessionId}] approveGuardianDeniedAction failed for reviewId=${params.reviewId}: ${message}`);
      this._fire(session.sessionUri, {
        type: ActionType.ChatToolCallComplete,
        turnId,
        toolCallId,
        result: {
          success: false,
          pastTenseMessage: "Approval failed",
          error: { message }
        }
      });
    }
  }
  _handleConnectionLost() {
    const conn = this._connection;
    if (conn.kind !== "ready") {
      return;
    }
    this._connection = { kind: "idle" };
    for (const session of this._sessions.values()) {
      session.pendingCommandApprovals.denyAll("decline");
      session.pendingClientToolCalls.rejectAll(new CancellationError());
      session.pendingUserInputs.rejectAll(new CancellationError());
      this._drainPendingSteering(session);
      const turnId = session.currentTurnId;
      const appTurnId = session.currentAppTurnId;
      session.currentTurnId = void 0;
      session.currentAppTurnId = void 0;
      if (appTurnId) {
        session.hostTurnIdByAppTurnId.delete(appTurnId);
      }
      if (turnId) {
        const duration = this._clearTurnStopWatch(session);
        this._fire(session.sessionUri, {
          type: ActionType.ChatError,
          turnId,
          duration,
          error: { errorType: "CodexDisconnected", message: "Codex app-server disconnected; session must restart." }
        });
        this._fire(session.sessionUri, { type: ActionType.ChatTurnComplete, turnId, duration });
      }
    }
    for (const subagent of this._subagentsByThreadId.values()) {
      subagent.session.pendingCommandApprovals.denyAll("decline");
      subagent.session.pendingClientToolCalls.rejectAll(new CancellationError());
      subagent.session.pendingUserInputs.rejectAll(new CancellationError());
      subagent.session.currentTurnId = void 0;
      subagent.session.currentAppTurnId = void 0;
    }
    this._subagentsByThreadId.clear();
    try {
      conn.client.dispose();
    } catch (err) {
      this._logService.error(`[Codex] Failed to dispose app-server client after connection lost: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      conn.proxyHandle?.dispose();
    } catch (err) {
      this._logService.error(`[Codex] Failed to dispose proxy handle after connection lost: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  _disposeConnection() {
    const connection = this._connection;
    this._connectionGeneration++;
    this._connection = { kind: "idle" };
    if (connection.kind !== "ready") {
      return;
    }
    try {
      connection.client.dispose();
    } catch {
    }
    try {
      connection.proxyHandle?.dispose();
    } catch {
    }
    try {
      connection.child.kill("SIGKILL");
    } catch {
    }
  }
  // #endregion
  // #region IAgent methods
  getDescriptor() {
    return {
      provider: this.id,
      displayName: localize("codexAgent.displayName", "Codex"),
      description: localize("codexAgent.description", "Codex agent using session-selected model providers"),
      ...this._isMultiRootEnabled() ? { capabilities: { multipleWorkingDirectories: { immutablePrimary: true } } } : {}
    };
  }
  _isMultiRootEnabled() {
    return this._configurationService.getRootValue(platformRootSchema, AgentHostCodexMultiRootEnabledConfigKey) === true;
  }
  _sessionUriFromChat(chat) {
    const parsed = parseChatUri(chat);
    return parsed ? URI.parse(parsed.session) : chat;
  }
  async _changeAgent(chat, agent) {
    const sessionUri = this._sessionUriFromChat(chat);
    const session = this._sessions.get(AgentSession.id(sessionUri));
    if (!session) {
      await this._metadataStore.write(sessionUri, { agent: agent ?? null });
      return;
    }
    session.agent = agent;
    await this._metadataStore.write(sessionUri, { agent: agent ?? null });
    if (session.threadId === void 0) {
      return;
    }
    if (!session.firstTurnSent) {
      await this._restartThreadWithCurrentTools(session);
      this._persistMaterializedSession(session);
    } else {
      session.needsResume = true;
    }
  }
  async createSession(config = {}) {
    this._logService.info(`[Codex DEBUG] createSession accountStatus=${this._openAIAccountState.status} session=${config.session?.toString() ?? "(none)"} model=${config.model?.id ?? "(none)"} cwd=${config.workingDirectories?.[0]?.toString() ?? "(none)"}`);
    if (config.fork) {
      return this._forkSession(config, config.fork);
    }
    const effectiveModel = this._supportedModelOrUndefined(config.model);
    if (config.model && !effectiveModel) {
      throw new Error(`Codex model '${config.model.id}' is not available.`);
    }
    this._ensureModelProviderAuthenticated(effectiveModel);
    const sessionId = config.session ? AgentSession.id(config.session) : generateUuid();
    const sessionUri = config.session ?? AgentSession.uri(this.id, sessionId);
    const multiRootEnabled = this._isMultiRootEnabled();
    const workingDirectories = multiRootEnabled && (config.workingDirectories?.length ?? 0) > 1 ? distinctWorkingDirectories(config.workingDirectories) : void 0;
    const existing = this._sessions.get(sessionId);
    if (existing) {
      existing.model = effectiveModel ?? existing.model;
      existing.agent = config.agent ?? existing.agent;
      await this._seedEagerActiveClient(sessionUri, config.activeClient);
      const cwd = existing.workingDirectory ?? config.workingDirectories?.[0];
      return {
        session: sessionUri,
        resolvedWorkingDirectory: cwd,
        provisional: existing.threadId === void 0
      };
    }
    const clientToolSet = new ActiveClientToolSet();
    const session = {
      sessionId,
      threadId: void 0,
      sessionUri,
      workingDirectory: config.workingDirectories?.[0],
      workingDirectories,
      multiRootEnabled,
      managedWorkingDirectory: void 0,
      mapState: createCodexSessionMapState(new Set(this._serverToolHost?.toolNames ?? []), clientToolSet),
      pendingCommandApprovals: new PendingRequestRegistry(),
      acceptedForSession: /* @__PURE__ */ new Set(),
      handledGuardianReviews: /* @__PURE__ */ new Set(),
      pendingGuardianReviewCards: /* @__PURE__ */ new Set(),
      pendingSteeringFlips: /* @__PURE__ */ new Map(),
      clientToolSet,
      pendingClientToolCalls: new PendingRequestRegistry(),
      pendingUserInputs: new PendingRequestRegistry(),
      materializedToolsSig: void 0,
      materializedMcpSig: void 0,
      materializedCustomizationsSig: void 0,
      firstTurnSent: false,
      model: effectiveModel,
      agent: config.agent,
      customizationDirectory: void 0,
      currentTurnId: void 0,
      turnStopWatch: void 0,
      currentAppTurnId: void 0,
      hostTurnIdByAppTurnId: /* @__PURE__ */ new Map(),
      codexTurnIdByHostTurnId: /* @__PURE__ */ new Map(),
      needsResume: false,
      lastPromptText: "",
      disposed: false,
      materializePromise: void 0,
      materializedEventFired: false,
      prewarmTimer: void 0,
      prewarmClaimed: false,
      serverToolsAdvertised: false,
      mcpController: void 0,
      clientCustomizations: new CodexClientCustomizationStore()
    };
    this._sessions.set(sessionId, session);
    await this._seedEagerActiveClient(sessionUri, config.activeClient);
    this._schedulePrewarm(session);
    return {
      session: sessionUri,
      resolvedWorkingDirectory: config.workingDirectories?.[0],
      provisional: true
    };
  }
  /**
   * Seed the active client supplied with `createSession` before the agent host
   * asks for the initial customization snapshot. The initial state is assigned
   * directly rather than dispatched as `session/activeClientSet`, so without
   * this step Codex would not receive the client's tools or customizations until
   * a later turn happened to re-register the client.
   */
  async _seedEagerActiveClient(sessionUri, activeClient) {
    if (!activeClient) {
      return;
    }
    const handle = this.getOrCreateActiveClient(sessionUri, { clientId: activeClient.clientId, displayName: activeClient.displayName });
    handle.tools = activeClient.tools;
    if (activeClient.customizations !== void 0) {
      await this._syncClientCustomizations(sessionUri, activeClient.clientId, activeClient.customizations, { quiet: true });
    }
  }
  /**
   * Build an {@link ICodexSession} entry for a thread that already exists on
   * the app-server (a restored session or a freshly forked one). Such a
   * session skips materialization — its first {@link _sendMessage} issues a
   * `thread/resume` (`needsResume: true`) — so the prewarm/first-turn flags
   * are pre-set to their post-materialization values.
   */
  _createResumedSessionEntry(sessionId, threadId, sessionUri, workingDirectory, model, workingDirectories, multiRootEnabled, agent) {
    const clientToolSet = new ActiveClientToolSet();
    const effectiveWorkingDirectories = distinctWorkingDirectories(workingDirectories);
    return {
      sessionId,
      threadId,
      sessionUri,
      workingDirectory: effectiveWorkingDirectories?.[0] ?? workingDirectory,
      workingDirectories: effectiveWorkingDirectories,
      multiRootEnabled: multiRootEnabled ?? (effectiveWorkingDirectories?.length ?? 0) > 1,
      managedWorkingDirectory: void 0,
      mapState: createCodexSessionMapState(new Set(this._serverToolHost?.toolNames ?? []), clientToolSet),
      pendingCommandApprovals: new PendingRequestRegistry(),
      acceptedForSession: /* @__PURE__ */ new Set(),
      handledGuardianReviews: /* @__PURE__ */ new Set(),
      pendingGuardianReviewCards: /* @__PURE__ */ new Set(),
      pendingSteeringFlips: /* @__PURE__ */ new Map(),
      clientToolSet,
      pendingClientToolCalls: new PendingRequestRegistry(),
      pendingUserInputs: new PendingRequestRegistry(),
      materializedToolsSig: void 0,
      materializedMcpSig: void 0,
      materializedCustomizationsSig: void 0,
      firstTurnSent: true,
      model,
      agent,
      customizationDirectory: void 0,
      currentTurnId: void 0,
      turnStopWatch: void 0,
      currentAppTurnId: void 0,
      hostTurnIdByAppTurnId: /* @__PURE__ */ new Map(),
      codexTurnIdByHostTurnId: /* @__PURE__ */ new Map(),
      needsResume: true,
      lastPromptText: "",
      disposed: false,
      materializePromise: void 0,
      materializedEventFired: true,
      prewarmTimer: void 0,
      prewarmClaimed: true,
      serverToolsAdvertised: false,
      mcpController: void 0,
      clientCustomizations: new CodexClientCustomizationStore()
    };
  }
  /**
   * Fork an existing codex session at a turn into a brand-new session.
   *
   * Codex is single-chat, so the workbench routes the "fork conversation"
   * gesture here (via {@link AgentHostSessionHandler}) instead of minting a
   * peer chat. We `thread/fork` the source thread — which copies its full
   * history — then `thread/rollback` the trailing turns so the fork retains
   * only the turns up to and including `fork.turnId`. The forked thread is
   * registered as a resumable session (its first send issues a
   * `thread/resume`) keyed by its new thread id, preserving the Codex
   * convention that a session id equals its thread id.
   */
  async _forkSession(config, fork) {
    const sourceRead = await this._readSession(fork.session);
    if (!sourceRead) {
      throw new Error(`Cannot fork codex session ${fork.session.toString()}: source thread could not be read`);
    }
    const sourceThreadId = sourceRead.thread.id;
    const sourceTurns = sourceRead.thread.turns ?? [];
    const sourceSession = this._sessions.get(AgentSession.id(fork.session));
    const sourcePrimary = sourceRead.thread.cwd ? URI.file(sourceRead.thread.cwd) : config.workingDirectories?.[0];
    const sourceStoredWorkingDirectories = sourceSession?.workingDirectories ?? sourceRead.persistedWorkingDirectories;
    const inheritedWorkingDirectories = sourcePrimary ? distinctWorkingDirectories([sourcePrimary, ...sourceStoredWorkingDirectories?.slice(1) ?? []]) : void 0;
    const multiRootEnabled = sourceSession?.multiRootEnabled ?? (inheritedWorkingDirectories?.length ?? 0) > 1;
    const runtimeWorkspaceRoots = multiRootEnabled && inheritedWorkingDirectories && inheritedWorkingDirectories.length > 1 ? distinctAbsolutePaths(inheritedWorkingDirectories.map((directory) => directory.fsPath)) : void 0;
    const codexTurnId = sourceSession?.codexTurnIdByHostTurnId.get(fork.turnId) ?? fork.turnId;
    const boundary = resolveForkBoundary(sourceTurns.map((t) => t.id), codexTurnId, fork.turnIndex);
    if (!boundary.resolved) {
      throw new Error(`Cannot fork codex session ${sourceThreadId}: unable to resolve fork boundary for turn ${fork.turnId} (turnIndex=${fork.turnIndex}, turns=${sourceTurns.length})`);
    }
    const { keepThroughIndex, numTurnsToDrop } = boundary;
    const conn = await this._ensureConnection();
    const inheritedModel = sourceSession?.model ?? (sourceRead.persistedModelId ? { id: sourceRead.persistedModelId } : void 0) ?? this._models.get().find((candidate) => parseCodexModelSelection(candidate).modelProvider === sourceRead.thread.modelProvider);
    const requestedModel = config.model ?? inheritedModel;
    const model = this._supportedModelOrUndefined(requestedModel);
    if (requestedModel && !model) {
      throw new Error(`Codex model '${requestedModel.id}' is not available.`);
    }
    this._ensureModelProviderAuthenticated(model);
    const resolvedModel = model ? parseCodexModelSelection(model) : void 0;
    const sourceConfigValues = this._configurationService.getSessionConfigValues(fork.session.toString());
    const forkDefaults = {
      approvalPolicy: codexSessionConfigDefaults[CodexSessionConfigKey.ApprovalPolicy],
      sandboxMode: codexSessionConfigDefaults[CodexSessionConfigKey.SandboxMode]
    };
    const { approvalPolicy, sandboxMode, approvalsReviewer } = resolveCodexPermissions(
      migrateCodexPermissionValues({ ...sourceConfigValues, ...config.config }, forkDefaults),
      forkDefaults
    );
    const forkResult = await conn.client.request("thread/fork", {
      threadId: sourceThreadId,
      ...runtimeWorkspaceRoots?.length ? {
        cwd: runtimeWorkspaceRoots[0],
        runtimeWorkspaceRoots
      } : {},
      ...resolvedModel ? { model: resolvedModel.modelId, modelProvider: resolvedModel.modelProvider } : {},
      approvalPolicy,
      sandbox: sandboxMode,
      approvalsReviewer
    });
    const newThreadId = forkResult.thread.id;
    if (numTurnsToDrop > 0) {
      try {
        await conn.client.request("thread/rollback", { threadId: newThreadId, numTurns: numTurnsToDrop });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this._logService.warn(`[Codex:${newThreadId}] fork rollback failed (numTurns=${numTurnsToDrop}); discarding fork: ${message}`);
        try {
          await conn.client.request("thread/archive", { threadId: newThreadId });
        } catch (archiveErr) {
          this._logService.warn(`[Codex:${newThreadId}] failed to archive orphaned fork after rollback failure: ${archiveErr instanceof Error ? archiveErr.message : String(archiveErr)}`);
        }
        throw new Error(`Failed to fork codex session ${sourceThreadId}: could not roll back forked thread ${newThreadId} to the requested turn (${message})`);
      }
    }
    const newSessionUri = AgentSession.uri(this.id, newThreadId);
    const workingDirectory = forkResult.cwd ? URI.file(forkResult.cwd) : sourceRead.thread.cwd ? URI.file(sourceRead.thread.cwd) : config.workingDirectories?.[0];
    const forkWorkingDirectories = multiRootEnabled ? distinctWorkingDirectories(
      forkResult.runtimeWorkspaceRoots?.length ? forkResult.runtimeWorkspaceRoots.map((path) => URI.file(path)) : inheritedWorkingDirectories
    ) : void 0;
    const session = this._createResumedSessionEntry(
      newThreadId,
      newThreadId,
      newSessionUri,
      workingDirectory,
      model,
      forkWorkingDirectories,
      multiRootEnabled,
      config.agent ?? sourceSession?.agent
    );
    this._sessions.set(newThreadId, session);
    this._sessionIdByThreadId.set(newThreadId, newThreadId);
    if (!session.serverToolsAdvertised && this._serverToolHost) {
      session.serverToolsAdvertised = true;
      this._serverToolHost.advertise(session.sessionUri.toString());
    }
    this._persistMaterializedSession(session);
    if (fork.turnIdMapping && fork.turnIdMapping.size > 0) {
      try {
        const forkedRead = await this._readSession(newSessionUri);
        const forkedTurns = forkedRead?.thread.turns ?? [];
        const entries = planForkedTurnIdMap(
          sourceTurns.map((t) => t.id),
          forkedTurns.map((t) => t.id),
          keepThroughIndex,
          sourceSession?.hostTurnIdByAppTurnId,
          fork.turnIdMapping
        );
        for (const [hostTurnId, forkedCodexTurnId] of entries) {
          session.codexTurnIdByHostTurnId.set(hostTurnId, forkedCodexTurnId);
        }
      } catch (err) {
        this._logService.warn(`[Codex:${newThreadId}] failed to seed forked turn-id map: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this._logService.info(`[Codex] forked session ${sourceThreadId} \u2192 ${newThreadId} (kept ${sourceTurns.length - numTurnsToDrop}/${sourceTurns.length} turns)`);
    return {
      session: newSessionUri,
      resolvedWorkingDirectory: workingDirectory,
      provisional: false
    };
  }
  /**
   * Lazily start (or resume) a codex thread for `session`. Idempotent:
   * if `threadId` is already populated, just returns. Called from
   * `sendMessage` before the first `turn/start`.
   */
  async _materializeIfNeeded(session, fireMaterializedEvent = true) {
    if (session.disposed) {
      return;
    }
    if (session.threadId !== void 0) {
      if (fireMaterializedEvent) {
        this._fireMaterialized(session);
      }
      return;
    }
    if (session.materializePromise) {
      await session.materializePromise;
      if (fireMaterializedEvent) {
        this._fireMaterialized(session);
      }
      return;
    }
    session.materializePromise = this._materialize(session).finally(() => {
      session.materializePromise = void 0;
    });
    await session.materializePromise;
    if (fireMaterializedEvent) {
      this._fireMaterialized(session);
    }
  }
  _traceContext(session) {
    return this._otelService.getSessionTraceContext(session.sessionId, session.sessionUri.toString());
  }
  async _materialize(session) {
    if (session.disposed) {
      return;
    }
    if (!session.workingDirectory) {
      const dir = join(os.tmpdir(), "vscode-agent-codex", session.sessionId);
      await fs.promises.mkdir(dir, { recursive: true });
      session.workingDirectory = URI.file(dir);
      session.managedWorkingDirectory = session.workingDirectory;
      this._logService.info(`[Codex] no working directory supplied for session=${session.sessionUri.toString()}; using managed temp folder ${dir}`);
    }
    const conn = await this._ensureConnection();
    const config = this._readSessionConfig(session);
    const model = await this._resolveModel(session);
    const { approvalPolicy, sandboxMode, approvalsReviewer } = this._resolveSessionPermissions(session);
    const mcpServers = this._buildSessionMcpServers(session);
    const customizationLaunch = await this._buildCustomizationLaunch(session);
    const threadConfig = {
      web_search: narrowWebSearchMode(config[CodexSessionConfigKey.WebSearchMode]) ?? codexSessionConfigDefaults[CodexSessionConfigKey.WebSearchMode],
      ...customizationLaunch.config
    };
    const mcpServerNames = Object.keys(mcpServers);
    if (mcpServerNames.length > 0) {
      threadConfig.mcp_servers = mcpServers;
      this._logService.info(`[Codex] thread/start for session=${session.sessionUri.toString()} with ${mcpServerNames.length} MCP server(s): ${mcpServerNames.join(", ")}`);
    }
    const multiRootActive = this._isMultiRootActive(session);
    const runtimeWorkspaceRoots = multiRootActive ? this._runtimeWorkspaceRoots(session) : void 0;
    const selectedCapabilityRoots = [
      ...multiRootActive ? await this._selectedCapabilityRoots(session) : [],
      ...customizationLaunch.selectedCapabilityRoots
    ];
    const startResult = await conn.client.request("thread/start", {
      cwd: session.workingDirectory.fsPath,
      ...runtimeWorkspaceRoots?.length ? { runtimeWorkspaceRoots } : {},
      ...selectedCapabilityRoots.length ? { selectedCapabilityRoots } : {},
      model: parseCodexModelSelection(model).modelId,
      modelProvider: parseCodexModelSelection(model).modelProvider,
      approvalPolicy,
      sandbox: sandboxMode,
      approvalsReviewer,
      config: threadConfig,
      developerInstructions: customizationLaunch.developerInstructions,
      dynamicTools: this._buildDynamicTools(session)
    }, this._traceContext(session));
    const threadId = startResult.thread.id;
    if (multiRootActive && !session.workingDirectories && startResult.runtimeWorkspaceRoots?.length) {
      session.workingDirectories = startResult.runtimeWorkspaceRoots.map((path) => URI.file(path));
      session.workingDirectory = session.workingDirectories[0];
    }
    if (session.disposed) {
      try {
        await conn.client.request("thread/unsubscribe", { threadId });
      } catch (err) {
        this._logService.info(`[Codex:${threadId}] thread/unsubscribe after disposed prewarm failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }
    session.threadId = threadId;
    session.materializedMcpSig = mcpServersSignature(mcpServers);
    session.materializedCustomizationsSig = customizationLaunch.signature;
    session.materializedToolsSig = toolsSignature(session.clientToolSet.merged());
    this._logService.info(`[Codex DEBUG] materialized session=${session.sessionUri.toString()} threadId=${session.threadId}`);
    this._sessionIdByThreadId.set(session.threadId, session.sessionId);
    if (!session.serverToolsAdvertised && this._serverToolHost) {
      session.serverToolsAdvertised = true;
      this._serverToolHost.advertise(session.sessionUri.toString());
    }
    void this._refreshSkillHookCustomizations(session);
    void this._refreshSkillExtraRoots();
  }
  /**
   * Tear down the current codex thread and start a fresh one so the
   * session's current client tools are registered as `dynamicTools`.
   * Only safe before any turn has committed history on the thread.
   */
  async _restartThreadWithCurrentTools(session) {
    const conn = this._connection;
    const oldThreadId = session.threadId;
    this._logService.info(`[Codex:${session.sessionId}] restarting thread ${oldThreadId} to apply client tools [${session.clientToolSet.merged().map((t) => t.name).join(", ") || "(none)"}]`);
    if (conn.kind === "ready" && oldThreadId !== void 0) {
      this._sessionIdByThreadId.delete(oldThreadId);
      try {
        await conn.client.request("thread/unsubscribe", { threadId: oldThreadId });
      } catch (err) {
        this._logService.info(`[Codex:${oldThreadId}] thread/unsubscribe during tool restart failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    session.threadId = void 0;
    session.materializePromise = void 0;
    await this._materializeIfNeeded(session);
  }
  _fireMaterialized(session) {
    if (session.disposed) {
      return;
    }
    if (session.materializedEventFired) {
      return;
    }
    session.materializedEventFired = true;
    this._onDidMaterializeSession.fire({
      session: session.sessionUri,
      project: void 0,
      workingDirectories: session.workingDirectories ?? (session.workingDirectory ? [session.workingDirectory] : void 0)
    });
  }
  _schedulePrewarm(session) {
    if (!session.workingDirectory) {
      return;
    }
    if (this._configurationService.isWorkingDirectoryPending(session.sessionUri.toString())) {
      return;
    }
    void (async () => {
      if (!await this._agentSdkDownloader.isSdkResolvableWithoutDownload(CodexSdkPackage)) {
        this._logService.info(`[Codex] SDK not downloaded yet; skipping prewarm for session=${session.sessionUri.toString()} until a message triggers the download`);
        return;
      }
      await this._materializeIfNeeded(session, false);
      if (session.prewarmClaimed || session.threadId === void 0) {
        return;
      }
      this._logService.info(`[Codex] prewarm ready session=${session.sessionUri.toString()} threadId=${session.threadId}`);
      const prewarmTimer = setTimeout(() => {
        void this._expirePrewarm(session);
      }, CodexPrewarmTtlMs);
      session.prewarmTimer = prewarmTimer;
    })().catch((err) => {
      this._logService.warn(`[Codex] prewarm failed session=${session.sessionUri.toString()}: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
  async _expirePrewarm(session) {
    if (session.disposed || session.prewarmClaimed || session.threadId === void 0) {
      return;
    }
    const threadId = session.threadId;
    session.threadId = void 0;
    this._sessionIdByThreadId.delete(threadId);
    try {
      const conn = await this._ensureConnection();
      await conn.client.request("thread/unsubscribe", { threadId });
      this._logService.info(`[Codex] prewarm TTL eviction session=${session.sessionUri.toString()} threadId=${threadId}`);
    } catch (err) {
      this._logService.warn(`[Codex] prewarm TTL eviction failed session=${session.sessionUri.toString()} threadId=${threadId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  _persistMaterializedSession(session) {
    if (session.disposed || !session.threadId) {
      return;
    }
    const multiRootActive = this._isMultiRootActive(session);
    const fields = {
      threadId: session.threadId,
      cwd: session.workingDirectory,
      modelId: session.model?.id,
      agent: session.agent,
      workingDirectories: multiRootActive ? session.workingDirectories : void 0
    };
    void this._metadataStore.write(session.sessionUri, fields);
    if (multiRootActive) {
      const canonicalSessionUri = AgentSession.uri(this.id, session.threadId);
      if (!isEqual(session.sessionUri, canonicalSessionUri)) {
        void this._metadataStore.write(canonicalSessionUri, fields);
      }
    }
  }
  async _persistSessionModel(session) {
    if (session.disposed || !session.model) {
      return;
    }
    const fields = { modelId: session.model.id };
    await this._metadataStore.write(session.sessionUri, fields);
    if (this._isMultiRootActive(session)) {
      const canonicalSessionUri = AgentSession.uri(this.id, session.threadId ?? session.sessionId);
      if (canonicalSessionUri.toString() !== session.sessionUri.toString()) {
        await this._metadataStore.write(canonicalSessionUri, fields);
      }
    }
  }
  _claimPrewarm(session) {
    session.prewarmClaimed = true;
    if (session.prewarmTimer) {
      clearTimeout(session.prewarmTimer);
      session.prewarmTimer = void 0;
    }
  }
  async _adoptWorkingDirectoryBeforeSend(session, workingDirectory) {
    if (!workingDirectory || isEqual(session.workingDirectory, workingDirectory)) {
      return;
    }
    if (session.prewarmClaimed) {
      if (session.threadId === void 0 && !session.materializePromise) {
        session.workingDirectory = workingDirectory;
        if (this._isMultiRootActive(session)) {
          session.workingDirectories = distinctWorkingDirectories([
            workingDirectory,
            ...session.workingDirectories?.slice(1) ?? []
          ]);
        }
      }
      return;
    }
    this._claimPrewarm(session);
    const materializePromise = session.materializePromise;
    if (materializePromise) {
      try {
        await materializePromise;
      } catch (err) {
        this._logService.info(`[Codex] stale prewarm failed before working directory changed for session=${session.sessionUri.toString()}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const threadId = session.threadId;
    if (threadId !== void 0) {
      session.threadId = void 0;
      this._sessionIdByThreadId.delete(threadId);
      const conn = this._connection;
      if (conn.kind === "ready") {
        try {
          await conn.client.request("thread/unsubscribe", { threadId });
        } catch (err) {
          this._logService.warn(`[Codex] stale prewarm unsubscribe failed session=${session.sessionUri.toString()} threadId=${threadId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    session.workingDirectory = workingDirectory;
  }
  _startTurnStopWatch(session) {
    const stopWatch = StopWatch.create(false);
    session.turnStopWatch = stopWatch;
    return stopWatch;
  }
  _clearTurnStopWatch(session) {
    const elapsed = session.turnStopWatch?.elapsed();
    session.turnStopWatch = void 0;
    return typeof elapsed === "number" && Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  }
  async _sendMessage(chat, prompt, attachments, turnId, workingDirectories) {
    const sessionUri = this._sessionUriFromChat(chat);
    this._logService.info(`[Codex DEBUG] sendMessage session=${sessionUri.toString()} prompt=${JSON.stringify(prompt).slice(0, 60)}`);
    const sessionId = AgentSession.id(sessionUri);
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Codex session not found: ${sessionUri.toString()}`);
    }
    this._ensureModelProviderAuthenticated(session.model);
    await this._adoptWorkingDirectoryBeforeSend(session, workingDirectories?.[0]);
    if (workingDirectories) {
      session.workingDirectories = session.multiRootEnabled && workingDirectories.length > 1 ? distinctWorkingDirectories([
        session.workingDirectory ?? workingDirectories[0],
        ...workingDirectories.slice(1)
      ]) : workingDirectories;
    }
    const conn = await this._ensureConnection();
    const effectiveTurnId = turnId ?? generateUuid();
    try {
      this._claimPrewarm(session);
      await this._materializeIfNeeded(session);
      this._persistMaterializedSession(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._logService.error(`[Codex:${sessionId}] materialize failed: ${message}`);
      const duration = this._clearTurnStopWatch(session);
      this._fire(sessionUri, {
        type: ActionType.ChatError,
        turnId: effectiveTurnId,
        duration,
        error: { errorType: "CodexMaterializeFailed", message }
      });
      this._fire(sessionUri, { type: ActionType.ChatTurnComplete, turnId: effectiveTurnId, duration });
      return;
    }
    if (!session.firstTurnSent && !session.needsResume) {
      const baselineWorkingDirectories = session.workingDirectories ?? (session.workingDirectory ? [session.workingDirectory] : void 0);
      this._checkpointService.captureBaselineCheckpoint(sessionUri, baselineWorkingDirectories).catch((err) => {
        this._logService.warn(`[Codex:${sessionId}] Baseline checkpoint capture failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
    const toolsChanged = toolsSignature(session.clientToolSet.merged()) !== session.materializedToolsSig;
    const mcpChanged = mcpServersSignature(this._buildSessionMcpServers(session)) !== session.materializedMcpSig;
    const customizationLaunch = await this._buildCustomizationLaunch(session);
    const customizationsChanged = customizationLaunch.signature !== session.materializedCustomizationsSig;
    if (!session.firstTurnSent && !session.needsResume && (toolsChanged || mcpChanged || customizationsChanged)) {
      try {
        await this._restartThreadWithCurrentTools(session);
        this._persistMaterializedSession(session);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this._logService.error(`[Codex:${sessionId}] tool re-materialize failed: ${message}`);
        const duration = this._clearTurnStopWatch(session);
        this._fire(sessionUri, {
          type: ActionType.ChatError,
          turnId: effectiveTurnId,
          duration,
          error: { errorType: "CodexMaterializeFailed", message }
        });
        this._fire(sessionUri, { type: ActionType.ChatTurnComplete, turnId: effectiveTurnId, duration });
        return;
      }
    }
    const threadId = session.threadId;
    if (session.needsResume) {
      try {
        const mcpServers = this._buildSessionMcpServers(session);
        const customizationLaunch2 = await this._buildCustomizationLaunch(session);
        const multiRootActive = this._isMultiRootActive(session);
        const runtimeWorkspaceRoots = multiRootActive ? this._runtimeWorkspaceRoots(session) : void 0;
        const resumeResult = await conn.client.request(
          "thread/resume",
          buildCodexResumeParams(
            parseCodexModelSelection(await this._resolveModel(session)).modelProvider,
            threadId,
            mcpServers,
            runtimeWorkspaceRoots,
            customizationLaunch2.config,
            customizationLaunch2.developerInstructions
          ),
          this._traceContext(session)
        );
        if (multiRootActive && !session.workingDirectories && resumeResult.runtimeWorkspaceRoots?.length) {
          session.workingDirectories = resumeResult.runtimeWorkspaceRoots.map((path) => URI.file(path));
          session.workingDirectory = session.workingDirectories[0];
        }
        session.materializedMcpSig = mcpServersSignature(mcpServers);
        session.materializedCustomizationsSig = customizationLaunch2.signature;
        session.needsResume = false;
      } catch (err) {
        const duration = this._clearTurnStopWatch(session);
        this._fire(sessionUri, {
          type: ActionType.ChatError,
          turnId: effectiveTurnId,
          duration,
          error: {
            errorType: "CodexResumeFailed",
            message: err instanceof Error ? err.message : String(err)
          }
        });
        this._fire(sessionUri, { type: ActionType.ChatTurnComplete, turnId: effectiveTurnId, duration });
        return;
      }
    }
    session.lastPromptText = prompt;
    session.currentTurnId = effectiveTurnId;
    this._startTurnStopWatch(session);
    let cleanupPaths = [];
    const isCompactCommand = parseLeadingSlashCommand(prompt)?.command === CODEX_COMPACT_SLASH_COMMAND;
    try {
      if (isCompactCommand) {
        await conn.client.request("thread/compact/start", { threadId }, this._traceContext(session));
        session.firstTurnSent = true;
        return;
      }
      const resolvedInput = resolveCodexInput(prompt, attachments);
      cleanupPaths = resolvedInput.cleanupPaths;
      const model = await this._resolveModel(session);
      const resolvedModel = parseCodexModelSelection(model);
      const turnOptions = this._turnStartOptions(session, resolvedModel.modelId, customizationLaunch.developerInstructions);
      await conn.client.request("turn/start", {
        threadId,
        input: resolvedInput.input.slice(),
        model: resolvedModel.modelId,
        ...turnOptions
      }, this._traceContext(session));
      session.firstTurnSent = true;
    } catch (err) {
      if (err instanceof CancellationError) {
        this._fire(sessionUri, { type: ActionType.ChatTurnCancelled, turnId: effectiveTurnId, duration: this._clearTurnStopWatch(session) });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      const operation = isCompactCommand ? "thread/compact/start" : "turn/start";
      this._logService.error(`[Codex:${sessionId}] ${operation} error: ${message}`);
      const duration = this._clearTurnStopWatch(session);
      this._fire(sessionUri, {
        type: ActionType.ChatError,
        turnId: effectiveTurnId,
        duration,
        error: { errorType: isCompactCommand ? "CodexCompactionError" : "CodexTurnError", ...extractForwardedErrorInfo(message) }
      });
      this._fire(sessionUri, { type: ActionType.ChatTurnComplete, turnId: effectiveTurnId, duration });
    } finally {
      if (cleanupPaths.length > 0) {
        setTimeout(() => {
          for (const p of cleanupPaths) {
            try {
              fs.unlinkSync(p);
            } catch {
            }
          }
        }, 3e4);
      }
    }
  }
  setPendingMessages(chat, steeringMessage, _queuedMessages) {
    if (!steeringMessage) {
      return;
    }
    const sessionUri = this._sessionUriFromChat(chat);
    const sessionId = AgentSession.id(sessionUri);
    const session = this._sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.pendingSteeringFlips.has(steeringMessage.id)) {
      return;
    }
    const appTurnId = session.currentAppTurnId;
    const conn = this._connection;
    const text = steeringMessage.message.text;
    const hasContent = text.length > 0 || (steeringMessage.message.attachments?.length ?? 0) > 0;
    if (!appTurnId || conn.kind !== "ready" || session.threadId === void 0 || !hasContent) {
      this._fireSteeringConsumed(session, steeringMessage.id);
      return;
    }
    const { input } = resolveCodexInput(text, steeringMessage.message.attachments);
    const threadId = session.threadId;
    session.pendingSteeringFlips.set(steeringMessage.id, steeringMessage);
    void conn.client.request("turn/steer", {
      threadId,
      input: input.slice(),
      expectedTurnId: appTurnId
    }).catch((err) => {
      if (session.pendingSteeringFlips.delete(steeringMessage.id)) {
        this._fireSteeringConsumed(session, steeringMessage.id);
      }
      if (err instanceof JsonRpcError) {
        this._logService.info(`[Codex:${sessionId}] turn/steer skipped: ${err.message}`);
        return;
      }
      this._logService.warn(`[Codex:${sessionId}] turn/steer failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
  async _abort(chat) {
    const sessionUri = this._sessionUriFromChat(chat);
    const sessionId = AgentSession.id(sessionUri);
    const session = this._sessions.get(sessionId);
    if (!session) {
      return;
    }
    this._drainPendingSteering(session);
    if (!session.currentAppTurnId || session.threadId === void 0) {
      return;
    }
    const threadId = session.threadId;
    const conn = this._connection;
    if (conn.kind !== "ready") {
      return;
    }
    try {
      await conn.client.request("turn/interrupt", {
        threadId,
        turnId: session.currentAppTurnId
      });
    } catch (err) {
      this._logService.warn(`[Codex:${sessionId}] turn/interrupt failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  async disposeSession(sessionUri) {
    this._logService.info(`[Codex DEBUG] disposeSession session=${sessionUri.toString()}`);
    const sessionId = AgentSession.id(sessionUri);
    const session = this._sessions.get(sessionId);
    if (session) {
      await this._teardownSessionInMemory(session, sessionId);
    }
    this._otelService.releaseSessionTraceContext(sessionUri.toString());
  }
  /**
   * Non-destructive counterpart to {@link disposeSession}: releases the
   * session's in-memory resources but keeps its codex thread resumable — the
   * on-disk rollout is preserved and the shared codex process stays alive, so
   * the session transparently resumes on the next access. Used by idle-session
   * eviction to bound memory in long-lived host processes.
   *
   * No-ops for sessions that have nothing durable to resume from (provisional
   * sessions whose codex thread was never started) and for sessions with a
   * turn in flight — `thread/unsubscribe` mid-turn would drop live progress.
   */
  async releaseSession(sessionUri) {
    const sessionId = AgentSession.id(sessionUri);
    const session = this._sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.threadId === void 0) {
      return;
    }
    if (session.currentTurnId !== void 0) {
      return;
    }
    this._logService.info(`[Codex:${session.threadId}] Releasing idle session from memory (durable state preserved)`);
    await this._teardownSessionInMemory(session, sessionId);
  }
  /**
   * Shared in-memory teardown for a codex session: drops the tracked entry,
   * disposes its MCP controller, unparks pending approvals / client tool calls
   * / user inputs, and unsubscribes the codex thread (`thread/unsubscribe`).
   * Non-destructive — the codex thread's on-disk rollout is preserved, so the
   * session can be resumed later. Shared by {@link disposeSession} (which the
   * orchestrator pairs with durable deletion) and the non-destructive
   * {@link releaseSession}.
   */
  async _teardownSessionInMemory(session, sessionId) {
    session.disposed = true;
    this._claimPrewarm(session);
    this._sessions.delete(sessionId);
    session.mcpController?.dispose();
    if (!session.clientCustomizations.isEmpty()) {
      void this._refreshSkillExtraRoots();
    }
    if (session.managedWorkingDirectory) {
      const dir = session.managedWorkingDirectory.fsPath;
      fs.promises.rm(dir, { recursive: true, force: true }).catch((err) => {
        this._logService.info(`[Codex] failed to remove managed temp folder ${dir}: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
    if (session.customizationDirectory) {
      const dir = session.customizationDirectory.fsPath;
      fs.promises.rm(dir, { recursive: true, force: true }).catch((err) => {
        this._logService.info(`[Codex] failed to remove customization folder ${dir}: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
    if (session.threadId !== void 0) {
      this._sessionIdByThreadId.delete(session.threadId);
    }
    session.pendingCommandApprovals.denyAll("decline");
    session.pendingClientToolCalls.rejectAll(new CancellationError());
    session.pendingUserInputs.rejectAll(new CancellationError());
    this._drainPendingSteering(session);
    for (const [childThreadId, subagent] of this._subagentsByThreadId) {
      if (subagent.parentSessionId === sessionId) {
        subagent.session.pendingCommandApprovals.denyAll("decline");
        this._subagentsByThreadId.delete(childThreadId);
      }
    }
    const conn = this._connection;
    if (conn.kind === "ready" && session.threadId !== void 0) {
      const threadId = session.threadId;
      try {
        await conn.client.request("thread/unsubscribe", { threadId });
      } catch (err) {
        this._logService.info(`[Codex:${threadId}] thread/unsubscribe failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  async _changeModel(chat, model) {
    const sessionUri = this._sessionUriFromChat(chat);
    const session = this._sessions.get(AgentSession.id(sessionUri));
    if (session) {
      const supported = this._supportedModelOrUndefined(model);
      if (!supported) {
        throw new Error(`Codex model '${model.id}' is not available.`);
      }
      const previousProvider = session.model ? parseCodexModelSelection(session.model).modelProvider : void 0;
      const nextProvider = parseCodexModelSelection(supported).modelProvider;
      this._ensureModelProviderAuthenticated(supported);
      session.model = supported;
      if (previousProvider !== void 0 && previousProvider !== nextProvider) {
        this._resetSessionForModelProviderChange(session, nextProvider);
      }
      await this._persistSessionModel(session);
      this._persistMaterializedSession(session);
    }
  }
  async truncateSession(sessionUri, turnId) {
    const read = await this._readSession(sessionUri);
    if (!read) {
      return;
    }
    const turns = read.thread.turns ?? [];
    if (turns.length === 0) {
      return;
    }
    let numTurns;
    if (turnId === void 0) {
      numTurns = turns.length;
    } else {
      const session = this._sessions.get(AgentSession.id(sessionUri));
      const codexTurnId = session?.codexTurnIdByHostTurnId.get(turnId) ?? turnId;
      const index = turns.findIndex((t) => t.id === codexTurnId);
      if (index === -1) {
        this._logService.warn(`[Codex] truncateSession: turnId ${turnId} not found in thread ${read.thread.id}; skipping`);
        return;
      }
      numTurns = turns.length - (index + 1);
    }
    if (numTurns <= 0) {
      return;
    }
    try {
      const conn = await this._ensureConnection();
      await conn.client.request("thread/rollback", { threadId: read.thread.id, numTurns });
    } catch (err) {
      this._logService.warn(`[Codex:${read.thread.id}] thread/rollback failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  async onArchivedChanged(sessionUri, isArchived) {
    const threadId = await this._resolveThreadId(sessionUri);
    if (threadId === void 0) {
      return;
    }
    const conn = this._connection;
    if (conn.kind !== "ready") {
      return;
    }
    try {
      if (isArchived) {
        await conn.client.request("thread/archive", { threadId });
      } else {
        await conn.client.request("thread/unarchive", { threadId });
      }
    } catch (err) {
      this._logService.warn(`[Codex:${threadId}] thread/${isArchived ? "archive" : "unarchive"} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  /** Resolve the codex thread id for a session: in-memory → persisted overlay. */
  async _resolveThreadId(sessionUri) {
    const existing = this._sessions.get(AgentSession.id(sessionUri));
    if (existing?.threadId !== void 0) {
      return existing.threadId;
    }
    const overlay = await this._metadataStore.read(sessionUri);
    return overlay.threadId;
  }
  respondToPermissionRequest(requestId, approved) {
    const sessions = [
      ...this._sessions.values(),
      ...[...this._subagentsByThreadId.values()].map((s) => s.session)
    ];
    for (const session of sessions) {
      if (session.pendingCommandApprovals.respond(requestId, approved ? "accept" : "decline")) {
        if (!approved) {
          session.mapState.declinedToolCalls.add(requestId);
        }
        return;
      }
    }
    this._logService.info(`[Codex] respondToPermissionRequest: unknown requestId=${requestId}`);
  }
  respondToUserInputRequest(requestId, response, answers) {
    for (const session of this._sessions.values()) {
      if (session.pendingUserInputs.respond(requestId, { response, answers })) {
        return;
      }
    }
    this._logService.info(`[Codex] respondToUserInputRequest: unknown requestId=${requestId}`);
  }
  getSessionMessages(chat) {
    return this._readSession(this._sessionUriFromChat(chat)).then((read) => read ? replayThreadToTurns(read.thread) : []);
  }
  async getSessionMetadata(session) {
    const sessionId = AgentSession.id(session);
    const read = await this._readSession(session);
    if (!read) {
      return void 0;
    }
    const metadata = this._withWorkingDirectories(
      this._threadToMetadata(read.thread, session),
      read.persistedWorkingDirectories
    );
    if (!this._sessions.has(sessionId)) {
      const workingDirectory = read.thread.cwd ? URI.file(read.thread.cwd) : void 0;
      const threadId = read.thread.id;
      const overlay = await this._metadataStore.read(session);
      const restoredModel = read.persistedModelId ? { id: read.persistedModelId } : void 0;
      const restored = this._createResumedSessionEntry(sessionId, threadId, session, workingDirectory, restoredModel, metadata.workingDirectories, void 0, overlay.agent);
      this._sessions.set(sessionId, restored);
      this._sessionIdByThreadId.set(threadId, sessionId);
      if (restoredModel && parseCodexModelSelection(restoredModel).modelProvider !== read.thread.modelProvider) {
        this._resetSessionForModelProviderChange(restored, parseCodexModelSelection(restoredModel).modelProvider);
      }
      if (!restored.serverToolsAdvertised && this._serverToolHost) {
        restored.serverToolsAdvertised = true;
        this._serverToolHost.advertise(restored.sessionUri.toString());
      }
    }
    return metadata;
  }
  async _readSession(session) {
    const sessionId = AgentSession.id(session);
    const existing = this._sessions.get(sessionId);
    let threadId = existing?.threadId;
    let persistedWorkingDirectories = existing?.workingDirectories;
    let persistedModelId = existing?.model?.id;
    if (threadId === void 0) {
      const overlay = await this._metadataStore.read(session);
      threadId = overlay.threadId ?? sessionId;
      persistedWorkingDirectories = overlay.workingDirectories;
      persistedModelId = overlay.modelId;
    }
    try {
      const conn = await this._ensureConnection();
      const response = await conn.client.request("thread/read", {
        threadId,
        includeTurns: true
      });
      return { ...response, persistedWorkingDirectories, persistedModelId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/thread not loaded/i.test(message)) {
        this._logService.info(`[Codex:${threadId}] thread/read: not loaded yet (will resume on first send)`);
      } else {
        this._logService.warn(`[Codex:${threadId}] thread/read failed: ${message}`);
      }
      return void 0;
    }
  }
  async listSessions() {
    if (!await this._agentSdkDownloader.isSdkResolvableWithoutDownload(CodexSdkPackage)) {
      this._logService.info("[Codex] SDK not downloaded yet; deferring thread/list until a session triggers the download");
      return [];
    }
    try {
      const conn = await this._ensureConnection();
      const threads = await collectThreadListPages(
        (request) => conn.client.request("thread/list", request),
        (collected) => this._logService.warn(`[Codex] thread/list hit the ${THREAD_LIST_MAX_PAGES}-page cap after ${collected} threads; some sessions may be missing`)
      );
      const liveUriByThreadId = /* @__PURE__ */ new Map();
      for (const s of this._sessions.values()) {
        if (s.threadId !== void 0) {
          liveUriByThreadId.set(s.threadId, s.sessionUri);
        }
      }
      return threads.map((thread) => {
        const sessionUri = liveUriByThreadId.get(thread.id) ?? AgentSession.uri(this.id, thread.id);
        const liveWorkingDirectories = this._sessions.get(AgentSession.id(sessionUri))?.workingDirectories;
        return this._withWorkingDirectories(this._threadToMetadata(thread, sessionUri), liveWorkingDirectories);
      });
    } catch (err) {
      this._logService.warn(`[Codex] thread/list failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }
  _threadToMetadata(thread, sessionUri) {
    return {
      session: sessionUri,
      // Codex returns Unix seconds; the agent host expects ms.
      startTime: (thread.createdAt ?? 0) * 1e3,
      modifiedTime: (thread.updatedAt ?? thread.createdAt ?? 0) * 1e3,
      summary: thread.name ?? thread.preview ?? void 0,
      workingDirectories: thread.cwd ? [URI.file(thread.cwd)] : void 0
    };
  }
  _withWorkingDirectories(metadata, storedWorkingDirectories) {
    const primary = metadata.workingDirectories?.[0];
    if (!primary || !storedWorkingDirectories || storedWorkingDirectories.length <= 1) {
      return metadata;
    }
    const workingDirectories = distinctWorkingDirectories([
      primary,
      ...storedWorkingDirectories.slice(1)
    ]);
    return workingDirectories && workingDirectories.length > 1 ? { ...metadata, workingDirectories } : metadata;
  }
  setServerToolHost(host) {
    this._serverToolHost = host;
  }
  getOrCreateActiveClient(session, client) {
    const sessionId = AgentSession.id(session);
    return new CodexActiveClientHandle(
      () => this._sessions.get(sessionId),
      client.clientId,
      client.displayName,
      (tools) => this._logService.info(`[Codex:${sessionId}] active client ${client.clientId} tools=[${tools.map((t) => t.name).join(", ") || "(none)"}]`),
      (customizations) => {
        void this._syncClientCustomizations(session, client.clientId, [...customizations]);
      }
    );
  }
  removeActiveClient(session, clientId) {
    const sessionId = AgentSession.id(session);
    const sess = this._sessions.get(sessionId);
    sess?.clientToolSet.delete(clientId);
    if (sess?.clientCustomizations.removeClient(clientId)) {
      void this._refreshSkillExtraRoots();
      void this._reconcileMaterializedCustomizations(sess);
    }
  }
  onClientToolCallComplete(session, _chat, toolCallId, result) {
    const sessionId = AgentSession.id(session);
    const sess = this._sessions.get(sessionId);
    sess?.pendingClientToolCalls.respondOrBuffer(toolCallId, result);
  }
  // ---- Client-pushed plugin customizations -------------------------------
  /**
   * Materialize + parse a client's pushed plugin customizations and store
   * them on the session. Mirrors the Claude client-plugin path: the shared
   * {@link IAgentPluginManager} copies each plugin to local disk (nonce
   * cached), we parse the resulting directory into its
   * {@link IParsedPlugin | components}, publish the customization surface,
   * and refresh the process-global skill roots. MCP servers are attached
   * per-thread at the next {@link _materialize}.
   */
  async _syncClientCustomizations(sessionUri, clientId, customizations, options) {
    const session = this._sessions.get(AgentSession.id(sessionUri));
    if (!session) {
      return;
    }
    const synced = await this._pluginManager.syncCustomizations(
      clientId,
      [...customizations],
      (status) => {
        if (!options?.quiet) {
          this._fire(sessionUri, { type: ActionType.SessionCustomizationUpdated, customization: status });
        }
      }
    );
    if (session.disposed) {
      return;
    }
    const plugins = await Promise.all(synced.map((item) => this._parseClientPlugin(session, item)));
    if (session.disposed) {
      return;
    }
    session.clientCustomizations.setClient(clientId, plugins);
    if (!options?.quiet) {
      this._publishClientCustomizations(session);
    }
    await this._refreshSkillExtraRoots();
    await this._reconcileMaterializedCustomizations(session);
  }
  async _reconcileMaterializedCustomizations(session) {
    if (session.threadId === void 0) {
      return;
    }
    const launch = await this._buildCustomizationLaunch(session);
    if (launch.signature === session.materializedCustomizationsSig) {
      return;
    }
    if (!session.firstTurnSent) {
      await this._restartThreadWithCurrentTools(session);
      this._persistMaterializedSession(session);
    } else {
      session.needsResume = true;
    }
  }
  /** Parse one synced plugin directory into its components (best-effort). */
  async _parseClientPlugin(session, synced) {
    if (!synced.pluginDir) {
      return { synced, parsed: void 0 };
    }
    try {
      const parsed = await parsePlugin(synced.pluginDir, this._fileService, session.workingDirectory, this._environmentService.userHome, synced.pluginDir);
      return { synced, parsed };
    } catch (err) {
      this._logService.warn(`[Codex] failed to parse client plugin ${synced.customization.uri}: ${err instanceof Error ? err.message : String(err)}`);
      return { synced, parsed: void 0 };
    }
  }
  /** Publish the session's client-plugin customizations as upsert actions. */
  _publishClientCustomizations(session) {
    for (const customization of session.clientCustomizations.toCustomizations()) {
      this._fire(session.sessionUri, { type: ActionType.SessionCustomizationUpdated, customization });
    }
  }
  /**
   * Recompute the process-global skill roots from every live session's
   * enabled client plugins and push them to codex via `skills/extraRoots/set`.
   * codex's extra skill roots are a single shared list (there is no per-thread
   * equivalent), so we send the union across all sessions — which matches the
   * global nature of client plugin choices. No-op when the connection is not
   * ready; the next {@link _materialize} re-applies.
   */
  async _refreshSkillExtraRoots() {
    if (this._connection.kind !== "ready") {
      return;
    }
    const plugins = [];
    for (const session of this._sessions.values()) {
      if (!session.disposed) {
        plugins.push(...session.clientCustomizations.enabledPlugins());
      }
    }
    const roots = codexSkillRootsFromPlugins(plugins);
    try {
      await this._connection.client.request("skills/extraRoots/set", { extraRoots: roots });
      if (roots.length > 0) {
        this._logService.info(`[Codex] applied ${roots.length} client-plugin skill root(s)`);
      }
    } catch (err) {
      this._logService.warn(`[Codex] skills/extraRoots/set failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // ---- MCP servers -------------------------------------------------------
  /**
   * Surfaces codex's MCP servers to AHP clients as per-session
   * customizations. Codex has no plugin/directory customization layer, so
   * every server is a bare top-level {@link McpServerCustomization}. The
   * returned snapshot reflects the current connection-global inventory;
   * subsequent lifecycle transitions arrive as customization actions
   * emitted by the session's {@link McpCustomizationController}.
   */
  async getSessionCustomizations(sessionUri) {
    const session = this._sessions.get(AgentSession.id(sessionUri));
    if (!session) {
      return [];
    }
    const controller = this._getOrCreateMcpController(session);
    controller.applyAll(inventoryToSdkServers(this._mcpInventory));
    this._refreshMcpCustomizationIds(session, controller);
    const skillHookContainers = await this._fetchSkillHookContainers(session);
    return [
      ...session.clientCustomizations.toCustomizations(),
      ...controller.topLevelCustomizations(),
      ...skillHookContainers
    ];
  }
  /**
   * Fetches the skills and hooks codex has loaded for `session`'s working
   * directory (`skills/list` + `hooks/list`, both cwd-scoped) and projects
   * them into {@link DirectoryCustomization} containers. Best-effort: returns
   * an empty array when no connection is ready, no working directory is known,
   * or the app-server rejects the request.
   */
  async _fetchSkillHookContainers(session) {
    if (this._connection.kind !== "ready" || !session.workingDirectory) {
      return [];
    }
    const cwd = session.workingDirectory.fsPath;
    const client = this._connection.client;
    const [skills, hooks] = await Promise.all([
      client.request("skills/list", { cwds: [cwd] }).catch((err) => {
        this._logService.warn(`[Codex] skills/list failed: ${err instanceof Error ? err.message : String(err)}`);
        return void 0;
      }),
      client.request("hooks/list", { cwds: [cwd] }).catch((err) => {
        this._logService.warn(`[Codex] hooks/list failed: ${err instanceof Error ? err.message : String(err)}`);
        return void 0;
      })
    ]);
    return [...codexSkillsToContainers(skills), ...codexHooksToContainers(hooks)];
  }
  /**
   * Re-fetches this session's skill/hook customizations and upserts each
   * container into session state via {@link ActionType.SessionCustomizationUpdated}.
   * Called after materialization (when the connection is ready and the cwd is
   * known) so the workbench Customizations surface reflects what codex loaded
   * from the working directory's `.agents`/`.codex` folders. Upserts (keyed by
   * customization id) leave the MCP customizations untouched.
   */
  async _refreshSkillHookCustomizations(session) {
    if (session.disposed) {
      return;
    }
    const containers = await this._fetchSkillHookContainers(session);
    if (session.disposed) {
      return;
    }
    for (const container of containers) {
      this._fire(session.sessionUri, { type: ActionType.SessionCustomizationUpdated, customization: container });
    }
  }
  /**
   * Routes an MCP request received on this session's `mcp://` side channel
   * to codex. Read-only methods (`tools/list`, `resources/list`,
   * `resources/templates/list`) are answered from the cached inventory;
   * `tools/call` and `resources/read` round-trip to the app-server with the
   * session's thread id. Unknown servers / methods reject with
   * `Method not found` so the protocol server maps them to JSON-RPC
   * `-32601`.
   */
  async handleMcpRequest(sessionUri, serverName, method, params) {
    const sessionId = AgentSession.id(sessionUri);
    const session = this._sessions.get(sessionId);
    if (!session) {
      throw new Error(`Method not found: no active session ${sessionId}`);
    }
    const entry = this._mcpInventory.get(serverName);
    if (!entry) {
      throw new Error(`Method not found: unknown MCP server '${serverName}'`);
    }
    const read = buildCodexMcpReadResult(method, entry);
    if (read.handled) {
      return read.result;
    }
    switch (method) {
      case "tools/call": {
        const tool = params && typeof params["name"] === "string" ? params["name"] : void 0;
        if (!tool) {
          throw new Error(`tools/call missing 'name' parameter`);
        }
        const threadId = await this._ensureThreadId(session);
        const conn = await this._ensureConnection();
        return conn.client.request("mcpServer/tool/call", {
          threadId,
          server: serverName,
          tool,
          arguments: params ? params["arguments"] : void 0
        });
      }
      case "resources/read": {
        const uri = params && typeof params["uri"] === "string" ? params["uri"] : void 0;
        if (!uri) {
          throw new Error(`resources/read missing 'uri' parameter`);
        }
        const threadId = await this._ensureThreadId(session);
        const conn = await this._ensureConnection();
        return conn.client.request("mcpServer/resource/read", {
          threadId,
          server: serverName,
          uri
        });
      }
      default:
        throw new Error(`Method not found: ${method}`);
    }
  }
  async startMcpServer(sessionUri, id) {
    const session = this._sessions.get(AgentSession.id(sessionUri));
    const serverName = session ? this._resolveMcpServerName(session, id) : void 0;
    if (!session || !serverName) {
      this._logService.warn(`[Codex] Cannot start unknown MCP server customization ${id}`);
      return;
    }
    const conn = await this._ensureConnection();
    await conn.client.request("config/mcpServer/reload", void 0);
    await this._refreshMcpInventory(conn.client);
  }
  async stopMcpServer(sessionUri, id) {
    const session = this._sessions.get(AgentSession.id(sessionUri));
    const serverName = session ? this._resolveMcpServerName(session, id) : void 0;
    if (!session || !serverName) {
      this._logService.warn(`[Codex] Cannot stop unknown MCP server customization ${id}`);
      return;
    }
  }
  _resolveMcpServerName(session, id) {
    const controller = this._getOrCreateMcpController(session);
    controller.applyAll(inventoryToSdkServers(this._mcpInventory));
    this._refreshMcpCustomizationIds(session, controller);
    return controller.serverNameForCustomizationId(id);
  }
  /**
   * Lazily create the per-session {@link McpCustomizationController}. Not
   * registered on the agent (sessions come and go) — disposed explicitly
   * when the session is removed.
   */
  _getOrCreateMcpController(session) {
    if (!session.mcpController) {
      session.mcpController = this._instantiationService.createInstance(McpCustomizationController, {
        providerId: this.id,
        sessionId: session.sessionId,
        sessionUri: session.sessionUri,
        resolveChildId: () => void 0,
        emit: (action) => this._fire(session.sessionUri, action),
        capabilities: CODEX_MCP_APP_CAPABILITIES
      });
    }
    return session.mcpController;
  }
  /** Mirrors the connection-global inventory onto every live session. */
  _applyMcpInventoryToSessions() {
    const servers = inventoryToSdkServers(this._mcpInventory);
    for (const session of this._sessions.values()) {
      if (session.disposed) {
        continue;
      }
      const controller = this._getOrCreateMcpController(session);
      controller.applyAll(servers);
      this._refreshMcpCustomizationIds(session, controller);
    }
  }
  /**
   * Refreshes the session's mapper snapshot of server name → customization id
   * (read when stamping the MCP contributor on tool calls). Plain data, owned
   * here — the mapper never reaches back into the controller. Must run on every
   * inventory change because MCP servers are discovered asynchronously, after a
   * session (and possibly its first tool call) already exists.
   */
  _refreshMcpCustomizationIds(session, controller) {
    const ids = session.mapState.mcpCustomizationIds;
    ids.clear();
    for (const serverName of this._mcpInventory.keys()) {
      const id = controller.customizationIdForServer(serverName);
      if (id !== void 0) {
        ids.set(serverName, id);
      }
    }
  }
  /**
   * Re-reads the full MCP inventory from the app-server (paginated) and
   * re-publishes it to every session. Fires `notifications/tools/list_changed`
   * on each ready channel whose tool set changed.
   */
  async _refreshMcpInventory(client) {
    let data = [];
    try {
      let cursor = null;
      do {
        const response = await client.request("mcpServerStatus/list", { cursor, detail: "full" });
        data = data.concat(response.data);
        cursor = response.nextCursor;
      } while (cursor);
    } catch (err) {
      this._logService.warn(`[Codex] Failed to list MCP servers: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (this._connection.kind === "ready" && this._connection.client !== client) {
      return;
    }
    const next = codexMcpListToInventory(data);
    const toolsChanged = [];
    for (const [name, entry] of next) {
      const prev = this._mcpInventory.get(name);
      if (prev && codexMcpToolsChanged(prev, entry)) {
        toolsChanged.push(name);
      }
    }
    for (const [name, entry] of this._mcpInventory) {
      if (!next.has(name) && entry.state.kind !== McpServerStatus.Ready) {
        next.set(name, entry);
      }
    }
    this._mcpInventory.clear();
    for (const [name, entry] of next) {
      this._mcpInventory.set(name, entry);
    }
    this._logService.info(`[Codex] MCP inventory refreshed: ${this._mcpInventory.size === 0 ? "(none)" : [...this._mcpInventory].map(([name, entry]) => `${name} [${entry.state.kind}, ${entry.tools.length} tool(s)]`).join(", ")}`);
    this._applyMcpInventoryToSessions();
    for (const name of toolsChanged) {
      this._fireMcpToolsListChanged(name);
    }
  }
  /**
   * Handles a `mcpServer/startupStatus/updated` notification. `ready`
   * triggers a full inventory refresh (to pull the now-loaded tools);
   * other transitions update the cached state in place so the UI sees the
   * server settle into starting/error/stopped promptly.
   */
  _handleMcpStartupStatus(client, name, status, error) {
    if (this._connection.kind === "ready" && this._connection.client !== client) {
      return;
    }
    this._logService.info(`[Codex] MCP server '${name}' startup status: ${status}${error ? ` (${error})` : ""}`);
    if (status === "ready") {
      void this._refreshMcpInventory(client);
      return;
    }
    if (status === "failed" && codexStartupErrorNeedsAuth(error)) {
      const url = this._mcpServerUrlForName(name);
      const normalized = url !== void 0 ? normalizeCodexMcpResourceUrl(url) : void 0;
      if (url !== void 0 && normalized !== void 0) {
        if (this._mcpAuthTokens.delete(normalized)) {
          this._logService.info(`[Codex] MCP server '${name}' rejected the stored token; clearing it to allow re-authentication`);
        }
        void this._surfaceMcpAuthRequired(client, name, url, error);
        return;
      }
    }
    this._setMcpServerState(name, translateCodexMcpStartupState(status, error));
  }
  /** Upserts a server's lifecycle state in the inventory (preserving cached tools) and republishes. */
  _setMcpServerState(name, state) {
    const prev = this._mcpInventory.get(name);
    this._mcpInventory.set(name, {
      state,
      tools: prev?.tools ?? [],
      resources: prev?.resources ?? [],
      resourceTemplates: prev?.resourceTemplates ?? []
    });
    this._applyMcpInventoryToSessions();
  }
  /**
   * Surfaces an auth-gated http MCP server as {@link McpServerStatus.AuthRequired}
   * so the workbench runs the *same* OAuth sign-in it uses for the Copilot
   * agent. codex's `failed` notification carries no RFC 9728 metadata, and the
   * workbench's `resolveMcpServerAuthentication` needs the resource's
   * `authorization_servers` to know where to sign in — so we discover the
   * Protected Resource Metadata (`<url>/.well-known/oauth-protected-resource`)
   * here, mirroring the discovery the Copilot SDK does internally. On
   * discovery failure we still surface `AuthRequired` with bare metadata (the
   * server genuinely needs auth); the one-click sign-in just can't complete
   * without the authorization server, which is logged.
   */
  async _surfaceMcpAuthRequired(client, name, url, error) {
    let resource = { resource: url, resource_name: name };
    let requiredScopes;
    try {
      const discovered = await raceTimeout(fetchResourceMetadata(url, void 0), 15e3);
      if (discovered) {
        resource = discovered.metadata;
        requiredScopes = discovered.metadata.scopes_supported;
        this._logService.info(`[Codex] discovered OAuth metadata for MCP server '${name}': authorization_servers=[${(discovered.metadata.authorization_servers ?? []).join(", ")}]`);
      } else {
        this._logService.warn(`[Codex] timed out discovering OAuth metadata for MCP server '${name}' at ${url}; the Authenticate action may not be able to complete`);
      }
    } catch (err) {
      this._logService.warn(`[Codex] failed to discover OAuth metadata for MCP server '${name}' at ${url}; the Authenticate action may not be able to complete: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (this._connection.kind === "ready" && this._connection.client !== client) {
      return;
    }
    const normalizedServer = normalizeCodexMcpResourceUrl(url);
    const normalizedResource = normalizeCodexMcpResourceUrl(resource.resource) ?? normalizedServer;
    if (normalizedServer !== void 0 && normalizedResource !== void 0) {
      const servers = this._mcpAuthServerUrlsByResource.get(normalizedResource) ?? /* @__PURE__ */ new Set();
      servers.add(normalizedServer);
      this._mcpAuthServerUrlsByResource.set(normalizedResource, servers);
    }
    this._logService.info(`[Codex] MCP server '${name}' requires authentication for ${url}`);
    this._setMcpServerState(name, {
      kind: McpServerStatus.AuthRequired,
      reason: McpAuthRequiredReason.Required,
      resource,
      requiredScopes: requiredScopes && requiredScopes.length > 0 ? requiredScopes : void 0,
      description: error ?? void 0
    });
  }
  /**
   * Broadcasts `notifications/tools/list_changed` for `serverName` on every
   * session whose channel for that server is currently ready. Clients
   * refetch `tools/list` in response.
   */
  _fireMcpToolsListChanged(serverName) {
    for (const session of this._sessions.values()) {
      const channel = session.mcpController?.channelForServer(serverName);
      if (channel) {
        this._onMcpNotification.fire({ channel, method: "notifications/tools/list_changed" });
      }
    }
  }
  /**
   * Ensures the session has a materialized codex thread and returns its id.
   * MCP tool calls (`mcpServer/tool/call`) are thread-scoped, so a call
   * arriving before the first turn lazily starts the thread.
   */
  async _ensureThreadId(session) {
    await this._materializeIfNeeded(session, false);
    if (session.threadId === void 0) {
      throw new Error(`Cannot run MCP tool: codex session ${session.sessionId} is not materialized`);
    }
    return session.threadId;
  }
  async shutdown() {
    this._disposeConnection();
    for (const s of this._sessions.values()) {
      s.pendingCommandApprovals.denyAll("decline");
      s.pendingClientToolCalls.rejectAll(new CancellationError());
      s.pendingUserInputs.rejectAll(new CancellationError());
      s.mcpController?.dispose();
    }
    this._sessions.clear();
    this._sessionIdByThreadId.clear();
    this._mcpInventory.clear();
  }
  resolveSessionConfig(params) {
    const values = codexSessionConfigSchema.validateOrDefault(params.config, codexSessionConfigDefaults);
    const schema = codexVisibleSessionConfigSchema.toProtocol();
    const resolvedValues = {
      ...params.config,
      [SessionConfigKey.Mode]: values[SessionConfigKey.Mode]
    };
    delete resolvedValues[CodexSessionConfigKey.PermissionsPreset];
    delete resolvedValues[CodexSessionConfigKey.ApprovalPolicy];
    delete resolvedValues[CodexSessionConfigKey.SandboxMode];
    Object.assign(resolvedValues, migrateCodexPermissionValues(params.config, {
      approvalPolicy: codexSessionConfigDefaults[CodexSessionConfigKey.ApprovalPolicy],
      sandboxMode: codexSessionConfigDefaults[CodexSessionConfigKey.SandboxMode]
    }));
    return Promise.resolve({ values: resolvedValues, schema });
  }
  getInheritedSessionConfig(config) {
    const inherited = migrateCodexPermissionValues(config, {
      approvalPolicy: codexSessionConfigDefaults[CodexSessionConfigKey.ApprovalPolicy],
      sandboxMode: codexSessionConfigDefaults[CodexSessionConfigKey.SandboxMode]
    });
    if (config[SessionConfigKey.Permissions] !== void 0) {
      inherited[SessionConfigKey.Permissions] = config[SessionConfigKey.Permissions];
    }
    return Object.keys(inherited).length > 0 ? inherited : void 0;
  }
  async sessionConfigCompletions(params) {
    if (params.property !== CodexSessionConfigKey.AdditionalDirectories) {
      return { items: [] };
    }
    const query = params.query?.trim();
    if (!query) {
      return { items: [] };
    }
    const workingDirectory = params.workingDirectory?.fsPath;
    const resolved = isAbsolute(query) ? query : resolve(workingDirectory ?? process.cwd(), query);
    const parent = query.endsWith(sep) ? resolved : dirname(resolved);
    const prefix = query.endsWith(sep) ? "" : basename(resolved).toLowerCase();
    try {
      const entries = await fs.promises.readdir(parent, { withFileTypes: true });
      return {
        items: entries.filter((entry) => entry.isDirectory() && entry.name.toLowerCase().startsWith(prefix)).slice(0, 50).map((entry) => {
          const value = join(parent, entry.name);
          return { value, label: entry.name, description: value };
        })
      };
    } catch {
      return { items: [] };
    }
  }
  // #endregion
  _fire(sessionUri, action) {
    this._onDidSessionProgress.fire({ kind: "action", resource: isChatAction(action) ? URI.parse(buildDefaultChatUri(sessionUri)) : sessionUri, action });
  }
  dispose() {
    this._disposeConnection();
    for (const s of this._sessions.values()) {
      s.pendingCommandApprovals.denyAll("decline");
      s.pendingClientToolCalls.rejectAll(new CancellationError());
      s.pendingUserInputs.rejectAll(new CancellationError());
      s.mcpController?.dispose();
    }
    for (const subagent of this._subagentsByThreadId.values()) {
      subagent.session.pendingCommandApprovals.denyAll("decline");
    }
    this._subagentsByThreadId.clear();
    this._sessions.clear();
    this._sessionIdByThreadId.clear();
    this._mcpInventory.clear();
    super.dispose();
  }
};
CodexAgent = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, ICopilotApiService),
  __decorateParam(2, ICodexProxyService),
  __decorateParam(3, IAgentConfigurationService),
  __decorateParam(4, IAgentHostGitHubEndpointService),
  __decorateParam(5, IAgentHostCheckpointService),
  __decorateParam(6, IAgentSdkDownloader),
  __decorateParam(7, IProductService),
  __decorateParam(8, IAgentPluginManager),
  __decorateParam(9, IFileService),
  __decorateParam(10, INativeEnvironmentService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, IAgentHostOTelService),
  __decorateParam(13, IAgentHostStateManager)
], CodexAgent);
function parseBinaryArgs(json) {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
function codexPackageSuffix(platform, arch) {
  if (platform !== "linux" && platform !== "darwin" && platform !== "win32" || arch !== "x64" && arch !== "arm64") {
    return void 0;
  }
  return `${platform}-${arch}`;
}
function codexBinaryTriple(sdkTarget) {
  switch (sdkTarget) {
    case "linux-x64":
      return "x86_64-unknown-linux-musl";
    case "linux-arm64":
      return "aarch64-unknown-linux-musl";
    case "darwin-x64":
      return "x86_64-apple-darwin";
    case "darwin-arm64":
      return "aarch64-apple-darwin";
    case "win32-x64":
      return "x86_64-pc-windows-msvc";
    case "win32-arm64":
      return "aarch64-pc-windows-msvc";
    default:
      return void 0;
  }
}
async function resolveCodexDevSdkRoot(resolvePackageJsonPath = defaultResolveCodexPackageJsonPath) {
  try {
    const pkgJson = await resolvePackageJsonPath();
    return dirname(dirname(dirname(dirname(pkgJson))));
  } catch {
    return void 0;
  }
}
async function defaultResolveCodexPackageJsonPath() {
  const { createRequire } = await import("node:module");
  return createRequire(import.meta.url).resolve("@openai/codex/package.json");
}
export {
  CodexAgent,
  CodexSdkPackage,
  codexBinaryTriple,
  codexPackageSuffix,
  parseCodexModelSelection,
  resolveCodexDevSdkRoot,
  toCodexModelSelectionId
};
