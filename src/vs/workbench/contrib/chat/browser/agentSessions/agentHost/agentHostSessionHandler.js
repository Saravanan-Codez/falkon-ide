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
import { Delayer, disposableTimeout, raceCancellation } from "../../../../../../base/common/async.js";
import { decodeBase64, encodeBase64, VSBuffer } from "../../../../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { getErrorCode, isCancellationError } from "../../../../../../base/common/errors.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { getChatErrorDetailsFromMeta, getCopilotPlanFromEntitlement } from "../../../common/chatErrorMessages.js";
import { Disposable, DisposableMap, DisposableResourceMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../../../../base/common/map.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { equals } from "../../../../../../base/common/objects.js";
import { autorun, autorunPerKeyedItem, constObservable, derived, derivedOpts, observableValue, transaction } from "../../../../../../base/common/observable.js";
import { extUriBiasedIgnorePathCase, isEqual } from "../../../../../../base/common/resources.js";
import { StopWatch } from "../../../../../../base/common/stopwatch.js";
import { URI } from "../../../../../../base/common/uri.js";
import { generateUuid } from "../../../../../../base/common/uuid.js";
import { isLocation } from "../../../../../../editor/common/languages.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { localize } from "../../../../../../nls.js";
import { AgentSession, CODEX_AGENT_PROVIDER_ID } from "../../../../../../platform/agentHost/common/agentService.js";
import { agentHostAuthority } from "../../../../../../platform/agentHost/common/agentHostUri.js";
import { findDeepestContainingWorkingDirectory } from "../../../../../../platform/agentHost/common/agentHostWorkingDirectories.js";
import { AgentHostElementAttachmentDisplayKind, getElementAttachmentCorrelationId, toElementAttachmentMeta } from "../../../../../../platform/agentHost/common/meta/agentElementAttachments.js";
import { AgentFeedbackAttachmentDisplayKind, AgentFeedbackAttachmentMetadataKey } from "../../../../../../platform/agentHost/common/meta/agentFeedbackAttachments.js";
import { BrowserViewAttachmentDisplayKind, BrowserViewAttachmentMetadataKey } from "../../../../../../platform/agentHost/common/meta/browserViewAttachments.js";
import { readToolCallMeta } from "../../../../../../platform/agentHost/common/meta/agentToolCallMeta.js";
import { readCompletionAttachmentMeta } from "../../../../../../platform/agentHost/common/meta/agentCompletionAttachmentMeta.js";
import { IRemoteAgentHostService } from "../../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { SessionConfigKey } from "../../../../../../platform/agentHost/common/sessionConfigKeys.js";
import { CLIENT_TOOL_SEARCH_REFERENCE_NAME, RUNTIME_TOOL_SEARCH_TOOL_NAME } from "../../../../../../platform/agentHost/common/toolSearchConstants.js";
import { observableFromSubscription } from "../../../../../../platform/agentHost/common/state/agentSubscription.js";
import { CompletionItemKind as AhpCompletionItemKind, ContentEncoding } from "../../../../../../platform/agentHost/common/state/protocol/commands.js";
import { ConfirmationOptionKind, CustomizationType, McpServerStatus, SessionInputRequestKind, TerminalClaimKind, ToolCallContributorKind, ToolResultContentType } from "../../../../../../platform/agentHost/common/state/protocol/state.js";
import { ActionType, isChatAction } from "../../../../../../platform/agentHost/common/state/sessionActions.js";
import { AHP_AUTH_REQUIRED, ProtocolError } from "../../../../../../platform/agentHost/common/state/sessionProtocol.js";
import { buildSubagentChatUri, ChatOriginKind, getInlineToolInput, getToolSubagentContent, isChatReadOnly, MessageAttachmentKind, MessageKind, PendingMessageKind, ResponsePartKind, ChatInputAnswerState, ChatInputAnswerValueKind, ChatInputQuestionKind, ChatInputResponseKind, SessionStatus, StateComponents, ToolCallCancellationReason, ToolCallConfirmationReason, ToolCallStatus, TurnState, parseChatUri, mergeSessionWithDefaultChat, readUsageInfoMeta } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { ExtensionIdentifier } from "../../../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { packErrorForTelemetry } from "../../../../../../platform/telemetry/common/errorTelemetry.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { IPathService } from "../../../../../services/path/common/pathService.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustRequestService } from "../../../../../../platform/workspace/common/workspaceTrust.js";
import { IAgentHostTerminalService } from "../../../../terminal/browser/agentHostTerminalService.js";
import { ITerminalChatService } from "../../../../terminal/browser/terminal.js";
import {
  AgentHostCompletionReferenceKind,
  getAgentHostCompletionReferenceKind,
  isAgentFeedbackVariableEntry,
  isBrowserViewVariableEntry,
  isChatReferenceVariableEntry,
  isImageVariableEntry
} from "../../../common/attachments/chatVariableEntries.js";
import { coerceImageBuffer } from "../../../common/chatImageExtraction.js";
import { ChatRequestQueueKind, ElicitationState, IChatService, IChatToolInvocation, ToolConfirmKind } from "../../../common/chatService/chatService.js";
import { isTerminalCommandPrompt, SessionType } from "../../../common/chatSessionsService.js";
import { IChatEntitlementService } from "../../../../../services/chat/common/chatEntitlementService.js";
import { IWorkingCopyService } from "../../../../../services/workingCopy/common/workingCopyService.js";
import { ChatMode } from "../../../common/chatModes.js";
import { CHAT_SUBAGENT_RESOURCE_QUERY_PARAM, ChatAgentLocation, ChatConfiguration, ChatModeKind } from "../../../common/constants.js";
import { IChatEditingService } from "../../../common/editing/chatEditingService.js";
import { getLanguageModelDisplayNameWithProvider, ILanguageModelsService } from "../../../common/languageModels.js";
import { ChatInputStateOrigin, reviveSerializableInputState } from "../../../common/model/chatModel.js";
import { ChatElicitationRequestPart } from "../../../common/model/chatProgressTypes/chatElicitationRequestPart.js";
import { ChatToolInvocation } from "../../../common/model/chatProgressTypes/chatToolInvocation.js";
import { getChatSessionType, isUntitledChatSession } from "../../../common/model/chatUri.js";
import { IChatAgentService } from "../../../common/participants/chatAgents.js";
import { ILanguageModelToolsService, stringifyPromptTsxPart, ToolInvocationPresentation } from "../../../common/tools/languageModelToolsService.js";
import { IChatWidgetService } from "../../chat.js";
import { getAgentSessionProviderIcon } from "../agentSessions.js";
import { IAgentHostActiveClientService } from "./agentHostActiveClientService.js";
import { IAgentHostCustomizationService } from "./agentHostCustomizationService.js";
import { IAgentHostSessionWorkingDirectoryResolver } from "./agentHostSessionWorkingDirectoryResolver.js";
import { IAgentHostSessionWorkingDirectorySynchronizer } from "./agentHostSessionWorkingDirectorySynchronizer.js";
import { IAgentHostNewSessionFolderService, computeWorkingDirectories } from "./agentHostNewSessionFolderService.js";
import { AgentHostSnapshotController } from "./agentHostSnapshotController.js";
import { AgentHostResponseFileChangesProvider } from "./agentHostResponseFileChanges.js";
import { IChatResponseFileChangesService } from "../../chatResponseFileChangesService.js";
import { AgentHostSessionReferenceAttachmentDisplayKind, AgentHostSessionReferenceTrajectoryAttachmentDisplayKind, toSessionReferenceAttachmentMeta, toSessionReferenceModelRepresentation } from "./agentHostSessionReferenceAttachment.js";
import { buildHostLocalEventsPath } from "../../copilotCliEventsUri.js";
import { toolDataToDefinition } from "./agentHostToolUtils.js";
import { IAgentHostUntitledProvisionalSessionService } from "./agentHostUntitledProvisionalSessionService.js";
import { IAgentHostImportConversationStore } from "./agentHostImportConversationStore.js";
import { activeTurnToProgress, BOOLEAN_TRUE_OPTION_ID, completedToolCallToEditParts, completedToolCallToSerialized, containsAutomaticReplyAnswer, convertProtocolAnswers, convertProtocolPlanReviewResult, createInputRequestCarousel, createInputRequestPlanReview, finalizeToolInvocation, formatTurnResponseDetails, getTerminalContent, getUrlInputRequestPresentation, isSubagentTool, makeAhpTerminalToolSessionId, messageAttachmentsToVariableData, messageToVariableData, parseAhpTerminalToolSessionId, rewriteAgentHostLinkTarget, stringOrMarkdownToString, systemNotificationToChatPart, toolCallAuthenticationServer, toolCallStateToInvocation, toolCallStateToPreparedInvocation, toolCallStateToStreamingInvocation, turnsToHistory, updateRunningToolSpecificData, updateStreamingToolInvocation, usageInfoToAutoModeResolution, usageInfoToChatUsage, usageInfoToQuotas } from "./stateToProgressAdapter.js";
import { resolveMcpServerAuthentication, agentHostMcpServerId } from "./agentHostAuth.js";
const MAX_INLINED_UNSAVED_EDITOR_BYTES = 1024 * 1024;
const CHAT_ACTIVITY_PROGRESS_ID = "agentHost.chatActivity";
const UNOBSERVED_CLIENT_TOOL_GRACE_MS = 5e3;
function getMcpAuthenticationRequiredServers(sessionResource, state) {
  const servers = state?.customizations?.flatMap((c) => c.type === CustomizationType.McpServer ? [c] : c.children?.filter((c2) => c2.type === CustomizationType.McpServer) ?? []) ?? [];
  const toolAuthServerIds = new Set(state?.inputNeeded?.filter((request) => request.kind === SessionInputRequestKind.ToolAuthentication).map((request) => request.kind === SessionInputRequestKind.ToolAuthentication ? request.toolCall.contributor.customizationId : void 0).filter((id) => id !== void 0));
  return servers.filter((server) => server.enabled && server.state.kind === McpServerStatus.AuthRequired && !toolAuthServerIds.has(server.id)).map((server) => {
    const state2 = server.state;
    return {
      id: sessionResource.authority + "/" + server.id,
      name: server.name,
      resource: state2.resource.resource,
      oauthClient: state2.oauthClient,
      authorizationServers: state2.resource.authorization_servers,
      supportedScopes: state2.resource.scopes_supported,
      requiredScopes: state2.requiredScopes,
      reason: state2.reason
    };
  });
}
function parseTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : void 0;
}
function getSubagentTiming(state) {
  const turns = state.activeTurn ? [...state.turns, state.activeTurn] : state.turns;
  const starts = turns.map((turn) => turn.startedAt ? Date.parse(turn.startedAt) : void 0).filter((timestamp) => timestamp !== void 0 && Number.isFinite(timestamp));
  const startedAt = starts.length > 0 ? Math.min(...starts) : void 0;
  if (startedAt === void 0 || state.activeTurn) {
    return { startedAt, duration: void 0 };
  }
  const ends = state.turns.flatMap((turn) => {
    const turnStartedAt = turn.startedAt ? Date.parse(turn.startedAt) : void 0;
    return turnStartedAt !== void 0 && Number.isFinite(turnStartedAt) && typeof turn.duration === "number" && Number.isFinite(turn.duration) ? [turnStartedAt + Math.max(0, turn.duration)] : [];
  });
  const endedAt = ends.length > 0 ? Math.max(...ends) : void 0;
  return { startedAt, duration: endedAt !== void 0 ? Math.max(0, endedAt - startedAt) : void 0 };
}
function userOriginMessage(text, attachments) {
  return attachments?.length ? { text, origin: { kind: MessageKind.User }, attachments: [...attachments] } : { text, origin: { kind: MessageKind.User } };
}
function unwrapSessionLoadErrorMessage(err) {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : void 0;
  if (!message) {
    return void 0;
  }
  return message.replace(/^Failed to restore session .+?: /, "");
}
function lastTurnModelSelection(state) {
  return lastTurnMessage(state)?.model;
}
function isFirstVisibleProgressPart(part) {
  return part.kind === "markdownContent" || part.kind === "thinking" || part.kind === "toolInvocation";
}
function lastTurnMessage(state) {
  return state?.activeTurn?.message ?? (state && state.turns.length ? state.turns[state.turns.length - 1].message : void 0);
}
function emptyDraftFromLastTurn(state) {
  const message = lastTurnMessage(state);
  if (!message?.model && !message?.agent) {
    return void 0;
  }
  return {
    text: "",
    origin: { kind: MessageKind.User },
    ...message.model ? { model: message.model } : {},
    ...message.agent ? { agent: message.agent } : {}
  };
}
function sameDraftUserContent(a, b) {
  return (a?.text ?? "") === (b?.text ?? "") && equals(a?.attachments, b?.attachments);
}
function confirmedReasonToProtocol(reason) {
  switch (reason?.type) {
    case ToolConfirmKind.ConfirmationNotNeeded:
      return ToolCallConfirmationReason.NotNeeded;
    case ToolConfirmKind.Setting:
    case ToolConfirmKind.LmServicePerTool:
      return ToolCallConfirmationReason.Setting;
    default:
      return ToolCallConfirmationReason.UserAction;
  }
}
function getClientToolPreApproval(toolCall) {
  if (readToolCallMeta(toolCall).autoApproveBySetting === true) {
    return { type: ToolConfirmKind.Setting, id: SessionConfigKey.AutoApprove };
  }
  switch (toolCall.status) {
    case ToolCallStatus.Running:
    case ToolCallStatus.AuthRequired:
      switch (toolCall.confirmed) {
        case ToolCallConfirmationReason.NotNeeded:
          return { type: ToolConfirmKind.ConfirmationNotNeeded };
        case ToolCallConfirmationReason.Setting:
          return { type: ToolConfirmKind.Setting, id: SessionConfigKey.AutoApprove };
        case ToolCallConfirmationReason.UserAction:
          return { type: ToolConfirmKind.UserAction };
      }
  }
  return void 0;
}
function metaWithoutToolSearchCandidates(source) {
  const meta = { ...source._meta };
  delete meta["toolSearchCandidates"];
  return meta;
}
async function resolveToolInput(connection, toolInput) {
  if (toolInput === void 0) {
    return "{}";
  }
  if (typeof toolInput === "string") {
    return toolInput;
  }
  const result = await connection.resourceRead(URI.parse(toolInput.uri));
  return result.encoding === ContentEncoding.Base64 ? decodeBase64(result.data).toString() : result.data;
}
function convertCarouselAnswers(raw, questions = []) {
  const answers = {};
  const questionKinds = new Map(questions.map((question) => [question.id, question.kind]));
  for (const [qId, answer] of Object.entries(raw)) {
    if (typeof answer === "string") {
      answers[qId] = {
        state: ChatInputAnswerState.Submitted,
        value: { kind: ChatInputAnswerValueKind.Text, value: answer }
      };
    } else if (answer && typeof answer === "object") {
      const multi = answer;
      const single = answer;
      if (Array.isArray(multi.selectedValues)) {
        answers[qId] = {
          state: ChatInputAnswerState.Submitted,
          value: {
            kind: ChatInputAnswerValueKind.SelectedMany,
            value: multi.selectedValues,
            freeformValues: multi.freeformValue ? [multi.freeformValue] : void 0
          }
        };
      } else if (single.selectedValue && questionKinds.get(qId) === ChatInputQuestionKind.Boolean) {
        answers[qId] = {
          state: ChatInputAnswerState.Submitted,
          value: {
            kind: ChatInputAnswerValueKind.Boolean,
            value: single.selectedValue === BOOLEAN_TRUE_OPTION_ID
          }
        };
      } else if (single.selectedValue) {
        answers[qId] = {
          state: ChatInputAnswerState.Submitted,
          value: {
            kind: ChatInputAnswerValueKind.Selected,
            value: single.selectedValue,
            freeformValues: single.freeformValue ? [single.freeformValue] : void 0
          }
        };
      } else if (single.freeformValue) {
        answers[qId] = {
          state: ChatInputAnswerState.Submitted,
          value: { kind: ChatInputAnswerValueKind.Text, value: single.freeformValue }
        };
      }
    }
  }
  return answers;
}
function getPlanReviewAction(planReview, actionId, actionLabel) {
  if (actionId) {
    const action = planReview.actions.find((a) => a.id === actionId);
    if (action) {
      return action;
    }
  }
  if (actionLabel) {
    return planReview.actions.find((a) => a.label === actionLabel);
  }
  return void 0;
}
function submittedTextAnswer(value) {
  return {
    state: ChatInputAnswerState.Submitted,
    value: { kind: ChatInputAnswerValueKind.Text, value }
  };
}
function submittedSelectedAnswer(value, feedback) {
  return {
    state: ChatInputAnswerState.Submitted,
    value: {
      kind: ChatInputAnswerValueKind.Selected,
      value,
      ...feedback ? { freeformValues: [feedback] } : {}
    }
  };
}
function convertPlanReviewResult(planReview, result) {
  const feedback = result.feedback?.trim();
  if (feedback) {
    const action2 = getPlanReviewAction(planReview, result.actionId, result.action);
    return {
      response: ChatInputResponseKind.Accept,
      answers: {
        [planReview.answerQuestionId]: action2 ? submittedSelectedAnswer(action2.id, feedback) : submittedTextAnswer(feedback)
      }
    };
  }
  if (result.rejected) {
    return { response: ChatInputResponseKind.Decline };
  }
  const action = getPlanReviewAction(planReview, result.actionId, result.action);
  if (!action) {
    return { response: ChatInputResponseKind.Decline };
  }
  return {
    response: ChatInputResponseKind.Accept,
    answers: {
      [planReview.answerQuestionId]: submittedSelectedAnswer(action.id)
    }
  };
}
function inputRequestResponsePartKey(part) {
  return `ir:${part.request.id}:${JSON.stringify({ ...part.request, answers: void 0 })}`;
}
let AgentHostChatSession = class extends Disposable {
  constructor(sessionResource, history, title, sessionSubscription, chatSubscription, _promptCacheNotification, _forkSession, _renameSession, inputState, initialProgress, historySubagentObservations, onDispose, interruptActiveResponse, _logService) {
    super();
    this.sessionResource = sessionResource;
    this.history = history;
    this.title = title;
    this._promptCacheNotification = _promptCacheNotification;
    this._forkSession = _forkSession;
    this._renameSession = _renameSession;
    this._logService = _logService;
    this.progressObs = observableValue("agentHostProgress", []);
    this.isCompleteObs = observableValue("agentHostComplete", true);
    this._sessionState = observableValue(this, constObservable(void 0));
    this._chatState = observableValue(this, constObservable(void 0));
    this._promptCacheTracking = this._register(new MutableDisposable());
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this._onDidStartServerRequest = this._register(new Emitter());
    this.onDidStartServerRequest = this._onDidStartServerRequest.event;
    this.setStateSubscriptions(sessionSubscription, chatSubscription);
    this.isReadOnly = derived(this, (reader) => {
      const sessionArchived = Boolean((this._sessionState.read(reader).read(reader)?.status ?? 0) & SessionStatus.IsArchived);
      return isChatReadOnly(this._chatState.read(reader).read(reader)?.interactivity, sessionArchived);
    });
    const hasActiveTurn = initialProgress !== void 0;
    this.transferredState = inputState ? { editingSession: void 0, inputState } : void 0;
    if (hasActiveTurn) {
      this.isCompleteObs.set(false, void 0);
      this.progressObs.set(initialProgress, void 0);
    }
    this._register(historySubagentObservations);
    this._register(toDisposable(onDispose));
    this.interruptActiveResponseCallback = async () => interruptActiveResponse();
    this.forkSession = this._forkSession;
    this.renameSession = this._renameSession;
  }
  setStateSubscriptions(sessionSubscription, chatSubscription) {
    this._promptCacheTracking.clear();
    this._promptCacheTracking.value = sessionSubscription ? this._promptCacheNotification?.trackSession(this.sessionResource, sessionSubscription) : void 0;
    transaction((tx) => {
      this._sessionState.set(sessionSubscription ? observableFromSubscription(this, sessionSubscription) : constObservable(void 0), tx);
      this._chatState.set(chatSubscription ? observableFromSubscription(this, chatSubscription) : constObservable(void 0), tx);
    });
  }
  dispose() {
    if (!this._store.isDisposed) {
      this._onWillDispose.fire();
    }
    super.dispose();
  }
  /**
   * Registers a disposable to be cleaned up when this session is disposed.
   */
  registerDisposable(disposable) {
    return this._register(disposable);
  }
  /**
   * Appends new progress items to the observable. Used by the reconnection
   * flow to stream ongoing state changes into the chat UI.
   */
  appendProgress(items) {
    const current = this.progressObs.get();
    this.progressObs.set([...current, ...items], void 0);
  }
  /**
   * Marks the active turn as complete.
   */
  complete() {
    this.isCompleteObs.set(true, void 0);
  }
  /**
   * Called by the session handler when a server-initiated turn starts.
   * Resets the progress observable and signals listeners to create a new
   * request+response pair in the chat model. `turnId` is the provider's turn
   * id and is adopted as the chat request id, so features that address a turn
   * by request id (side chats, forks) can resolve it against the host.
   */
  startServerRequest(turnId, prompt, variableData, options) {
    this._logService.info("[AgentHost] Server-initiated request started");
    transaction((tx) => {
      this.progressObs.set([], tx);
      this.isCompleteObs.set(false, tx);
    });
    this._onDidStartServerRequest.fire({
      id: turnId,
      prompt,
      variableData,
      isSystemInitiated: options?.isSystemInitiated,
      timestamp: options?.timestamp,
      isTerminalRequest: options?.isTerminalRequest
    });
  }
};
AgentHostChatSession = __decorateClass([
  __decorateParam(13, ILogService)
], AgentHostChatSession);
function offsetToPosition(text, offset) {
  let lineNumber = 1;
  let column = 1;
  const limit = Math.min(offset, text.length);
  for (let i = 0; i < limit; i++) {
    if (text.charCodeAt(i) === 10) {
      lineNumber++;
      column = 1;
    } else {
      column++;
    }
  }
  return { lineNumber, column };
}
let AgentHostSessionHandler = class extends Disposable {
  constructor(config, _chatAgentService, _chatService, _chatEditingService, _logService, _workspaceContextService, _instantiationService, _terminalChatService, _agentHostTerminalService, _workingDirectoryResolver, _workingDirectorySynchronizer, _newSessionFolderService, _provisionalService, _importConversationStore, _toolsService, _chatWidgetService, _languageModelsService, _openerService, _activeClientService, _chatEntitlementService, _workspaceTrustRequestService, _modelService, _workingCopyService, _configurationService, _chatResponseFileChangesService, _pathService, _remoteAgentHostService, _customizationService, _telemetryService) {
    super();
    this._chatAgentService = _chatAgentService;
    this._chatService = _chatService;
    this._chatEditingService = _chatEditingService;
    this._logService = _logService;
    this._workspaceContextService = _workspaceContextService;
    this._instantiationService = _instantiationService;
    this._terminalChatService = _terminalChatService;
    this._agentHostTerminalService = _agentHostTerminalService;
    this._workingDirectoryResolver = _workingDirectoryResolver;
    this._workingDirectorySynchronizer = _workingDirectorySynchronizer;
    this._newSessionFolderService = _newSessionFolderService;
    this._provisionalService = _provisionalService;
    this._importConversationStore = _importConversationStore;
    this._toolsService = _toolsService;
    this._chatWidgetService = _chatWidgetService;
    this._languageModelsService = _languageModelsService;
    this._openerService = _openerService;
    this._activeClientService = _activeClientService;
    this._chatEntitlementService = _chatEntitlementService;
    this._workspaceTrustRequestService = _workspaceTrustRequestService;
    this._modelService = _modelService;
    this._workingCopyService = _workingCopyService;
    this._configurationService = _configurationService;
    this._chatResponseFileChangesService = _chatResponseFileChangesService;
    this._pathService = _pathService;
    this._remoteAgentHostService = _remoteAgentHostService;
    this._customizationService = _customizationService;
    this._telemetryService = _telemetryService;
    this._activeSessions = new ResourceMap();
    this._chatURIsBySessionResource = new ResourceMap();
    /** Per-session subscription to chat model pending request changes. */
    this._pendingMessageSubscriptions = this._register(new DisposableResourceMap());
    this._remotePendingMessageProjections = new ResourceSet();
    /** Per-session debounced sync from chat input state to AHP draft state. */
    this._draftSyncSubscriptions = this._register(new DisposableResourceMap());
    /** Per-session subscription watching for server-initiated turns. */
    this._serverTurnWatchers = this._register(new DisposableResourceMap());
    /** Per-session subscription silently resolving existing MCP authentication grants. */
    this._mcpAuthWatchers = this._register(new DisposableResourceMap());
    /**
     * Ownership of actionable protocol requests, keyed by backend session URI
     * string. `inputNeeded` is a session-level queue and the single caller of
     * {@link invokeTool} for client tools, so it must be handled exactly once
     * per backend session no matter how many sibling chat resources (default
     * chat, peer chats, subagent chats) are open against it. Each such resource
     * holds a reference; the shared watcher stays alive while any reference
     * remains and is disposed only when the last one is released.
     */
    this._inputNeededWatchers = /* @__PURE__ */ new Map();
    /**
     * Backend session each open resource's {@link _inputNeededWatchers}
     * reference belongs to, recorded when the reference is installed. Teardown
     * uses this to release the right reference without re-deriving the backend
     * session via {@link _resolveSessionUri}, whose provisional mapping may
     * already be cleared by then.
     */
    this._inputNeededWatcherBackends = new ResourceMap();
    /** One-shot per-session subscription reconciling client data after session state hydration. */
    this._activeClientRefreshSubscriptions = this._register(new DisposableResourceMap());
    /** Historical turns with file edits, pending hydration into the editing session. */
    this._pendingHistoryTurns = new ResourceMap();
    /**
     * Requests a turn observer is currently rendering, keyed by
     * {@link _toolCallKey} for tool calls and {@link _inputRequestKey} for chat
     * input requests (the two key shapes differ in arity, so they cannot
     * collide). The value is the claiming observer's session resource, which
     * the session-level responder uses as the chat context when it executes a
     * client tool so the tool runs against the chat that is actually rendering
     * it. The session-level responder defers to those observers so the inline
     * UI stays in charge of answering.
     */
    this._renderedRequests = observableValue(this, /* @__PURE__ */ new Map());
    /** Tool calls whose protocol outcome has already been dispatched. */
    this._resolvedToolCalls = /* @__PURE__ */ new Set();
    /**
     * A single {@link ChatToolInvocation} per client tool call, keyed by
     * {@link _toolCallKey}. Created lazily by whichever of the session-level
     * watcher or the turn observer arrives first, so both act on one object:
     * the observer renders it while the watcher executes it. Entries are
     * dropped once the call resolves so a later call with the same ids is not
     * mistaken for it.
     */
    this._clientToolInvocations = /* @__PURE__ */ new Map();
    /**
     * Live `inputNeeded` requests per tool call, keyed by {@link _toolCallKey}.
     * One tool call is represented by a succession of requests — a confirmation
     * is replaced by a client execution once approved — so the shared state
     * above is only released when the last of them goes away.
     */
    this._clientToolRetainCounts = /* @__PURE__ */ new Map();
    /**
     * Per-session set of MCP server ids that already had an authentication
     * prompt surfaced in the current conversation. A server is removed from the
     * set once it reaches the running state ({@link McpServerStatus.Ready}), so
     * that a later auth requirement for the same server prompts again instead of
     * the prompt repeating on every message.
     */
    this._surfacedMcpAuthServers = new ResourceMap();
    this._pendingMcpAutoAuthentication = /* @__PURE__ */ new Map();
    /** Turn IDs dispatched by this client, used to distinguish server-originated turns. */
    this._clientDispatchedTurnIds = /* @__PURE__ */ new Set();
    this._turnStopWatches = /* @__PURE__ */ new Map();
    /** Active session subscriptions, keyed by backend session URI string. */
    this._sessionSubscriptions = /* @__PURE__ */ new Map();
    /**
     * Working-directory synchronizer registrations, keyed by session URI. Each
     * lives exactly as long as that session's {@link _sessionSubscriptions} entry.
     */
    this._workingDirectoryRegistrations = this._register(new DisposableMap());
    /**
     * Active default-chat subscriptions, keyed by backend session URI string.
     * Multi-chat is not yet surfaced: every session is served by a single
     * implicit default chat that carries the conversation contents (turns,
     * active turn, pending/queued messages, input requests). We subscribe to
     * it alongside the session and merge both into the {@link ISessionWithDefaultChat}
     * view returned by {@link _getSessionState}.
     */
    this._defaultChatSubscriptions = /* @__PURE__ */ new Map();
    /**
     * Active subscriptions for additional (non-default) peer chats, keyed by
     * the chat channel URI string. Populated when a chat widget is opened for
     * a resource that carries a chatId fragment.
     */
    this._additionalChatSubscriptions = /* @__PURE__ */ new Map();
    /**
     * Backend session URIs with an in-flight {@link provideChatSessionContent}
     * call, keyed by session URI string with a refcount value. While a chat is
     * still hydrating its subscriptions, a sibling chat of the same session
     * closing must not tear down the shared session subscription out from under
     * it (see {@link _releaseChatSessionSubscriptions} / {@link _hasOtherSessionHold}).
     */
    this._hydratingChatSessions = /* @__PURE__ */ new Map();
    this._config = config;
    this._register(toDisposable(() => {
      for (const { store } of this._inputNeededWatchers.values()) {
        store.dispose();
      }
      this._inputNeededWatchers.clear();
      this._inputNeededWatcherBackends.clear();
    }));
    this._register(this._customizationService.onDidChangeCustomizations(() => this._reconcileSurfacedMcpAuthServers()));
    this._register(autorun((reader) => {
      const defs = this._activeClientService.getClientTools(this._config.sessionType).read(reader);
      const clientId = this._config.connection.clientId;
      for (const [sessionResource] of this._activeSessions) {
        const backendSession = this._resolveSessionUri(sessionResource);
        const state = this._getSessionState(backendSession.toString());
        const existing = state?.activeClients.find((c) => c.clientId === clientId);
        if (existing) {
          this._dispatchAction(backendSession, {
            type: ActionType.SessionActiveClientSet,
            activeClient: { ...existing, tools: [...defs] }
          });
        }
      }
    }));
    this._register(this._terminalChatService.onDidContinueInBackground((terminalToolSessionId) => {
      const parsed = parseAhpTerminalToolSessionId(terminalToolSessionId);
      if (!parsed) {
        return;
      }
      this._logService.info(`[AgentHost] Continue in background: terminal=${parsed.terminal}, session=${parsed.session}`);
      this._config.connection.dispatch(parsed.terminal, {
        type: ActionType.TerminalClaimed,
        claim: {
          kind: TerminalClaimKind.Session,
          session: parsed.session
        }
      });
    }));
    this._register(this._chatEditingService.registerEditingSessionProvider(
      config.sessionType,
      {
        createEditingSession: (chatSessionResource) => {
          return this._instantiationService.createInstance(
            AgentHostSnapshotController,
            chatSessionResource,
            config.connectionAuthority
          );
        }
      }
    ));
    this._register(this._chatResponseFileChangesService.registerProvider(
      config.sessionType,
      this._register(new AgentHostResponseFileChangesProvider(
        config.connection,
        config.connectionAuthority,
        (sessionResource) => this._resolveSessionUri(sessionResource)
      ))
    ));
    const customizationsObs = this._activeClientService.getCustomizations(config.sessionType);
    this._register(autorun((reader) => {
      const refs = customizationsObs.read(reader);
      const clientId = this._config.connection.clientId;
      for (const [sessionResource] of this._activeSessions) {
        const backendSession = this._resolveSessionUri(sessionResource);
        const state = this._getSessionState(backendSession.toString());
        const existing = state?.activeClients.find((c) => c.clientId === clientId);
        if (existing && !equals(existing.customizations ?? [], refs)) {
          this._dispatchActiveClient(backendSession, [...refs]);
        }
      }
    }));
    this._registerAgent();
  }
  static {
    this.DRAFT_SYNC_DEBOUNCE_MS = 500;
  }
  /**
   * Resolves the signed-in user's plan context for chat error formatting.
   * The agent host does not know the user's plan, so quota/rate-limit
   * messages are personalized here from `IChatEntitlementService`.
   */
  _chatErrorContext() {
    const quotas = this._chatEntitlementService.quotas;
    return {
      copilotPlan: getCopilotPlanFromEntitlement(this._chatEntitlementService.entitlement),
      isUsageBasedBilling: quotas.usageBasedBilling,
      quotaResetDate: quotas.resetDate
    };
  }
  async provideChatInputCompletions(sessionResource, params, token) {
    let backendSession;
    if (isUntitledChatSession(sessionResource)) {
      const provisionalSession = await raceCancellation(this._provisionalService.waitForPending(sessionResource), token);
      if (token.isCancellationRequested) {
        return void 0;
      }
      if (!provisionalSession) {
        return void 0;
      }
      backendSession = provisionalSession;
    } else {
      backendSession = this._resolveSessionUri(sessionResource);
    }
    const result = await this._config.connection.completions({
      kind: AhpCompletionItemKind.UserMessage,
      channel: backendSession.toString(),
      text: params.text,
      offset: params.offset
    });
    if (token.isCancellationRequested) {
      return void 0;
    }
    const items = [];
    for (const raw of result.items) {
      const mapped = this._toChatInputCompletionItem(raw, params.text);
      if (mapped) {
        items.push(mapped);
      }
    }
    return { items };
  }
  provideChatInputCompletionTriggerCharacters() {
    return this._config.connection.getCompletionTriggerCharacters();
  }
  _createCompletionItem(raw, text, attachment, label) {
    const item = {
      insertText: raw.insertText,
      attachment
    };
    if (label !== void 0) {
      item.label = label;
    }
    if (raw.rangeStart !== void 0) {
      item.start = offsetToPosition(text, raw.rangeStart);
    }
    if (raw.rangeEnd !== void 0) {
      item.end = offsetToPosition(text, raw.rangeEnd);
    }
    return item;
  }
  _toChatInputCompletionItem(raw, text) {
    const attachment = raw.attachment;
    switch (attachment.type) {
      case MessageAttachmentKind.Simple: {
        const completionMeta = readCompletionAttachmentMeta(attachment);
        if (completionMeta?.kind === "command") {
          return this._createCompletionItem(raw, text, {
            kind: "command",
            command: completionMeta.command,
            description: completionMeta.description ?? "",
            ...attachment._meta !== void 0 && { _meta: attachment._meta }
          }, attachment.label !== raw.insertText ? attachment.label : void 0);
        }
        if (completionMeta?.kind === "skill") {
          return this._createCompletionItem(raw, text, {
            kind: "skill",
            uri: URI.parse(completionMeta.uri),
            ...completionMeta.displayName !== void 0 ? { displayName: completionMeta.displayName } : {},
            ...completionMeta.description !== void 0 ? { description: completionMeta.description } : {},
            ...attachment._meta !== void 0 && { _meta: attachment._meta }
          });
        }
        return void 0;
      }
      case MessageAttachmentKind.Resource: {
        const uri = typeof attachment.uri === "string" ? URI.parse(attachment.uri) : URI.from(attachment.uri);
        return this._createCompletionItem(raw, text, {
          kind: "resource",
          uri,
          displayName: attachment.label,
          isDirectory: attachment.displayKind === "directory",
          ...attachment._meta !== void 0 && { _meta: attachment._meta }
        });
      }
      case MessageAttachmentKind.Chat: {
        return this._createCompletionItem(raw, text, {
          kind: "chat",
          uri: URI.parse(attachment.resource),
          endTurn: attachment.endTurn,
          title: attachment.label,
          displayName: attachment.label,
          ...attachment._meta !== void 0 && { _meta: attachment._meta }
        });
      }
      default:
        return void 0;
    }
  }
  async provideChatSessionContent(sessionResource, token) {
    if (sessionResource.path.substring(1).startsWith("untitled-")) {
      throw new Error(`Agent host chat sessions must be created by the sessions provider: ${sessionResource.toString()}`);
    }
    const resolvedSession = this._resolveSessionUri(sessionResource);
    let chatURI;
    const isNewSession = this._isNewSessionResource(sessionResource);
    const history = [];
    let initialProgress;
    let initialResponsePartCount = 0;
    let activeTurnId;
    let sessionTitle;
    let draftInputState;
    let sessionSubscription;
    let chatSubscription;
    const historySubagentObservations = new DisposableStore();
    const hydrationKey = resolvedSession.toString();
    this._hydratingChatSessions.set(hydrationKey, (this._hydratingChatSessions.get(hydrationKey) ?? 0) + 1);
    try {
      if (!isNewSession) {
        try {
          const sub = this._ensureSessionSubscription(resolvedSession.toString());
          sessionSubscription = sub;
          await this._whenSubscriptionHydrated(sub, token);
          if (sub.value instanceof Error) {
            throw sub.value;
          }
          const rawState = this._getRawSessionState(resolvedSession.toString());
          if (!rawState) {
            throw new Error(`Session state did not hydrate for ${resolvedSession.toString()}`);
          }
          chatURI = this._resolveChatUriFromState(sessionResource, rawState);
          this._setChatURI(sessionResource, chatURI);
          const chatSub = this._ensureChatSubscription(resolvedSession.toString(), chatURI);
          chatSubscription = chatSub;
          await this._whenSubscriptionHydrated(chatSub, token);
          const sessionState = this._getSessionState(resolvedSession.toString(), chatURI);
          if (sessionState) {
            sessionTitle = sessionState.title;
            const draft = sessionState.draft ?? emptyDraftFromLastTurn(sessionState);
            draftInputState = this._draftToInputState(sessionResource, draft);
            if (!sessionState.draft && draft) {
              this._config.connection.dispatch(chatURI, { type: ActionType.ChatDraftChanged, draft });
            }
            const fallbackRawModelId = lastTurnModelSelection(sessionState)?.id;
            const lookup = this._createTurnModelLookup(sessionResource, fallbackRawModelId);
            history.push(...turnsToHistory(
              resolvedSession,
              sessionState.turns,
              this._config.agentId,
              this._config.connectionAuthority,
              lookup,
              this._chatErrorContext(),
              this._config.connection.initializeResult.get()?.terminalCommandPrefix
            ));
            await this._enrichHistoryWithSubagentCalls(history, resolvedSession, sessionResource, sessionState, historySubagentObservations);
            if (sessionState.turns.length > 0) {
              this._pendingHistoryTurns.set(sessionResource, sessionState.turns);
            }
            if (sessionState.activeTurn) {
              activeTurnId = sessionState.activeTurn.id;
              const activeRawModelId = sessionState.activeTurn.usage?.model ?? fallbackRawModelId;
              history.push({
                id: sessionState.activeTurn.id,
                type: "request",
                prompt: sessionState.activeTurn.message.text,
                participant: this._config.agentId,
                modelId: lookup.toLanguageModelId(activeRawModelId),
                timestamp: parseTimestamp(sessionState.activeTurn.startedAt),
                variableData: messageToVariableData(sessionState.activeTurn.message, this._config.connectionAuthority),
                isSystemInitiated: sessionState.activeTurn.message.origin.kind === MessageKind.SystemNotification
              });
              history.push({
                type: "response",
                parts: [],
                participant: this._config.agentId,
                details: lookup.toResponseDetails(activeRawModelId, sessionState.activeTurn.usage)
              });
              initialProgress = activeTurnToProgress(
                resolvedSession,
                sessionState.activeTurn,
                this._config.connectionAuthority,
                sessionResource.authority,
                this._otherClientToolInvocationOptions(resolvedSession, chatURI, sessionState.activeTurn.id),
                lookup
              );
              initialResponsePartCount = sessionState.activeTurn.responseParts.length;
              const actualModelId = this._toLanguageModelId(sessionResource, sessionState.activeTurn.usage?.model);
              if (actualModelId) {
                for (const p of initialProgress) {
                  if (p.kind === "usage") {
                    p.actualModelId = actualModelId;
                  }
                }
              }
              this._logService.info(`[AgentHost] Reconnecting to active turn ${activeTurnId} for session ${resolvedSession.toString()}`);
            }
          }
        } catch (err) {
          this._logService.warn(`[AgentHost] Failed to subscribe to existing session: ${resolvedSession.toString()}`, err);
          if (history.length === 0) {
            history.push({
              type: "request",
              prompt: "",
              participant: this._config.agentId,
              isSystemInitiated: true,
              systemInitiatedLabel: localize("agentHost.sessionLoadFailedLabel", "Couldn't open session")
            });
            history.push({
              type: "response",
              parts: [],
              participant: this._config.agentId,
              errorDetails: { message: unwrapSessionLoadErrorMessage(err) ?? localize("agentHost.sessionLoadFailed", "This session couldn't be loaded.") }
            });
          }
        }
      }
    } finally {
      const remaining = (this._hydratingChatSessions.get(hydrationKey) ?? 1) - 1;
      if (remaining > 0) {
        this._hydratingChatSessions.set(hydrationKey, remaining);
      } else {
        this._hydratingChatSessions.delete(hydrationKey);
      }
    }
    const session = this._instantiationService.createInstance(
      AgentHostChatSession,
      sessionResource,
      history,
      sessionTitle,
      sessionSubscription,
      chatSubscription,
      this._config.promptCacheNotification,
      (request, token2) => {
        if (!this._getSessionState(resolvedSession.toString())) {
          throw new Error("Cannot fork session before the initial request");
        }
        return this._forkSession(sessionResource, resolvedSession, request, token2);
      },
      (title, _token) => {
        this._config.connection.dispatch(resolvedSession.toString(), {
          type: ActionType.SessionTitleChanged,
          title
        });
        return Promise.resolve();
      },
      draftInputState,
      initialProgress,
      historySubagentObservations,
      () => {
        this._activeSessions.delete(sessionResource);
        this._activeClientRefreshSubscriptions.deleteAndDispose(sessionResource);
        this._pendingMessageSubscriptions.deleteAndDispose(sessionResource);
        this._draftSyncSubscriptions.deleteAndDispose(sessionResource);
        this._serverTurnWatchers.deleteAndDispose(sessionResource);
        this._mcpAuthWatchers.deleteAndDispose(sessionResource);
        this._releaseSessionInputNeeded(sessionResource);
        this._pendingHistoryTurns.delete(sessionResource);
        this._surfacedMcpAuthServers.delete(sessionResource);
        const chatURI2 = this._chatURIsBySessionResource.get(sessionResource);
        this._chatURIsBySessionResource.delete(sessionResource);
        if (chatURI2) {
          this._releaseChatSessionSubscriptions(resolvedSession.toString(), chatURI2);
        }
      },
      () => {
        const sessionKey = resolvedSession.toString();
        const chatURI2 = this._chatURIsBySessionResource.get(sessionResource);
        if (!chatURI2) {
          return true;
        }
        const turnId = this._getSessionState(sessionKey, chatURI2)?.activeTurn?.id;
        if (!turnId) {
          return true;
        }
        this._logService.info(`[AgentHost] Cancellation requested for ${sessionKey}, dispatching turnCancelled`);
        this._config.connection.dispatch(chatURI2, {
          type: ActionType.ChatTurnCancelled,
          turnId,
          duration: this._turnDuration(chatURI2, turnId)
        });
        return true;
      }
    );
    this._activeSessions.set(sessionResource, session);
    if (sessionSubscription) {
      this._ensureActiveClientRefreshSubscription(sessionResource, resolvedSession, sessionSubscription);
    }
    if (!isNewSession) {
      if (chatURI !== void 0) {
        this._ensurePendingMessageSubscription(sessionResource, resolvedSession);
        this._ensureDraftSyncSubscription(sessionResource, resolvedSession, chatURI);
      }
      if (this._pendingHistoryTurns.has(sessionResource)) {
        if (this._chatService.getSession(sessionResource)) {
          this._ensureSnapshotController(sessionResource);
        } else {
          const sub = this._chatService.onDidCreateModel((model) => {
            if (isEqual(model.sessionResource, sessionResource)) {
              sub.dispose();
              this._ensureSnapshotController(sessionResource);
            }
          });
          session.registerDisposable(sub);
        }
      }
      if (activeTurnId && initialProgress !== void 0) {
        this._reconnectToActiveTurn(resolvedSession, activeTurnId, session, initialProgress, initialResponsePartCount);
      }
      if (chatURI !== void 0) {
        this._watchForServerInitiatedTurns(resolvedSession, sessionResource);
      }
    }
    return session;
  }
  // ---- Agent registration -------------------------------------------------
  _registerAgent() {
    const agentData = {
      id: this._config.agentId,
      name: this._config.agentId,
      fullName: this._config.fullName,
      description: this._config.description,
      extensionId: new ExtensionIdentifier(this._config.extensionId ?? "vscode.agent-host"),
      extensionVersion: void 0,
      extensionPublisherId: "vscode",
      extensionDisplayName: this._config.extensionDisplayName ?? "Agent Host",
      isDefault: false,
      isDynamic: true,
      isCore: true,
      metadata: { themeIcon: getAgentSessionProviderIcon(this._config.sessionType) },
      slashCommands: [],
      locations: [ChatAgentLocation.Chat],
      modes: [ChatModeKind.Agent],
      disambiguation: []
    };
    const agentImpl = {
      invoke: async (request, progress, _history, cancellationToken) => {
        return this._invokeAgent(request, progress, cancellationToken);
      }
    };
    this._register(this._chatAgentService.registerDynamicAgent(agentData, agentImpl));
  }
  async _invokeAgent(request, progress, cancellationToken) {
    this._logService.info(`[AgentHost] _invokeAgent called for resource: ${request.sessionResource.toString()}`);
    if (!await this._ensureWorkspaceTrust(request.sessionResource)) {
      return {};
    }
    const preparingStatus = new MutableDisposable();
    let failureStage = "resolveSession";
    try {
      failureStage = "provisionalSession";
      await raceCancellation(this._provisionalService.waitForPending(request.sessionResource), cancellationToken);
      if (cancellationToken.isCancellationRequested) {
        return {};
      }
      const resolvedSession = this._resolveSessionUri(request.sessionResource);
      const sessionKey = resolvedSession.toString();
      const provisionalBackend = this._provisionalService.get(request.sessionResource);
      if (provisionalBackend) {
        this._ensureSessionSubscription(sessionKey);
      }
      failureStage = "sessionState";
      const existingState = await this._readEagerlyCreatedSessionState(resolvedSession, cancellationToken);
      if (cancellationToken.isCancellationRequested) {
        return {};
      }
      if (!existingState) {
        const imported = this._importConversationStore.take(request.sessionResource);
        if (imported) {
          preparingStatus.value = disposableTimeout(() => {
            progress([{ kind: "progressMessage", content: new MarkdownString(localize("agentHost.preparingSession", "Preparing session\u2026")), shimmer: true }]);
          }, 500);
        }
        const model = imported?.model ?? this._createModelSelection(request.userSelectedModelId, request.modelConfiguration);
        const initialConfig = {
          ...this._provisionalService.getInitialSessionConfig(),
          ...request.agentHostSessionConfig
        };
        await this._createAndSubscribe(
          request.sessionResource,
          model,
          void 0,
          Object.keys(initialConfig).length > 0 ? initialConfig : void 0,
          imported ? { turns: imported.turns, model: imported.model } : void 0,
          (stage) => failureStage = stage
        );
      } else {
        failureStage = "authentication";
        await this._ensureRequiredAuthentication();
        failureStage = "subscribeSession";
        const sessionSub = this._ensureSessionSubscription(sessionKey);
        const chatURI = this._resolveChatUriFromState(request.sessionResource, existingState);
        this._setChatURI(request.sessionResource, chatURI);
        const chatSub = this._ensureChatSubscription(sessionKey, chatURI);
        this._activeSessions.get(request.sessionResource)?.setStateSubscriptions(sessionSub, chatSub);
        this._ensurePendingMessageSubscription(request.sessionResource, resolvedSession);
        this._watchForServerInitiatedTurns(resolvedSession, request.sessionResource);
        if (request.agentHostSessionConfig && Object.keys(request.agentHostSessionConfig).length > 0) {
          this._dispatchAction(resolvedSession, {
            type: ActionType.SessionConfigChanged,
            config: request.agentHostSessionConfig
          });
        }
      }
      const stopWatch = StopWatch.create(false);
      let firstProgress;
      const measuredProgress = (parts) => {
        preparingStatus.clear();
        if (firstProgress === void 0 && parts.some(isFirstVisibleProgressPart)) {
          firstProgress = stopWatch.elapsed();
        }
        progress(parts);
      };
      failureStage = "prepareTurn";
      const completedTurn = await this._handleTurn(resolvedSession, request, measuredProgress, cancellationToken, (stage) => failureStage = stage);
      const details = this._getTurnResponseDetails(request.sessionResource, resolvedSession, completedTurn);
      const errorDetails = this._getTurnErrorDetails(completedTurn);
      return {
        timings: { firstProgress, totalElapsed: stopWatch.elapsed() },
        ...details ? { details } : {},
        ...errorDetails ? { errorDetails } : {}
      };
    } catch (error) {
      if (!isCancellationError(error)) {
        this._reportInvocationFailure(request, failureStage, error);
      }
      throw error;
    } finally {
      preparingStatus.dispose();
    }
  }
  _reportInvocationFailure(request, failureStage, error) {
    const packed = packErrorForTelemetry(error);
    const requests = this._chatService.getSession(request.sessionResource)?.getRequests();
    this._telemetryService.publicLogError2("agentHost.invocationFailed", {
      requestId: request.requestId,
      provider: this._config.provider,
      failureStage,
      isFirstRequest: requests?.[0]?.id === request.requestId,
      hasUserSelectedModel: request.userSelectedModelId !== void 0,
      errorName: error instanceof Error ? error.name : typeof error,
      errorCode: getErrorCode(error),
      msg: packed.msg,
      callstack: packed.callstack
    });
  }
  /**
   * Builds the {@link IChatResponseErrorDetails} for a failed turn so the
   * chat response renders a proper error (and, for quota errors, the upgrade
   * affordance via `ChatQuotaExceededPart`). Returns `undefined` for
   * non-error turns. Falls back to the raw error when no structured chat
   * error was forwarded in `_meta`.
   */
  _getTurnErrorDetails(turn) {
    if (turn?.state !== TurnState.Error || !turn.error) {
      return void 0;
    }
    return getChatErrorDetailsFromMeta(turn.error, this._chatErrorContext()) ?? { message: localize("agentHost.turnError", "Error: ({0}) {1}", turn.error.errorType, turn.error.message) };
  }
  /**
   * Returns the {@link SessionState} for a session that was eagerly created
   * at folder-pick time, or `undefined` if no such session exists. Uses the
   * unmanaged subscription accessor so we don't accidentally open a fresh
   * subscription (which would issue a duplicate snapshot fetch on the wire,
   * and in tests would synthesise placeholder state via the mock's auto-
   * hydration path).
   *
   * If the eager subscription exists but hasn't received its first snapshot
   * yet (creation in flight), waits for it to hydrate or error before
   * returning. This closes a race where the chat request arrives between
   * `createSession` resolving and the snapshot landing.
   */
  async _readEagerlyCreatedSessionState(resolvedSession, token) {
    const inflight = this._config.connection.getInflightSessionCreate?.(resolvedSession);
    if (inflight) {
      try {
        await inflight;
      } catch {
      }
      if (token.isCancellationRequested) {
        return void 0;
      }
    }
    const sub = this._config.connection.getSubscriptionUnmanaged(StateComponents.Session, resolvedSession);
    if (!sub) {
      return void 0;
    }
    if (sub.value !== void 0) {
      return sub.value instanceof Error ? void 0 : sub.value;
    }
    const pinRef = this._config.connection.getSubscription(StateComponents.Session, resolvedSession, "AgentHostSessionHandler");
    try {
      await this._whenSubscriptionHydrated(pinRef.object, token);
      const value = pinRef.object.value;
      this._logService.info(`[AgentHost] _readEagerlyCreatedSessionState: hydrated value=${value === void 0 ? "undefined" : value instanceof Error ? `error(${value.message})` : "state"} cancelled=${token.isCancellationRequested} for ${resolvedSession.toString()}`);
      return value instanceof Error ? void 0 : value;
    } finally {
      pinRef.dispose();
    }
  }
  // ---- Pending message sync -----------------------------------------------
  /**
   * Diffs the chat model's pending requests against the protocol state in
   * `_clientState` and dispatches Set/Removed/Reordered actions as needed.
   */
  _syncPendingMessages(sessionResource, backendSession) {
    if (this._remotePendingMessageProjections.has(sessionResource)) {
      return;
    }
    const chatModel = this._chatService.getSession(sessionResource);
    if (!chatModel) {
      return;
    }
    const session = backendSession.toString();
    const chatURI = this._getChatURI(sessionResource);
    const pending = chatModel.getPendingRequests();
    const protocolState = this._getSessionState(session, chatURI);
    const prevSteering = protocolState?.steeringMessage;
    const prevQueued = protocolState?.queuedMessages ?? [];
    let currentSteering;
    const currentQueued = [];
    for (const p of pending) {
      const variables = p.request.variableData?.variables ?? [];
      const messageAttachments = this._variableEntriesToAttachments(variables, sessionResource, p.request.message.text);
      const attachments = messageAttachments.length > 0 ? messageAttachments : void 0;
      const snapshot = { id: p.request.id, message: userOriginMessage(p.request.message.text, attachments) };
      if (p.kind === ChatRequestQueueKind.Steering) {
        currentSteering = snapshot;
      } else {
        currentQueued.push(snapshot);
      }
    }
    if (currentSteering) {
      if (currentSteering.id !== prevSteering?.id || !equals(currentSteering.message, prevSteering.message)) {
        this._dispatchAction(backendSession, {
          type: ActionType.ChatPendingMessageSet,
          kind: PendingMessageKind.Steering,
          id: currentSteering.id,
          message: currentSteering.message
        }, chatURI);
      }
    } else if (prevSteering) {
      this._dispatchAction(backendSession, {
        type: ActionType.ChatPendingMessageRemoved,
        kind: PendingMessageKind.Steering,
        id: prevSteering.id
      }, chatURI);
    }
    const currentQueuedIds = new Set(currentQueued.map((q) => q.id));
    for (const prev of prevQueued) {
      if (!currentQueuedIds.has(prev.id)) {
        this._dispatchAction(backendSession, {
          type: ActionType.ChatPendingMessageRemoved,
          kind: PendingMessageKind.Queued,
          id: prev.id
        }, chatURI);
      }
    }
    const prevQueuedById = new Map(prevQueued.map((q) => [q.id, q]));
    for (const q of currentQueued) {
      const prev = prevQueuedById.get(q.id);
      if (!prev || !equals(q.message, prev.message)) {
        this._dispatchAction(backendSession, {
          type: ActionType.ChatPendingMessageSet,
          kind: PendingMessageKind.Queued,
          id: q.id,
          message: q.message
        }, chatURI);
      }
    }
    const updatedProtocol = this._getSessionState(session, chatURI);
    const updatedQueued = updatedProtocol?.queuedMessages ?? [];
    if (updatedQueued.length > 1 && currentQueued.length === updatedQueued.length) {
      const needsReorder = currentQueued.some((q, i) => q.id !== updatedQueued[i].id);
      if (needsReorder) {
        this._dispatchAction(backendSession, {
          type: ActionType.ChatQueuedMessagesReordered,
          order: currentQueued.map((q) => q.id)
        }, chatURI);
      }
    }
  }
  /**
   * Projects protocol pending messages into the chat model.
   * The protocol is authoritative, so matching local state is a no-op.
   */
  _applyRemotePendingMessages(sessionResource, backendSession) {
    if (!this._chatService.getSession(sessionResource)) {
      return;
    }
    const chatURI = this._chatURIsBySessionResource.get(sessionResource);
    if (!chatURI) {
      return;
    }
    const state = this._getSessionState(backendSession.toString(), chatURI);
    if (!state) {
      return;
    }
    const toRemote = (pending, kind) => ({
      id: pending.id,
      kind,
      message: pending.message.text,
      variableData: messageToVariableData(pending.message, this._config.connectionAuthority)
    });
    const remote = [];
    if (state.steeringMessage) {
      remote.push(toRemote(state.steeringMessage, ChatRequestQueueKind.Steering));
    }
    for (const queued of state.queuedMessages ?? []) {
      remote.push(toRemote(queued, ChatRequestQueueKind.Queued));
    }
    this._remotePendingMessageProjections.add(sessionResource);
    try {
      this._chatService.syncPendingRequestsFromRemote(sessionResource, remote);
    } finally {
      this._remotePendingMessageProjections.delete(sessionResource);
    }
  }
  _dispatchAction(channel, action, chatURI) {
    const target = isChatAction(action) ? this._requireChatURI(chatURI, action.type) : channel.toString();
    this._config.connection.dispatch(target, action);
  }
  _requireChatURI(chatURI, actionType) {
    if (!chatURI) {
      throw new Error(`Cannot dispatch ${actionType} without a resolved AHP chat channel`);
    }
    return chatURI;
  }
  _resolveChatUriFromState(sessionResource, state) {
    if (sessionResource.fragment) {
      const explicitChatUri = new URLSearchParams(sessionResource.query).get(CHAT_SUBAGENT_RESOURCE_QUERY_PARAM);
      if (explicitChatUri) {
        const parsed = parseChatUri(explicitChatUri);
        if (!parsed || parsed.chatId !== sessionResource.fragment) {
          throw new Error(`Subagent chat URI does not match editor chat '${sessionResource.fragment}'`);
        }
        const owningSession = URI.parse(parsed.session);
        const expectedSession = this._resolveSessionUri(sessionResource);
        if (!isEqual(owningSession, expectedSession)) {
          throw new Error(`Subagent chat belongs to ${owningSession.toString()}, expected ${expectedSession.toString()}`);
        }
        return explicitChatUri;
      }
      const match = state.chats.find((summary) => parseChatUri(summary.resource)?.chatId === sessionResource.fragment);
      if (!match) {
        throw new Error(`Cannot resolve chat '${sessionResource.fragment}' from session state for ${sessionResource.toString()}`);
      }
      return match.resource.toString();
    }
    if (!state.defaultChat) {
      throw new Error(`Session ${sessionResource.toString()} has no default chat`);
    }
    return state.defaultChat.toString();
  }
  _setChatURI(sessionResource, chatURI) {
    this._chatURIsBySessionResource.set(sessionResource, chatURI);
  }
  _getChatURI(sessionResource) {
    const chatURI = this._chatURIsBySessionResource.get(sessionResource);
    if (!chatURI) {
      throw new Error(`No AHP chat URI mapped for ${sessionResource.toString()}`);
    }
    return chatURI;
  }
  _getCurrentActiveClient() {
    return this._activeClientService.getActiveClient(this._config.sessionType, this._config.connection.clientId);
  }
  _ensureActiveClient(backendSession) {
    const state = this._getSessionState(backendSession.toString());
    const activeClient = this._getCurrentActiveClient();
    const existing = state?.activeClients.find((c) => c.clientId === activeClient.clientId);
    if (equals(existing, activeClient)) {
      return;
    }
    this._dispatchAction(backendSession, {
      type: ActionType.SessionActiveClientSet,
      activeClient
    });
  }
  /** Refreshes this client's data once it appears in hydrated state without claiming another client's session. */
  _ensureActiveClientRefreshSubscription(sessionResource, backendSession, sessionSubscription) {
    if (this._activeClientRefreshSubscriptions.has(sessionResource)) {
      return;
    }
    const refresh = () => {
      const state = this._getSessionState(backendSession.toString());
      const activeClient = this._getCurrentActiveClient();
      const existing = state?.activeClients.find((c) => c.clientId === activeClient.clientId);
      if (!existing) {
        return;
      }
      this._activeClientRefreshSubscriptions.deleteAndDispose(sessionResource);
      if (!equals(existing, activeClient)) {
        this._dispatchAction(backendSession, {
          type: ActionType.SessionActiveClientSet,
          activeClient
        });
      }
    };
    this._activeClientRefreshSubscriptions.set(sessionResource, sessionSubscription.onDidChange(refresh));
    refresh();
  }
  /**
   * Dispatches `session/activeClientSet` to add this connection as an
   * active client for this session and publish the current customizations
   * and client-provided tools. This client never removes itself.
   */
  _dispatchActiveClient(backendSession, customizations) {
    const current = this._getCurrentActiveClient();
    this._dispatchAction(backendSession, {
      type: ActionType.SessionActiveClientSet,
      activeClient: { ...current, customizations }
    });
  }
  // ---- Server-initiated turn detection ------------------------------------
  /**
   * Sets up a persistent listener on the session's protocol state that
   * detects server-initiated turns (e.g. auto-consumed queued messages).
   * When a new `activeTurn` appears whose `turnId` was NOT dispatched by
   * this client, it signals the {@link AgentHostChatSession} to create a
   * new request in the chat model, removes the consumed pending request
   * if applicable, and pipes turn progress through `progressObs`.
   */
  _watchForServerInitiatedTurns(backendSession, sessionResource) {
    const sessionStr = backendSession.toString();
    const chatURI = this._getChatURI(sessionResource);
    this._watchForMcpAuthentication(backendSession, sessionResource, chatURI);
    this._watchForSessionInputNeeded(backendSession, sessionResource);
    const currentState = this._getSessionState(sessionStr, chatURI);
    let lastSeenTurnId = currentState?.activeTurn?.id;
    let previousQueuedIds;
    let previousSteeringId = currentState?.steeringMessage?.id;
    let previousTitle = currentState?.title;
    const disposables = new DisposableStore();
    const turnProgressDisposable = new MutableDisposable();
    disposables.add(turnProgressDisposable);
    const sessionSub = this._ensureSessionSubscription(sessionStr);
    const chatSub = this._ensureChatSubscription(sessionStr, chatURI);
    const onChange = () => {
      const state = this._getSessionState(sessionStr, chatURI);
      if (!state) {
        return;
      }
      const e = { session: sessionStr, state };
      const currentQueuedIds = new Set((e.state.queuedMessages ?? []).map((m) => m.id));
      const currentSteeringId = e.state.steeringMessage?.id;
      if (previousSteeringId && previousSteeringId !== currentSteeringId) {
        this._chatService.removePendingRequest(sessionResource, previousSteeringId);
      }
      previousSteeringId = currentSteeringId;
      const currentTitle = e.state.title;
      if (currentTitle && currentTitle !== previousTitle) {
        this._chatService.setChatSessionTitle(sessionResource, currentTitle);
      }
      previousTitle = currentTitle;
      const activeTurn = e.state.activeTurn;
      if (!activeTurn || activeTurn.id === lastSeenTurnId) {
        previousQueuedIds = currentQueuedIds;
        return;
      }
      lastSeenTurnId = activeTurn.id;
      if (this._clientDispatchedTurnIds.has(activeTurn.id)) {
        previousQueuedIds = currentQueuedIds;
        return;
      }
      const chatSession = this._activeSessions.get(sessionResource);
      if (!chatSession) {
        previousQueuedIds = currentQueuedIds;
        return;
      }
      this._logService.info(`[AgentHost] Server-initiated turn detected: ${activeTurn.id}`);
      if (previousQueuedIds) {
        for (const prevId of previousQueuedIds) {
          if (!currentQueuedIds.has(prevId)) {
            this._chatService.removePendingRequest(sessionResource, prevId);
          }
        }
      }
      previousQueuedIds = currentQueuedIds;
      chatSession.startServerRequest(
        activeTurn.id,
        activeTurn.message.text,
        messageToVariableData(activeTurn.message, this._config.connectionAuthority),
        {
          isSystemInitiated: activeTurn.message.origin.kind === MessageKind.SystemNotification,
          timestamp: parseTimestamp(activeTurn.startedAt),
          isTerminalRequest: isTerminalCommandPrompt(activeTurn.message.text, this._config.connection.initializeResult.get()?.terminalCommandPrefix)
        }
      );
      const turnStore = new DisposableStore();
      turnProgressDisposable.value = turnStore;
      this._trackServerTurnProgress(backendSession, activeTurn.id, chatSession, turnStore);
    };
    disposables.add(sessionSub.onDidChange(onChange));
    disposables.add(chatSub.onDidChange(onChange));
    this._serverTurnWatchers.set(sessionResource, disposables);
  }
  _watchForMcpAuthentication(backendSession, sessionResource, chatURI) {
    const sessionSub = this._ensureSessionSubscription(backendSession.toString());
    let previousServers;
    const reconcile = () => {
      const servers = getMcpAuthenticationRequiredServers(sessionResource, this._getSessionState(backendSession.toString(), chatURI));
      if (equals(previousServers, servers)) {
        return;
      }
      previousServers = servers;
      void this._filterAutoGrantedMcpAuthentication(sessionResource, servers);
    };
    const disposables = new DisposableStore();
    disposables.add(sessionSub.onDidChange(reconcile));
    reconcile();
    this._mcpAuthWatchers.set(sessionResource, disposables);
  }
  _watchForSessionInputNeeded(backendSession, sessionResource) {
    this._inputNeededWatcherBackends.set(sessionResource, backendSession);
    const sessionKey = backendSession.toString();
    const existing = this._inputNeededWatchers.get(sessionKey);
    if (existing) {
      existing.refs.add(sessionResource.toString());
      return;
    }
    const sessionSub = this._ensureSessionSubscription(sessionKey);
    const state = observableFromSubscription(this, sessionSub);
    const store = new DisposableStore();
    this._inputNeededWatchers.set(sessionKey, { store, refs: /* @__PURE__ */ new Set([sessionResource.toString()]) });
    const requests = derivedOpts({ equalsFn: equals }, (reader) => (state.read(reader)?.inputNeeded ?? []).filter((request) => request.kind === SessionInputRequestKind.ChatInput || request.kind === SessionInputRequestKind.ToolConfirmation || request.kind === SessionInputRequestKind.ToolClientExecution || request.kind === SessionInputRequestKind.ToolAuthentication));
    store.add(autorunPerKeyedItem(requests, (request) => request.id, (_requestId, request$, itemStore) => {
      const initial = request$.get();
      const chatURI = initial.chat.toString();
      if (initial.kind === SessionInputRequestKind.ChatInput) {
        const inputKey = this._inputRequestKey(chatURI, initial.request.id);
        let cancelled = false;
        itemStore.add(disposableTimeout(() => {
          if (cancelled || this._renderedRequests.get().has(inputKey)) {
            return;
          }
          cancelled = true;
          this._logService.warn(`[AgentHost] Cancelling chat input request ${initial.request.id}: no session claimed it within ${UNOBSERVED_CLIENT_TOOL_GRACE_MS}ms`);
          this._dispatchAction(backendSession, {
            type: ActionType.ChatInputCompleted,
            requestId: initial.request.id,
            response: ChatInputResponseKind.Cancel
          }, chatURI);
        }, UNOBSERVED_CLIENT_TOOL_GRACE_MS));
        return;
      }
      const key = this._toolCallKey(chatURI, initial.turnId, initial.toolCall.toolCallId);
      const cts = new CancellationTokenSource();
      itemStore.add(toDisposable(() => cts.dispose(true)));
      itemStore.add(this._retainToolCall(key));
      if (initial.kind === SessionInputRequestKind.ToolClientExecution) {
        if (initial.clientId !== this._config.connection.clientId) {
          return;
        }
        let generation = 0;
        let observedRequest;
        let startedRequest;
        let invocationStarted = false;
        const unobservedTimer = itemStore.add(new MutableDisposable());
        itemStore.add(autorun((reader) => {
          const request = request$.read(reader);
          const claimant = this._renderedRequests.read(reader).get(key);
          if (request.kind !== SessionInputRequestKind.ToolClientExecution || request.clientId !== this._config.connection.clientId) {
            generation++;
            observedRequest = void 0;
            startedRequest = void 0;
            invocationStarted = false;
            unobservedTimer.clear();
            return;
          }
          if (!equals(observedRequest, request)) {
            observedRequest = request;
            if (invocationStarted) {
              return;
            }
            generation++;
            startedRequest = void 0;
            unobservedTimer.clear();
          }
          if (startedRequest) {
            return;
          }
          if (request.toolCall.toolName === RUNTIME_TOOL_SEARCH_TOOL_NAME && readToolCallMeta(request.toolCall).toolSearchCandidates === void 0) {
            return;
          }
          const execute = (contextSessionResource) => {
            startedRequest = request;
            unobservedTimer.clear();
            const requestGeneration = generation;
            void this._executeClientTool(
              request,
              contextSessionResource,
              cts.token,
              () => requestGeneration === generation && (invocationStarted || equals(request$.read(void 0), request)),
              () => {
                if (requestGeneration === generation) {
                  invocationStarted = true;
                }
              }
            );
          };
          if (claimant) {
            execute(claimant);
          } else if (!this._clientToolRequiresConfirmation(request.toolCall)) {
            execute(void 0);
          } else if (!unobservedTimer.value) {
            const requestGeneration = generation;
            unobservedTimer.value = disposableTimeout(() => {
              if (requestGeneration === generation && !startedRequest) {
                startedRequest = request;
                this._denyClientTool(request);
              }
            }, UNOBSERVED_CLIENT_TOOL_GRACE_MS);
          }
        }));
      } else if (initial.kind === SessionInputRequestKind.ToolAuthentication) {
        itemStore.add(disposableTimeout(() => {
          if (!this._renderedRequests.get().has(key)) {
            this._logService.warn(`[AgentHost] Cancelling MCP authentication for ${initial.toolCall.toolName} (callId=${initial.toolCall.toolCallId}): no session claimed it within ${UNOBSERVED_CLIENT_TOOL_GRACE_MS}ms`);
            this._resolveToolCall(chatURI, initial.turnId, initial.toolCall.toolCallId, {
              type: ActionType.ChatToolCallComplete,
              turnId: initial.turnId,
              toolCallId: initial.toolCall.toolCallId,
              result: {
                success: false,
                pastTenseMessage: localize("agentHost.mcpToolAuthentication.cancelled", "Cancelled tool call"),
                error: { message: localize("agentHost.mcpToolAuthentication.cancelledError", "MCP authentication was cancelled"), code: "cancelled" }
              }
            });
          }
        }, UNOBSERVED_CLIENT_TOOL_GRACE_MS));
      } else {
        itemStore.add(disposableTimeout(() => {
          if (!this._renderedRequests.get().has(key)) {
            this._logService.warn(`[AgentHost] Denying confirmation for ${initial.toolCall.toolName} (callId=${initial.toolCall.toolCallId}): no session claimed it within ${UNOBSERVED_CLIENT_TOOL_GRACE_MS}ms`);
            this._resolveToolCall(chatURI, initial.turnId, initial.toolCall.toolCallId, {
              type: ActionType.ChatToolCallConfirmed,
              turnId: initial.turnId,
              toolCallId: initial.toolCall.toolCallId,
              approved: false,
              reason: ToolCallCancellationReason.Denied
            });
          }
        }, UNOBSERVED_CLIENT_TOOL_GRACE_MS));
      }
    }));
  }
  /**
   * Releases this resource's reference to the shared per-backend-session
   * {@link _watchForSessionInputNeeded} watcher, disposing it only once the
   * last sibling resource has let go.
   */
  _releaseSessionInputNeeded(sessionResource) {
    const backendSession = this._inputNeededWatcherBackends.get(sessionResource);
    this._inputNeededWatcherBackends.delete(sessionResource);
    if (!backendSession) {
      return;
    }
    const sessionKey = backendSession.toString();
    const entry = this._inputNeededWatchers.get(sessionKey);
    if (!entry) {
      return;
    }
    entry.refs.delete(sessionResource.toString());
    if (entry.refs.size === 0) {
      this._inputNeededWatchers.delete(sessionKey);
      entry.store.dispose();
    }
  }
  /**
   * Holds the shared state for a tool call while an `inputNeeded` request
   * references it. Once the host stops asking — the request disappears, or the
   * watcher is disposed — the outcome is settled, so the dispatch-funnel entry
   * and the shared invocation are dropped and a later call with the same ids
   * is never mistaken for this one.
   */
  _retainToolCall(key) {
    this._clientToolRetainCounts.set(key, (this._clientToolRetainCounts.get(key) ?? 0) + 1);
    return toDisposable(() => {
      const remaining = (this._clientToolRetainCounts.get(key) ?? 1) - 1;
      if (remaining > 0) {
        this._clientToolRetainCounts.set(key, remaining);
        return;
      }
      this._clientToolRetainCounts.delete(key);
      this._forgetResolvedToolCall(key);
      this._clientToolInvocations.delete(key);
    });
  }
  /**
   * Returns the shared {@link ChatToolInvocation} for a client tool call,
   * creating it on first use via {@link ILanguageModelToolsService.beginToolCall}.
   * `sessionResource` is deliberately omitted so `beginToolCall` does not
   * append progress into a chat model (which throws once the owning request
   * is complete); it still registers the invocation, so a later `invokeTool`
   * with a matching `chatStreamToolCallId` attaches to this same object. The
   * observer that renders the call and the watcher that executes it therefore
   * act on one invocation.
   */
  _ensureClientToolInvocation(chatURI, turnId, toolCallId, toolId, subagentInvocationId) {
    const key = this._toolCallKey(chatURI, turnId, toolCallId);
    const existing = this._clientToolInvocations.get(key);
    if (existing) {
      return existing;
    }
    const invocation = this._toolsService.beginToolCall({
      toolCallId,
      toolId,
      subagentInvocationId,
      sessionResource: void 0,
      force: true
    });
    if (invocation) {
      this._clientToolInvocations.set(key, invocation);
    }
    return invocation;
  }
  /**
   * Whether an unclaimed client tool must wait for a rendering observer
   * before running. There is no protocol field for this, so we use the tool's
   * static {@link IToolData.canRequestPreApproval} signal: a tool that might
   * ask for pre-approval could pop a confirmation, which only makes sense
   * inside a live chat request. Limitation: this is a "might" signal — a tool
   * may set it yet auto-approve at runtime — so an unclaimed such tool is
   * conservatively made to wait (and denied on timeout) rather than risk a
   * headless modal nobody can answer. Only consulted for the unclaimed case;
   * a claimed call always runs with context regardless.
   */
  _clientToolRequiresConfirmation(toolCall) {
    const clientToolName = toolCall.toolName === RUNTIME_TOOL_SEARCH_TOOL_NAME ? CLIENT_TOOL_SEARCH_REFERENCE_NAME : toolCall.toolName;
    return this._toolsService.getToolByName(clientToolName)?.canRequestPreApproval === true;
  }
  /**
   * The one place a client tool is actually invoked. Ensures the shared
   * invocation exists, parses the protocol input (preserving the tool-search
   * candidate handling), invokes the tool, and dispatches the protocol
   * completion. `contextSessionResource` is set when a turn observer is
   * rendering the call: a live chat request then exists, so confirmation
   * renders in the tool part, any pre-approval is honored, and side effects
   * attribute to that observer's chat. Without it the tool runs headlessly,
   * independent of whether the owning turn is live.
   */
  async _executeClientTool(request, contextSessionResource, token, isCurrent, markInvocationStarted) {
    const chatURI = request.chat.toString();
    const toolCall = request.toolCall;
    const toolName = toolCall.toolName;
    const isToolSearch = toolName === RUNTIME_TOOL_SEARCH_TOOL_NAME;
    const clientToolName = isToolSearch ? CLIENT_TOOL_SEARCH_REFERENCE_NAME : toolName;
    const toolData = this._toolsService.getToolByName(clientToolName);
    const completionMeta = isToolSearch ? { _meta: metaWithoutToolSearchCandidates(toolCall) } : {};
    const invocation = toolData ? this._ensureClientToolInvocation(chatURI, request.turnId, toolCall.toolCallId, toolData.id, void 0) : void 0;
    const fail = (message, code) => {
      const pastTenseMessage = localize("agentHost.clientTool.pastTense", "Couldn't run {0}", toolCall.displayName);
      const result2 = {
        content: [],
        toolResultError: message,
        toolResultMessage: pastTenseMessage
      };
      void invocation?.didExecuteTool(result2);
      this._resolveToolCall(chatURI, request.turnId, toolCall.toolCallId, {
        type: ActionType.ChatToolCallComplete,
        turnId: request.turnId,
        toolCallId: toolCall.toolCallId,
        result: {
          success: false,
          pastTenseMessage,
          error: { message, code }
        },
        ...completionMeta
      });
    };
    if (!toolData) {
      fail(localize("agentHost.clientTool.unknown", 'Tool "{0}" is not available on this client.', toolName), "toolUnavailable");
      return;
    }
    if (!invocation) {
      fail(localize("agentHost.clientTool.beginFailed", 'Could not create invocation for client tool "{0}".', toolName), "invocationFailed");
      return;
    }
    const toolInput = "toolInput" in toolCall ? toolCall.toolInput : void 0;
    let rawInput;
    try {
      rawInput = await resolveToolInput(this._config.connection, toolInput);
    } catch (error2) {
      if (!isCurrent() || token.isCancellationRequested) {
        return;
      }
      const message = error2 instanceof Error ? error2.message : String(error2);
      this._logService.warn(`[AgentHost] Failed to read client tool input: ${toolName}`, error2);
      fail(message, "inputReadFailed");
      return;
    }
    if (!isCurrent() || token.isCancellationRequested) {
      return;
    }
    let parameters;
    try {
      const parsed = JSON.parse(rawInput);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("expected JSON object");
      }
      parameters = parsed;
    } catch {
      fail(localize("agentHost.clientTool.badInput", 'Invalid tool input for "{0}": expected JSON object parameters.', toolName), "invalidInput");
      return;
    }
    const toolSearchCandidates = isToolSearch ? readToolCallMeta(toolCall).toolSearchCandidates : void 0;
    if (toolSearchCandidates !== void 0) {
      parameters = { ...parameters, candidateTools: toolSearchCandidates };
    }
    this._logService.info(`[AgentHost] Running client tool: ${toolName} (callId=${toolCall.toolCallId}, withContext=${contextSessionResource !== void 0})`);
    let result;
    let error;
    try {
      markInvocationStarted();
      result = await this._toolsService.invokeTool({
        callId: toolCall.toolCallId,
        toolId: toolData.id,
        parameters,
        context: contextSessionResource ? { sessionResource: contextSessionResource } : void 0,
        chatStreamToolCallId: toolCall.toolCallId,
        preApproved: getClientToolPreApproval(toolCall)
      }, async () => 0, token);
    } catch (err) {
      error = err;
    }
    if (!isCurrent() || token.isCancellationRequested) {
      return;
    }
    if (error !== void 0) {
      if (!isCancellationError(error)) {
        this._logService.warn(`[AgentHost] Client tool failed: ${toolName}`, error);
      }
      result = { content: [], toolResultError: error instanceof Error ? error.message : String(error) };
    }
    this._resolveToolCall(chatURI, request.turnId, toolCall.toolCallId, {
      type: ActionType.ChatToolCallComplete,
      turnId: request.turnId,
      toolCallId: toolCall.toolCallId,
      result: toolResultToProtocol(result ?? { content: [] }, toolName),
      ...completionMeta
    });
  }
  /**
   * Denies a client tool call that needs confirmation but that no sub/agent
   * observer claimed within the grace window: there is no live surface to
   * answer it, so report a failed completion rather than pop a headless
   * modal.
   */
  _denyClientTool(request) {
    const toolCall = request.toolCall;
    this._logService.warn(`[AgentHost] Denying client tool ${toolCall.toolName} (callId=${toolCall.toolCallId}): it can request confirmation but no session claimed it within ${UNOBSERVED_CLIENT_TOOL_GRACE_MS}ms`);
    this._resolveToolCall(request.chat.toString(), request.turnId, toolCall.toolCallId, {
      type: ActionType.ChatToolCallComplete,
      turnId: request.turnId,
      toolCallId: toolCall.toolCallId,
      result: {
        success: false,
        pastTenseMessage: localize("agentHost.clientTool.unclaimed", "Couldn't run {0}", toolCall.displayName),
        error: {
          message: localize("agentHost.clientTool.unclaimedError", "{0} needs confirmation but no session was available to answer it.", toolCall.displayName),
          code: "clientUnavailable"
        }
      }
    });
    this._clientToolInvocations.delete(this._toolCallKey(request.chat.toString(), request.turnId, toolCall.toolCallId));
  }
  /**
   * Tracks protocol state changes for a specific server-initiated turn and
   * pushes `IChatProgress[]` items into the session's `progressObs`.
   * When the turn finishes, sets `isCompleteObs` to true.
   */
  _trackServerTurnProgress(backendSession, turnId, chatSession, turnDisposables) {
    const cts = new CancellationTokenSource();
    turnDisposables.add(toDisposable(() => cts.dispose(true)));
    turnDisposables.add(this._observeTurn({
      backendSession,
      sessionResource: chatSession.sessionResource,
      chatURI: this._getChatURI(chatSession.sessionResource),
      turnId,
      sink: (parts) => chatSession.appendProgress(parts),
      cancellationToken: cts.token,
      onTurnEnded: () => chatSession.isCompleteObs.set(true, void 0)
    }));
  }
  _turnStopWatchKey(chatURI, turnId) {
    return `${chatURI}\0${turnId}`;
  }
  _ensureTurnStopWatch(chatURI, turnId) {
    const key = this._turnStopWatchKey(chatURI, turnId);
    let stopWatch = this._turnStopWatches.get(key);
    if (!stopWatch) {
      stopWatch = StopWatch.create(false);
      this._turnStopWatches.set(key, stopWatch);
    }
    return stopWatch;
  }
  _turnDuration(chatURI, turnId) {
    const elapsed = this._turnStopWatches.get(this._turnStopWatchKey(chatURI, turnId))?.elapsed();
    return typeof elapsed === "number" && Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  }
  _clearTurnStopWatch(chatURI, turnId) {
    this._turnStopWatches.delete(this._turnStopWatchKey(chatURI, turnId));
  }
  // ---- Turn handling (state-driven) ---------------------------------------
  async _handleTurn(session, request, progress, cancellationToken, onFailureStage) {
    if (cancellationToken.isCancellationRequested) {
      return;
    }
    onFailureStage("prepareTurn");
    await this._workingDirectorySynchronizer.reconcile(session, cancellationToken);
    if (cancellationToken.isCancellationRequested) {
      return;
    }
    const turnId = request.requestId;
    this._clientDispatchedTurnIds.add(turnId);
    const chatURI = this._getChatURI(request.sessionResource);
    const turnChannel = chatURI;
    const messageAttachments = await this._convertVariablesToAttachments(request);
    if (cancellationToken.isCancellationRequested) {
      return;
    }
    this._ensureActiveClient(session);
    const selectedModel = this._createModelSelection(request.userSelectedModelId, request.modelConfiguration);
    const requestedAgentUri = request.modeInstructions?.uri?.toString();
    const chatModel = this._chatService.getSession(request.sessionResource);
    const protocolState = this._getSessionState(session.toString(), chatURI);
    if (chatModel && protocolState?.turns.length) {
      const previousRequestIndex = chatModel.getRequests().findIndex((i) => i.id === request.requestId) - 1;
      const previousRequest = previousRequestIndex >= 0 ? chatModel.getRequests()[previousRequestIndex] : void 0;
      if (!previousRequest && protocolState.turns.length > 0) {
        const truncateAction = {
          type: ActionType.ChatTruncated
        };
        this._config.connection.dispatch(turnChannel, truncateAction);
      } else {
        const seenAtIndex = protocolState.turns.findIndex((t) => t.id === previousRequest.id);
        if (seenAtIndex !== -1 && seenAtIndex < protocolState.turns.length - 1) {
          const truncateAction = {
            type: ActionType.ChatTruncated,
            turnId: previousRequest.id
          };
          this._config.connection.dispatch(turnChannel, truncateAction);
        }
      }
    }
    this._customizationService.prepareMcpServersForTurn(request.sessionResource);
    const turnAction = {
      type: ActionType.ChatTurnStarted,
      turnId,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: {
        ...userOriginMessage(request.message, messageAttachments),
        ...selectedModel ? { model: selectedModel } : {},
        ...requestedAgentUri ? { agent: { uri: requestedAgentUri } } : {}
      }
    };
    this._ensureTurnStopWatch(turnChannel, turnId);
    onFailureStage("dispatchTurn");
    this._config.connection.dispatch(turnChannel, turnAction);
    this._ensureSnapshotController(request.sessionResource)?.ensureRequestCheckpoint(request.requestId);
    onFailureStage("observeTurn");
    return new Promise((resolve) => {
      const store = new DisposableStore();
      const cancelSub = store.add(cancellationToken.onCancellationRequested(() => {
        cancelSub.dispose();
        this._logService.info(`[AgentHost] Cancellation requested for ${session.toString()}, dispatching turnCancelled`);
        this._config.connection.dispatch(turnChannel, {
          type: ActionType.ChatTurnCancelled,
          turnId,
          duration: this._turnDuration(turnChannel, turnId)
        });
      }));
      store.add(this._observeTurn({
        backendSession: session,
        sessionResource: request.sessionResource,
        chatURI,
        turnId,
        sink: progress,
        cancellationToken,
        suppressErrorMarkdown: true,
        onTurnEnded: (lastTurn) => {
          store.dispose();
          this._clientDispatchedTurnIds.delete(turnId);
          this._activeSessions.get(request.sessionResource)?.isCompleteObs.set(true, void 0);
          resolve(lastTurn);
        },
        onFileEdits: (tc) => {
          const editParts = this._hydrateFileEdits(request.sessionResource, request.requestId, tc);
          if (editParts.length > 0) {
            progress(editParts);
          }
        }
      }));
    });
  }
  // ---- Tool confirmation --------------------------------------------------
  /**
   * Awaits user confirmation on a PendingConfirmation tool call invocation
   * and dispatches `ChatToolCallConfirmed` back to the server.
   */
  _awaitToolConfirmation(invocation, toolCallId, session, turnId, cancellationToken, getProtocolOptions, chatURI) {
    IChatToolInvocation.awaitConfirmation(invocation, cancellationToken).then((reason) => {
      let selectedOption;
      const protocolOptions = getProtocolOptions();
      if (reason.type === ToolConfirmKind.UserAction && reason.selectedButton && protocolOptions) {
        selectedOption = protocolOptions.find((o) => o.id === reason.selectedButton);
      }
      const approved = selectedOption ? selectedOption.kind === ConfirmationOptionKind.Approve : reason.type !== ToolConfirmKind.Denied && reason.type !== ToolConfirmKind.Skipped;
      this._logService.info(`[AgentHost] Tool confirmation: toolCallId=${toolCallId}, approved=${approved}, selectedOptionId=${selectedOption?.id}`);
      const target = this._requireChatURI(chatURI, ActionType.ChatToolCallConfirmed);
      this._resolveToolCall(target, turnId, toolCallId, approved ? {
        type: ActionType.ChatToolCallConfirmed,
        turnId,
        toolCallId,
        approved: true,
        confirmed: ToolCallConfirmationReason.UserAction,
        ...selectedOption ? { selectedOptionId: selectedOption.id } : {}
      } : {
        type: ActionType.ChatToolCallConfirmed,
        turnId,
        toolCallId,
        approved: false,
        reason: ToolCallCancellationReason.Denied,
        ...selectedOption ? { selectedOptionId: selectedOption.id } : {}
      });
    }).catch((err) => {
      this._logService.warn(`[AgentHost] Tool confirmation failed for toolCallId=${toolCallId}`, err);
    });
  }
  // ---- Per-turn observable graph ------------------------------------------
  /**
   * Installs the always-on observable graph that translates session state
   * into `IChatProgress[]` for a specific turn. The same graph is used for:
   *   - live turns started by the user via {@link _handleTurn},
   *   - reconnect to an in-flight turn from {@link provideChatSessionContent},
   *   - server-initiated turns detected by {@link _watchForServerInitiatedTurns}.
   *
   * Differences are captured in {@link IObserveTurnOptions.sink} (where
   * progress is delivered) and {@link IObserveTurnOptions.adoptInvocations} /
   * {@link IObserveTurnOptions.seedEmittedLengths} (snapshot continuity for
   * the reconnect case).
   *
   * The returned disposable owns the entire per-turn graph, including the
   * underlying session subscription reference.
   */
  _observeTurn(opts) {
    const sessionKey = opts.backendSession.toString();
    const store = new DisposableStore();
    this._ensureTurnStopWatch(opts.chatURI, opts.turnId);
    const sub = this._ensureSessionSubscription(sessionKey);
    const chatURI = opts.chatURI;
    const chatSub = this._ensureChatSubscription(sessionKey, chatURI);
    const sessionState$ = observableFromSubscription(this, sub);
    const chatState$ = observableFromSubscription(this, chatSub);
    const mergedState$ = derived((reader) => {
      const session = sessionState$.read(reader);
      if (!session) {
        return void 0;
      }
      return mergeSessionWithDefaultChat(session, chatState$.read(reader));
    });
    const turn$ = derived((reader) => {
      const state = mergedState$.read(reader);
      if (!state) {
        return void 0;
      }
      return state.activeTurn?.id === opts.turnId ? state.activeTurn : state.turns.find((t) => t.id === opts.turnId);
    });
    const responseParts$ = derived((reader) => turn$.read(reader)?.responseParts ?? []);
    const usage$ = derived((reader) => turn$.read(reader)?.usage);
    store.add(autorun((reader) => {
      const state = mergedState$.read(reader);
      if (state?.turns.some((turn) => turn.id === opts.turnId)) {
        this._clearTurnStopWatch(opts.chatURI, opts.turnId);
      }
    }));
    const mcpAuthRequired$ = derivedOpts({ equalsFn: equals }, (reader) => {
      return getMcpAuthenticationRequiredServers(opts.sessionResource, mergedState$.read(reader));
    });
    const mcpStarting$ = derivedOpts({ equalsFn: equals }, (reader) => {
      const state = mergedState$.read(reader);
      const servers = state?.customizations?.flatMap((c) => c.type === CustomizationType.McpServer ? [c] : c.children?.filter((c2) => c2.type === CustomizationType.McpServer) ?? []) ?? [];
      return servers.filter((server) => server.enabled && server.state.kind === McpServerStatus.Starting).map((server) => ({
        id: opts.sessionResource.authority + "/" + server.id,
        name: server.name
      }));
    });
    const subagentContext = {
      observedToolIds: /* @__PURE__ */ new Set()
    };
    store.add(autorunPerKeyedItem(
      responseParts$,
      (rp) => rp.kind === ResponsePartKind.ToolCall ? `tc:${rp.toolCall.toolCallId}` : rp.kind === ResponsePartKind.Markdown ? `md:${rp.id}` : rp.kind === ResponsePartKind.Reasoning ? `rs:${rp.id}` : rp.kind === ResponsePartKind.InputRequest ? inputRequestResponsePartKey(rp) : `other:${responseParts$.get().indexOf(rp)}`,
      (_key, part$, partStore) => {
        const initial = part$.get();
        switch (initial.kind) {
          case ResponsePartKind.Markdown:
            if (opts.subAgentInvocationId !== void 0) {
              break;
            }
            this._setupMarkdownPart(part$, partStore, opts);
            break;
          case ResponsePartKind.Reasoning:
            if (opts.subAgentInvocationId !== void 0) {
              break;
            }
            this._setupReasoningPart(part$, partStore, opts);
            break;
          case ResponsePartKind.ToolCall:
            this._setupToolCallPart(part$, partStore, opts, subagentContext);
            break;
          case ResponsePartKind.InputRequest:
            if (opts.subAgentInvocationId === void 0) {
              this._setupInputRequestPart(part$, partStore, opts);
            }
            break;
          case ResponsePartKind.SystemNotification:
            if (responseParts$.get().indexOf(initial) >= (opts.initialResponsePartCount ?? 0) && opts.subAgentInvocationId === void 0) {
              const progress = systemNotificationToChatPart(initial.content, this._config.connectionAuthority, initial._meta);
              if (progress) {
                opts.sink([progress]);
              }
            }
            break;
        }
      }
    ));
    if (opts.subAgentInvocationId === void 0) {
      let lastUsage;
      let lastAutoModeResolution;
      const modelLookup = this._createTurnModelLookup(opts.sessionResource, void 0);
      this._setupMcpAuthPrompt(mcpAuthRequired$, store, opts);
      store.add(autorun((reader) => {
        const activity = chatState$.read(reader)?.activity;
        if (!activity || responseParts$.read(reader).length > 0) {
          return;
        }
        opts.sink([{
          kind: "progressMessage",
          id: CHAT_ACTIVITY_PROGRESS_ID,
          content: new MarkdownString().appendText(activity),
          shimmer: true
        }]);
      }));
      store.add(autorun((reader) => {
        const resolution = modelLookup.toAutoModeResolution?.(usage$.read(reader));
        if (!resolution || equals(lastAutoModeResolution, resolution)) {
          return;
        }
        lastAutoModeResolution = resolution;
        opts.sink([resolution]);
      }));
      {
        const MCP_STARTING_GRACE_MS = 5e3;
        let didAppend = false;
        const hasContent$ = responseParts$.map((r) => r.length > 0);
        const hasServersStarting$ = mcpStarting$.map((s) => s.length > 0);
        const serversStartingInput = observableValue("mcpStartingServersInput", constObservable([]));
        store.add(autorun((reader) => {
          if (hasContent$.read(reader) || !hasServersStarting$.read(reader)) {
            serversStartingInput.set(constObservable([]), void 0);
            return;
          }
          reader.store.add(disposableTimeout(() => {
            serversStartingInput.set(mcpStarting$, void 0);
            if (!didAppend) {
              didAppend = true;
              opts.sink([{
                kind: "mcpServersStartingSlow",
                sessionResource: opts.sessionResource,
                servers: serversStartingInput.map((o, r) => o.read(r))
              }]);
            }
          }, MCP_STARTING_GRACE_MS));
        }));
        store.add(toDisposable(() => serversStartingInput.set(constObservable([]), void 0)));
      }
      store.add(autorun((reader) => {
        const rawUsage = usage$.read(reader);
        const usage = usageInfoToChatUsage(rawUsage, modelLookup.toModelDisplayName);
        if (!usage) {
          return;
        }
        const actualModelId = this._toLanguageModelId(opts.sessionResource, rawUsage?.model);
        if (actualModelId) {
          usage.actualModelId = actualModelId;
        }
        if (lastUsage && lastUsage.promptTokens === usage.promptTokens && lastUsage.completionTokens === usage.completionTokens && lastUsage.outputBuffer === usage.outputBuffer && lastUsage.copilotCredits === usage.copilotCredits && lastUsage.sessionCopilotCredits === usage.sessionCopilotCredits && equals(lastUsage.promptTokenDetails, usage.promptTokenDetails) && equals(lastUsage.modelTotals, usage.modelTotals)) {
          return;
        }
        lastUsage = usage;
        opts.sink([usage]);
      }));
      let lastQuotaSignature;
      store.add(autorun((reader) => {
        const quotaUpdate = usageInfoToQuotas(usage$.read(reader));
        if (!quotaUpdate) {
          return;
        }
        const signature = JSON.stringify(quotaUpdate);
        if (signature === lastQuotaSignature) {
          return;
        }
        lastQuotaSignature = signature;
        this._chatEntitlementService.acceptQuotas({
          ...this._chatEntitlementService.quotas,
          ...quotaUpdate
        });
      }));
    }
    if (opts.subAgentInvocationId !== void 0 && opts.subAgentCreditsAccumulator) {
      const accumulator = opts.subAgentCreditsAccumulator;
      let lastCredits = 0;
      store.add(autorun((reader) => {
        const rawUsage = usage$.read(reader);
        const credits = usageInfoToChatUsage(rawUsage)?.copilotCredits;
        if (typeof credits === "number" && credits !== lastCredits) {
          const delta = credits - lastCredits;
          lastCredits = credits;
          if (delta > 0) {
            transaction((tx) => {
              accumulator.set(accumulator.read(void 0) + delta, tx);
            });
          }
        }
      }));
    }
    if (opts.subAgentInvocationId !== void 0 && opts.subAgentModelObservable) {
      const modelObservable = opts.subAgentModelObservable;
      store.add(autorun((reader) => {
        const rawUsage = usage$.read(reader);
        const modelId = this._toLanguageModelId(opts.sessionResource, rawUsage?.model);
        const modelName = this._getLanguageModelDisplayName(modelId);
        if (modelName && modelName !== modelObservable.read(void 0)) {
          transaction((tx) => modelObservable.set(modelName, tx));
        }
      }));
    }
    let terminated = false;
    let seenActive = false;
    const finish = (lastTurn) => {
      if (terminated) {
        return;
      }
      terminated = true;
      queueMicrotask(() => {
        try {
          opts.onTurnEnded?.(lastTurn);
        } finally {
          store.dispose();
        }
      });
    };
    store.add(autorun((reader) => {
      if (terminated) {
        return;
      }
      const state = mergedState$.read(reader);
      if (!state) {
        return;
      }
      if (state.activeTurn?.id === opts.turnId) {
        seenActive = true;
        return;
      }
      const lastTurn = state.turns.find((t) => t.id === opts.turnId);
      if (lastTurn) {
        seenActive = true;
      }
      if (!seenActive) {
        return;
      }
      if (!opts.suppressErrorMarkdown && lastTurn?.state === TurnState.Error && lastTurn.error) {
        const forwarded = getChatErrorDetailsFromMeta(lastTurn.error, this._chatErrorContext());
        const content = forwarded ? new MarkdownString(`

${forwarded.message}`) : new MarkdownString(`

Error: (${lastTurn.error.errorType}) ${lastTurn.error.message}`);
        opts.sink([{ kind: "markdownContent", content }]);
      }
      finish(lastTurn);
    }));
    store.add(opts.cancellationToken.onCancellationRequested(() => {
      const current = turn$.get();
      finish(current ? { state: TurnState.Cancelled, ...current } : void 0);
    }));
    return store;
  }
  /**
   * Surfaces the "MCP server … requires authentication" prompt for a turn.
   *
   * Each server is prompted at most once per conversation: {@link mcpAuthRequired$}
   * is session-wide, so without this guard the prompt would repeat on every
   * message. The per-session {@link _surfacedMcpAuthServers surfaced set} tracks
   * which servers were already prompted; it is pruned by
   * {@link _reconcileSurfacedMcpAuthServers} once a server reaches the running
   * state, so a server that is re-required after being authenticated (e.g.
   * after a restart) prompts again.
   *
   * The emitted part lists only the servers it introduced and shrinks as they
   * authenticate.
   */
  _setupMcpAuthPrompt(mcpAuthRequired$, store, opts) {
    let part;
    let ownedIds = /* @__PURE__ */ new Set();
    let runId = 0;
    store.add(autorun((reader) => {
      const pendingAuth = mcpAuthRequired$.read(reader);
      const currentRunId = ++runId;
      this._filterAutoGrantedMcpAuthentication(opts.sessionResource, pendingAuth).then((servers) => {
        if (currentRunId !== runId) {
          return;
        }
        const surfaced = this._getSurfacedMcpAuthServers(opts.sessionResource);
        const newServers = servers.filter((server) => !surfaced.has(server.id));
        if (!newServers.length && (!part || part.isUsed)) {
          return;
        }
        if (!part || part.isUsed) {
          ownedIds = /* @__PURE__ */ new Set();
          part = {
            kind: "mcpAuthenticationRequired",
            sessionResource: opts.sessionResource.toJSON(),
            isUsed: false,
            servers: observableValue("mcpAuthNeededServers", [])
          };
          opts.sink([part]);
        }
        for (const server of newServers) {
          surfaced.add(server.id);
          ownedIds.add(server.id);
        }
        part.servers.set(servers.filter((server) => ownedIds.has(server.id)), void 0);
      });
    }));
  }
  /**
   * Returns the mutable set of MCP server ids already surfaced for
   * authentication in the given session, creating it on first use.
   */
  _getSurfacedMcpAuthServers(sessionResource) {
    let surfaced = this._surfacedMcpAuthServers.get(sessionResource);
    if (!surfaced) {
      surfaced = /* @__PURE__ */ new Set();
      this._surfacedMcpAuthServers.set(sessionResource, surfaced);
    }
    return surfaced;
  }
  /**
   * Prunes servers that reached the running ({@link McpServerStatus.Ready})
   * state from every session's {@link _surfacedMcpAuthServers surfaced set} so
   * a subsequent auth requirement surfaces a fresh prompt instead of being
   * suppressed. Only the running state counts as actioned — a server that
   * merely left {@link McpServerStatus.AuthRequired} for an error/stopped
   * state was not authenticated and stays suppressed.
   */
  _reconcileSurfacedMcpAuthServers() {
    for (const [sessionResource, surfaced] of this._surfacedMcpAuthServers) {
      if (surfaced.size === 0) {
        continue;
      }
      const ready = new Set(this._customizationService.getMcpServers(sessionResource).filter((server) => server.status === McpServerStatus.Ready).map((server) => server.id));
      for (const id of surfaced) {
        if (ready.has(id)) {
          surfaced.delete(id);
        }
      }
    }
  }
  async _filterAutoGrantedMcpAuthentication(sessionResource, servers) {
    const remaining = [];
    for (const server of servers) {
      if (!await this._autoAuthenticateMcpServer(sessionResource, server)) {
        remaining.push(server);
      }
    }
    return remaining;
  }
  async _autoAuthenticateMcpServer(sessionResource, server) {
    const key = JSON.stringify([
      agentHostMcpServerId(sessionResource.authority, server.name, server.resource),
      [...server.requiredScopes ?? []].sort(),
      server.oauthClient?.clientId
    ]);
    const pending = this._pendingMcpAutoAuthentication.get(key);
    if (pending) {
      return pending;
    }
    const operation = this._instantiationService.invokeFunction(resolveMcpServerAuthentication, {
      resource: server.resource,
      resource_name: server.name,
      authorization_servers: server.authorizationServers ? [...server.authorizationServers] : void 0,
      scopes_supported: server.supportedScopes ? [...server.supportedScopes] : void 0
    }, {
      allowInteraction: false,
      logPrefix: "[AgentHost]",
      mcpServerId: agentHostMcpServerId(sessionResource.authority, server.name, server.resource),
      mcpServerName: server.name,
      mcpServerUrl: server.resource,
      oauthClient: server.oauthClient,
      scopes: server.requiredScopes ?? [],
      agentHost: { scheme: sessionResource.scheme, authority: sessionResource.authority },
      authenticate: (request) => this._config.connection.authenticate(request)
    }).catch((err) => {
      this._logService.error(`[AgentHost] Failed to auto-authenticate MCP server '${server.name}'`, err);
      return false;
    });
    this._pendingMcpAutoAuthentication.set(key, operation);
    try {
      return await operation;
    } finally {
      if (this._pendingMcpAutoAuthentication.get(key) === operation) {
        this._pendingMcpAutoAuthentication.delete(key);
      }
    }
  }
  _setupMarkdownPart(part$, store, opts) {
    let lastEmitted = opts.seedEmittedLengths?.get(part$.get().id) ?? 0;
    store.add(autorun((reader) => {
      const content = part$.read(reader).content;
      if (content.length <= lastEmitted) {
        return;
      }
      const delta = content.substring(lastEmitted);
      lastEmitted = content.length;
      opts.sink([{ kind: "markdownContent", content: new MarkdownString(delta) }]);
    }));
  }
  _setupReasoningPart(part$, store, opts) {
    const partId = part$.get().id;
    let lastEmitted = opts.seedEmittedLengths?.get(partId) ?? 0;
    store.add(autorun((reader) => {
      const content = part$.read(reader).content;
      if (content.length <= lastEmitted) {
        return;
      }
      const delta = content.substring(lastEmitted);
      lastEmitted = content.length;
      opts.sink([{ kind: "thinking", value: delta, id: partId }]);
    }));
  }
  _setupToolCallPart(part$, store, opts, subagentContext) {
    const initial = part$.get().toolCall;
    const contributor = initial.contributor;
    if (contributor?.kind === ToolCallContributorKind.Client && contributor.clientId === this._config.connection.clientId) {
      this._setupClientToolCall(initial, part$, store, opts, subagentContext);
      store.add(this._markToolCallRendered(opts.chatURI, opts.turnId, initial.toolCallId, opts.sessionResource));
    } else if (contributor?.kind === ToolCallContributorKind.Client) {
      this._setupOtherClientToolCall(initial, part$, store, opts);
    } else {
      store.add(this._markToolCallRendered(opts.chatURI, opts.turnId, initial.toolCallId, opts.sessionResource));
      this._setupServerToolCall(initial, part$, store, opts, subagentContext);
    }
  }
  _toolCallKey(chatURI, turnId, toolCallId) {
    return `${chatURI}\0${turnId}\0${toolCallId}`;
  }
  _inputRequestKey(chatURI, requestId) {
    return `${chatURI}\0${requestId}`;
  }
  /** Claims a request as rendered until the returned disposable is disposed. */
  _markRendered(key, sessionResource) {
    this._renderedRequests.set(new Map(this._renderedRequests.get()).set(key, sessionResource), void 0);
    return toDisposable(() => {
      const next = new Map(this._renderedRequests.get());
      next.delete(key);
      this._renderedRequests.set(next, void 0);
    });
  }
  /**
   * Records that a turn observer is rendering this chat input request, so the
   * session-level responder leaves its inline elicitation UI in charge.
   */
  _markInputRequestRendered(chatURI, requestId, sessionResource) {
    return this._markRendered(this._inputRequestKey(chatURI, requestId), sessionResource);
  }
  /**
   * Records that a turn observer is rendering this tool call, so the
   * session-level responder leaves its inline UI in charge. Releasing the
   * claim also forgets the funnel entries, which is the only cleanup a tool
   * call that never reached `inputNeeded` ever gets.
   */
  _markToolCallRendered(chatURI, turnId, toolCallId, sessionResource) {
    const key = this._toolCallKey(chatURI, turnId, toolCallId);
    const rendered = this._markRendered(key, sessionResource);
    return toDisposable(() => {
      rendered.dispose();
      this._forgetResolvedToolCall(key);
    });
  }
  /**
   * Single funnel for tool-call outcomes, so an inline invocation and the
   * session-level responder can both offer the action while the protocol
   * only ever sees the first answer. Confirming and completing are distinct
   * outcomes, so each is tracked separately.
   */
  _resolveToolCall(chatURI, turnId, toolCallId, action) {
    const key = `${this._toolCallKey(chatURI, turnId, toolCallId)}\0${action.type}`;
    if (this._resolvedToolCalls.has(key)) {
      this._logService.trace(`[AgentHost] Tool call outcome was already dispatched: ${toolCallId} (${action.type})`);
      return;
    }
    this._resolvedToolCalls.add(key);
    this._config.connection.dispatch(chatURI, action);
  }
  _forgetResolvedToolCall(toolCallKey) {
    for (const key of this._resolvedToolCalls) {
      if (key.startsWith(`${toolCallKey}\0`)) {
        this._resolvedToolCalls.delete(key);
      }
    }
  }
  _setupOtherClientToolCall(initial, part$, store, opts) {
    const toolCallId = initial.toolCallId;
    const adopted = opts.adoptInvocations?.get(toolCallId);
    const invocation = adopted ?? toolCallStateToInvocation(
      initial,
      opts.subAgentInvocationId,
      opts.backendSession,
      this._config.connectionAuthority,
      opts.sessionResource.authority,
      this._otherClientToolInvocationOptions(opts.backendSession, opts.chatURI, opts.turnId)
    );
    if (!adopted) {
      opts.sink([invocation]);
    }
    store.add(autorun((reader) => {
      const toolCall = part$.read(reader).toolCall;
      if ((toolCall.status === ToolCallStatus.Completed || toolCall.status === ToolCallStatus.Cancelled) && !IChatToolInvocation.isComplete(invocation)) {
        const fileEdits = finalizeToolInvocation(invocation, toolCall, opts.backendSession, this._config.connectionAuthority);
        if (fileEdits.length > 0) {
          opts.onFileEdits?.(toolCall, fileEdits);
        }
      }
    }));
    store.add(toDisposable(() => {
      if (!IChatToolInvocation.isComplete(invocation)) {
        invocation.didExecuteTool(void 0);
      }
    }));
  }
  _otherClientToolInvocationOptions(backendSession, chatURI, turnId) {
    return {
      currentClientId: this._config.connection.clientId,
      cancelOtherClientToolCall: (toolCall) => {
        this._dispatchAction(backendSession, {
          type: ActionType.ChatToolCallComplete,
          turnId,
          toolCallId: toolCall.toolCallId,
          result: {
            success: false,
            pastTenseMessage: localize("agentHost.otherClientTool.skipped", "Skipped {0}", toolCall.displayName),
            error: {
              message: localize("agentHost.otherClientTool.skippedError", "{0} was skipped from another client", toolCall.displayName),
              code: "cancelled"
            }
          }
        }, chatURI);
      }
    };
  }
  /**
   * Per-call setup for a server-driven tool. Adopts a snapshot
   * {@link ChatToolInvocation} when present (reconnect parity); otherwise
   * emits a fresh one. Reacts to status transitions for re-confirmation,
   * terminal revival, finalization, and subagent observation.
   */
  _setupServerToolCall(initial, part$, store, opts, subagentContext) {
    const toolCallId = initial.toolCallId;
    const subAgentInvocationId = opts.subAgentInvocationId;
    const adopted = opts.adoptInvocations?.get(toolCallId);
    let confirmationOptions = initial.status === ToolCallStatus.PendingConfirmation ? initial.options : void 0;
    let invocation;
    if (adopted) {
      invocation = adopted;
    } else if (initial.status === ToolCallStatus.Streaming) {
      invocation = toolCallStateToStreamingInvocation(initial, subAgentInvocationId, opts.backendSession, this._config.connectionAuthority, opts.sessionResource.authority);
      opts.sink([invocation]);
    } else {
      invocation = toolCallStateToInvocation(initial, subAgentInvocationId, opts.backendSession, this._config.connectionAuthority, opts.sessionResource.authority);
      opts.sink([invocation]);
    }
    if (initial.status === ToolCallStatus.PendingConfirmation && !IChatToolInvocation.isComplete(invocation)) {
      this._awaitToolConfirmation(invocation, toolCallId, opts.backendSession, opts.turnId, opts.cancellationToken, () => confirmationOptions, opts.chatURI);
    }
    this._tryObserveSubagentToolCall(initial, invocation, store, opts, subagentContext);
    const outputTerminalAttachment = {
      disposable: store.add(new MutableDisposable())
    };
    let previousStatus = initial.status;
    store.add(autorun((reader) => {
      const tc = part$.read(reader).toolCall;
      const status = tc.status;
      const priorStatus = previousStatus;
      if (status === ToolCallStatus.PendingConfirmation) {
        confirmationOptions = tc.options;
      }
      const enteringConfirmation = status === ToolCallStatus.PendingConfirmation && previousStatus !== ToolCallStatus.PendingConfirmation;
      previousStatus = status;
      if (status === ToolCallStatus.Streaming) {
        updateStreamingToolInvocation(invocation, tc, this._config.connectionAuthority);
      } else if (enteringConfirmation) {
        this._forgetResolvedToolCall(this._toolCallKey(opts.chatURI, opts.turnId, toolCallId));
        if (!IChatToolInvocation.isComplete(invocation)) {
          const prepared = toolCallStateToPreparedInvocation(tc, opts.backendSession, this._config.connectionAuthority, opts.sessionResource.authority);
          invocation.requestConfirmation(prepared);
          this._awaitToolConfirmation(invocation, toolCallId, opts.backendSession, opts.turnId, opts.cancellationToken, () => confirmationOptions, opts.chatURI);
        }
      } else if (status === ToolCallStatus.PendingConfirmation) {
        const prepared = toolCallStateToPreparedInvocation(tc, opts.backendSession, this._config.connectionAuthority, opts.sessionResource.authority);
        invocation.updatePreparedInvocation(prepared, invocation.parameters);
      } else if (status === ToolCallStatus.AuthRequired) {
        this._ensureLeftStreaming(invocation, tc, opts);
        invocation.setAuthenticationRequired(toolCallAuthenticationServer(tc, opts.sessionResource.authority), () => {
          this._dispatchAction(opts.backendSession, {
            type: ActionType.ChatToolCallComplete,
            turnId: opts.turnId,
            toolCallId,
            result: {
              success: false,
              pastTenseMessage: localize("agentHost.mcpToolAuthentication.cancelled", "Cancelled tool call"),
              error: { message: localize("agentHost.mcpToolAuthentication.cancelledError", "MCP authentication was cancelled"), code: "cancelled" }
            }
          }, opts.chatURI);
        });
      } else if (status === ToolCallStatus.Running || status === ToolCallStatus.PendingResultConfirmation) {
        if (priorStatus === ToolCallStatus.AuthRequired) {
          invocation.setAuthenticationResolved();
        }
        this._ensureLeftStreaming(invocation, tc, opts);
        const invocationMessage = stringOrMarkdownToString(tc.invocationMessage, this._config.connectionAuthority);
        const previousInvocationMessage = typeof invocation.invocationMessage === "string" ? invocation.invocationMessage : invocation.invocationMessage.value;
        const nextInvocationMessage = typeof invocationMessage === "string" ? invocationMessage : invocationMessage?.value;
        const invocationMessageChanged = nextInvocationMessage !== void 0 && nextInvocationMessage !== previousInvocationMessage;
        if (invocationMessage !== void 0) {
          invocation.invocationMessage = invocationMessage;
        }
        this._reviveTerminalIfNeeded(invocation, tc, opts.backendSession, outputTerminalAttachment);
        updateRunningToolSpecificData(invocation, tc, opts.backendSession, this._config.connectionAuthority);
        if (invocationMessageChanged) {
          invocation.notifyToolSpecificDataChanged();
        }
      }
      this._tryObserveSubagentToolCall(tc, invocation, store, opts, subagentContext);
      if ((status === ToolCallStatus.Completed || status === ToolCallStatus.Cancelled) && !IChatToolInvocation.isComplete(invocation)) {
        if (status === ToolCallStatus.Completed) {
          this._ensureLeftStreaming(invocation, tc, opts);
        }
        this._reviveTerminalIfNeeded(invocation, tc, opts.backendSession, outputTerminalAttachment);
        const fileEdits = finalizeToolInvocation(invocation, tc, opts.backendSession, this._config.connectionAuthority);
        if (fileEdits.length > 0) {
          opts.onFileEdits?.(tc, fileEdits);
        }
      }
    }));
    store.add(toDisposable(() => {
      if (!IChatToolInvocation.isComplete(invocation)) {
        invocation.didExecuteTool(void 0);
      }
    }));
  }
  /** Transitions an invocation from streaming once its AHP tool call is ready. */
  _ensureLeftStreaming(invocation, tc, opts) {
    if (invocation.state.read(void 0).type !== IChatToolInvocation.StateKind.Streaming) {
      return;
    }
    const prepared = toolCallStateToPreparedInvocation(tc, opts.backendSession, this._config.connectionAuthority, opts.sessionResource.authority);
    invocation.transitionFromStreaming(prepared, void 0, void 0);
  }
  /**
   * Observes the child chat for any subagent-spawning tool, including client-provided delegated tasks.
   */
  _tryObserveSubagentToolCall(toolCall, invocation, store, opts, subagentContext) {
    const toolCallId = toolCall.toolCallId;
    const hasSubagentContent = (toolCall.status === ToolCallStatus.Running || toolCall.status === ToolCallStatus.Completed) && !!getToolSubagentContent(toolCall);
    if (!isSubagentTool(toolCall) && !hasSubagentContent) {
      return;
    }
    const isObserved = subagentContext.observedToolIds.has(toolCallId);
    const currentData = invocation.toolSpecificData?.kind === "subagent" ? invocation.toolSpecificData : void 0;
    const prepared = toolCallStateToPreparedInvocation(toolCall, opts.backendSession, this._config.connectionAuthority, opts.sessionResource.authority);
    const protocolData = prepared.toolSpecificData?.kind === "subagent" ? prepared.toolSpecificData : void 0;
    if (!protocolData) {
      return;
    }
    const chatResource = protocolData.chatResource ?? currentData?.chatResource;
    const description = protocolData.description ?? currentData?.description;
    const agentName = protocolData.agentName ?? currentData?.agentName;
    if (!currentData || currentData.chatResource !== chatResource || currentData.description !== description || currentData.agentName !== agentName) {
      invocation.toolSpecificData = {
        ...currentData,
        ...protocolData,
        chatResource,
        description,
        agentName,
        isActive: currentData?.isActive ?? isObserved
      };
      invocation.notifyToolSpecificDataChanged();
    }
    if (isObserved) {
      return;
    }
    if (toolCall.status !== ToolCallStatus.Running && toolCall.status !== ToolCallStatus.Completed) {
      return;
    }
    const subagentData = invocation.toolSpecificData;
    if (subagentData?.kind !== "subagent") {
      return;
    }
    subagentContext.observedToolIds.add(toolCallId);
    subagentData.isActive = true;
    invocation.notifyToolSpecificDataChanged();
    const perInvocationCredits = observableValue("subagentInvocationCredits", 0);
    store.add(autorun((reader) => {
      const total = perInvocationCredits.read(reader);
      if (total > 0 && invocation.toolSpecificData?.kind === "subagent" && invocation.toolSpecificData.credits !== total) {
        invocation.toolSpecificData.credits = total;
        invocation.notifyToolSpecificDataChanged();
      }
    }));
    const perInvocationModel = observableValue("subagentInvocationModel", void 0);
    store.add(autorun((reader) => {
      const modelName = perInvocationModel.read(reader);
      if (modelName && invocation.toolSpecificData?.kind === "subagent" && invocation.toolSpecificData.modelName !== modelName) {
        invocation.toolSpecificData.modelName = modelName;
        invocation.notifyToolSpecificDataChanged();
      }
    }));
    const rootInvocationId = opts.subAgentInvocationId ?? toolCallId;
    const childChatUri = subagentData.chatResource || buildSubagentChatUri(opts.backendSession.toString(), toolCallId);
    this._observeSubagentSession(opts.sessionResource, opts.backendSession, toolCallId, childChatUri, rootInvocationId, invocation, opts.sink, store, subagentContext, perInvocationCredits, perInvocationModel);
  }
  /**
   * Per-call setup for a client-provided tool. The observer only renders: it
   * obtains the shared {@link ChatToolInvocation} (created by whichever of
   * this observer or the session-level watcher arrives first), emits it into
   * this chat so it renders in the correct group, drives subagent
   * presentation, and dispatches `ChatToolCallConfirmed` from the
   * invocation's confirmation gate. It never invokes the tool — the
   * session-level watcher owns execution.
   */
  _setupClientToolCall(initial, part$, store, opts, subagentContext) {
    const toolCallId = initial.toolCallId;
    const toolName = initial.toolName;
    const adopted = opts.adoptInvocations?.get(toolCallId);
    if (adopted && !IChatToolInvocation.isComplete(adopted)) {
      adopted.didExecuteTool(void 0);
    }
    const clientToolName = toolName === RUNTIME_TOOL_SEARCH_TOOL_NAME ? CLIENT_TOOL_SEARCH_REFERENCE_NAME : toolName;
    const toolData = this._toolsService.getToolByName(clientToolName);
    if (!toolData) {
      this._logService.warn(`[AgentHost] Client tool call for unknown tool: ${toolName}`);
      this._dispatchAction(opts.backendSession, {
        type: ActionType.ChatToolCallComplete,
        turnId: opts.turnId,
        toolCallId,
        result: {
          success: false,
          pastTenseMessage: `Tool "${toolName}" is not available`,
          error: { message: `Tool "${toolName}" is not available on this client` }
        }
      }, opts.chatURI);
      return;
    }
    const invocation = this._ensureClientToolInvocation(opts.chatURI, opts.turnId, toolCallId, toolData.id, opts.subAgentInvocationId);
    if (!invocation) {
      this._logService.warn(`[AgentHost] Failed to begin client tool invocation: ${toolName}`);
      this._dispatchAction(opts.backendSession, {
        type: ActionType.ChatToolCallComplete,
        turnId: opts.turnId,
        toolCallId,
        result: {
          success: false,
          pastTenseMessage: `Failed to start ${toolName}`,
          error: { message: `Could not create invocation for client tool "${toolName}"` }
        }
      }, opts.chatURI);
      return;
    }
    if (isSubagentTool(initial)) {
      const prepared = toolCallStateToPreparedInvocation(initial, opts.backendSession, this._config.connectionAuthority, opts.sessionResource.authority);
      if (prepared.toolSpecificData?.kind === "subagent") {
        invocation.toolSpecificData = prepared.toolSpecificData;
      }
    }
    this._tryObserveSubagentToolCall(initial, invocation, store, opts, subagentContext);
    opts.sink([invocation]);
    let confirmationDispatched = false;
    store.add(autorun((reader) => {
      const state = invocation.state.read(reader);
      if (confirmationDispatched) {
        return;
      }
      if (state.type === IChatToolInvocation.StateKind.Executing) {
        confirmationDispatched = true;
        const selectedOptionId = state.confirmed.type === ToolConfirmKind.UserAction ? state.confirmed.selectedButton : void 0;
        const approved = state.confirmed.type !== ToolConfirmKind.UserAction || state.confirmed.selectedButtonKind !== ConfirmationOptionKind.Deny;
        this._resolveToolCall(opts.chatURI, opts.turnId, toolCallId, approved ? {
          type: ActionType.ChatToolCallConfirmed,
          turnId: opts.turnId,
          toolCallId,
          approved: true,
          confirmed: confirmedReasonToProtocol(state.confirmed),
          ...selectedOptionId ? { selectedOptionId } : {}
        } : {
          type: ActionType.ChatToolCallConfirmed,
          turnId: opts.turnId,
          toolCallId,
          approved: false,
          reason: ToolCallCancellationReason.Denied,
          ...selectedOptionId ? { selectedOptionId } : {}
        });
      } else if (state.type === IChatToolInvocation.StateKind.Cancelled) {
        confirmationDispatched = true;
        const status = part$.read(void 0).toolCall.status;
        if (status === ToolCallStatus.Cancelled || status === ToolCallStatus.Completed) {
          return;
        }
        this._resolveToolCall(opts.chatURI, opts.turnId, toolCallId, {
          type: ActionType.ChatToolCallConfirmed,
          turnId: opts.turnId,
          toolCallId,
          approved: false,
          reason: ToolCallCancellationReason.Denied
        });
      }
    }));
    store.add(autorun((reader) => {
      const tc = part$.read(reader).toolCall;
      const state = invocation.state.read(reader);
      this._tryObserveSubagentToolCall(tc, invocation, store, opts, subagentContext);
      if (tc.status === ToolCallStatus.PendingConfirmation && state.type === IChatToolInvocation.StateKind.Streaming) {
        const prepared = toolCallStateToPreparedInvocation(tc, opts.backendSession, this._config.connectionAuthority, opts.sessionResource.authority);
        invocation.transitionFromStreaming(prepared, invocation.parameters, getClientToolPreApproval(tc));
      }
      if ((tc.status === ToolCallStatus.Cancelled || tc.status === ToolCallStatus.Completed) && !IChatToolInvocation.isComplete(invocation, reader)) {
        const fileEdits = finalizeToolInvocation(invocation, tc, opts.backendSession, this._config.connectionAuthority);
        if (fileEdits.length > 0) {
          opts.onFileEdits?.(tc, fileEdits);
        }
      }
    }));
  }
  _setupInputRequestPart(part$, store, opts) {
    const inputReq = part$.get().request;
    store.add(this._markInputRequestRendered(opts.chatURI, inputReq.id, opts.sessionResource));
    const planReview = inputReq.planReview;
    if (planReview) {
      this._setupPlanReviewInputRequest(part$, planReview, store, opts);
      return;
    }
    if (inputReq.url) {
      this._setupUrlInputRequest(part$, inputReq.url, store, opts);
      return;
    }
    const carousel = createInputRequestCarousel(inputReq, this._config.connectionAuthority);
    opts.sink([carousel]);
    let completedFromServer = false;
    store.add(autorun((reader) => {
      const part = part$.read(reader);
      if (part.response === void 0) {
        return;
      }
      completedFromServer = true;
      const protocolAnswers = part.response === ChatInputResponseKind.Accept ? part.request.answers : void 0;
      const carouselAnswers = convertProtocolAnswers(protocolAnswers);
      const wasUsed = carousel.isUsed;
      carousel.data = carouselAnswers ?? {};
      carousel.isUsed = true;
      carousel.answeredExternally = part.response === ChatInputResponseKind.Accept && !carouselAnswers;
      carousel.autoReply = containsAutomaticReplyAnswer(protocolAnswers);
      carousel.answeredExternally ||= carousel.autoReply;
      carousel.draftAnswers = void 0;
      carousel.draftCurrentIndex = void 0;
      carousel.draftCollapsed = void 0;
      carousel.completion.complete({ answers: carouselAnswers });
      if (!wasUsed) {
        this._chatWidgetService.getWidgetBySessionResource(opts.sessionResource)?.input.clearQuestionCarousel(void 0, inputReq.id);
      }
    }));
    carousel.completion.p.then((result) => {
      if (store.isDisposed || completedFromServer) {
        return;
      }
      if (!result.answers) {
        this._config.connection.dispatch(opts.chatURI, {
          type: ActionType.ChatInputCompleted,
          requestId: inputReq.id,
          response: ChatInputResponseKind.Cancel
        });
      } else {
        const answers = convertCarouselAnswers(result.answers, inputReq.questions);
        this._config.connection.dispatch(opts.chatURI, {
          type: ActionType.ChatInputCompleted,
          requestId: inputReq.id,
          response: ChatInputResponseKind.Accept,
          answers
        });
      }
    });
    if (opts.cancellationToken.isCancellationRequested) {
      carousel.completion.complete({ answers: void 0 });
    } else {
      const tokenListener = opts.cancellationToken.onCancellationRequested(() => {
        carousel.completion.complete({ answers: void 0 });
      });
      carousel.completion.p.finally(() => tokenListener.dispose());
    }
    store.add(toDisposable(() => {
      if (carousel.isUsed) {
        return;
      }
      carousel.data = {};
      carousel.isUsed = true;
      carousel.draftAnswers = void 0;
      carousel.draftCurrentIndex = void 0;
      carousel.draftCollapsed = void 0;
      carousel.completion.complete({ answers: void 0 });
      this._chatWidgetService.getWidgetBySessionResource(opts.sessionResource)?.input.clearQuestionCarousel(void 0, inputReq.id);
    }));
  }
  _setupPlanReviewInputRequest(part$, planReview, store, opts) {
    const inputReq = part$.get().request;
    const review = createInputRequestPlanReview(inputReq, planReview);
    opts.sink([review]);
    let inputCompleted = false;
    let latestResult = convertProtocolPlanReviewResult(planReview, ChatInputResponseKind.Accept, inputReq.answers);
    let planReviewCleared = false;
    const clearPlanReview = () => {
      if (planReviewCleared) {
        return;
      }
      planReviewCleared = true;
      this._chatWidgetService.getWidgetBySessionResource(opts.sessionResource)?.input.clearPlanReview(void 0, inputReq.id);
    };
    store.add(autorun((reader) => {
      const part = part$.read(reader);
      if (part.response === void 0) {
        return;
      }
      inputCompleted = true;
      latestResult = convertProtocolPlanReviewResult(planReview, part.response, part.request.answers);
      review.data = latestResult;
      review.isUsed = true;
      review.draftFeedback = void 0;
      review.draftCollapsed = void 0;
      void review.completion.complete(latestResult);
      clearPlanReview();
    }));
    review.completion.p.then((result) => {
      if (store.isDisposed || inputCompleted) {
        return;
      }
      const completion = result ? convertPlanReviewResult(planReview, result) : { response: ChatInputResponseKind.Cancel };
      this._config.connection.dispatch(opts.chatURI, {
        type: ActionType.ChatInputCompleted,
        requestId: inputReq.id,
        ...completion
      });
    });
    if (opts.cancellationToken.isCancellationRequested) {
      review.dismiss();
    } else {
      const tokenListener = opts.cancellationToken.onCancellationRequested(() => review.dismiss());
      review.completion.p.finally(() => tokenListener.dispose());
    }
    store.add(toDisposable(() => {
      if (!review.isUsed) {
        if (inputCompleted) {
          review.data = latestResult;
          review.isUsed = true;
          review.draftFeedback = void 0;
          review.draftCollapsed = void 0;
          void review.completion.complete(latestResult);
        } else {
          review.dismiss();
        }
      }
      clearPlanReview();
    }));
  }
  /**
   * Handle a URL-style {@link ChatInputRequest} by rendering a
   * {@link ChatElicitationRequestPart} that prompts the user to open the
   * URL. Clicking the accept button opens the URL via {@link IOpenerService}
   * and dispatches `ChatInputCompleted` with `Accept`; reject dispatches
   * `Decline`; abandonment / cancellation dispatches `Cancel`.
   */
  _setupUrlInputRequest(responsePart$, url, store, opts) {
    const inputReq = responsePart$.get().request;
    let completionDispatched = false;
    let completedFromServer = false;
    const settle = (response) => {
      if (completionDispatched || completedFromServer) {
        return;
      }
      completionDispatched = true;
      this._config.connection.dispatch(opts.chatURI, {
        type: ActionType.ChatInputCompleted,
        requestId: inputReq.id,
        response
      });
    };
    const presentation = getUrlInputRequestPresentation(inputReq, url);
    const part = new ChatElicitationRequestPart(
      localize("agentHost.elicit.url.title", "Authorization Required"),
      presentation.message,
      "",
      localize("agentHost.elicit.url.open", "Open {0}", presentation.authority),
      localize("agentHost.elicit.url.cancel", "Cancel"),
      async () => {
        try {
          const opened = await this._openerService.open(url, { allowCommands: false });
          if (opened) {
            settle(ChatInputResponseKind.Accept);
            return ElicitationState.Accepted;
          }
          settle(ChatInputResponseKind.Decline);
          return ElicitationState.Rejected;
        } catch {
          settle(ChatInputResponseKind.Decline);
          return ElicitationState.Rejected;
        }
      },
      async () => {
        settle(ChatInputResponseKind.Decline);
        return ElicitationState.Rejected;
      }
    );
    opts.sink([part]);
    store.add(autorun((reader) => {
      const response = responsePart$.read(reader).response;
      if (response === void 0) {
        return;
      }
      completedFromServer = true;
      part.state.set(response === ChatInputResponseKind.Accept ? ElicitationState.Accepted : ElicitationState.Rejected, void 0);
      part.hide();
    }));
    if (opts.cancellationToken.isCancellationRequested) {
      settle(ChatInputResponseKind.Cancel);
      part.hide();
    } else {
      const tokenListener = opts.cancellationToken.onCancellationRequested(() => {
        settle(ChatInputResponseKind.Cancel);
        part.hide();
      });
      store.add(toDisposable(() => tokenListener.dispose()));
    }
    store.add(toDisposable(() => {
      settle(ChatInputResponseKind.Cancel);
      part.hide();
    }));
  }
  /**
   * Synchronizes PTY and non-PTY terminal content, including the live-to-retained output handoff, and updates invocation metadata.
   */
  _reviveTerminalIfNeeded(invocation, tc, backendSession, outputTerminalAttachment) {
    if (tc.status !== ToolCallStatus.Running && tc.status !== ToolCallStatus.Completed && tc.status !== ToolCallStatus.PendingResultConfirmation) {
      return;
    }
    const terminalContent = getTerminalContent(tc.content);
    const terminalUri = terminalContent?.resource;
    const toolInput = getInlineToolInput(tc.toolInput);
    if (!terminalContent || !terminalUri || !toolInput) {
      return;
    }
    invocation.presentation = void 0;
    const sessionId = makeAhpTerminalToolSessionId(terminalUri, backendSession);
    const terminalCommandUri = URI.parse(terminalUri);
    const isPty = terminalContent.isPty !== false;
    const terminalInstance = isPty ? this._ensureTerminalInstance(terminalUri, sessionId) : void 0;
    const hasRetainedNonPtySnapshot = tc.status === ToolCallStatus.Completed && !isPty && terminalContent.result?.exitCode !== void 0 && terminalContent.result.preview !== void 0;
    if (hasRetainedNonPtySnapshot) {
      outputTerminalAttachment.disposable.clear();
      outputTerminalAttachment.sessionId = void 0;
    } else if (!isPty && outputTerminalAttachment.sessionId !== sessionId) {
      outputTerminalAttachment.disposable.value = this._agentHostTerminalService.attachOutputTerminal(this._config.connection, terminalCommandUri, sessionId);
      outputTerminalAttachment.sessionId = sessionId;
    }
    const existing = invocation.toolSpecificData?.kind === "terminal" ? invocation.toolSpecificData : void 0;
    const identityChanged = !!existing && (existing.commandLine.original !== toolInput || existing.terminalToolSessionId !== sessionId || existing.terminalCommandUri?.toString() !== terminalCommandUri.toString());
    if (!existing || identityChanged) {
      invocation.toolSpecificData = {
        ...existing,
        kind: "terminal",
        commandLine: { original: toolInput },
        language: "shellscript",
        terminalToolSessionId: sessionId,
        terminalCommandUri,
        isPty,
        terminalCommandId: identityChanged ? void 0 : existing?.terminalCommandId,
        terminalCommandOutput: identityChanged ? void 0 : existing?.terminalCommandOutput,
        terminalCommandState: identityChanged ? void 0 : existing?.terminalCommandState,
        terminalTheme: identityChanged ? void 0 : existing?.terminalTheme
      };
      invocation.notifyToolSpecificDataChanged();
    }
    const current = invocation.toolSpecificData?.kind === "terminal" ? invocation.toolSpecificData : void 0;
    if (!terminalInstance || current?.terminalCommandId) {
      if (terminalInstance) {
        void terminalInstance.catch((error) => this._logService.error(`[AgentHost] Failed to revive terminal '${terminalUri}'`, error));
      }
      return;
    }
    void terminalInstance.then(() => {
      const current2 = invocation.toolSpecificData?.kind === "terminal" ? invocation.toolSpecificData : void 0;
      if (!current2 || current2.terminalToolSessionId !== sessionId || current2.terminalCommandId) {
        return;
      }
      const source = this._terminalChatService.getAhpCommandSource(sessionId);
      const command = source?.executingCommandObject ?? source?.commands[source.commands.length - 1];
      if (command?.id) {
        invocation.toolSpecificData = { ...current2, terminalCommandId: command.id };
        invocation.notifyToolSpecificDataChanged();
      }
    }, (error) => this._logService.error(`[AgentHost] Failed to revive terminal '${terminalUri}'`, error));
  }
  // ---- Subagent child session observation ---------------------------------
  /**
   * Enriches serialized history with inner tool calls from subagent child
   * sessions. For each subagent tool call found in the history, subscribes
   * to the corresponding child session and appends its inner tool calls
   * (with `subAgentInvocationId` set) to the response parts.
   */
  async _enrichHistoryWithSubagentCalls(history, parentSession, sessionResource, sessionState, observations) {
    const parentSessionStr = parentSession.toString();
    const parentToolCalls = /* @__PURE__ */ new Map();
    for (const turn of sessionState.turns) {
      for (const responsePart of turn.responseParts) {
        if (responsePart.kind === ResponsePartKind.ToolCall) {
          parentToolCalls.set(responsePart.toolCall.toolCallId, responsePart.toolCall);
        }
      }
    }
    const subagentChats = new Map(sessionState.chats.flatMap(
      (chat) => chat.origin?.kind === ChatOriginKind.Tool ? [[chat.origin.toolCallId, chat]] : []
    ));
    const subagentInsertions = [];
    for (const item of history) {
      if (item.type !== "response") {
        continue;
      }
      for (let i = 0; i < item.parts.length; i++) {
        const part = item.parts[i];
        if (part.kind !== "toolInvocationSerialized") {
          continue;
        }
        const subagentChat = subagentChats.get(part.toolCallId);
        if (subagentChat) {
          const existing = part.toolSpecificData?.kind === "subagent" ? part.toolSpecificData : void 0;
          part.toolSpecificData = {
            ...existing,
            kind: "subagent",
            description: subagentChat.title || existing?.description || (typeof part.invocationMessage === "string" ? part.invocationMessage : part.invocationMessage.value),
            chatResource: subagentChat.resource.toString()
          };
        }
        if (part.toolSpecificData?.kind === "subagent") {
          const childChatUri = part.toolSpecificData.chatResource ?? subagentChat?.resource.toString() ?? buildSubagentChatUri(parentSessionStr, part.toolCallId);
          part.toolSpecificData.chatResource = childChatUri;
          subagentInsertions.push({ item, index: i, toolCallId: part.toolCallId, childChatUri });
        }
      }
    }
    if (subagentInsertions.length === 0) {
      return;
    }
    const childStateByUri = /* @__PURE__ */ new Map();
    const getChildState = (childChatUri) => {
      let existing = childStateByUri.get(childChatUri);
      if (!existing) {
        existing = this._loadSubagentState(parentSessionStr, childChatUri).then((state) => state ? observations.add(state) : void 0);
        childStateByUri.set(childChatUri, existing);
      }
      return existing;
    };
    const enrichedInsertions = await Promise.all(subagentInsertions.map(async ({ item, index, toolCallId, childChatUri }) => {
      try {
        const observedState = await getChildState(childChatUri);
        const childState = observedState?.getState();
        let parentPart = item.parts[index];
        if (childState) {
          this._applySubagentUsageToHistoryPart(parentPart, sessionResource, childState);
        }
        const parentToolCall = parentToolCalls.get(toolCallId);
        if (childState?.activeTurn && parentToolCall && parentPart.kind === "toolInvocationSerialized") {
          const serialized = parentPart;
          const invocation = toolCallStateToInvocation(parentToolCall, void 0, parentSession, this._config.connectionAuthority);
          finalizeToolInvocation(invocation, parentToolCall, parentSession, this._config.connectionAuthority);
          invocation.presentation = serialized.presentation;
          if (serialized.toolSpecificData?.kind === "subagent") {
            invocation.toolSpecificData = serialized.toolSpecificData;
          }
          item.parts[index] = invocation;
          parentPart = invocation;
        }
        const innerParts = childState ? this._getSubagentInnerParts(childChatUri, toolCallId, childState) : [];
        if (observedState && childState && (parentPart instanceof ChatToolInvocation || innerParts.some((part) => part instanceof ChatToolInvocation))) {
          observations.add(observedState.onDidChange(() => {
            const latestState = observedState.getState();
            if (latestState) {
              this._refreshRestoredSubagentParts(parentPart, innerParts, sessionResource, childChatUri, latestState);
            }
          }));
        }
        return { item, index, innerParts };
      } catch (err) {
        this._logService.warn(`[AgentHost] Failed to enrich history with subagent calls: ${childChatUri}`, err);
        return { item, index, innerParts: [] };
      }
    }));
    for (const { item, index, innerParts } of enrichedInsertions.sort((a, b) => b.index - a.index)) {
      if (innerParts.length > 0) {
        item.parts.splice(index + 1, 0, ...innerParts);
      }
    }
  }
  async _loadSubagentState(parentSessionUri, childChatUri) {
    const childSub = this._ensureSessionSubscription(parentSessionUri);
    try {
      await this._whenSubscriptionHydrated(childSub, CancellationToken.None);
      if (childSub.value instanceof Error) {
        throw childSub.value;
      }
      const childChatSub = this._ensureChatSubscription(parentSessionUri, childChatUri);
      await this._whenSubscriptionHydrated(childChatSub, CancellationToken.None);
      if (childChatSub.value instanceof Error) {
        throw childChatSub.value;
      }
      const store = new DisposableStore();
      const onDidChange = store.add(new Emitter());
      store.add(childSub.onDidChange(() => onDidChange.fire()));
      store.add(childChatSub.onDidChange(() => onDidChange.fire()));
      store.add(toDisposable(() => this._releaseChatSessionSubscriptions(parentSessionUri, childChatUri)));
      return {
        onDidChange: onDidChange.event,
        getState: () => this._getSessionState(parentSessionUri, childChatUri),
        dispose: () => store.dispose()
      };
    } catch (error) {
      this._releaseChatSessionSubscriptions(parentSessionUri, childChatUri);
      throw error;
    }
  }
  /**
   * Writes a subagent's accumulated cost (AIC) and model — summed across its
   * child session's turns — onto its serialized subagent tool call so the
   * hover survives a reload. Mirrors the live observers in
   * {@link _setupServerToolCall}.
   */
  _applySubagentUsageToHistoryPart(part, sessionResource, childState) {
    if (part.kind !== "toolInvocationSerialized" && part.kind !== "toolInvocation" || part.toolSpecificData?.kind !== "subagent") {
      return;
    }
    let credits = 0;
    let modelName;
    const turns = childState.activeTurn && !childState.turns.some((turn) => turn.id === childState.activeTurn?.id) ? [...childState.turns, childState.activeTurn] : childState.turns;
    for (const turn of turns) {
      const turnCredits = usageInfoToChatUsage(turn.usage)?.copilotCredits;
      if (typeof turnCredits === "number") {
        credits += turnCredits;
      }
      const turnModelId = this._toLanguageModelId(sessionResource, turn.usage?.model);
      const turnModelName = this._getLanguageModelDisplayName(turnModelId);
      if (turnModelName) {
        modelName = turnModelName;
      }
    }
    if (credits > 0) {
      part.toolSpecificData.credits = credits;
    }
    if (modelName && !part.toolSpecificData.modelName) {
      part.toolSpecificData.modelName = modelName;
    }
    const timing = getSubagentTiming(childState);
    part.toolSpecificData.isActive = !!childState.activeTurn;
    part.toolSpecificData.startedAt = timing.startedAt;
    part.toolSpecificData.duration = timing.duration;
    if (part instanceof ChatToolInvocation) {
      part.notifyToolSpecificDataChanged();
    }
  }
  _refreshRestoredSubagentParts(parentPart, innerParts, sessionResource, childChatUri, childState) {
    this._applySubagentUsageToHistoryPart(parentPart, sessionResource, childState);
    const toolCalls = /* @__PURE__ */ new Map();
    const turns = childState.activeTurn && !childState.turns.some((turn) => turn.id === childState.activeTurn?.id) ? [...childState.turns, childState.activeTurn] : childState.turns;
    for (const turn of turns) {
      for (const responsePart of turn.responseParts) {
        if (responsePart.kind === ResponsePartKind.ToolCall) {
          toolCalls.set(responsePart.toolCall.toolCallId, responsePart.toolCall);
        }
      }
    }
    const childResource = URI.parse(childChatUri);
    for (const part of innerParts) {
      if (!(part instanceof ChatToolInvocation)) {
        continue;
      }
      const toolCall = toolCalls.get(part.toolCallId);
      if (!toolCall) {
        continue;
      }
      if ((toolCall.status === ToolCallStatus.Completed || toolCall.status === ToolCallStatus.Cancelled) && !IChatToolInvocation.isComplete(part)) {
        finalizeToolInvocation(part, toolCall, childResource, this._config.connectionAuthority);
      } else if (toolCall.status === ToolCallStatus.Running) {
        updateRunningToolSpecificData(part, toolCall, childResource, this._config.connectionAuthority);
        part.notifyToolSpecificDataChanged();
      }
    }
  }
  _getSubagentInnerParts(childSessionUri, toolCallId, childState) {
    const innerParts = [];
    const turns = childState.activeTurn && !childState.turns.some((turn) => turn.id === childState.activeTurn?.id) ? [...childState.turns, childState.activeTurn] : childState.turns;
    for (const turn of turns) {
      for (const rp of turn.responseParts) {
        if (rp.kind === ResponsePartKind.ToolCall) {
          const tc = rp.toolCall;
          if (tc.status === ToolCallStatus.Completed || tc.status === ToolCallStatus.Cancelled) {
            const completedTc = tc;
            const fileEditParts = completedToolCallToEditParts(completedTc, this._config.connectionAuthority);
            const serialized = completedToolCallToSerialized(completedTc, toolCallId, URI.parse(childSessionUri), this._config.connectionAuthority);
            if (fileEditParts.length > 0) {
              serialized.presentation = ToolInvocationPresentation.Hidden;
            }
            innerParts.push(serialized);
            innerParts.push(...fileEditParts);
          } else {
            innerParts.push(toolCallStateToInvocation(tc, toolCallId, URI.parse(childSessionUri), this._config.connectionAuthority));
          }
        }
      }
    }
    return innerParts;
  }
  /**
   * Subscribes to a child subagent session and forwards its tool calls
   * as progress parts into the parent session's response, with
   * `subAgentInvocationId` set so the renderer groups them under the parent
   * subagent widget.
   *
   * Implementation: builds a per-turn-id keyed observation over the child
   * session's `turns` and `activeTurn`. Each turn id discovered gets its
   * own {@link _observeTurn} instance running in subagent mode (which skips
   * markdown/reasoning/input-request emission and tags tool calls with the
   * parent tool call id). Each per-turn observer self-disposes when its
   * turn reaches a terminal state; the outer observation is torn down when
   * the caller disposes `disposables`.
   */
  _observeSubagentSession(sessionResource, parentSession, parentToolCallId, childChatUri, rootInvocationId, parentInvocation, emitProgress, disposables, subagentContext, perInvocationCreditsAccumulator, perInvocationModel) {
    const parentSessionUri = parentSession.toString();
    const cts = new CancellationTokenSource();
    disposables.add(toDisposable(() => cts.dispose(true)));
    disposables.add(toDisposable(() => {
      if (parentInvocation.toolSpecificData?.kind === "subagent" && parentInvocation.toolSpecificData.isActive) {
        parentInvocation.toolSpecificData.isActive = false;
        parentInvocation.notifyToolSpecificDataChanged();
      }
    }));
    try {
      const childSub = this._ensureSessionSubscription(parentSessionUri);
      const childChatSub = this._ensureChatSubscription(parentSessionUri, childChatUri);
      disposables.add(toDisposable(() => this._releaseChatSessionSubscriptions(parentSessionUri, childChatUri)));
      const childSessionState$ = observableFromSubscription(this, childSub);
      const childChatState$ = observableFromSubscription(this, childChatSub);
      const childState$ = derived((reader) => {
        const session = childSessionState$.read(reader);
        if (!session) {
          return void 0;
        }
        return mergeSessionWithDefaultChat(session, childChatState$.read(reader));
      });
      disposables.add(autorun((reader) => {
        const state = childState$.read(reader);
        if (!state || !state.activeTurn && state.turns.length === 0) {
          return;
        }
        const isActive = !!state.activeTurn;
        if (parentInvocation.toolSpecificData?.kind === "subagent") {
          const timing = getSubagentTiming(state);
          const lastResponsePart = state.activeTurn?.responseParts.at(-1);
          const activity = lastResponsePart?.kind === ResponsePartKind.Markdown ? "markdown" : lastResponsePart?.kind === ResponsePartKind.Reasoning ? "reasoning" : void 0;
          const fallbackDuration = !isActive && timing.duration === void 0 && parentInvocation.toolSpecificData.isActive && parentInvocation.toolSpecificData.startedAt !== void 0 ? Date.now() - parentInvocation.toolSpecificData.startedAt : timing.duration;
          if (parentInvocation.toolSpecificData.isActive !== isActive || parentInvocation.toolSpecificData.activity !== activity || parentInvocation.toolSpecificData.startedAt !== timing.startedAt || parentInvocation.toolSpecificData.duration !== fallbackDuration) {
            parentInvocation.toolSpecificData.isActive = isActive;
            if (activity) {
              parentInvocation.toolSpecificData.activity = activity;
            } else {
              delete parentInvocation.toolSpecificData.activity;
            }
            parentInvocation.toolSpecificData.startedAt = timing.startedAt;
            parentInvocation.toolSpecificData.duration = fallbackDuration;
            parentInvocation.notifyToolSpecificDataChanged();
          }
        }
      }));
      const childTurnIds$ = derived((reader) => {
        const state = childState$.read(reader);
        if (!state) {
          return [];
        }
        const ids = state.turns.map((t) => ({ id: t.id }));
        const activeId = state.activeTurn?.id;
        if (activeId !== void 0 && !state.turns.some((t) => t.id === activeId)) {
          ids.push({ id: activeId });
        }
        return ids;
      });
      disposables.add(autorunPerKeyedItem(
        childTurnIds$,
        (t) => t.id,
        (turnId, _t$, turnStore) => {
          turnStore.add(this._observeTurn({
            backendSession: parentSession,
            sessionResource,
            chatURI: childChatUri,
            turnId,
            sink: emitProgress,
            cancellationToken: cts.token,
            subAgentInvocationId: rootInvocationId,
            subAgentCreditsAccumulator: perInvocationCreditsAccumulator,
            subAgentModelObservable: perInvocationModel
          }));
        }
      ));
    } catch (err) {
      subagentContext.observedToolIds.delete(parentToolCallId);
      this._logService.warn(`[AgentHost] Failed to subscribe to subagent chat: ${childChatUri}`, err);
    }
  }
  // ---- Reconnection to active turn ----------------------------------------
  /**
   * Wires up an ongoing state listener that streams incremental progress
   * from an already-running turn into the chat session's progressObs.
   * This is the reconnection counterpart of {@link _handleTurn}, which
   * handles newly-initiated turns.
   */
  _reconnectToActiveTurn(backendSession, turnId, chatSession, initialProgress, initialResponsePartCount) {
    const sessionKey = backendSession.toString();
    const chatURI = this._getChatURI(chatSession.sessionResource);
    const adoptInvocations = /* @__PURE__ */ new Map();
    for (const item of initialProgress) {
      if (item instanceof ChatToolInvocation) {
        adoptInvocations.set(item.toolCallId, item);
      }
    }
    const seedEmittedLengths = /* @__PURE__ */ new Map();
    const currentState = this._getSessionState(sessionKey, chatURI);
    if (currentState?.activeTurn) {
      for (const rp of currentState.activeTurn.responseParts) {
        if (rp.kind === ResponsePartKind.Markdown || rp.kind === ResponsePartKind.Reasoning) {
          seedEmittedLengths.set(rp.id, rp.content.length);
        }
      }
    }
    const cts = new CancellationTokenSource();
    const reconnectStore = chatSession.registerDisposable(new DisposableStore());
    reconnectStore.add(toDisposable(() => cts.dispose(true)));
    reconnectStore.add(this._observeTurn({
      backendSession,
      sessionResource: chatSession.sessionResource,
      chatURI,
      turnId,
      sink: (parts) => chatSession.appendProgress(parts),
      cancellationToken: cts.token,
      adoptInvocations,
      seedEmittedLengths,
      initialResponsePartCount,
      onTurnEnded: () => {
        chatSession.complete();
        reconnectStore.dispose();
      }
    }));
  }
  // ---- File edit routing ---------------------------------------------------
  /**
   * Ensures the chat model has a snapshot controller bound (creating one
   * via our registered editing-session provider if needed) and returns it.
   * Hydrates the controller from any pending history turns on first access.
   */
  _ensureSnapshotController(sessionResource) {
    const chatModel = this._chatService.getSession(sessionResource);
    if (!chatModel) {
      return void 0;
    }
    if (!chatModel.editingSession) {
      chatModel.startEditingSession();
    }
    const editingSession = chatModel.editingSession;
    if (!(editingSession instanceof AgentHostSnapshotController)) {
      return void 0;
    }
    const pendingTurns = this._pendingHistoryTurns.get(sessionResource);
    if (pendingTurns) {
      this._pendingHistoryTurns.delete(sessionResource);
      for (const turn of pendingTurns) {
        editingSession.ensureRequestCheckpoint(turn.id);
        for (const rp of turn.responseParts) {
          if (rp.kind === ResponsePartKind.ToolCall) {
            editingSession.addToolCallEdits(turn.id, rp.toolCall);
          }
        }
      }
    }
    return editingSession;
  }
  /**
   * Records snapshot data for a completed tool call (so restore-snapshot
   * works) and returns the {@link IChatExternalEdit} progress parts to
   * render the per-file edit pills.
   */
  _hydrateFileEdits(sessionResource, requestId, tc) {
    const controller = this._ensureSnapshotController(sessionResource);
    controller?.addToolCallEdits(requestId, tc);
    if (tc.status !== ToolCallStatus.Completed) {
      return [];
    }
    return completedToolCallToEditParts(tc, this._config.connectionAuthority);
  }
  // ---- Session resolution -------------------------------------------------
  /**
   * Attaches to an existing server-side terminal via the agent host
   * terminal service and registers it with the terminal chat service.
   *
   * Returns the terminal instance created or reused by the terminal service.
   */
  _ensureTerminalInstance(terminalUri, terminalToolSessionId) {
    return this._agentHostTerminalService.reviveTerminal(
      this._config.connection,
      URI.parse(terminalUri),
      terminalToolSessionId
    );
  }
  /** Maps a UI session resource to a backend provider URI. */
  _resolveSessionUri(sessionResource) {
    const provisionalSession = this._provisionalService.get(sessionResource);
    if (provisionalSession) {
      return provisionalSession;
    }
    const rawId = sessionResource.path.substring(1);
    return AgentSession.uri(this._config.backendSessionScheme ?? this._config.provider, rawId);
  }
  _isNewSessionResource(sessionResource) {
    return !!this._config.isNewSession?.(sessionResource) || this._workingDirectoryResolver.isNewSession(sessionResource);
  }
  /**
   * Forks a session at the given request point by creating a new backend
   * session with the `fork` parameter. Returns an {@link IChatSessionItem}
   * pointing to the newly created session.
   */
  async _forkSession(sessionResource, backendSession, request, token) {
    if (token.isCancellationRequested) {
      throw new Error("Cancelled");
    }
    const protocolState = this._getSessionState(backendSession.toString());
    let turnIndex;
    if (request) {
      const requestIdx = protocolState?.turns.findIndex((t) => t.id === request.id);
      if (requestIdx === void 0 || requestIdx < 0) {
        throw new Error(`Cannot fork: turn for request ${request.id} not found in protocol state`);
      }
      turnIndex = requestIdx - 1;
      if (turnIndex < 0) {
        throw new Error("Cannot fork: cannot fork before the first request");
      }
    } else if (protocolState?.turns.length) {
      turnIndex = protocolState.turns.length - 1;
    }
    if (turnIndex === void 0) {
      throw new Error("Cannot fork: no turns to fork from");
    }
    const turnId = protocolState.turns[turnIndex].id;
    const chatModel = this._chatService.getSession(sessionResource);
    const forkedSession = await this._createAndSubscribe(sessionResource, lastTurnModelSelection(protocolState), {
      session: backendSession,
      turnIndex,
      turnId
    });
    const forkedRawId = AgentSession.id(forkedSession);
    const forkedResource = URI.from({ scheme: this._config.sessionType, path: `/${forkedRawId}` });
    const now = Date.now();
    const forkedTitle = this._getSessionState(forkedSession.toString())?.title;
    const forkedLabel = forkedTitle || chatModel?.title || localize("agentHost.forkedSessionLabel", "Forked Session");
    return {
      resource: forkedResource,
      label: forkedLabel,
      iconPath: getAgentSessionProviderIcon(this._config.sessionType),
      timing: { created: now, lastRequestStarted: now, lastRequestEnded: now }
    };
  }
  async _ensureRequiredAuthentication() {
    const agentInfo = this._getRootState()?.agents.find((a) => a.provider === this._config.provider);
    const protectedResources = agentInfo?.protectedResources ?? [];
    const hasRequiredAuth = protectedResources.some((r) => r.required !== false);
    if (hasRequiredAuth && this._config.resolveAuthentication) {
      const authenticated = await this._config.resolveAuthentication(protectedResources);
      if (!authenticated) {
        throw new Error(localize("agentHost.authRequired", "Authentication is required to start a session. Please sign in and try again."));
      }
    }
    return protectedResources;
  }
  /** Creates a new backend session and subscribes to its state. */
  async _createAndSubscribe(sessionResource, model, fork, config, importConversation, onFailureStage) {
    const workingDirectories = this._resolveRequestedWorkingDirectories(sessionResource);
    const requestedSession = fork ? void 0 : this._resolveSessionUri(sessionResource);
    this._logService.trace(`[AgentHost] Creating new session, model=${model?.id ?? "(default)"}, provider=${this._config.provider}${fork ? `, fork from ${fork.session.toString()} at index ${fork.turnIndex}` : ""}`);
    onFailureStage?.("authentication");
    const protectedResources = await this._ensureRequiredAuthentication();
    const activeClient = this._getCurrentActiveClient();
    const progressToken = generateUuid();
    let session;
    onFailureStage?.("createSession");
    try {
      session = await this._config.connection.createSession({
        session: requestedSession,
        _meta: this._provisionalService.getInitialSessionMetadata(),
        model,
        provider: this._config.provider,
        workingDirectories,
        fork,
        config,
        importConversation,
        activeClient,
        progressToken
      });
    } catch (err) {
      if (this._isAuthRequiredError(err) && this._config.resolveAuthentication) {
        onFailureStage?.("authentication");
        this._logService.info("[AgentHost] Authentication required, prompting user...");
        const authenticated = await this._config.resolveAuthentication(protectedResources);
        if (authenticated) {
          onFailureStage?.("createSession");
          session = await this._config.connection.createSession({
            session: requestedSession,
            _meta: this._provisionalService.getInitialSessionMetadata(),
            model,
            provider: this._config.provider,
            workingDirectories,
            fork,
            config,
            importConversation,
            activeClient,
            progressToken
          });
        } else {
          throw new Error(localize("agentHost.authRequired", "Authentication is required to start a session. Please sign in and try again."));
        }
      } else {
        throw err;
      }
    }
    if (requestedSession && !isEqual(session, requestedSession)) {
      throw new Error(`Agent host returned unexpected session URI. Expected ${requestedSession.toString()}, got ${session.toString()}`);
    }
    this._logService.trace(`[AgentHost] Created session: ${session.toString()}`);
    onFailureStage?.("subscribeSession");
    const newSub = this._ensureSessionSubscription(session.toString());
    this._ensureActiveClientRefreshSubscription(sessionResource, session, newSub);
    if (!this._getSessionState(session.toString())) {
      await this._whenSubscriptionHydrated(newSub, CancellationToken.None);
    }
    const rawState = this._requireRawSessionState(session.toString());
    const chatURI = this._resolveChatUriFromState(sessionResource, rawState);
    this._setChatURI(sessionResource, chatURI);
    const chatSub = this._ensureChatSubscription(session.toString(), chatURI);
    if (!fork) {
      this._activeSessions.get(sessionResource)?.setStateSubscriptions(newSub, chatSub);
    }
    this._ensurePendingMessageSubscription(sessionResource, session);
    this._watchForServerInitiatedTurns(session, sessionResource);
    return session;
  }
  /**
   * Keeps chat model and protocol pending messages synchronized in both directions.
   * No-ops if already subscribed.
   */
  _ensurePendingMessageSubscription(sessionResource, backendSession) {
    if (this._pendingMessageSubscriptions.has(sessionResource)) {
      return;
    }
    const chatModel = this._chatService?.getSession(sessionResource);
    if (chatModel) {
      const store = new DisposableStore();
      this._pendingMessageSubscriptions.set(sessionResource, store);
      this._applyRemotePendingMessages(sessionResource, backendSession);
      store.add(chatModel.onDidChangePendingRequests(() => {
        this._syncPendingMessages(sessionResource, backendSession);
      }));
      this._syncPendingMessages(sessionResource, backendSession);
      const sessionStr = backendSession.toString();
      const chatURI = this._chatURIsBySessionResource.get(sessionResource);
      if (chatURI) {
        const onRemoteChange = () => this._applyRemotePendingMessages(sessionResource, backendSession);
        store.add(this._ensureSessionSubscription(sessionStr).onDidChange(onRemoteChange));
        store.add(this._ensureChatSubscription(sessionStr, chatURI).onDidChange(onRemoteChange));
      }
      return;
    }
    this._pendingMessageSubscriptions.set(sessionResource, this._chatService.onDidCreateModel((model) => {
      if (!isEqual(model.sessionResource, sessionResource)) {
        return;
      }
      this._pendingMessageSubscriptions.deleteAndDispose(sessionResource);
      this._ensurePendingMessageSubscription(sessionResource, backendSession);
    }));
  }
  _ensureDraftSyncSubscription(sessionResource, backendSession, chatKey) {
    if (this._draftSyncSubscriptions.has(sessionResource)) {
      return;
    }
    const store = new DisposableStore();
    this._draftSyncSubscriptions.set(sessionResource, store);
    this._acquireOrWaitForSession(sessionResource, store).then((chatModel) => {
      if (!chatModel || store.isDisposed) {
        return;
      }
      this._installDraftSync(sessionResource, chatModel, backendSession, chatKey, store);
    }, (err) => {
      if (!store.isDisposed) {
        this._logService.error(`[AgentHost] Failed to wait for chat model for draft sync: ${sessionResource.toString()}`, err);
      }
    });
  }
  async _acquireOrWaitForSession(sessionResource, owner) {
    const existing = this._chatService.getSession(sessionResource);
    if (existing) {
      return existing;
    }
    const waitStore = owner.add(new DisposableStore());
    try {
      return await new Promise((resolve) => {
        waitStore.add(toDisposable(() => resolve(void 0)));
        waitStore.add(this._chatService.onDidCreateModel((model) => {
          if (isEqual(model.sessionResource, sessionResource)) {
            resolve(model);
          }
        }));
      });
    } finally {
      waitStore.dispose();
    }
  }
  _installDraftSync(sessionResource, chatModel, backendSession, chatKey, store) {
    const inputModel = chatModel.inputModel;
    if (!inputModel) {
      return;
    }
    const delayer = store.add(new Delayer(AgentHostSessionHandler.DRAFT_SYNC_DEBOUNCE_MS));
    const chatSubscription = this._ensureChatSubscription(backendSession.toString(), chatKey);
    const readRemoteDraft = () => {
      const value = chatSubscription.value;
      return value && !(value instanceof Error) ? value.draft : void 0;
    };
    let syncedDraft = readRemoteDraft();
    let lastRemoteDraft = syncedDraft;
    let appliedRemoteDraft;
    const syncDraft = (state) => {
      if (state?.origin === ChatInputStateOrigin.Remote) {
        return;
      }
      const draft = this._inputStateToDraft(sessionResource, state);
      if (equals(syncedDraft, draft)) {
        return;
      }
      if (appliedRemoteDraft && sameDraftUserContent(draft, appliedRemoteDraft)) {
        syncedDraft = draft;
        return;
      }
      appliedRemoteDraft = void 0;
      syncedDraft = draft;
      this._config.connection.dispatch(chatKey, {
        type: ActionType.ChatDraftChanged,
        draft
      });
    };
    store.add(autorun((reader) => {
      const state = inputModel.state.read(reader);
      delayer.trigger(() => syncDraft(state)).catch(() => {
      });
    }));
    store.add(chatSubscription.onDidChange(() => {
      const remoteDraft = readRemoteDraft();
      if (remoteDraft === lastRemoteDraft) {
        return;
      }
      lastRemoteDraft = remoteDraft;
      if (equals(syncedDraft, remoteDraft)) {
        return;
      }
      const localDraft = this._inputStateToDraft(sessionResource, inputModel.state.get());
      if (!equals(syncedDraft, localDraft)) {
        return;
      }
      syncedDraft = remoteDraft;
      appliedRemoteDraft = remoteDraft;
      this._applyRemoteDraft(inputModel, sessionResource, remoteDraft);
    }));
    store.add(toDisposable(() => {
      delayer.cancel();
      syncDraft(inputModel.state.get());
    }));
  }
  /** Applies a remote draft without replacing local input state the protocol does not carry. */
  _applyRemoteDraft(inputModel, sessionResource, draft) {
    if (!draft) {
      inputModel.setState({
        inputText: "",
        selections: [],
        attachments: [],
        origin: ChatInputStateOrigin.Remote
      });
      return;
    }
    const serializedState = this._draftToInputState(sessionResource, draft);
    if (!serializedState) {
      return;
    }
    const state = reviveSerializableInputState(serializedState);
    const partialState = {
      inputText: state.inputText,
      selections: state.selections,
      attachments: state.attachments,
      mode: state.mode,
      origin: ChatInputStateOrigin.Remote
    };
    if (state.selectedModel) {
      partialState.selectedModel = state.selectedModel;
      partialState.modelConfiguration = state.modelConfiguration;
    }
    inputModel.setState(partialState);
  }
  _inputStateToDraft(sessionResource, state) {
    if (!state) {
      return void 0;
    }
    const model = this._createModelSelection(state.selectedModel?.identifier, state.modelConfiguration);
    const agentUri = state.mode.kind === ChatModeKind.Agent && state.mode.id !== ChatMode.Agent.id ? state.mode.id : void 0;
    const attachments = this._variableEntriesToAttachments(state.attachments, sessionResource, state.inputText);
    if (!state.inputText && !model && !agentUri && attachments.length === 0) {
      return void 0;
    }
    return {
      text: state.inputText,
      origin: { kind: MessageKind.User },
      ...attachments.length > 0 ? { attachments } : {},
      ...model ? { model } : {},
      ...agentUri ? { agent: { uri: agentUri } } : {}
    };
  }
  /**
   * Check if an error is an "authentication required" error.
   * Checks for the AHP_AUTH_REQUIRED error code when available,
   * with a message-based fallback for transports that don't preserve
   * structured error codes (e.g. ProxyChannel).
   */
  _isAuthRequiredError(err) {
    if (err instanceof ProtocolError && err.code === AHP_AUTH_REQUIRED) {
      return true;
    }
    if (err instanceof Error && err.message.includes("Authentication required")) {
      return true;
    }
    return false;
  }
  _createModelSelection(languageModelIdentifier, modelConfiguration) {
    const rawModelId = this._extractRawModelId(languageModelIdentifier);
    if (!rawModelId) {
      return void 0;
    }
    const config = {};
    for (const [key, value] of Object.entries(modelConfiguration ?? {})) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
        config[key] = value;
      }
    }
    return Object.keys(config).length > 0 ? { id: rawModelId, config } : { id: rawModelId };
  }
  _draftToInputState(sessionResource, draft) {
    if (!draft) {
      return void 0;
    }
    const modelId = this._toLanguageModelId(sessionResource, draft.model?.id);
    const metadata = modelId ? this._languageModelsService.lookupLanguageModel(modelId) : void 0;
    const variableData = messageAttachmentsToVariableData(draft.attachments, this._config.connectionAuthority, draft.text);
    const cursor = offsetToPosition(draft.text, draft.text.length);
    return {
      attachments: variableData?.variables ?? [],
      contrib: {},
      inputText: draft.text,
      mode: { id: draft.agent?.uri ?? ChatMode.Agent.id, kind: ChatModeKind.Agent },
      selectedModel: modelId && metadata ? {
        identifier: modelId,
        metadata,
        ...draft.model?.config ? { modelConfiguration: draft.model.config } : {}
      } : void 0,
      selections: [{
        selectionStartLineNumber: cursor.lineNumber,
        selectionStartColumn: cursor.column,
        positionLineNumber: cursor.lineNumber,
        positionColumn: cursor.column
      }]
    };
  }
  /**
   * Extracts the raw model id from a language-model service identifier.
   * E.g. "agent-host-copilot:claude-sonnet-4-20250514" → "claude-sonnet-4-20250514".
   * Foreign extension-host identifiers (`${vendor}/${id}`) are dropped so
   * the agent host falls back to its default model.
   */
  _extractRawModelId(languageModelIdentifier) {
    if (!languageModelIdentifier) {
      return void 0;
    }
    const prefix = this._config.sessionType + ":";
    if (languageModelIdentifier.startsWith(prefix)) {
      return languageModelIdentifier.substring(prefix.length);
    }
    if (languageModelIdentifier.includes("/")) {
      this._logService.warn(`[AgentHost] Dropping foreign model identifier '${languageModelIdentifier}' for session type '${this._config.sessionType}'; falling back to default model.`);
      return void 0;
    }
    return languageModelIdentifier;
  }
  _toLanguageModelId(sessionResource, rawModelId) {
    if (!rawModelId) {
      return void 0;
    }
    const prefix = `${getChatSessionType(sessionResource)}:`;
    return rawModelId.startsWith(prefix) ? rawModelId : `${prefix}${rawModelId}`;
  }
  _getLanguageModelDisplayName(modelIdentifier) {
    if (!modelIdentifier) {
      return void 0;
    }
    const metadata = this._languageModelsService.lookupLanguageModel(modelIdentifier);
    return metadata ? getLanguageModelDisplayNameWithProvider({ identifier: modelIdentifier, metadata }, this._languageModelsService) : void 0;
  }
  _getTurnResponseDetails(sessionResource, backendSession, turn) {
    const fallbackRawModelId = turn?.message?.model?.id ?? lastTurnModelSelection(this._getSessionState(backendSession.toString()))?.id;
    return this._createTurnModelLookup(sessionResource, fallbackRawModelId).toResponseDetails(turn?.usage?.model, turn?.usage);
  }
  /**
   * Builds a per-turn model lookup that namespaces raw AHP model ids into
   * chat-layer language-model ids and resolves human-readable display
   * names via the registered language-model providers (so the chat UI's
   * per-response footer can show e.g. "Claude Opus 4.7" instead of the
   * raw model id). `fallbackRawModelId` is used when a turn's
   * `usage?.model` is not yet set (e.g. older sessions or turns that
   * never reported usage).
   */
  _createTurnModelLookup(sessionResource, fallbackRawModelId) {
    const resolveRaw = (rawModelId) => rawModelId ?? fallbackRawModelId;
    const lookupRawModel = (rawModelId) => {
      const normalizedRaw = rawModelId?.replace(/-(\d+)$/, ".$1");
      for (const candidate of [rawModelId, normalizedRaw !== rawModelId ? normalizedRaw : void 0]) {
        const modelId = this._toLanguageModelId(sessionResource, candidate);
        if (!modelId) {
          continue;
        }
        const model = this._languageModelsService.lookupLanguageModel(modelId);
        if (model) {
          return { identifier: modelId, model, resolvedFromRaw: true };
        }
      }
      return void 0;
    };
    const lookupModel = (rawModelId) => {
      const rawModel = lookupRawModel(rawModelId);
      if (rawModel) {
        return rawModel;
      }
      const fallbackModelId = this._toLanguageModelId(sessionResource, fallbackRawModelId);
      if (fallbackModelId) {
        const model = this._languageModelsService.lookupLanguageModel(fallbackModelId);
        if (model) {
          return { identifier: fallbackModelId, model, resolvedFromRaw: false };
        }
      }
      return void 0;
    };
    return {
      toLanguageModelId: (rawModelId) => this._toLanguageModelId(sessionResource, resolveRaw(rawModelId)),
      toModelDisplayName: (rawModelId) => lookupRawModel(rawModelId)?.model.name,
      toResponseDetails: (rawModelId, usage) => {
        const resolved = lookupModel(rawModelId);
        const billedModelId = resolved && !resolved.resolvedFromRaw ? rawModelId : void 0;
        const responseModel = resolved ? {
          name: getLanguageModelDisplayNameWithProvider({ identifier: resolved.identifier, metadata: resolved.model }, this._languageModelsService),
          pricing: resolved.model.pricing
        } : void 0;
        return formatTurnResponseDetails(responseModel, billedModelId, usage);
      },
      toAutoModeResolution: (usage) => {
        const resolution = readUsageInfoMeta(usage).autoModeResolved;
        const resolved = resolution ? lookupModel(resolution.chosenModel) : void 0;
        const resolvedModelName = resolved?.resolvedFromRaw ? resolved.model.name : void 0;
        return usageInfoToAutoModeResolution(usage, resolvedModelName);
      }
    };
  }
  _resolveRequestedWorkingDirectory(sessionResource) {
    return this._config.resolveWorkingDirectory?.(sessionResource) ?? this._newSessionFolderService.getFolder(sessionResource) ?? this._workingDirectoryResolver.resolve(sessionResource) ?? this._newSessionFolderService.getDefaultFolder() ?? this._workspaceContextService.getWorkspace().folders[0]?.uri;
  }
  _resolveRequestedWorkingDirectories(sessionResource) {
    const primary = this._resolveRequestedWorkingDirectory(sessionResource);
    return computeWorkingDirectories(primary, this._workspaceContextService.getWorkspace().folders.map((folder) => folder.uri), this._getRootState(), this._config.provider);
  }
  /**
   * Ensures the workspace/folder the agent will run in is trusted before a
   * session is spawned. Returns `false` if the user declines.
   *
   * When the agent runs inside the currently open workspace (editor window),
   * gate on workspace trust to match how extension-host chat is gated. When
   * it targets a standalone folder outside the open workspace (Agents window
   * per-session folders), gate on that folder's trust instead. Both request
   * helpers resolve immediately when the target is already trusted, so this
   * never double-prompts.
   */
  async _ensureWorkspaceTrust(sessionResource) {
    const message = localize("agentHost.workspaceTrust", "AI features are currently only supported in trusted workspaces.");
    const workingDirectory = this._resolveRequestedWorkingDirectory(sessionResource);
    if (!workingDirectory || this._workspaceContextService.getWorkspaceFolder(workingDirectory)) {
      return !!await this._workspaceTrustRequestService.requestWorkspaceTrust({ message });
    }
    return !!await this._workspaceTrustRequestService.requestResourcesTrust({ uri: workingDirectory, message });
  }
  _convertVariablesToAttachments(request) {
    const attachments = this._variableEntriesToAttachments(request.variables.variables, request.sessionResource, request.message);
    const explicitCount = attachments.length;
    this._appendActiveEditorAttachments(attachments, request);
    if (attachments.length !== explicitCount) {
      this._logService.trace(`[AgentHost] Forwarded ${attachments.length - explicitCount} active editor attachment(s); ${attachments.length} total`);
    }
    return attachments;
  }
  /**
   * Forward the active editor (which the suggested-context flow omits in agent mode) as ambient context, deduped
   * against files the user attached explicitly. Gated on
   * {@link ChatConfiguration.ImplicitContextActiveEditor} (on by default, off in the Agents window).
   * Unsaved handling lives in {@link _convertVariableToAttachment}.
   */
  _appendActiveEditorAttachments(attachments, request) {
    if (!this._configurationService.getValue(ChatConfiguration.ImplicitContextActiveEditor)) {
      return;
    }
    const implicitContext = this._chatWidgetService.getWidgetBySessionResource(request.sessionResource)?.input.implicitContext;
    if (!implicitContext) {
      return;
    }
    const existingKeys = /* @__PURE__ */ new Set();
    for (const v of request.variables.variables) {
      const key = this._fileEntryDedupeKey(v, request.sessionResource);
      if (key) {
        existingKeys.add(key);
      }
    }
    const skipUntitled = !this._backendInlinesUnsavedEditors();
    for (const entry of implicitContext.values) {
      if (entry.value === void 0) {
        continue;
      }
      if (entry.uri?.scheme === Schemas.vscodeBrowser) {
        continue;
      }
      if (skipUntitled && entry.uri?.scheme === Schemas.untitled) {
        continue;
      }
      const key = this._fileEntryDedupeKey(entry, request.sessionResource);
      if (key) {
        if (existingKeys.has(key)) {
          continue;
        }
        existingKeys.add(key);
      }
      const attachment = this._convertVariableToAttachment(entry, request.sessionResource, request.message);
      if (!Array.isArray(attachment) && attachment) {
        attachments.push(attachment);
      }
    }
  }
  /** Dedupe identity for a file/implicit entry: rebased URI, suffixed with the range for a selection. */
  _fileEntryDedupeKey(entry, sessionResource) {
    if (entry.kind !== "file" && entry.kind !== "implicit") {
      return void 0;
    }
    const value = entry.value;
    const uri = isLocation(value) ? value.uri : value instanceof URI ? value : void 0;
    if (!uri) {
      return void 0;
    }
    const selection = this._entrySelection(entry);
    return this._attachmentDedupeKey(this._rebaseAttachmentUri(uri, sessionResource).toString(), selection);
  }
  /** The selection range carried by a file/implicit entry, or `undefined` for whole-document references. */
  _entrySelection(entry) {
    const location = this._entrySelectionLocation(entry);
    return location ? { range: this._toTextRange(location.range) } : void 0;
  }
  /** Dedupe identity: the bare URI for a whole document, suffixed with the range for a selection. */
  _attachmentDedupeKey(uri, selection) {
    if (!selection) {
      return uri;
    }
    const { start, end } = selection.range;
    return `${uri}#${start.line}:${start.character}-${end.line}:${end.character}`;
  }
  /**
   * Whether this backend reads referenced files from disk (rather than seeing the editor's
   * in-memory buffer) and therefore needs the live text of an unsaved / dirty editor inlined as
   * an embedded resource. Copilot CLI and Codex both run as separate processes with only disk
   * access, so a `@path` mention (or an `untitled:` URI) would give them stale or missing content.
   */
  _backendInlinesUnsavedEditors() {
    return this._config.provider === SessionType.CopilotCLI || this._config.provider === CODEX_AGENT_PROVIDER_ID;
  }
  /** A resource is unsaved when it's untitled or a saved file with in-memory (dirty) changes. */
  _isUnsavedResource(uri) {
    return uri.scheme === Schemas.untitled || this._workingCopyService.isDirty(uri);
  }
  /**
   * Inline the live (in-memory) text of an unsaved editor as an embedded resource so a path-reading backend still
   * gets current content, preserving the entry's selection, range and `_meta`. Selection entries inline only the
   * selected text; whole-document entries inline the full buffer. Returns `undefined` when no loaded text model is
   * available or the inlined text exceeds {@link MAX_INLINED_UNSAVED_EDITOR_BYTES}.
   */
  _buildUnsavedEditorAttachment(uri, v, range) {
    const model = this._modelService.getModel(uri);
    if (!model) {
      return void 0;
    }
    const text = this._getUnsavedEditorAttachmentText(model, this._entryModelSelectionRange(v));
    const buffer = text === void 0 ? void 0 : VSBuffer.fromString(text);
    if (!buffer || buffer.byteLength > MAX_INLINED_UNSAVED_EDITOR_BYTES) {
      this._logService.trace(`[AgentHost] Skipping inline of unsaved editor ${uri.toString()}: exceeds ${MAX_INLINED_UNSAVED_EDITOR_BYTES} byte cap`);
      return void 0;
    }
    const selection = this._entrySelection(v);
    const attachment = {
      type: MessageAttachmentKind.EmbeddedResource,
      label: v.name,
      displayKind: selection ? "selection" : "document",
      data: encodeBase64(buffer),
      contentType: "text/plain"
    };
    if (selection) {
      attachment.selection = selection;
    }
    if (range) {
      attachment.range = range;
    }
    if (v._meta) {
      attachment._meta = v._meta;
    }
    return attachment;
  }
  /**
   * The inline text to send for an unsaved editor: the selected text for a selection, else the whole buffer. Uses the
   * model length APIs so an over-cap buffer is skipped (returns `undefined`) without ever being materialized.
   */
  _getUnsavedEditorAttachmentText(model, range) {
    if (range) {
      const selection = model.validateRange(range);
      const selectionLength = model.getValueLengthInRange(selection);
      if (selectionLength > 0) {
        return selectionLength > MAX_INLINED_UNSAVED_EDITOR_BYTES ? void 0 : model.getValueInRange(selection);
      }
    }
    return model.getValueLength() > MAX_INLINED_UNSAVED_EDITOR_BYTES ? void 0 : model.getValue();
  }
  /** The editor range of a file/implicit selection entry, used to slice the live model; `undefined` otherwise. */
  _entryModelSelectionRange(entry) {
    return this._entrySelectionLocation(entry)?.range;
  }
  /** The {@link Location} of a file/implicit entry that represents a selection, or `undefined` for whole documents. */
  _entrySelectionLocation(entry) {
    const value = entry.value;
    const isSelectionEntry = (entry.kind === "file" || entry.kind === "implicit" && entry.isSelection) && isLocation(value);
    return isSelectionEntry ? value : void 0;
  }
  _variableEntriesToAttachments(variables, sessionResource, messageText) {
    const attachments = [];
    for (const v of variables) {
      const attachment = this._convertVariableToAttachment(v, sessionResource, messageText);
      if (Array.isArray(attachment)) {
        attachments.push(...attachment);
      } else if (attachment) {
        attachments.push(attachment);
      }
    }
    if (attachments.length > 0) {
      this._logService.trace(`[AgentHost] Converted ${attachments.length} attachments from ${variables.length} explicit variables`);
    }
    return attachments;
  }
  _convertVariableToAttachment(v, sessionResource, messageText) {
    const referenceRange = this._toAttachmentReferenceRange(messageText, v.range);
    if ((v.kind === "file" || v.kind === "implicit") && this._backendInlinesUnsavedEditors()) {
      const uri = isLocation(v.value) ? v.value.uri : v.value instanceof URI ? v.value : void 0;
      if (uri && this._isUnsavedResource(uri)) {
        const embedded = this._buildUnsavedEditorAttachment(uri, v, referenceRange);
        if (embedded) {
          return embedded;
        }
        if (uri.scheme !== Schemas.file) {
          return void 0;
        }
      }
    }
    if ((v.kind === "file" || v.kind === "implicit" && v.isSelection) && isLocation(v.value)) {
      return this._toSelectionAttachment(v.value, v.name, "selection", sessionResource, v._meta, referenceRange);
    }
    if (v.kind === "implicit" && isLocation(v.value)) {
      return this._toResourceAttachment(v.value.uri, v.name, "document", sessionResource, v._meta, referenceRange);
    }
    if ((v.kind === "file" || v.kind === "implicit") && v.value instanceof URI) {
      return this._toResourceAttachment(v.value, v.name, "document", sessionResource, v._meta, referenceRange);
    }
    if (v.kind === "directory" && v.value instanceof URI) {
      return this._toResourceAttachment(v.value, v.name, "directory", sessionResource, v._meta, referenceRange);
    }
    if (v.kind === "symbol" && isLocation(v.value)) {
      return this._toSelectionAttachment(v.value, v.name, "symbol", sessionResource, v._meta, referenceRange);
    }
    if (v.kind === "promptFile" && v.value instanceof URI) {
      return this._toResourceAttachment(v.value, v.name, "document", sessionResource, v._meta, referenceRange);
    }
    if (isImageVariableEntry(v)) {
      return this._toImageAttachment(v, sessionResource, referenceRange);
    }
    if (isAgentFeedbackVariableEntry(v)) {
      return this._toAgentFeedbackAttachment(v);
    }
    if (v.kind === "sessionReference" && v.value instanceof URI) {
      const trajectoryPath = this._toSessionReferenceTrajectoryPath(v.value);
      if (!trajectoryPath) {
        return void 0;
      }
      return this._toSessionReferenceAttachments(v, v.value, trajectoryPath, referenceRange);
    }
    if (isBrowserViewVariableEntry(v)) {
      return this._toSimpleAttachment(
        v.name,
        v.modelDescription ?? `Browser page: ${v.name}. The pageId is "${v.browserId}".`,
        {
          ...v._meta,
          [BrowserViewAttachmentMetadataKey]: { browserId: v.browserId, browserUri: v.value.toString() }
        },
        BrowserViewAttachmentDisplayKind,
        referenceRange
      );
    }
    if (v.kind === "element") {
      const correlationId = getElementAttachmentCorrelationId(v) ?? v.id;
      const metadata = { ...v._meta, ...toElementAttachmentMeta(correlationId) };
      const elementAttachment = this._toSimpleAttachment(v.name, v.value, metadata, AgentHostElementAttachmentDisplayKind, referenceRange);
      const imageAttachment = this._toElementImageAttachment(v, sessionResource, metadata);
      return imageAttachment ? [elementAttachment, imageAttachment] : elementAttachment;
    }
    if (v.kind === "paste") {
      return this._toSimpleAttachment(v.name, v.code, v._meta, void 0, referenceRange);
    }
    if (v.kind === "promptText") {
      return this._toSimpleAttachment(v.name, v.value, v._meta, void 0, referenceRange);
    }
    if (v.kind === "workspace") {
      return this._toSimpleAttachment(v.name, v.value, v._meta, "workspace", referenceRange);
    }
    if (v.kind === "string" && typeof v.value === "string") {
      return this._toSimpleAttachment(v.name, v.value, v._meta, void 0, referenceRange);
    }
    const agentHostCompletionKind = getAgentHostCompletionReferenceKind(v);
    if (agentHostCompletionKind === AgentHostCompletionReferenceKind.Command) {
      return this._toSimpleAttachment(v.name, void 0, v._meta, "command", referenceRange);
    }
    if (agentHostCompletionKind === AgentHostCompletionReferenceKind.Skill) {
      return this._toSimpleAttachment(v.name, void 0, v._meta, "skill", referenceRange);
    }
    if (isChatReferenceVariableEntry(v)) {
      return this._toChatReferenceAttachment(v, referenceRange);
    }
    return void 0;
  }
  _toChatReferenceAttachment(v, range) {
    const attachment = {
      type: MessageAttachmentKind.Chat,
      resource: v.value.toString(),
      label: v.name
    };
    if (v.endTurn !== void 0) {
      attachment.endTurn = v.endTurn;
    }
    if (range) {
      attachment.range = range;
    }
    if (v._meta) {
      attachment._meta = v._meta;
    }
    return attachment;
  }
  _toElementImageAttachment(v, sessionResource, metadata) {
    if (v.imageData instanceof Uint8Array) {
      return {
        type: MessageAttachmentKind.EmbeddedResource,
        label: `${v.name} screenshot`,
        displayKind: "image",
        data: encodeBase64(VSBuffer.wrap(v.imageData)),
        contentType: v.imageMimeType ?? "image/png",
        _meta: metadata
      };
    }
    if (URI.isUri(v.imageData)) {
      return this._toResourceAttachment(v.imageData, `${v.name} screenshot`, "image", sessionResource, metadata);
    }
    return void 0;
  }
  _toSessionReferenceAttachment(v, sessionResource, trajectoryPath, range) {
    return this._toSimpleAttachment(
      v.name,
      toSessionReferenceModelRepresentation(v.name, sessionResource, trajectoryPath),
      { ...v._meta ?? {}, ...toSessionReferenceAttachmentMeta(sessionResource) },
      AgentHostSessionReferenceAttachmentDisplayKind,
      range
    );
  }
  _toSessionReferenceAttachments(v, sessionResource, trajectoryPath, range) {
    return [
      this._toSessionReferenceAttachment(v, sessionResource, trajectoryPath, range),
      this._toSessionReferenceTrajectoryAttachment(v, sessionResource, trajectoryPath)
    ];
  }
  _toSessionReferenceTrajectoryAttachment(v, sessionResource, trajectoryPath) {
    return {
      type: MessageAttachmentKind.Resource,
      uri: URI.file(trajectoryPath).toString(),
      label: `${v.name} trajectory`,
      displayKind: AgentHostSessionReferenceTrajectoryAttachmentDisplayKind,
      _meta: { ...v._meta ?? {}, ...toSessionReferenceAttachmentMeta(sessionResource) }
    };
  }
  _toSessionReferenceTrajectoryPath(sessionResource) {
    return buildHostLocalEventsPath(
      sessionResource,
      this._pathService.userHome({ preferLocal: true }),
      (authority) => this._remoteAgentHostService.connections.find((connection) => agentHostAuthority(connection.address) === authority)
    );
  }
  _toResourceAttachment(uri, label, displayKind, sessionResource, _meta, range) {
    const attachmentUri = this._rebaseAttachmentUri(uri, sessionResource);
    const attachment = { type: MessageAttachmentKind.Resource, uri: attachmentUri.toString(), label, displayKind };
    if (range) {
      attachment.range = range;
    }
    if (_meta) {
      attachment._meta = _meta;
    }
    return attachment;
  }
  _toSelectionAttachment(location, label, displayKind, sessionResource, _meta, range) {
    const attachmentUri = this._rebaseAttachmentUri(location.uri, sessionResource);
    const attachment = {
      type: MessageAttachmentKind.Resource,
      uri: attachmentUri.toString(),
      label,
      displayKind,
      selection: { range: this._toTextRange(location.range) }
    };
    if (range) {
      attachment.range = range;
    }
    if (_meta) {
      attachment._meta = _meta;
    }
    return attachment;
  }
  _toImageAttachment(v, sessionResource, range) {
    const buffer = coerceImageBuffer(v.value);
    const contentType = v.mimeType ?? "image/png";
    if (buffer) {
      const attachment = {
        type: MessageAttachmentKind.EmbeddedResource,
        label: v.name,
        displayKind: "image",
        data: encodeBase64(VSBuffer.wrap(buffer)),
        contentType
      };
      if (range) {
        attachment.range = range;
      }
      if (v._meta) {
        attachment._meta = v._meta;
      }
      return attachment;
    }
    const refUri = v.references?.find((r) => URI.isUri(r.reference))?.reference;
    if (URI.isUri(refUri)) {
      return this._toResourceAttachment(refUri, v.name, "image", sessionResource, v._meta, range);
    }
    return void 0;
  }
  _toAgentFeedbackAttachment(v) {
    const annotationsResource = v.annotationsResource?.toString();
    if (annotationsResource && v.feedbackItems.length > 0) {
      return v.feedbackItems.map((item) => {
        const itemMeta = {
          id: item.id,
          text: item.text,
          resourceUri: item.resourceUri.toString(),
          range: this._toTextRange(item.range),
          ...item.replies?.length ? { replies: [...item.replies] } : {}
        };
        return {
          type: MessageAttachmentKind.Annotations,
          label: v.name,
          displayKind: AgentFeedbackAttachmentDisplayKind,
          resource: annotationsResource,
          annotationIds: [item.id],
          _meta: {
            ...v._meta ?? {},
            [AgentFeedbackAttachmentMetadataKey]: {
              sessionResource: v.sessionResource.toString(),
              feedbackItems: [itemMeta]
            }
          }
        };
      });
    }
    const feedbackItems = v.feedbackItems.map((item) => ({
      id: item.id,
      text: item.text,
      resourceUri: item.resourceUri.toString(),
      range: this._toTextRange(item.range),
      ...item.replies?.length ? { replies: [...item.replies] } : {}
    }));
    return this._toSimpleAttachment(
      v.name,
      typeof v.value === "string" ? v.value : void 0,
      {
        ...v._meta ?? {},
        [AgentFeedbackAttachmentMetadataKey]: {
          sessionResource: v.sessionResource.toString(),
          feedbackItems
        }
      },
      AgentFeedbackAttachmentDisplayKind
    );
  }
  _toSimpleAttachment(label, modelRepresentation, _meta, displayKind, range) {
    const attachment = { type: MessageAttachmentKind.Simple, label };
    if (modelRepresentation !== void 0) {
      attachment.modelRepresentation = modelRepresentation;
    }
    if (range) {
      attachment.range = range;
    }
    if (displayKind) {
      attachment.displayKind = displayKind;
    }
    if (_meta) {
      attachment._meta = _meta;
    }
    return attachment;
  }
  _toAttachmentReferenceRange(messageText, range) {
    if (!messageText || !range || range.start < 0 || range.endExclusive > messageText.length || range.start > range.endExclusive) {
      return void 0;
    }
    const start = offsetToPosition(messageText, range.start);
    const end = offsetToPosition(messageText, range.endExclusive);
    return {
      start: { line: start.lineNumber - 1, character: start.column - 1 },
      end: { line: end.lineNumber - 1, character: end.column - 1 }
    };
  }
  _toTextRange(range) {
    return {
      start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
      end: { line: range.endLineNumber - 1, character: range.endColumn - 1 }
    };
  }
  /**
   * Rebase a `file:`-scheme attachment URI from the session's requested
   * working directory onto the server-resolved working directory. This
   * matters on the first turn of a worktree-isolated session, where the
   * provider creates a worktree under a different path than the workspace
   * folder the workbench attached the file from. Returns the URI unchanged
   * if the requested and resolved directories match, the URI is not under
   * the requested directory, or either side is unavailable.
   */
  _rebaseAttachmentUri(uri, sessionResource) {
    const requestedDirectories = this._resolveRequestedWorkingDirectories(sessionResource);
    const requestedDir = requestedDirectories?.[0];
    if (!requestedDir || requestedDir.scheme !== "file") {
      return uri;
    }
    const owningRequestedDirectory = findDeepestContainingWorkingDirectory(uri, requestedDirectories);
    if (!owningRequestedDirectory || !extUriBiasedIgnorePathCase.isEqual(owningRequestedDirectory, requestedDir)) {
      return uri;
    }
    const backendSession = this._resolveSessionUri(sessionResource);
    const rawResolvedDir = this._getSessionState(backendSession.toString())?.workingDirectories?.[0];
    const resolvedDir = typeof rawResolvedDir === "string" ? URI.parse(rawResolvedDir) : rawResolvedDir;
    if (!resolvedDir || resolvedDir.scheme !== "file") {
      return uri;
    }
    if (extUriBiasedIgnorePathCase.isEqual(requestedDir, resolvedDir)) {
      return uri;
    }
    const rel = extUriBiasedIgnorePathCase.relativePath(requestedDir, uri);
    if (rel === void 0) {
      return uri;
    }
    if (rel === "") {
      return resolvedDir;
    }
    return URI.joinPath(resolvedDir, ...rel.split("/"));
  }
  // ---- Lifecycle ----------------------------------------------------------
  // ---- Session subscription helpers ----------------------------------------
  /**
   * Get or create a session subscription. The first call for a given URI
   * triggers a server subscribe; subsequent calls increment the refcount.
   */
  _ensureSessionSubscription(sessionUri) {
    let ref = this._sessionSubscriptions.get(sessionUri);
    if (ref?.object.value instanceof Error) {
      this._sessionSubscriptions.delete(sessionUri);
      ref.dispose();
      this._workingDirectoryRegistrations.deleteAndDispose(sessionUri);
      ref = void 0;
    }
    if (!ref) {
      ref = this._config.connection.getSubscription(StateComponents.Session, URI.parse(sessionUri), "AgentHostSessionHandler");
      this._sessionSubscriptions.set(sessionUri, ref);
      this._workingDirectoryRegistrations.set(sessionUri, this._workingDirectorySynchronizer.register({
        session: URI.parse(sessionUri),
        provider: this._config.provider,
        connection: this._config.connection,
        subscription: ref.object
      }));
    }
    return ref.object;
  }
  /**
   * Get or create the default-chat subscription for a session. Mirrors the
   * refcount lifecycle of {@link _ensureSessionSubscription}.
   */
  _ensureDefaultChatSubscription(sessionUri) {
    let ref = this._defaultChatSubscriptions.get(sessionUri);
    if (ref?.object.value instanceof Error) {
      this._defaultChatSubscriptions.delete(sessionUri);
      ref.dispose();
      ref = void 0;
    }
    if (!ref) {
      const state = this._requireRawSessionState(sessionUri);
      const defaultChat = state.defaultChat;
      if (!defaultChat) {
        throw new Error(`Session ${sessionUri} has no default chat`);
      }
      const chatUri = URI.parse(defaultChat.toString());
      ref = this._config.connection.getSubscription(StateComponents.Chat, chatUri, "AgentHostSessionHandler");
      this._defaultChatSubscriptions.set(sessionUri, ref);
    }
    return ref.object;
  }
  /**
   * Release the subscriptions held by a single chat session on dispose.
   *
   * Unlike {@link _releaseSessionSubscription} (which tears down every chat
   * of a session at once), this only releases the disposed chat's own
   * conversation subscription and never touches sibling peer chats: closing
   * one chat of a multi-chat session must not strand another chat — including
   * one that is concurrently hydrating in {@link provideChatSessionContent} —
   * on a disposed subscription. The session summary subscription (and its
   * lockstep default-chat subscription) is shared by every chat of the
   * session, so it is only torn down once no sibling chat session is still
   * active or mid-hydration for the same backend session.
   */
  _releaseChatSessionSubscriptions(sessionUri, chatUri) {
    if (chatUri !== this._getRawSessionState(sessionUri)?.defaultChat?.toString()) {
      const chatRef2 = this._additionalChatSubscriptions.get(chatUri);
      if (chatRef2) {
        this._additionalChatSubscriptions.delete(chatUri);
        chatRef2.dispose();
      }
    }
    if (this._hasOtherSessionHold(sessionUri)) {
      return;
    }
    const ref = this._sessionSubscriptions.get(sessionUri);
    if (ref) {
      this._sessionSubscriptions.delete(sessionUri);
      ref.dispose();
      this._workingDirectoryRegistrations.deleteAndDispose(sessionUri);
    }
    const chatRef = this._defaultChatSubscriptions.get(sessionUri);
    if (chatRef) {
      this._defaultChatSubscriptions.delete(sessionUri);
      chatRef.dispose();
    }
  }
  /**
   * Returns whether another chat session for the given backend session URI is
   * still active or in the middle of hydrating its subscriptions, so the
   * shared session subscription must be kept alive. Callers invoke this after
   * removing their own entry from {@link _activeSessions}.
   */
  _hasOtherSessionHold(sessionUri) {
    if ((this._hydratingChatSessions.get(sessionUri) ?? 0) > 0) {
      return true;
    }
    for (const resource of this._activeSessions.keys()) {
      if (this._resolveSessionUri(resource).toString() === sessionUri) {
        return true;
      }
    }
    return false;
  }
  /**
   * Read the current optimistic session state for a backend session URI,
   * merged with its default chat so conversation contents (turns, active
   * turn, pending/queued messages, input requests) are visible.
   */
  /**
   * Resolves once a subscription has received its first snapshot (its
   * `value` is no longer `undefined`) — i.e. it has hydrated with state or
   * an error. Resolves immediately if already hydrated or if cancellation
   * is requested.
   */
  _whenSubscriptionHydrated(sub, token) {
    if (sub.value !== void 0 || token.isCancellationRequested) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const store = new DisposableStore();
      const settle = () => {
        store.dispose();
        resolve();
      };
      store.add(sub.onDidChange(() => {
        if (sub.value !== void 0) {
          settle();
        }
      }));
      const onDidError = sub.onDidError;
      if (onDidError) {
        store.add(onDidError(settle));
      }
      store.add(token.onCancellationRequested(settle));
      if (sub.value !== void 0) {
        settle();
      }
    });
  }
  _getSessionState(sessionUri, chatUri) {
    const value = this._getRawSessionState(sessionUri);
    if (!value) {
      return void 0;
    }
    const defaultChat = value.defaultChat?.toString();
    const chatState = chatUri && chatUri !== defaultChat ? this._getAdditionalChatState(chatUri) : this._getDefaultChatState(sessionUri);
    return mergeSessionWithDefaultChat(value, chatState);
  }
  _getRawSessionState(sessionUri) {
    const ref = this._sessionSubscriptions.get(sessionUri);
    const value = ref?.object.value;
    return value && !(value instanceof Error) ? value : void 0;
  }
  _requireRawSessionState(sessionUri) {
    const state = this._getRawSessionState(sessionUri);
    if (!state) {
      throw new Error(`Session state is not hydrated for ${sessionUri}`);
    }
    return state;
  }
  _requireDefaultChatUri(sessionUri) {
    const defaultChat = this._requireRawSessionState(sessionUri).defaultChat;
    if (!defaultChat) {
      throw new Error(`Session ${sessionUri} has no default chat`);
    }
    return defaultChat.toString();
  }
  /** Read the current optimistic default-chat state for a backend session URI. */
  _getDefaultChatState(sessionUri) {
    const ref = this._defaultChatSubscriptions.get(sessionUri);
    if (!ref) {
      return void 0;
    }
    const value = ref.object.value;
    return value && !(value instanceof Error) ? value : void 0;
  }
  /** Read the current optimistic state for an additional peer chat URI. */
  _getAdditionalChatState(chatUri) {
    const ref = this._additionalChatSubscriptions.get(chatUri);
    if (!ref) {
      return void 0;
    }
    const value = ref.object.value;
    return value && !(value instanceof Error) ? value : void 0;
  }
  /**
   * Get or create the subscription for an additional peer chat, keyed by the
   * chat channel URI. Mirrors {@link _ensureDefaultChatSubscription} but for
   * non-default chats so their conversation contents hydrate independently.
   */
  _ensureAdditionalChatSubscription(chatUri) {
    let ref = this._additionalChatSubscriptions.get(chatUri);
    if (ref?.object.value instanceof Error) {
      this._additionalChatSubscriptions.delete(chatUri);
      ref.dispose();
      ref = void 0;
    }
    if (!ref) {
      ref = this._config.connection.getSubscription(StateComponents.Chat, URI.parse(chatUri), "AgentHostSessionHandler");
      this._additionalChatSubscriptions.set(chatUri, ref);
    }
    return ref.object;
  }
  /**
   * Subscribe to the conversation channel of `sessionResource`'s chat and
   * return the {@link IAgentSubscription}. Routes to the default-chat
   * subscription (fragment-less resource) or to an additional peer chat.
   */
  _ensureChatSubscription(sessionUri, chatUri) {
    return chatUri === this._requireDefaultChatUri(sessionUri) ? this._ensureDefaultChatSubscription(sessionUri) : this._ensureAdditionalChatSubscription(chatUri);
  }
  resolveChatResponseUri(_sessionResource, href, _kind) {
    return rewriteAgentHostLinkTarget(href, this._config.connectionAuthority);
  }
  /**
   * Read the current root state.
   */
  _getRootState() {
    const value = this._config.connection.rootState.value;
    return value && !(value instanceof Error) ? value : void 0;
  }
  dispose() {
    for (const [, session] of this._activeSessions) {
      session.dispose();
    }
    this._activeSessions.clear();
    for (const ref of this._sessionSubscriptions.values()) {
      ref.dispose();
    }
    this._sessionSubscriptions.clear();
    for (const ref of this._defaultChatSubscriptions.values()) {
      ref.dispose();
    }
    this._defaultChatSubscriptions.clear();
    for (const ref of this._additionalChatSubscriptions.values()) {
      ref.dispose();
    }
    this._additionalChatSubscriptions.clear();
    super.dispose();
  }
};
AgentHostSessionHandler = __decorateClass([
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, IChatService),
  __decorateParam(3, IChatEditingService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, ITerminalChatService),
  __decorateParam(8, IAgentHostTerminalService),
  __decorateParam(9, IAgentHostSessionWorkingDirectoryResolver),
  __decorateParam(10, IAgentHostSessionWorkingDirectorySynchronizer),
  __decorateParam(11, IAgentHostNewSessionFolderService),
  __decorateParam(12, IAgentHostUntitledProvisionalSessionService),
  __decorateParam(13, IAgentHostImportConversationStore),
  __decorateParam(14, ILanguageModelToolsService),
  __decorateParam(15, IChatWidgetService),
  __decorateParam(16, ILanguageModelsService),
  __decorateParam(17, IOpenerService),
  __decorateParam(18, IAgentHostActiveClientService),
  __decorateParam(19, IChatEntitlementService),
  __decorateParam(20, IWorkspaceTrustRequestService),
  __decorateParam(21, IModelService),
  __decorateParam(22, IWorkingCopyService),
  __decorateParam(23, IConfigurationService),
  __decorateParam(24, IChatResponseFileChangesService),
  __decorateParam(25, IPathService),
  __decorateParam(26, IRemoteAgentHostService),
  __decorateParam(27, IAgentHostCustomizationService),
  __decorateParam(28, ITelemetryService)
], AgentHostSessionHandler);
function toolResultToProtocol(result, toolName) {
  const isError = !!result.toolResultError;
  const defaultPastTense = isError ? `${toolName} failed` : `Ran ${toolName}`;
  const pastTense = typeof result.toolResultMessage === "string" ? result.toolResultMessage : result.toolResultMessage ? { markdown: result.toolResultMessage.value } : defaultPastTense;
  const content = [];
  for (const part of result.content) {
    if (part.kind === "text") {
      content.push({ type: ToolResultContentType.Text, text: part.value });
    } else if (part.kind === "promptTsx") {
      content.push({ type: ToolResultContentType.Text, text: stringifyPromptTsxPart(part) });
    } else if (part.kind === "data") {
      content.push({
        type: ToolResultContentType.EmbeddedResource,
        data: encodeBase64(part.value.data),
        contentType: part.value.mimeType
      });
    }
  }
  return {
    success: !isError,
    pastTenseMessage: pastTense,
    content: content.length > 0 ? content : void 0,
    error: isError ? { message: typeof result.toolResultError === "string" ? result.toolResultError : `${toolName} encountered an error` } : void 0
  };
}
export {
  AgentHostSessionHandler,
  UNOBSERVED_CLIENT_TOOL_GRACE_MS,
  convertCarouselAnswers,
  toolDataToDefinition,
  toolResultToProtocol,
  unwrapSessionLoadErrorMessage
};
