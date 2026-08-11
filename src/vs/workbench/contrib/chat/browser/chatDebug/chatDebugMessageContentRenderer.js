import * as DOM from "../../../../../base/browser/dom.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { renderSection, tokenizeContent } from "./chatDebugToolCallContentRenderer.js";
const $ = DOM.$;
async function renderUserMessageContent(event, languageService, clipboardService, scrollable) {
  const disposables = new DisposableStore();
  const container = $("div.chat-debug-message-content");
  container.tabIndex = 0;
  DOM.append(container, $("div.chat-debug-message-content-title", void 0, localize("chatDebug.userMessage", "User Message")));
  DOM.append(container, $("div.chat-debug-message-content-summary", void 0, event.message));
  if (event.sections.length > 0) {
    const sectionsContainer = DOM.append(container, $("div.chat-debug-message-sections"));
    DOM.append(sectionsContainer, $(
      "div.chat-debug-message-sections-label",
      void 0,
      localize("chatDebug.promptSections", "Prompt Sections ({0})", event.sections.length)
    ));
    for (const section of event.sections) {
      const { plainText, tokenizedHtml } = await tokenizeContent(section.content, languageService);
      renderSection(sectionsContainer, section.name, plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
    }
  }
  return { element: container, disposables };
}
async function renderAgentResponseContent(event, languageService, clipboardService, scrollable) {
  const disposables = new DisposableStore();
  const container = $("div.chat-debug-message-content");
  container.tabIndex = 0;
  DOM.append(container, $("div.chat-debug-message-content-title", void 0, localize("chatDebug.agentResponse", "Agent Response")));
  DOM.append(container, $("div.chat-debug-message-content-summary", void 0, event.message));
  if (event.sections.length > 0) {
    const sectionsContainer = DOM.append(container, $("div.chat-debug-message-sections"));
    DOM.append(sectionsContainer, $(
      "div.chat-debug-message-sections-label",
      void 0,
      localize("chatDebug.responseSections", "Response Sections ({0})", event.sections.length)
    ));
    for (const section of event.sections) {
      const { plainText, tokenizedHtml } = await tokenizeContent(section.content, languageService);
      renderSection(sectionsContainer, section.name, plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
    }
  }
  return { element: container, disposables };
}
function messageEventToPlainText(event) {
  const lines = [];
  const label = event.kind === "userMessage" ? localize("chatDebug.userMessage", "User Message") : localize("chatDebug.agentResponse", "Agent Response");
  lines.push(`${label}: ${event.message}`);
  lines.push("");
  for (const section of event.sections) {
    lines.push(`--- ${section.name} ---`);
    lines.push(section.content);
    lines.push("");
  }
  return lines.join("\n");
}
async function renderResolvedMessageContent(content, languageService, clipboardService, scrollable) {
  const disposables = new DisposableStore();
  const container = $("div.chat-debug-message-content");
  container.tabIndex = 0;
  const title = content.type === "user" ? localize("chatDebug.userMessage", "User Message") : localize("chatDebug.agentResponse", "Agent Response");
  DOM.append(container, $("div.chat-debug-message-content-title", void 0, title));
  DOM.append(container, $("div.chat-debug-message-content-summary", void 0, content.message));
  if (content.sections.length > 0) {
    const sectionsContainer = DOM.append(container, $("div.chat-debug-message-sections"));
    const label = content.type === "user" ? localize("chatDebug.promptSections", "Prompt Sections ({0})", content.sections.length) : localize("chatDebug.responseSections", "Response Sections ({0})", content.sections.length);
    DOM.append(sectionsContainer, $("div.chat-debug-message-sections-label", void 0, label));
    for (const section of content.sections) {
      const { plainText, tokenizedHtml } = await tokenizeContent(section.content, languageService);
      renderSection(sectionsContainer, section.name, plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
    }
  }
  return { element: container, disposables };
}
function resolvedMessageToPlainText(content) {
  const lines = [];
  const label = content.type === "user" ? localize("chatDebug.userMessage", "User Message") : localize("chatDebug.agentResponse", "Agent Response");
  lines.push(`${label}: ${content.message}`);
  lines.push("");
  for (const section of content.sections) {
    lines.push(`--- ${section.name} ---`);
    lines.push(section.content);
    lines.push("");
  }
  return lines.join("\n");
}
export {
  messageEventToPlainText,
  renderAgentResponseContent,
  renderResolvedMessageContent,
  renderUserMessageContent,
  resolvedMessageToPlainText
};
