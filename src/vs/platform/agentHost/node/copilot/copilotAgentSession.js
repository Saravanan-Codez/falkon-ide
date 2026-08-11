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
import { raceCancellation, RunOnceScheduler, Sequencer, SequencerByKey, Throttler } from "../../../../base/common/async.js";
import { encodeBase64, VSBuffer } from "../../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { CancellationError, getErrorMessage } from "../../../../base/common/errors.js";
import { escapeMarkdownSyntaxTokens } from "../../../../base/common/htmlContent.js";
import { Disposable, DisposableMap, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isAuthorizationProtectedResourceMetadata } from "../../../../base/common/oauth.js";
import { safeStringify } from "../../../../base/common/objects.js";
import { isAbsolute, join } from "../../../../base/common/path.js";
import { extUriBiasedIgnorePathCase, normalizePath } from "../../../../base/common/resources.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { splitLinesIncludeSeparators } from "../../../../base/common/strings.js";
import { hasKey, isDefined, isObject, isString } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { INativeEnvironmentService } from "../../../environment/common/environment.js";
import { IFileService } from "../../../files/common/files.js";
import { IInstantiationService } from "../../../instantiation/common/instantiation.js";
import { ILogService, LogLevel } from "../../../log/common/log.js";
import { ITelemetryService } from "../../../telemetry/common/telemetry.js";
import { getCopilotHomePath } from "../../common/copilotHome.js";
import { CopilotCliConfigKey, applyModelFamilyAlias, copilotCliConfigSchema } from "../../common/copilotCliConfig.js";
import { gitHubMcpServerUrl } from "../../common/githubEndpoints.js";
import { AgentHostSandboxConfigKey, sandboxConfigSchema } from "../../common/sandboxConfigSchema.js";
import { AgentHostGlobalAutoApproveEnabledConfigKey, AgentHostAutoReplyAnswer, AgentHostAutoReplyEnabledConfigKey, AgentHostDisableRepoInfoTelemetryConfigKey, platformRootSchema, platformSessionSchema } from "../../common/agentHostSchema.js";
import { AgentSession, subagentChatTitle } from "../../common/agentService.js";
import { META_DIFF_BASE_BRANCH } from "../../common/agentHostGitService.js";
import { stripRedundantCdPrefix } from "../../common/commandLineHelpers.js";
import { readToolCallMeta, toToolCallMeta } from "../../common/meta/agentToolCallMeta.js";
import { OtelData } from "../../common/otlp/otlpLogEmitter.js";
import { SessionConfigKey } from "../../common/sessionConfigKeys.js";
import { resolveCopilotConfigSlashCommandOnSend } from "../../common/copilotConfigSlashCommands.js";
import { STREAMING_TOOL_DISPLAY_INTERVAL_MS, streamingToolDisplayText } from "../../common/streamingToolCallDisplay.js";
import { isAgentFeedbackAnnotationsAttachment, renderAgentFeedbackAnnotationsAttachment } from "../../common/meta/agentFeedbackAttachments.js";
import { ISessionDataService, SESSION_ATTACHMENTS_DIRNAME } from "../../common/sessionDataService.js";
import { IAgentHostOTelService } from "../../common/otel/agentHostOTelService.js";
import { MessageAttachmentKind, ToolCallContributorKind } from "../../common/state/protocol/state.js";
import { ActionType, isChatAction } from "../../common/state/sessionActions.js";
import { MessageKind, ResponsePartKind, ChatInputAnswerState, ChatInputAnswerValueKind, ChatInputQuestionKind, ChatInputRequestPurpose, ChatInputResponseKind, ToolCallConfirmationReason, ToolCallRiskAssessmentKind, ToolCallRiskAssessmentStatus, ToolCallStatus, ToolResultContentType, buildSubagentSessionUri, getToolSubagentContent, isDefaultChatUri, isSubagentSession, readSessionPromptCacheState, withSessionPromptCacheState } from "../../common/state/sessionState.js";
import { IAgentConfigurationService } from "../agentConfigurationService.js";
import { clientToolNamesFromSnapshot } from "./copilotSessionLauncher.js";
import { agentHostModelSupportsToolSearch, CLIENT_TOOL_SEARCH_REFERENCE_NAME, NON_DEFERRED_CLIENT_TOOL_NAMES, RUNTIME_TOOL_SEARCH_TOOL_NAME } from "./toolSearchDeferral.js";
import { ActiveClientToolSet } from "../activeClientState.js";
import { AgentHostTelemetryReporter } from "../agentHostTelemetryReporter.js";
import { AgentHostRepoInfoTelemetry } from "../agentHostRepoInfoTelemetry.js";
import { PendingRequestRegistry } from "../../common/pendingRequestRegistry.js";
import { buildCopilotSystemNotification } from "./copilotSystemNotification.js";
import { parseLeadingSlashCommand } from "../../common/agentHostSlashCommand.js";
import { NonPtyShellTerminalStreams } from "./copilotNonPtyShellTerminals.js";
import { buildSandboxConfigForSdk } from "./sandboxConfigForSdk.js";
import { getEditFilePaths, getInvocationMessage, getPastTenseMessage, getPermissionDisplay, getShellIntention, getShellLanguage, getStreamingInvocationMessage, getSubagentMetadata, getTaskCompleteMarkdown, getToolDisplayName, getToolInputString, getToolKind, isAgentCoordinationTool, isEditTool, isHiddenTool, isShellTool, isTaskCompleteTool, parseCopilotStreamingToolInput, synthesizeSkillToolCall, tryStringify } from "./copilotToolDisplay.js";
import { FileEditTracker } from "../shared/fileEditTracker.js";
import { ICopilotApiService } from "../shared/copilotApiService.js";
import { buildChatErrorInfoFromCopilotSdkFields } from "./copilotSdkChatError.js";
import { getEffectiveMcpServerCustomizations, McpCustomizationController } from "../shared/mcpCustomizationController.js";
import { appendSdkToolResultContent, mapSessionEvents } from "./mapSessionEvents.js";
import { addSimpleAttachmentDisplayKindToMimeType } from "./copilotAttachmentUtils.js";
import { buildPendingEditContentUri } from "./pendingEditContentStore.js";
import { IAgentHostStateManager } from "../agentHostStateManager.js";
import { AgentHostClientType } from "../../common/agentHostClientInfo.js";
import { McpAuthRequiredReason, McpServerStatus } from "../../common/state/protocol/channels-session/state.js";
import { CopilotSlashCommandProvider } from "./copilotSlashCommandProvider.js";
import { createCopilotFailureCorrelation, reportCopilotModelCallFailure, reportCopilotSdkSessionError } from "./copilotFailureTelemetry.js";
import { reportCopilotTodoStoreOperation } from "./copilotTodoStoreTelemetry.js";
const SESSION_STATE_DIRECTORY = "session-state";
const EMPTY_TOOL_RESULT_TEXT = "<empty />";
function isPermissionDeniedKind(kind) {
  switch (kind) {
    case "cancelled":
    case "denied-by-rules":
    case "denied-no-approval-rule-and-could-not-request-from-user":
    case "denied-interactively-by-user":
    case "denied-by-content-exclusion-policy":
    case "denied-by-permission-request-hook":
      return true;
    default:
      return false;
  }
}
function mapPermissionResultToConfirmKind(kind, resolvedByHook) {
  if (kind === void 0) {
    return "confirmationNotNeeded";
  }
  if (isPermissionDeniedKind(kind)) {
    return "denied";
  }
  if (kind === "approved-for-session" || kind === "approved-for-location") {
    return "setting";
  }
  return resolvedByHook ? "confirmationNotNeeded" : "userAction";
}
function normalizeMcpServerUrl(value) {
  if (!URL.canParse(value)) {
    return void 0;
  }
  const url = new URL(value);
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}
function getEmptyToolResultText(binaryResults) {
  if (!binaryResults?.length) {
    return EMPTY_TOOL_RESULT_TEXT;
  }
  const hasImage = binaryResults.some((result) => result.type === "image");
  const hasFile = binaryResults.some((result) => result.type === "resource");
  if (hasImage && hasFile) {
    return "Tool produced the attached image and file";
  }
  if (hasImage) {
    return "Tool produced the attached image";
  }
  return "Tool produced the attached file";
}
function getPlanActionDescription(actionId) {
  switch (actionId) {
    case "autopilot":
      return {
        label: localize("agentHost.planReview.autopilot.label", "Implement with Autopilot"),
        description: localize("agentHost.planReview.autopilot.description", "Continue autonomously until done, using the selected approval level.")
      };
    case "autopilot_fleet":
      return {
        label: localize("agentHost.planReview.autopilotFleet.label", "Implement with Autopilot Fleet"),
        description: localize("agentHost.planReview.autopilotFleet.description", "Continue autonomously with fleet management, using the selected approval level.")
      };
    case "interactive":
      return {
        label: localize("agentHost.planReview.interactive.label", "Implement Plan"),
        description: localize("agentHost.planReview.interactive.description", "Implement the plan, asking for input and approval for each action.")
      };
    case "exit_only":
      return {
        label: localize("agentHost.planReview.exitOnly.label", "Approve Plan Only"),
        description: localize("agentHost.planReview.exitOnly.description", "Approve the plan without executing it. I will implement it myself.")
      };
    default:
      return void 0;
  }
}
function getToolCommand(input) {
  const command = isObject(input.toolArgs) ? Reflect.get(input.toolArgs, "command") : void 0;
  return isString(command) ? command : void 0;
}
function toCopilotSdkMode(mode) {
  mode = mode?.toLowerCase() === "goal" ? "plan" : mode;
  switch (mode) {
    case "interactive":
    case "plan":
    case "autopilot":
      return mode;
    default:
      return void 0;
  }
}
function elicitationFieldToQuestion(fieldName, field, required) {
  const base = {
    id: fieldName,
    title: field.title ?? fieldName,
    message: field.description ?? field.title ?? fieldName,
    required
  };
  switch (field.type) {
    case "boolean":
      return { ...base, kind: ChatInputQuestionKind.Boolean, defaultValue: field.default };
    case "integer":
    case "number":
      return {
        ...base,
        kind: field.type === "integer" ? ChatInputQuestionKind.Integer : ChatInputQuestionKind.Number,
        min: field.minimum,
        max: field.maximum,
        defaultValue: field.default
      };
    case "array": {
      const options = hasKey(field.items, { enum: true }) ? field.items.enum.map((value) => ({ id: value, label: value })) : field.items.anyOf.map((option) => ({ id: option.const, label: option.title }));
      return {
        ...base,
        kind: ChatInputQuestionKind.MultiSelect,
        options,
        min: field.minItems,
        max: field.maxItems
      };
    }
    case "string": {
      if (hasKey(field, { enum: true })) {
        const enumNames = field.enumNames;
        const options = field.enum.map((value, idx) => ({ id: value, label: enumNames?.[idx] ?? value }));
        return { ...base, kind: ChatInputQuestionKind.SingleSelect, options };
      }
      if (hasKey(field, { oneOf: true })) {
        const options = field.oneOf.map((option) => ({ id: option.const, label: option.title }));
        return { ...base, kind: ChatInputQuestionKind.SingleSelect, options };
      }
      return {
        ...base,
        kind: ChatInputQuestionKind.Text,
        format: field.format,
        min: field.minLength,
        max: field.maxLength,
        defaultValue: field.default
      };
    }
  }
}
function elicitationAnswerToFieldValue(field, answer) {
  if (!answer || answer.state === ChatInputAnswerState.Skipped) {
    return void 0;
  }
  const value = answer.value;
  if (field.type === "boolean") {
    if (value.kind === ChatInputAnswerValueKind.Boolean) {
      return value.value;
    }
    if (value.kind === ChatInputAnswerValueKind.Text) {
      if (value.value === "true") {
        return true;
      }
      if (value.value === "false") {
        return false;
      }
      return void 0;
    }
    return void 0;
  }
  if (field.type === "number" || field.type === "integer") {
    if (value.kind === ChatInputAnswerValueKind.Number) {
      return field.type === "integer" ? Math.trunc(value.value) : value.value;
    }
    if (value.kind === ChatInputAnswerValueKind.Text) {
      if (value.value.trim() === "") {
        return void 0;
      }
      const n = Number(value.value);
      return Number.isFinite(n) ? field.type === "integer" ? Math.trunc(n) : n : void 0;
    }
    return void 0;
  }
  if (field.type === "array") {
    if (value.kind === ChatInputAnswerValueKind.SelectedMany) {
      return [...value.value, ...value.freeformValues ?? []];
    }
    if (value.kind === ChatInputAnswerValueKind.Selected) {
      return value.value ? [value.value, ...value.freeformValues ?? []] : [...value.freeformValues ?? []];
    }
    if (value.kind === ChatInputAnswerValueKind.Text) {
      return value.value ? [value.value] : [];
    }
    return void 0;
  }
  if (value.kind === ChatInputAnswerValueKind.Text) {
    return value.value;
  }
  if (value.kind === ChatInputAnswerValueKind.Selected) {
    return value.value;
  }
  return void 0;
}
function getCopilotCLISessionStateDir(userHome) {
  return join(getCopilotHomePath(userHome, process.env), SESSION_STATE_DIRECTORY);
}
const COPILOT_SDK_TOOL_OUTPUT_BASENAME_RE = /^(?:\d{10,}-copilot-tool-output-[a-z0-9]{6}|copilot-tool-output-\d{10,}-[a-z0-9]{6})\.txt$/i;
function isCopilotSdkToolOutputTempFile(filePath, tmpDir) {
  const fileUri = normalizePath(URI.file(filePath));
  const tmpDirUri = normalizePath(URI.file(tmpDir));
  const parentUri = normalizePath(URI.joinPath(fileUri, ".."));
  if (!extUriBiasedIgnorePathCase.isEqual(parentUri, tmpDirUri)) {
    return false;
  }
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const basename = lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
  return COPILOT_SDK_TOOL_OUTPUT_BASENAME_RE.test(basename);
}
class CopilotTurn {
  constructor(id, ordinal, senderClientId, clientType) {
    this.id = id;
    this.ordinal = ordinal;
    this.senderClientId = senderClientId;
    this.clientType = clientType;
    this._state = "pending";
    this._stopWatch = StopWatch.create(false);
    /**
     * This turn's own Copilot cost in nano-AIU, summed from the `copilotUsage`
     * carried by the model calls the turn caused — its own, every subagent's,
     * and any compaction that ran mid-turn.
     *
     * Accumulated synchronously as each event arrives rather than derived from
     * the SDK's session-wide total: that total is read asynchronously, and the
     * terminal `session.idle` can close the turn while a read is in flight,
     * which would drop the turn's last model call from its reported cost.
     */
    this.copilotNanoAiu = 0;
    /**
     * Per-subagent component cost, in nano-AIU, keyed by `parentToolCallId`.
     * The SDK's session metrics are session-wide and carry no per-agent
     * breakdown, so a subagent's own running total is still accumulated from
     * its usage events in order to report it on the subagent's child session.
     */
    this.subagentNanoAiuByToolCallId = /* @__PURE__ */ new Map();
    /**
     * Whole-turn token consumption keyed by model id. Every model call in the
     * turn contributes — the parent agent's calls, every subagent's calls, and
     * the summarization call a compaction performs — so the totals describe what
     * the turn as a whole consumed rather than just its last call. Subagents may
     * run on a different model than the parent, hence the per-model keying.
     */
    this._tokenTotalsByModel = /* @__PURE__ */ new Map();
    /**
     * Current markdown response part IDs for this turn, keyed by
     * `parentToolCallId ?? ''`. Parent and subagent text stream through the
     * same SDK session but land in different AHP sessions, so their markdown
     * part state must not mask or append to each other.
     */
    this.markdownPartIds = /* @__PURE__ */ new Map();
    /** Current reasoning response part IDs for this turn, keyed by `parentToolCallId ?? ''`. */
    this.reasoningPartIds = /* @__PURE__ */ new Map();
    /**
     * Per-turn tool-call aggregate accumulated across the turn's `assistant.message` rounds (main
     * agent only), for the restricted `toolCallDetails` telemetry. `toolCounts` is keyed by tool name.
     */
    this.toolCounts = /* @__PURE__ */ new Map();
    this.toolCallRounds = 0;
    this.totalToolCalls = 0;
    this.parallelToolCallRounds = 0;
    this.parallelToolCallsTotal = 0;
    this.toolCallDetailsReported = false;
  }
  /**
   * Folds one model call's token counts into the turn's per-model totals.
   * Calls without a model id are ignored: they cannot be attributed, and every
   * usage-reporting path this session has carries one.
   */
  addTokenTotals(model, tokens) {
    if (!model) {
      return;
    }
    let total = this._tokenTotalsByModel.get(model);
    if (!total) {
      total = { model, inputTokens: 0, cachedTokens: 0, outputTokens: 0 };
      this._tokenTotalsByModel.set(model, total);
    }
    total.inputTokens += toTokenCount(tokens.inputTokens);
    total.cachedTokens += toTokenCount(tokens.cacheReadTokens);
    total.outputTokens += toTokenCount(tokens.outputTokens);
  }
  /**
   * The turn's per-model totals, or `undefined` when nothing has been recorded.
   * Rows are cloned: the map keeps mutating its own copies as further calls are
   * recorded, and an already-emitted or already-compared usage object must not
   * change retroactively underneath its consumers.
   */
  get tokenTotals() {
    return this._tokenTotalsByModel.size > 0 ? [...this._tokenTotalsByModel.values()].map((total) => ({ ...total })) : void 0;
  }
  get state() {
    return this._state;
  }
  get isPending() {
    return this._state === "pending";
  }
  get isRunning() {
    return this._state === "running";
  }
  get duration() {
    return Math.max(0, this._stopWatch.elapsed());
  }
  /** Transition `pending → running` on the first SDK event. No-op once running/finished. */
  markRunning() {
    if (this._state === "pending") {
      this._state = "running";
    }
  }
  markCompleted() {
    this._state = "completed";
  }
  markAborted() {
    this._state = "aborted";
  }
}
let CopilotAgentSession = class extends Disposable {
  constructor(options, _instantiationService, _logService, sessionDataService, _fileService, _environmentService, _configurationService, _stateManager, _telemetryService, _copilotApiService, _otelService) {
    super();
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._fileService = _fileService;
    this._environmentService = _environmentService;
    this._configurationService = _configurationService;
    this._stateManager = _stateManager;
    this._telemetryService = _telemetryService;
    this._copilotApiService = _copilotApiService;
    this._otelService = _otelService;
    /** Tracks active tool invocations so we can produce past-tense messages on completion. */
    this._activeToolCalls = /* @__PURE__ */ new Map();
    this._streamingToolCalls = /* @__PURE__ */ new Map();
    this._streamingToolDisplaySchedulers = this._register(new DisposableMap());
    /**
     * Maps a subagent's stable `agentId` to its parent tool call id. Completion
     * ends the current subagent turn, but steering can start another turn with
     * the same id, so mappings live until session teardown.
     */
    this._parentToolCallIdsByAgentId = /* @__PURE__ */ new Map();
    this._activeSubagentAgentIds = /* @__PURE__ */ new Set();
    this._unroutableSubagentToolCallIds = /* @__PURE__ */ new Set();
    this._autoApprovals = /* @__PURE__ */ new Map();
    this._pendingAutoApprovals = new PendingRequestRegistry();
    /** Correlates tool execution with the SDK permission lifecycle for `chat.toolApproval` telemetry. */
    this._toolApprovalRecords = /* @__PURE__ */ new Map();
    /** Pending permission requests awaiting a renderer-side decision. */
    this._pendingPermissions = new PendingRequestRegistry();
    /** Cancels callbacks that began before or during an SDK abort. */
    this._abortCts = this._register(new MutableDisposable());
    /**
     * Signatures ({@link safeStringify}) of user-approved `read`/`write`
     * permission requests, keyed by tool call id. The Copilot CLI runtime emits
     * two identical `permission.requested` events for a single file read or
     * write (an internal `path` prompt followed by a `read`/`write` prompt), so
     * without this the user would be asked to approve the same operation twice
     * (issue #324477). An entry is single-use: it auto-approves exactly one
     * subsequent request that is byte-identical to the approved one, then is
     * removed, so approval never carries across a different tool call, a changed
     * path/diff/contents, or a different kind.
     */
    this._approvedDuplicablePermissionSignatures = /* @__PURE__ */ new Map();
    /** Pending user input requests awaiting a renderer-side answer. */
    this._pendingUserInputs = new PendingRequestRegistry();
    /**
     * Pending elicitation requests awaiting a renderer-side answer. Keyed
     * by request id; the schema is retained so the completion handler can
     * project the submitted {@link ChatInputAnswer}s back into the
     * SDK's {@link ElicitationResult.content} shape.
     */
    this._pendingElicitations = new PendingRequestRegistry();
    /**
     * Pending plan-review requests originating from the CLI's
     * `exitPlanMode.request` RPC. Tracked separately from
     * {@link _pendingUserInputs} so the completion handler can resolve the
     * RPC with a structured {@link CopilotExitPlanModeResponse} (which the CLI
     * forwards to `session.respondToExitPlanMode`) rather than feeding it
     * back through the SDK's `ask_user` callback.
     */
    this._pendingPlanReviews = new PendingRequestRegistry();
    /** Monotonic 0-based ordinal assigned to each turn as it starts, for numeric `turnIndex` telemetry parity. */
    this._nextTurnOrdinal = 0;
    /**
     * Latest session-wide nano-AIU total reported by the SDK's usage metrics
     * (`rpc.usage.getMetrics`), which is authoritative for what the session as a
     * whole has been billed: it folds in every model call plus compaction,
     * covers work billed while no turn was active, and survives resume.
     *
     * Deliberately *not* used to derive per-turn cost. It is session-scoped and
     * read asynchronously, so differencing it against a previous reading races
     * turn boundaries — the SDK's terminal `session.idle` can close a turn while
     * a read is still in flight. Per-turn cost comes from the synchronous
     * per-event `copilotUsage` instead (see {@link CopilotTurn.copilotNanoAiu}).
     */
    this._sessionTotalNanoAiu = 0;
    this._promptCacheRefreshGeneration = 0;
    /**
     * Serializes the metrics reads behind {@link _refreshSessionUsageMetrics}. Several
     * handlers refresh the total, so without this their RPCs overlap and an older
     * one resolving last would publish a session cost that visibly regresses. A
     * high-water mark cannot be used to reject stale reads instead, because the
     * total is legitimately non-monotonic (see the truncation note below). Keeping
     * one read in flight makes out-of-order resolution impossible, and coalesces
     * the redundant reads that a burst of usage events would otherwise issue.
     */
    this._sessionUsageMetricsRefreshThrottler = this._register(new Throttler());
    this._autoApprovalExperimentalModeEnabled = false;
    this._permissionModeSequencer = new Sequencer();
    this._mcpServerLifecycleSequencer = new SequencerByKey();
    this._steeringMessagesInFlight = /* @__PURE__ */ new Set();
    /**
     * Steering messages that have been accepted by the SDK but not yet
     * surfaced to the chat UI as a separate user message. When the SDK
     * echoes a steering through a `user.message` event whose `content`
     * matches one of these entries, we finalize the in-flight turn and
     * dispatch a new {@link ActionType.ChatTurnStarted} whose
     * `userMessage` is the steering content. The reducer also removes
     * the pending steering via the action's `queuedMessageId`.
     *
     * Entries left here at abort/dispose time are flushed as
     * `steering_consumed` signals so the chat UI's pending state still
     * clears in cleanup paths where we never observe the echo.
     */
    this._pendingSteeringFlips = /* @__PURE__ */ new Map();
    /** Deferred promises for pending client tool calls, keyed by toolCallId. */
    this._pendingClientToolCalls = new PendingRequestRegistry();
    /** Pending SDK MCP auth handler promises, keyed by SDK auth request id. */
    this._pendingMcpAuthRequests = new PendingRequestRegistry();
    /** `pending-edit-content:` URIs written during permission requests, keyed
     *  by toolCallId. Cleaned up when the permission resolves or the session
     *  is disposed. */
    this._pendingEditContentUris = /* @__PURE__ */ new Map();
    /**
     * Fans MCP server notifications (today: `notifications/tools/list_changed`)
     * up to the agent and on to the protocol server. Fired by the
     * `onToolsUpdated` listener once per ready MCP channel.
     */
    this._onMcpNotification = this._register(new Emitter());
    this.onMcpNotification = this._onMcpNotification.event;
    /**
     * Pending MCP `sampling/createMessage` requests received over the
     * AHP `mcp://` channel, keyed by the cancellation handle we passed
     * into {@link rpc.mcp.executeSampling}. Tracked so that session
     * teardown can issue a best-effort
     * {@link rpc.mcp.cancelSamplingExecution} for each one instead of
     * leaving the SDK-side promise (and the upstream App) hanging.
     */
    this._pendingMcpSamplings = /* @__PURE__ */ new Set();
    /** Tracks whether a non-empty activity has been published, so we only emit a clear when needed. */
    this._hasActivity = false;
    /**
     * Last SDK-reported MCP status logged for each server (keyed by server
     * name). Used to suppress duplicate lifecycle log records when the SDK
     * re-reports an unchanged status — the `rpc.mcp.list` seed and the
     * `session.mcp_servers_loaded` event routinely carry the same snapshot.
     */
    this._lastLoggedMcpStatus = /* @__PURE__ */ new Map();
    this._abortCts.value = new CancellationTokenSource();
    this.sessionId = options.rawSessionId;
    this.sessionUri = options.sessionUri;
    this._slashCommandProvider = new CopilotSlashCommandProvider(() => this._wrapper.session.rpc.commands.list({ includeBuiltins: true, includeSkills: true, includeClientCommands: true }).then((c) => c.commands), this._logService);
    this._chatChannelUri = options.chatChannelUri;
    this._onDidSessionProgress = options.onDidSessionProgress;
    this._sessionLauncher = options.sessionLauncher;
    this._launchPlan = options.launchPlan;
    this._isLaunchTokenStillCurrent = options.isLaunchTokenCurrent ?? (() => true);
    this._onTurnEnded = options.onTurnEnded ?? (() => {
    });
    this._shellManager = options.shellManager;
    this._nonPtyShellTerminals = this._register(this._instantiationService.createInstance(NonPtyShellTerminalStreams, options.sessionUri));
    this._workingDirectory = options.workingDirectory;
    this._customizationDirectory = options.customizationDirectory;
    this._serverToolHost = options.serverToolHost;
    this._platform = options.platform ?? process.platform;
    this._telemetryReporter = new AgentHostTelemetryReporter(this._telemetryService);
    this._repoInfoTelemetry = this._register(this._instantiationService.createInstance(AgentHostRepoInfoTelemetry, this._telemetryReporter));
    this._appliedSnapshot = options.clientSnapshot ?? { tools: [], plugins: [], mcpServers: {} };
    this._appliedAdditionalDirectories = [...this._launchPlan.additionalDirectories ?? []];
    this._clientToolNames = clientToolNamesFromSnapshot(this._appliedSnapshot);
    const model = this._launchPlan.kind === "create" ? this._launchPlan.model : this._launchPlan.fallback.model;
    const effectiveModel = applyModelFamilyAlias(model, this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.ModelCapabilityOverrides));
    this._toolSearchActive = this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.ToolSearchEnabled) === true && agentHostModelSupportsToolSearch(effectiveModel?.id) && this._clientToolNames.has(CLIENT_TOOL_SEARCH_REFERENCE_NAME);
    this._activeClientToolSet = options.activeClientToolSet ?? new ActiveClientToolSet();
    this._databaseRef = sessionDataService.openDatabase(this._storageUri);
    this._register(toDisposable(() => this._databaseRef.dispose()));
    this._sessionDataDir = sessionDataService.getSessionDataDir(this._storageUri);
    this._editTracker = this._instantiationService.createInstance(
      FileEditTracker,
      this._storageUri.toString(),
      this._databaseRef.object
    );
    this._mcpCustomizations = this._register(this._instantiationService.createInstance(McpCustomizationController, {
      providerId: this.sessionUri.scheme,
      sessionId: this.sessionId,
      sessionUri: this.sessionUri,
      resolveChildId: options.resolveMcpChildId,
      emit: (action) => this._emitAction(action)
    }));
    this._register(toDisposable(() => this._cancelAllPendingInteractions()));
    this._register(toDisposable(() => this._shellManager?.dispose()));
    this._register(toDisposable(() => this._drainPendingSteeringFlips()));
    if (this._shellManager) {
      this._register(this._shellManager.onDidAssociateTerminal(({ toolCallId, terminalUri, displayName }) => {
        const tracked = this._activeToolCalls.get(toolCallId);
        if (!tracked) {
          return;
        }
        tracked.content.push({
          type: ToolResultContentType.Terminal,
          resource: terminalUri,
          title: displayName
        });
        this._emitAction({
          type: ActionType.ChatToolCallContentChanged,
          turnId: this._turnId,
          toolCallId,
          content: tracked.content
        });
      }));
    }
  }
  /** Working directory this session operates in, if any. */
  get workingDirectory() {
    return this._workingDirectory;
  }
  /**
   * Protocol turn ID of the active turn, or `''` when idle. Used by file
   * edit tracking and emitted on per-turn actions.
   */
  get _turnId() {
    return this._currentTurn?.id ?? "";
  }
  /** 0-based ordinal of the active turn within the session, or `0` when idle. */
  get _turnOrdinal() {
    return this._currentTurn?.ordinal ?? 0;
  }
  /**
   * Whether the session currently has an in-flight turn. Used by
   * non-destructive idle release to avoid disconnecting mid-turn.
   */
  get hasActiveTurn() {
    return this._currentTurn !== void 0;
  }
  get chatUri() {
    return this._chatChannelUri;
  }
  get currentTurnClientType() {
    return this._currentTurn?.clientType ?? AgentHostClientType.Unknown;
  }
  get _storageUri() {
    return isDefaultChatUri(this._chatChannelUri) ? this.sessionUri : this._chatChannelUri;
  }
  get mcpServerStates() {
    return this._mcpCustomizations.runtimeStates;
  }
  // ---- AgentSignal helpers ------------------------------------------------
  /** Wraps a {@link SessionAction} in an {@link AgentSignal} envelope and emits it. */
  /** todo@connor4312: AHP is missing a chat activity update action which is needed to drop `SessionAction` here */
  _emitAction(action, parentToolCallId) {
    this._onDidSessionProgress.fire({
      kind: "action",
      resource: isChatAction(action) ? this._chatChannelUri : this.sessionUri,
      action,
      parentToolCallId
    });
  }
  /**
   * Promotes a pending steering message into its own protocol turn:
   * closes the in-flight turn (so its responseParts settle into history)
   * and dispatches {@link ActionType.ChatTurnStarted} for a fresh
   * turn whose user message is the steering content. The action's
   * `queuedMessageId` atomically clears the corresponding pending
   * steering message from the session state.
   *
   * All subsequent SDK events (message deltas, tool calls, …) emitted
   * by the agent now reference the new `_turnId`, so the steering
   * response lands in the new turn rather than being folded into the
   * original.
   *
   * Returns the new turn id so callers (notably the `user.message`
   * handler) can associate the SDK event id with the steering turn for
   * history.truncate / sessions.fork mapping.
   */
  _beginSteeringTurn(steering) {
    this._completeActiveTurn();
    const newTurnId = generateUuid();
    this._emitAction({
      type: ActionType.ChatTurnStarted,
      turnId: newTurnId,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: steering.message,
      queuedMessageId: steering.id
    });
    this.resetTurnState(newTurnId);
    if (this._currentTurn) {
      this._currentTurn.messageCharLen = steering.message.text.length;
      this._currentTurn.markRunning();
    }
    return newTurnId;
  }
  /**
   * Drains any steering messages we acknowledged to the SDK but never
   * promoted to their own turn (e.g. on abort or session dispose). Fires
   * `steering_consumed` so the chat UI removes the lingering pending
   * steering bubble even when no fresh `user.message` arrives.
   */
  _drainPendingSteeringFlips() {
    if (this._pendingSteeringFlips.size === 0) {
      return;
    }
    const ids = [...this._pendingSteeringFlips.keys()];
    this._pendingSteeringFlips.clear();
    for (const id of ids) {
      this._onDidSessionProgress.fire({
        kind: "steering_consumed",
        chat: this._chatChannelUri,
        id
      });
    }
  }
  /**
   * Pops the buffered steering message whose text matches the SDK
   * `user.message` content we just observed. Matching by content (rather
   * than just popping FIFO) keeps us robust against the SDK reordering
   * or coalescing entries — concurrent steering messages with different
   * texts are still matched to the correct one. Returns `undefined` if
   * no buffered entry matches; the caller treats the `user.message` as
   * an ordinary echo and skips the turn flip.
   */
  _takeMatchingPendingSteering(content) {
    if (this._pendingSteeringFlips.size === 0) {
      return void 0;
    }
    for (const [id, msg] of this._pendingSteeringFlips) {
      if (msg.message.text === content) {
        this._pendingSteeringFlips.delete(id);
        return msg;
      }
    }
    return void 0;
  }
  _parentToolCallIdForSubagentEvent(e) {
    return e.agentId ? this._parentToolCallIdsByAgentId.get(e.agentId) : void 0;
  }
  _resumeSubagentForEvent(e, message) {
    if (!e.agentId || this._activeSubagentAgentIds.has(e.agentId)) {
      return;
    }
    const parentToolCallId = this._parentToolCallIdsByAgentId.get(e.agentId);
    if (!parentToolCallId) {
      return;
    }
    this._activeSubagentAgentIds.add(e.agentId);
    this._onDidSessionProgress.fire({
      kind: "subagent_resumed",
      chat: this._chatChannelUri,
      toolCallId: parentToolCallId,
      message
    });
  }
  _completeSubagentTurn(agentId, toolCallId) {
    if (agentId) {
      if (!this._activeSubagentAgentIds.delete(agentId)) {
        return;
      }
    } else if (!toolCallId) {
      return;
    }
    const parentToolCallId = toolCallId ?? (agentId ? this._parentToolCallIdsByAgentId.get(agentId) : void 0);
    if (!parentToolCallId) {
      return;
    }
    this._onDidSessionProgress.fire({
      kind: "subagent_completed",
      chat: this._chatChannelUri,
      toolCallId: parentToolCallId
    });
  }
  _shouldDropUnmappedSubagentEvent(e, eventName) {
    const parentToolCallId = this._parentToolCallIdForSubagentEvent(e);
    if (!parentToolCallId && e.agentId) {
      this._logService.warn(`[Copilot:${this.sessionId}] Dropping ${eventName} for unknown subagent agentId=${e.agentId}`);
      return true;
    }
    return false;
  }
  _getToolCallContributor(toolName, mcpServerName) {
    const clientToolName = this._clientToolName(toolName);
    if (this._clientToolNames.has(clientToolName)) {
      const clientId = this._activeClientToolSet.ownerOf(clientToolName, this._currentTurn?.senderClientId);
      return clientId ? { kind: ToolCallContributorKind.Client, clientId } : void 0;
    }
    if (mcpServerName) {
      const customizationId = this._mcpCustomizations.customizationIdForServer(mcpServerName);
      return customizationId ? { kind: ToolCallContributorKind.MCP, customizationId } : void 0;
    }
    return void 0;
  }
  _createToolCallMeta(toolName, parameters) {
    const toolKind = getToolKind(toolName, parameters);
    const subagentMeta = toolKind === "subagent" ? getSubagentMetadata(parameters) : void 0;
    return {
      toolKind,
      language: toolKind === "terminal" ? getShellLanguage(toolName) : void 0,
      subagentDescription: subagentMeta?.description,
      subagentAgentName: subagentMeta?.agentName
    };
  }
  _getStreamingToolCallDisplay(toolName, input) {
    const partialInput = parseCopilotStreamingToolInput(input);
    const parameters = partialInput !== null && typeof partialInput === "object" && !Array.isArray(partialInput) ? partialInput : void 0;
    return {
      parameters,
      meta: this._createToolCallMeta(toolName, parameters),
      invocationMessage: getStreamingInvocationMessage(toolName, getToolDisplayName(toolName), partialInput, (path) => this._resolveEditFilePath(path))
    };
  }
  _emitStreamingToolCallDisplay(toolCallId, streaming) {
    if (!streaming.toolName) {
      return;
    }
    const display = this._getStreamingToolCallDisplay(streaming.toolName, streaming.input);
    streaming.displayedInputLength = streaming.input.length;
    const message = streamingToolDisplayText(display.invocationMessage);
    if (message === streaming.displayedMessage) {
      return;
    }
    streaming.displayedMessage = message;
    this._emitAction({
      type: ActionType.ChatToolCallDelta,
      turnId: this._turnId,
      toolCallId,
      content: "",
      invocationMessage: display.invocationMessage,
      _meta: toToolCallMeta(display.meta)
    }, streaming.parentToolCallId);
  }
  _scheduleStreamingToolCallDisplay(toolCallId) {
    let scheduler = this._streamingToolDisplaySchedulers.get(toolCallId);
    if (!scheduler) {
      scheduler = new RunOnceScheduler(() => {
        const streaming = this._streamingToolCalls.get(toolCallId);
        if (!streaming?.started || !streaming.toolName) {
          return;
        }
        if (streaming.displayedInputLength === streaming.input.length) {
          return;
        }
        this._emitStreamingToolCallDisplay(toolCallId, streaming);
      }, STREAMING_TOOL_DISPLAY_INTERVAL_MS);
      this._streamingToolDisplaySchedulers.set(toolCallId, scheduler);
    }
    if (!scheduler.isScheduled()) {
      scheduler.schedule();
    }
  }
  _beginToolCallRound(parentToolCallId) {
    const scope = parentToolCallId ?? "";
    this._currentTurn?.markdownPartIds.delete(scope);
    this._currentTurn?.reasoningPartIds.delete(scope);
  }
  /**
   * Starts a fresh `pending` turn, discarding any per-turn streaming state
   * from a previous turn so the next text/reasoning chunk allocates a new
   * response part. The turn becomes `running` on the first SDK event.
   */
  resetTurnState(turnId, senderClientId, clientType = AgentHostClientType.Unknown) {
    this._streamingToolCalls.clear();
    this._streamingToolDisplaySchedulers.clearAndDisposeAll();
    this._currentTurn = new CopilotTurn(turnId, this._nextTurnOrdinal++, senderClientId, clientType);
  }
  /** Refreshes prompt-cache state and the session-wide nano-AIU total from the SDK's authoritative usage metrics. */
  async _refreshSessionUsageMetrics() {
    try {
      return await this._sessionUsageMetricsRefreshThrottler.queue(async () => {
        const promptCacheRefreshGeneration = this._promptCacheRefreshGeneration;
        const metrics = await this._wrapper.session.rpc.usage.getMetrics();
        const modelId = metrics.currentModel;
        if (!this._store.isDisposed && modelId && promptCacheRefreshGeneration === this._promptCacheRefreshGeneration) {
          const cacheExpiresAt = metrics.modelMetrics[modelId]?.cacheExpiresAt;
          this._setPromptCacheState(cacheExpiresAt ? { modelId, cacheExpiresAt } : void 0);
        }
        const total = metrics.totalNanoAiu;
        if (typeof total !== "number" || !Number.isFinite(total) || total < 0 || total === this._sessionTotalNanoAiu) {
          return false;
        }
        this._sessionTotalNanoAiu = total;
        return true;
      });
    } catch (err) {
      this._logService.trace(`[Copilot:${this.sessionId}] usage.getMetrics RPC failed: ${getErrorMessage(err)}`);
      return false;
    }
  }
  /**
   * The parent-scope Copilot billing metadata for the active turn: the turn's
   * own accumulated cost plus the SDK's session-wide total. Absent until
   * something has actually been billed.
   */
  _parentCopilotUsageMeta() {
    const turnNanoAiu = this._currentTurn?.copilotNanoAiu ?? 0;
    if (!turnNanoAiu && !this._sessionTotalNanoAiu) {
      return void 0;
    }
    return {
      ...turnNanoAiu ? { totalNanoAiu: turnNanoAiu } : {},
      ...this._sessionTotalNanoAiu ? { sessionTotalNanoAiu: this._sessionTotalNanoAiu } : {}
    };
  }
  /** Reads the SDK's per-source context-window attribution, or `undefined` when unavailable. */
  async _readContextAttribution() {
    let attribution;
    try {
      attribution = (await this._wrapper.session.rpc.metadata.getContextAttribution())?.contextAttribution ?? void 0;
    } catch (err) {
      this._logService.trace(`[Copilot:${this.sessionId}] contextAttribution RPC failed: ${getErrorMessage(err)}`);
      return void 0;
    }
    if (!attribution) {
      this._logService.trace(`[Copilot:${this.sessionId}] contextAttribution: null/empty`);
      return void 0;
    }
    if (this._logService.getLevel() <= LogLevel.Trace) {
      this._logService.trace(`[Copilot:${this.sessionId}] contextAttribution: totalTokens=${attribution.totalTokens}, entries=${JSON.stringify(attribution.entries.map((e) => ({ kind: e.kind, id: e.id, label: e.label, tokens: e.tokens, parentId: e.parentId })))}`);
    }
    return attribution;
  }
  _completeActiveTurn() {
    const turn = this._currentTurn;
    if (!turn) {
      return;
    }
    turn.markCompleted();
    this._reportToolCallDetails(turn, "success");
    this._emitAction({
      type: ActionType.ChatTurnComplete,
      turnId: turn.id,
      duration: turn.duration
    });
    this._clearActiveTurn();
  }
  failActiveTurn(error) {
    const turn = this._currentTurn;
    if (!turn) {
      return void 0;
    }
    this._reportToolCallDetails(turn, "failed");
    this._emitAction({
      type: ActionType.ChatError,
      turnId: turn.id,
      duration: turn.duration,
      error
    });
    this._clearActiveTurn();
    return turn.id;
  }
  discardActiveTurn() {
    if (this._currentTurn) {
      this._clearActiveTurn();
    }
  }
  /**
   * Drops the active turn and reports that this chat is now idle. Every
   * transition out of an in-flight turn must go through here so work the
   * agent defers while a turn runs — notably a pending CLI client restart —
   * is not stranded waiting on a turn that already ended.
   */
  _clearActiveTurn() {
    this._currentTurn = void 0;
    this._streamingToolCalls.clear();
    this._streamingToolDisplaySchedulers.clearAndDisposeAll();
    try {
      this._onTurnEnded();
    } catch (err) {
      this._logService.error(err, `[Copilot:${this.sessionId}] onTurnEnded callback failed`);
    }
  }
  _reportToolCallDetails(turn, responseType) {
    if (turn.toolCallDetailsReported) {
      return;
    }
    turn.toolCallDetailsReported = true;
    void this._telemetryReporter.toolCallDetails({
      provider: "copilot",
      session: this.sessionUri.toString(),
      turnId: turn.id,
      clientType: turn.clientType,
      model: turn.lastModel,
      responseType,
      toolCounts: Object.fromEntries(turn.toolCounts),
      availableTools: this._appliedSnapshot.tools.map((tool) => tool.name),
      numRequests: turn.toolCallRounds,
      turnIndex: turn.ordinal,
      turnDuration: turn.duration,
      messageCharLen: turn.messageCharLen,
      totalToolCalls: turn.totalToolCalls,
      parallelToolCallRounds: turn.parallelToolCallRounds,
      parallelToolCallsTotal: turn.parallelToolCallsTotal
    }).catch((err) => this._logService.trace(`[Copilot:${this.sessionId}] Telemetry emission failed: ${getErrorMessage(err)}`));
  }
  _reportToolApproval(toolCallId, toolName, mcpServerName) {
    const record = this._toolApprovalRecords.get(toolCallId);
    if (!toolName || isHiddenTool(toolName) || record?.reported) {
      return;
    }
    const confirmKind = mapPermissionResultToConfirmKind(record?.resultKind, record?.resolvedByHook === true);
    this._telemetryReporter.toolApproval({
      provider: "copilot",
      session: this.sessionUri.toString(),
      turnId: this._turnId,
      toolId: toolName,
      toolSourceKind: this._toolSourceKindFor(toolName, mcpServerName),
      confirmKind,
      confirmationNotNeededReason: confirmKind === "confirmationNotNeeded" && record?.resolvedByHook ? "other" : void 0,
      requestUnsandboxedExecution: record?.requestSandboxBypass ? true : void 0
    });
    if (record) {
      record.reported = true;
    }
  }
  _reportToolApprovalIfNoPermission(toolCallId) {
    const record = this._toolApprovalRecords.get(toolCallId);
    if (record && !record.permissionRequested) {
      this._reportToolApproval(toolCallId, record.toolName, record.mcpServerName);
    }
  }
  _toolSourceKindFor(toolName, mcpServerName) {
    if (mcpServerName) {
      return "mcp";
    }
    if (this._clientToolNames.has(toolName)) {
      return "client";
    }
    return "internal";
  }
  _getEditFilePaths(parameters) {
    return getEditFilePaths(parameters).map((path) => this._resolveEditFilePath(path));
  }
  _resolveEditFilePath(path) {
    if (isAbsolute(path) || !this._workingDirectory || this._workingDirectory.scheme !== Schemas.file) {
      return path;
    }
    return join(this._workingDirectory.fsPath, path);
  }
  /**
   * Emits a synthetic markdown content block for the active turn and
   * makes it the current markdown response part so that subsequent SDK
   * deltas append to it. Used by the agent to surface one-shot host
   * messages (e.g. the worktree-created announcement) at the top of the
   * first response.
   */
  emitInitialMarkdown(content) {
    this._emitMarkdownDelta(content);
  }
  /**
   * Emits a streaming text delta. The first delta of a turn allocates a
   * markdown response part; subsequent deltas append to it.
   */
  _emitMarkdownDelta(content, parentToolCallId) {
    const turn = this._currentTurn;
    if (!turn) {
      this._logService.error(`[Copilot:${this.sessionId}] Markdown delta emitted with no active turn; dropping`);
      return;
    }
    const markdownScope = parentToolCallId ?? "";
    let partId = turn.markdownPartIds.get(markdownScope);
    if (!partId) {
      partId = generateUuid();
      turn.markdownPartIds.set(markdownScope, partId);
      this._emitAction({
        type: ActionType.ChatResponsePart,
        turnId: turn.id,
        part: { kind: ResponsePartKind.Markdown, id: partId, content }
      }, parentToolCallId);
      return;
    }
    this._emitAction({
      type: ActionType.ChatDelta,
      turnId: turn.id,
      partId,
      content
    }, parentToolCallId);
  }
  /** Emits a reasoning delta, similar to {@link _emitMarkdownDelta} but for reasoning parts. */
  _emitReasoningDelta(content, parentToolCallId) {
    const turn = this._currentTurn;
    if (!turn) {
      this._logService.error(`[Copilot:${this.sessionId}] Reasoning delta emitted with no active turn; dropping`);
      return;
    }
    const reasoningScope = parentToolCallId ?? "";
    let partId = turn.reasoningPartIds.get(reasoningScope);
    if (!partId) {
      partId = generateUuid();
      turn.reasoningPartIds.set(reasoningScope, partId);
      this._emitAction({
        type: ActionType.ChatResponsePart,
        turnId: turn.id,
        part: { kind: ResponsePartKind.Reasoning, id: partId, content }
      }, parentToolCallId);
      return;
    }
    this._emitAction({
      type: ActionType.ChatReasoning,
      turnId: turn.id,
      partId,
      content
    }, parentToolCallId);
  }
  /**
   * The snapshot of client contributions captured when this session was
   * created. Used by the agent to detect when the session is 1stale.
   */
  get appliedSnapshot() {
    return this._appliedSnapshot;
  }
  /**
   * Secondary roots granted when this live SDK session was created or resumed.
   * The primary process root is immutable and therefore excluded.
   */
  get appliedAdditionalDirectories() {
    return this._appliedAdditionalDirectories;
  }
  get customizationDirectory() {
    return this._customizationDirectory;
  }
  /**
   * Creates SDK {@link Tool} objects for the client-provided tools in the
   * applied snapshot. The handler parks a request in
   * {@link _pendingClientToolCalls} and waits for the client to dispatch
   * `session/toolCallComplete`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _createClientSdkTools() {
    const tools = this._appliedSnapshot.tools;
    if (tools.length === 0) {
      return [];
    }
    const toolSearchActive = this._isToolSearchActive();
    const sessionTools = toolSearchActive ? tools : tools.filter((def) => def.name !== CLIENT_TOOL_SEARCH_REFERENCE_NAME);
    return sessionTools.map((def) => {
      if (toolSearchActive && def.name === CLIENT_TOOL_SEARCH_REFERENCE_NAME) {
        return {
          name: RUNTIME_TOOL_SEARCH_TOOL_NAME,
          description: def.description ?? "",
          parameters: def.inputSchema ?? { type: "object", properties: {} },
          overridesBuiltInTool: true,
          defer: "never",
          skipPermission: true,
          handler: this._guarded(async (_args, invocation) => {
            try {
              const candidates = this._toToolSearchCandidates(invocation.availableTools);
              const clientResult = await this._pendingClientToolCalls.registerAndFire(
                invocation.toolCallId,
                () => this._emitToolSearchReady(invocation.toolCallId, candidates)
              );
              return this._toToolSearchResult(clientResult, invocation.availableTools);
            } catch (error) {
              this._logService.error(error, `[Copilot:${this.sessionId}] Failed in tool-search handler: toolCallId=${invocation.toolCallId}`);
              return this._toolSearchFailure(getErrorMessage(error));
            }
          }, this._toolSearchFailure("Tool call cancelled: session is aborting"), "tool-search")
        };
      }
      const defer = toolSearchActive ? NON_DEFERRED_CLIENT_TOOL_NAMES.has(def.name) ? "never" : "auto" : void 0;
      return {
        name: def.name,
        description: def.description ?? "",
        parameters: def.inputSchema ?? { type: "object", properties: {} },
        defer,
        handler: this._guarded(async (_args, { toolCallId }) => {
          try {
            return await this._pendingClientToolCalls.register(toolCallId);
          } catch (error) {
            this._logService.error(error, `[Copilot:${this.sessionId}] Failed in client tool handler: tool=${def.name}, toolCallId=${toolCallId}`);
            throw error;
          }
        }, this._toolSearchFailure("Tool call cancelled: session is aborting"), "client-tool")
      };
    });
  }
  _isToolSearchActive() {
    return this._toolSearchActive;
  }
  get _abortToken() {
    return this._abortCts.value?.token ?? CancellationToken.Cancelled;
  }
  _beginAbort() {
    if (this._abortToken.isCancellationRequested) {
      return;
    }
    this._abortCts.value?.cancel();
    this._cancelAllPendingInteractions();
  }
  _resetAbortToken() {
    this._abortCts.value = new CancellationTokenSource();
  }
  /**
   * Guards SDK callbacks against aborts: the synchronous pre-check avoids the `shortcutEvent` macrotask for already-cancelled tokens, while the race releases callbacks that park after the abort sweep.
   * The post-race check catches handler completions that win the cancellation macrotask because promise continuations run as microtasks.
   */
  _guarded(handler, cancelled, label) {
    return async (...args) => {
      const token = this._abortToken;
      if (token.isCancellationRequested) {
        this._logService.info(`[Copilot:${this.sessionId}] Discarding ${label} callback received while aborting`);
        return cancelled;
      }
      const result = await raceCancellation(handler(...args), token, cancelled);
      if (token.isCancellationRequested) {
        this._logService.info(`[Copilot:${this.sessionId}] Discarding ${label} callback result after abort`);
        return cancelled;
      }
      return result;
    };
  }
  _clientToolName(toolName) {
    return this._isToolSearchActive() && toolName === RUNTIME_TOOL_SEARCH_TOOL_NAME ? CLIENT_TOOL_SEARCH_REFERENCE_NAME : toolName;
  }
  _toToolSearchCandidates(availableTools) {
    return (availableTools ?? []).filter((tool) => tool.deferLoading).map((tool) => ({
      name: tool.name,
      description: tool.description ?? ""
    }));
  }
  _emitToolSearchReady(toolCallId, candidates) {
    const tracked = this._activeToolCalls.get(toolCallId);
    if (!tracked) {
      throw new Error(`Tool-search call '${toolCallId}' was not tracked.`);
    }
    this._emitAction({
      type: ActionType.ChatToolCallReady,
      turnId: this._turnId,
      toolCallId,
      ...tracked.contributor ? { contributor: tracked.contributor } : {},
      ...tracked.intention !== void 0 ? { intention: tracked.intention } : {},
      invocationMessage: getInvocationMessage(tracked.toolName, tracked.displayName, tracked.parameters, (path) => this._resolveEditFilePath(path)),
      toolInput: getToolInputString(tracked.toolName, tracked.parameters, tracked.parameters ? tryStringify(tracked.parameters) : void 0),
      confirmed: ToolCallConfirmationReason.NotNeeded,
      _meta: toToolCallMeta({ ...tracked.meta ?? {}, toolSearchCandidates: candidates })
    }, tracked.parentToolCallId);
  }
  _toolSearchFailure(message) {
    return { textResultForLlm: message, resultType: "failure", error: message, toolReferences: [] };
  }
  _toToolSearchResult(clientResult, availableTools) {
    const deferred = /* @__PURE__ */ new Map();
    for (const tool of availableTools ?? []) {
      if (tool.deferLoading) {
        deferred.set(tool.name, tool.name);
        if (tool.namespacedName) {
          deferred.set(tool.namespacedName, tool.name);
        }
      }
    }
    const parsedClientNames = this._parseToolSearchNames(clientResult.textResultForLlm);
    const clientNames = parsedClientNames ?? [];
    const toolReferences = [...new Set(clientNames.map((name) => deferred.get(name)).filter(isDefined))];
    this._logService.info(`[Copilot:${this.sessionId}] tool_search override: availableTools=${availableTools?.length ?? 0}, deferred=${deferred.size}, clientMatched=[${clientNames.join(", ")}] -> toolReferences=[${toolReferences.join(", ")}]`);
    return {
      ...clientResult,
      ...clientResult.resultType === "success" && parsedClientNames !== void 0 ? { textResultForLlm: JSON.stringify(toolReferences) } : {},
      toolReferences
    };
  }
  _parseToolSearchNames(text) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string") : void 0;
    } catch {
      return void 0;
    }
  }
  /**
   * Builds SDK tool handlers for the agent host's server tools. Each handler
   * executes the tool against this session's state via the
   * {@link IAgentServerToolHost} and returns its textual result. Returns an
   * empty list when no server-tool host is wired (e.g. test / standalone
   * construction).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _createServerSdkTools() {
    const host = this._serverToolHost;
    if (!host) {
      return [];
    }
    return host.definitions.map((def) => ({
      name: def.name,
      description: def.description ?? "",
      parameters: def.inputSchema ?? { type: "object", properties: {} },
      defer: "never",
      handler: async (args) => {
        try {
          const text = host.executeTool(this._chatChannelUri.toString(), def.name, args);
          return { textResultForLlm: await text, resultType: "success" };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this._logService.error(error, `[Copilot:${this.sessionId}] Failed in server tool handler: tool=${def.name}`);
          return { textResultForLlm: message, resultType: "failure", error: message };
        }
      }
    }));
  }
  /**
   * Resolves a pending client tool call. If the SDK handler has not yet
   * registered for `toolCallId`, the result is buffered so the handler
   * resolves immediately once it does.
   */
  handleClientToolCallComplete(toolCallId, result) {
    this._approvedDuplicablePermissionSignatures.delete(toolCallId);
    if (!result.success && this._cancelMcpAuthenticationForToolCall(toolCallId)) {
      this._activeToolCalls.delete(toolCallId);
      return;
    }
    const textContent = result.content?.filter((c) => c.type === ToolResultContentType.Text).map((c) => c.text).join("\n") ?? "";
    const binaryResults = result.content?.filter((c) => c.type === ToolResultContentType.EmbeddedResource).map((c) => ({ data: c.data, mimeType: c.contentType, type: /^image(\/|$)/.test(c.contentType) ? "image" : "resource" }));
    const textResultForLlm = textContent.trim() ? textContent : getEmptyToolResultText(binaryResults);
    if (result.success) {
      this._pendingClientToolCalls.respondOrBuffer(toolCallId, {
        textResultForLlm,
        resultType: "success",
        binaryResultsForLlm: binaryResults?.length ? binaryResults : void 0
      });
    } else {
      this._pendingClientToolCalls.respondOrBuffer(toolCallId, {
        textResultForLlm: textContent.trim() ? textContent : result.error?.message || "Tool call failed",
        resultType: "failure",
        error: result.error?.message,
        binaryResultsForLlm: binaryResults?.length ? binaryResults : void 0
      });
    }
    if (this._pendingPermissions.getMetadata(toolCallId)?.managedApprovalRequired !== true) {
      this.respondToPermissionRequest(toolCallId, true);
    }
  }
  _cancelMcpAuthenticationForToolCall(toolCallId) {
    for (const [requestId, pending] of this._pendingMcpAuthRequests.entries()) {
      const toolCallIndex = pending.toolCalls.findIndex((toolCall) => toolCall.toolCallId === toolCallId);
      if (toolCallIndex === -1) {
        continue;
      }
      pending.toolCalls.splice(toolCallIndex, 1);
      if (pending.toolCalls.length === 0) {
        this._pendingMcpAuthRequests.respond(requestId, { kind: "cancelled" });
      }
      return true;
    }
    return false;
  }
  /**
   * Creates (or resumes) the SDK session via the injected launcher and
   * wires up all event listeners. Must be called exactly once after
   * construction before using the session.
   */
  async initializeSession() {
    const wrapper = await this._sessionLauncher.launch(this._launchPlan, this._createRuntimeAdapter());
    if (this._store.isDisposed) {
      wrapper.dispose();
      throw new CancellationError();
    }
    this._wrapper = this._register(wrapper);
    this._subscribeToEvents();
    this._subscribeForLogging();
    this._subscribeForMemoInvalidation();
    this._subscribeForInstructionsCollectedTelemetry();
    this._subscribeToPermissionConfigChanges();
    this._promptCacheState = readSessionPromptCacheState(this._stateManager.getSessionSummary(this.sessionUri.toString())?._meta);
    if (this._launchPlan.kind === "resume") {
      await this._refreshSessionUsageMetrics();
      if (this._store.isDisposed) {
        throw new CancellationError();
      }
    }
    this._serverToolHost?.advertise(this._storageUri.toString());
  }
  _setPromptCacheState(promptCache) {
    const currentSummary = this._stateManager.getSessionSummary(this.sessionUri.toString());
    const currentMeta = currentSummary?._meta;
    const currentPromptCache = currentSummary ? readSessionPromptCacheState(currentMeta) : this._promptCacheState;
    this._promptCacheState = currentPromptCache;
    if (currentPromptCache?.modelId === promptCache?.modelId && currentPromptCache?.cacheExpiresAt === promptCache?.cacheExpiresAt) {
      return;
    }
    this._promptCacheState = promptCache;
    this._stateManager.setSessionMeta(this.sessionUri.toString(), withSessionPromptCacheState(currentMeta, promptCache));
  }
  _createRuntimeAdapter() {
    return {
      handlePermissionRequest: this._guarded((request) => this._handlePermissionRequest(request), { kind: "reject" }, "permission"),
      handleExitPlanModeRequest: this._guarded((request, invocation) => this._handleExitPlanModeRequest(request, invocation), { approved: false }, "exit-plan-mode"),
      handleUserInputRequest: this._guarded((request, invocation) => this._handleUserInputRequest(request, invocation), { answer: "", wasFreeform: true }, "user-input"),
      handleElicitationRequest: this._guarded((context) => this._handleElicitationRequest(context), { action: "cancel" }, "elicitation"),
      handleMcpAuthRequest: this._guarded((request) => this._handleMcpAuthRequest(request), { kind: "cancelled" }, "mcp-auth"),
      requestUnsandboxedCommandConfirmation: this._guarded((request) => this._requestUnsandboxedCommandConfirmation(request), false, "unsandboxed-command-confirmation"),
      createClientSdkTools: () => this._createClientSdkTools(),
      createServerSdkTools: () => this._createServerSdkTools(),
      handlePreToolUse: (input) => this._handlePreToolUse(input),
      handlePostToolUse: (input) => this._handlePostToolUse(input)
    };
  }
  async resolveMcpAuthentication(params) {
    let resolved = false;
    for (const [requestId, pending] of this._pendingMcpAuthRequests.entries()) {
      if (pending.resource.resource !== params.resource || !this._scopesSatisfy(params.scopes, pending.requiredScopes)) {
        continue;
      }
      for (const toolCall of pending.toolCalls) {
        this._emitAction({
          type: ActionType.ChatToolCallAuthResolved,
          turnId: toolCall.turnId,
          toolCallId: toolCall.toolCallId
        }, toolCall.parentToolCallId);
      }
      resolved = this._pendingMcpAuthRequests.respond(requestId, { kind: "token", accessToken: params.token }) || resolved;
    }
    return resolved;
  }
  async _handleMcpAuthRequest(request) {
    const githubToken = request.reason === "initial" && this._scopesFromChallenge(request.wwwAuthenticateParams?.scope).length === 0 ? await this._initialGitHubMcpToken(request) : void 0;
    if (githubToken) {
      this._logService.info(`[Copilot:${this.sessionId}] Reusing the existing GitHub token for initial GitHub MCP authentication`);
      return { kind: "token", accessToken: githubToken };
    }
    const resource = this._protectedResourceFromMcpAuthRequest(request);
    const requiredScopes = this._scopesFromChallenge(request.wwwAuthenticateParams?.scope);
    const oauthClient = request.staticClientConfig?.publicClient ? { clientId: request.staticClientConfig.clientId } : request.staticClientConfig?.clientSecret ? { clientId: request.staticClientConfig.clientId, clientSecret: request.staticClientConfig.clientSecret } : void 0;
    const auth = {
      reason: this._mcpAuthRequiredReason(request.reason),
      ...oauthClient ? { oauthClient } : {},
      resource,
      requiredScopes: requiredScopes.length ? [...requiredScopes] : void 0,
      description: request.wwwAuthenticateParams?.error
    };
    const toolCalls = this._activeMcpToolCalls(request.serverName);
    const result = this._pendingMcpAuthRequests.register(request.requestId, {
      serverName: request.serverName,
      resource,
      requiredScopes,
      toolCalls
    });
    this._mcpCustomizations.applyOne({
      name: request.serverName,
      state: {
        kind: McpServerStatus.AuthRequired,
        ...auth
      }
    });
    for (const toolCall of toolCalls) {
      this._emitAction({
        type: ActionType.ChatToolCallAuthRequired,
        turnId: toolCall.turnId,
        toolCallId: toolCall.toolCallId,
        auth
      }, toolCall.parentToolCallId);
    }
    this._logService.info(`[Copilot:${this.sessionId}] MCP server '${request.serverName}' requires authentication for ${resource.resource}`);
    return result;
  }
  _activeMcpToolCalls(serverName) {
    if (!this._turnId) {
      return [];
    }
    const result = [];
    for (const [toolCallId, toolCall] of this._activeToolCalls) {
      if (toolCall.mcpServerName === serverName) {
        result.push({ turnId: this._turnId, toolCallId, parentToolCallId: toolCall.parentToolCallId });
      }
    }
    return result;
  }
  async _initialGitHubMcpToken(request) {
    const githubToken = this._launchPlan.githubToken;
    const requestUrl = normalizeMcpServerUrl(request.serverUrl);
    if (!githubToken || requestUrl === void 0) {
      return void 0;
    }
    const configuredUrls = [gitHubMcpServerUrl(void 0)];
    try {
      const resolvedUrl = gitHubMcpServerUrl(await this._copilotApiService.resolveApiEndpoint(githubToken));
      if (resolvedUrl) {
        configuredUrls.push(resolvedUrl);
      }
    } catch (error) {
      this._logService.warn(`[Copilot:${this.sessionId}] Failed to resolve the GitHub MCP server URL: ${getErrorMessage(error)}`);
      return void 0;
    }
    return configuredUrls.some((u) => u && requestUrl === normalizeMcpServerUrl(u)) ? githubToken : void 0;
  }
  _protectedResourceFromMcpAuthRequest(request) {
    if (request.resourceMetadata) {
      try {
        const parsed = JSON.parse(request.resourceMetadata);
        if (isAuthorizationProtectedResourceMetadata(parsed)) {
          return parsed;
        }
        this._logService.warn(`[Copilot:${this.sessionId}] Ignoring invalid MCP protected-resource metadata for '${request.serverName}'`);
      } catch (err) {
        this._logService.warn(`[Copilot:${this.sessionId}] Failed to parse MCP protected-resource metadata for '${request.serverName}'`, err);
      }
    }
    const scopes = this._scopesFromChallenge(request.wwwAuthenticateParams?.scope);
    return {
      resource: request.serverUrl,
      resource_name: request.serverName,
      scopes_supported: scopes.length ? scopes.slice() : void 0
    };
  }
  _scopesFromChallenge(scope) {
    return scope?.split(/\s+/).map((s) => s.trim()).filter((s) => s.length > 0) ?? [];
  }
  _mcpAuthRequiredReason(reason) {
    switch (reason) {
      case "refresh":
      case "reauth":
        return McpAuthRequiredReason.Expired;
      case "upscope":
        return McpAuthRequiredReason.InsufficientScope;
      case "initial":
      default:
        return McpAuthRequiredReason.Required;
    }
  }
  _scopesSatisfy(provided, required) {
    if (required.length === 0 || provided === void 0) {
      return true;
    }
    const providedSet = new Set(provided);
    return required.every((scope) => providedSet.has(scope));
  }
  _cancelPendingMcpAuthRequests() {
    this._pendingMcpAuthRequests.denyAll({ kind: "cancelled" });
  }
  _cancelPendingMcpAuthRequestsForServer(serverName) {
    for (const [requestId, pending] of this._pendingMcpAuthRequests.entries()) {
      if (pending.serverName !== serverName) {
        continue;
      }
      for (const toolCall of pending.toolCalls) {
        this._emitAction({
          type: ActionType.ChatToolCallAuthResolved,
          turnId: toolCall.turnId,
          toolCallId: toolCall.toolCallId
        }, toolCall.parentToolCallId);
      }
      this._pendingMcpAuthRequests.respond(requestId, { kind: "cancelled" });
    }
  }
  // ---- session operations -------------------------------------------------
  async send(prompt, attachments, turnId, mode, senderClientId, clientType = AgentHostClientType.Unknown) {
    this._resetAbortToken();
    if (turnId && this._currentTurn?.id !== turnId) {
      this.resetTurnState(turnId, senderClientId, clientType);
    }
    if (this._currentTurn) {
      this._currentTurn.messageCharLen = prompt.length;
    }
    const turn = this._currentTurn;
    try {
      await this._send(prompt, attachments, mode);
    } catch (err) {
      if (turn && this._currentTurn === turn) {
        this._clearActiveTurn();
      }
      throw err;
    }
  }
  async _send(prompt, attachments, mode) {
    this._logService.info(`[Copilot:${this.sessionId}] sendMessage called: "${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}" (${attachments?.length ?? 0} attachments)`);
    const slashCommand = parseLeadingSlashCommand(prompt);
    if (slashCommand?.command === "compact") {
      try {
        const result = await this._wrapper.session.rpc.history.compact();
        const usedTokens = result.contextWindow?.currentTokens;
        if (typeof usedTokens === "number") {
          await this._refreshSessionUsageMetrics();
          const copilotUsage = this._parentCopilotUsageMeta();
          const turnTokenTotals = this._currentTurn?.tokenTotals;
          const meta = {
            ...copilotUsage ? { copilotUsage } : {},
            ...turnTokenTotals ? { turnTokenTotals } : {}
          };
          this._emitAction({
            type: ActionType.ChatUsage,
            turnId: this._turnId,
            usage: {
              inputTokens: usedTokens,
              outputTokens: 0,
              model: this._lastSeenModelId,
              ...Object.keys(meta).length > 0 ? { _meta: meta } : {}
            }
          });
        }
        this.emitInitialMarkdown(localize("copilotAgent.compactionCompleted", "Compaction completed"));
      } catch (err) {
        if (getErrorMessage(err).toLowerCase().includes("nothing to compact")) {
          this.emitInitialMarkdown(localize("copilotAgent.compactionCompleted", "Compaction completed"));
          this._completeActiveTurn();
          return;
        }
        this._logService.error(err, `[Copilot:${this.sessionId}] rpc.history.compact failed`);
        throw err;
      }
      this._completeActiveTurn();
      return;
    }
    const configAction = slashCommand ? resolveCopilotConfigSlashCommandOnSend(slashCommand.command, slashCommand.rawRest) : void 0;
    if (configAction) {
      const sdkMode = toCopilotSdkMode(configAction.applyConfig[SessionConfigKey.Mode]);
      if (sdkMode) {
        mode = sdkMode;
      }
      prompt = configAction.strippedPrompt;
    } else if (slashCommand?.command === "rubber-duck") {
      if (this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.RubberDuck) !== true) {
        prompt = slashCommand.rest;
      } else {
        const userPrompt = slashCommand.rest;
        prompt = userPrompt ? `The user has requested a rubber duck review via the /rubber-duck command. Use the task tool with agent_type: "rubber-duck" to get an independent critique of your current approach, plan, or recent work. Summarize the relevant context for the rubber duck agent so it has what it needs to evaluate it.

Additional instructions: ${userPrompt}` : 'The user has requested a rubber duck review via the /rubber-duck command. Use the task tool with agent_type: "rubber-duck" to get an independent critique of your current approach, plan, or recent work. Summarize the relevant context for the rubber duck agent so it has what it needs to evaluate it.';
      }
    } else if (slashCommand) {
      const runtimeSlashCommand = await this._slashCommandProvider.resolveSlashCommand(slashCommand.command);
      if (runtimeSlashCommand && runtimeSlashCommand.kind !== "skill") {
        let result;
        try {
          result = await this._wrapper.session.rpc.commands.invoke({
            name: runtimeSlashCommand.name,
            ...slashCommand.rawRest.length > 0 ? { input: slashCommand.rawRest } : {}
          });
        } catch (err) {
          this._logService.error(err, `[Copilot:${this.sessionId}] rpc.commands.invoke(${slashCommand.command}) failed`);
          throw err;
        }
        switch (result.kind) {
          case "text":
            this._emitMarkdownDelta(result.markdown === true ? result.text : escapeMarkdownSyntaxTokens(result.text));
            break;
          case "completed":
            if (result.message) {
              this._emitMarkdownDelta(result.message);
            }
            break;
          case "agent-prompt": {
            const runtimeMode = toCopilotSdkMode(result.mode);
            if (runtimeMode) {
              mode = runtimeMode;
            }
            prompt = result.prompt;
            break;
          }
          case "select-subcommand":
            this._emitMarkdownDelta(localize(
              "copilotSlashCommand.selectSubcommandResult",
              "The /{0} command requires selecting a subcommand. Available options: {1}",
              result.command,
              result.options.map((option) => option.name).join(", ")
            ));
            break;
          default:
            this._logService.warn(`[Copilot:${this.sessionId}] Unhandled slash command result kind: ${result.kind}`);
            break;
        }
        if (result.runtimeSettingsChanged === true) {
          this._slashCommandProvider.clearCache();
        }
        if (result.kind !== "agent-prompt") {
          this._completeActiveTurn();
          return;
        }
      }
    }
    const sdkAttachments = await this._toSdkAttachments(attachments);
    await this.applyMode(mode);
    await this.syncPermissionMode("turn-start");
    await this._applyEffectiveSandboxConfig();
    await this._reconcileMcpServerEnablement();
    const traceContext = this._otelService.getSessionTraceContext(this.sessionId, this.sessionUri.toString());
    await this._otelService.withTraceContext(traceContext, () => this._wrapper.session.send({ prompt, attachments: sdkAttachments?.length ? sdkAttachments : void 0 }));
    this._logService.info(`[Copilot:${this.sessionId}] session.send() returned`);
  }
  async _toSdkAttachments(attachments) {
    const sdkAttachments = attachments?.length ? (await Promise.all(attachments.map((attachment) => this._toSdkAttachment(attachment)))).filter(isDefined) : void 0;
    if (sdkAttachments?.length) {
      this._logService.trace(`[Copilot:${this.sessionId}] Attachments: ${JSON.stringify(sdkAttachments.map((attachment) => ({ type: attachment.type })))}`);
    }
    return sdkAttachments;
  }
  async hasRuntimeSlashCommand(command) {
    try {
      return !!await this._slashCommandProvider.resolveSlashCommand(command);
    } catch (err) {
      this._logService.warn(`[Copilot:${this.sessionId}] rpc.commands.list failed`, err);
      return false;
    }
  }
  async getRuntimeSlashCommands(options) {
    try {
      return await this._slashCommandProvider.getSlashCommands(options);
    } catch (err) {
      this._logService.warn(`[Copilot:${this.sessionId}] rpc.commands.list failed`, err);
      return [];
    }
  }
  /**
   * Translate a protocol {@link MessageAttachment} into the Copilot CLI SDK's `attachments` payload shape. Resource
   * attachments map to the SDK's reference-style `file`/`directory`/`selection` variants (the
   * {@link MessageAttachmentBase.displayKind} advisory hint controls which one). Embedded resources (e.g. inline
   * image bytes, or unsaved editor content) map to the SDK's `blob` variant, and simple attachments with a model
   * representation map to `text/plain` blob attachments.
   *
   * Any Resource attachment carrying a {@link TextSelection} (e.g. `displayKind === 'selection'` or `'symbol'`) is
   * mapped to the SDK's `selection` variant so the range survives the round-trip — keying off the `selection` field
   * rather than just `displayKind` avoids symbol attachments degrading to a plain file reference (#315193). For those
   * we read the resource content from disk and slice it by the carried range (the protocol's {@link TextSelection}
   * only carries the range, not the inline text); on read failure the selection downgrades to a plain file reference.
   * A textual embedded resource already carries the exact inline text to send (the whole live buffer for a document,
   * or just the selected text for a selection), so it is forwarded as-is without further slicing.
   */
  async _toSdkAttachment(attachment) {
    if (isAgentFeedbackAnnotationsAttachment(attachment)) {
      const rendered = renderAgentFeedbackAnnotationsAttachment(attachment);
      if (!rendered) {
        return void 0;
      }
      return {
        type: "blob",
        data: encodeBase64(VSBuffer.fromString(rendered)),
        mimeType: "text/plain",
        displayName: attachment.label
      };
    }
    if (attachment.type === MessageAttachmentKind.Simple) {
      if (attachment.modelRepresentation) {
        return {
          type: "blob",
          data: encodeBase64(VSBuffer.fromString(attachment.modelRepresentation)),
          mimeType: addSimpleAttachmentDisplayKindToMimeType(attachment),
          displayName: attachment.label
        };
      }
      return void 0;
    }
    if (attachment.type === MessageAttachmentKind.EmbeddedResource) {
      return { type: "blob", data: attachment.data, mimeType: attachment.contentType, displayName: attachment.label };
    }
    if (attachment.type !== MessageAttachmentKind.Resource) {
      return void 0;
    }
    const uri = URI.parse(attachment.uri);
    const path = uri.scheme === "file" ? uri.fsPath : uri.toString();
    const displayName = attachment.label ?? path;
    if (attachment.selection) {
      try {
        const text = await this._readSelectedText(uri, attachment.selection.range);
        return { type: "selection", filePath: path, displayName, text, selection: attachment.selection.range };
      } catch (err) {
        this._logService.warn(`[Copilot:${this.sessionId}] Failed to read selected text for ${uri.toString()}: ${err}`);
        return { type: "file", path, displayName };
      }
    }
    if (attachment.displayKind === "selection") {
      return { type: "file", path, displayName };
    }
    const type = attachment.displayKind === "directory" ? "directory" : "file";
    return { type, path, displayName };
  }
  async _readSelectedText(uri, range) {
    const content = await this._fileService.readFile(uri);
    const text = content.value.toString();
    const lines = splitLinesIncludeSeparators(text);
    const start = this._getOffsetAt(lines, range.start);
    const end = this._getOffsetAt(lines, range.end);
    return text.substring(start, Math.max(start, end));
  }
  _getOffsetAt(lines, position) {
    const line = Math.max(0, Math.min(position.line, lines.length - 1));
    let offset = 0;
    for (let i = 0; i < line; i++) {
      offset += lines[i].length;
    }
    const lineText = lines[line].replace(/\r\n|\r|\n$/, "");
    return offset + Math.max(0, Math.min(position.character, lineText.length));
  }
  /**
   * Pushes `mode` to the SDK via `rpc.mode.set` if it differs from the
   * last applied value. Failures are logged and swallowed so that mode
   * propagation does not block the turn.
   */
  async applyMode(mode) {
    if (!mode || mode === this._lastAppliedMode) {
      return;
    }
    try {
      await this._wrapper.session.rpc.mode.set({ mode });
      this._lastAppliedMode = mode;
      this._logService.info(`[Copilot:${this.sessionId}] rpc.mode.set succeeded: mode=${mode}`);
    } catch (err) {
      this._logService.error(err, `[Copilot:${this.sessionId}] rpc.mode.set failed: mode=${mode}`);
    }
  }
  /**
   * `true` when the session's effective `mode` is `autopilot` — the
   * autonomous, continue-until-done mode in which no user is available to
   * answer questions or fill in elicitation forms.
   */
  _isAutopilotMode() {
    return this._configurationService.getEffectiveValue(this._storageUri.toString(), platformSessionSchema, SessionConfigKey.Mode) === "autopilot";
  }
  /**
   * Whether VS Code's auto-reply setting is enabled in the root config.
   */
  _isAutoReplyEnabled() {
    return this._configurationService.getRootValue(platformRootSchema, AgentHostAutoReplyEnabledConfigKey) === true;
  }
  async sendSteering(steeringMessage) {
    if (this._steeringMessagesInFlight.has(steeringMessage.id) || this._pendingSteeringFlips.has(steeringMessage.id)) {
      return;
    }
    this._steeringMessagesInFlight.add(steeringMessage.id);
    this._logService.info(`[Copilot:${this.sessionId}] Sending steering message: "${steeringMessage.message.text.substring(0, 100)}"`);
    try {
      await this._reconcileMcpServerEnablement();
      this._pendingSteeringFlips.set(steeringMessage.id, steeringMessage);
      const sdkAttachments = await this._toSdkAttachments(steeringMessage.message.attachments);
      await this._wrapper.session.send({
        prompt: steeringMessage.message.text,
        attachments: sdkAttachments?.length ? sdkAttachments : void 0,
        mode: "immediate"
      });
    } catch (err) {
      this._pendingSteeringFlips.delete(steeringMessage.id);
      this._logService.error(`[Copilot:${this.sessionId}] Steering message failed`, err);
    } finally {
      this._steeringMessagesInFlight.delete(steeringMessage.id);
    }
  }
  async getMessages() {
    const result = await this._getMappedEvents();
    return result.turns;
  }
  async getSubagentMessages(parentToolCallId) {
    const result = await this._getMappedEvents();
    const turns = result.subagentTurnsByToolCallId.get(parentToolCallId) ?? [];
    return turns;
  }
  /**
   * Returns the subagent child sessions discoverable in this session's event
   * log, derived from the same {@link mapSessionEvents} reconstruction used
   * for {@link getMessages}/{@link getSubagentMessages}. Lets a parent
   * restore register every child up-front instead of each child re-fetching
   * and re-reconstructing the full parent event log.
   */
  async getSubagentSessions() {
    const result = await this._getMappedEvents();
    if (result.subagentTurnsByToolCallId.size === 0) {
      return [];
    }
    const parentSessionStr = this._storageUri.toString();
    const out = [];
    for (const turn of result.turns) {
      for (const rp of turn.responseParts) {
        if (rp.kind !== ResponsePartKind.ToolCall) {
          continue;
        }
        const tc = rp.toolCall;
        const childTurns = result.subagentTurnsByToolCallId.get(tc.toolCallId);
        if (!childTurns || childTurns.length === 0) {
          continue;
        }
        const content = tc.content;
        const subagentContent = content ? getToolSubagentContent({ content }) : void 0;
        const taskDescription = readToolCallMeta(tc).subagentDescription;
        out.push({
          resource: URI.parse(buildSubagentSessionUri(parentSessionStr, tc.toolCallId)),
          toolCallId: tc.toolCallId,
          title: subagentChatTitle(taskDescription, subagentContent?.title),
          turns: childTurns
        });
      }
    }
    return out;
  }
  _getMappedEvents() {
    if (!this._mappedEventsMemo) {
      const pending = this._computeMappedEvents();
      this._mappedEventsMemo = pending;
      pending.catch(() => {
        if (this._mappedEventsMemo === pending) {
          this._mappedEventsMemo = void 0;
        }
      });
    }
    return this._mappedEventsMemo;
  }
  async _computeMappedEvents() {
    const events = await this._wrapper.session.getEvents();
    let db;
    try {
      db = this._databaseRef.object;
    } catch {
    }
    const result = await mapSessionEvents(this._storageUri, db, events, {
      workingDirectory: this._workingDirectory,
      model: this._launchPlan.kind === "create" ? this._launchPlan.model : this._launchPlan.fallback.model
    });
    return result;
  }
  /** Drop the memoized event reconstruction; the next read rebuilds it. */
  _invalidateMappedEvents() {
    this._mappedEventsMemo = void 0;
  }
  async abort() {
    this._logService.info(`[Copilot:${this.sessionId}] Aborting session...`);
    this._beginAbort();
    this._drainPendingSteeringFlips();
    try {
      await this._wrapper.session.abort();
    } catch (error) {
      this._resetAbortToken();
      throw error;
    }
  }
  /**
   * Aborts before tearing down so that in-flight {@link _guarded} callbacks
   * settle rather than hang: disposing the {@link _abortCts} would drop each
   * racing `onCancellationRequested` listener without ever firing it, leaving
   * a callback that parks its deferred after the teardown sweep with nothing
   * left to resolve it. The sweep registered in the constructor stays as the
   * backstop, since {@link _beginAbort} no-ops when already aborted.
   */
  dispose() {
    void this._editTracker.flushAttribution().catch((error) => {
      this._logService.warn(`[Copilot:${this.sessionId}] Failed to flush edit attribution: ${error}`);
    });
    this._beginAbort();
    super.dispose();
  }
  /**
   * Explicitly destroys the underlying SDK session and waits for cleanup
   * to complete. Call this before {@link dispose} when you need to ensure
   * the session's on-disk data is no longer locked (e.g. before
   * truncation or fork operations that modify the session files).
   */
  async destroySession() {
    try {
      await this._editTracker.flushAttribution();
    } catch (error) {
      this._logService.warn(`[Copilot:${this.sessionId}] Failed to flush edit attribution: ${error}`);
    }
    await this._wrapper.disconnect();
  }
  async setModel(model, reasoningEffort, contextTier) {
    this._logService.info(`[Copilot:${this.sessionId}] Changing model to: ${model}`);
    this._lastSeenModelId = model;
    await this._wrapper.session.setModel(model, { reasoningEffort, contextTier });
  }
  /**
   * Dispatches an MCP JSON-RPC method received on the `mcp://` side
   * channel to the Copilot SDK's `session.rpc.mcp.*` surface.
   *
   * Mapping:
   *  - `tools/list` → `rpc.mcp.apps.listTools`
   *  - `tools/call` → `rpc.mcp.apps.callTool`
   *  - `resources/read` → `rpc.mcp.apps.readResource`
   *  - `resources/list` → `rpc.mcp.apps.listResources` (empty list fallback)
   *  - `resources/templates/list` → `rpc.mcp.apps.listResourceTemplates` (empty list fallback)
   *  - `sampling/createMessage` → `rpc.mcp.executeSampling`
   *
   * Other MCP methods are rejected with `Method not found` (the caller
   * translates that into a JSON-RPC `-32601`).
   */
  async handleMcpRequest(serverName, method, params) {
    const apps = this._wrapper.session.rpc.mcp.apps;
    switch (method) {
      case "tools/list":
        return apps.listTools({ serverName, originServerName: serverName });
      case "tools/call": {
        const name = params && typeof params["name"] === "string" ? params["name"] : void 0;
        if (!name) {
          throw new Error(`tools/call missing 'name' parameter`);
        }
        const rawArgs = params ? params["arguments"] : void 0;
        const args = isObject(rawArgs) ? rawArgs : void 0;
        return apps.callTool({ serverName, toolName: name, arguments: args, originServerName: serverName });
      }
      case "resources/read": {
        const uri = params && typeof params["uri"] === "string" ? params["uri"] : void 0;
        if (!uri) {
          throw new Error(`resources/read missing 'uri' parameter`);
        }
        return apps.readResource({ serverName, uri });
      }
      case "resources/list": {
        return { resources: [] };
      }
      case "resources/templates/list": {
        return { resourceTemplates: [] };
      }
      case "sampling/createMessage":
        return this._handleSamplingCreateMessage(serverName, params);
      default:
        throw new Error(`Method not found: ${method}`);
    }
  }
  async startMcpServer(id) {
    const serverName = this._mcpCustomizations.serverNameForCustomizationId(id);
    if (!serverName) {
      this._logService.warn(`[Copilot:${this.sessionId}] Cannot start unknown MCP server customization ${id}`);
      return;
    }
    return this._mcpServerLifecycleSequencer.queue(serverName, async () => {
      try {
        await this._wrapper.session.rpc.mcp.startServer({ serverName });
      } finally {
        this._seedMcpServersFromRpc();
      }
    });
  }
  async _reconcileMcpServerEnablement() {
    const desiredCustomizations = this._stateManager.getSessionState(this.sessionUri.toString())?.customizations ?? [];
    const desiredServers = getEffectiveMcpServerCustomizations(desiredCustomizations);
    if (desiredServers.length === 0) {
      return;
    }
    await this._refreshMcpServersFromRpc();
    let changed = false;
    for (const server of this._mcpCustomizations.serverEnablement()) {
      const desired = desiredServers.find((customization) => customization.id === server.customizationId)?.enabled;
      if (desired === void 0 || desired === server.enabled) {
        continue;
      }
      try {
        if (desired) {
          changed = true;
          await this._wrapper.session.rpc.mcp.enable({ serverName: server.serverName });
        } else {
          await this._disableMcpServer(server.serverName);
          changed = true;
        }
      } catch (e) {
        this._logService.error(e, `[Copilot:${this.sessionId}] Failed to ${desired ? "enable" : "disable"} MCP server ${server.serverName}`);
      }
    }
    if (changed) {
      await this._refreshMcpServersFromRpc();
    }
  }
  async _disableMcpServer(serverName) {
    this._cancelPendingMcpAuthRequestsForServer(serverName);
    await this._wrapper.session.rpc.mcp.disable({ serverName });
  }
  async stopMcpServer(id) {
    const serverName = this._mcpCustomizations.serverNameForCustomizationId(id);
    if (!serverName) {
      this._logService.warn(`[Copilot:${this.sessionId}] Cannot stop unknown MCP server customization ${id}`);
      return;
    }
    return this._mcpServerLifecycleSequencer.queue(serverName, async () => {
      await this._wrapper.session.rpc.mcp.stopServer({ serverName });
      this._mcpCustomizations.applyOne({ name: serverName, state: { kind: McpServerStatus.Stopped } });
    });
  }
  /**
   * Forwards an App→host `sampling/createMessage` request received
   * over the AHP `mcp://` channel to `rpc.mcp.executeSampling`. The
   * Copilot runtime owns the MCP→chat-completion conversion and the
   * sampling response shape, so we pass the raw MCP params through
   * untouched and return the SDK's result directly.
   *
   * Resolves the JSON-RPC request with the `CreateMessageResult` on
   * success and rejects on failure/cancellation, mirroring the
   * `sampling/createMessage` MCP contract.
   */
  async _handleSamplingCreateMessage(serverName, params) {
    if (!params) {
      throw new Error(`sampling/createMessage missing params`);
    }
    const requestId = generateUuid();
    const mcpRequestId = generateUuid();
    this._pendingMcpSamplings.add(requestId);
    try {
      const result = await this._wrapper.session.rpc.mcp.executeSampling({
        requestId,
        serverName,
        mcpRequestId,
        request: params
      });
      if (result.action === "success") {
        return result.result ?? null;
      }
      throw new Error(`sampling/createMessage ${result.action}${result.error ? `: ${result.error}` : ""}`);
    } finally {
      this._pendingMcpSamplings.delete(requestId);
    }
  }
  /**
   * Selects (or clears) a custom agent on the live SDK session.
   * Mirrors the SDK's `rpc.agent.select` / `rpc.agent.deselect` pair.
   */
  async setAgent(agentName) {
    if (agentName) {
      const name = agentName;
      this._logService.info(`[Copilot:${this.sessionId}] Selecting custom agent: ${name}`);
      try {
        await this._wrapper.session.rpc.agent.select({ name });
      } catch (err) {
        this._logService.error(err, `[Copilot:${this.sessionId}] rpc.agent.select failed: name=${name}`);
        throw err;
      }
    } else {
      this._logService.info(`[Copilot:${this.sessionId}] Clearing custom agent selection`);
      try {
        await this._wrapper.session.rpc.agent.deselect();
      } catch (err) {
        this._logService.error(err, `[Copilot:${this.sessionId}] rpc.agent.deselect failed`);
        throw err;
      }
    }
  }
  // ---- permission handling ------------------------------------------------
  /**
   * Handles a permission request from the SDK by firing a `tool_ready` event
   * (which transitions the tool to PendingConfirmation) and waiting for the
   * side-effects layer to respond via {@link respondToPermissionRequest}.
   */
  async _handlePermissionRequest(request) {
    try {
      const toolCallId = request.toolCallId;
      if (!toolCallId) {
        this._logService.warn(`[Copilot:${this.sessionId}] Permission request without toolCallId, auto-denying: kind=${request.kind}`);
        return { kind: "reject" };
      }
      if (this._unroutableSubagentToolCallIds.delete(toolCallId)) {
        this._logService.error(`[Copilot:${this.sessionId}] Rejecting permission request for unroutable subagent tool call: toolCallId=${toolCallId}, kind=${request.kind}`);
        return { kind: "reject" };
      }
      const managedApprovalRequired = request.managedApprovalRequired === true;
      const requestSandboxBypass = request.kind === "shell" || request.kind === "write" || request.kind === "read" || request.kind === "url" ? request.requestSandboxBypass : void 0;
      const autoApproval = !managedApprovalRequired && this._lastAppliedPermissionMode === "auto" ? await this._takeAutoApproval(toolCallId) : void 0;
      const recommendation = autoApproval?.recommendation;
      if (recommendation === "approve" && !requestSandboxBypass) {
        if (request.kind === "custom-tool" && typeof request.toolName === "string" && this._clientToolNames.has(this._clientToolName(request.toolName))) {
          const trackedToolCall2 = this._activeToolCalls.get(toolCallId);
          const displayName = trackedToolCall2?.displayName ?? getToolDisplayName(request.toolName);
          const parameters = trackedToolCall2?.parameters;
          const parentToolCallId2 = trackedToolCall2?.parentToolCallId;
          this._onDidSessionProgress.fire({
            kind: "pending_confirmation",
            chat: this._chatChannelUri,
            state: {
              status: ToolCallStatus.PendingConfirmation,
              toolCallId,
              toolName: request.toolName,
              displayName,
              invocationMessage: getInvocationMessage(request.toolName, displayName, parameters, (path) => this._resolveEditFilePath(path)),
              toolInput: getToolInputString(request.toolName, parameters, tryStringify(parameters)),
              riskAssessment: autoApproval?.reason ? {
                kind: ToolCallRiskAssessmentKind.Judge,
                status: ToolCallRiskAssessmentStatus.Complete,
                reason: autoApproval.reason,
                safety: 1
              } : void 0
            },
            parentToolCallId: parentToolCallId2
          });
        }
        return { kind: "approve-once" };
      }
      const approvedSignature = this._approvedDuplicablePermissionSignatures.get(toolCallId);
      if (approvedSignature !== void 0) {
        this._approvedDuplicablePermissionSignatures.delete(toolCallId);
        if (!managedApprovalRequired && (request.kind === "write" || request.kind === "read") && safeStringify(request) === approvedSignature) {
          this._logService.info(`[Copilot:${this.sessionId}] Auto-approving duplicate ${request.kind} permission request for tool call ${toolCallId}`);
          return { kind: "approve-once" };
        }
      }
      const sessionResourcePath = this._getInternalSessionResourcePath(request);
      if (!managedApprovalRequired && sessionResourcePath) {
        this._logService.info(`[Copilot:${this.sessionId}] Auto-approving internal session resource ${sessionResourcePath}`);
        return { kind: "approve-once" };
      }
      if (!managedApprovalRequired && request.kind === "read" && typeof request.path === "string" && this._isSessionAttachmentPath(request.path)) {
        this._logService.info(`[Copilot:${this.sessionId}] Auto-approving session attachment ${request.path}`);
        return { kind: "approve-once" };
      }
      if (!managedApprovalRequired && request.kind === "read" && typeof request.path === "string") {
        if (isCopilotSdkToolOutputTempFile(request.path, this._environmentService.tmpDir.fsPath)) {
          this._logService.info(`[Copilot:${this.sessionId}] Auto-approving Copilot SDK tool-output temp file ${request.path}`);
          return { kind: "approve-once" };
        }
      }
      const serverToolHost = this._serverToolHost;
      const serverToolName = request.kind === "custom-tool" && typeof request.toolName === "string" && serverToolHost?.toolNames.includes(request.toolName) ? request.toolName : void 0;
      if (serverToolHost && serverToolName) {
        const canRequireConfirmation = serverToolHost.canRequireConfirmation(serverToolName);
        if (canRequireConfirmation && !serverToolHost.requiresConfirmation(this._chatChannelUri.toString(), serverToolName)) {
          this._logService.info(`[Copilot:${this.sessionId}] Auto-approving server tool ${serverToolName} because it has nothing to confirm`);
          return { kind: "approve-once" };
        }
        if (!canRequireConfirmation && !managedApprovalRequired) {
          this._logService.info(`[Copilot:${this.sessionId}] Auto-approving server tool ${serverToolName}`);
          return { kind: "approve-once" };
        }
      }
      const customShellToolName = request.kind === "custom-tool" && typeof request.toolName === "string" && isShellTool(request.toolName) ? request.toolName : void 0;
      const isShellRequest = request.kind === "shell" || customShellToolName !== void 0;
      const trackedToolName = this._activeToolCalls.get(toolCallId)?.toolName;
      const shellToolName = request.kind === "shell" ? trackedToolName : customShellToolName;
      const shellLanguage = isShellRequest && (shellToolName === "bash" || shellToolName === "powershell") ? shellToolName : void 0;
      if (isShellRequest && shellLanguage === void 0) {
        this._logService.warn(`[Copilot:${this.sessionId}] Shell permission request has no recognized shell tool name; requiring confirmation: toolCallId=${toolCallId}, toolName=${shellToolName ?? "(missing)"}`);
      }
      if (!managedApprovalRequired && request.kind === "custom-tool" && typeof request.toolName === "string" && this._clientToolNames.has(this._clientToolName(request.toolName)) && this._pendingClientToolCalls.hasBufferedResult(toolCallId)) {
        this._logService.info(`[Copilot:${this.sessionId}] Auto-approving client tool ${request.toolName} because its result arrived before the permission request`);
        return { kind: "approve-once" };
      }
      this._logService.info(`[Copilot:${this.sessionId}] Requesting confirmation for tool call: ${toolCallId}`);
      const pendingPermission = this._pendingPermissions.register(toolCallId, { managedApprovalRequired });
      if (!managedApprovalRequired && isShellRequest && !requestSandboxBypass && await this._isShellSandboxedByDefault()) {
        if (this._pendingPermissions.has(toolCallId)) {
          this._pendingPermissions.respond(toolCallId, { kind: "approve-once" });
          this._logService.info(`[Copilot:${this.sessionId}] Auto-approving sandboxed shell command for tool call ${toolCallId}`);
          return { kind: "approve-once" };
        }
        return { kind: "reject" };
      }
      const edits = await this._buildEditsForPermission(request, toolCallId);
      if (!this._pendingPermissions.has(toolCallId)) {
        return { kind: "reject" };
      }
      const isNewFile = edits?.items.some((edit) => !edit.before && !!edit.after);
      const { confirmationTitle, invocationMessage, toolInput, permissionKind, permissionPath } = getPermissionDisplay(request, this._workingDirectory, isNewFile);
      const toolName = request.kind === "mcp" || request.kind === "custom-tool" || request.kind === "hook" ? request.toolName ?? request.kind : request.kind;
      const trackedToolCall = this._activeToolCalls.get(toolCallId);
      const parentToolCallId = trackedToolCall?.parentToolCallId;
      this._onDidSessionProgress.fire({
        kind: "pending_confirmation",
        chat: this._chatChannelUri,
        state: {
          status: ToolCallStatus.PendingConfirmation,
          toolCallId,
          toolName,
          displayName: getToolDisplayName(toolName),
          contributor: trackedToolCall?.contributor,
          intention: trackedToolCall?.intention,
          invocationMessage,
          toolInput,
          confirmationTitle,
          riskAssessment: autoApproval?.reason ? {
            kind: ToolCallRiskAssessmentKind.Judge,
            status: ToolCallRiskAssessmentStatus.Complete,
            reason: autoApproval.reason,
            safety: recommendation === "approve" ? 1 : 0
          } : void 0,
          edits
        },
        permissionKind,
        permissionPath,
        managedApprovalRequired,
        requestSandboxBypass,
        shellLanguage,
        parentToolCallId
      });
      const result = await pendingPermission;
      this._logService.info(`[Copilot:${this.sessionId}] Permission response: toolCallId=${toolCallId}, result=${result.kind}`);
      if (!managedApprovalRequired && result.kind === "approve-once" && (request.kind === "write" || request.kind === "read")) {
        this._approvedDuplicablePermissionSignatures.set(toolCallId, safeStringify(request));
      }
      return result;
    } catch (error) {
      this._logService.error(error, `[Copilot:${this.sessionId}] Failed to handle permission request: kind=${request.kind}, toolCallId=${request.toolCallId ?? "missing"}`);
      throw error;
    }
  }
  _getInternalSessionResourcePath(request) {
    let permissionPath;
    if (request.kind === "read") {
      permissionPath = typeof request.path === "string" ? request.path : void 0;
    } else if (request.kind === "write") {
      permissionPath = typeof request.fileName === "string" ? request.fileName : void 0;
    }
    if (!permissionPath) {
      return void 0;
    }
    const sessionStateDir = normalizePath(URI.file(getCopilotCLISessionStateDir(this._environmentService.userHome.fsPath)));
    const sessionDir = normalizePath(URI.joinPath(sessionStateDir, this.sessionId));
    if (!extUriBiasedIgnorePathCase.isEqualOrParent(sessionDir, sessionStateDir)) {
      return void 0;
    }
    const permissionUri = normalizePath(URI.file(permissionPath));
    return extUriBiasedIgnorePathCase.isEqualOrParent(permissionUri, sessionDir) ? permissionPath : void 0;
  }
  /**
   * Returns true when `permissionPath` lives under this session's
   * `<sessionDataDir>/attachments` directory — i.e. the bytes were
   * written by the agent host's user-message attachment rewriter and so
   * are already user-supplied content that does not need to be
   * re-confirmed via a permission prompt.
   */
  _isSessionAttachmentPath(permissionPath) {
    const attachmentsDir = normalizePath(URI.joinPath(this._sessionDataDir, SESSION_ATTACHMENTS_DIRNAME));
    const permissionUri = normalizePath(URI.file(permissionPath));
    return extUriBiasedIgnorePathCase.isEqualOrParent(permissionUri, attachmentsDir);
  }
  /**
   * Returns true when shell commands run inside a sandbox by default — either
   * through the AgentHost's own {@link TerminalSandboxEngine} (when the custom
   * terminal tool is enabled) or through the SDK's built-in shell tool wrapped
   * by the `sandboxConfig` we pushed via `session.options.update`.
   *
   * Callers use this to auto-approve shell permission prompts that the sandbox
   * already contains. Commands that explicitly opt out of the sandbox
   * (`requestSandboxBypass`) are excluded by the caller, since the
   * sandbox no longer contains them.
   *
   * Returns false when neither sandbox path is configured, so the standard
   * confirmation flow is preserved.
   */
  async _isShellSandboxedByDefault() {
    if (this._isCustomTerminalToolEnabled()) {
      if (!this._shellManager) {
        return false;
      }
      return this._shellManager.getOrCreateSandboxEngine().isEnabled();
    }
    return this._computeSdkSandboxConfig() !== void 0;
  }
  /**
   * `true` when the AgentHost's own shell tools (wrapped by
   * {@link TerminalSandboxEngine}) replace the SDK's built-in shell. In that
   * mode the SDK sandbox config is unused, so we neither forward nor toggle it.
   */
  _isCustomTerminalToolEnabled() {
    return this._configurationService.getRootValue(copilotCliConfigSchema, CopilotCliConfigKey.EnableCustomTerminalTool) === true;
  }
  /**
   * The SDK-shaped sandbox policy for this session, mirroring
   * {@link CopilotSessionLauncher}'s computation: `undefined` when the custom
   * terminal tool is enabled (the host's own terminal sandbox engine handles
   * containment) or when the host sandbox config evaluates to disabled
   * (including on Windows, where the sandbox is not supported).
   */
  _computeSdkSandboxConfig() {
    if (this._isCustomTerminalToolEnabled()) {
      return void 0;
    }
    const sandbox = this._configurationService.getRootValue(sandboxConfigSchema, AgentHostSandboxConfigKey.Sandbox);
    return buildSandboxConfigForSdk(this._platform, sandbox);
  }
  /**
   * `true` when the session runs with bypass approvals — either the global
   * auto-approve setting or the session's `autoApprove` ("Allow All")
   * level. Agent mode is an orthogonal axis and does not affect approvals.
   */
  _isBypassApprovals() {
    if (this._configurationService.getRootValue(platformRootSchema, AgentHostGlobalAutoApproveEnabledConfigKey) === true) {
      return true;
    }
    return this._configurationService.getEffectiveValue(this._storageUri.toString(), platformSessionSchema, SessionConfigKey.AutoApprove) === "autoApprove";
  }
  _getSdkPermissionMode() {
    if (this._isBypassApprovals()) {
      return "on";
    }
    return this._getConfiguredApprovalLevel() === "assisted" ? "auto" : "off";
  }
  _getConfiguredApprovalLevel() {
    return this._configurationService.getEffectiveValue(this._storageUri.toString(), platformSessionSchema, SessionConfigKey.AutoApprove) ?? "default";
  }
  _getConfiguredAgentMode() {
    return this._configurationService.getEffectiveValue(this._storageUri.toString(), platformSessionSchema, SessionConfigKey.Mode) ?? "interactive";
  }
  _subscribeToPermissionConfigChanges() {
    this._register(this._configurationService.onDidRootConfigChange(() => {
      void this._syncPermissionModeAfterConfigChange();
    }));
    this._register(this._configurationService.onDidSessionConfigChange((event) => {
      if (event.session === this._storageUri.toString() && Object.hasOwn(event.config, SessionConfigKey.AutoApprove)) {
        void this._syncPermissionModeAfterConfigChange();
      }
    }));
  }
  async _syncPermissionModeAfterConfigChange() {
    try {
      await this.syncPermissionMode("config-change");
      await this._applyEffectiveSandboxConfig(true);
    } catch (error) {
      this._logService.error(error, `[Copilot:${this.sessionId}] Failed to apply permission config change; aborting active turn`);
      try {
        await this.abort();
      } catch (abortError) {
        this._logService.error(abortError, `[Copilot:${this.sessionId}] Failed to abort after permission config sync failure`);
      }
    }
  }
  async _takeAutoApproval(toolCallId) {
    if (this._autoApprovals.has(toolCallId)) {
      const autoApproval = this._autoApprovals.get(toolCallId) ?? void 0;
      this._autoApprovals.delete(toolCallId);
      return autoApproval;
    }
    return this._pendingAutoApprovals.register(toolCallId);
  }
  _recordAutoApproval(toolCallId, autoApproval) {
    if (this._pendingAutoApprovals.respond(toolCallId, autoApproval)) {
      return;
    }
    this._autoApprovals.set(toolCallId, autoApproval ?? null);
  }
  syncPermissionMode(source) {
    return this._permissionModeSequencer.queue(async () => {
      const mode = this._getSdkPermissionMode();
      const configuredLevel = this._getConfiguredApprovalLevel();
      this._logService.info(`[Copilot:${this.sessionId}] Syncing permission mode: source=${source}, agentMode=${this._getConfiguredAgentMode()}, configuredLevel=${configuredLevel}, sdkMode=${mode}, previousSdkMode=${this._lastAppliedPermissionMode ?? "unknown"}, globalAutoApprove=${this._configurationService.getRootValue(platformRootSchema, AgentHostGlobalAutoApproveEnabledConfigKey) === true}`);
      const experimentalModeEnabled = mode === "auto";
      if (this._autoApprovalExperimentalModeEnabled !== experimentalModeEnabled) {
        const experimentalResult = await this._wrapper.session.rpc.options.update({ isExperimentalMode: experimentalModeEnabled });
        if (!experimentalResult.success) {
          throw new Error(`Copilot SDK rejected experimental mode update required by permission mode '${mode}'`);
        }
        this._autoApprovalExperimentalModeEnabled = experimentalModeEnabled;
        this._logService.info(`[Copilot:${this.sessionId}] ${experimentalModeEnabled ? "Enabled" : "Disabled"} SDK experimental mode for permission mode '${mode}'`);
      }
      if (this._lastAppliedPermissionMode === mode) {
        return;
      }
      const result = await this._wrapper.session.rpc.permissions.setAllowAll({ mode });
      if (!result.success || result.mode !== void 0 && result.mode !== mode) {
        throw new Error(`Copilot SDK rejected permission mode '${mode}'`);
      }
      this._lastAppliedPermissionMode = mode;
    });
  }
  /**
   * Apply the SDK sandbox policy for the request that is about to be sent.
   *
   * Skips the SDK sandbox entirely when the custom terminal tool is enabled
   * (the host's own terminal sandbox engine handles containment and the SDK's
   * built-in shell is unused). Otherwise it always pushes the effective state
   * so the SDK never retains a stale or auto-discovered sandbox: the
   * configured policy unless the request runs with bypass approvals, or an
   * explicitly disabled sandbox when no sandbox is configured (setting off,
   * or Windows).
   */
  async _applyEffectiveSandboxConfig(failOnError = false) {
    if (this._isCustomTerminalToolEnabled()) {
      return;
    }
    const sandbox = this._configurationService.getRootValue(sandboxConfigSchema, AgentHostSandboxConfigKey.Sandbox);
    const base = buildSandboxConfigForSdk(this._platform, sandbox);
    const sandboxConfig = base && !this._isBypassApprovals() ? base : { enabled: false };
    try {
      const result = await this._wrapper.session.rpc.options.update({ sandboxConfig });
      if (!result.success) {
        throw new Error("Copilot SDK rejected sandbox config update");
      }
    } catch (err) {
      if (failOnError) {
        throw err;
      }
      this._logService.warn(`[Copilot:${this.sessionId}] Failed to update sandbox config for request`, err);
    }
  }
  /**
   * Builds an {@link FileEdit} preview for a write permission request.
   *
   * The `before` side references the existing file on disk directly (if it
   * exists); the `after` side is written to the `pending-edit-content:`
   * in-memory filesystem so the client can fetch it via `resourceRead`.
   *
   * Returns `undefined` for permission kinds that don't describe file
   * edits or when the request is missing the fields needed to build a
   * preview. If the permission request is no longer pending by the time
   * the in-memory write completes (e.g. the session was aborted), the
   * just-written entry is deleted so it cannot leak.
   */
  async _buildEditsForPermission(request, toolCallId) {
    if (request.kind !== "write") {
      return void 0;
    }
    const filePath = typeof request.fileName === "string" ? request.fileName : void 0;
    const newFileContents = typeof request.newFileContents === "string" ? request.newFileContents : void 0;
    if (!filePath || newFileContents === void 0) {
      return void 0;
    }
    const fileUri = URI.file(filePath);
    const fileUriStr = fileUri.toString();
    let beforeExists = false;
    try {
      beforeExists = await this._fileService.exists(fileUri);
    } catch (err) {
      this._logService.warn(`[Copilot:${this.sessionId}] Failed to check file for edit preview: ${filePath}`, err);
    }
    const afterUri = buildPendingEditContentUri(this._storageUri.toString(), toolCallId, filePath);
    try {
      await this._fileService.writeFile(afterUri, VSBuffer.fromString(newFileContents));
    } catch (err) {
      this._logService.warn(`[Copilot:${this.sessionId}] Failed to write pending edit content for ${filePath}`, err);
      return void 0;
    }
    if (!this._pendingPermissions.has(toolCallId)) {
      this._fileService.del(afterUri).catch((err) => {
        this._logService.warn(`[Copilot:${this.sessionId}] Failed to delete orphaned pending edit content: ${afterUri.toString()}`, err);
      });
      return void 0;
    }
    this._pendingEditContentUris.set(toolCallId, afterUri);
    const diffCounts = typeof request.diff === "string" ? countUnifiedDiffLines(request.diff) : void 0;
    const edit = {
      ...beforeExists ? { before: { uri: fileUriStr, content: { uri: fileUriStr } } } : {},
      after: { uri: fileUriStr, content: { uri: afterUri.toString() } },
      ...diffCounts ? { diff: diffCounts } : {}
    };
    return { items: [edit] };
  }
  respondToPermissionRequest(requestId, approved) {
    if (this._pendingPermissions.respond(requestId, approved ? { kind: "approve-once" } : { kind: "denied-interactively-by-user" })) {
      this._deletePendingEditContent(requestId);
      return true;
    }
    return false;
  }
  async _requestUnsandboxedCommandConfirmation(request) {
    const pendingPermission = this._pendingPermissions.register(request.toolCallId, { managedApprovalRequired: false });
    const displayName = getToolDisplayName(request.toolName);
    const blockedDomains = request.blockedDomains?.length ? request.blockedDomains.join(", ") : void 0;
    const confirmationTitle = blockedDomains ? localize("agentHost.unsandboxedCommandConfirmation.title.blockedDomains", "Run Command Outside the Sandbox to Access {0}?", blockedDomains) : localize("agentHost.unsandboxedCommandConfirmation.title.generic", "Run Command Outside the Sandbox?");
    const invocationMessage = request.reason ? localize("agentHost.unsandboxedCommandConfirmation.reason", "Reason for leaving the sandbox: {0}", request.reason) : blockedDomains ? localize("agentHost.unsandboxedCommandConfirmation.blockedDomains", "This command needs to access blocked network domain(s): {0}.", blockedDomains) : localize("agentHost.unsandboxedCommandConfirmation.generic", "This command needs to run outside the sandbox.");
    const parentToolCallId = this._activeToolCalls.get(request.toolCallId)?.parentToolCallId;
    this._onDidSessionProgress.fire({
      kind: "pending_confirmation",
      chat: this._chatChannelUri,
      state: {
        status: ToolCallStatus.PendingConfirmation,
        toolCallId: request.toolCallId,
        toolName: request.toolName,
        displayName,
        invocationMessage,
        toolInput: request.command,
        confirmationTitle
      },
      // Intentionally omit `permissionKind: 'shell'`: that would route this
      // through the shell rule-based auto-approver and silently approve
      // common safe commands (`pwd`, `ls`, etc.) without prompting.
      // Mirrors the workbench's sandbox-aware analyzer, which forces
      // `isAutoApproveAllowed: false` whenever `requiresUnsandboxConfirmation`
      // is set.
      parentToolCallId
    });
    return (await pendingPermission).kind === "approve-once";
  }
  // ---- user input handling ------------------------------------------------
  /**
   * Handles a user input request from the SDK (ask_user tool). Auto-answers when the user is unavailable; otherwise waits for the renderer to respond via {@link respondToUserInputRequest}.
   */
  async _handleUserInputRequest(request, _invocation) {
    const requestId = generateUuid();
    const questionId = generateUuid();
    const inputRequest = {
      id: requestId,
      questions: [
        request.choices && request.choices.length > 0 ? {
          kind: ChatInputQuestionKind.SingleSelect,
          id: questionId,
          message: request.question,
          required: true,
          options: request.choices.map((c) => ({ id: c, label: c })),
          allowFreeformInput: request.allowFreeform ?? true
        } : {
          kind: ChatInputQuestionKind.Text,
          id: questionId,
          message: request.question,
          required: true
        }
      ]
    };
    const isAutopilot = this._isAutopilotMode();
    if (isAutopilot || this._isAutoReplyEnabled()) {
      this._emitAction({
        type: ActionType.ChatInputRequested,
        request: inputRequest
      });
      this._emitAction({
        type: ActionType.ChatInputCompleted,
        requestId,
        response: ChatInputResponseKind.Accept,
        answers: {
          [questionId]: {
            state: ChatInputAnswerState.Submitted,
            value: {
              kind: ChatInputAnswerValueKind.Text,
              value: AgentHostAutoReplyAnswer
            }
          }
        }
      });
      return {
        answer: AgentHostAutoReplyAnswer,
        wasFreeform: true
      };
    }
    if (!this.hasActiveTurn) {
      this._logService.warn(`[Copilot:${this.sessionId}] Rejecting user input request without an active turn`);
      return { answer: "No active turn", wasFreeform: true };
    }
    const questionPreview = request.question.substring(0, 100);
    try {
      this._logService.info(`[Copilot:${this.sessionId}] User input request: requestId=${requestId}, question="${questionPreview}"`);
      const pendingInput = this._pendingUserInputs.register(requestId, { questionId });
      this._emitAction({
        type: ActionType.ChatInputRequested,
        request: { ...inputRequest, purpose: ChatInputRequestPurpose.AskUser }
      });
      const result = await pendingInput;
      this._logService.info(`[Copilot:${this.sessionId}] User input response: requestId=${requestId}, response=${result.response}`);
      if (result.response !== ChatInputResponseKind.Accept || !result.answers) {
        return { answer: "", wasFreeform: true };
      }
      const answer = result.answers[questionId];
      if (!answer || answer.state === ChatInputAnswerState.Skipped) {
        return { answer: "", wasFreeform: true };
      }
      const { value: val } = answer;
      if (val.kind === ChatInputAnswerValueKind.Text) {
        return { answer: val.value, wasFreeform: true };
      } else if (val.kind === ChatInputAnswerValueKind.Selected) {
        const wasFreeform = !request.choices?.includes(val.value);
        return { answer: val.value, wasFreeform };
      }
      return { answer: "", wasFreeform: true };
    } catch (error) {
      this._logService.error(error, `[Copilot:${this.sessionId}] Failed to handle user input request: question="${questionPreview}"`);
      throw error;
    }
  }
  /**
   * Handles an elicitation request from the SDK (MCP server / tool prompt)
   * by firing a `session/inputRequested` action and waiting for the
   * renderer to respond via {@link respondToUserInputRequest}.
   *
   * - `form` mode requests are projected from the SDK's
   *   {@link ElicitationSchema} into a list of
   *   {@link ChatInputQuestion}s.
   * - `url` mode requests surface as a question-less input request whose
   *   {@link ChatInputRequest.url} drives the renderer's "open URL"
   *   affordance.
   *
   * Under autopilot the request is auto-cancelled — there is no user
   * available to fill in a form, and accepting with empty content would
   * be misleading to the MCP server.
   */
  async _handleElicitationRequest(context) {
    const isAutopilot = this._isAutopilotMode();
    if (isAutopilot) {
      return { action: "cancel" };
    }
    if (!this.hasActiveTurn) {
      this._logService.warn(`[Copilot:${this.sessionId}] Rejecting elicitation request without an active turn`);
      return { action: "decline" };
    }
    const messagePreview = context.message.substring(0, 100);
    try {
      const requestId = generateUuid();
      this._logService.info(`[Copilot:${this.sessionId}] Elicitation request: requestId=${requestId}, mode=${context.mode ?? "form"}, source=${context.elicitationSource ?? "<unknown>"}, message="${messagePreview}"`);
      const schema = context.mode === "url" ? void 0 : context.requestedSchema;
      const requiredSet = new Set(schema?.required ?? []);
      const questions = schema ? Object.entries(schema.properties).map(([fieldName, field]) => elicitationFieldToQuestion(fieldName, field, requiredSet.has(fieldName))) : void 0;
      const pendingElicitation = this._pendingElicitations.register(requestId, { schema });
      const inputRequest = {
        id: requestId,
        purpose: ChatInputRequestPurpose.Elicitation,
        message: context.message,
        ...context.mode === "url" && context.url ? { url: context.url } : {},
        ...questions && questions.length > 0 ? { questions } : {}
      };
      this._emitAction({
        type: ActionType.ChatInputRequested,
        request: inputRequest
      });
      const result = await pendingElicitation;
      this._logService.info(`[Copilot:${this.sessionId}] Elicitation response: requestId=${requestId}, response=${result.response}`);
      if (result.response === ChatInputResponseKind.Decline) {
        return { action: "decline" };
      }
      if (result.response !== ChatInputResponseKind.Accept) {
        return { action: "cancel" };
      }
      const answers = result.answers ?? {};
      if (!schema) {
        const freeform = answers.answer;
        if (freeform && freeform.state !== ChatInputAnswerState.Skipped && freeform.value.kind === ChatInputAnswerValueKind.Text) {
          return { action: "accept", content: { answer: freeform.value.value } };
        }
        return { action: "accept" };
      }
      const content = {};
      for (const [fieldName, field] of Object.entries(schema.properties)) {
        const value = elicitationAnswerToFieldValue(field, answers[fieldName]);
        if (value !== void 0) {
          content[fieldName] = value;
        }
      }
      return { action: "accept", content };
    } catch (error) {
      this._logService.error(error, `[Copilot:${this.sessionId}] Failed to handle elicitation request: message="${messagePreview}"`);
      throw error;
    }
  }
  respondToUserInputRequest(requestId, response, answers) {
    const pendingPlanReview = this._pendingPlanReviews.getMetadata(requestId);
    if (pendingPlanReview) {
      return this._pendingPlanReviews.respond(requestId, this._resolveExitPlanMode(pendingPlanReview, response, answers));
    }
    if (this._pendingElicitations.respond(requestId, { response, answers })) {
      return true;
    }
    if (this._pendingUserInputs.respond(requestId, { response, answers })) {
      return true;
    }
    return false;
  }
  /**
   * Maps an `exit_plan_mode` input response back to an
   * {@link CopilotExitPlanModeResponse} that the CLI can feed into
   * `session.respondToExitPlanMode`. Mapping rules:
   *
   *  - Decline / Cancel / no answer → `{ approved: false }` (model gets a
   *    rejection result and stays in plan mode).
   *  - Accept + freeform feedback → `{ approved: false, feedback, selectedAction? }`
   *    (the SDK treats this as a revision request and re-emits
   *    `exit_plan_mode.requested` after revising the plan).
   *  - Accept + selected option → `{ approved: true, selectedAction, autoApproveEdits }`
   *    where `autoApproveEdits` is set for the autopilot variants.
   *
   * `selectedAction` is validated against the SDK's offered `actions`; an
   * unknown value is treated as a decline so the SDK isn't fed a value it
   * cannot handle.
   */
  _resolveExitPlanMode(pending, response, answers) {
    if (response !== ChatInputResponseKind.Accept) {
      return { approved: false };
    }
    const answer = answers?.[pending.questionId];
    if (!answer || answer.state === ChatInputAnswerState.Skipped) {
      return { approved: false };
    }
    const value = answer.value;
    let candidateAction;
    let feedback;
    if (value.kind === ChatInputAnswerValueKind.Selected) {
      candidateAction = value.value;
      const freeform = value.freeformValues?.find((s) => s.trim().length > 0)?.trim();
      feedback = freeform;
    } else if (value.kind === ChatInputAnswerValueKind.Text) {
      feedback = value.value.trim() || void 0;
    } else {
      return { approved: false };
    }
    const selectedAction = candidateAction && pending.actions.includes(candidateAction) ? candidateAction : pending.actions.includes(pending.recommendedAction) ? pending.recommendedAction : void 0;
    if (feedback) {
      return {
        approved: false,
        feedback,
        ...selectedAction ? { selectedAction } : {}
      };
    }
    if (!selectedAction) {
      return { approved: false };
    }
    this._syncAhpModeFromExitPlanAction(selectedAction);
    const isAutopilot = selectedAction === "autopilot" || selectedAction === "autopilot_fleet";
    return {
      approved: true,
      selectedAction,
      ...isAutopilot && this._isBypassApprovals() ? { autoApproveEdits: true } : {}
    };
  }
  /**
   * Translates an approved `exit_plan_mode` action into the AHP `mode` axis
   * and writes it so the mode picker reflects the choice immediately:
   *
   *  - `autopilot` / `autopilot_fleet` → `mode='autopilot'`.
   *  - `interactive` → `mode='interactive'`.
   *  - `exit_only` (approve plan without executing) leaves the mode untouched.
   */
  _syncAhpModeFromExitPlanAction(selectedAction) {
    switch (selectedAction) {
      case "autopilot":
      case "autopilot_fleet":
        this._syncAhpConfigFromSdkMode("autopilot");
        break;
      case "interactive":
        this._syncAhpConfigFromSdkMode("interactive");
        break;
    }
  }
  async _handlePreToolUse(input) {
    try {
      if (isEditTool(input.toolName, getToolCommand(input))) {
        const filePaths = this._getEditFilePaths(input.toolArgs);
        const mode = this._getConfiguredAgentMode();
        await Promise.all(filePaths.map((p) => this._editTracker.trackEditStart(p, mode)));
      }
    } catch (error) {
      this._logService.error(error, `[Copilot:${this.sessionId}] Failed in onPreToolUse: tool=${input.toolName}`);
      throw error;
    }
  }
  async _handlePostToolUse(input) {
    try {
      if (isEditTool(input.toolName, getToolCommand(input))) {
        const filePaths = this._getEditFilePaths(input.toolArgs);
        await Promise.all(filePaths.map((p) => this._editTracker.completeEdit(p)));
      }
    } catch (error) {
      this._logService.error(error, `[Copilot:${this.sessionId}] Failed in onPostToolUse: tool=${input.toolName}`);
      throw error;
    }
  }
  async _beginRepoInfoTelemetry(telemetryMessageId, clientType, isCurrent) {
    let resolved;
    try {
      resolved = await this._resolveRepoInfoTelemetryContext();
    } catch (error) {
      this._logService.warn(`[Copilot:${this.sessionId}] Failed to resolve repository info telemetry context: ${getErrorMessage(error)}`);
      return void 0;
    }
    if (!resolved || this._store.isDisposed || !isCurrent()) {
      return void 0;
    }
    await this._repoInfoTelemetry.reportBegin(resolved.context, this.sessionUri.toString(), telemetryMessageId, clientType, this._workingDirectory, resolved.baseBranch, isCurrent, (paths) => this._wrapper.session.rpc.contentExclusion.checkPaths({ paths: [...paths] }));
    return resolved;
  }
  async _endRepoInfoTelemetry(telemetryMessageId, resolved, isCurrent) {
    if (!resolved || this._store.isDisposed || !isCurrent()) {
      return;
    }
    await this._repoInfoTelemetry.reportEnd(resolved.context, this.sessionUri.toString(), telemetryMessageId, this._workingDirectory, resolved.baseBranch, isCurrent, (paths) => this._wrapper.session.rpc.contentExclusion.checkPaths({ paths: [...paths] }));
  }
  _completeActiveRepoInfoTelemetry() {
    const turn = this._activeRepoInfoTurn;
    if (!turn) {
      return;
    }
    this._activeRepoInfoTurn = void 0;
    const isCurrent = () => !turn.cancelled && this._isLaunchTokenCurrent();
    void turn.begin.then((resolved) => this._endRepoInfoTelemetry(turn.telemetryMessageId, resolved, isCurrent));
  }
  _cancelActiveRepoInfoTelemetry() {
    const turn = this._activeRepoInfoTurn;
    if (!turn) {
      return;
    }
    this._activeRepoInfoTurn = void 0;
    turn.cancelled = true;
    void turn.begin.finally(() => this._repoInfoTelemetry.clearTurn(turn.telemetryMessageId));
  }
  async _resolveRepoInfoTelemetryContext() {
    if (this._configurationService.getRootValue(platformRootSchema, AgentHostDisableRepoInfoTelemetryConfigKey) === true) {
      return void 0;
    }
    const githubToken = this._launchPlan.githubToken;
    if (!githubToken) {
      return void 0;
    }
    const [rawContext, baseBranch] = await Promise.all([
      this._copilotApiService.resolveRestrictedTelemetryContext(githubToken),
      this._databaseRef.object.getMetadata(META_DIFF_BASE_BRANCH)
    ]);
    if (!rawContext.restrictedTelemetryEnabled && !rawContext.isInternal) {
      return void 0;
    }
    return { context: this._toRepoInfoTelemetryContext(rawContext), baseBranch };
  }
  _isLaunchTokenCurrent() {
    return this._launchPlan.githubToken !== void 0 && this._isLaunchTokenStillCurrent();
  }
  _toRepoInfoTelemetryContext(context) {
    return {
      restrictedTelemetryEnabled: context.restrictedTelemetryEnabled,
      trackingId: context.trackingId,
      telemetryEndpoint: context.telemetryEndpoint ? `${context.telemetryEndpoint.replace(/\/+$/, "")}/telemetry` : void 0,
      isInternal: context.isInternal === true,
      userName: context.userName,
      isVscodeTeamMember: context.isVscodeTeamMember === true,
      copilotIgnoreEnabled: context.copilotIgnoreEnabled
    };
  }
  // ---- event wiring -------------------------------------------------------
  _subscribeToEvents() {
    const wrapper = this._wrapper;
    const sessionId = this.sessionId;
    this._register(wrapper.onSystemNotification((e) => {
      const notification = buildCopilotSystemNotification(e);
      if (!notification) {
        this._logService.trace(`[Copilot:${sessionId}] Ignoring system.notification kind=${e.data.kind.type}`);
        return;
      }
      this._logService.info(`[Copilot:${sessionId}] System notification received: kind=${e.data.kind.type}`);
      if (this._turnId) {
        this._emitAction({
          type: ActionType.ChatResponsePart,
          turnId: this._turnId,
          part: {
            kind: ResponsePartKind.SystemNotification,
            content: notification.messageText
          }
        });
        return;
      }
      if (!notification.startsTurn) {
        this._logService.trace(`[Copilot:${sessionId}] Ignoring passive system.notification kind=${e.data.kind.type} without an active turn`);
        return;
      }
      const turnId = generateUuid();
      this.resetTurnState(turnId);
      this._emitAction({
        type: ActionType.ChatTurnStarted,
        turnId,
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        message: {
          text: notification.messageText,
          origin: { kind: MessageKind.SystemNotification }
        }
      });
    }));
    this._register(wrapper.onUserMessage((e) => {
      if (e.agentId) {
        this._resumeSubagentForEvent(e, { text: e.data.content, origin: { kind: MessageKind.User } });
        return;
      }
      if (e.data.source && e.data.source.toLowerCase() !== "user") {
        return;
      }
      this._currentTurn?.markRunning();
      const steering = this._takeMatchingPendingSteering(e.data.content);
      if (steering) {
        this._beginSteeringTurn(steering);
      }
      if (this._turnId) {
        this._databaseRef.object.setTurnEventId(this._turnId, e.id);
      }
    }));
    this._register(wrapper.onMessageDelta((e) => {
      this._logService.trace(`[Copilot:${sessionId}] delta: ${e.data.deltaContent}`);
      this._resumeSubagentForEvent(e);
      if (this._shouldDropUnmappedSubagentEvent(e, "assistant.message_delta")) {
        return;
      }
      this._emitMarkdownDelta(e.data.deltaContent, this._parentToolCallIdForSubagentEvent(e));
    }));
    this._register(wrapper.onMessage((e) => {
      this._logService.info(`[Copilot:${sessionId}] Full message received: ${e.data.content.length} chars`);
      this._resumeSubagentForEvent(e);
      if (!e.agentId) {
        const clientType = this._currentTurn?.clientType ?? AgentHostClientType.Unknown;
        void this._telemetryReporter.assistantMessageReceived(this.sessionUri.toString(), clientType, e.data.clientRequestId, this._appliedSnapshot.tools).catch((err) => this._logService.trace(`[Copilot:${this.sessionId}] Telemetry emission failed: ${getErrorMessage(err)}`));
        void this._telemetryReporter.modelMessageText(this.sessionUri.toString(), clientType, e.data.content, this._turnOrdinal, e.data.clientRequestId).catch((err) => this._logService.trace(`[Copilot:${this.sessionId}] Telemetry emission failed: ${getErrorMessage(err)}`));
        const turn = this._currentTurn;
        if (turn) {
          turn.toolCallRounds++;
          if (e.data.model) {
            turn.lastModel = e.data.model;
          }
          const toolRequests = e.data.toolRequests;
          if (toolRequests?.length) {
            turn.totalToolCalls += toolRequests.length;
            if (toolRequests.length > 1) {
              turn.parallelToolCallRounds++;
              turn.parallelToolCallsTotal += toolRequests.length;
            }
            for (const req of toolRequests) {
              turn.toolCounts.set(req.name, (turn.toolCounts.get(req.name) ?? 0) + 1);
            }
          }
        }
      }
      if (this._shouldDropUnmappedSubagentEvent(e, "assistant.message")) {
        return;
      }
      const parentToolCallId = this._parentToolCallIdForSubagentEvent(e);
      const markdownScope = parentToolCallId ?? "";
      if (e.data.content && !this._currentTurn?.markdownPartIds.has(markdownScope)) {
        const partId = generateUuid();
        this._currentTurn?.markdownPartIds.set(markdownScope, partId);
        this._emitAction({
          type: ActionType.ChatResponsePart,
          turnId: this._turnId,
          part: { kind: ResponsePartKind.Markdown, id: partId, content: e.data.content }
        }, parentToolCallId);
      }
      if (e.data.toolRequests?.length) {
        this._beginToolCallRound(parentToolCallId);
      }
    }));
    this._register(wrapper.onPermissionRequested((e) => {
      const toolCallId = e.data.permissionRequest.toolCallId;
      if (!toolCallId) {
        return;
      }
      this._recordAutoApproval(toolCallId, e.data.promptRequest?.autoApproval);
      const existing = this._toolApprovalRecords.get(toolCallId);
      const permissionRequest = e.data.permissionRequest;
      this._toolApprovalRecords.set(toolCallId, {
        permissionRequested: true,
        resolvedByHook: existing?.resolvedByHook || e.data.resolvedByHook === true,
        requestSandboxBypass: existing?.requestSandboxBypass || permissionRequest.requestSandboxBypass === true,
        resultKind: existing?.resultKind,
        toolName: existing?.toolName ?? permissionRequest.toolName,
        mcpServerName: existing?.mcpServerName,
        reported: existing?.reported ?? false
      });
    }));
    this._register(wrapper.onPermissionCompleted((e) => {
      const toolCallId = e.data.toolCallId;
      if (!toolCallId) {
        return;
      }
      const existing = this._toolApprovalRecords.get(toolCallId);
      const record = {
        permissionRequested: existing?.permissionRequested ?? true,
        resolvedByHook: existing?.resolvedByHook ?? false,
        requestSandboxBypass: existing?.requestSandboxBypass ?? false,
        resultKind: e.data.result.kind,
        toolName: existing?.toolName,
        mcpServerName: existing?.mcpServerName,
        reported: existing?.reported ?? false
      };
      this._toolApprovalRecords.set(toolCallId, record);
      this._reportToolApproval(toolCallId, record.toolName, record.mcpServerName);
      if (isPermissionDeniedKind(record.resultKind)) {
        this._toolApprovalRecords.delete(toolCallId);
      }
    }));
    this._register(wrapper.onToolCallDelta((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Tool call delta: ${e.data.toolName ?? "<pending>"} (${e.data.toolCallId})`);
      this._resumeSubagentForEvent(e);
      if (this._shouldDropUnmappedSubagentEvent(e, "assistant.tool_call_delta")) {
        return;
      }
      const existing = this._streamingToolCalls.get(e.data.toolCallId);
      const streaming = existing ?? {
        input: "",
        toolName: void 0,
        parentToolCallId: void 0,
        started: false,
        displayedInputLength: 0,
        displayedMessage: void 0
      };
      streaming.input += e.data.inputDelta;
      if (e.data.toolName) {
        if (streaming.toolName && streaming.toolName !== e.data.toolName) {
          this._logService.warn(`[Copilot:${sessionId}] Tool call ${e.data.toolCallId} changed name while streaming from ${streaming.toolName} to ${e.data.toolName}`);
        } else {
          streaming.toolName = e.data.toolName;
        }
      }
      this._streamingToolCalls.set(e.data.toolCallId, streaming);
      const toolName = streaming.toolName;
      if (!toolName || isHiddenTool(toolName) || isTaskCompleteTool(toolName) || this._clientToolNames.has(this._clientToolName(toolName))) {
        return;
      }
      if (!streaming.started) {
        streaming.parentToolCallId = this._parentToolCallIdForSubagentEvent(e);
      }
      if (!streaming.started) {
        streaming.started = true;
        this._emitAction({
          type: ActionType.ChatToolCallStart,
          turnId: this._turnId,
          toolCallId: e.data.toolCallId,
          toolName,
          displayName: getToolDisplayName(toolName),
          contributor: this._getToolCallContributor(toolName, void 0),
          _meta: toToolCallMeta(this._createToolCallMeta(toolName, void 0))
        }, streaming.parentToolCallId);
        this._emitStreamingToolCallDisplay(e.data.toolCallId, streaming);
        return;
      }
      this._scheduleStreamingToolCallDisplay(e.data.toolCallId);
    }));
    this._register(wrapper.onToolStart((e) => {
      if (isHiddenTool(e.data.toolName)) {
        this._streamingToolDisplaySchedulers.deleteAndDispose(e.data.toolCallId);
        this._streamingToolCalls.delete(e.data.toolCallId);
        this._logService.trace(`[Copilot:${sessionId}] Tool started (hidden): ${e.data.toolName}`);
        return;
      }
      this._logService.info(`[Copilot:${sessionId}] Tool started: ${e.data.toolName}`);
      let toolArgs = e.data.arguments !== void 0 ? tryStringify(e.data.arguments) : void 0;
      let parameters;
      if (toolArgs) {
        try {
          parameters = JSON.parse(toolArgs);
        } catch {
        }
      }
      if (stripRedundantCdPrefix(e.data.toolName, parameters, this._workingDirectory)) {
        toolArgs = tryStringify(parameters);
      }
      const displayName = getToolDisplayName(e.data.toolName);
      const streamed = this._streamingToolCalls.get(e.data.toolCallId);
      this._streamingToolDisplaySchedulers.deleteAndDispose(e.data.toolCallId);
      if (streamed?.started && streamed.displayedInputLength < streamed.input.length) {
        this._emitStreamingToolCallDisplay(e.data.toolCallId, streamed);
      }
      this._streamingToolCalls.delete(e.data.toolCallId);
      if (streamed?.toolName && streamed.toolName !== e.data.toolName) {
        this._logService.warn(`[Copilot:${sessionId}] Tool call ${e.data.toolCallId} started as ${e.data.toolName} after streaming as ${streamed.toolName}`);
      }
      this._resumeSubagentForEvent(e);
      if (!streamed?.started && this._shouldDropUnmappedSubagentEvent(e, "tool.execution_start")) {
        this._unroutableSubagentToolCallIds.add(e.data.toolCallId);
        return;
      }
      const parentToolCallId = streamed?.parentToolCallId ?? this._parentToolCallIdForSubagentEvent(e);
      const clientToolName = this._clientToolName(e.data.toolName);
      const isClientTool = this._clientToolNames.has(clientToolName);
      const isToolSearch = this._isToolSearchActive() && e.data.toolName === RUNTIME_TOOL_SEARCH_TOOL_NAME;
      const contributor = this._getToolCallContributor(e.data.toolName, e.data.mcpServerName);
      const intention = getShellIntention(e.data.toolName, parameters);
      this._activeToolCalls.set(e.data.toolCallId, {
        toolName: e.data.toolName,
        displayName,
        parameters,
        content: [],
        parentToolCallId,
        mcpServerName: e.data.mcpServerName,
        contributor,
        intention,
        meta: void 0
      });
      const existingApproval = this._toolApprovalRecords.get(e.data.toolCallId);
      const approvalRecord = {
        permissionRequested: existingApproval?.permissionRequested ?? false,
        resolvedByHook: existingApproval?.resolvedByHook ?? false,
        requestSandboxBypass: existingApproval?.requestSandboxBypass ?? false,
        resultKind: existingApproval?.resultKind,
        toolName: e.data.toolName,
        mcpServerName: e.data.mcpServerName,
        reported: existingApproval?.reported ?? false
      };
      this._toolApprovalRecords.set(e.data.toolCallId, approvalRecord);
      if (approvalRecord.resultKind !== void 0) {
        this._reportToolApproval(e.data.toolCallId, e.data.toolName, e.data.mcpServerName);
      }
      if (isShellTool(e.data.toolName)) {
        this._nonPtyShellTerminals.track(e.data.toolCallId, displayName);
      }
      if (isTaskCompleteTool(e.data.toolName)) {
        this._beginToolCallRound(parentToolCallId);
        return;
      }
      if (!streamed?.started) {
        this._beginToolCallRound(parentToolCallId);
      }
      const meta = this._createToolCallMeta(e.data.toolName, parameters);
      if (e.data.mcpServerName) {
        meta.mcpServerName = e.data.mcpServerName;
      }
      if (e.data.mcpToolName) {
        meta.mcpToolName = e.data.mcpToolName;
      }
      const resourceUri = e.data.toolDescription?._meta?.ui?.resourceUri;
      this._setToolCallUiMeta(meta, resourceUri, e.data.mcpServerName);
      const tracked = this._activeToolCalls.get(e.data.toolCallId);
      if (tracked) {
        tracked.meta = meta;
      }
      if (!streamed?.started) {
        this._emitAction({
          type: ActionType.ChatToolCallStart,
          turnId: this._turnId,
          toolCallId: e.data.toolCallId,
          toolName: e.data.toolName,
          displayName,
          intention,
          contributor,
          _meta: toToolCallMeta(meta)
        }, parentToolCallId);
      }
      if (isClientTool && !contributor) {
        this._logService.warn(`[Copilot:${sessionId}] Client tool '${e.data.toolName}' started with no connected client; failing it immediately.`);
        this._reportToolApprovalIfNoPermission(e.data.toolCallId);
        this._toolApprovalRecords.delete(e.data.toolCallId);
        this._activeToolCalls.delete(e.data.toolCallId);
        this._emitAction({
          type: ActionType.ChatToolCallReady,
          turnId: this._turnId,
          toolCallId: e.data.toolCallId,
          ...contributor ? { contributor } : {},
          ...intention !== void 0 ? { intention } : {},
          invocationMessage: getInvocationMessage(e.data.toolName, displayName, parameters, (path) => this._resolveEditFilePath(path)),
          toolInput: getToolInputString(e.data.toolName, parameters, toolArgs),
          confirmed: ToolCallConfirmationReason.NotNeeded,
          _meta: toToolCallMeta(meta)
        }, parentToolCallId);
        this._emitAction({
          type: ActionType.ChatToolCallComplete,
          turnId: this._turnId,
          toolCallId: e.data.toolCallId,
          result: {
            success: false,
            pastTenseMessage: `${displayName} failed`,
            error: { message: `No client was connected to run ${displayName}` }
          }
        }, parentToolCallId);
        this._pendingClientToolCalls.respondOrBuffer(e.data.toolCallId, {
          textResultForLlm: `No client was connected to run ${displayName}.`,
          resultType: "failure",
          error: "No client connected"
        });
        return;
      }
      const clientToolAutoApproved = contributor?.kind === ToolCallContributorKind.Client && this._lastAppliedPermissionMode === "on";
      if (isToolSearch && clientToolAutoApproved) {
        meta.autoApproveBySetting = true;
      }
      const shouldWaitForClientToolReady = contributor?.kind === ToolCallContributorKind.Client && !isAgentCoordinationTool(e.data.toolName) && (isToolSearch || !clientToolAutoApproved);
      if (shouldWaitForClientToolReady) {
        return;
      }
      this._emitAction({
        type: ActionType.ChatToolCallReady,
        turnId: this._turnId,
        toolCallId: e.data.toolCallId,
        ...contributor ? { contributor } : {},
        ...intention !== void 0 ? { intention } : {},
        invocationMessage: getInvocationMessage(e.data.toolName, displayName, parameters, (path) => this._resolveEditFilePath(path)),
        toolInput: getToolInputString(e.data.toolName, parameters, toolArgs),
        confirmed: ToolCallConfirmationReason.NotNeeded,
        _meta: toToolCallMeta(clientToolAutoApproved ? { ...meta, autoApproveBySetting: true } : meta)
      }, parentToolCallId);
    }));
    this._register(wrapper.onToolComplete(async (e) => {
      this._approvedDuplicablePermissionSignatures.delete(e.data.toolCallId);
      const tracked = this._activeToolCalls.get(e.data.toolCallId);
      if (!tracked) {
        this._unroutableSubagentToolCallIds.delete(e.data.toolCallId);
        return;
      }
      const parentToolCallId = tracked.parentToolCallId ?? this._parentToolCallIdForSubagentEvent(e);
      if (!parentToolCallId && e.agentId) {
        this._logService.warn(`[Copilot:${this.sessionId}] Dropping tool.execution_complete for unknown subagent agentId=${e.agentId}`);
        return;
      }
      if (e.data.success && tracked.contributor === void 0) {
        const telemetrySession = parentToolCallId ? URI.parse(buildSubagentSessionUri(this._storageUri.toString(), parentToolCallId)) : this.sessionUri;
        reportCopilotTodoStoreOperation(this._telemetryService, telemetrySession, e.data.toolCallId, tracked.toolName, tracked.parameters);
      }
      this._logService.info(`[Copilot:${sessionId}] Tool completed: ${e.data.toolCallId}`);
      this._reportToolApprovalIfNoPermission(e.data.toolCallId);
      this._activeToolCalls.delete(e.data.toolCallId);
      this._autoApprovals.delete(e.data.toolCallId);
      this._toolApprovalRecords.delete(e.data.toolCallId);
      this._pendingAutoApprovals.respond(e.data.toolCallId, void 0);
      const displayName = tracked.displayName;
      const toolOutput = e.data.error?.message ?? e.data.result?.content;
      if (isTaskCompleteTool(tracked.toolName)) {
        const summary = getTaskCompleteMarkdown(tracked.parameters, toolOutput);
        if (summary) {
          this._emitAction({
            type: ActionType.ChatResponsePart,
            turnId: this._turnId,
            part: { kind: ResponsePartKind.Markdown, id: generateUuid(), content: summary }
          });
        }
        return;
      }
      const content = [...tracked.content];
      if (toolOutput !== void 0) {
        content.push({ type: ToolResultContentType.Text, text: toolOutput });
      }
      const isShellCommandTool = isShellTool(tracked.toolName);
      const ptyTerminalUri = isShellCommandTool ? this._shellManager?.getTerminalUriForToolCall(e.data.toolCallId) : void 0;
      let retireNonPtyShellTracking = !!ptyTerminalUri;
      if (ptyTerminalUri && !content.some((c) => c.type === ToolResultContentType.Terminal)) {
        content.push({
          type: ToolResultContentType.Terminal,
          resource: ptyTerminalUri,
          title: tracked.displayName
        });
      }
      const shellExit = appendSdkToolResultContent(
        content,
        e.data.result?.contents,
        isShellCommandTool ? { session: this.sessionUri, toolCallId: e.data.toolCallId, title: tracked.displayName } : void 0
      );
      if (isShellCommandTool && !ptyTerminalUri) {
        const completion = this._nonPtyShellTerminals.completeToolCall(e.data.toolCallId, toolOutput, shellExit);
        if (completion) {
          retireNonPtyShellTracking = completion.shouldRetire;
          const terminalIndex = content.findIndex((c) => c.type === ToolResultContentType.Terminal);
          if (terminalIndex === -1) {
            content.push({
              type: ToolResultContentType.Terminal,
              resource: completion.uri,
              title: tracked.displayName,
              isPty: false,
              ...completion.result ? { result: completion.result } : {}
            });
          } else if (completion.result) {
            const terminalBlock = content[terminalIndex];
            content[terminalIndex] = { ...terminalBlock, result: completion.result };
          }
        }
      }
      const command = isString(tracked.parameters?.command) ? tracked.parameters.command : void 0;
      const filePaths = isEditTool(tracked.toolName, command) ? this._getEditFilePaths(tracked.parameters) : [];
      for (const filePath of filePaths) {
        try {
          const fileEdit = await this._editTracker.takeCompletedEdit(this._turnId, e.data.toolCallId, filePath, tracked.toolName, tracked.parameters, this._lastSeenModelId);
          if (fileEdit) {
            content.push(fileEdit);
          }
        } catch (err) {
          this._logService.warn(`[Copilot:${sessionId}] Failed to take completed edit`, err);
        }
      }
      this._emitAction({
        type: ActionType.ChatToolCallComplete,
        turnId: this._turnId,
        toolCallId: e.data.toolCallId,
        result: {
          success: e.data.success,
          pastTenseMessage: getPastTenseMessage(tracked.toolName, displayName, tracked.parameters, e.data.success, e.data.success ? toolOutput : void 0, (path) => this._resolveEditFilePath(path)),
          content: content.length > 0 ? content : void 0,
          error: e.data.error
        },
        _meta: tracked.meta ? toToolCallMeta(tracked.meta) : void 0
      }, parentToolCallId);
      if (retireNonPtyShellTracking) {
        this._nonPtyShellTerminals.retire(e.data.toolCallId);
      }
    }));
    this._register(wrapper.onIdle((e) => {
      this._logService.info(`[Copilot:${sessionId}] Session idle`);
      if (e.data.aborted) {
        this._resetAbortToken();
      }
      if (this._hasActivity) {
        this._hasActivity = false;
        this._emitAction({
          type: ActionType.SessionActivityChanged,
          activity: void 0
        });
      }
      const turn = this._currentTurn;
      if (!turn) {
        return;
      }
      if (e.data.aborted) {
        this._cancelActiveRepoInfoTelemetry();
        if (turn.isRunning) {
          this._logService.trace(`[Copilot:${sessionId}] Idle from abort; tearing down running turn ${turn.id}`);
          this._reportToolCallDetails(turn, "cancelled");
          turn.markAborted();
          this._clearActiveTurn();
        } else {
          this._logService.trace(`[Copilot:${sessionId}] Idle from abort; leaving ${turn.state} turn ${turn.id} open`);
        }
        return;
      }
      this._completeActiveRepoInfoTelemetry();
      this._completeActiveTurn();
    }));
    this._register(wrapper.onSkillInvoked((e) => {
      this._logService.info(`[Copilot:${sessionId}] Skill invoked: ${e.data.name} (${e.data.path})`);
      this._resumeSubagentForEvent(e);
      if (this._shouldDropUnmappedSubagentEvent(e, "skill.invoked")) {
        return;
      }
      if (!e.agentId) {
        this._telemetryReporter.skillContentRead({
          clientType: this._currentTurn?.clientType ?? AgentHostClientType.Unknown,
          name: e.data.name,
          path: e.data.path,
          content: e.data.content,
          source: e.data.source,
          pluginName: e.data.pluginName,
          pluginVersion: e.data.pluginVersion
        });
      }
      const parentToolCallId = this._parentToolCallIdForSubagentEvent(e);
      const synth = synthesizeSkillToolCall(e.data, e.id);
      this._emitAction({
        type: ActionType.ChatToolCallStart,
        turnId: this._turnId,
        toolCallId: synth.toolCallId,
        toolName: synth.toolName,
        displayName: synth.displayName
      }, parentToolCallId);
      this._emitAction({
        type: ActionType.ChatToolCallReady,
        turnId: this._turnId,
        toolCallId: synth.toolCallId,
        invocationMessage: synth.invocationMessage,
        confirmed: ToolCallConfirmationReason.NotNeeded
      }, parentToolCallId);
      this._emitAction({
        type: ActionType.ChatToolCallComplete,
        turnId: this._turnId,
        toolCallId: synth.toolCallId,
        result: {
          success: true,
          pastTenseMessage: synth.pastTenseMessage
        }
      }, parentToolCallId);
    }));
    this._register(wrapper.onSubagentStarted((e) => {
      if (e.agentId) {
        this._parentToolCallIdsByAgentId.set(e.agentId, e.data.toolCallId);
        this._activeSubagentAgentIds.add(e.agentId);
      }
      this._logService.info(`[Copilot:${sessionId}] Subagent started: toolCallId=${e.data.toolCallId}, agent=${e.data.agentName}`);
      const tracked = this._activeToolCalls.get(e.data.toolCallId);
      this._onDidSessionProgress.fire({
        kind: "subagent_started",
        chat: this._chatChannelUri,
        toolCallId: e.data.toolCallId,
        agentName: e.data.agentName,
        agentDisplayName: e.data.agentDisplayName,
        agentDescription: e.data.agentDescription,
        // The spawning Task tool's short `description` input (captured on
        // tool start) is the concise per-task tab title for the subagent's
        // read-only peer chat — distinct even for same-type subagents.
        taskDescription: tracked?.meta?.subagentDescription,
        // The full delegated instruction (the spawning tool's `prompt`
        // argument) seeds the subagent peer chat's opening request.
        taskPrompt: typeof tracked?.parameters?.prompt === "string" ? tracked.parameters.prompt : void 0,
        // When the spawning tool call is itself an inner tool of
        // another subagent, its recorded parent is the tool call one
        // level up — the tool call in whose (subagent) chat this
        // spawning tool lives. The host uses it to route the
        // discovery content block to that immediate parent chat, at
        // any nesting depth.
        parentToolCallId: tracked?.parentToolCallId
      });
    }));
    this._register(wrapper.onSessionError((e) => {
      this._logService.error(`[Copilot:${sessionId}] Session error: ${e.data.errorType} - ${e.data.message}`);
      reportCopilotSdkSessionError(this._telemetryService, e, createCopilotFailureCorrelation(this.sessionUri, this._chatChannelUri, this._turnId, this.sessionId));
      if (this._currentTurn) {
        this._reportToolCallDetails(this._currentTurn, "failed");
      }
      this._emitAction({
        type: ActionType.ChatError,
        turnId: this._turnId,
        duration: this._currentTurn?.duration ?? 0,
        error: buildChatErrorInfoFromCopilotSdkFields(e.data)
      });
    }));
    this._register(wrapper.onModelCallFailure((e) => {
      reportCopilotModelCallFailure(this._telemetryService, e, createCopilotFailureCorrelation(this.sessionUri, this._chatChannelUri, this._turnId, this.sessionId));
    }));
    let lastParentUsage;
    let lastParentUsageTurnId;
    let autoModeResolved;
    this._register(wrapper.onAutoModeResolved((e) => {
      this._lastSeenModelId = e.data.chosenModel;
      const turnId = this._turnId;
      this._logService.info(`[Copilot:${sessionId}] Auto mode resolved to ${e.data.chosenModel}${e.data.reasoningBucket ? ` (${e.data.reasoningBucket})` : ""}`);
      if (!turnId) {
        return;
      }
      if (!e.agentId) {
        this._telemetryReporter.autoModeRouterDecision({
          session: this.sessionUri.toString(),
          turnId,
          clientType: this._currentTurn?.clientType ?? AgentHostClientType.Unknown,
          chosenModel: e.data.chosenModel,
          predictedLabel: e.data.predictedLabel,
          confidence: e.data.confidence,
          candidateModels: e.data.candidateModels,
          categoryScores: e.data.categoryScores,
          routingMethod: e.data.routingMethod,
          availableModels: e.data.availableModels,
          fallback: e.data.fallback,
          fallbackReason: e.data.fallbackReason,
          stickyOverride: e.data.stickyOverride,
          routerLatencyMs: e.data.routerLatencyMs,
          endToEndLatencyMs: e.data.endToEndLatencyMs,
          chosenShortfall: e.data.chosenShortfall,
          hasImage: e.data.hasImage
        });
      }
      autoModeResolved = { turnId, data: e.data };
      const priorUsage = lastParentUsageTurnId === turnId ? lastParentUsage : void 0;
      const usage = {
        ...priorUsage,
        model: e.data.chosenModel,
        _meta: {
          ...priorUsage?._meta ?? {},
          autoModeResolved: e.data
        }
      };
      lastParentUsage = usage;
      lastParentUsageTurnId = turnId;
      this._emitAction({
        type: ActionType.ChatUsage,
        turnId,
        usage
      });
    }));
    this._register(wrapper.onUsage((e) => {
      this._resumeSubagentForEvent(e);
      const parentToolCallId = this._parentToolCallIdForSubagentEvent(e);
      if (!parentToolCallId && !e.agentId && !e.data.parentToolCallId) {
        this._promptCacheRefreshGeneration++;
        if (e.data.model && e.data.cacheExpiresAt) {
          this._setPromptCacheState({ modelId: e.data.model, cacheExpiresAt: e.data.cacheExpiresAt });
        } else if (e.data.model && this._promptCacheState?.modelId !== e.data.model) {
          this._setPromptCacheState(void 0);
        }
      }
      const copilotUsage = readCopilotUsage(e.data);
      const quotaSnapshots = normalizeQuotaSnapshots(e.data.quotaSnapshots);
      const turn = this._currentTurn;
      if (typeof e.data.model === "string" && e.data.model) {
        this._lastSeenModelId = e.data.model;
      }
      const eventContext = {
        inputTokens: e.data.inputTokens,
        outputTokens: e.data.outputTokens,
        model: e.data.model,
        cacheReadTokens: e.data.cacheReadTokens,
        ...typeof e.data.cost === "number" ? { cost: e.data.cost } : {}
      };
      if (!parentToolCallId && turn) {
        turn.parentContextUsage = eventContext;
      }
      turn?.addTokenTotals(eventContext.model, eventContext);
      const buildUsage = (context, scopedCopilotUsage, isParentScope) => {
        const metadata = {};
        if (typeof context.cost === "number") {
          metadata.cost = context.cost;
        }
        if (isParentScope && autoModeResolved?.turnId === this._turnId) {
          metadata.autoModeResolved = autoModeResolved.data;
        }
        if (scopedCopilotUsage) {
          metadata.copilotUsage = scopedCopilotUsage;
        }
        if (quotaSnapshots) {
          metadata.quotaSnapshots = quotaSnapshots;
        }
        const turnTokenTotals = isParentScope ? turn?.tokenTotals : void 0;
        if (turnTokenTotals) {
          metadata.turnTokenTotals = turnTokenTotals;
        }
        return {
          inputTokens: context.inputTokens,
          outputTokens: context.outputTokens,
          model: context.model,
          cacheReadTokens: context.cacheReadTokens,
          ...Object.keys(metadata).length > 0 ? { _meta: metadata } : {}
        };
      };
      if (turn && copilotUsage) {
        turn.copilotNanoAiu += copilotUsage.totalNanoAiu;
        if (parentToolCallId) {
          const scopedTotal = (turn.subagentNanoAiuByToolCallId.get(parentToolCallId) ?? 0) + copilotUsage.totalNanoAiu;
          turn.subagentNanoAiuByToolCallId.set(parentToolCallId, scopedTotal);
        }
      }
      const parentContext = parentToolCallId ? turn?.parentContextUsage ?? {} : eventContext;
      const parentUsage = buildUsage(parentContext, this._parentCopilotUsageMeta(), true);
      lastParentUsage = parentUsage;
      lastParentUsageTurnId = this._turnId;
      this._emitAction({
        type: ActionType.ChatUsage,
        turnId: this._turnId,
        usage: parentUsage
      });
      if (parentToolCallId) {
        const scopedTotal = turn?.subagentNanoAiuByToolCallId.get(parentToolCallId);
        const subagentCopilotUsage = copilotUsage && scopedTotal !== void 0 ? { ...copilotUsage, totalNanoAiu: scopedTotal } : void 0;
        this._emitAction({
          type: ActionType.ChatUsage,
          turnId: this._turnId,
          usage: buildUsage(eventContext, subagentCopilotUsage, false)
        }, parentToolCallId);
      }
    }));
    this._register(wrapper.onUsage(async (e) => {
      const isSubagentEvent = !!this._parentToolCallIdForSubagentEvent(e);
      const turnId = this._turnId;
      const baseUsage = lastParentUsageTurnId === turnId ? lastParentUsage : void 0;
      const usage = baseUsage ?? {
        inputTokens: e.data.inputTokens,
        outputTokens: e.data.outputTokens,
        model: e.data.model,
        cacheReadTokens: e.data.cacheReadTokens
      };
      await this._refreshSessionUsageMetrics();
      const attribution = isSubagentEvent ? void 0 : await this._readContextAttribution();
      if (!turnId) {
        return;
      }
      if (turnId !== this._turnId || usage !== lastParentUsage || lastParentUsageTurnId !== turnId) {
        return;
      }
      const copilotUsage = this._parentCopilotUsageMeta();
      if (!attribution && !copilotUsage) {
        return;
      }
      const enriched = {
        ...usage,
        _meta: {
          ...usage._meta ?? {},
          ...copilotUsage ? { copilotUsage } : {},
          ...attribution ? { contextAttribution: attribution } : {}
        }
      };
      lastParentUsage = enriched;
      lastParentUsageTurnId = turnId;
      this._emitAction({
        type: ActionType.ChatUsage,
        turnId,
        usage: enriched
      });
    }));
    this._register(wrapper.onSessionCompactionComplete(async (e) => {
      if (e.agentId || e.data.success === false) {
        return;
      }
      const copilotUsage = readCopilotUsage(e.data.compactionTokensUsed);
      const turn = this._currentTurn;
      const compactionTokens = e.data.compactionTokensUsed;
      turn?.addTokenTotals(compactionTokens?.model ?? this._lastSeenModelId, {
        inputTokens: compactionTokens?.inputTokens,
        outputTokens: compactionTokens?.outputTokens,
        cacheReadTokens: compactionTokens?.cacheReadTokens
      });
      const emitParentUsage = () => {
        const turnId = this._turnId;
        const parentCopilotUsage = this._parentCopilotUsageMeta();
        const turnTokenTotals = this._currentTurn?.tokenTotals;
        if (!turnId || !parentCopilotUsage && !turnTokenTotals) {
          return void 0;
        }
        const base = lastParentUsageTurnId === turnId ? lastParentUsage : void 0;
        const usage = {
          ...base,
          model: base?.model ?? this._lastSeenModelId,
          _meta: {
            ...base?._meta ?? {},
            ...parentCopilotUsage ? { copilotUsage: parentCopilotUsage } : {},
            ...turnTokenTotals ? { turnTokenTotals } : {}
          }
        };
        lastParentUsage = usage;
        lastParentUsageTurnId = turnId;
        this._emitAction({
          type: ActionType.ChatUsage,
          turnId,
          usage
        });
        return turnId;
      };
      if (turn && copilotUsage) {
        turn.copilotNanoAiu += copilotUsage.totalNanoAiu;
        emitParentUsage();
      }
      const turnIdBeforeRefresh = this._turnId;
      if (await this._refreshSessionUsageMetrics() && turnIdBeforeRefresh === this._turnId) {
        emitParentUsage();
      }
    }));
    this._register(wrapper.onReasoningDelta((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Reasoning delta: ${e.data.deltaContent.length} chars`);
      this._resumeSubagentForEvent(e);
      if (this._shouldDropUnmappedSubagentEvent(e, "assistant.reasoning_delta")) {
        return;
      }
      this._emitReasoningDelta(e.data.deltaContent, this._parentToolCallIdForSubagentEvent(e));
    }));
    this._register(wrapper.onSessionModeChanged((e) => {
      if (e.agentId) {
        this._logService.trace(`[Copilot:${sessionId}] Ignoring subagent session.mode_changed: agentId=${e.agentId}, ${e.data.previousMode} -> ${e.data.newMode}`);
        return;
      }
      this._logService.info(`[Copilot:${sessionId}] session.mode_changed: ${e.data.previousMode} -> ${e.data.newMode}`);
      const newMode = e.data.newMode;
      if (newMode !== "interactive" && newMode !== "plan" && newMode !== "autopilot") {
        return;
      }
      this._lastAppliedMode = newMode;
      this._syncAhpConfigFromSdkMode(newMode);
    }));
    this._register(wrapper.onMcpServersLoaded((e) => {
      this._logMcpServersSnapshot(e.data.servers.map((s) => ({
        name: s.name,
        status: s.status,
        error: s.error,
        source: s.source,
        transport: s.transport,
        pluginName: s.pluginName,
        pluginVersion: s.pluginVersion
      })), "loaded");
      this._applyMcpServerList(e.data.servers);
    }));
    this._register(wrapper.onMcpServerStatusChanged((e) => {
      this._logMcpServerLifecycle({ name: e.data.serverName, status: e.data.status, error: e.data.error, origin: "statusChanged" });
      const server = this._toSdkMcpServer(e.data.serverName, e.data.status, e.data.error);
      if (!server) {
        this._mcpCustomizations.remove(e.data.serverName);
        return;
      }
      this._mcpCustomizations.applyOne(server);
    }));
    this._register(wrapper.onToolsUpdated(() => {
      this._slashCommandProvider.clearCache();
      this._fireMcpToolsListChanged();
    }));
    this._register(wrapper.onCommandsChanged(() => {
      this._slashCommandProvider.clearCache();
    }));
    this._seedMcpServersFromRpc();
  }
  /**
   * One-shot fetch of `rpc.mcp.list` at subscription time. Best-effort:
   * any failure is logged and the inventory simply stays empty until the
   * next live event arrives.
   */
  _seedMcpServersFromRpc() {
    this._refreshMcpServersFromRpc().catch((err) => {
      this._logService.warn(`[Copilot:${this.sessionId}] Failed to seed MCP server inventory`, err);
    });
  }
  async _refreshMcpServersFromRpc() {
    const mcpRpc = this._wrapper.session.rpc?.mcp;
    if (!mcpRpc) {
      return;
    }
    const result = await mcpRpc.list();
    if (!this._store.isDisposed) {
      this._logMcpServersSnapshot(result.servers.map((s) => ({
        name: s.name,
        status: s.status,
        error: s.error,
        source: s.source,
        pluginName: s.sourcePlugin,
        pluginVersion: s.sourcePluginVersion
      })), "inventory");
      this._applyMcpServerList(result.servers);
    }
  }
  _applyMcpServerList(servers) {
    const sdkServers = servers.map((s) => this._toSdkMcpServer(s.name, s.status, s.error));
    this._mcpCustomizations.applyAll(sdkServers);
  }
  /**
   * Logs a full MCP inventory snapshot ({@link _logMcpServerLifecycle} per
   * server), then forgets the dedup entry for any server that dropped out of
   * the snapshot so a later re-add re-logs its arrival.
   */
  _logMcpServersSnapshot(servers, origin) {
    const seen = /* @__PURE__ */ new Set();
    for (const server of servers) {
      seen.add(server.name);
      this._logMcpServerLifecycle({ ...server, origin });
    }
    for (const name of [...this._lastLoggedMcpStatus.keys()]) {
      if (!seen.has(name)) {
        this._lastLoggedMcpStatus.delete(name);
      }
    }
  }
  /**
   * Emits a single structured MCP lifecycle log record for `server`,
   * deduplicated by SDK status so an unchanged re-report stays quiet. Failed
   * servers log at `error` (carrying the failure text in the body and an
   * `errorType` attribute); every other transition logs at `info`. Records
   * flow through {@link ILogService} to the agent host's OTLP log stream.
   */
  _logMcpServerLifecycle(server) {
    if (this._lastLoggedMcpStatus.get(server.name) === server.status) {
      return;
    }
    this._lastLoggedMcpStatus.set(server.name, server.status);
    const state = this._translateSdkMcpStatus(server.name, server.status, server.error);
    const attributes = {
      mcpEvent: server.origin,
      mcpServer: server.name,
      mcpStatus: server.status,
      mcpState: state.kind
    };
    if (server.source) {
      attributes.mcpSource = server.source;
    }
    if (server.transport) {
      attributes.mcpTransport = server.transport;
    }
    if (server.pluginName) {
      attributes.mcpPlugin = server.pluginName;
    }
    if (server.pluginVersion) {
      attributes.mcpPluginVersion = server.pluginVersion;
    }
    if (state.kind === McpServerStatus.Error) {
      attributes.errorType = state.error.errorType;
    }
    const detail = server.error ? `: ${server.error}` : "";
    const message = `[Copilot:${this.sessionId}] MCP server '${server.name}' ${server.status} (${state.kind})${detail}`;
    if (server.status === "failed") {
      this._logService.error(message, new OtelData(attributes));
    } else {
      this._logService.info(message, new OtelData(attributes));
    }
  }
  _setToolCallUiMeta(meta, resourceUri, mcpServerName) {
    if (!resourceUri) {
      return;
    }
    const ui = { resourceUri };
    if (mcpServerName) {
      const channel = this._mcpCustomizations.channelForServer(mcpServerName);
      if (channel !== void 0) {
        ui.channel = channel;
      }
    }
    meta.ui = ui;
  }
  /**
   * Broadcasts `notifications/tools/list_changed` for every MCP server
   * currently in the `Ready` state. The SDK's `session.tools_updated`
   * event is a coarse "tools refreshed" hint that doesn't identify
   * which server changed, so we fan out to all ready channels. Clients
   * are expected to refetch `tools/list` on each notification.
   */
  _fireMcpToolsListChanged() {
    for (const { channel } of this._mcpCustomizations.readyChannels()) {
      this._onMcpNotification.fire({
        channel,
        method: "notifications/tools/list_changed"
      });
    }
  }
  /** Snapshot of MCP servers that have no plugin-derived child entry. */
  topLevelMcpCustomizations() {
    return this._mcpCustomizations.topLevelCustomizations();
  }
  /**
   * Translates the SDK's flat MCP status string into AHP's discriminated
   * {@link McpServerState} union.
   */
  _toSdkMcpServer(name, status, error) {
    return {
      name,
      state: this._translateSdkMcpStatus(name, status, error),
      enabled: status !== "disabled"
    };
  }
  _translateSdkMcpStatus(name, status, error) {
    switch (status) {
      case "connected":
        return { kind: McpServerStatus.Ready };
      case "failed":
        return {
          kind: McpServerStatus.Error,
          error: {
            errorType: "mcp-server-failed",
            message: error ?? "MCP server failed to start"
          }
        };
      case "pending":
      case "needs-auth": {
        const previous = this._mcpCustomizations.stateForServer(name);
        if (previous?.kind === McpServerStatus.AuthRequired) {
          return previous;
        }
        return { kind: McpServerStatus.Starting };
      }
      case "disabled":
      case "not_configured":
        return { kind: McpServerStatus.Stopped };
      default:
        return { kind: McpServerStatus.Stopped };
    }
  }
  /**
   * Translates the SDK's three-mode space (`interactive` / `plan` /
   * `autopilot`) to AHP's `mode` axis directly:
   *
   *  - SDK `plan` → AHP `mode='plan'`.
   *  - SDK `interactive` → AHP `mode='interactive'`.
   *  - SDK `autopilot` → AHP `mode='autopilot'`.
   *
   * Autopilot lives on the `mode` axis; the orthogonal `autoApprove` axis
   * (Default / Bypass) is left untouched so the user's chosen
   * approval level is preserved across SDK mode transitions.
   *
   * Patches that already match the current AHP values are still
   * dispatched (the reducer is a no-op in that case) but written values
   * propagate to all subscribed clients via `session/configChanged`.
   */
  _syncAhpConfigFromSdkMode(sdkMode) {
    const sessionUri = this._storageUri.toString();
    const patch = {};
    switch (sdkMode) {
      case "plan":
        patch[SessionConfigKey.Mode] = "plan";
        break;
      case "autopilot":
        patch[SessionConfigKey.Mode] = "autopilot";
        break;
      case "interactive":
        patch[SessionConfigKey.Mode] = "interactive";
        break;
    }
    this._configurationService.updateSessionConfig(sessionUri, patch);
  }
  /**
   * Handles the CLI's `exitPlanMode.request` RPC by surfacing it as a
   * {@link ChatInputRequest} and awaiting the client's response. The
   * resolved {@link CopilotExitPlanModeResponse} flows back to the CLI, which
   * calls `session.respondToExitPlanMode` internally — that resumes the
   * paused `exit_plan_mode` tool call and (on accept) updates the SDK's
   * `currentMode` so the model can continue with implementation.
   */
  async _handleExitPlanModeRequest(data, _invocation) {
    const turnId = this._currentTurn?.id;
    if (!turnId) {
      this._logService.warn(`[Copilot:${this.sessionId}] Rejecting plan review request without an active turn`);
      return { approved: false };
    }
    const requestId = generateUuid();
    const questionId = generateUuid();
    this._logService.info(`[Copilot:${this.sessionId}] exitPlanMode.request: rpcId=${requestId}, actions=[${data.actions.join(",")}], recommended=${data.recommendedAction}`);
    let planPath = null;
    try {
      const planRead = await this._wrapper.session.rpc.plan.read();
      planPath = planRead.path ?? null;
    } catch (err) {
      this._logService.warn(`[Copilot:${this.sessionId}] rpc.plan.read failed for exit_plan_mode: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (this._currentTurn?.id !== turnId) {
      this._logService.warn(`[Copilot:${this.sessionId}] Rejecting plan review request after its turn ended`);
      return { approved: false };
    }
    const options = data.actions.map((actionId) => {
      const desc = getPlanActionDescription(actionId);
      return {
        id: actionId,
        label: desc?.label ?? actionId,
        description: desc?.description,
        recommended: actionId === data.recommendedAction
      };
    });
    const actions = options.map((option) => ({
      id: option.id,
      label: option.label,
      ...option.description ? { description: option.description } : {},
      ...option.recommended ? { default: true } : {}
    }));
    const inputRequest = {
      id: requestId,
      purpose: ChatInputRequestPurpose.PlanReview,
      planReview: {
        title: localize("agentHost.planReview.title", "Review Plan"),
        content: data.summary || localize("agentHost.planReview.fallbackSummary", "A plan is ready for review."),
        actions,
        canProvideFeedback: true,
        answerQuestionId: questionId,
        ...planPath ? { planUri: URI.file(planPath).toString() } : {}
      },
      questions: [{
        kind: ChatInputQuestionKind.SingleSelect,
        id: questionId,
        title: localize("agentHost.planReview.title", "Review Plan"),
        message: localize("agentHost.planReview.questionMessage", "How would you like to proceed?"),
        required: true,
        options,
        allowFreeformInput: true
      }]
    };
    const pendingPlanReview = this._pendingPlanReviews.register(requestId, {
      actions: data.actions,
      recommendedAction: data.recommendedAction,
      questionId
    });
    this._onDidSessionProgress.fire({
      kind: "action",
      resource: this._chatChannelUri,
      action: {
        type: ActionType.ChatInputRequested,
        request: inputRequest
      }
    });
    try {
      return await pendingPlanReview;
    } catch (err) {
      this._logService.error(err, `[Copilot:${this.sessionId}] exitPlanMode.request handler failed: rpcId=${requestId}`);
      return { approved: false };
    }
  }
  /**
   * Drop the memoized event reconstruction whenever the persisted event log
   * could have changed, so {@link _getMappedEvents} never serves stale turns
   * once the session resumes activity. While the session is idle (e.g. during
   * a historical session open) none of these fire, so the whole restore wave
   * coalesces to a single reconstruction.
   */
  _subscribeForMemoInvalidation() {
    const wrapper = this._wrapper;
    const invalidate = () => this._invalidateMappedEvents();
    this._register(wrapper.onUserMessage(invalidate));
    this._register(wrapper.onTurnStart(invalidate));
    this._register(wrapper.onMessage(invalidate));
    this._register(wrapper.onToolStart(invalidate));
    this._register(wrapper.onToolComplete(invalidate));
    this._register(wrapper.onSubagentStarted(invalidate));
    this._register(wrapper.onSubagentCompleted(invalidate));
    this._register(wrapper.onSubagentFailed(invalidate));
    this._register(wrapper.onTurnEnd(invalidate));
    this._register(wrapper.onSessionError(invalidate));
    this._register(wrapper.onSessionCompactionComplete(invalidate));
    this._register(wrapper.onSessionTruncation(invalidate));
    this._register(wrapper.onSessionSnapshotRewind(invalidate));
  }
  /**
   * Emits `instructionsCollected` per user message.
   * Attempts to match local chat's `ComputeAutomaticInstructions`
   * emitter (`src/vs/workbench/contrib/chat/common/promptSyntax/computeAutomaticInstructions.ts`)
   */
  _subscribeForInstructionsCollectedTelemetry() {
    const wrapper = this._wrapper;
    const sessionId = this.sessionId;
    this._register(wrapper.onUserMessage((e) => {
      if (e.agentId || e.data.source && e.data.source.toLowerCase() !== "user") {
        return;
      }
      void (async () => {
        let sources;
        try {
          sources = (await wrapper.session.rpc.instructions.getSources()).sources;
        } catch (err) {
          this._logService.trace(`[Copilot:${sessionId}] Failed to fetch instruction sources for telemetry: ${getErrorMessage(err)}`);
          return;
        }
        let agentInstructionsCount = 0;
        let applyingInstructionsCount = 0;
        let referencedInstructionsCount = 0;
        let claudeMdCount = 0;
        for (const s of sources) {
          if (s.type === "home" || s.type === "repo" || s.type === "model") {
            agentInstructionsCount++;
          }
          if (s.applyTo && s.applyTo.length > 0) {
            applyingInstructionsCount++;
          }
          if (s.type === "child-instructions" || s.type === "nested-agents") {
            referencedInstructionsCount++;
          }
          const lastSep = Math.max(s.sourcePath.lastIndexOf("/"), s.sourcePath.lastIndexOf("\\"));
          const filename = lastSep >= 0 ? s.sourcePath.slice(lastSep + 1) : s.sourcePath;
          if (filename === "CLAUDE.md") {
            claudeMdCount++;
          }
        }
        this._telemetryService.publicLog2("agentHost.instructionsCollected", {
          provider: this.sessionUri.scheme,
          agentSessionId: AgentSession.id(this.sessionUri),
          isSubagentSession: isSubagentSession(this.sessionUri),
          totalInstructionsCount: sources.length,
          agentInstructionsCount,
          applyingInstructionsCount,
          referencedInstructionsCount,
          claudeMdCount
        });
      })().catch((err) => {
        this._logService.trace(`[Copilot:${sessionId}] instructionsCollected telemetry failed: ${getErrorMessage(err)}`);
      });
    }));
  }
  _subscribeForLogging() {
    const wrapper = this._wrapper;
    const sessionId = this.sessionId;
    this._register(wrapper.onUnhandledEvent((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Unhandled SDK event: ${safeStringify(e)}`);
    }));
    this._register(wrapper.onSessionStart((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Session started: model=${e.data.selectedModel ?? "default"}, producer=${e.data.producer}`);
    }));
    this._register(wrapper.onSessionResume((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Session resumed: eventCount=${e.data.eventCount}`);
    }));
    this._register(wrapper.onSessionInfo((e) => {
      const attributes = { infoType: e.data.infoType };
      if (e.data.tip) {
        attributes.tip = e.data.tip;
      }
      const message = `[Copilot:${sessionId}] [${e.data.infoType}]: ${e.data.message}`;
      const otelData = new OtelData(attributes);
      if (e.data.infoType === "mcp") {
        this._logService.info(message, otelData);
      } else {
        this._logService.trace(message, otelData);
      }
    }));
    this._register(wrapper.onSessionWarning((e) => {
      this._logService.warn(`[Copilot:${sessionId}] ${e.data.message}`, new OtelData({ warningType: e.data.warningType }));
    }));
    this._register(wrapper.onSessionModelChange((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Model changed: ${e.data.previousModel ?? "(none)"} -> ${e.data.newModel}`);
      if (!e.agentId) {
        this._promptCacheRefreshGeneration++;
        if (e.data.previousModel !== e.data.newModel) {
          this._setPromptCacheState(void 0);
        }
        void this._refreshSessionUsageMetrics();
      }
    }));
    this._register(wrapper.onManagedSettingsResolved((e) => {
      this._logService.info(`[Copilot:${sessionId}] Managed settings resolved: source=${e.data.source}, managedKeys=${e.data.managedKeys.join(",") || "(none)"}, bypassPermissionsDisabled=${e.data.bypassPermissionsDisabled}, failClosed=${e.data.failClosed}`);
    }));
    this._register(wrapper.onManagedSettingsEnforced((e) => {
      this._logService.warn(`[Copilot:${sessionId}] Managed settings enforced: action=${e.data.action}, setting=${e.data.setting}, escalation=${e.data.escalation ?? "(none)"}, failClosed=${e.data.failClosed}, message=${e.data.message}`);
    }));
    this._register(wrapper.onSessionHandoff((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Session handoff: sourceType=${e.data.sourceType}, remoteSessionId=${e.data.remoteSessionId ?? "(none)"}`);
    }));
    this._register(wrapper.onSessionTruncation((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Session truncation: removed ${e.data.tokensRemovedDuringTruncation} tokens, ${e.data.messagesRemovedDuringTruncation} messages`);
    }));
    this._register(wrapper.onSessionSnapshotRewind((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Snapshot rewind: upTo=${e.data.upToEventId}, eventsRemoved=${e.data.eventsRemoved}`);
    }));
    this._register(wrapper.onSessionShutdown((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Session shutdown: type=${e.data.shutdownType}, apiDuration=${e.data.totalApiDurationMs}ms`);
    }));
    this._register(wrapper.onSessionUsageInfo((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Usage info: ${e.data.currentTokens}/${e.data.tokenLimit} tokens, ${e.data.messagesLength} messages`);
    }));
    this._register(wrapper.onSessionCompactionStart(() => {
      this._logService.trace(`[Copilot:${sessionId}] Compaction started`);
    }));
    this._register(wrapper.onSessionCompactionComplete((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Compaction complete: success=${e.data.success}, tokensRemoved=${e.data.tokensRemoved ?? "?"}`);
    }));
    this._register(wrapper.onUserMessage((e) => {
      this._logService.trace(`[Copilot:${sessionId}] User message: ${e.data.content.length} chars, ${e.data.attachments?.length ?? 0} attachments`);
      if (!e.agentId && (!e.data.source || e.data.source.toLowerCase() === "user")) {
        void this._telemetryReporter.userMessageText(this.sessionUri.toString(), this._currentTurn?.clientType ?? AgentHostClientType.Unknown, e.data.content, this._turnOrdinal).catch((err) => this._logService.trace(`[Copilot:${this.sessionId}] Telemetry emission failed: ${getErrorMessage(err)}`));
      }
    }));
    this._register(wrapper.onPendingMessagesModified(() => {
      this._logService.trace(`[Copilot:${sessionId}] Pending messages modified`);
    }));
    this._register(wrapper.onTurnStart((e) => {
      this._currentTurn?.markRunning();
      this._logService.trace(`[Copilot:${sessionId}] Turn started: ${e.data.turnId}`);
      if (!e.agentId) {
        const telemetryMessageId = this._currentTurn?.id ?? e.data.turnId;
        if (this._activeRepoInfoTurn?.telemetryMessageId === telemetryMessageId) {
          return;
        }
        this._cancelActiveRepoInfoTelemetry();
        const turn = {
          telemetryMessageId,
          cancelled: false,
          begin: Promise.resolve(void 0)
        };
        const isCurrent = () => !turn.cancelled && this._isLaunchTokenCurrent();
        turn.begin = this._beginRepoInfoTelemetry(telemetryMessageId, this._currentTurn?.clientType ?? AgentHostClientType.Unknown, isCurrent);
        this._activeRepoInfoTurn = turn;
      }
    }));
    this._register(wrapper.onIntent((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Intent: ${e.data.intent}`);
      const activity = e.data.intent || void 0;
      if (activity === void 0 && !this._hasActivity) {
        return;
      }
      this._hasActivity = activity !== void 0;
      this._emitAction({
        type: ActionType.SessionActivityChanged,
        activity
      });
    }));
    this._register(wrapper.onReasoning((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Reasoning: ${e.data.content.length} chars`);
    }));
    this._register(wrapper.onTurnEnd((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Turn ended: ${e.data.turnId}`);
    }));
    this._register(wrapper.onAbort((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Aborted: ${e.data.reason}`);
      this._cancelActiveRepoInfoTelemetry();
      if (this._currentTurn?.isRunning) {
        this._reportToolCallDetails(this._currentTurn, "cancelled");
      }
    }));
    this._register(wrapper.onToolUserRequested((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Tool user-requested: ${e.data.toolName} (${e.data.toolCallId})`);
    }));
    this._register(wrapper.onToolPartialResult((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Tool partial result: ${e.data.toolCallId} (${e.data.partialOutput.length} chars)`);
      const tracked = this._activeToolCalls.get(e.data.toolCallId);
      if (!tracked || !isShellTool(tracked.toolName)) {
        return;
      }
      if (this._shellManager?.getTerminalUriForToolCall(e.data.toolCallId)) {
        return;
      }
      const appended = this._nonPtyShellTerminals.append(e.data.toolCallId, e.data.partialOutput);
      if (appended?.created) {
        const { uri } = appended;
        tracked.content.push({
          type: ToolResultContentType.Terminal,
          resource: uri,
          title: tracked.displayName,
          isPty: false
        });
        this._emitAction({
          type: ActionType.ChatToolCallContentChanged,
          turnId: this._turnId,
          toolCallId: e.data.toolCallId,
          content: tracked.content
        }, tracked.parentToolCallId);
      }
    }));
    this._register(wrapper.onToolProgress((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Tool progress: ${e.data.toolCallId} - ${e.data.progressMessage}`);
    }));
    this._register(wrapper.onSkillInvoked((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Skill invoked: ${e.data.name} (${e.data.path})`);
    }));
    this._register(wrapper.onSubagentStarted((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Subagent started: ${e.data.agentName} (${e.data.agentDisplayName})`);
    }));
    this._register(wrapper.onSubagentCompleted((e) => {
      this._completeSubagentTurn(e.agentId, e.data.toolCallId);
      this._logService.trace(`[Copilot:${sessionId}] Subagent completed: ${e.data.agentName}`);
    }));
    this._register(wrapper.onSubagentFailed((e) => {
      this._completeSubagentTurn(e.agentId, e.data.toolCallId);
      this._logService.error(`[Copilot:${sessionId}] Subagent failed: ${e.data.agentName} - ${e.data.error}`);
    }));
    this._register(wrapper.onSubagentSelected((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Subagent selected: ${e.data.agentName}`);
    }));
    this._register(wrapper.onHookStart((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Hook started: ${e.data.hookType} (${e.data.hookInvocationId})`);
    }));
    this._register(wrapper.onHookEnd((e) => {
      this._logService.trace(`[Copilot:${sessionId}] Hook ended: ${e.data.hookType} (${e.data.hookInvocationId}), success=${e.data.success}`);
      if (e.data.hookType === "agentStop") {
        this._completeSubagentTurn(e.agentId);
      }
    }));
    this._register(wrapper.onSystemMessage((e) => {
      this._logService.trace(`[Copilot:${sessionId}] System message [${e.data.role}]: ${e.data.content.length} chars`);
    }));
  }
  // ---- SDK event ID tracking & truncation ---------------------------------
  /**
   * Returns the SDK event ID for the turn inserted after the given turn,
   * or `undefined` if it's the last turn.
   */
  getNextTurnEventId(turnId) {
    return this._databaseRef.object.getNextTurnEventId(turnId);
  }
  /**
   * Returns the SDK event ID associated with the given protocol turn.
   */
  getTurnEventId(turnId) {
    return this._databaseRef.object.getTurnEventId(turnId);
  }
  /**
   * Returns the SDK event ID of the earliest turn.
   */
  getFirstTurnEventId() {
    return this._databaseRef.object.getFirstTurnEventId();
  }
  /**
   * Truncates the session history via the SDK's RPC and cleans up
   * stale turns from the session database.
   *
   * @param eventId The SDK event ID at which to truncate. This event
   *        and all events after it are removed.
   * @param keepTurnId If provided, turns inserted after this turn are
   *        deleted from the DB. If omitted, all turns are deleted.
   */
  async truncateAtEventId(eventId, keepTurnId) {
    this._logService.info(`[Copilot:${this.sessionId}] Truncating via SDK RPC at eventId=${eventId}`);
    const result = await this._wrapper.session.rpc.history.truncate({ eventId });
    this._logService.info(`[Copilot:${this.sessionId}] SDK truncation removed ${result.eventsRemoved} events`);
    if (keepTurnId) {
      await this._databaseRef.object.deleteTurnsAfter(keepTurnId);
    } else {
      await this._databaseRef.object.deleteAllTurns();
    }
  }
  /**
   * Bulk-remaps turn IDs in this session's database.
   * Used after file-copying a source session's database for a fork.
   */
  async remapTurnIds(mapping) {
    await this._databaseRef.object.remapTurnIds(mapping);
  }
  // ---- cleanup ------------------------------------------------------------
  /**
   * Cancels every pending interaction for abort and dispose. This completes synchronously before any awaiter resumes, so ordering is not significant.
   */
  _cancelAllPendingInteractions() {
    this._cancelPendingAutoApprovals();
    this._denyPendingPermissions();
    this._cancelPendingUserInputs();
    this._cancelPendingElicitations();
    this._cancelPendingPlanReviews();
    this._cancelPendingMcpAuthRequests();
    this._cancelPendingMcpSamplings();
    this._cancelPendingClientToolCalls();
  }
  _cancelPendingAutoApprovals() {
    this._pendingAutoApprovals.denyAll(void 0);
    this._autoApprovals.clear();
  }
  _denyPendingPermissions() {
    for (const [toolCallId] of this._pendingPermissions.entries()) {
      this._deletePendingEditContent(toolCallId);
    }
    this._pendingPermissions.denyAll({ kind: "reject" });
    this._approvedDuplicablePermissionSignatures.clear();
  }
  /**
   * Removes any `pending-edit-content:` entries associated with a resolved
   * (approved, denied, or cancelled) permission request.
   */
  _deletePendingEditContent(toolCallId) {
    const uri = this._pendingEditContentUris.get(toolCallId);
    if (!uri) {
      return;
    }
    this._pendingEditContentUris.delete(toolCallId);
    this._fileService.del(uri).catch((err) => {
      this._logService.warn(`[Copilot:${this.sessionId}] Failed to delete pending edit content: ${uri.toString()}`, err);
    });
  }
  _cancelPendingUserInputs() {
    this._pendingUserInputs.denyAll({ response: ChatInputResponseKind.Cancel });
  }
  _cancelPendingElicitations() {
    this._pendingElicitations.denyAll({ response: ChatInputResponseKind.Cancel });
  }
  _cancelPendingPlanReviews() {
    this._pendingPlanReviews.denyAll({ approved: false });
  }
  _cancelPendingMcpSamplings() {
    const pending = Array.from(this._pendingMcpSamplings);
    this._pendingMcpSamplings.clear();
    for (const requestId of pending) {
      this._wrapper.session.rpc.mcp.cancelSamplingExecution({ requestId }).catch(() => {
      });
    }
  }
  _cancelPendingClientToolCalls() {
    this._pendingClientToolCalls.denyAll({ textResultForLlm: "Tool call cancelled: session ended", resultType: "failure", error: "Session ended" });
  }
};
CopilotAgentSession = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILogService),
  __decorateParam(3, ISessionDataService),
  __decorateParam(4, IFileService),
  __decorateParam(5, INativeEnvironmentService),
  __decorateParam(6, IAgentConfigurationService),
  __decorateParam(7, IAgentHostStateManager),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, ICopilotApiService),
  __decorateParam(10, IAgentHostOTelService)
], CopilotAgentSession);
function countUnifiedDiffLines(diff) {
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      added++;
    } else if (line.startsWith("-")) {
      removed++;
    }
  }
  if (added === 0 && removed === 0) {
    return void 0;
  }
  return { added, removed };
}
function readCopilotUsage(raw) {
  if (!raw || typeof raw !== "object") {
    return void 0;
  }
  const usage = raw.copilotUsage;
  if (!usage || typeof usage !== "object") {
    return void 0;
  }
  const totalNanoAiu = usage.totalNanoAiu;
  if (typeof totalNanoAiu !== "number" || !Number.isFinite(totalNanoAiu) || totalNanoAiu < 0) {
    return void 0;
  }
  return { ...usage, totalNanoAiu };
}
function toTokenCount(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
}
function normalizeQuotaSnapshots(raw) {
  if (!raw || typeof raw !== "object") {
    return void 0;
  }
  const result = {};
  let hasAny = false;
  for (const [quotaType, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const v = value;
    const resetDateRaw = v.resetDate;
    const resetDate = typeof resetDateRaw === "string" ? resetDateRaw : resetDateRaw instanceof Date ? resetDateRaw.toISOString() : void 0;
    result[quotaType] = {
      isUnlimitedEntitlement: typeof v.isUnlimitedEntitlement === "boolean" ? v.isUnlimitedEntitlement : void 0,
      entitlementRequests: typeof v.entitlementRequests === "number" ? v.entitlementRequests : void 0,
      usedRequests: typeof v.usedRequests === "number" ? v.usedRequests : void 0,
      remainingPercentage: typeof v.remainingPercentage === "number" ? v.remainingPercentage : void 0,
      overage: typeof v.overage === "number" ? v.overage : void 0,
      overageAllowedWithExhaustedQuota: typeof v.overageAllowedWithExhaustedQuota === "boolean" ? v.overageAllowedWithExhaustedQuota : void 0,
      resetDate
    };
    hasAny = true;
  }
  return hasAny ? result : void 0;
}
export {
  CopilotAgentSession
};
