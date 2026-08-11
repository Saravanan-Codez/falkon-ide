import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { toToolCallMeta } from "../../common/meta/agentToolCallMeta.js";
import { ActionType } from "../../common/state/sessionActions.js";
import { MessageKind, ResponsePartKind, ToolCallConfirmationReason, ToolCallContributorKind, ToolResultContentType, TurnState } from "../../common/state/sessionState.js";
import { extractForwardedErrorInfo } from "../shared/proxyChatError.js";
import { getServerToolDisplay } from "../shared/serverToolGroups.js";
import { ActiveClientToolSet } from "../activeClientState.js";
import { unwrapShellInvocation } from "./codexShellCommand.js";
function createCodexSessionMapState(serverToolNames = /* @__PURE__ */ new Set(), clientToolSet = new ActiveClientToolSet()) {
  return {
    itemToPartId: /* @__PURE__ */ new Map(),
    itemToToolCall: /* @__PURE__ */ new Map(),
    itemToReasoningPartId: /* @__PURE__ */ new Map(),
    currentTurnId: void 0,
    clientToolSet,
    serverToolNames,
    mcpCustomizationIds: /* @__PURE__ */ new Map(),
    declinedToolCalls: /* @__PURE__ */ new Set(),
    deferredResponseActions: [],
    pendingPreflight: void 0,
    agentMessagePartCount: 0
  };
}
function resetCodexTurnMapState(state) {
  state.itemToPartId.clear();
  state.itemToToolCall.clear();
  state.itemToReasoningPartId.clear();
  state.declinedToolCalls.clear();
  state.deferredResponseActions.length = 0;
  state.pendingPreflight = void 0;
  state.agentMessagePartCount = 0;
}
function finalizeCodexTurnMapState(state, unresolvedToolMessage) {
  const preflightFlush = flushPendingPreflight(state);
  const orphanedToolCallActions = completeOrphanedToolCalls(state, unresolvedToolMessage);
  const deferredResponseActions = flushDeferredResponseActions(state);
  resetCodexTurnMapState(state);
  return [...preflightFlush, ...orphanedToolCallActions, ...deferredResponseActions];
}
function flushPendingPreflight(state) {
  const pending = state.pendingPreflight;
  if (!pending) {
    return [];
  }
  state.pendingPreflight = void 0;
  return pending.completion;
}
function deferResponseWhileToolCallIsOpen(state, actions) {
  if (!hasOpenCommandExecution(state) && !state.pendingPreflight) {
    return actions;
  }
  state.deferredResponseActions.push(...actions);
  return [];
}
function flushDeferredResponseActions(state) {
  if (hasOpenCommandExecution(state) || state.pendingPreflight || state.deferredResponseActions.length === 0) {
    return [];
  }
  return state.deferredResponseActions.splice(0);
}
function hasOpenCommandExecution(state) {
  return [...state.itemToToolCall.values()].some((entry) => entry.toolName === "shell");
}
function completeOrphanedToolCalls(state, errorMessage) {
  const orphanedToolCalls = [...state.itemToToolCall.values()];
  state.itemToToolCall.clear();
  return orphanedToolCalls.map((entry) => ({
    type: ActionType.ChatToolCallComplete,
    turnId: entry.turnId,
    toolCallId: entry.toolCallId,
    result: {
      success: false,
      pastTenseMessage: `Stopped ${entry.toolName}`,
      content: entry.output ? [{ type: ToolResultContentType.Text, text: entry.output }] : void 0,
      error: { message: errorMessage }
    }
  }));
}
function extractUserInputText(content) {
  const collected = [];
  for (const c of content) {
    if (c.type === "text") {
      collected.push(c.text);
    }
  }
  return collected.join("\n\n");
}
function reasoningKey(itemId, kind, index) {
  return `${itemId}:${kind}:${index}`;
}
function ensureReasoningPart(state, turnId, key) {
  const existing = state.itemToReasoningPartId.get(key);
  if (existing) {
    return { partId: existing, actions: [] };
  }
  const partId = generateUuid();
  state.itemToReasoningPartId.set(key, partId);
  return {
    partId,
    actions: [{
      type: ActionType.ChatResponsePart,
      turnId,
      part: { kind: ResponsePartKind.Reasoning, id: partId, content: "" }
    }]
  };
}
function describeWebSearch(query, action) {
  if (action?.type === "search") {
    return action.queries?.join(", ") ?? action.query ?? query;
  }
  if (action?.type === "openPage") {
    return action.url ?? query;
  }
  if (action?.type === "findInPage") {
    return [action.pattern, action.url].filter(Boolean).join(" in ") || query;
  }
  return query;
}
function describeFileChange(changes) {
  return changes.map((change) => {
    const kind = change.kind.type === "update" && change.kind.move_path ? `rename from ${change.kind.move_path}` : change.kind.type;
    return `${kind}: ${change.path}`;
  }).join("\n");
}
function fileChangeOutput(changes) {
  return changes.map((change) => `${describeFileChange([change])}
${change.diff}`.trim()).join("\n\n");
}
function codexCompactionLabels() {
  return {
    displayName: localize("codex.compaction.displayName", "Compact conversation"),
    invocationMessage: localize("codex.compaction.inProgress", "Compacting conversation"),
    pastTenseMessage: localize("codex.compaction.completed", "Compacted conversation")
  };
}
function jsonValueToText(value) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
function toolInputText(value) {
  return JSON.stringify(value, null, 2);
}
function dynamicToolOutput(contentItems) {
  return contentItems?.map((item) => item.type === "inputText" ? item.text : item.type === "inputImage" ? item.imageUrl : item.audioUrl).join("\n") ?? "";
}
function mcpToolOutput(result, errorMessage) {
  if (errorMessage) {
    return errorMessage;
  }
  if (!result) {
    return "";
  }
  const content = result.content.map(jsonValueToText).join("\n");
  const structuredContent = result.structuredContent !== null ? jsonValueToText(result.structuredContent) : "";
  return [content, structuredContent].filter(Boolean).join("\n");
}
function collabAgentToolLabels(tool) {
  switch (tool) {
    case "spawnAgent":
      return { displayName: "Spawn agent", present: "Spawning agent", past: "Spawned agent" };
    case "sendInput":
      return { displayName: "Send input to agent", present: "Sending input to agent", past: "Sent input to agent" };
    case "resumeAgent":
      return { displayName: "Resume agent", present: "Resuming agent", past: "Resumed agent" };
    case "wait":
      return { displayName: "Wait for agents", present: "Waiting for agents", past: "Finished waiting" };
    case "closeAgent":
      return { displayName: "Close agent", present: "Closing agent", past: "Closed agent" };
    default:
      return { displayName: tool, present: tool, past: tool };
  }
}
function collabAgentStateSummary(state) {
  switch (state.status) {
    case "completed":
      return state.message ? `Completed \u2014 ${state.message}` : "Completed";
    case "errored":
      return state.message ? `Errored \u2014 ${state.message}` : "Errored";
    case "running":
      return state.message ? `Running \u2014 ${state.message}` : "Running";
    case "interrupted":
      return state.message ? `Interrupted \u2014 ${state.message}` : "Interrupted";
    case "pendingInit":
      return "Pending init";
    case "shutdown":
      return "Shutdown";
    case "notFound":
      return "Not found";
    default:
      return state.status;
  }
}
function collabAgentResultOutput(receiverThreadIds, agentsStates) {
  const seen = /* @__PURE__ */ new Set();
  const states = [];
  for (const id of receiverThreadIds) {
    const state = agentsStates[id];
    if (state) {
      states.push(state);
      seen.add(id);
    }
  }
  for (const id of Object.keys(agentsStates).sort()) {
    if (seen.has(id)) {
      continue;
    }
    const state = agentsStates[id];
    if (state) {
      states.push(state);
    }
  }
  if (states.length === 0) {
    return "";
  }
  if (states.length === 1) {
    return collabAgentStateSummary(states[0]);
  }
  return states.map((state, index) => `Agent ${index + 1}: ${collabAgentStateSummary(state)}`).join("\n");
}
function mapTurnStarted(state, params, fallbackUserText) {
  state.currentTurnId = params.turn.id;
  resetCodexTurnMapState(state);
  let userText = fallbackUserText;
  const first = params.turn.items?.[0];
  if (first && first.type === "userMessage") {
    const collected = extractUserInputText(first.content);
    if (collected.length > 0) {
      userText = collected;
    }
  }
  return [
    {
      type: ActionType.ChatTurnStarted,
      turnId: params.turn.id,
      startedAt: typeof params.turn.startedAt === "number" ? new Date(params.turn.startedAt * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      message: { text: userText, origin: { kind: MessageKind.User } }
    }
  ];
}
function mapReasoningSummaryPartAdded(state, params) {
  return deferResponseWhileToolCallIsOpen(state, ensureReasoningPart(state, params.turnId, reasoningKey(params.itemId, "summary", params.summaryIndex)).actions);
}
function mapReasoningSummaryTextDelta(state, params) {
  const ensured = ensureReasoningPart(state, params.turnId, reasoningKey(params.itemId, "summary", params.summaryIndex));
  return deferResponseWhileToolCallIsOpen(state, [
    ...ensured.actions,
    { type: ActionType.ChatReasoning, turnId: params.turnId, partId: ensured.partId, content: params.delta }
  ]);
}
function mapReasoningTextDelta(state, params) {
  const ensured = ensureReasoningPart(state, params.turnId, reasoningKey(params.itemId, "text", params.contentIndex));
  return deferResponseWhileToolCallIsOpen(state, [
    ...ensured.actions,
    { type: ActionType.ChatReasoning, turnId: params.turnId, partId: ensured.partId, content: params.delta }
  ]);
}
function clearReasoningForItem(state, itemId) {
  for (const key of [...state.itemToReasoningPartId.keys()]) {
    if (key.startsWith(`${itemId}:`)) {
      state.itemToReasoningPartId.delete(key);
    }
  }
}
function mapTokenUsageUpdated(params) {
  const last = params.tokenUsage.last;
  return [{
    type: ActionType.ChatUsage,
    turnId: params.turnId,
    usage: {
      inputTokens: last.inputTokens,
      outputTokens: last.outputTokens,
      cacheReadTokens: last.cachedInputTokens,
      _meta: {
        reasoningOutputTokens: last.reasoningOutputTokens,
        modelContextWindow: params.tokenUsage.modelContextWindow
      }
    }
  }];
}
function mapItemStarted(state, params) {
  if (params.item.type === "commandExecution") {
    const pending = state.pendingPreflight;
    if (pending && pending.turnId === params.turnId && pending.command === unwrapShellInvocation(params.item.command ?? "")) {
      state.pendingPreflight = void 0;
      state.itemToToolCall.set(params.item.id, {
        toolCallId: pending.toolCallId,
        turnId: params.turnId,
        toolName: "shell",
        output: ""
      });
      return [];
    }
  }
  const flushed = flushPendingPreflight(state);
  const deferredResponseActions = flushDeferredResponseActions(state);
  const body = mapItemStartedBody(state, params);
  const orderedBody = params.item.type === "agentMessage" ? deferResponseWhileToolCallIsOpen(state, body) : body;
  return [...flushed, ...deferredResponseActions, ...orderedBody];
}
function mapItemStartedBody(state, params) {
  if (params.item.type === "agentMessage") {
    const partId = generateUuid();
    state.itemToPartId.set(params.item.id, partId);
    const separator = state.agentMessagePartCount > 0 ? "\n\n" : "";
    state.agentMessagePartCount++;
    return [
      {
        type: ActionType.ChatResponsePart,
        turnId: params.turnId,
        part: {
          kind: ResponsePartKind.Markdown,
          id: partId,
          content: separator + (params.item.text ?? "")
        }
      }
    ];
  }
  if (params.item.type === "commandExecution") {
    const toolCallId = generateUuid();
    state.itemToToolCall.set(params.item.id, {
      toolCallId,
      turnId: params.turnId,
      toolName: "shell",
      output: ""
    });
    const command = unwrapShellInvocation(params.item.command ?? "");
    return [
      {
        type: ActionType.ChatToolCallStart,
        turnId: params.turnId,
        toolCallId,
        toolName: "shell",
        displayName: "Run shell command",
        _meta: toToolCallMeta({ toolKind: "terminal" })
      },
      {
        type: ActionType.ChatToolCallDelta,
        turnId: params.turnId,
        toolCallId,
        content: command
      },
      {
        type: ActionType.ChatToolCallReady,
        turnId: params.turnId,
        toolCallId,
        invocationMessage: command,
        toolInput: command,
        confirmed: ToolCallConfirmationReason.NotNeeded,
        _meta: toToolCallMeta({ toolKind: "terminal" })
      }
    ];
  }
  if (params.item.type === "webSearch") {
    const toolCallId = generateUuid();
    state.itemToToolCall.set(params.item.id, {
      toolCallId,
      turnId: params.turnId,
      toolName: "web_search",
      output: ""
    });
    const query = describeWebSearch(params.item.query, params.item.action);
    return [
      {
        type: ActionType.ChatToolCallStart,
        turnId: params.turnId,
        toolCallId,
        toolName: "web_search",
        displayName: "Web search",
        _meta: toToolCallMeta({ toolKind: "search" })
      },
      {
        type: ActionType.ChatToolCallDelta,
        turnId: params.turnId,
        toolCallId,
        content: query
      },
      {
        type: ActionType.ChatToolCallReady,
        turnId: params.turnId,
        toolCallId,
        invocationMessage: query,
        toolInput: query,
        confirmed: ToolCallConfirmationReason.NotNeeded,
        _meta: toToolCallMeta({ toolKind: "search" })
      }
    ];
  }
  if (params.item.type === "fileChange") {
    const toolCallId = generateUuid();
    const output = fileChangeOutput(params.item.changes);
    state.itemToToolCall.set(params.item.id, {
      toolCallId,
      turnId: params.turnId,
      toolName: "file_edit",
      output
    });
    const summary = describeFileChange(params.item.changes) || "Apply file changes";
    return [
      {
        type: ActionType.ChatToolCallStart,
        turnId: params.turnId,
        toolCallId,
        toolName: "file_edit",
        displayName: "Apply file changes"
      },
      {
        type: ActionType.ChatToolCallDelta,
        turnId: params.turnId,
        toolCallId,
        content: summary
      },
      {
        type: ActionType.ChatToolCallReady,
        turnId: params.turnId,
        toolCallId,
        invocationMessage: summary,
        toolInput: summary,
        confirmed: ToolCallConfirmationReason.NotNeeded
      },
      ...output ? [{
        type: ActionType.ChatToolCallContentChanged,
        turnId: params.turnId,
        toolCallId,
        content: [{ type: ToolResultContentType.Text, text: output }]
      }] : []
    ];
  }
  if (params.item.type === "mcpToolCall") {
    const toolCallId = generateUuid();
    const toolName = `${params.item.server}.${params.item.tool}`;
    const toolInput = toolInputText(params.item.arguments);
    const customizationId = state.mcpCustomizationIds.get(params.item.server);
    state.itemToToolCall.set(params.item.id, {
      toolCallId,
      turnId: params.turnId,
      toolName,
      output: ""
    });
    return [
      {
        type: ActionType.ChatToolCallStart,
        turnId: params.turnId,
        toolCallId,
        toolName,
        displayName: params.item.tool,
        ...customizationId ? { contributor: { kind: ToolCallContributorKind.MCP, customizationId } } : {}
      },
      {
        type: ActionType.ChatToolCallDelta,
        turnId: params.turnId,
        toolCallId,
        content: toolInput
      },
      {
        type: ActionType.ChatToolCallReady,
        turnId: params.turnId,
        toolCallId,
        invocationMessage: `Calling ${toolName}`,
        toolInput,
        confirmed: ToolCallConfirmationReason.NotNeeded
      }
    ];
  }
  if (params.item.type === "dynamicToolCall") {
    const toolCallId = generateUuid();
    const toolName = params.item.namespace ? `${params.item.namespace}.${params.item.tool}` : params.item.tool;
    const toolInput = toolInputText(params.item.arguments);
    const output = dynamicToolOutput(params.item.contentItems);
    const isServerTool = params.item.namespace === null && state.serverToolNames.has(params.item.tool);
    const ownerClientId = isServerTool ? void 0 : state.clientToolSet.ownerOf(params.item.tool);
    const serverDisplay = getServerToolDisplay(params.item.tool, params.item.arguments);
    state.itemToToolCall.set(params.item.id, {
      toolCallId,
      turnId: params.turnId,
      toolName,
      output
    });
    return [
      {
        type: ActionType.ChatToolCallStart,
        turnId: params.turnId,
        toolCallId,
        toolName,
        displayName: serverDisplay?.displayName ?? params.item.tool,
        ...ownerClientId ? { contributor: { kind: ToolCallContributorKind.Client, clientId: ownerClientId } } : {}
      },
      {
        type: ActionType.ChatToolCallDelta,
        turnId: params.turnId,
        toolCallId,
        content: toolInput
      },
      {
        type: ActionType.ChatToolCallReady,
        turnId: params.turnId,
        toolCallId,
        invocationMessage: serverDisplay?.invocationMessage ?? `Calling ${toolName}`,
        toolInput,
        confirmed: ToolCallConfirmationReason.NotNeeded
      },
      ...output ? [{
        type: ActionType.ChatToolCallContentChanged,
        turnId: params.turnId,
        toolCallId,
        content: [{ type: ToolResultContentType.Text, text: output }]
      }] : []
    ];
  }
  if (params.item.type === "collabAgentToolCall") {
    const toolCallId = generateUuid();
    const labels = collabAgentToolLabels(params.item.tool);
    const toolName = `codex.${params.item.tool}`;
    state.itemToToolCall.set(params.item.id, {
      toolCallId,
      turnId: params.turnId,
      toolName,
      output: ""
    });
    if (params.item.tool === "spawnAgent") {
      return [
        {
          type: ActionType.ChatToolCallStart,
          turnId: params.turnId,
          toolCallId,
          toolName,
          displayName: labels.displayName
        },
        {
          type: ActionType.ChatToolCallReady,
          turnId: params.turnId,
          toolCallId,
          invocationMessage: labels.present,
          confirmed: ToolCallConfirmationReason.NotNeeded
        }
      ];
    }
    const inputParts = [];
    if (params.item.prompt) {
      inputParts.push(params.item.prompt);
    }
    if (params.item.model) {
      inputParts.push(`Model: ${params.item.model}`);
    }
    const toolInput = inputParts.join("\n\n");
    return [
      {
        type: ActionType.ChatToolCallStart,
        turnId: params.turnId,
        toolCallId,
        toolName,
        displayName: labels.displayName
      },
      ...toolInput ? [{
        type: ActionType.ChatToolCallDelta,
        turnId: params.turnId,
        toolCallId,
        content: toolInput
      }] : [],
      {
        type: ActionType.ChatToolCallReady,
        turnId: params.turnId,
        toolCallId,
        invocationMessage: labels.present,
        toolInput,
        confirmed: ToolCallConfirmationReason.NotNeeded
      }
    ];
  }
  if (params.item.type === "contextCompaction") {
    const toolCallId = generateUuid();
    const labels = codexCompactionLabels();
    state.itemToToolCall.set(params.item.id, {
      toolCallId,
      turnId: params.turnId,
      toolName: "compact",
      output: ""
    });
    return [
      {
        type: ActionType.ChatToolCallStart,
        turnId: params.turnId,
        toolCallId,
        toolName: "compact",
        displayName: labels.displayName
      },
      {
        type: ActionType.ChatToolCallReady,
        turnId: params.turnId,
        toolCallId,
        invocationMessage: labels.invocationMessage,
        confirmed: ToolCallConfirmationReason.NotNeeded
      }
    ];
  }
  return [];
}
function mapCommandExecutionOutputDelta(state, params) {
  const entry = state.itemToToolCall.get(params.itemId);
  if (!entry) {
    return [];
  }
  entry.output += params.delta;
  return [{
    type: ActionType.ChatToolCallContentChanged,
    turnId: entry.turnId,
    toolCallId: entry.toolCallId,
    content: [{ type: ToolResultContentType.Text, text: entry.output }]
  }];
}
function mapFileChangePatchUpdated(state, params) {
  const entry = state.itemToToolCall.get(params.itemId);
  if (!entry) {
    return [];
  }
  entry.output = fileChangeOutput(params.changes);
  return [{
    type: ActionType.ChatToolCallContentChanged,
    turnId: entry.turnId,
    toolCallId: entry.toolCallId,
    content: entry.output ? [{ type: ToolResultContentType.Text, text: entry.output }] : []
  }];
}
function mapFileChangeOutputDelta(state, params) {
  const entry = state.itemToToolCall.get(params.itemId);
  if (!entry) {
    return [];
  }
  entry.output += params.delta;
  return [{
    type: ActionType.ChatToolCallContentChanged,
    turnId: entry.turnId,
    toolCallId: entry.toolCallId,
    content: [{ type: ToolResultContentType.Text, text: entry.output }]
  }];
}
function mapMcpToolCallProgress(state, params) {
  const entry = state.itemToToolCall.get(params.itemId);
  if (!entry) {
    return [];
  }
  entry.output = [entry.output, params.message].filter(Boolean).join("\n");
  return [{
    type: ActionType.ChatToolCallContentChanged,
    turnId: entry.turnId,
    toolCallId: entry.toolCallId,
    content: [{ type: ToolResultContentType.Text, text: entry.output }]
  }];
}
function mapAgentMessageDelta(state, params) {
  const partId = state.itemToPartId.get(params.itemId);
  if (!partId) {
    return [];
  }
  return deferResponseWhileToolCallIsOpen(state, [
    {
      type: ActionType.ChatDelta,
      turnId: params.turnId,
      partId,
      content: params.delta
    }
  ]);
}
function mapItemCompleted(state, params) {
  if (params.item.type === "agentMessage") {
    state.itemToPartId.delete(params.item.id);
    return [];
  }
  if (params.item.type === "reasoning") {
    clearReasoningForItem(state, params.item.id);
    return [];
  }
  const entry = state.itemToToolCall.get(params.item.id);
  if (!entry) {
    return [];
  }
  state.itemToToolCall.delete(params.item.id);
  const declined = state.declinedToolCalls.delete(entry.toolCallId);
  if (params.item.type === "contextCompaction") {
    return [{
      type: ActionType.ChatToolCallComplete,
      turnId: entry.turnId,
      toolCallId: entry.toolCallId,
      result: {
        success: true,
        pastTenseMessage: codexCompactionLabels().pastTenseMessage
      }
    }];
  }
  if (params.item.type === "commandExecution") {
    const success = params.item.status === "completed" && (params.item.exitCode === 0 || params.item.exitCode === null);
    const output = params.item.aggregatedOutput ?? entry.output;
    const command = unwrapShellInvocation(params.item.command ?? "");
    const exit = params.item.exitCode;
    const pastTense = success ? `Ran \`${command}\`` : exit !== null ? `Ran \`${command}\` (exit ${exit})` : `Ran \`${command}\` (failed)`;
    const completion = [
      {
        type: ActionType.ChatToolCallComplete,
        turnId: entry.turnId,
        toolCallId: entry.toolCallId,
        result: {
          success,
          pastTenseMessage: pastTense,
          content: output ? [{ type: ToolResultContentType.Text, text: output }] : void 0,
          error: success ? void 0 : {
            message: exit !== null ? `Exit code ${exit}` : "Command failed",
            ...declined ? { code: "denied" } : {}
          }
        }
      }
    ];
    if (success && !output && !declined) {
      const flushed = flushPendingPreflight(state);
      state.pendingPreflight = { toolCallId: entry.toolCallId, turnId: entry.turnId, command, completion };
      return [...flushed, ...flushDeferredResponseActions(state)];
    }
    return [...flushPendingPreflight(state), ...completion, ...flushDeferredResponseActions(state)];
  }
  if (params.item.type === "webSearch") {
    const query = describeWebSearch(params.item.query, params.item.action);
    return [{
      type: ActionType.ChatToolCallComplete,
      turnId: entry.turnId,
      toolCallId: entry.toolCallId,
      result: {
        success: true,
        pastTenseMessage: `Searched ${query}`
      }
    }];
  }
  if (params.item.type === "fileChange") {
    const output = fileChangeOutput(params.item.changes) || entry.output;
    const success = params.item.status === "completed";
    const content = output ? [{ type: ToolResultContentType.Text, text: output }] : void 0;
    const result = {
      success,
      pastTenseMessage: success ? "Applied file changes" : "Failed to apply file changes",
      content,
      ...success ? {} : { error: { message: `Patch ${params.item.status}`, ...declined ? { code: "denied" } : {} } }
    };
    return [{
      type: ActionType.ChatToolCallComplete,
      turnId: entry.turnId,
      toolCallId: entry.toolCallId,
      result
    }];
  }
  if (params.item.type === "mcpToolCall") {
    const success = params.item.status === "completed" && !params.item.error;
    const output = mcpToolOutput(params.item.result, params.item.error?.message) || entry.output;
    const content = output ? [{ type: ToolResultContentType.Text, text: output }] : void 0;
    return [{
      type: ActionType.ChatToolCallComplete,
      turnId: entry.turnId,
      toolCallId: entry.toolCallId,
      result: {
        success,
        pastTenseMessage: success ? `Called ${entry.toolName}` : `Failed to call ${entry.toolName}`,
        content,
        ...success ? {} : { error: { message: params.item.error?.message ?? `MCP tool ${params.item.status}`, ...declined ? { code: "denied" } : {} } }
      }
    }];
  }
  if (params.item.type === "dynamicToolCall") {
    const success = params.item.success === true || params.item.status === "completed";
    const output = dynamicToolOutput(params.item.contentItems) || entry.output;
    const content = output ? [{ type: ToolResultContentType.Text, text: output }] : void 0;
    const serverPastTense = success ? getServerToolDisplay(entry.toolName, params.item.arguments, { text: output, success })?.pastTenseMessage : void 0;
    return [{
      type: ActionType.ChatToolCallComplete,
      turnId: entry.turnId,
      toolCallId: entry.toolCallId,
      result: {
        success,
        pastTenseMessage: serverPastTense ?? (success ? `Called ${entry.toolName}` : `Failed to call ${entry.toolName}`),
        content,
        ...success ? {} : { error: { message: `Dynamic tool ${params.item.status}`, ...declined ? { code: "denied" } : {} } }
      }
    }];
  }
  if (params.item.type === "collabAgentToolCall") {
    const labels = collabAgentToolLabels(params.item.tool);
    const success = params.item.status === "completed";
    const output = collabAgentResultOutput(params.item.receiverThreadIds, params.item.agentsStates) || entry.output;
    const content = output ? [{ type: ToolResultContentType.Text, text: output }] : void 0;
    return [{
      type: ActionType.ChatToolCallComplete,
      turnId: entry.turnId,
      toolCallId: entry.toolCallId,
      result: {
        success,
        pastTenseMessage: success ? labels.past : `${labels.displayName} failed`,
        content,
        ...success ? {} : { error: { message: `Collab agent ${params.item.status}`, ...declined ? { code: "denied" } : {} } }
      }
    }];
  }
  return [];
}
function mapTurnCompleted(state, params, fallbackDuration) {
  state.currentTurnId = void 0;
  state.itemToPartId.clear();
  state.itemToReasoningPartId.clear();
  const recoveredToolCallActions = [];
  for (const item of params.turn.items) {
    if (item.type === "commandExecution" && (item.exitCode !== null || item.status !== "completed") && state.itemToToolCall.has(item.id)) {
      recoveredToolCallActions.push(...mapItemCompleted(state, {
        threadId: params.threadId,
        turnId: params.turn.id,
        item,
        completedAtMs: typeof params.turn.completedAt === "number" ? params.turn.completedAt * 1e3 : 0
      }));
    }
  }
  const preflightFlush = flushPendingPreflight(state);
  const turnId = params.turn.id;
  const status = params.turn.status;
  const duration = typeof params.turn.durationMs === "number" && Number.isFinite(params.turn.durationMs) && params.turn.durationMs >= 0 ? params.turn.durationMs : typeof params.turn.startedAt === "number" && typeof params.turn.completedAt === "number" ? Math.max(0, (params.turn.completedAt - params.turn.startedAt) * 1e3) : typeof fallbackDuration === "number" && Number.isFinite(fallbackDuration) ? Math.max(0, fallbackDuration) : 0;
  const orphanedToolCallActions = completeOrphanedToolCalls(state, status === "interrupted" ? "Turn interrupted before the tool completed" : "Turn completed before the tool reported completion");
  const deferredResponseActions = flushDeferredResponseActions(state);
  if (status === "failed" && params.turn.error) {
    return [
      ...recoveredToolCallActions,
      ...preflightFlush,
      ...orphanedToolCallActions,
      ...deferredResponseActions,
      {
        type: ActionType.ChatError,
        turnId,
        duration,
        error: mapCodexTurnError(params.turn.error)
      },
      {
        type: ActionType.ChatTurnComplete,
        turnId,
        duration
      }
    ];
  }
  if (status === "interrupted") {
    return [...recoveredToolCallActions, ...preflightFlush, ...orphanedToolCallActions, ...deferredResponseActions, { type: ActionType.ChatTurnCancelled, turnId, duration }];
  }
  return [...recoveredToolCallActions, ...preflightFlush, ...orphanedToolCallActions, ...deferredResponseActions, { type: ActionType.ChatTurnComplete, turnId, duration }];
}
function mapCodexTurnError(error) {
  return {
    errorType: "CodexError",
    ...extractForwardedErrorInfo(error.message || "Codex turn failed"),
    ...error.additionalDetails ? { stack: error.additionalDetails } : {}
  };
}
function turnStateFromStatus(status) {
  switch (status) {
    case "completed":
      return TurnState.Complete;
    case "interrupted":
      return TurnState.Cancelled;
    case "failed":
      return TurnState.Error;
    default:
      return TurnState.Complete;
  }
}
export {
  clearReasoningForItem,
  codexCompactionLabels,
  createCodexSessionMapState,
  describeFileChange,
  describeWebSearch,
  extractUserInputText,
  fileChangeOutput,
  finalizeCodexTurnMapState,
  mapAgentMessageDelta,
  mapCodexTurnError,
  mapCommandExecutionOutputDelta,
  mapFileChangeOutputDelta,
  mapFileChangePatchUpdated,
  mapItemCompleted,
  mapItemStarted,
  mapMcpToolCallProgress,
  mapReasoningSummaryPartAdded,
  mapReasoningSummaryTextDelta,
  mapReasoningTextDelta,
  mapTokenUsageUpdated,
  mapTurnCompleted,
  mapTurnStarted,
  resetCodexTurnMapState,
  turnStateFromStatus
};
