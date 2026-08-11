import { generateUuid } from "../../../../base/common/uuid.js";
import { toToolCallMeta } from "../../common/meta/agentToolCallMeta.js";
import {
  MessageKind,
  ResponsePartKind,
  ToolCallConfirmationReason,
  ToolCallStatus,
  ToolResultContentType
} from "../../common/state/sessionState.js";
import {
  describeFileChange,
  describeWebSearch,
  codexCompactionLabels,
  fileChangeOutput,
  mapCodexTurnError,
  turnStateFromStatus
} from "./codexMapAppServerEvents.js";
import { unwrapShellInvocation } from "./codexShellCommand.js";
function replayThreadToTurns(thread) {
  const turns = [];
  for (const codexTurn of thread.turns ?? []) {
    const turn = replayTurnToTurn(codexTurn);
    if (turn) {
      turns.push(turn);
    }
  }
  return turns;
}
function replayTurnToTurn(codexTurn) {
  let userText = "";
  const parts = [];
  let agentMessageCount = 0;
  let pendingPreflight;
  const flushPreflight = () => {
    if (pendingPreflight) {
      parts.push(shellToolCallPart(pendingPreflight.item, pendingPreflight.command));
      pendingPreflight = void 0;
    }
  };
  for (const item of codexTurn.items ?? []) {
    if (item.type === "commandExecution") {
      const command = unwrapShellInvocation(item.command ?? "");
      if (pendingPreflight && pendingPreflight.command === command) {
        pendingPreflight = void 0;
        parts.push(shellToolCallPart(item, command));
        continue;
      }
      flushPreflight();
      const success = item.status === "completed" && (item.exitCode === 0 || item.exitCode === null);
      const output = item.aggregatedOutput ?? "";
      if (success && !output) {
        pendingPreflight = { command, item };
        continue;
      }
      parts.push(shellToolCallPart(item, command));
      continue;
    }
    flushPreflight();
    if (item.type === "userMessage") {
      const collected = [];
      for (const c of item.content) {
        if (c.type === "text") {
          collected.push(c.text);
        }
      }
      if (collected.length > 0) {
        userText = collected.join("\n\n");
      }
    } else if (item.type === "agentMessage") {
      if (item.text && item.text.length > 0) {
        const separator = agentMessageCount > 0 ? "\n\n" : "";
        agentMessageCount++;
        parts.push({
          kind: ResponsePartKind.Markdown,
          id: generateUuid(),
          content: separator + item.text
        });
      }
    } else if (item.type === "webSearch") {
      parts.push(webSearchToolCallPart(item));
    } else if (item.type === "fileChange") {
      parts.push(fileChangeToolCallPart(item));
    } else if (item.type === "contextCompaction") {
      if (!userText) {
        userText = "/compact";
      }
      parts.push(compactionToolCallPart());
    }
  }
  flushPreflight();
  if (!userText && parts.length === 0) {
    return void 0;
  }
  return {
    id: codexTurn.id,
    ...codexTurnTiming(codexTurn),
    message: { text: userText, origin: { kind: MessageKind.User } },
    responseParts: parts,
    usage: void 0,
    state: turnStateFromStatus(codexTurn.status),
    ...codexTurn.status === "failed" && codexTurn.error ? { error: mapCodexTurnError(codexTurn.error) } : {}
  };
}
function codexTurnTiming(codexTurn) {
  const startedAtSeconds = codexTurn.startedAt;
  if (typeof startedAtSeconds !== "number" || !Number.isFinite(startedAtSeconds)) {
    return {};
  }
  const duration = typeof codexTurn.durationMs === "number" && Number.isFinite(codexTurn.durationMs) && codexTurn.durationMs >= 0 ? codexTurn.durationMs : typeof codexTurn.completedAt === "number" && Number.isFinite(codexTurn.completedAt) ? Math.max(0, (codexTurn.completedAt - startedAtSeconds) * 1e3) : void 0;
  return {
    startedAt: new Date(startedAtSeconds * 1e3).toISOString(),
    ...duration !== void 0 ? { duration } : {}
  };
}
function textContent(output) {
  return output ? [{ type: ToolResultContentType.Text, text: output }] : void 0;
}
function shellToolCallPart(item, command) {
  const success = item.status === "completed" && (item.exitCode === 0 || item.exitCode === null);
  const output = item.aggregatedOutput ?? "";
  const exit = item.exitCode;
  const pastTense = success ? `Ran \`${command}\`` : exit !== null ? `Ran \`${command}\` (exit ${exit})` : `Ran \`${command}\` (failed)`;
  return {
    kind: ResponsePartKind.ToolCall,
    toolCall: {
      status: ToolCallStatus.Completed,
      toolCallId: generateUuid(),
      toolName: "shell",
      displayName: "Run shell command",
      _meta: toToolCallMeta({ toolKind: "terminal" }),
      invocationMessage: command,
      toolInput: command,
      confirmed: ToolCallConfirmationReason.NotNeeded,
      success,
      pastTenseMessage: pastTense,
      content: textContent(output),
      error: success ? void 0 : { message: exit !== null ? `Exit code ${exit}` : "Command failed" }
    }
  };
}
function webSearchToolCallPart(item) {
  const query = describeWebSearch(item.query, item.action);
  return {
    kind: ResponsePartKind.ToolCall,
    toolCall: {
      status: ToolCallStatus.Completed,
      toolCallId: generateUuid(),
      toolName: "web_search",
      displayName: "Web search",
      _meta: toToolCallMeta({ toolKind: "search" }),
      invocationMessage: query,
      toolInput: query,
      confirmed: ToolCallConfirmationReason.NotNeeded,
      success: true,
      pastTenseMessage: `Searched ${query}`
    }
  };
}
function fileChangeToolCallPart(item) {
  const success = item.status === "completed";
  const summary = describeFileChange(item.changes) || "Apply file changes";
  const output = fileChangeOutput(item.changes);
  return {
    kind: ResponsePartKind.ToolCall,
    toolCall: {
      status: ToolCallStatus.Completed,
      toolCallId: generateUuid(),
      toolName: "file_edit",
      displayName: "Apply file changes",
      invocationMessage: summary,
      confirmed: ToolCallConfirmationReason.NotNeeded,
      success,
      pastTenseMessage: success ? "Applied file changes" : "Failed to apply file changes",
      content: textContent(output),
      error: success ? void 0 : { message: `Patch ${item.status}` }
    }
  };
}
function compactionToolCallPart() {
  const labels = codexCompactionLabels();
  return {
    kind: ResponsePartKind.ToolCall,
    toolCall: {
      status: ToolCallStatus.Completed,
      toolCallId: generateUuid(),
      toolName: "compact",
      displayName: labels.displayName,
      invocationMessage: labels.invocationMessage,
      confirmed: ToolCallConfirmationReason.NotNeeded,
      success: true,
      pastTenseMessage: labels.pastTenseMessage
    }
  };
}
export {
  replayThreadToTurns
};
