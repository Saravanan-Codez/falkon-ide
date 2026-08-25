var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { localize } from "../../../../../../nls.js";
import { ChatDebugHookResult, IChatDebugService } from "../../chatDebugService.js";
import { ToolDataSource } from "../languageModelToolsService.js";
const ResolveDebugEventDetailsToolId = "vscode_resolveDebugEventDetails_internal";
const ResolveDebugEventDetailsToolData = {
  id: ResolveDebugEventDetailsToolId,
  toolReferenceName: "resolveDebugEventDetails",
  displayName: localize("resolveDebugEventDetails.displayName", "Resolve Debug Event Details"),
  canBeReferencedInPrompt: false,
  modelDescription: "Resolves the full details for a specific chat debug event by its event ID. Use this tool to get detailed information about a debug event such as tool call input/output, model turn details, user message sections, or file lists. The event ID can be found in the debug event log summary provided in the conversation context.",
  source: ToolDataSource.Internal,
  inputSchema: {
    type: "object",
    properties: {
      eventId: {
        type: "string",
        description: "The ID of the debug event to resolve details for."
      }
    },
    required: ["eventId"]
  }
};
function formatResolvedContent(content) {
  switch (content.kind) {
    case "text":
      return content.value;
    case "fileList": {
      const lines = [localize("formatResolvedContent.fileList", "File list ({0}):", content.discoveryType)];
      if (content.sourceFolders) {
        for (const folder of content.sourceFolders) {
          lines.push(localize("formatResolvedContent.sourceFolder", "  Source folder: {0} ({1})", folder.uri.toString(), folder.storage));
        }
      }
      for (const file of content.files) {
        const status = file.status === "loaded" ? localize("formatResolvedContent.loaded", "loaded") : file.skipReason ? localize("formatResolvedContent.skippedWithReason", "skipped: {0}", file.skipReason) : localize("formatResolvedContent.skipped", "skipped");
        lines.push(`  ${file.uri.toString()} [${status}]`);
      }
      return lines.join("\n");
    }
    case "message": {
      const messageType = content.type === "user" ? localize("formatResolvedContent.userMessage", "User message: {0}", content.message) : localize("formatResolvedContent.agentMessage", "Agent message: {0}", content.message);
      const lines = [messageType];
      for (const section of content.sections) {
        lines.push(`--- ${section.name} ---`);
        lines.push(section.content);
      }
      return lines.join("\n");
    }
    case "toolCall": {
      const lines = [localize("formatResolvedContent.toolCall", "Tool call: {0}", content.toolName)];
      if (content.result) {
        lines.push(localize("formatResolvedContent.result", "Result: {0}", content.result));
      }
      if (content.durationInMillis !== void 0) {
        lines.push(localize("formatResolvedContent.duration", "Duration: {0}ms", content.durationInMillis));
      }
      if (content.input) {
        lines.push(localize("formatResolvedContent.input", "Input:") + "\n" + content.input);
      }
      if (content.output) {
        lines.push(localize("formatResolvedContent.output", "Output:") + "\n" + content.output);
      }
      return lines.join("\n");
    }
    case "modelTurn": {
      const lines = [localize("formatResolvedContent.modelTurn", "Model turn: {0}", content.requestName)];
      if (content.model) {
        lines.push(localize("formatResolvedContent.model", "Model: {0}", content.model));
      }
      if (content.status) {
        lines.push(localize("formatResolvedContent.status", "Status: {0}", content.status));
      }
      if (content.durationInMillis !== void 0) {
        lines.push(localize("formatResolvedContent.duration", "Duration: {0}ms", content.durationInMillis));
      }
      if (content.inputTokens !== void 0 || content.outputTokens !== void 0) {
        lines.push(localize("formatResolvedContent.tokens", "Tokens: input={0}, output={1}, cached={2}, total={3}", content.inputTokens ?? "?", content.outputTokens ?? "?", content.cachedTokens ?? "?", content.totalTokens ?? "?"));
      }
      if (content.errorMessage) {
        lines.push(localize("formatResolvedContent.error", "Error: {0}", content.errorMessage));
      }
      if (content.sections) {
        for (const section of content.sections) {
          lines.push(`--- ${section.name} ---`);
          lines.push(section.content);
        }
      }
      return lines.join("\n");
    }
    case "hook": {
      const lines = [localize("formatResolvedContent.hook", "Hook: {0}", content.hookType)];
      if (content.command) {
        lines.push(localize("formatResolvedContent.command", "Command: {0}", content.command));
      }
      if (content.result !== void 0) {
        const resultText = content.result === ChatDebugHookResult.Success ? localize("formatResolvedContent.hookResult.success", "Success") : content.result === ChatDebugHookResult.Error ? localize("formatResolvedContent.hookResult.error", "Error") : localize("formatResolvedContent.hookResult.nonBlockingError", "Non-blocking Error");
        lines.push(localize("formatResolvedContent.result", "Result: {0}", resultText));
      }
      if (content.exitCode !== void 0) {
        lines.push(localize("formatResolvedContent.exitCode", "Exit Code: {0}", content.exitCode));
      }
      if (content.durationInMillis !== void 0) {
        lines.push(localize("formatResolvedContent.duration", "Duration: {0}ms", content.durationInMillis));
      }
      if (content.input) {
        lines.push(localize("formatResolvedContent.input", "Input:") + "\n" + content.input);
      }
      if (content.output) {
        lines.push(localize("formatResolvedContent.output", "Output:") + "\n" + content.output);
      }
      if (content.errorMessage) {
        lines.push(localize("formatResolvedContent.error", "Error: {0}", content.errorMessage));
      }
      return lines.join("\n");
    }
    case "customizationSummary": {
      const lines = [];
      lines.push(localize("formatResolvedContent.customizationCounts", "Customization: {0} instructions, {1} skills, {2} agents, {3} hooks, {4} skipped", content.counts.instructions, content.counts.skills, content.counts.agents, content.counts.hooks, content.counts.skipped));
      lines.push(localize("formatResolvedContent.customizationDuration", "Duration: {0}ms", content.durationInMillis.toFixed(1)));
      if (content.resolutionLogs.length > 0) {
        lines.push("");
        lines.push(localize("formatResolvedContent.resolutionLogs", "Resolution logs:"));
        for (const entry of content.resolutionLogs) {
          const detail = entry.reason ? `${entry.name} \u2014 ${entry.reason}` : entry.name;
          lines.push(`  [${entry.category}] ${detail}`);
        }
      }
      return lines.join("\n");
    }
    default: {
      const _ = content;
      return JSON.stringify(_);
    }
  }
}
function truncate(text, maxLength = 30) {
  if (text.length <= maxLength) {
    return text;
  }
  const lastSpace = text.lastIndexOf(" ", maxLength);
  const cutoff = lastSpace > maxLength / 2 ? lastSpace : maxLength;
  return text.substring(0, cutoff) + "\u2026";
}
function getEventLabel(event) {
  switch (event.kind) {
    case "generic":
      return event.name;
    case "toolCall":
      return event.toolName;
    case "modelTurn":
      return event.requestName ?? localize("debugEvent.modelTurn", "Model Turn");
    case "userMessage":
      return localize("debugEvent.userMessage", "User Message: {0}", truncate(event.message));
    case "agentResponse":
      return localize("debugEvent.agentResponse", "Agent Response: {0}", truncate(event.message));
    case "subagentInvocation":
      return event.agentName;
  }
}
let ResolveDebugEventDetailsTool = class {
  constructor(chatDebugService) {
    this.chatDebugService = chatDebugService;
  }
  async prepareToolInvocation(context, _token) {
    const eventId = context.parameters?.eventId;
    let eventLabel;
    if (typeof eventId === "string" && context.chatSessionResource) {
      const events = this.chatDebugService.getEvents(context.chatSessionResource);
      const event = events.find((e) => e.id === eventId);
      if (event) {
        eventLabel = getEventLabel(event);
      }
    }
    if (eventLabel) {
      return {
        invocationMessage: localize("resolveDebugEventDetails.invocationMessageNamed", 'Resolving details for "{0}"', eventLabel),
        pastTenseMessage: localize("resolveDebugEventDetails.pastTenseMessageNamed", 'Resolved details for "{0}"', eventLabel)
      };
    }
    return {
      invocationMessage: localize("resolveDebugEventDetails.invocationMessage", "Resolving debug event details"),
      pastTenseMessage: localize("resolveDebugEventDetails.pastTenseMessage", "Resolved debug event details")
    };
  }
  async invoke(invocation, _countTokens, _progress, _token) {
    const eventId = invocation.parameters["eventId"];
    if (typeof eventId !== "string" || !eventId) {
      return {
        content: [{ kind: "text", value: localize("resolveDebugEventDetails.errorEventIdRequired", "Error: eventId parameter is required.") }]
      };
    }
    const sessionResource = invocation.context?.sessionResource;
    if (!sessionResource) {
      return {
        content: [{ kind: "text", value: localize("resolveDebugEventDetails.errorNoSession", "Error: no chat session context available.") }]
      };
    }
    const sessionEvents = this.chatDebugService.getEvents(sessionResource);
    if (!sessionEvents.some((e) => e.id === eventId)) {
      return {
        content: [{ kind: "text", value: localize("resolveDebugEventDetails.errorEventNotFound", 'No event with ID "{0}" found in the current session.', eventId) }]
      };
    }
    const resolved = await this.chatDebugService.resolveEvent(eventId);
    if (!resolved) {
      return {
        content: [{ kind: "text", value: localize("resolveDebugEventDetails.errorNoDetails", "No details found for event ID: {0}", eventId) }]
      };
    }
    return {
      content: [{ kind: "text", value: formatResolvedContent(resolved) }]
    };
  }
};
ResolveDebugEventDetailsTool = __decorateClass([
  __decorateParam(0, IChatDebugService)
], ResolveDebugEventDetailsTool);
export {
  ResolveDebugEventDetailsTool,
  ResolveDebugEventDetailsToolData,
  ResolveDebugEventDetailsToolId
};
