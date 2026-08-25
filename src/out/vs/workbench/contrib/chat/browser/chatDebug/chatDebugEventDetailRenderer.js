import { localize } from "../../../../../nls.js";
import { safeIntl } from "../../../../../base/common/date.js";
const numberFormatter = safeIntl.NumberFormat();
function formatEventDetail(event) {
  switch (event.kind) {
    case "toolCall": {
      const parts = [localize("chatDebug.detail.tool", "Tool: {0}", event.toolName)];
      if (event.toolCallId) {
        parts.push(localize("chatDebug.detail.callId", "Call ID: {0}", event.toolCallId));
      }
      if (event.result) {
        parts.push(localize("chatDebug.detail.result", "Result: {0}", event.result));
      }
      if (event.durationInMillis !== void 0) {
        parts.push(localize("chatDebug.detail.durationMs", "Duration: {0}ms", numberFormatter.value.format(event.durationInMillis)));
      }
      if (event.input) {
        parts.push(`
${localize("chatDebug.detail.input", "Input:")}
${event.input}`);
      }
      if (event.output) {
        parts.push(`
${localize("chatDebug.detail.output", "Output:")}
${event.output}`);
      }
      return parts.join("\n");
    }
    case "modelTurn": {
      const parts = [event.model ?? localize("chatDebug.detail.modelTurn", "Model Turn")];
      if (event.inputTokens !== void 0) {
        parts.push(localize("chatDebug.detail.inputTokens", "Input tokens: {0}", numberFormatter.value.format(event.inputTokens)));
      }
      if (event.outputTokens !== void 0) {
        parts.push(localize("chatDebug.detail.outputTokens", "Output tokens: {0}", numberFormatter.value.format(event.outputTokens)));
      }
      if (event.cachedTokens !== void 0) {
        parts.push(localize("chatDebug.detail.cachedTokens", "Cached tokens: {0}", numberFormatter.value.format(event.cachedTokens)));
      }
      if (event.totalTokens !== void 0) {
        parts.push(localize("chatDebug.detail.totalTokens", "Total tokens: {0}", numberFormatter.value.format(event.totalTokens)));
      }
      if (event.durationInMillis !== void 0) {
        parts.push(localize("chatDebug.detail.durationMs", "Duration: {0}ms", numberFormatter.value.format(event.durationInMillis)));
      }
      return parts.join("\n");
    }
    case "generic":
      return `${event.name}
${event.details ?? ""}`;
    case "subagentInvocation": {
      const parts = [localize("chatDebug.detail.agent", "Agent: {0}", event.agentName)];
      if (event.description) {
        parts.push(localize("chatDebug.detail.description", "Description: {0}", event.description));
      }
      if (event.status) {
        parts.push(localize("chatDebug.detail.status", "Status: {0}", event.status));
      }
      if (event.durationInMillis !== void 0) {
        parts.push(localize("chatDebug.detail.durationMs", "Duration: {0}ms", numberFormatter.value.format(event.durationInMillis)));
      }
      if (event.toolCallCount !== void 0) {
        parts.push(localize("chatDebug.detail.toolCallCount", "Tool calls: {0}", numberFormatter.value.format(event.toolCallCount)));
      }
      if (event.modelTurnCount !== void 0) {
        parts.push(localize("chatDebug.detail.modelTurnCount", "Model turns: {0}", numberFormatter.value.format(event.modelTurnCount)));
      }
      return parts.join("\n");
    }
    case "userMessage": {
      const parts = [localize("chatDebug.detail.userMessage", "User Message: {0}", event.message)];
      for (const section of event.sections) {
        parts.push(`
--- ${section.name} ---
${section.content}`);
      }
      return parts.join("\n");
    }
    case "agentResponse": {
      const parts = [localize("chatDebug.detail.agentResponse", "Agent Response: {0}", event.message)];
      for (const section of event.sections) {
        parts.push(`
--- ${section.name} ---
${section.content}`);
      }
      return parts.join("\n");
    }
  }
}
export {
  formatEventDetail
};
