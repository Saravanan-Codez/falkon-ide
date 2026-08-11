import { Reassembler } from "./webPubSub/chunking.js";
import { ActionType } from "./state/protocol/common/actions.js";
import { chatReducer } from "./state/protocol/channels-chat/reducer.js";
import { sessionReducer } from "./state/protocol/channels-session/reducer.js";
import { SessionLifecycle, SessionStatus } from "./state/protocol/channels-session/state.js";
const MAX_RESTART_EPOCH_INITIAL_SEQUENCE = 1;
class TaskEventReplayError extends Error {
  constructor(message) {
    super(message);
    this.name = "TaskEventReplayError";
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireNonEmptyString(value, field, eventIndex) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TaskEventReplayError(`Task AHP event ${eventIndex} has an invalid ${field}.`);
  }
  return value;
}
function requireNonNegativeInteger(value, field, eventIndex) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TaskEventReplayError(`Task AHP event ${eventIndex} has an invalid ${field}.`);
  }
  return value;
}
function parseActionEnvelope(value, eventIndex) {
  if (!isRecord(value)) {
    throw new TaskEventReplayError(`Task AHP event ${eventIndex} did not contain an ActionEnvelope object.`);
  }
  requireNonEmptyString(value["channel"], "payload.data.channel", eventIndex);
  requireNonNegativeInteger(value["serverSeq"], "payload.data.serverSeq", eventIndex);
  const action = value["action"];
  if (!isRecord(action)) {
    throw new TaskEventReplayError(`Task AHP event ${eventIndex} has an invalid payload.data.action.`);
  }
  requireNonEmptyString(action["type"], "payload.data.action.type", eventIndex);
  const rejectionReason = value["rejectionReason"];
  if (rejectionReason !== void 0 && rejectionReason !== null) {
    requireNonEmptyString(rejectionReason, "payload.data.rejectionReason", eventIndex);
  }
  return value;
}
function sessionChannelFor(sessionId) {
  return sessionId.startsWith("ahp-session:/") ? sessionId : `ahp-session:/${sessionId}`;
}
function seedSessionState() {
  return {
    provider: "",
    title: "",
    status: SessionStatus.Idle,
    lifecycle: SessionLifecycle.Ready,
    activeClients: [],
    chats: []
  };
}
function seedChatState(chatChannel, modifiedAt) {
  return {
    resource: chatChannel,
    title: "",
    status: SessionStatus.Idle,
    modifiedAt,
    turns: []
  };
}
function decodeEvents(events) {
  const sessions = /* @__PURE__ */ new Map();
  for (const [eventIndex, value] of events.entries()) {
    if (!isRecord(value)) {
      throw new TaskEventReplayError(`Task AHP event ${eventIndex} must be an object.`);
    }
    if (value["ns"] !== "ahp") {
      throw new TaskEventReplayError(`Task AHP event ${eventIndex} has an invalid ns.`);
    }
    const session = sessionChannelFor(requireNonEmptyString(value["session_id"], "session_id", eventIndex));
    const seq = requireNonNegativeInteger(value["seq"], "seq", eventIndex);
    const at = requireNonEmptyString(value["at"], "at", eventIndex);
    let entry = sessions.get(session);
    if (!entry) {
      entry = { envelopes: [], modifiedAt: at, nextSeq: seq, reassembler: new Reassembler(), abandonedChunkGroup: false };
      sessions.set(session, entry);
    }
    entry.modifiedAt = at;
    const startsRestartEpoch = seq !== entry.nextSeq && seq < entry.nextSeq && seq <= MAX_RESTART_EPOCH_INITIAL_SEQUENCE;
    if (seq !== entry.nextSeq && !startsRestartEpoch) {
      throw new TaskEventReplayError(
        `Task AHP event ${eventIndex} for session '${session}' has sequence ${seq}; expected ${entry.nextSeq}.`
      );
    }
    if (startsRestartEpoch) {
      entry.abandonedChunkGroup ||= entry.reassembler.inFlightGroupCount > 0;
      entry.nextSeq = seq;
      entry.reassembler = new Reassembler();
    }
    entry.nextSeq += 1;
    let reassembled;
    try {
      reassembled = entry.reassembler.ingest(value["payload"]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown chunking failure";
      throw new TaskEventReplayError(
        `Task AHP event ${eventIndex} for session '${session}' could not be reassembled: ${message}`
      );
    }
    if (reassembled === null) {
      continue;
    }
    const envelope = parseActionEnvelope(reassembled, eventIndex);
    if (!envelope.rejectionReason) {
      entry.envelopes.push(envelope);
    }
  }
  return sessions;
}
function foldSession(session, entry) {
  let state = seedSessionState();
  const chats = /* @__PURE__ */ new Map();
  let defaultChat = `${session}/chat`;
  for (const envelope of entry.envelopes) {
    const channel = envelope.channel;
    const action = envelope.action;
    if (action.type.startsWith("session/") && channel === session) {
      state = sessionReducer(state, action);
      if (action.type === ActionType.SessionDefaultChatChanged) {
        defaultChat = action.defaultChat || `${session}/chat`;
      }
      continue;
    }
    if (action.type.startsWith("chat/")) {
      const current = chats.get(channel) ?? seedChatState(channel, entry.modifiedAt);
      chats.set(channel, chatReducer(current, action));
    }
  }
  if (!chats.has(defaultChat)) {
    chats.set(defaultChat, seedChatState(defaultChat, entry.modifiedAt));
  }
  return { session, state, chats, defaultChat, modifiedAt: entry.modifiedAt };
}
function replayTaskAhpEvents(events) {
  const decoded = decodeEvents(events);
  if (decoded.size === 0) {
    return void 0;
  }
  const sessions = [];
  let truncated = false;
  for (const [session, entry] of decoded) {
    sessions.push(foldSession(session, entry));
    truncated ||= entry.abandonedChunkGroup || entry.reassembler.inFlightGroupCount > 0;
  }
  return { sessions, truncated };
}
function parseTaskEventsResponse(body) {
  if (!isRecord(body) || !Array.isArray(body["events"])) {
    throw new TaskEventReplayError("Task AHP history response is malformed.");
  }
  const total = body["total"];
  if (!Number.isInteger(total) || total < 0) {
    throw new TaskEventReplayError("Task AHP history response has an invalid total.");
  }
  if (total !== body["events"].length) {
    throw new TaskEventReplayError("Task AHP history response has an inconsistent total.");
  }
  return body["events"];
}
export {
  TaskEventReplayError,
  parseTaskEventsResponse,
  replayTaskAhpEvents
};
