import * as DOM from "../../../../../base/browser/dom.js";
import { localize } from "../../../../../nls.js";
import { ChatDebugLogLevel } from "../../common/chatDebugService.js";
import { safeIntl } from "../../../../../base/common/date.js";
const $ = DOM.$;
function safeStr(value, fallback = "") {
  if (value === null || value === void 0 || typeof value !== "string") {
    return fallback;
  }
  return value;
}
const dateFormatter = safeIntl.DateTimeFormat(void 0, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit"
});
const numberFormatter = safeIntl.NumberFormat();
function getEventCreatedText(element) {
  return dateFormatter.value.format(element.created);
}
function getEventNameText(element) {
  switch (element.kind) {
    case "toolCall":
      return safeStr(element.toolName, localize("chatDebug.unknownEvent", "(unknown)"));
    case "modelTurn":
      return safeStr(element.model) || localize("chatDebug.modelTurn", "Model Turn");
    case "generic":
      return safeStr(element.name, localize("chatDebug.unknownEvent", "(unknown)"));
    case "subagentInvocation":
      return safeStr(element.agentName, localize("chatDebug.unknownEvent", "(unknown)"));
    case "userMessage":
      return localize("chatDebug.userMessage", "User Message");
    case "agentResponse":
      return localize("chatDebug.agentResponse", "Agent Response");
  }
}
function getEventDetailsText(element) {
  switch (element.kind) {
    case "toolCall":
      return safeStr(element.result);
    case "modelTurn":
      return [
        safeStr(element.requestName),
        element.totalTokens !== void 0 ? localize("chatDebug.tokens", "{0} tokens", numberFormatter.value.format(element.totalTokens)) : ""
      ].filter(Boolean).join(" \xB7 ");
    case "generic":
      return safeStr(element.details);
    case "subagentInvocation":
      return safeStr(element.description) || safeStr(element.status);
    case "userMessage":
      return safeStr(element.message);
    case "agentResponse":
      return safeStr(element.message);
  }
}
function renderEventToTemplate(element, templateData) {
  templateData.created.textContent = getEventCreatedText(element);
  templateData.name.textContent = getEventNameText(element);
  templateData.details.textContent = getEventDetailsText(element);
  const isError = element.kind === "generic" && element.level === ChatDebugLogLevel.Error || element.kind === "toolCall" && element.result === "error";
  const isWarning = element.kind === "generic" && element.level === ChatDebugLogLevel.Warning;
  const isTrace = element.kind === "generic" && element.level === ChatDebugLogLevel.Trace;
  templateData.container.classList.toggle("chat-debug-log-error", isError);
  templateData.container.classList.toggle("chat-debug-log-warning", isWarning);
  templateData.container.classList.toggle("chat-debug-log-trace", isTrace);
}
function createEventTemplate(container) {
  container.classList.add("chat-debug-log-row");
  const created = DOM.append(container, $("span.chat-debug-log-created"));
  const name = DOM.append(container, $("span.chat-debug-log-name"));
  const details = DOM.append(container, $("span.chat-debug-log-details"));
  return { container, created, name, details };
}
class ChatDebugEventRenderer {
  static {
    this.TEMPLATE_ID = "chatDebugEvent";
  }
  get templateId() {
    return ChatDebugEventRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    return createEventTemplate(container);
  }
  renderElement(element, index, templateData) {
    renderEventToTemplate(element, templateData);
  }
  disposeTemplate(_templateData) {
  }
}
class ChatDebugEventDelegate {
  getHeight(_element) {
    return 28;
  }
  getTemplateId(_element) {
    return ChatDebugEventRenderer.TEMPLATE_ID;
  }
}
class ChatDebugEventTreeRenderer {
  static {
    this.TEMPLATE_ID = "chatDebugEvent";
  }
  get templateId() {
    return ChatDebugEventTreeRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    return createEventTemplate(container);
  }
  renderElement(node, index, templateData) {
    renderEventToTemplate(node.element, templateData);
  }
  disposeTemplate(_templateData) {
  }
}
export {
  ChatDebugEventDelegate,
  ChatDebugEventRenderer,
  ChatDebugEventTreeRenderer,
  getEventCreatedText,
  getEventDetailsText,
  getEventNameText
};
