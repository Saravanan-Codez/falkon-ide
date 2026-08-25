import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun, autorunSelfDisposable } from "../../../../../base/common/observable.js";
import { hasKey } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
var ChatErrorLevel = /* @__PURE__ */ ((ChatErrorLevel2) => {
  ChatErrorLevel2[ChatErrorLevel2["Info"] = 0] = "Info";
  ChatErrorLevel2[ChatErrorLevel2["Warning"] = 1] = "Warning";
  ChatErrorLevel2[ChatErrorLevel2["Error"] = 2] = "Error";
  return ChatErrorLevel2;
})(ChatErrorLevel || {});
function isIDocumentContext(obj) {
  return !!obj && typeof obj === "object" && "uri" in obj && obj.uri instanceof URI && "version" in obj && typeof obj.version === "number" && "ranges" in obj && Array.isArray(obj.ranges) && obj.ranges.every(Range.isIRange);
}
function isIUsedContext(obj) {
  return !!obj && typeof obj === "object" && "documents" in obj && Array.isArray(obj.documents) && obj.documents.every(isIDocumentContext);
}
function isChatContentVariableReference(obj) {
  return !!obj && typeof obj === "object" && typeof obj.variableName === "string";
}
var ChatResponseReferencePartStatusKind = /* @__PURE__ */ ((ChatResponseReferencePartStatusKind2) => {
  ChatResponseReferencePartStatusKind2[ChatResponseReferencePartStatusKind2["Complete"] = 1] = "Complete";
  ChatResponseReferencePartStatusKind2[ChatResponseReferencePartStatusKind2["Partial"] = 2] = "Partial";
  ChatResponseReferencePartStatusKind2[ChatResponseReferencePartStatusKind2["Omitted"] = 3] = "Omitted";
  return ChatResponseReferencePartStatusKind2;
})(ChatResponseReferencePartStatusKind || {});
var ChatResponseClearToPreviousToolInvocationReason = /* @__PURE__ */ ((ChatResponseClearToPreviousToolInvocationReason2) => {
  ChatResponseClearToPreviousToolInvocationReason2[ChatResponseClearToPreviousToolInvocationReason2["NoReason"] = 0] = "NoReason";
  ChatResponseClearToPreviousToolInvocationReason2[ChatResponseClearToPreviousToolInvocationReason2["FilteredContentRetry"] = 1] = "FilteredContentRetry";
  ChatResponseClearToPreviousToolInvocationReason2[ChatResponseClearToPreviousToolInvocationReason2["CopyrightContentRetry"] = 2] = "CopyrightContentRetry";
  return ChatResponseClearToPreviousToolInvocationReason2;
})(ChatResponseClearToPreviousToolInvocationReason || {});
function formatCopilotCredits(credits) {
  return parseFloat(credits.toFixed(1)).toString();
}
class ChatMultiDiffData {
  constructor(opts) {
    this.kind = "multiDiffData";
    this.readOnly = opts.readOnly;
    this.collapsed = opts.collapsed;
    this.multiDiffData = opts.multiDiffData;
  }
  toJSON() {
    return {
      kind: this.kind,
      multiDiffData: hasKey(this.multiDiffData, { title: true }) ? this.multiDiffData : this.multiDiffData.get(),
      collapsed: this.collapsed,
      readOnly: this.readOnly
    };
  }
}
var ElicitationState = /* @__PURE__ */ ((ElicitationState2) => {
  ElicitationState2["Pending"] = "pending";
  ElicitationState2["Accepted"] = "accepted";
  ElicitationState2["Rejected"] = "rejected";
  return ElicitationState2;
})(ElicitationState || {});
function isLegacyChatTerminalToolInvocationData(data) {
  return !!data && typeof data === "object" && "command" in data && "language" in data;
}
var ToolConfirmKind = /* @__PURE__ */ ((ToolConfirmKind2) => {
  ToolConfirmKind2[ToolConfirmKind2["Denied"] = 0] = "Denied";
  ToolConfirmKind2[ToolConfirmKind2["ConfirmationNotNeeded"] = 1] = "ConfirmationNotNeeded";
  ToolConfirmKind2[ToolConfirmKind2["Setting"] = 2] = "Setting";
  ToolConfirmKind2[ToolConfirmKind2["LmServicePerTool"] = 3] = "LmServicePerTool";
  ToolConfirmKind2[ToolConfirmKind2["UserAction"] = 4] = "UserAction";
  ToolConfirmKind2[ToolConfirmKind2["Skipped"] = 5] = "Skipped";
  return ToolConfirmKind2;
})(ToolConfirmKind || {});
var IChatToolInvocation;
((IChatToolInvocation2) => {
  let StateKind;
  ((StateKind2) => {
    StateKind2[StateKind2["Streaming"] = 0] = "Streaming";
    StateKind2[StateKind2["WaitingForConfirmation"] = 1] = "WaitingForConfirmation";
    StateKind2[StateKind2["Executing"] = 2] = "Executing";
    StateKind2[StateKind2["WaitingForPostApproval"] = 3] = "WaitingForPostApproval";
    StateKind2[StateKind2["Completed"] = 4] = "Completed";
    StateKind2[StateKind2["Cancelled"] = 5] = "Cancelled";
    StateKind2[StateKind2["WaitingForAuthentication"] = 6] = "WaitingForAuthentication";
  })(StateKind = IChatToolInvocation2.StateKind || (IChatToolInvocation2.StateKind = {}));
  function executionConfirmedOrDenied(invocation, reader) {
    if (invocation.kind === "toolInvocationSerialized") {
      if (invocation.isConfirmed === void 0 || typeof invocation.isConfirmed === "boolean") {
        return { type: invocation.isConfirmed ? 4 /* UserAction */ : 0 /* Denied */ };
      }
      return invocation.isConfirmed;
    }
    const state = invocation.state.read(reader);
    if (state.type === 0 /* Streaming */ || state.type === 1 /* WaitingForConfirmation */) {
      return void 0;
    }
    if (state.type === 5 /* Cancelled */) {
      return { type: state.reason };
    }
    return state.confirmed;
  }
  IChatToolInvocation2.executionConfirmedOrDenied = executionConfirmedOrDenied;
  function awaitConfirmation(invocation, token) {
    const reason = executionConfirmedOrDenied(invocation);
    if (reason) {
      return Promise.resolve(reason);
    }
    const store = new DisposableStore();
    return new Promise((resolve) => {
      if (token) {
        store.add(token.onCancellationRequested(() => {
          resolve({ type: 0 /* Denied */ });
        }));
      }
      store.add(autorun((reader) => {
        const reason2 = executionConfirmedOrDenied(invocation, reader);
        if (reason2) {
          store.dispose();
          resolve(reason2);
        }
      }));
    }).finally(() => {
      store.dispose();
    });
  }
  IChatToolInvocation2.awaitConfirmation = awaitConfirmation;
  function postApprovalConfirmedOrDenied(invocation, reader) {
    const state = invocation.state.read(reader);
    if (state.type === 4 /* Completed */) {
      return state.postConfirmed || { type: 1 /* ConfirmationNotNeeded */ };
    }
    if (state.type === 5 /* Cancelled */) {
      return { type: state.reason };
    }
    return void 0;
  }
  function confirmWith(invocation, reason) {
    const state = invocation?.state.get();
    if (state?.type === 1 /* WaitingForConfirmation */ || state?.type === 3 /* WaitingForPostApproval */) {
      state.confirm(reason);
      return true;
    }
    return false;
  }
  IChatToolInvocation2.confirmWith = confirmWith;
  function awaitPostConfirmation(invocation, token) {
    const reason = postApprovalConfirmedOrDenied(invocation);
    if (reason) {
      return Promise.resolve(reason);
    }
    const store = new DisposableStore();
    return new Promise((resolve) => {
      if (token) {
        store.add(token.onCancellationRequested(() => {
          resolve({ type: 0 /* Denied */ });
        }));
      }
      store.add(autorun((reader) => {
        const reason2 = postApprovalConfirmedOrDenied(invocation, reader);
        if (reason2) {
          store.dispose();
          resolve(reason2);
        }
      }));
    }).finally(() => {
      store.dispose();
    });
  }
  IChatToolInvocation2.awaitPostConfirmation = awaitPostConfirmation;
  function resultDetails(invocation, reader) {
    if (invocation.kind === "toolInvocationSerialized") {
      return invocation.resultDetails;
    }
    const state = invocation.state.read(reader);
    if (state.type === 4 /* Completed */ || state.type === 3 /* WaitingForPostApproval */) {
      return state.resultDetails;
    }
    return void 0;
  }
  IChatToolInvocation2.resultDetails = resultDetails;
  function isComplete(invocation, reader) {
    if (invocation.kind === "toolInvocationSerialized") {
      return true;
    }
    const state = invocation.state.read(reader);
    return state.type === 4 /* Completed */ || state.type === 5 /* Cancelled */;
  }
  IChatToolInvocation2.isComplete = isComplete;
  function isEffectivelyHidden(invocation, reader) {
    if (invocation.presentation === "hidden") {
      return true;
    }
    if (invocation.presentation === "hiddenAfterComplete" && isComplete(invocation, reader)) {
      return true;
    }
    return false;
  }
  IChatToolInvocation2.isEffectivelyHidden = isEffectivelyHidden;
  function isStreaming(invocation, reader) {
    if (invocation.kind === "toolInvocationSerialized") {
      return false;
    }
    const state = invocation.state.read(reader);
    return state.type === 0 /* Streaming */;
  }
  IChatToolInvocation2.isStreaming = isStreaming;
  function getParameters(invocation, reader) {
    if (invocation.kind === "toolInvocationSerialized") {
      return void 0;
    }
    const state = invocation.state.read(reader);
    if (state.type === 0 /* Streaming */) {
      return void 0;
    }
    return state.parameters;
  }
  IChatToolInvocation2.getParameters = getParameters;
  function getConfirmationMessages(invocation, reader) {
    if (invocation.kind === "toolInvocationSerialized") {
      return void 0;
    }
    const state = invocation.state.read(reader);
    if (state.type === 0 /* Streaming */) {
      return void 0;
    }
    return state.confirmationMessages;
  }
  IChatToolInvocation2.getConfirmationMessages = getConfirmationMessages;
})(IChatToolInvocation || (IChatToolInvocation = {}));
var AgentFeedbackReviewCommandId = /* @__PURE__ */ ((AgentFeedbackReviewCommandId2) => {
  AgentFeedbackReviewCommandId2["GetComments"] = "_agentFeedbackReview.getComments";
  AgentFeedbackReviewCommandId2["Reveal"] = "_agentFeedbackReview.reveal";
  AgentFeedbackReviewCommandId2["RevealAt"] = "_agentFeedbackReview.revealAt";
  AgentFeedbackReviewCommandId2["Delete"] = "_agentFeedbackReview.delete";
  AgentFeedbackReviewCommandId2["Accept"] = "_agentFeedbackReview.accept";
  return AgentFeedbackReviewCommandId2;
})(AgentFeedbackReviewCommandId || {});
class ChatMcpServersStarting {
  constructor(state) {
    this.state = state;
    this.kind = "mcpServersStarting";
    this.didStartServerIds = [];
  }
  get isEmpty() {
    const s = this.state.get();
    return !s.working && s.serversRequiringInteraction.length === 0;
  }
  wait() {
    return new Promise((resolve) => {
      autorunSelfDisposable((reader) => {
        const s = this.state.read(reader);
        if (!s.working) {
          reader.dispose();
          resolve(s);
        }
      });
    });
  }
  toJSON() {
    return { kind: "mcpServersStarting", didStartServerIds: this.didStartServerIds };
  }
}
function isChatFollowup(obj) {
  return !!obj && obj.kind === "reply" && typeof obj.message === "string" && typeof obj.agentId === "string";
}
var ChatAgentVoteDirection = /* @__PURE__ */ ((ChatAgentVoteDirection2) => {
  ChatAgentVoteDirection2[ChatAgentVoteDirection2["Down"] = 0] = "Down";
  ChatAgentVoteDirection2[ChatAgentVoteDirection2["Up"] = 1] = "Up";
  return ChatAgentVoteDirection2;
})(ChatAgentVoteDirection || {});
var ChatCopyKind = /* @__PURE__ */ ((ChatCopyKind2) => {
  ChatCopyKind2[ChatCopyKind2["Action"] = 1] = "Action";
  ChatCopyKind2[ChatCopyKind2["Toolbar"] = 2] = "Toolbar";
  return ChatCopyKind2;
})(ChatCopyKind || {});
function convertLegacyChatSessionTiming(timing) {
  if (hasKey(timing, { created: true })) {
    return timing;
  }
  return {
    created: timing.startTime,
    lastRequestStarted: timing.startTime,
    lastRequestEnded: timing.endTime
  };
}
var ResponseModelState = /* @__PURE__ */ ((ResponseModelState2) => {
  ResponseModelState2[ResponseModelState2["Pending"] = 0] = "Pending";
  ResponseModelState2[ResponseModelState2["Complete"] = 1] = "Complete";
  ResponseModelState2[ResponseModelState2["Cancelled"] = 2] = "Cancelled";
  ResponseModelState2[ResponseModelState2["Failed"] = 3] = "Failed";
  ResponseModelState2[ResponseModelState2["NeedsInput"] = 4] = "NeedsInput";
  return ResponseModelState2;
})(ResponseModelState || {});
var ChatSendResult;
((ChatSendResult2) => {
  function isSent(result) {
    return result.kind === "sent";
  }
  ChatSendResult2.isSent = isSent;
  function isRejected(result) {
    return result.kind === "rejected";
  }
  ChatSendResult2.isRejected = isRejected;
  function isQueued(result) {
    return result.kind === "queued";
  }
  ChatSendResult2.isQueued = isQueued;
  function assertSent(result) {
    if (result.kind !== "sent") {
      throw new Error(`Expected ChatSendResult to be 'sent', but was '${result.kind}'`);
    }
  }
  ChatSendResult2.assertSent = assertSent;
})(ChatSendResult || (ChatSendResult = {}));
var ChatRequestQueueKind = /* @__PURE__ */ ((ChatRequestQueueKind2) => {
  ChatRequestQueueKind2["Queued"] = "queued";
  ChatRequestQueueKind2["Steering"] = "steering";
  return ChatRequestQueueKind2;
})(ChatRequestQueueKind || {});
const IChatService = createDecorator("IChatService");
const KEYWORD_ACTIVIATION_SETTING_ID = "accessibility.voice.keywordActivation";
const ChatStopCancellationNoopEventName = "chat.stopCancellationNoop";
const ChatPendingRequestChangeEventName = "chat.pendingRequestChange";
export {
  AgentFeedbackReviewCommandId,
  ChatAgentVoteDirection,
  ChatCopyKind,
  ChatErrorLevel,
  ChatMcpServersStarting,
  ChatMultiDiffData,
  ChatPendingRequestChangeEventName,
  ChatRequestQueueKind,
  ChatResponseClearToPreviousToolInvocationReason,
  ChatResponseReferencePartStatusKind,
  ChatSendResult,
  ChatStopCancellationNoopEventName,
  ElicitationState,
  IChatService,
  IChatToolInvocation,
  KEYWORD_ACTIVIATION_SETTING_ID,
  ResponseModelState,
  ToolConfirmKind,
  convertLegacyChatSessionTiming,
  formatCopilotCredits,
  isChatContentVariableReference,
  isChatFollowup,
  isIDocumentContext,
  isIUsedContext,
  isLegacyChatTerminalToolInvocationData
};
