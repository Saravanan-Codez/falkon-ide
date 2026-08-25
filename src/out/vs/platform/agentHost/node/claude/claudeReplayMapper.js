import { localize } from "../../../../nls.js";
import {
  ResponsePartKind,
  ToolCallCancellationReason,
  ToolCallConfirmationReason,
  ToolCallStatus,
  ToolResultContentType,
  TurnState,
  MessageKind
} from "../../common/state/protocol/state.js";
import { buildSubagentSessionUri } from "../../common/state/sessionState.js";
import { readToolCallMeta } from "../../common/meta/agentToolCallMeta.js";
import { formatGenericToolInput } from "../../common/streamingToolCallDisplay.js";
import { buildClaudeToolMeta, getClaudeInvocationMessage, getClaudePastTenseMessage, getClaudeToolDisplayName, getClaudeToolInputString } from "./claudeToolDisplay.js";
import { hasClientToolNamePrefix, stripClientToolNamePrefix } from "./clientTools/claudeClientToolMcpServer.js";
function mapSessionMessagesToTurns(messages, session, logService) {
  const builder = new ReplayBuilder(session, logService);
  for (const msg of messages) {
    const parsed = parseSessionMessage(msg);
    if (parsed === void 0) {
      continue;
    }
    builder.consume(parsed);
  }
  return builder.finish();
}
function resolveForkAnchorUuid(messages, turnId) {
  let turnOpen = false;
  let seenTarget = false;
  let lastAssistantUuid;
  for (const msg of messages) {
    const parsed = parseSessionMessage(msg);
    if (parsed === void 0) {
      continue;
    }
    if (parsed.kind === "user-text") {
      if (seenTarget) {
        break;
      }
      turnOpen = true;
      if (parsed.uuid === turnId) {
        seenTarget = true;
      }
    } else if (parsed.kind === "assistant") {
      if (!turnOpen) {
        turnOpen = true;
        if (parsed.uuid === turnId) {
          seenTarget = true;
        }
      }
      if (seenTarget) {
        lastAssistantUuid = parsed.uuid;
      }
    }
  }
  if (!seenTarget) {
    return void 0;
  }
  return lastAssistantUuid;
}
function parseSessionMessage(msg) {
  const timestamp = readTimestamp(msg);
  switch (msg.type) {
    case "user":
      return parseUserMessage(msg, timestamp);
    case "assistant":
      return parseAssistantMessage(msg, timestamp);
    case "system":
      return parseSystemMessage(msg, timestamp);
    default:
      return void 0;
  }
}
function readTimestamp(msg) {
  if (typeof msg.timestamp !== "string") {
    return void 0;
  }
  const timestamp = Date.parse(msg.timestamp);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : void 0;
}
function parseUserMessage(msg, timestamp) {
  const content = readUserContent(msg.message);
  if (content === void 0) {
    return void 0;
  }
  if (isCliEchoContent(content)) {
    return void 0;
  }
  if (typeof content === "string") {
    return { kind: "user-text", uuid: msg.uuid, text: content, timestamp };
  }
  const textBlocks = content.filter((b) => b.type === "text");
  if (textBlocks.length === 0) {
    const results = content.filter((b) => b.type === "tool_result");
    return results.length > 0 ? { kind: "user-tool-results", uuid: msg.uuid, results, timestamp } : void 0;
  }
  return { kind: "user-text", uuid: msg.uuid, text: textBlocks.map((b) => b.text).join("\n"), timestamp };
}
function parseAssistantMessage(msg, timestamp) {
  const blocks = readAssistantBlocks(msg.message);
  if (blocks === void 0 || blocks.length === 0) {
    return void 0;
  }
  return { kind: "assistant", uuid: msg.uuid, blocks, isInner: msg.parent_tool_use_id !== null, timestamp };
}
function parseSystemMessage(msg, timestamp) {
  const subtype = readSystemSubtype(msg.message);
  if (subtype === void 0 || !ALLOWED_SYSTEM_SUBTYPES.has(subtype)) {
    return void 0;
  }
  const text = readSystemText(msg.message) ?? `[${subtype}]`;
  return { kind: "system-notification", uuid: msg.uuid, subtype, text, timestamp };
}
const ALLOWED_SYSTEM_SUBTYPES = /* @__PURE__ */ new Set([
  "compact_boundary",
  "notification"
]);
const CLI_ECHO_MARKER_PATTERN = /^<(command-name|command-message|command-args|local-command-stdout|local-command-stderr|local-command-caveat)>/;
function missingPromptPlaceholder() {
  return localize("claude.replay.missingPrompt", "Message content could not be retrieved");
}
class ReplayBuilder {
  constructor(_session, _logService) {
    this._session = _session;
    this._logService = _logService;
    this._turns = [];
    /**
     * Cross-turn tool-use tracking. Keyed by `tool_use_id`:
     * - `turnId` — the announcing turn (so a late `tool_result` in a
     *   later `user` envelope can attach back to the right turn per M7).
     * - `parsedInput` — the original `tool_use.input`, looked up at
     *   `_attachToolResult` so the past-tense message can include the
     *   original parameters. Mirrors the live mapper's `_toolCallInfo`
     *   pattern but simpler (replay has the full input synchronously on
     *   the `tool_use` block).
     */
    this._toolUses = /* @__PURE__ */ new Map();
    /** Turns opened from a leading assistant envelope because the prompt was missing. Reported once by {@link finish}. */
    this._recoveredPromptlessTurns = 0;
    /** `tool_result` blocks whose announcing `tool_use` was not in the slice. Reported once by {@link finish}. */
    this._orphanToolResults = 0;
  }
  consume(msg) {
    switch (msg.kind) {
      case "user-text":
        this._closeActive();
        this._active = {
          id: msg.uuid,
          userText: msg.text,
          startedAt: msg.timestamp,
          responseParts: [],
          pendingToolUseIds: /* @__PURE__ */ new Set(),
          toolCallParts: /* @__PURE__ */ new Map()
        };
        return;
      case "user-tool-results": {
        let updatesActiveTurn = false;
        for (const block of msg.results) {
          updatesActiveTurn = this._attachToolResult(block) === this._active?.id || updatesActiveTurn;
        }
        if (updatesActiveTurn && this._active && msg.timestamp) {
          this._active.lastResponseAt = msg.timestamp;
        }
        return;
      }
      case "assistant":
        this._consumeAssistant(msg);
        return;
      case "system-notification":
        if (this._active === void 0) {
          return;
        }
        this._active.responseParts.push({
          kind: ResponsePartKind.SystemNotification,
          content: msg.text
        });
        if (msg.timestamp) {
          this._active.lastResponseAt = msg.timestamp;
        }
        return;
    }
  }
  finish() {
    this._closeActive();
    if (this._recoveredPromptlessTurns > 0 || this._orphanToolResults > 0) {
      this._logService.warn(`[claudeReplayMapper] incomplete transcript for ${this._session.toString()}: ${this._recoveredPromptlessTurns} turn(s) recovered without their prompt, ${this._orphanToolResults} orphaned tool_result(s)`);
    }
    return this._turns;
  }
  _consumeAssistant(msg) {
    if (this._active === void 0) {
      if (!msg.isInner) {
        this._recoveredPromptlessTurns++;
      }
      this._active = {
        id: msg.uuid,
        userText: msg.isInner ? "" : missingPromptPlaceholder(),
        startedAt: msg.timestamp,
        responseParts: [],
        pendingToolUseIds: /* @__PURE__ */ new Set(),
        toolCallParts: /* @__PURE__ */ new Map()
      };
    }
    let textPartCounter = 0;
    let reasoningPartCounter = 0;
    for (const block of msg.blocks) {
      if (block.type === "text" && typeof block.text === "string") {
        this._active.responseParts.push({
          kind: ResponsePartKind.Markdown,
          id: `${this._active.id}#${msg.uuid}#text-${textPartCounter++}`,
          content: block.text
        });
      } else if (block.type === "thinking" && typeof block.thinking === "string") {
        this._active.responseParts.push({
          kind: ResponsePartKind.Reasoning,
          id: `${this._active.id}#${msg.uuid}#thinking-${reasoningPartCounter++}`,
          content: block.thinking
        });
      } else if (block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
        this._openToolUse(block.id, stripClientToolNamePrefix(block.name), block.input, hasClientToolNamePrefix(block.name));
      }
    }
    if (msg.timestamp) {
      this._active.lastResponseAt = msg.timestamp;
    }
  }
  _openToolUse(toolUseId, toolName, input, isClientTool) {
    if (this._active === void 0) {
      return;
    }
    const displayName = isClientTool ? toolName : getClaudeToolDisplayName(toolName);
    const parsedInput = input !== null && typeof input === "object" ? input : void 0;
    const meta = isClientTool ? void 0 : buildClaudeToolMeta(toolName);
    const placeholder = {
      status: ToolCallStatus.Cancelled,
      toolCallId: toolUseId,
      toolName,
      displayName,
      invocationMessage: isClientTool ? displayName : getClaudeInvocationMessage(toolName, displayName, parsedInput),
      toolInput: parsedInput !== void 0 ? isClientTool ? formatGenericToolInput(parsedInput) : getClaudeToolInputString(toolName, parsedInput) : typeof input === "string" ? input : input !== void 0 ? safeStringify(input) : void 0,
      reason: ToolCallCancellationReason.Skipped,
      ...meta ? { _meta: meta } : {}
    };
    const part = {
      kind: ResponsePartKind.ToolCall,
      toolCall: placeholder
    };
    this._active.responseParts.push(part);
    this._active.toolCallParts.set(toolUseId, part);
    this._active.pendingToolUseIds.add(toolUseId);
    this._toolUses.set(toolUseId, { turnId: this._active.id, parsedInput, isClientTool });
  }
  _attachToolResult(block) {
    const entry = this._toolUses.get(block.tool_use_id);
    if (entry === void 0) {
      this._orphanToolResults++;
      return void 0;
    }
    const announcingTurnId = entry.turnId;
    const part = this._findToolCallPart(announcingTurnId, block.tool_use_id);
    if (part === void 0) {
      return void 0;
    }
    const isError = block.is_error;
    const previousState = part.toolCall;
    const isSubagent = readToolCallMeta(previousState).toolKind === "subagent";
    const content = extractToolResultContent(block.content) ?? [];
    const resultText = content.filter((c) => c.type === ToolResultContentType.Text).map((c) => c.text).join("\n");
    if (isSubagent) {
      content.push({
        type: ToolResultContentType.Subagent,
        resource: buildSubagentSessionUri(this._session.toString(), previousState.toolCallId),
        title: previousState.displayName
      });
    }
    const completed = {
      status: ToolCallStatus.Completed,
      toolCallId: previousState.toolCallId,
      toolName: previousState.toolName,
      displayName: previousState.displayName,
      invocationMessage: previousState.invocationMessage ?? previousState.displayName,
      toolInput: previousState.status === ToolCallStatus.Streaming ? void 0 : previousState.toolInput,
      confirmed: ToolCallConfirmationReason.NotNeeded,
      success: !isError,
      pastTenseMessage: entry.isClientTool ? previousState.displayName : getClaudePastTenseMessage(previousState.toolName, previousState.displayName, entry.parsedInput, !isError, resultText),
      content: content.length > 0 ? content : void 0,
      ...previousState._meta ? { _meta: previousState._meta } : {}
    };
    part.toolCall = completed;
    if (this._active?.id === announcingTurnId) {
      this._active.pendingToolUseIds.delete(block.tool_use_id);
    }
    return announcingTurnId;
  }
  _findToolCallPart(turnId, toolUseId) {
    if (this._active && this._active.id === turnId) {
      return this._active.toolCallParts.get(toolUseId);
    }
    for (let i = this._turns.length - 1; i >= 0; i--) {
      if (this._turns[i].id !== turnId) {
        continue;
      }
      for (const part of this._turns[i].responseParts) {
        if (part.kind === ResponsePartKind.ToolCall && part.toolCall.toolCallId === toolUseId) {
          return part;
        }
      }
      return void 0;
    }
    return void 0;
  }
  _closeActive() {
    if (this._active === void 0) {
      return;
    }
    const a = this._active;
    const state = a.pendingToolUseIds.size === 0 ? TurnState.Complete : TurnState.Cancelled;
    const startedAt = a.startedAt === void 0 ? void 0 : Date.parse(a.startedAt);
    const endedAt = a.lastResponseAt === void 0 ? void 0 : Date.parse(a.lastResponseAt);
    const duration = startedAt !== void 0 && endedAt !== void 0 && Number.isFinite(startedAt) && Number.isFinite(endedAt) ? Math.max(0, endedAt - startedAt) : void 0;
    const turn = {
      id: a.id,
      startedAt: a.startedAt,
      duration,
      message: { text: a.userText, origin: { kind: MessageKind.User } },
      responseParts: a.responseParts,
      usage: void 0,
      state
    };
    this._turns.push(turn);
    this._active = void 0;
  }
}
function readUserContent(raw) {
  if (raw === null || typeof raw !== "object") {
    return void 0;
  }
  const content = raw.content;
  if (typeof content === "string") {
    return content.length > 0 ? content : void 0;
  }
  if (!Array.isArray(content) || content.length === 0) {
    return void 0;
  }
  const out = [];
  for (const block of content) {
    if (block === null || typeof block !== "object") {
      continue;
    }
    const b = block;
    if (b.type === "text" && typeof b.text === "string") {
      out.push({ type: "text", text: b.text });
    } else if (b.type === "tool_result" && typeof b.tool_use_id === "string") {
      out.push({ type: "tool_result", tool_use_id: b.tool_use_id, content: b.content, is_error: b.is_error === true });
    }
  }
  return out.length > 0 ? out : void 0;
}
function readAssistantBlocks(raw) {
  if (raw === null || typeof raw !== "object") {
    return void 0;
  }
  const content = raw.content;
  if (!Array.isArray(content)) {
    return void 0;
  }
  const out = [];
  for (const block of content) {
    if (block === null || typeof block !== "object") {
      continue;
    }
    const b = block;
    if (typeof b.type !== "string") {
      continue;
    }
    out.push({
      type: b.type,
      text: typeof b.text === "string" ? b.text : void 0,
      thinking: typeof b.thinking === "string" ? b.thinking : void 0,
      id: typeof b.id === "string" ? b.id : void 0,
      name: typeof b.name === "string" ? b.name : void 0,
      input: b.input
    });
  }
  return out;
}
function readSystemSubtype(raw) {
  if (raw === null || typeof raw !== "object") {
    return void 0;
  }
  const subtype = raw.subtype;
  return typeof subtype === "string" ? subtype : void 0;
}
function readSystemText(raw) {
  if (raw === null || typeof raw !== "object") {
    return void 0;
  }
  const r = raw;
  if (typeof r.text === "string") {
    return r.text;
  }
  if (typeof r.message === "string") {
    return r.message;
  }
  return void 0;
}
function extractToolResultContent(content) {
  if (typeof content === "string") {
    return content.length > 0 ? [{ type: ToolResultContentType.Text, text: content }] : void 0;
  }
  if (!Array.isArray(content)) {
    return void 0;
  }
  const out = [];
  for (const block of content) {
    if (block === null || typeof block !== "object") {
      continue;
    }
    const b = block;
    if (b.type === "text" && typeof b.text === "string") {
      out.push({ type: ToolResultContentType.Text, text: b.text });
    }
  }
  return out.length > 0 ? out : void 0;
}
function safeStringify(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return void 0;
  }
}
function isCliEchoContent(content) {
  if (typeof content === "string") {
    return CLI_ECHO_MARKER_PATTERN.test(content);
  }
  const firstText = content.find((b) => b.type === "text");
  return firstText !== void 0 && CLI_ECHO_MARKER_PATTERN.test(firstText.text);
}
export {
  mapSessionMessagesToTurns,
  missingPromptPlaceholder,
  resolveForkAnchorUuid
};
