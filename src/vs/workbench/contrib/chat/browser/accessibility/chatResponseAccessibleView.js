import { renderAsPlaintext } from "../../../../../base/browser/markdownRenderer.js";
import { Emitter } from "../../../../../base/common/event.js";
import { isMarkdownString } from "../../../../../base/common/htmlContent.js";
import { stripIcons } from "../../../../../base/common/iconLabels.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { basename } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { AccessibleViewProviderId, AccessibleViewType } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { IStorageService, StorageScope } from "../../../../../platform/storage/common/storage.js";
import { AccessibilityVerbositySettingId } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { migrateLegacyTerminalToolSpecificData } from "../../common/chat.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { IChatToolInvocation, isLegacyChatTerminalToolInvocationData } from "../../common/chatService/chatService.js";
import { isResponseVM } from "../../common/model/chatViewModel.js";
import { isToolResultInputOutputDetails, isToolResultOutputDetails, toolContentToA11yString } from "../../common/tools/languageModelToolsService.js";
import { IChatWidgetService } from "../chat.js";
import { isLocation } from "../../../../../editor/common/languages.js";
class ChatResponseAccessibleView {
  constructor() {
    this.priority = 100;
    this.name = "panelChat";
    this.type = AccessibleViewType.View;
    this.when = ChatContextKeys.inChatSession;
  }
  getProvider(accessor) {
    const widgetService = accessor.get(IChatWidgetService);
    const storageService = accessor.get(IStorageService);
    const widget = widgetService.lastFocusedWidget;
    if (!widget) {
      return;
    }
    const chatInputFocused = widget.hasInputFocus();
    if (chatInputFocused) {
      widget.focusResponseItem();
    }
    const verifiedWidget = widget;
    let focusedItem = verifiedWidget.getFocus();
    if (!focusedItem || !isResponseVM(focusedItem)) {
      const responseItems = verifiedWidget.viewModel?.getItems().filter(isResponseVM);
      const lastResponse = responseItems?.at(-1);
      if (lastResponse) {
        focusedItem = lastResponse;
        verifiedWidget.focus(lastResponse);
      }
    }
    if (!focusedItem || !isResponseVM(focusedItem)) {
      return;
    }
    return new ChatResponseAccessibleProvider(verifiedWidget, focusedItem, chatInputFocused, storageService);
  }
}
const CHAT_ACCESSIBLE_VIEW_INCLUDE_THINKING_STORAGE_KEY = "chat.accessibleView.includeThinking";
const CHAT_ACCESSIBLE_VIEW_INCLUDE_THINKING_DEFAULT = true;
function isThinkingContentIncludedInAccessibleView(storageService) {
  return storageService.getBoolean(CHAT_ACCESSIBLE_VIEW_INCLUDE_THINKING_STORAGE_KEY, StorageScope.PROFILE, CHAT_ACCESSIBLE_VIEW_INCLUDE_THINKING_DEFAULT);
}
function isOutputDetailsSerialized(obj) {
  return typeof obj === "object" && obj !== null && "output" in obj && typeof obj.output === "object" && obj.output?.type === "data" && typeof obj.output?.base64Data === "string";
}
function getToolSpecificDataDescription(toolSpecificData) {
  if (!toolSpecificData) {
    return "";
  }
  if (isLegacyChatTerminalToolInvocationData(toolSpecificData) || toolSpecificData.kind === "terminal") {
    const terminalData = migrateLegacyTerminalToolSpecificData(toolSpecificData);
    return terminalData.commandLine.userEdited ?? terminalData.commandLine.toolEdited ?? terminalData.commandLine.original;
  }
  switch (toolSpecificData.kind) {
    case "subagent": {
      const parts = [];
      if (toolSpecificData.agentName) {
        parts.push(localize("subagentName", "Agent: {0}", toolSpecificData.agentName));
      }
      if (toolSpecificData.description) {
        parts.push(toolSpecificData.description);
      }
      if (toolSpecificData.prompt) {
        parts.push(localize("subagentPrompt", "Task: {0}", toolSpecificData.prompt));
      }
      return parts.join(". ") || "";
    }
    case "extensions":
      return toolSpecificData.extensions.length > 0 ? localize("extensionsList", "Extensions: {0}", toolSpecificData.extensions.join(", ")) : "";
    case "todoList": {
      const todos = toolSpecificData.todoList;
      if (todos.length === 0) {
        return "";
      }
      const todoDescriptions = todos.map(
        (t) => localize("todoItem", "{0} ({1})", t.title, t.status)
      );
      return localize("todoListCount", "{0} items: {1}", todos.length, todoDescriptions.join("; "));
    }
    case "pullRequest":
      return localize("pullRequestInfo", "PR: {0} by {1}", toolSpecificData.title, toolSpecificData.author);
    case "input":
      return typeof toolSpecificData.rawInput === "string" ? toolSpecificData.rawInput : JSON.stringify(toolSpecificData.rawInput);
    case "resources": {
      const values = toolSpecificData.values;
      if (values.length === 0) {
        return "";
      }
      const paths = values.map((v) => {
        if ("uri" in v && "range" in v) {
          return `${v.uri.fsPath || v.uri.path}:${v.range.startLineNumber}`;
        } else {
          return v.fsPath || v.path;
        }
      }).join(", ");
      return localize("resourcesList", "Resources: {0}", paths);
    }
    case "simpleToolInvocation": {
      const inputText = toolSpecificData.input;
      const outputText = toolSpecificData.output;
      return localize("simpleToolInvocation", "Input: {0}, Output: {1}", inputText, outputText);
    }
    case "modifiedFilesConfirmation": {
      if (toolSpecificData.modifiedFiles.length === 0) {
        return "";
      }
      return localize("modifiedFilesConfirmation", "Modified files: {0}", toolSpecificData.modifiedFiles.map((file) => {
        const revivedUri = URI.revive(file.uri);
        return revivedUri.fsPath || revivedUri.path;
      }).join(", "));
    }
    case "automationConfigured":
      return toolSpecificData.operation === "created" ? localize("automationConfigured.created", "Created an automation: {0}", toolSpecificData.automationName) : localize("automationConfigured.updated", "Edited an automation: {0}", toolSpecificData.automationName);
    default:
      return "";
  }
}
function getResultDetailsDescription(resultDetails) {
  if (!resultDetails) {
    return {};
  }
  if (Array.isArray(resultDetails)) {
    const files = resultDetails.map((ref) => {
      if (URI.isUri(ref)) {
        return ref.fsPath || ref.path;
      }
      return ref.uri.fsPath || ref.uri.path;
    });
    return { files };
  }
  if (isToolResultInputOutputDetails(resultDetails)) {
    return {
      input: resultDetails.input,
      isError: resultDetails.isError
    };
  }
  if (isOutputDetailsSerialized(resultDetails)) {
    return {
      input: localize("binaryOutput", "{0} data", resultDetails.output.mimeType)
    };
  }
  if (isToolResultOutputDetails(resultDetails)) {
    return {
      input: localize("binaryOutput", "{0} data", resultDetails.output.mimeType)
    };
  }
  return {};
}
function getToolInvocationA11yDescription(invocationMessage, pastTenseMessage, toolSpecificData, resultDetails, isComplete) {
  const parts = [];
  const message = isComplete && pastTenseMessage ? pastTenseMessage : invocationMessage;
  if (message) {
    parts.push(message);
  }
  const toolDataDesc = getToolSpecificDataDescription(toolSpecificData);
  if (toolDataDesc) {
    parts.push(toolDataDesc);
  }
  if (isComplete && resultDetails) {
    const details = getResultDetailsDescription(resultDetails);
    if (details.isError) {
      parts.unshift(localize("errored", "Errored"));
    }
    if (details.input && !toolDataDesc) {
      parts.push(localize("input", "Input: {0}", details.input));
    }
    if (details.files && details.files.length > 0) {
      parts.push(localize("files", "Files: {0}", details.files.join(", ")));
    }
  }
  return parts.join(". ");
}
class ChatResponseAccessibleProvider extends Disposable {
  constructor(_widget, item, _wasOpenedFromInput, _storageService) {
    super();
    this._widget = _widget;
    this._wasOpenedFromInput = _wasOpenedFromInput;
    this._storageService = _storageService;
    this._focusedItemDisposables = this._register(new DisposableStore());
    this._storageDisposables = this._register(new DisposableStore());
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this.id = AccessibleViewProviderId.PanelChat;
    this.verbositySettingKey = AccessibilityVerbositySettingId.Chat;
    this.options = { type: AccessibleViewType.View };
    this._storageDisposables.add(this._storageService.onDidChangeValue(StorageScope.PROFILE, CHAT_ACCESSIBLE_VIEW_INCLUDE_THINKING_STORAGE_KEY, this._storageDisposables)(() => {
      this._onDidChangeContent.fire();
    }));
    this._setFocusedItem(item);
  }
  provideContent() {
    return this._getContent(this._focusedItem);
  }
  _setFocusedItem(item) {
    this._focusedItem = item;
    this._focusedItemDisposables.clear();
    if (isResponseVM(item)) {
      this._focusedItemDisposables.add(item.model.onDidChange(() => this._onDidChangeContent.fire()));
    }
  }
  _renderMessageAsPlaintext(message) {
    return typeof message === "string" ? message : stripIcons(renderAsPlaintext(message, { useLinkFormatter: true }));
  }
  _getContent(item) {
    const contentParts = [];
    if (!isResponseVM(item)) {
      return "";
    }
    if ("errorDetails" in item && item.errorDetails) {
      contentParts.push(item.errorDetails.message);
    }
    for (const part of item.response.value) {
      switch (part.kind) {
        case "thinking": {
          if (!this._shouldIncludeThinkingContent()) {
            break;
          }
          const thinkingValue = Array.isArray(part.value) ? part.value.join("") : part.value || "";
          const trimmed = thinkingValue.trim();
          if (trimmed) {
            contentParts.push(localize("thinkingContent", "Thinking: {0}", trimmed));
          }
          break;
        }
        case "markdownContent": {
          const text = renderAsPlaintext(part.content, { includeCodeBlocksFences: true, useLinkFormatter: true });
          if (text.trim()) {
            contentParts.push(text);
          }
          break;
        }
        case "inlineReference": {
          const ref = part.inlineReference;
          let text;
          if (URI.isUri(ref)) {
            const name = part.name || basename(ref);
            const path = ref.scheme === "file" ? ref.path : ref.toString(true);
            text = name !== path ? `${name} (${path})` : path;
          } else if (isLocation(ref)) {
            const name = part.name || basename(ref.uri);
            const path = ref.uri.scheme === "file" ? ref.uri.path : ref.uri.toString(true);
            text = `${name} (${path}:${ref.range.startLineNumber})`;
          } else {
            const path = ref.location.uri.scheme === "file" ? ref.location.uri.fsPath || ref.location.uri.path : ref.location.uri.toString(true);
            text = `${ref.name} (${path}:${ref.location.range.startLineNumber})`;
          }
          contentParts.push(text);
          break;
        }
        case "elicitation2":
        case "elicitationSerialized": {
          const title = part.title;
          let elicitationContent = "";
          if (typeof title === "string") {
            elicitationContent += `${title}
`;
          } else if (isMarkdownString(title)) {
            elicitationContent += renderAsPlaintext(title, { includeCodeBlocksFences: true }) + "\n";
          }
          const message = part.message;
          if (isMarkdownString(message)) {
            elicitationContent += renderAsPlaintext(message, { includeCodeBlocksFences: true });
          } else {
            elicitationContent += message;
          }
          if (elicitationContent.trim()) {
            contentParts.push(elicitationContent);
          }
          break;
        }
        case "toolInvocation": {
          const state = part.state.get();
          if (state.type === IChatToolInvocation.StateKind.WaitingForConfirmation && state.confirmationMessages?.title) {
            const title = this._renderMessageAsPlaintext(state.confirmationMessages.title);
            const message = state.confirmationMessages.message ? this._renderMessageAsPlaintext(state.confirmationMessages.message) : "";
            const toolDataDesc = getToolSpecificDataDescription(part.toolSpecificData);
            let toolContent = title;
            if (toolDataDesc) {
              toolContent += `: ${toolDataDesc}`;
            }
            if (message) {
              toolContent += `
${message}`;
            }
            contentParts.push(toolContent);
          } else if (state.type === IChatToolInvocation.StateKind.WaitingForAuthentication) {
            contentParts.push(localize("toolAuthenticationA11yView", "MCP authentication required for {0} to continue {1}.", state.server.name, part.toolId));
          } else if (state.type === IChatToolInvocation.StateKind.WaitingForPostApproval) {
            const postApprovalDetails = isToolResultInputOutputDetails(state.resultDetails) ? state.resultDetails.input : isToolResultOutputDetails(state.resultDetails) ? void 0 : toolContentToA11yString(state.contentForModel);
            contentParts.push(localize("toolPostApprovalA11yView", "Approve results of {0}? Result: ", part.toolId) + (postApprovalDetails ?? ""));
          } else {
            const resultDetails = IChatToolInvocation.resultDetails(part);
            const isComplete = IChatToolInvocation.isComplete(part);
            const description = getToolInvocationA11yDescription(
              this._renderMessageAsPlaintext(part.invocationMessage),
              part.pastTenseMessage ? this._renderMessageAsPlaintext(part.pastTenseMessage) : void 0,
              part.toolSpecificData,
              resultDetails,
              isComplete
            );
            if (description) {
              contentParts.push(description);
            }
          }
          break;
        }
        case "toolInvocationSerialized": {
          const description = getToolInvocationA11yDescription(
            this._renderMessageAsPlaintext(part.invocationMessage),
            part.pastTenseMessage ? this._renderMessageAsPlaintext(part.pastTenseMessage) : void 0,
            part.toolSpecificData,
            part.resultDetails,
            part.isComplete
          );
          if (description) {
            contentParts.push(description);
          }
          break;
        }
        case "autoModeResolution": {
          if (part.predictedLabel === "fallback") {
            contentParts.push(localize("autoModeResolutionA11yFallback", "Routed to {0}. Unable to resolve.", part.resolvedModelName));
          } else {
            const label = part.predictedLabel === "needs_reasoning" ? localize("autoModeResolutionA11yReasoning", "Reasoning") : localize("autoModeResolutionA11yNonReasoning", "Non-reasoning");
            contentParts.push(localize("autoModeResolutionA11y", "Routed to {0}. {1} - Confidence {2}%", part.resolvedModelName, label, (part.confidence * 100).toFixed(0)));
          }
          break;
        }
      }
    }
    return this._normalizeWhitespace(contentParts.join("\n"));
  }
  _normalizeWhitespace(content) {
    const lines = content.split(/\r?\n/);
    const normalized = [];
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }
      normalized.push(line);
    }
    return normalized.join("\n");
  }
  _shouldIncludeThinkingContent() {
    return isThinkingContentIncludedInAccessibleView(this._storageService);
  }
  onClose() {
    this._widget.reveal(this._focusedItem);
    if (this._wasOpenedFromInput) {
      this._widget.focusInput();
    } else {
      this._widget.focus(this._focusedItem);
    }
  }
  provideNextContent() {
    const next = this._widget.getSibling(this._focusedItem, "next");
    if (next) {
      this._setFocusedItem(next);
      return this._getContent(next);
    }
    return;
  }
  providePreviousContent() {
    const previous = this._widget.getSibling(this._focusedItem, "previous");
    if (previous) {
      this._setFocusedItem(previous);
      return this._getContent(previous);
    }
    return;
  }
}
export {
  CHAT_ACCESSIBLE_VIEW_INCLUDE_THINKING_STORAGE_KEY,
  ChatResponseAccessibleView,
  getResultDetailsDescription,
  getToolInvocationA11yDescription,
  getToolSpecificDataDescription,
  isThinkingContentIncludedInAccessibleView
};
