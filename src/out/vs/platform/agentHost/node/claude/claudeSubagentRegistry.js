import { Disposable } from "../../../../base/common/lifecycle.js";
import {
  ResponsePartKind,
  ToolCallStatus,
  ToolResultContentType
} from "../../common/state/protocol/state.js";
const SUBAGENT_TOOL_NAMES = /* @__PURE__ */ new Set(["Task", "Agent"]);
const SUBAGENT_ID_SUFFIX_REGEX = /^\s*agentId:\s+([a-z0-9]+)\b/im;
class SubagentSpawn {
  constructor(toolUseId) {
    this.toolUseId = toolUseId;
    this.background = false;
    this._announced = false;
    this._completed = false;
  }
  get agentId() {
    return this._agentId;
  }
  /**
   * Set the SDK's agent id for this spawn. First-writer-wins: once
   * set, subsequent calls are no-ops. Multiple call sites converge on
   * the same value (canUseTool's `options.agentID`, the strategy chain,
   * and transcript priming all surface the SDK's single identity), so
   * the invariant is enforced here rather than at every caller.
   */
  setAgentId(agentId) {
    if (this._agentId === void 0) {
      this._agentId = agentId;
    }
  }
  markAnnounced() {
    if (this._announced) {
      return false;
    }
    this._announced = true;
    return true;
  }
  markCompleted() {
    if (this._completed) {
      return false;
    }
    this._completed = true;
    return true;
  }
}
class SubagentRegistry extends Disposable {
  constructor() {
    super(...arguments);
    this._spawns = /* @__PURE__ */ new Map();
    this._innerToParent = /* @__PURE__ */ new Map();
  }
  dispose() {
    this._spawns.clear();
    this._innerToParent.clear();
    super.dispose();
  }
  /**
   * Insert a spawn (or return the existing one) for `toolUseId`.
   * Any fields supplied in `init` are written to the spawn under
   * first-writer-wins semantics (see {@link ISubagentSpawnInit}).
   * Idempotent so live writes (canUseTool / strategy resolution /
   * transcript priming / canonical assistant) can converge on the
   * same record.
   */
  recordSpawn(toolUseId, init) {
    let spawn = this._spawns.get(toolUseId);
    if (!spawn) {
      spawn = new SubagentSpawn(toolUseId);
      this._spawns.set(toolUseId, spawn);
    }
    if (init?.agentId !== void 0) {
      spawn.setAgentId(init.agentId);
    }
    if (init?.subagentType !== void 0 && spawn.subagentType === void 0) {
      spawn.subagentType = init.subagentType;
    }
    if (init?.description !== void 0 && spawn.description === void 0) {
      spawn.description = init.description;
    }
    if (init?.prompt !== void 0 && spawn.prompt === void 0) {
      spawn.prompt = init.prompt;
    }
    return spawn;
  }
  getSpawn(toolUseId) {
    return this._spawns.get(toolUseId);
  }
  removeSpawn(toolUseId) {
    this._spawns.delete(toolUseId);
    this._evictInnerEdgesFor(toolUseId);
  }
  /** Mapper records the parent of an inner `tool_use` block when an inner subagent message arrives. */
  noteInnerTool(innerToolUseId, parentToolUseId) {
    this._innerToParent.set(innerToolUseId, parentToolUseId);
  }
  /** canUseTool reads this to attach `parentToolCallId` onto a `pending_confirmation` / `ChatInputRequested`. */
  getParentSpawn(innerToolUseId) {
    const parentId = this._innerToParent.get(innerToolUseId);
    return parentId !== void 0 ? this._spawns.get(parentId) : void 0;
  }
  /**
   * Turn-end cleanup: remove and return foreground spawns whose
   * completion never closed them. Background spawns survive across
   * turns by design (their completion arrives later via
   * `system.task_notification`). Inner-edge entries pointing at
   * drained spawns are evicted too. Caller logs each returned orphan.
   */
  drainForegroundSpawns() {
    const drained = [];
    for (const spawn of this._spawns.values()) {
      if (!spawn.background) {
        drained.push(spawn);
      }
    }
    for (const spawn of drained) {
      this._spawns.delete(spawn.toolUseId);
      this._evictInnerEdgesFor(spawn.toolUseId);
    }
    return drained;
  }
  /**
   * Replay-path bulk populate: scan a parent transcript for the
   * SDK's synthetic `agentId: <hex>` suffix on Task/Agent tool_result
   * text blocks and record each `(toolUseId, agentId)` pair. Idempotent.
   */
  primeFromTranscript(transcript) {
    for (const [toolCallId, agentId] of scanTranscriptForAgentIds(transcript)) {
      this.recordSpawn(toolCallId, { agentId });
    }
  }
  _evictInnerEdgesFor(parentToolUseId) {
    for (const [innerId, parentId] of this._innerToParent) {
      if (parentId === parentToolUseId) {
        this._innerToParent.delete(innerId);
      }
    }
  }
}
function scanTranscriptForAgentIds(transcript) {
  const out = /* @__PURE__ */ new Map();
  for (const turn of transcript) {
    for (const part of turn.responseParts) {
      const pair = extractAgentIdPair(part);
      if (pair) {
        out.set(pair.toolCallId, pair.agentId);
      }
    }
  }
  return out;
}
function extractAgentIdPair(part) {
  if (part.kind !== ResponsePartKind.ToolCall) {
    return void 0;
  }
  const state = part.toolCall;
  if (!SUBAGENT_TOOL_NAMES.has(state.toolName)) {
    return void 0;
  }
  if (state.status !== ToolCallStatus.Completed && state.status !== ToolCallStatus.PendingResultConfirmation) {
    return void 0;
  }
  const content = state.content;
  if (!content) {
    return void 0;
  }
  for (let i = content.length - 1; i >= 0; i--) {
    const block = content[i];
    if (block.type !== ToolResultContentType.Text) {
      continue;
    }
    const m = SUBAGENT_ID_SUFFIX_REGEX.exec(block.text);
    if (m) {
      return { toolCallId: state.toolCallId, agentId: m[1] };
    }
  }
  return void 0;
}
export {
  SUBAGENT_ID_SUFFIX_REGEX,
  SUBAGENT_TOOL_NAMES,
  SubagentRegistry,
  SubagentSpawn,
  scanTranscriptForAgentIds
};
