import * as DOM from "../../../../../base/browser/dom.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { ChatDebugHookResult } from "../../common/chatDebugService.js";
import { renderSection, tokenizeContent } from "./chatDebugToolCallContentRenderer.js";
const $ = DOM.$;
async function renderHookContent(content, languageService, clipboardService, scrollable) {
  const disposables = new DisposableStore();
  const container = $("div.chat-debug-message-content");
  container.tabIndex = 0;
  DOM.append(container, $("div.chat-debug-message-content-title", void 0, content.hookType));
  const statusParts = [];
  if (content.result !== void 0) {
    statusParts.push(formatHookResult(content.result));
  }
  if (content.exitCode !== void 0) {
    statusParts.push(localize("chatDebug.hook.exitCode", "Exit Code: {0}", content.exitCode));
  }
  if (content.durationInMillis !== void 0) {
    statusParts.push(localize("chatDebug.hook.duration", "{0}ms", content.durationInMillis));
  }
  if (statusParts.length > 0) {
    DOM.append(container, $("div.chat-debug-message-content-summary", void 0, statusParts.join(" \xB7 ")));
  }
  const sectionsContainer = DOM.append(container, $("div.chat-debug-message-sections"));
  if (content.command) {
    const { plainText, tokenizedHtml } = await tokenizeContent(content.command, languageService);
    renderSection(sectionsContainer, localize("chatDebug.hook.command", "Command"), plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
  }
  if (content.input) {
    const { plainText, tokenizedHtml } = await tokenizeContent(content.input, languageService);
    renderSection(sectionsContainer, localize("chatDebug.hook.input", "Input"), plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
  }
  if (content.output) {
    const { plainText, tokenizedHtml } = await tokenizeContent(content.output, languageService);
    renderSection(sectionsContainer, localize("chatDebug.hook.output", "Output"), plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
  }
  if (content.errorMessage) {
    const { plainText, tokenizedHtml } = await tokenizeContent(content.errorMessage, languageService);
    renderSection(sectionsContainer, localize("chatDebug.hook.error", "Error"), plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
  }
  return { element: container, disposables };
}
function formatHookResult(result) {
  switch (result) {
    case ChatDebugHookResult.Success:
      return localize("chatDebug.hook.result.success", "Success");
    case ChatDebugHookResult.Error:
      return localize("chatDebug.hook.result.error", "Error");
    case ChatDebugHookResult.NonBlockingError:
      return localize("chatDebug.hook.result.nonBlockingError", "Non-blocking Error");
    default:
      return String(result);
  }
}
function hookContentToPlainText(content) {
  const lines = [];
  lines.push(localize("chatDebug.hook.typeLabel", "Hook Type: {0}", content.hookType));
  if (content.result !== void 0) {
    lines.push(localize("chatDebug.hook.resultLabel", "Result: {0}", formatHookResult(content.result)));
  }
  if (content.exitCode !== void 0) {
    lines.push(localize("chatDebug.hook.exitCodeLabel", "Exit Code: {0}", content.exitCode));
  }
  if (content.durationInMillis !== void 0) {
    lines.push(localize("chatDebug.hook.durationLabel", "Duration: {0}ms", content.durationInMillis));
  }
  if (content.command) {
    lines.push("");
    lines.push(`[${localize("chatDebug.hook.command", "Command")}]`);
    lines.push(content.command);
  }
  if (content.input) {
    lines.push("");
    lines.push(`[${localize("chatDebug.hook.input", "Input")}]`);
    try {
      const parsed = JSON.parse(content.input);
      lines.push(JSON.stringify(parsed, null, 2));
    } catch {
      lines.push(content.input);
    }
  }
  if (content.output) {
    lines.push("");
    lines.push(`[${localize("chatDebug.hook.output", "Output")}]`);
    try {
      const parsed = JSON.parse(content.output);
      lines.push(JSON.stringify(parsed, null, 2));
    } catch {
      lines.push(content.output);
    }
  }
  if (content.errorMessage) {
    lines.push("");
    lines.push(`[${localize("chatDebug.hook.error", "Error")}]`);
    lines.push(content.errorMessage);
  }
  return lines.join("\n");
}
export {
  hookContentToPlainText,
  renderHookContent
};
