import { MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../../base/common/observable.js";
import { hasKey } from "../../../../../base/common/types.js";
import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
import { IChatToolInvocation } from "../chatService/chatService.js";
function normalizeAgentsVoiceId(value) {
  const voiceId = typeof value === "string" ? value.trim() : "";
  switch (voiceId) {
    case "harper_neutral":
    case "birch_neutral":
    case "junho_neutral":
    case "oak_neutral":
      return voiceId;
    case "victoria_neutral":
      return "harper_neutral";
    case "maya_neutral":
      return "birch_neutral";
    case "daniel_neutral":
      return "junho_neutral";
    case "kevin_neutral":
      return "oak_neutral";
    default:
      return "birch_neutral";
  }
}
const pendingOccurrenceTokens = /* @__PURE__ */ new WeakMap();
let pendingOccurrenceCounter = 0;
const activePendingToolOccurrences = /* @__PURE__ */ new Map();
const resolvedPendingToolOccurrences = /* @__PURE__ */ new Map();
const pendingToolOccurrenceByPart = /* @__PURE__ */ new WeakMap();
const pendingToolOccurrenceById = /* @__PURE__ */ new Map();
const pendingToolResolutionVersion = observableValue("pendingToolResolutionVersion", 0);
const MAX_RESOLVED_PENDING_TOOL_OCCURRENCES = 256;
function isPendingToolState(state) {
  return state.type === IChatToolInvocation.StateKind.WaitingForConfirmation || state.type === IChatToolInvocation.StateKind.WaitingForPostApproval || state.type === IChatToolInvocation.StateKind.WaitingForAuthentication;
}
function getVoiceToolApprovalCommand(invocation, includeParameters = true) {
  const terminalData = invocation.toolSpecificData;
  let command;
  if (terminalData?.kind === "terminal") {
    command = hasKey(terminalData, { commandLine: true }) ? terminalData.commandLine.userEdited ?? terminalData.presentationOverrides?.commandLine ?? terminalData.confirmation?.commandLine ?? terminalData.commandLine.toolEdited ?? terminalData.commandLine.original : terminalData.command;
  }
  if (!command && includeParameters) {
    const state = invocation.state.get();
    const parameters = state.type === IChatToolInvocation.StateKind.Streaming ? void 0 : state.parameters;
    const parameterCommand = parameters?.["command"] ?? parameters?.["input"];
    command = typeof parameterCommand === "string" ? parameterCommand : void 0;
  }
  return command?.trim() || void 0;
}
function pendingToolSemanticKey(requestId, invocation) {
  const state = invocation.state.get();
  if (!isPendingToolState(state) || !invocation.toolCallId) {
    return void 0;
  }
  const phase = state.type === IChatToolInvocation.StateKind.WaitingForPostApproval ? "post" : state.type === IChatToolInvocation.StateKind.WaitingForAuthentication ? "authentication" : "pre";
  const command = getVoiceToolApprovalCommand(invocation) ?? "";
  const authenticationResource = state.type === IChatToolInvocation.StateKind.WaitingForAuthentication ? state.server.resource : "";
  return JSON.stringify([requestId, invocation.toolCallId, phase, command, authenticationResource]);
}
function releasePendingToolParticipant(invocation, occurrence) {
  occurrence.participants.get(invocation)?.dispose();
}
function pendingToolOccurrenceId(occurrence) {
  return `${occurrence.requestId}#${occurrence.token}`;
}
function resolvePendingToolOccurrence(occurrence) {
  if (occurrence.resolved) {
    return;
  }
  occurrence.resolved = true;
  if (activePendingToolOccurrences.get(occurrence.semanticKey) === occurrence) {
    activePendingToolOccurrences.delete(occurrence.semanticKey);
  }
  resolvedPendingToolOccurrences.delete(occurrence.semanticKey);
  resolvedPendingToolOccurrences.set(occurrence.semanticKey, occurrence);
  while (resolvedPendingToolOccurrences.size > MAX_RESOLVED_PENDING_TOOL_OCCURRENCES) {
    const oldestKey = resolvedPendingToolOccurrences.keys().next().value;
    if (oldestKey === void 0) {
      break;
    }
    const oldest = resolvedPendingToolOccurrences.get(oldestKey);
    resolvedPendingToolOccurrences.delete(oldestKey);
    if (oldest && pendingToolOccurrenceById.get(pendingToolOccurrenceId(oldest)) === oldest) {
      pendingToolOccurrenceById.delete(pendingToolOccurrenceId(oldest));
    }
  }
  pendingToolResolutionVersion.set(pendingToolResolutionVersion.get() + 1, void 0);
}
function pendingToolOccurrence(requestId, invocation, mint, store) {
  const semanticKey = pendingToolSemanticKey(requestId, invocation);
  const current = pendingToolOccurrenceByPart.get(invocation);
  if (!semanticKey) {
    if (current) {
      releasePendingToolParticipant(invocation, current);
    }
    return void 0;
  }
  if (current?.semanticKey === semanticKey) {
    return current;
  }
  if (current) {
    resolvePendingToolOccurrence(current);
    releasePendingToolParticipant(invocation, current);
  }
  let occurrence = activePendingToolOccurrences.get(semanticKey) ?? resolvedPendingToolOccurrences.get(semanticKey);
  if (!occurrence) {
    if (!mint) {
      return void 0;
    }
    occurrence = {
      requestId,
      semanticKey,
      token: `t${Date.now().toString(36)}-${++pendingOccurrenceCounter}`,
      participants: /* @__PURE__ */ new Map(),
      resolved: false
    };
    activePendingToolOccurrences.set(semanticKey, occurrence);
    pendingToolOccurrenceById.set(pendingToolOccurrenceId(occurrence), occurrence);
  }
  pendingToolOccurrenceByPart.set(invocation, occurrence);
  const trackedOccurrence = occurrence;
  const observer = new MutableDisposable();
  const tracking = toDisposable(() => {
    if (pendingToolOccurrenceByPart.get(invocation) === trackedOccurrence) {
      pendingToolOccurrenceByPart.delete(invocation);
    }
    store?.deleteAndLeak(tracking);
    if (trackedOccurrence.participants.get(invocation) === tracking) {
      trackedOccurrence.participants.delete(invocation);
    }
    if (trackedOccurrence.participants.size === 0 && activePendingToolOccurrences.get(trackedOccurrence.semanticKey) === trackedOccurrence) {
      activePendingToolOccurrences.delete(trackedOccurrence.semanticKey);
    }
    if (!trackedOccurrence.resolved && trackedOccurrence.participants.size === 0 && pendingToolOccurrenceById.get(pendingToolOccurrenceId(trackedOccurrence)) === trackedOccurrence) {
      pendingToolOccurrenceById.delete(pendingToolOccurrenceId(trackedOccurrence));
    }
    observer.dispose();
  });
  observer.value = autorun((reader) => {
    if (!isPendingToolState(invocation.state.read(reader))) {
      resolvePendingToolOccurrence(trackedOccurrence);
      tracking.dispose();
    }
  });
  occurrence.participants.set(invocation, tracking);
  store?.add(tracking);
  return occurrence;
}
function fallbackPendingOccurrenceIdentity(part) {
  const invocation = part;
  if (invocation.kind !== "toolInvocation" || !invocation.state) {
    return part;
  }
  const state = invocation.state.get();
  if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation || state.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
    return typeof state.confirm === "function" ? state.confirm : part;
  }
  if (state.type === IChatToolInvocation.StateKind.WaitingForAuthentication) {
    return typeof state.cancel === "function" ? state.cancel : part;
  }
  return part;
}
function derivePendingId(requestId, part, store) {
  const invocation = part;
  if (invocation.kind === "toolInvocation" && invocation.state) {
    const occurrence = pendingToolOccurrence(requestId, invocation, true, store);
    if (occurrence) {
      return `${requestId}#${occurrence.token}`;
    }
  }
  const fallbackIdentity = fallbackPendingOccurrenceIdentity(part);
  let token = pendingOccurrenceTokens.get(fallbackIdentity);
  if (token === void 0) {
    token = `p${++pendingOccurrenceCounter}`;
    pendingOccurrenceTokens.set(fallbackIdentity, token);
  }
  return `${requestId}#${token}`;
}
function markPendingIdResolved(pendingId) {
  const occurrence = pendingToolOccurrenceById.get(pendingId);
  if (!occurrence) {
    return false;
  }
  resolvePendingToolOccurrence(occurrence);
  return true;
}
function isPendingIdResolved(pendingId, reader) {
  pendingToolResolutionVersion.read(reader);
  return pendingToolOccurrenceById.get(pendingId)?.resolved === true;
}
function peekPendingId(requestId, part) {
  const invocation = part;
  if (invocation.kind === "toolInvocation" && invocation.state) {
    const occurrence = pendingToolOccurrence(requestId, invocation, false);
    if (occurrence && !occurrence.resolved) {
      return `${requestId}#${occurrence.token}`;
    }
  }
  const token = pendingOccurrenceTokens.get(fallbackPendingOccurrenceIdentity(part));
  return token === void 0 ? void 0 : `${requestId}#${token}`;
}
function isVoiceCheckpointId(value) {
  return value === "investigating" || value === "planning" || value === "editing" || value === "validating" || value === "recovering";
}
const IVoiceClientService = createDecorator("voiceClientService");
const VOICE_AGENT_PROGRESS_SETTING = "agents.voice.agentProgress";
export {
  IVoiceClientService,
  VOICE_AGENT_PROGRESS_SETTING,
  derivePendingId,
  getVoiceToolApprovalCommand,
  isPendingIdResolved,
  isVoiceCheckpointId,
  markPendingIdResolved,
  normalizeAgentsVoiceId,
  peekPendingId
};
