import { parsePartialToolInput } from "../../common/partialToolInput.js";
import { formatGenericToolInput, STREAMING_TOOL_DISPLAY_INTERVAL_MS, streamingToolDisplayText } from "../../common/streamingToolCallDisplay.js";
import { getClaudeInvocationMessage, getClaudeStreamingInvocationMessage, getClaudeToolDisplayName, getClaudeToolInputString } from "./claudeToolDisplay.js";
class ClaudeToolCallRegistry {
  constructor() {
    this._entries = /* @__PURE__ */ new Map();
  }
  /**
   * Begin tracking a tool call. Called from `content_block_start`
   * for a `tool_use` block. Allocates the delta buffer; the
   * computed info bag is filled in by {@link finalize}.
   */
  begin(toolUseId, toolName, turnId, isClientTool = false) {
    this._entries.set(toolUseId, {
      toolName,
      turnId,
      isClientTool,
      inputBuffer: "",
      displayedInputLength: 0,
      displayedAt: void 0,
      displayedMessage: void 0,
      info: void 0
    });
  }
  /**
   * Append one `input_json_delta.partial_json` chunk. No-op if the
   * `tool_use_id` is unknown (the caller already logged a warning
   * about the index mismatch).
   */
  appendInputDelta(toolUseId, partialJson) {
    const entry = this._entries.get(toolUseId);
    if (!entry) {
      return;
    }
    entry.inputBuffer += partialJson;
  }
  /**
   * Renders the next streaming display message for a file-edit tool, or
   * `undefined` when nothing new should be shown. Throttled on elapsed time
   * only: the SDK streams argument text token by token, so a size-based rule
   * would make updates rarer as the edit grows. `force` bypasses the interval
   * for the final flush at `content_block_stop`. Identical messages are
   * suppressed so a steady tick does not re-send an unchanged row.
   */
  streamingInputUpdate(toolUseId, force = false) {
    const entry = this._entries.get(toolUseId);
    if (!entry || entry.displayedInputLength === entry.inputBuffer.length) {
      return void 0;
    }
    const now = performance.now();
    if (!force && entry.displayedAt !== void 0 && now - entry.displayedAt < STREAMING_TOOL_DISPLAY_INTERVAL_MS) {
      return void 0;
    }
    const invocationMessage = getClaudeStreamingInvocationMessage(entry.toolName, parsePartialToolInput(entry.inputBuffer));
    if (!invocationMessage) {
      return void 0;
    }
    entry.displayedInputLength = entry.inputBuffer.length;
    entry.displayedAt = now;
    const message = streamingToolDisplayText(invocationMessage);
    if (message === entry.displayedMessage) {
      return void 0;
    }
    entry.displayedMessage = message;
    return { invocationMessage };
  }
  /**
   * Parse the accumulated buffer and stash the computed
   * {@link IClaudeToolStartInfo}. Called from `content_block_stop`.
   * Parse failures fall back to `parsedInput: undefined`; the
   * past-tense helper handles that by returning a generic message.
   */
  finalize(toolUseId) {
    const entry = this._entries.get(toolUseId);
    if (!entry) {
      return;
    }
    let parsedInput;
    if (entry.inputBuffer.length > 0) {
      try {
        const parsed = JSON.parse(entry.inputBuffer);
        if (parsed !== null && typeof parsed === "object") {
          parsedInput = parsed;
        }
      } catch {
      }
    }
    const rawFallback = entry.inputBuffer.length > 0 ? entry.inputBuffer : void 0;
    this._writeInfo(entry, parsedInput, rawFallback);
    entry.inputBuffer = "";
  }
  /**
   * Seed {@link IClaudeToolStartInfo} directly from a pre-parsed
   * input object. Used for inner subagent tool uses, which arrive
   * already-parsed on the synthesized `assistant` message rather
   * than via streamed `input_json_delta` chunks. Without this the
   * registry entry's `info` would stay `undefined` and the live
   * `tool_result` handler would emit the generic
   * `"{displayName} finished"` past-tense, violating D6 (live/replay
   * parity).
   */
  seedParsedInput(toolUseId, parsedInput) {
    const entry = this._entries.get(toolUseId);
    if (!entry) {
      return;
    }
    const normalized = parsedInput !== null && typeof parsedInput === "object" ? parsedInput : void 0;
    this._writeInfo(entry, normalized);
  }
  _writeInfo(entry, parsedInput, rawFallback) {
    const displayName = entry.isClientTool ? entry.toolName : getClaudeToolDisplayName(entry.toolName);
    entry.info = {
      toolName: entry.toolName,
      displayName,
      parsedInput,
      invocationMessage: entry.isClientTool ? displayName : getClaudeInvocationMessage(entry.toolName, displayName, parsedInput),
      toolInput: entry.isClientTool ? formatGenericToolInput(parsedInput, rawFallback) : getClaudeToolInputString(entry.toolName, parsedInput) ?? rawFallback,
      isClientTool: entry.isClientTool
    };
  }
  /**
   * Cross-message lookup. Returns `undefined` if the
   * `tool_use_id` is unknown (defense-in-depth against transport
   * drift / replay). The `info` field may be `undefined` if the
   * tool block never reached `content_block_stop`.
   */
  lookup(toolUseId) {
    const entry = this._entries.get(toolUseId);
    if (!entry) {
      return void 0;
    }
    return { turnId: entry.turnId, toolName: entry.toolName, isClientTool: entry.isClientTool, info: entry.info };
  }
  /**
   * Drop the entry once the matching `tool_result` has been
   * delivered. Bounds the registry's memory across long turns.
   */
  complete(toolUseId) {
    this._entries.delete(toolUseId);
  }
  /**
   * Drop any tracking still pending at the end of a turn and warn
   * once per orphan. A `tool_use` whose `tool_result` never arrives
   * — model misbehavior, transport drop, future cancellation —
   * would otherwise survive in the maps for the lifetime of the
   * session and accumulate across turns. Called from `mapResult`
   * on every `result` envelope.
   */
  clearPending(logService) {
    if (this._entries.size === 0) {
      return;
    }
    for (const [toolUseId, entry] of this._entries) {
      logService.warn(`[claudeToolCallRegistry] turn ${entry.turnId} ended with pending tool_use ${toolUseId} (${entry.toolName}); dropping cross-message state`);
    }
    this._entries.clear();
  }
}
export {
  ClaudeToolCallRegistry
};
