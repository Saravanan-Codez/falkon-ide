import { generateUuid } from "../../../../../../base/common/uuid.js";
import { URI } from "../../../../../../base/common/uri.js";
import { basename } from "../../../../../../base/common/resources.js";
import { localize } from "../../../../../../nls.js";
import { MessageKind, ResponsePartKind, ToolCallConfirmationReason, ToolCallStatus, ToolResultContentType, TurnState } from "../../../../../../platform/agentHost/common/state/sessionState.js";
import { IChatToolInvocation } from "../../../common/chatService/chatService.js";
import { isToolResultInputOutputDetails } from "../../../common/tools/languageModelToolsService.js";
function stringifyChatMessage(message) {
  if (message === void 0) {
    return "";
  }
  return typeof message === "string" ? message : message.value;
}
function stringifyToolInput(rawInput) {
  if (typeof rawInput === "string") {
    return rawInput;
  }
  try {
    return JSON.stringify(rawInput) ?? "";
  } catch {
    return "";
  }
}
function inlineReferenceToMarkdown(reference, name) {
  let uri;
  let label = name;
  let isSymbol = false;
  if (URI.isUri(reference)) {
    uri = reference;
  } else {
    const location = reference;
    if (URI.isUri(location.uri)) {
      uri = location.uri;
    } else if (URI.isUri(location.location?.uri)) {
      uri = location.location.uri;
      label = label ?? location.name;
      isSymbol = true;
    }
  }
  if (!uri) {
    return label ?? "";
  }
  if (!label || !isSymbol && /[\\/]/.test(label)) {
    label = basename(uri);
  }
  return `[${label}](${uri.toString()})`;
}
function toolCallResponsePart(part) {
  const invocationMessage = stringifyChatMessage(part.invocationMessage);
  const resultDetails = IChatToolInvocation.resultDetails(part);
  const subagentData = part.toolSpecificData?.kind === "subagent" ? part.toolSpecificData : void 0;
  let outputText = "";
  let isError = false;
  let resultInput;
  if (resultDetails && isToolResultInputOutputDetails(resultDetails)) {
    if (Array.isArray(resultDetails.output)) {
      for (const item of resultDetails.output) {
        if (item.type === "embed" && item.isText) {
          outputText += item.value;
        }
      }
    }
    isError = !!resultDetails.isError;
    resultInput = resultDetails.input;
  }
  if (!outputText && subagentData?.result) {
    outputText = subagentData.result;
  }
  const toolInput = part.toolSpecificData?.kind === "input" ? stringifyToolInput(part.toolSpecificData.rawInput) : resultInput ?? subagentData?.prompt ?? "";
  const toolCallId = part.toolCallId || generateUuid();
  const content = [];
  if (outputText) {
    content.push({ type: ToolResultContentType.Text, text: outputText });
  }
  if (subagentData) {
    content.push({
      type: ToolResultContentType.Subagent,
      resource: subagentData.chatResource ?? `agent-host-subagent:/${toolCallId}`,
      title: subagentData.agentName ?? localize("chat.importConversation.subagent", "Subagent"),
      ...subagentData.agentName ? { agentName: subagentData.agentName } : {},
      ...subagentData.description ? { description: subagentData.description } : {}
    });
  }
  const displayName = subagentData?.agentName || part.toolId;
  return {
    kind: ResponsePartKind.ToolCall,
    toolCall: {
      status: ToolCallStatus.Completed,
      toolCallId,
      toolName: part.toolId,
      displayName,
      invocationMessage: invocationMessage || stringifyChatMessage(subagentData?.description),
      toolInput,
      success: !isError,
      pastTenseMessage: stringifyChatMessage(part.pastTenseMessage) || invocationMessage,
      confirmed: ToolCallConfirmationReason.NotNeeded,
      ...content.length ? { content } : {},
      ...isError ? { error: { message: outputText || localize("chat.importConversation.toolFailed", "Tool failed.") } } : {}
    }
  };
}
function responsePartsFromRequest(request) {
  const responseParts = [];
  const response = request.response;
  if (response) {
    for (const part of response.entireResponse.value) {
      if (part.kind === "markdownContent") {
        const content = part.content.value;
        if (content) {
          responseParts.push({ kind: ResponsePartKind.Markdown, id: generateUuid(), content });
        }
      } else if (part.kind === "thinking") {
        const content = Array.isArray(part.value) ? part.value.join("") : part.value ?? "";
        if (content) {
          responseParts.push({ kind: ResponsePartKind.Reasoning, id: generateUuid(), content });
        }
      } else if (part.kind === "inlineReference") {
        const content = inlineReferenceToMarkdown(part.inlineReference, part.name);
        if (content) {
          responseParts.push({ kind: ResponsePartKind.Markdown, id: generateUuid(), content });
        }
      } else if (part.kind === "toolInvocation" || part.kind === "toolInvocationSerialized") {
        responseParts.push(toolCallResponsePart(part));
      }
    }
  }
  return responseParts;
}
function turnOutcomeFromRequest(request) {
  const response = request.response;
  if (!response) {
    return { state: TurnState.Complete };
  }
  if (response.isCanceled) {
    return { state: TurnState.Cancelled };
  }
  const errorDetails = response.result?.errorDetails;
  if (errorDetails) {
    return {
      state: TurnState.Error,
      error: { errorType: errorDetails.code ?? "error", message: errorDetails.message }
    };
  }
  return { state: TurnState.Complete };
}
function importedTurnsFromChatModel(model) {
  const turns = [];
  for (const request of model.getRequests()) {
    const responseParts = responsePartsFromRequest(request);
    const outcome = turnOutcomeFromRequest(request);
    if (request.isSystemInitiated) {
      const previous = turns[turns.length - 1];
      if (previous) {
        previous.responseParts.push(...responseParts);
        previous.state = outcome.state;
        previous.error = outcome.error;
      }
      continue;
    }
    turns.push({
      id: generateUuid(),
      message: { text: request.message.text, origin: { kind: MessageKind.User } },
      responseParts,
      usage: void 0,
      state: outcome.state,
      ...outcome.error ? { error: outcome.error } : {}
    });
  }
  return turns;
}
export {
  importedTurnsFromChatModel
};
