import * as DOM from "../../../../../base/browser/dom.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { renderSection, tokenizeContent } from "./chatDebugToolCallContentRenderer.js";
import { safeIntl } from "../../../../../base/common/date.js";
const $ = DOM.$;
const numberFormatter = safeIntl.NumberFormat();
async function renderModelTurnContent(content, languageService, clipboardService, scrollable) {
  const disposables = new DisposableStore();
  const container = $("div.chat-debug-message-content");
  container.tabIndex = 0;
  DOM.append(container, $("div.chat-debug-message-content-title", void 0, localize("chatDebug.modelTurn.title", "Model Turn")));
  const statusParts = [];
  if (content.requestName) {
    statusParts.push(content.requestName);
  }
  if (content.model) {
    statusParts.push(content.model);
  }
  if (content.status && content.status !== "unknown") {
    statusParts.push(content.status);
  }
  if (content.durationInMillis !== void 0) {
    statusParts.push(localize("chatDebug.modelTurn.duration", "{0}ms", numberFormatter.value.format(content.durationInMillis)));
  }
  if (statusParts.length > 0) {
    DOM.append(container, $("div.chat-debug-message-content-summary", void 0, statusParts.join(" \xB7 ")));
  }
  const detailsContainer = DOM.append(container, $("div.chat-debug-model-turn-details"));
  if (content.inputTokens !== void 0) {
    DOM.append(detailsContainer, $("div", void 0, localize("chatDebug.modelTurn.inputTokens", "Input tokens: {0}", numberFormatter.value.format(content.inputTokens))));
  }
  if (content.outputTokens !== void 0) {
    DOM.append(detailsContainer, $("div", void 0, localize("chatDebug.modelTurn.outputTokens", "Output tokens: {0}", numberFormatter.value.format(content.outputTokens))));
  }
  if (content.cachedTokens !== void 0) {
    DOM.append(detailsContainer, $("div", void 0, localize("chatDebug.modelTurn.cachedTokens", "Cached tokens: {0}", numberFormatter.value.format(content.cachedTokens))));
  }
  if (content.totalTokens !== void 0) {
    DOM.append(detailsContainer, $("div", void 0, localize("chatDebug.modelTurn.totalTokens", "Total tokens: {0}", numberFormatter.value.format(content.totalTokens))));
  }
  if (content.timeToFirstTokenInMillis !== void 0) {
    DOM.append(detailsContainer, $("div", void 0, localize("chatDebug.modelTurn.ttft", "Time to first token: {0}ms", numberFormatter.value.format(content.timeToFirstTokenInMillis))));
  }
  if (content.maxInputTokens !== void 0) {
    DOM.append(detailsContainer, $("div", void 0, localize("chatDebug.modelTurn.maxInputTokens", "Max input tokens: {0}", numberFormatter.value.format(content.maxInputTokens))));
  }
  if (content.maxOutputTokens !== void 0) {
    DOM.append(detailsContainer, $("div", void 0, localize("chatDebug.modelTurn.maxOutputTokens", "Max output tokens: {0}", numberFormatter.value.format(content.maxOutputTokens))));
  }
  if (content.errorMessage) {
    DOM.append(detailsContainer, $("div.chat-debug-model-turn-error", void 0, localize("chatDebug.modelTurn.error", "Error: {0}", content.errorMessage)));
  }
  if (content.sections && content.sections.length > 0) {
    const sectionsContainer = DOM.append(container, $("div.chat-debug-message-sections"));
    DOM.append(sectionsContainer, $(
      "div.chat-debug-message-sections-label",
      void 0,
      localize("chatDebug.modelTurn.sections", "Sections ({0})", content.sections.length)
    ));
    for (const section of content.sections) {
      const { plainText, tokenizedHtml } = await tokenizeContent(section.content, languageService);
      renderSection(sectionsContainer, section.name, plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
    }
  }
  return { element: container, disposables };
}
function modelTurnContentToPlainText(content) {
  const lines = [];
  lines.push(localize("chatDebug.modelTurn.requestLabel", "Request: {0}", content.requestName));
  if (content.model) {
    lines.push(localize("chatDebug.modelTurn.modelLabel", "Model: {0}", content.model));
  }
  if (content.status && content.status !== "unknown") {
    lines.push(localize("chatDebug.modelTurn.statusLabel", "Status: {0}", content.status));
  }
  if (content.durationInMillis !== void 0) {
    lines.push(localize("chatDebug.modelTurn.durationLabel", "Duration: {0}ms", numberFormatter.value.format(content.durationInMillis)));
  }
  if (content.timeToFirstTokenInMillis !== void 0) {
    lines.push(localize("chatDebug.modelTurn.ttftLabel", "Time to first token: {0}ms", numberFormatter.value.format(content.timeToFirstTokenInMillis)));
  }
  if (content.inputTokens !== void 0) {
    lines.push(localize("chatDebug.modelTurn.inputTokensLabel", "Input tokens: {0}", numberFormatter.value.format(content.inputTokens)));
  }
  if (content.outputTokens !== void 0) {
    lines.push(localize("chatDebug.modelTurn.outputTokensLabel", "Output tokens: {0}", numberFormatter.value.format(content.outputTokens)));
  }
  if (content.cachedTokens !== void 0) {
    lines.push(localize("chatDebug.modelTurn.cachedTokensLabel", "Cached tokens: {0}", numberFormatter.value.format(content.cachedTokens)));
  }
  if (content.totalTokens !== void 0) {
    lines.push(localize("chatDebug.modelTurn.totalTokensLabel", "Total tokens: {0}", numberFormatter.value.format(content.totalTokens)));
  }
  if (content.maxInputTokens !== void 0) {
    lines.push(localize("chatDebug.modelTurn.maxInputTokensLabel", "Max input tokens: {0}", numberFormatter.value.format(content.maxInputTokens)));
  }
  if (content.maxOutputTokens !== void 0) {
    lines.push(localize("chatDebug.modelTurn.maxOutputTokensLabel", "Max output tokens: {0}", numberFormatter.value.format(content.maxOutputTokens)));
  }
  if (content.errorMessage) {
    lines.push(localize("chatDebug.modelTurn.errorLabel", "Error: {0}", content.errorMessage));
  }
  if (content.sections && content.sections.length > 0) {
    lines.push("");
    for (const section of content.sections) {
      lines.push(`--- ${section.name} ---`);
      lines.push(section.content);
      lines.push("");
    }
  }
  return lines.join("\n");
}
export {
  modelTurnContentToPlainText,
  renderModelTurnContent
};
