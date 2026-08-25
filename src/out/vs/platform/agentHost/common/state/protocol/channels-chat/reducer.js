import { ActionType } from "../common/actions.js";
import { TurnState, ToolCallStatus, ToolCallConfirmationReason, ToolCallCancellationReason, ToolCallContributorKind, ResponsePartKind, PendingMessageKind } from "./state.js";
import { SessionStatus } from "../channels-session/state.js";
import { softAssertNever } from "../common/reducer-helpers.js";
function tcBase(tc) {
  return {
    toolCallId: tc.toolCallId,
    toolName: tc.toolName,
    displayName: tc.displayName,
    intention: tc.intention,
    contributor: tc.contributor,
    _meta: tc._meta
  };
}
function tcBaseWithMeta(tc, meta) {
  return {
    ...tcBase(tc),
    _meta: meta ?? tc._meta
  };
}
function refineToolCallContributor(current, next, log) {
  if (!next) {
    return current;
  }
  if (current?.kind === ToolCallContributorKind.Client) {
    if (next.kind === ToolCallContributorKind.Client && next.clientId === current.clientId) {
      return next;
    }
    log?.(`Ignoring contributor change for client tool call from '${current.clientId}'`);
    return current;
  }
  if (next.kind === ToolCallContributorKind.Client) {
    log?.(`Ignoring late client contributor '${next.clientId}' because client execution ownership must be established at tool call start`);
    return current;
  }
  return next;
}
function resolveSelectedOption(options, id) {
  if (!id || !options) {
    return void 0;
  }
  return options.find((o) => o.id === id);
}
function hasBlockingToolCall(state) {
  if (!state.activeTurn) {
    return false;
  }
  return state.activeTurn.responseParts.some(
    (part) => part.kind === ResponsePartKind.ToolCall && (part.toolCall.status === ToolCallStatus.PendingConfirmation || part.toolCall.status === ToolCallStatus.PendingResultConfirmation || part.toolCall.status === ToolCallStatus.AuthRequired)
  );
}
function hasOpenInputRequest(state) {
  return state.activeTurn?.responseParts.some(
    (part) => part.kind === ResponsePartKind.InputRequest && part.response === void 0
  ) ?? false;
}
function findOpenInputRequestPart(responseParts, requestId) {
  const index = responseParts.findIndex(
    (part2) => part2.kind === ResponsePartKind.InputRequest && part2.response === void 0 && part2.request.id === requestId
  );
  if (index < 0) {
    return void 0;
  }
  const part = responseParts[index];
  return part.kind === ResponsePartKind.InputRequest ? { index, part } : void 0;
}
const STATUS_ACTIVITY_MASK = (1 << 5) - 1;
function withStatusFlag(status, flag, set) {
  return set ? status | flag : status & ~flag;
}
function summaryStatus(state, terminalStatus) {
  let activity;
  if (terminalStatus) {
    activity = terminalStatus;
  } else if (hasOpenInputRequest(state) || hasBlockingToolCall(state)) {
    activity = SessionStatus.InputNeeded;
  } else if (state.activeTurn) {
    activity = SessionStatus.InProgress;
  } else {
    activity = SessionStatus.Idle;
  }
  return state.status & ~STATUS_ACTIVITY_MASK | activity;
}
function refreshSummaryStatus(state) {
  const status = summaryStatus(state);
  if (status === state.status) {
    return state;
  }
  return { ...state, status };
}
function endTurn(state, turnId, turnState, duration, terminalStatus, error) {
  if (!state.activeTurn || state.activeTurn.id !== turnId) {
    return state;
  }
  const active = state.activeTurn;
  const responseParts = active.responseParts.map((part) => {
    if (part.kind !== ResponsePartKind.ToolCall) {
      return part;
    }
    const tc = part.toolCall;
    if (tc.status === ToolCallStatus.Completed || tc.status === ToolCallStatus.Cancelled) {
      return part;
    }
    return {
      kind: ResponsePartKind.ToolCall,
      toolCall: {
        status: ToolCallStatus.Cancelled,
        ...tcBase(tc),
        invocationMessage: tc.status === ToolCallStatus.Streaming ? tc.invocationMessage ?? "" : tc.invocationMessage,
        toolInput: tc.status === ToolCallStatus.Streaming ? void 0 : tc.toolInput,
        reason: ToolCallCancellationReason.Skipped
      }
    };
  });
  const turn = {
    id: active.id,
    startedAt: active.startedAt,
    // Defensive clamp: the duration is producer-supplied and opaque to this
    // reducer, but a negative value would be nonsensical to display.
    duration: Math.max(0, duration),
    message: active.message,
    responseParts,
    usage: active.usage,
    state: turnState,
    error
  };
  const next = {
    ...state,
    turns: [...state.turns, turn],
    activeTurn: void 0,
    modifiedAt: new Date(Date.now()).toISOString()
  };
  return {
    ...next,
    status: summaryStatus(next, terminalStatus)
  };
}
function upsertInputRequestPart(state, request) {
  const activeTurn = state.activeTurn;
  if (!activeTurn) {
    return state;
  }
  const existing = findOpenInputRequestPart(activeTurn.responseParts, request.id);
  const responseParts = [...activeTurn.responseParts];
  const part = {
    kind: ResponsePartKind.InputRequest,
    request
  };
  if (existing) {
    part.request = {
      ...request,
      answers: request.answers ?? existing.part.request.answers
    };
    responseParts[existing.index] = part;
  } else {
    responseParts.push(part);
  }
  const next = {
    ...state,
    activeTurn: {
      ...activeTurn,
      responseParts
    }
  };
  return { ...next, status: withStatusFlag(summaryStatus(next), SessionStatus.IsRead, false), modifiedAt: new Date(Date.now()).toISOString() };
}
function updateToolCallInParts(state, turnId, toolCallId, updater) {
  const activeTurn = state.activeTurn;
  if (!activeTurn || activeTurn.id !== turnId) {
    return state;
  }
  let found = false;
  const responseParts = activeTurn.responseParts.map((part) => {
    if (part.kind === ResponsePartKind.ToolCall && part.toolCall.toolCallId === toolCallId) {
      const updated = updater(part.toolCall);
      if (updated === part.toolCall) {
        return part;
      }
      found = true;
      return { ...part, toolCall: updated };
    }
    return part;
  });
  if (!found) {
    return state;
  }
  return {
    ...state,
    activeTurn: { ...activeTurn, responseParts }
  };
}
function updateResponsePart(state, turnId, partId, updater) {
  const activeTurn = state.activeTurn;
  if (!activeTurn || activeTurn.id !== turnId) {
    return state;
  }
  let found = false;
  const responseParts = activeTurn.responseParts.map((part) => {
    if (!found) {
      const id = part.kind === ResponsePartKind.ToolCall ? part.toolCall.toolCallId : "id" in part ? part.id : void 0;
      if (id === partId) {
        found = true;
        return updater(part);
      }
    }
    return part;
  });
  if (!found) {
    return state;
  }
  return {
    ...state,
    activeTurn: { ...activeTurn, responseParts }
  };
}
function chatReducer(state, action, log) {
  switch (action.type) {
    // ── Turn Lifecycle ────────────────────────────────────────────────────
    case ActionType.ChatTurnStarted: {
      let next = {
        ...state,
        activeTurn: {
          id: action.turnId,
          startedAt: action.startedAt,
          message: action.message,
          responseParts: [],
          usage: void 0
        }
      };
      next = {
        ...next,
        status: withStatusFlag(summaryStatus(next), SessionStatus.IsRead, false),
        modifiedAt: new Date(Date.now()).toISOString()
      };
      if (action.queuedMessageId) {
        if (next.steeringMessage?.id === action.queuedMessageId) {
          next = { ...next, steeringMessage: void 0 };
        }
        if (next.queuedMessages) {
          const filtered = next.queuedMessages.filter((m) => m.id !== action.queuedMessageId);
          next = { ...next, queuedMessages: filtered.length > 0 ? filtered : void 0 };
        }
      }
      return next;
    }
    case ActionType.ChatDelta:
      return updateResponsePart(state, action.turnId, action.partId, (part) => {
        if (part.kind === ResponsePartKind.Markdown) {
          return { ...part, content: part.content + action.content };
        }
        return part;
      });
    case ActionType.ChatResponsePart:
      if (!state.activeTurn || state.activeTurn.id !== action.turnId) {
        return state;
      }
      return {
        ...state,
        activeTurn: {
          ...state.activeTurn,
          responseParts: [...state.activeTurn.responseParts, action.part]
        }
      };
    case ActionType.ChatTurnComplete:
      return endTurn(state, action.turnId, TurnState.Complete, action.duration);
    case ActionType.ChatTurnCancelled:
      return endTurn(state, action.turnId, TurnState.Cancelled, action.duration);
    case ActionType.ChatError:
      return endTurn(state, action.turnId, TurnState.Error, action.duration, SessionStatus.Error, action.error);
    case ActionType.ChatActivityChanged:
      return { ...state, activity: action.activity };
    // ── Working Directories ───────────────────────────────────────────────
    case ActionType.ChatWorkingDirectorySet: {
      const list = state.workingDirectories ?? [];
      if (list.includes(action.directory)) {
        return state;
      }
      return { ...state, workingDirectories: [...list, action.directory] };
    }
    case ActionType.ChatWorkingDirectoryRemoved: {
      const list = state.workingDirectories;
      if (!list) {
        return state;
      }
      const idx = list.indexOf(action.directory);
      if (idx < 0) {
        return state;
      }
      const updated = list.slice();
      updated.splice(idx, 1);
      return { ...state, workingDirectories: updated };
    }
    // ── Tool Call State Machine ───────────────────────────────────────────
    case ActionType.ChatToolCallStart:
      if (!state.activeTurn || state.activeTurn.id !== action.turnId) {
        return state;
      }
      return {
        ...state,
        activeTurn: {
          ...state.activeTurn,
          responseParts: [
            ...state.activeTurn.responseParts,
            {
              kind: ResponsePartKind.ToolCall,
              toolCall: {
                toolCallId: action.toolCallId,
                toolName: action.toolName,
                displayName: action.displayName,
                intention: action.intention,
                contributor: action.contributor,
                _meta: action._meta,
                status: ToolCallStatus.Streaming
              }
            }
          ]
        }
      };
    case ActionType.ChatToolCallDelta:
      return updateToolCallInParts(state, action.turnId, action.toolCallId, (tc) => {
        if (tc.status !== ToolCallStatus.Streaming) {
          return tc;
        }
        return {
          ...tc,
          ...action._meta !== void 0 ? { _meta: action._meta } : {},
          ...action.content !== void 0 ? { partialInput: (tc.partialInput ?? "") + action.content } : {},
          invocationMessage: action.invocationMessage ?? tc.invocationMessage
        };
      });
    case ActionType.ChatToolCallReady:
      return refreshSummaryStatus(updateToolCallInParts(state, action.turnId, action.toolCallId, (tc) => {
        if (tc.status !== ToolCallStatus.Streaming && tc.status !== ToolCallStatus.Running && tc.status !== ToolCallStatus.PendingConfirmation) {
          return tc;
        }
        const base = {
          ...tcBaseWithMeta(tc, action._meta),
          contributor: refineToolCallContributor(tc.contributor, action.contributor, log),
          intention: action.intention ?? tc.intention
        };
        const toolInput = action.toolInput ?? (tc.status === ToolCallStatus.Streaming ? void 0 : tc.toolInput);
        if (action.confirmed) {
          return {
            status: ToolCallStatus.Running,
            ...base,
            invocationMessage: action.invocationMessage,
            toolInput,
            confirmed: action.confirmed
          };
        }
        const pending = tc.status === ToolCallStatus.PendingConfirmation ? tc : void 0;
        const options = action.options ?? pending?.options;
        return {
          status: ToolCallStatus.PendingConfirmation,
          ...base,
          invocationMessage: action.invocationMessage,
          toolInput,
          confirmationTitle: action.confirmationTitle ?? pending?.confirmationTitle,
          riskAssessment: action.riskAssessment ?? pending?.riskAssessment,
          edits: action.edits ?? pending?.edits,
          editable: action.editable ?? pending?.editable,
          ...options ? { options } : {}
        };
      }));
    case ActionType.ChatToolCallConfirmed:
      return refreshSummaryStatus(updateToolCallInParts(state, action.turnId, action.toolCallId, (tc) => {
        if (tc.status !== ToolCallStatus.PendingConfirmation) {
          return tc;
        }
        const base = tcBaseWithMeta(tc, action._meta);
        const selectedOption = resolveSelectedOption(tc.options, action.selectedOptionId);
        if (action.approved) {
          const toolInput = action.editedToolInput !== void 0 && typeof tc.toolInput === "string" ? action.editedToolInput : tc.toolInput;
          return {
            status: ToolCallStatus.Running,
            ...base,
            invocationMessage: tc.invocationMessage,
            toolInput,
            confirmed: action.confirmed,
            ...selectedOption ? { selectedOption } : {}
          };
        }
        return {
          status: ToolCallStatus.Cancelled,
          ...base,
          invocationMessage: tc.invocationMessage,
          toolInput: tc.toolInput,
          reason: action.reason,
          reasonMessage: action.reasonMessage,
          userSuggestion: action.userSuggestion,
          ...selectedOption ? { selectedOption } : {}
        };
      }));
    case ActionType.ChatToolCallComplete:
      return refreshSummaryStatus(updateToolCallInParts(state, action.turnId, action.toolCallId, (tc) => {
        if (tc.status !== ToolCallStatus.Running && tc.status !== ToolCallStatus.PendingConfirmation && tc.status !== ToolCallStatus.AuthRequired) {
          return tc;
        }
        if (tc.status === ToolCallStatus.AuthRequired && action.result.success) {
          return tc;
        }
        const base = tcBaseWithMeta(tc, action._meta);
        const confirmed = tc.status === ToolCallStatus.Running || tc.status === ToolCallStatus.AuthRequired ? tc.confirmed : ToolCallConfirmationReason.NotNeeded;
        const selectedOption = tc.status === ToolCallStatus.Running || tc.status === ToolCallStatus.AuthRequired ? tc.selectedOption : void 0;
        const preAuthContent = tc.status === ToolCallStatus.AuthRequired ? tc.content : void 0;
        if (action.requiresResultConfirmation && tc.status !== ToolCallStatus.AuthRequired) {
          return {
            status: ToolCallStatus.PendingResultConfirmation,
            ...base,
            invocationMessage: tc.invocationMessage,
            toolInput: tc.toolInput,
            confirmed,
            ...selectedOption ? { selectedOption } : {},
            ...preAuthContent ? { content: preAuthContent } : {},
            ...action.result
          };
        }
        return {
          status: ToolCallStatus.Completed,
          ...base,
          invocationMessage: tc.invocationMessage,
          toolInput: tc.toolInput,
          confirmed,
          ...selectedOption ? { selectedOption } : {},
          ...preAuthContent ? { content: preAuthContent } : {},
          ...action.result
        };
      }));
    case ActionType.ChatToolCallResultConfirmed:
      return refreshSummaryStatus(updateToolCallInParts(state, action.turnId, action.toolCallId, (tc) => {
        if (tc.status !== ToolCallStatus.PendingResultConfirmation) {
          return tc;
        }
        const base = tcBaseWithMeta(tc, action._meta);
        if (action.approved) {
          return {
            status: ToolCallStatus.Completed,
            ...base,
            invocationMessage: tc.invocationMessage,
            toolInput: tc.toolInput,
            confirmed: tc.confirmed,
            ...tc.selectedOption ? { selectedOption: tc.selectedOption } : {},
            success: tc.success,
            pastTenseMessage: tc.pastTenseMessage,
            content: tc.content,
            structuredContent: tc.structuredContent,
            error: tc.error
          };
        }
        return {
          status: ToolCallStatus.Cancelled,
          ...base,
          invocationMessage: tc.invocationMessage,
          toolInput: tc.toolInput,
          reason: ToolCallCancellationReason.ResultDenied,
          ...tc.selectedOption ? { selectedOption: tc.selectedOption } : {}
        };
      }));
    case ActionType.ChatToolCallContentChanged:
      return updateToolCallInParts(state, action.turnId, action.toolCallId, (tc) => {
        if (tc.status !== ToolCallStatus.Running) {
          return tc;
        }
        return {
          ...tc,
          ...action._meta !== void 0 ? { _meta: action._meta } : {},
          content: action.content
        };
      });
    case ActionType.ChatToolCallAuthRequired:
      return refreshSummaryStatus(updateToolCallInParts(state, action.turnId, action.toolCallId, (tc) => {
        if (tc.status !== ToolCallStatus.Running) {
          return tc;
        }
        if (!tc.contributor || tc.contributor.kind !== ToolCallContributorKind.MCP) {
          return tc;
        }
        const base = tcBaseWithMeta(tc, action._meta);
        return {
          status: ToolCallStatus.AuthRequired,
          ...base,
          contributor: tc.contributor,
          invocationMessage: tc.invocationMessage,
          toolInput: tc.toolInput,
          confirmed: tc.confirmed,
          ...tc.selectedOption ? { selectedOption: tc.selectedOption } : {},
          ...tc.content ? { content: tc.content } : {},
          auth: action.auth
        };
      }));
    case ActionType.ChatToolCallAuthResolved:
      return refreshSummaryStatus(updateToolCallInParts(state, action.turnId, action.toolCallId, (tc) => {
        if (tc.status !== ToolCallStatus.AuthRequired) {
          return tc;
        }
        const base = tcBaseWithMeta(tc, action._meta);
        return {
          status: ToolCallStatus.Running,
          ...base,
          invocationMessage: tc.invocationMessage,
          toolInput: tc.toolInput,
          confirmed: tc.confirmed,
          ...tc.selectedOption ? { selectedOption: tc.selectedOption } : {},
          ...tc.content ? { content: tc.content } : {}
        };
      }));
    case ActionType.ChatUsage:
      if (!state.activeTurn || state.activeTurn.id !== action.turnId) {
        return state;
      }
      return {
        ...state,
        activeTurn: { ...state.activeTurn, usage: action.usage }
      };
    case ActionType.ChatReasoning:
      return updateResponsePart(state, action.turnId, action.partId, (part) => {
        if (part.kind === ResponsePartKind.Reasoning) {
          return { ...part, content: part.content + action.content };
        }
        return part;
      });
    // ── Truncation ────────────────────────────────────────────────────────
    case ActionType.ChatTruncated: {
      let turns;
      if (action.turnId === void 0) {
        turns = [];
      } else {
        const idx = state.turns.findIndex((t) => t.id === action.turnId);
        if (idx < 0) {
          return state;
        }
        turns = state.turns.slice(0, idx + 1);
      }
      const next = {
        ...state,
        turns,
        activeTurn: void 0,
        modifiedAt: new Date(Date.now()).toISOString()
      };
      if (action.turnId === void 0) {
        delete next.turnsNextCursor;
      }
      return {
        ...next,
        status: summaryStatus(next)
      };
    }
    case ActionType.ChatTurnsLoaded: {
      const existingIds = new Set(state.turns.map((turn) => turn.id));
      const olderTurns = action.turns.filter((turn) => !existingIds.has(turn.id));
      return {
        ...state,
        turns: [...olderTurns, ...state.turns],
        turnsNextCursor: action.turnsNextCursor
      };
    }
    // ── Session Input Requests ─────────────────────────────────────────────
    case ActionType.ChatInputRequested:
      return upsertInputRequestPart(state, action.request);
    case ActionType.ChatInputAnswerChanged: {
      const activeTurn = state.activeTurn;
      const existing = activeTurn ? findOpenInputRequestPart(activeTurn.responseParts, action.requestId) : void 0;
      if (!activeTurn || !existing) {
        return state;
      }
      const { index, part } = existing;
      const request = part.request;
      const answers = { ...request.answers ?? {} };
      if (action.answer === void 0) {
        delete answers[action.questionId];
      } else {
        answers[action.questionId] = action.answer;
      }
      const responseParts = [...activeTurn.responseParts];
      responseParts[index] = {
        ...part,
        request: {
          ...request,
          answers: Object.keys(answers).length > 0 ? answers : void 0
        }
      };
      return {
        ...state,
        activeTurn: {
          ...activeTurn,
          responseParts
        },
        modifiedAt: new Date(Date.now()).toISOString()
      };
    }
    case ActionType.ChatInputCompleted: {
      const activeTurn = state.activeTurn;
      const existing = activeTurn ? findOpenInputRequestPart(activeTurn.responseParts, action.requestId) : void 0;
      if (!activeTurn || !existing) {
        return state;
      }
      const { index, part } = existing;
      const finalAnswers = { ...part.request.answers ?? {}, ...action.answers ?? {} };
      const responseParts = [...activeTurn.responseParts];
      responseParts[index] = {
        ...part,
        request: {
          ...part.request,
          answers: Object.keys(finalAnswers).length > 0 ? finalAnswers : void 0
        },
        response: action.response
      };
      const next = {
        ...state,
        activeTurn: {
          ...activeTurn,
          responseParts
        }
      };
      return {
        ...next,
        status: summaryStatus(next),
        modifiedAt: new Date(Date.now()).toISOString()
      };
    }
    // ── Pending Messages ──────────────────────────────────────────────────
    case ActionType.ChatPendingMessageSet: {
      const entry = { id: action.id, message: action.message };
      if (action.kind === PendingMessageKind.Steering) {
        return { ...state, steeringMessage: entry };
      }
      const existing = state.queuedMessages ?? [];
      const idx = existing.findIndex((m) => m.id === action.id);
      if (idx >= 0) {
        const updated = [...existing];
        updated[idx] = entry;
        return { ...state, queuedMessages: updated };
      }
      return { ...state, queuedMessages: [...existing, entry] };
    }
    case ActionType.ChatPendingMessageRemoved: {
      if (action.kind === PendingMessageKind.Steering) {
        if (!state.steeringMessage || state.steeringMessage.id !== action.id) {
          return state;
        }
        return { ...state, steeringMessage: void 0 };
      }
      const existing = state.queuedMessages;
      if (!existing) {
        return state;
      }
      const filtered = existing.filter((m) => m.id !== action.id);
      return filtered.length === existing.length ? state : { ...state, queuedMessages: filtered.length > 0 ? filtered : void 0 };
    }
    case ActionType.ChatQueuedMessagesReordered: {
      const existing = state.queuedMessages;
      if (!existing) {
        return state;
      }
      const byId = new Map(existing.map((m) => [m.id, m]));
      const ordered = /* @__PURE__ */ new Set();
      const reordered = action.order.filter((id) => {
        if (byId.has(id) && !ordered.has(id)) {
          ordered.add(id);
          return true;
        }
        return false;
      }).map((id) => byId.get(id));
      for (const m of existing) {
        if (!ordered.has(m.id)) {
          reordered.push(m);
        }
      }
      return { ...state, queuedMessages: reordered };
    }
    // ── Draft ─────────────────────────────────────────────────────────────
    case ActionType.ChatDraftChanged:
      return { ...state, draft: action.draft };
    default:
      softAssertNever(action, log);
      return state;
  }
}
export {
  chatReducer
};
