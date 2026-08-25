import { LogLevel } from "../../../log/common/log.js";
import { ActionType } from "../../common/state/sessionActions.js";
import { ResponsePartKind, ToolResultContentType } from "../../common/state/sessionState.js";
import { extractForwardedErrorInfo } from "../shared/proxyChatError.js";
import { buildTopLevelSubagentReadyAction, emitInnerAssistantSignals, mapSubagentSystemMessage, SUBAGENT_SPAWNING_TOOL_NAMES, tagWithParent } from "./claudeSubagentSignals.js";
import { stripClientToolNamePrefix, hasClientToolNamePrefix } from "./clientTools/claudeClientToolMcpServer.js";
import { buildClaudeToolMeta, getClaudePastTenseMessage, getClaudeToolDisplayName, isClaudeFileEditTool } from "./claudeToolDisplay.js";
import { claudeToolDenialCode } from "./claudeToolDenial.js";
import { ClaudeToolCallRegistry } from "./claudeToolCallRegistry.js";
import { ToolCallConfirmationReason, ToolCallContributorKind } from "../../common/state/protocol/state.js";
class ClaudeMapperState {
  constructor() {
    this._activeToolBlocks = /* @__PURE__ */ new Map();
    /**
     * Phase 8.5 — cross-message tool-call attribution + input
     * accumulation + computed start-info, encapsulated as its own
     * collaborator class so it can be unit-tested independently.
     * Public so mapper functions can call its lifecycle methods
     * directly without forwarding through this class.
     */
    this.toolCalls = new ClaudeToolCallRegistry();
    /**
     * Phase 8 — file-edit content pre-staged by
     * `ClaudeAgentSession._observeUserMessage` and consumed by
     * {@link mapUserMessage} when the matching `tool_result` arrives.
     * Keyed by SDK `tool_use_id`. The session's `_processMessages` loop
     * awaits the after-snapshot before invoking the synchronous mapper,
     * so by the time `takeFileEdit` is called the entry is always
     * populated for tracked file-edit tools.
     */
    this._completedFileEdits = /* @__PURE__ */ new Map();
  }
  /**
   * Reset per-message state. Called on `message_start`. Cross-message
   * tool-call tracking is deliberately NOT cleared here — the
   * `tool_result` for a `tool_use` arrives in a later message.
   */
  resetMessage(messageId) {
    this._activeToolBlocks.clear();
    this._currentMessageId = messageId;
  }
  getCurrentMessageId() {
    return this._currentMessageId;
  }
  /**
   * Open a tool block at the given content-block index. Seeds both
   * scopes; the per-message map gets drained on `content_block_stop`,
   * the cross-message maps survive until the matching `tool_result`.
   */
  startToolBlock(index, toolUseId, toolName, turnId, isClientTool = false) {
    this._activeToolBlocks.set(index, { toolUseId, toolName, isClientTool });
    this.toolCalls.begin(toolUseId, toolName, turnId, isClientTool);
  }
  getActiveToolBlock(index) {
    return this._activeToolBlocks.get(index);
  }
  endToolBlock(index) {
    this._activeToolBlocks.delete(index);
  }
  /**
   * Phase 8.5 — forward an `input_json_delta.partial_json` chunk
   * to the registry. Resolves the index → `tool_use_id` mapping
   * locally (the registry is keyed by id, not by index) and is a
   * no-op when the index is unknown.
   */
  appendToolBlockInputDelta(index, partialJson) {
    const tracked = this._activeToolBlocks.get(index);
    if (!tracked) {
      return;
    }
    this.toolCalls.appendInputDelta(tracked.toolUseId, partialJson);
  }
  /**
   * Phase 8.5 — forward the `content_block_stop` signal to the
   * registry, which parses the buffer and stashes the computed
   * start-info.
   */
  finalizeToolBlock(index) {
    const tracked = this._activeToolBlocks.get(index);
    if (!tracked) {
      return;
    }
    this.toolCalls.finalize(tracked.toolUseId);
  }
  /**
   * Cross-message lookup for `tool_result` handling. Returns
   * `undefined` if the `tool_use_id` is unknown (defense-in-depth
   * against transport drift / replay).
   */
  lookupToolCall(toolUseId) {
    const entry = this.toolCalls.lookup(toolUseId);
    return entry ? { turnId: entry.turnId, toolName: entry.toolName, isClientTool: entry.isClientTool } : void 0;
  }
  /** Drain cross-message tracking once a `tool_result` is delivered. */
  completeToolCall(toolUseId) {
    this.toolCalls.complete(toolUseId);
  }
  /**
   * Phase 8 — stash a {@link ToolResultFileEditContent} produced by
   * `ClaudeAgentSession._observeUserMessage` so the synchronous mapper
   * can append it to the matching `ChatToolCallComplete` action.
   */
  cacheFileEdit(toolUseId, content) {
    this._completedFileEdits.set(toolUseId, content);
  }
  /**
   * Phase 8 — consume and remove the cached file edit for this
   * `tool_use_id`. Returns `undefined` for non-file-edit tools or for
   * file-edit tools where snapshotting was skipped (e.g. denied before
   * the SDK ran the tool, or no actual file change occurred).
   */
  takeFileEdit(toolUseId) {
    const content = this._completedFileEdits.get(toolUseId);
    if (content) {
      this._completedFileEdits.delete(toolUseId);
    }
    return content;
  }
  /**
   * Drop any cross-message tracking that is still pending at the end
   * of a turn. A `tool_use` whose `tool_result` never arrives — model
   * misbehavior, transport drop, future cancellation — would otherwise
   * survive in the maps for the lifetime of the session and accumulate
   * across turns. Called from {@link mapResult} on every `result`
   * envelope; warns once per orphan to surface the protocol break.
   *
   * Phase 12 subagent state lives on {@link SubagentRegistry}, not
   * here; the mapper drives that drain via
   * `registry.drainForegroundSpawns()` from {@link mapResult}.
   */
  clearPendingToolCalls(logService) {
    this.toolCalls.clearPending(logService);
  }
}
function fileEditToolDelta(chat, turnId, toolCallId, invocationMessage) {
  return {
    kind: "action",
    resource: chat,
    action: {
      type: ActionType.ChatToolCallDelta,
      turnId,
      toolCallId,
      content: "",
      invocationMessage
    }
  };
}
function mapSDKMessageToAgentSignals(message, chat, turnId, state, logService, registry, clientToolOwner, turnDuration) {
  if (logService.getLevel() <= LogLevel.Trace) {
    try {
      const snippet = JSON.stringify(message, (k, v) => typeof v === "string" && v.length > 200 ? v.slice(0, 200) + "\u2026" : v);
      logService.trace(`[claudeMapSessionEvents] SDK message type=${message.type}: ${snippet?.slice(0, 2e3) ?? "<unserializable>"}`);
    } catch {
      logService.trace(`[claudeMapSessionEvents] SDK message type=${message.type} (unserializable)`);
    }
  }
  switch (message.type) {
    case "stream_event":
      return tagWithParent(
        mapStreamEvent(message.event, chat, turnId, state, logService, message.parent_tool_use_id, registry, clientToolOwner),
        chat,
        message.parent_tool_use_id,
        registry
      );
    case "result":
      return mapResult(message, chat, turnId, turnDuration, state, logService, registry);
    case "assistant":
      return tagWithParent(
        mapAssistantCanonical(message, chat, turnId, state, message.parent_tool_use_id, registry, clientToolOwner),
        chat,
        message.parent_tool_use_id,
        registry
      );
    case "user":
      return tagWithParent(
        mapUserMessage(message, chat, state, logService, registry),
        chat,
        message.parent_tool_use_id,
        registry
      );
    default:
      if (message.type === "system") {
        return mapSubagentSystemMessage(message, chat, registry);
      }
      return [];
  }
}
function mapAssistantCanonical(message, chat, turnId, state, parentToolUseId, registry, clientToolOwner) {
  if (parentToolUseId === null) {
    const top = [];
    for (const block of message.message.content) {
      if (block.type !== "tool_use" || !SUBAGENT_SPAWNING_TOOL_NAMES.has(block.name)) {
        continue;
      }
      top.push(buildTopLevelSubagentReadyAction(block, chat, turnId, registry));
    }
    return top;
  }
  return emitInnerAssistantSignals(message, chat, turnId, state, parentToolUseId, registry, clientToolOwner);
}
function mapUserMessage(message, chat, state, logService, registry) {
  const content = message.message.content;
  if (!Array.isArray(content)) {
    return [];
  }
  const signals = [];
  for (const block of content) {
    if (block.type !== "tool_result") {
      continue;
    }
    const tracked = state.lookupToolCall(block.tool_use_id);
    if (!tracked) {
      logService.warn(`[claudeMapSessionEvents] tool_result for unknown tool_use_id ${block.tool_use_id}`);
      continue;
    }
    const isError = block.is_error === true;
    const content2 = extractToolResultContent(block.content) ?? [];
    const fileEdit = state.takeFileEdit(block.tool_use_id);
    if (fileEdit) {
      content2.push(fileEdit);
    }
    const info = state.toolCalls.lookup(block.tool_use_id)?.info;
    const resultText = content2.filter((c) => c.type === ToolResultContentType.Text).map((c) => c.text).join("\n");
    const pastTenseMessage = info ? info.isClientTool ? info.displayName : getClaudePastTenseMessage(info.toolName, info.displayName, info.parsedInput, !isError, resultText) : tracked.isClientTool ? tracked.toolName : `${getClaudeToolDisplayName(tracked.toolName)} finished`;
    const denialCode = isError ? claudeToolDenialCode(resultText) : void 0;
    signals.push({
      kind: "action",
      resource: chat,
      action: {
        type: ActionType.ChatToolCallComplete,
        turnId: tracked.turnId,
        toolCallId: block.tool_use_id,
        result: {
          success: !isError,
          pastTenseMessage,
          content: content2.length > 0 ? content2 : void 0,
          ...denialCode ? { error: { message: resultText, code: denialCode } } : {}
        }
      }
    });
    state.completeToolCall(block.tool_use_id);
    const spawn = registry.getSpawn(block.tool_use_id);
    if (spawn && !spawn.background && spawn.markCompleted()) {
      signals.push({
        kind: "subagent_completed",
        chat,
        toolCallId: block.tool_use_id
      });
      registry.removeSpawn(block.tool_use_id);
    }
  }
  return signals;
}
function extractToolResultContent(content) {
  if (typeof content === "string") {
    return [{ type: ToolResultContentType.Text, text: content }];
  }
  if (!Array.isArray(content)) {
    return void 0;
  }
  const out = [];
  for (const block of content) {
    if (isToolResultTextBlock(block)) {
      out.push({ type: ToolResultContentType.Text, text: block.text });
    }
  }
  return out.length > 0 ? out : void 0;
}
function isToolResultTextBlock(block) {
  if (block === null || typeof block !== "object") {
    return false;
  }
  const candidate = block;
  return candidate.type === "text" && typeof candidate.text === "string";
}
function mapResult(message, session, turnId, turnDuration, state, logService, registry) {
  const signals = [];
  if (message.subtype === "success") {
    const modelKey = Object.keys(message.modelUsage)[0];
    signals.push({
      kind: "action",
      resource: session,
      action: {
        type: ActionType.ChatUsage,
        turnId,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadTokens: message.usage.cache_read_input_tokens,
          ...modelKey ? { model: modelKey } : {}
        }
      }
    });
  }
  const errorText = getResultErrorText(message);
  if (errorText !== void 0) {
    signals.push({
      kind: "action",
      resource: session,
      action: {
        type: ActionType.ChatError,
        turnId,
        duration: typeof turnDuration === "number" && Number.isFinite(turnDuration) ? Math.max(0, turnDuration) : 0,
        error: {
          errorType: message.subtype,
          ...extractForwardedErrorInfo(errorText)
        }
      }
    });
  }
  state.clearPendingToolCalls(logService);
  for (const orphan of registry.drainForegroundSpawns()) {
    logService.warn(`[claudeMapSessionEvents] turn ended with pending subagent-spawning tool_use ${orphan.toolUseId} (agentId=${orphan.agentId ?? "<unresolved>"}); dropping cross-message state`);
  }
  return signals;
}
function getResultErrorText(message) {
  if (message.subtype === "success") {
    return message.is_error ? message.result : void 0;
  }
  if (message.subtype === "error_during_execution") {
    return message.errors?.join("\n");
  }
  return void 0;
}
function mapStreamEvent(event, chat, turnId, state, logService, parentToolUseId, registry, clientToolOwner) {
  switch (event.type) {
    case "message_start":
      state.resetMessage(event.message.id);
      return [];
    case "content_block_start": {
      const block = event.content_block;
      if (block.type === "text") {
        return [{
          kind: "action",
          resource: chat,
          action: {
            type: ActionType.ChatResponsePart,
            turnId,
            part: {
              kind: ResponsePartKind.Markdown,
              id: makeContentBlockPartId(turnId, state, event.index, logService),
              content: ""
            }
          }
        }];
      }
      if (block.type === "thinking") {
        return [{
          kind: "action",
          resource: chat,
          action: {
            type: ActionType.ChatResponsePart,
            turnId,
            part: {
              kind: ResponsePartKind.Reasoning,
              id: makeContentBlockPartId(turnId, state, event.index, logService),
              content: ""
            }
          }
        }];
      }
      if (block.type === "tool_use") {
        const toolName = stripClientToolNamePrefix(block.name);
        const isClientTool = hasClientToolNamePrefix(block.name);
        state.startToolBlock(event.index, block.id, toolName, turnId, isClientTool);
        const isSubagentSpawn = !isClientTool && SUBAGENT_SPAWNING_TOOL_NAMES.has(toolName);
        if (parentToolUseId === null) {
          if (isSubagentSpawn) {
            registry.recordSpawn(block.id);
          }
        } else {
          registry.noteInnerTool(block.id, parentToolUseId);
        }
        const meta = isClientTool ? void 0 : buildClaudeToolMeta(toolName);
        const toolClientId = isClientTool ? clientToolOwner?.(toolName) : void 0;
        return [{
          kind: "action",
          resource: chat,
          action: {
            type: ActionType.ChatToolCallStart,
            turnId,
            toolCallId: block.id,
            toolName,
            displayName: isClientTool ? toolName : getClaudeToolDisplayName(toolName),
            ...toolClientId ? { contributor: { kind: ToolCallContributorKind.Client, clientId: toolClientId } } : {},
            ...meta ? { _meta: meta } : {}
          }
        }];
      }
      return [];
    }
    case "content_block_delta": {
      if (event.delta.type === "text_delta") {
        return [{
          kind: "action",
          resource: chat,
          action: {
            type: ActionType.ChatDelta,
            turnId,
            partId: makeContentBlockPartId(turnId, state, event.index, logService),
            content: event.delta.text
          }
        }];
      }
      if (event.delta.type === "thinking_delta") {
        return [{
          kind: "action",
          resource: chat,
          action: {
            type: ActionType.ChatReasoning,
            turnId,
            partId: makeContentBlockPartId(turnId, state, event.index, logService),
            content: event.delta.thinking
          }
        }];
      }
      if (event.delta.type === "input_json_delta") {
        const tracked = state.getActiveToolBlock(event.index);
        if (!tracked) {
          logService.warn(`[claudeMapSessionEvents] input_json_delta for unknown content-block index ${event.index}`);
          return [];
        }
        state.appendToolBlockInputDelta(event.index, event.delta.partial_json);
        if (!tracked.isClientTool && isClaudeFileEditTool(tracked.toolName)) {
          const update = state.toolCalls.streamingInputUpdate(tracked.toolUseId);
          if (!update) {
            return [];
          }
          return [fileEditToolDelta(chat, turnId, tracked.toolUseId, update.invocationMessage)];
        }
        return [{
          kind: "action",
          resource: chat,
          action: {
            type: ActionType.ChatToolCallDelta,
            turnId,
            toolCallId: tracked.toolUseId,
            content: event.delta.partial_json
          }
        }];
      }
      return [];
    }
    case "content_block_stop": {
      const tracked = state.getActiveToolBlock(event.index);
      const finalStreamingUpdate = tracked && !tracked.isClientTool && isClaudeFileEditTool(tracked.toolName) ? state.toolCalls.streamingInputUpdate(tracked.toolUseId, true) : void 0;
      state.finalizeToolBlock(event.index);
      state.endToolBlock(event.index);
      if (!tracked) {
        return [];
      }
      const entry = state.toolCalls.lookup(tracked.toolUseId);
      const info = entry?.info;
      if (!info) {
        return [];
      }
      const meta = tracked.isClientTool ? void 0 : buildClaudeToolMeta(tracked.toolName);
      const signals = [];
      if (finalStreamingUpdate) {
        signals.push(fileEditToolDelta(chat, turnId, tracked.toolUseId, finalStreamingUpdate.invocationMessage));
      }
      signals.push({
        kind: "action",
        resource: chat,
        action: {
          type: ActionType.ChatToolCallReady,
          turnId,
          toolCallId: tracked.toolUseId,
          invocationMessage: info.invocationMessage,
          ...info.toolInput !== void 0 ? { toolInput: info.toolInput } : {},
          confirmed: ToolCallConfirmationReason.NotNeeded,
          ...meta ? { _meta: meta } : {}
        }
      });
      return signals;
    }
    case "message_delta":
    case "message_stop":
      return [];
    default:
      return [];
  }
}
function makeContentBlockPartId(turnId, state, index, logService) {
  const messageId = state.getCurrentMessageId();
  if (messageId === void 0) {
    logService.warn(`[claudeMapSessionEvents] content block at index ${index} arrived before message_start; using turn-scoped id`);
    return `${turnId}#${index}`;
  }
  return `${turnId}#${messageId}#${index}`;
}
export {
  ClaudeMapperState,
  mapSDKMessageToAgentSignals
};
