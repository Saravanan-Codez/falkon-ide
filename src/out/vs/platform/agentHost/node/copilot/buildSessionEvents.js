import { isObject } from "../../../../base/common/types.js";
import { generateUuid, isUUID } from "../../../../base/common/uuid.js";
import { getInlineToolInput, ResponsePartKind, ToolCallStatus, ToolResultContentType, TurnState } from "../../common/state/sessionState.js";
const DEFAULT_SESSION_EVENT_SCHEMA_VERSION = 1;
const MIGRATION_PRODUCER = "vscode-copilot-migration";
function buildSessionEventsFromTurns(turns, options) {
  const events = [];
  let parentId = null;
  let clock = (options.startTime ?? /* @__PURE__ */ new Date()).getTime();
  const nextTimestamp = () => new Date(clock++).toISOString();
  const push = (event) => {
    events.push(event);
    parentId = event.id;
  };
  const pushCompletedToolCall = (tc) => {
    let parsedToolInput;
    const toolInput = getInlineToolInput(tc.toolInput);
    if (toolInput) {
      try {
        const parsed = JSON.parse(toolInput);
        if (isObject(parsed)) {
          parsedToolInput = parsed;
        }
      } catch {
      }
    }
    const subagent = tc.content?.find((c) => c.type === ToolResultContentType.Subagent);
    if (subagent) {
      push({
        id: generateUuid(),
        parentId,
        timestamp: nextTimestamp(),
        type: "subagent.started",
        data: {
          toolCallId: tc.toolCallId,
          agentName: subagent.agentName ?? subagent.title,
          agentDisplayName: subagent.title,
          agentDescription: subagent.description ?? ""
        }
      });
    }
    push({
      id: generateUuid(),
      parentId,
      timestamp: nextTimestamp(),
      type: "tool.execution_start",
      data: {
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        ...parsedToolInput ? { arguments: parsedToolInput } : {}
      }
    });
    const resultText = extractToolResultText(tc.content);
    push({
      id: generateUuid(),
      parentId,
      timestamp: nextTimestamp(),
      type: "tool.execution_complete",
      data: {
        toolCallId: tc.toolCallId,
        success: tc.success,
        ...tc.success ? { result: { content: resultText } } : {},
        ...tc.error ? { error: { message: tc.error.message, ...tc.error.code ? { code: tc.error.code } : {} } } : {}
      }
    });
  };
  push({
    id: generateUuid(),
    parentId,
    timestamp: nextTimestamp(),
    type: "session.start",
    data: {
      sessionId: options.sessionId,
      copilotVersion: options.copilotVersion ?? "0.0.0",
      producer: MIGRATION_PRODUCER,
      startTime: nextTimestamp(),
      version: options.schemaVersion ?? DEFAULT_SESSION_EVENT_SCHEMA_VERSION,
      ...options.model ? { selectedModel: options.model } : {},
      ...options.workingDirectory ? { context: { cwd: options.workingDirectory } } : {}
    }
  });
  for (const turn of turns) {
    push({
      id: isUUID(turn.id) ? turn.id : generateUuid(),
      parentId,
      timestamp: nextTimestamp(),
      type: "user.message",
      data: {
        content: turn.message.text,
        source: "user"
      }
    });
    let markdown = "";
    let reasoning = "";
    const flushAssistantMessage = () => {
      if (!markdown && !reasoning) {
        return;
      }
      push({
        id: generateUuid(),
        parentId,
        timestamp: nextTimestamp(),
        type: "assistant.message",
        data: {
          content: markdown,
          messageId: generateUuid(),
          ...reasoning ? { reasoningText: reasoning } : {},
          ...options.model ? { model: options.model } : {}
        }
      });
      markdown = "";
      reasoning = "";
    };
    for (const part of turn.responseParts) {
      if (part.kind === ResponsePartKind.Markdown) {
        if (reasoning) {
          flushAssistantMessage();
        }
        markdown += part.content;
      } else if (part.kind === ResponsePartKind.Reasoning) {
        if (markdown) {
          flushAssistantMessage();
        }
        reasoning += part.content;
      } else if (part.kind === ResponsePartKind.ToolCall && part.toolCall.status === ToolCallStatus.Completed) {
        flushAssistantMessage();
        pushCompletedToolCall(part.toolCall);
      }
    }
    flushAssistantMessage();
    if (turn.state === TurnState.Cancelled) {
      push({
        id: generateUuid(),
        parentId,
        timestamp: nextTimestamp(),
        type: "abort",
        data: { reason: "user_initiated" }
      });
    }
  }
  return events;
}
function extractToolResultText(content) {
  if (!content) {
    return "";
  }
  let text = "";
  for (const item of content) {
    if (item.type === ToolResultContentType.Text) {
      text += item.text;
    }
  }
  return text;
}
function serializeSessionEventsToJsonl(events) {
  if (events.length === 0) {
    return "";
  }
  return events.map((event) => JSON.stringify(event)).join("\n") + "\n";
}
function buildSessionEventLogFromTurns(turns, options) {
  return serializeSessionEventsToJsonl(buildSessionEventsFromTurns(turns, options));
}
export {
  buildSessionEventLogFromTurns,
  buildSessionEventsFromTurns,
  serializeSessionEventsToJsonl
};
