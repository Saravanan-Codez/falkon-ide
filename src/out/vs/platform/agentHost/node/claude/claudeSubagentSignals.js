import { toToolCallMeta } from "../../common/meta/agentToolCallMeta.js";
import { ActionType } from "../../common/state/sessionActions.js";
import { ResponsePartKind, ToolCallConfirmationReason, ToolCallContributorKind } from "../../common/state/sessionState.js";
import { SUBAGENT_TOOL_NAMES } from "./claudeSubagentRegistry.js";
import { buildClaudeToolCallMeta, buildClaudeToolMeta, getClaudeInvocationMessage, getClaudeToolDisplayName, getClaudeToolInputString } from "./claudeToolDisplay.js";
import { hasClientToolNamePrefix, stripClientToolNamePrefix } from "./clientTools/claudeClientToolMcpServer.js";
const SUBAGENT_SPAWNING_TOOL_NAMES = SUBAGENT_TOOL_NAMES;
function tagWithParent(signals, chat, parentToolUseId, registry) {
  if (!parentToolUseId) {
    return signals;
  }
  const tagged = signals.map((s) => {
    if (s.kind === "action") {
      return { ...s, parentToolCallId: parentToolUseId };
    }
    if (s.kind === "pending_confirmation") {
      return { ...s, parentToolCallId: parentToolUseId };
    }
    return s;
  });
  const spawn = registry.getSpawn(parentToolUseId);
  if (!spawn || !spawn.markAnnounced()) {
    return tagged;
  }
  const started = {
    kind: "subagent_started",
    chat,
    toolCallId: parentToolUseId,
    agentName: spawn.subagentType ?? "subagent",
    agentDisplayName: spawn.subagentType ?? "Subagent",
    agentDescription: spawn.description,
    // The Task tool's short `description` input doubles as the concise
    // per-task tab title for the subagent's read-only peer chat.
    taskDescription: spawn.description,
    // The Task tool's `prompt` input is the full delegated instruction
    // that seeds the subagent peer chat's opening request.
    taskPrompt: spawn.prompt,
    // When the spawning Task tool is itself an inner tool of another
    // subagent, its parent Task (one level up) is the tool call in
    // whose chat this spawning tool lives. The host uses it to route
    // the discovery content block to that immediate parent chat, at
    // any nesting depth.
    parentToolCallId: registry.getParentSpawn(parentToolUseId)?.toolUseId
  };
  return [started, ...tagged];
}
function mapSubagentSystemMessage(message, chat, registry) {
  const sub = message.subtype;
  if (sub === "task_started") {
    const toolUseId = message.tool_use_id;
    const spawn = toolUseId ? registry.getSpawn(toolUseId) : void 0;
    if (spawn) {
      spawn.background = true;
    }
    return [];
  }
  if (sub === "task_notification") {
    const m = message;
    if (!m.tool_use_id) {
      return [];
    }
    const status = m.status;
    if (status !== "completed" && status !== "failed" && status !== "stopped") {
      return [];
    }
    const spawn = registry.getSpawn(m.tool_use_id);
    if (!spawn || !spawn.markCompleted()) {
      return [];
    }
    const toolUseId = m.tool_use_id;
    registry.removeSpawn(toolUseId);
    return [{ kind: "subagent_completed", chat, toolCallId: toolUseId }];
  }
  return [];
}
function buildTopLevelSubagentReadyAction(block, chat, turnId, registry) {
  const input = block.input;
  const description = typeof input?.description === "string" ? input.description : void 0;
  const agentName = typeof input?.subagent_type === "string" ? input.subagent_type : void 0;
  const prompt = typeof input?.prompt === "string" ? input.prompt : void 0;
  const inputJson = block.input !== void 0 ? safeStringify(block.input) : void 0;
  registry.recordSpawn(block.id, { subagentType: agentName, description, prompt });
  const meta = { ...buildClaudeToolCallMeta(block.name) };
  if (!meta.toolKind) {
    meta.toolKind = "subagent";
  }
  if (description) {
    meta.subagentDescription = description;
  }
  if (agentName) {
    meta.subagentAgentName = agentName;
  }
  return {
    kind: "action",
    resource: chat,
    action: {
      type: ActionType.ChatToolCallReady,
      turnId,
      toolCallId: block.id,
      invocationMessage: getClaudeInvocationMessage(block.name, getClaudeToolDisplayName(block.name), block.input),
      ...inputJson !== void 0 ? { toolInput: inputJson } : {},
      confirmed: ToolCallConfirmationReason.NotNeeded,
      _meta: toToolCallMeta(meta)
    }
  };
}
function emitInnerAssistantSignals(message, chat, turnId, state, parentToolUseId, registry, clientToolOwner) {
  const messageId = message.message.id;
  const signals = [];
  for (let index = 0; index < message.message.content.length; index++) {
    const block = message.message.content[index];
    if (block.type === "text") {
      signals.push({
        kind: "action",
        resource: chat,
        action: {
          type: ActionType.ChatResponsePart,
          turnId,
          part: {
            kind: ResponsePartKind.Markdown,
            id: `${turnId}#${messageId}#${index}`,
            content: block.text
          }
        }
      });
      continue;
    }
    if (block.type === "thinking") {
      signals.push({
        kind: "action",
        resource: chat,
        action: {
          type: ActionType.ChatResponsePart,
          turnId,
          part: {
            kind: ResponsePartKind.Reasoning,
            id: `${turnId}#${messageId}#${index}`,
            content: block.thinking
          }
        }
      });
      continue;
    }
    if (block.type === "tool_use") {
      const toolName = stripClientToolNamePrefix(block.name);
      const isClientTool = hasClientToolNamePrefix(block.name);
      const clientId = isClientTool ? clientToolOwner?.(toolName) : void 0;
      state.startToolBlock(index, block.id, toolName, turnId, isClientTool);
      state.toolCalls.seedParsedInput(block.id, block.input);
      registry.noteInnerTool(block.id, parentToolUseId);
      const displayName = isClientTool ? toolName : getClaudeToolDisplayName(toolName);
      const meta = isClientTool ? void 0 : buildClaudeToolMeta(toolName);
      const info = state.toolCalls.lookup(block.id)?.info;
      const toolInputStr = info?.toolInput ?? getClaudeToolInputString(toolName, block.input);
      signals.push({
        kind: "action",
        resource: chat,
        action: {
          type: ActionType.ChatToolCallStart,
          turnId,
          toolCallId: block.id,
          toolName,
          displayName,
          ...clientId ? { contributor: { kind: ToolCallContributorKind.Client, clientId } } : {},
          ...meta ? { _meta: meta } : {}
        }
      });
      signals.push({
        kind: "action",
        resource: chat,
        action: {
          type: ActionType.ChatToolCallReady,
          turnId,
          toolCallId: block.id,
          invocationMessage: isClientTool ? displayName : getClaudeInvocationMessage(toolName, displayName, block.input),
          ...toolInputStr !== void 0 ? { toolInput: toolInputStr } : {},
          confirmed: ToolCallConfirmationReason.NotNeeded
        }
      });
      continue;
    }
  }
  return signals;
}
function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return void 0;
  }
}
export {
  SUBAGENT_SPAWNING_TOOL_NAMES,
  buildTopLevelSubagentReadyAction,
  emitInnerAssistantSignals,
  mapSubagentSystemMessage,
  tagWithParent
};
