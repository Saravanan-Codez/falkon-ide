import * as DOM from "../../../../../base/browser/dom.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { getDefaultHoverDelegate } from "../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { createTrustedTypesPolicy } from "../../../../../base/browser/trustedTypes.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { tokenizeToString } from "../../../../../editor/common/languages/textToHtmlTokenizer.js";
import { setupCollapsibleToggle } from "./chatDebugCollapsible.js";
const $ = DOM.$;
const _ttpPolicy = createTrustedTypesPolicy("chatDebugTokenizer", {
  createHTML(html) {
    return html;
  }
});
function tryParseJSON(text) {
  try {
    return { parsed: JSON.parse(text), isJSON: true };
  } catch {
    return { isJSON: false };
  }
}
async function tokenizeContent(text, languageService) {
  const result = tryParseJSON(text);
  const plainText = result.isJSON ? JSON.stringify(result.parsed, null, 2) : text;
  const language = result.isJSON ? "json" : "markdown";
  const tokenizedHtml = await tokenizeToString(languageService, plainText, language);
  return { plainText, tokenizedHtml };
}
function renderSection(parent, label, plainText, tokenizedHtml, disposables, initiallyCollapsed = false, clipboardService, scrollable) {
  const sectionEl = DOM.append(parent, $("div.chat-debug-message-section"));
  const header = DOM.append(sectionEl, $("div.chat-debug-message-section-header"));
  const chevron = DOM.append(header, $("span.chat-debug-message-section-chevron"));
  DOM.append(header, $("span.chat-debug-message-section-title", void 0, label));
  if (clipboardService) {
    const copyBtn = disposables.add(new Button(header, {
      title: localize("chatDebug.section.copy", "Copy"),
      ariaLabel: localize("chatDebug.section.copy", "Copy"),
      hoverDelegate: getDefaultHoverDelegate("mouse")
    }));
    copyBtn.icon = Codicon.copy;
    copyBtn.element.classList.add("chat-debug-section-copy-btn");
    disposables.add(DOM.addDisposableListener(copyBtn.element, DOM.EventType.MOUSE_ENTER, () => {
      header.classList.add("chat-debug-section-copy-header-passthrough");
    }));
    disposables.add(DOM.addDisposableListener(copyBtn.element, DOM.EventType.MOUSE_LEAVE, () => {
      header.classList.remove("chat-debug-section-copy-header-passthrough");
    }));
    disposables.add(copyBtn.onDidClick((e) => {
      if (e) {
        DOM.EventHelper.stop(e, true);
      }
      clipboardService.writeText(plainText);
    }));
  }
  const wrapper = DOM.append(sectionEl, $("div.chat-debug-message-section-content-wrapper"));
  const contentEl = DOM.append(wrapper, $("pre.chat-debug-message-section-content"));
  contentEl.tabIndex = 0;
  if (tokenizedHtml) {
    const trustedHtml = _ttpPolicy?.createHTML(tokenizedHtml) ?? tokenizedHtml;
    contentEl.innerHTML = trustedHtml;
  } else {
    contentEl.textContent = plainText;
  }
  setupCollapsibleToggle(chevron, header, wrapper, disposables, initiallyCollapsed, scrollable);
}
async function renderToolCallContent(content, languageService, clipboardService, scrollable) {
  const disposables = new DisposableStore();
  const container = $("div.chat-debug-message-content");
  container.tabIndex = 0;
  DOM.append(container, $("div.chat-debug-message-content-title", void 0, content.toolName));
  const statusParts = [];
  if (content.result) {
    statusParts.push(content.result === "success" ? localize("chatDebug.toolCall.success", "Success") : localize("chatDebug.toolCall.error", "Error"));
  }
  if (content.durationInMillis !== void 0) {
    statusParts.push(localize("chatDebug.toolCall.duration", "{0}ms", content.durationInMillis));
  }
  if (statusParts.length > 0) {
    DOM.append(container, $("div.chat-debug-message-content-summary", void 0, statusParts.join(" \xB7 ")));
  }
  const sectionsContainer = DOM.append(container, $("div.chat-debug-message-sections"));
  if (content.input) {
    const { plainText, tokenizedHtml } = await tokenizeContent(content.input, languageService);
    renderSection(sectionsContainer, localize("chatDebug.toolCall.arguments", "Arguments"), plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
  }
  if (content.output) {
    const { plainText, tokenizedHtml } = await tokenizeContent(content.output, languageService);
    renderSection(sectionsContainer, localize("chatDebug.toolCall.output", "Output"), plainText, tokenizedHtml, disposables, false, clipboardService, scrollable);
  }
  return { element: container, disposables };
}
function toolCallContentToPlainText(content) {
  const lines = [];
  lines.push(localize("chatDebug.toolCall.toolLabel", "Tool: {0}", content.toolName));
  if (content.result) {
    lines.push(localize("chatDebug.toolCall.statusLabel", "Status: {0}", content.result));
  }
  if (content.durationInMillis !== void 0) {
    lines.push(localize("chatDebug.toolCall.durationLabel", "Duration: {0}ms", content.durationInMillis));
  }
  if (content.input) {
    lines.push("");
    lines.push(`[${localize("chatDebug.toolCall.arguments", "Arguments")}]`);
    try {
      const parsed = JSON.parse(content.input);
      lines.push(JSON.stringify(parsed, null, 2));
    } catch {
      lines.push(content.input);
    }
  }
  if (content.output) {
    lines.push("");
    lines.push(`[${localize("chatDebug.toolCall.output", "Output")}]`);
    try {
      const parsed = JSON.parse(content.output);
      lines.push(JSON.stringify(parsed, null, 2));
    } catch {
      lines.push(content.output);
    }
  }
  return lines.join("\n");
}
export {
  renderSection,
  renderToolCallContent,
  tokenizeContent,
  toolCallContentToPlainText,
  tryParseJSON
};
