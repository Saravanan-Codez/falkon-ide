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
import { $, clearNode, DisposableResizeObserver, getWindow, hide, isHTMLElement, scheduleAtNextAnimationFrame } from "../../../../../../base/browser/dom.js";
import { alert } from "../../../../../../base/browser/ui/aria/aria.js";
import { DomScrollableElement } from "../../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { ScrollbarVisibility } from "../../../../../../base/common/scrollable.js";
import { IChatToolInvocation } from "../../../common/chatService/chatService.js";
import { ChatConfiguration, ThinkingDisplayMode } from "../../../common/constants.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { AccessibilityWorkbenchSettingId } from "../../../../accessibility/browser/accessibilityConfiguration.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { extractCodeblockUrisFromText } from "../../../common/widget/annotations.js";
import { basename } from "../../../../../../base/common/resources.js";
import { ChatCollapsibleContentPart } from "./chatCollapsibleContentPart.js";
import { renderFileWidgets } from "./chatInlineAnchorWidget.js";
import { localize } from "../../../../../../nls.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { Lazy } from "../../../../../../base/common/lazy.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { DisposableMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { IChatMarkdownAnchorService } from "./chatMarkdownAnchorService.js";
import { ChatMessageRole, ILanguageModelsService } from "../../../common/languageModels.js";
import "./media/chatThinkingContent.css";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { extractImagesFromToolInvocationOutputDetails } from "../../../common/chatImageExtraction.js";
import { ChatThinkingExternalResourceWidget } from "./chatThinkingExternalResourcesWidget.js";
import { LocalChatSessionUri, chatSessionResourceToId } from "../../../common/model/chatUri.js";
const SESSIONS_IS_PHONE_LAYOUT_KEY = "sessionsIsPhoneLayout";
function getEffectiveThinkingDisplayMode(configurationService, contextKeyService) {
  if (contextKeyService.getContextKeyValue(SESSIONS_IS_PHONE_LAYOUT_KEY) === true) {
    return ThinkingDisplayMode.CollapsedPreview;
  }
  return configurationService.getValue("chat.agent.thinkingStyle") ?? ThinkingDisplayMode.Collapsed;
}
function extractTextFromPart(content) {
  const raw = Array.isArray(content.value) ? content.value.join("") : content.value || "";
  return raw.trim();
}
function isEditToolId(toolId) {
  const lowerToolId = toolId.toLowerCase();
  return lowerToolId.includes("edit") || lowerToolId.includes("create") || lowerToolId.includes("replace") || lowerToolId.includes("patch");
}
function isGenericEditToolId(toolId) {
  const lowerToolId = toolId.toLowerCase();
  if (lowerToolId.includes("create") || lowerToolId.includes("notebook")) {
    return false;
  }
  return lowerToolId.includes("replace") || lowerToolId.includes("patch") || lowerToolId.includes("insertedit") || lowerToolId.includes("insert_edit") || lowerToolId.includes("editfile");
}
function isProblemsToolId(toolId) {
  switch (toolId?.toLowerCase()) {
    case "problems":
    case "get_errors":
    case "copilot_geterrors":
      return true;
    default:
      return false;
  }
}
function isNoProblemsFoundResult(toolId, resultText) {
  return isProblemsToolId(toolId) && resultText?.toLowerCase().includes("no problems found") === true;
}
function getToolInvocationIcon(toolId, registeredIcon, resultText) {
  if (isNoProblemsFoundResult(toolId, resultText)) {
    return Codicon.search;
  }
  if (registeredIcon) {
    return registeredIcon;
  }
  const lowerToolId = toolId.toLowerCase();
  if (lowerToolId.includes("comment")) {
    return Codicon.comment;
  }
  if (lowerToolId.includes("search") || lowerToolId.includes("grep") || lowerToolId.includes("find") || lowerToolId.includes("list") || lowerToolId.includes("semantic") || lowerToolId.includes("changes") || lowerToolId.includes("codebase") || lowerToolId.includes("checked")) {
    return Codicon.search;
  }
  if (lowerToolId.includes("read") || lowerToolId.includes("get_file") || lowerToolId.includes("problems")) {
    return Codicon.book;
  }
  if (isEditToolId(toolId)) {
    return Codicon.pencil;
  }
  if (lowerToolId.includes("terminal")) {
    return Codicon.terminal;
  }
  return Codicon.tools;
}
function createThinkingIcon(icon) {
  const iconElement = $("span.chat-thinking-icon");
  iconElement.classList.add(...ThemeIcon.asClassNameArray(icon));
  return iconElement;
}
function setThinkingIcon(iconElement, icon) {
  iconElement.className = "chat-thinking-icon";
  iconElement.classList.add(...ThemeIcon.asClassNameArray(icon));
}
function extractTitleFromThinkingContent(content) {
  const headerMatch = content.match(/^\*\*([^*]+)\*\*/);
  return headerMatch ? headerMatch[1] : void 0;
}
const THINKING_SCROLL_MAX_HEIGHT = 200;
const TITLE_CACHE_STORAGE_KEY = "chat.thinkingTitleCache";
const TITLE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
const TITLE_CACHE_MAX_ENTRIES = 1e3;
var WorkingMessageCategory = /* @__PURE__ */ ((WorkingMessageCategory2) => {
  WorkingMessageCategory2["Thinking"] = "thinking";
  WorkingMessageCategory2["Terminal"] = "terminal";
  WorkingMessageCategory2["Tool"] = "tool";
  return WorkingMessageCategory2;
})(WorkingMessageCategory || {});
const defaultThinkingMessages = [
  localize("chat.thinking.thinking.1", "Thinking"),
  localize("chat.thinking.thinking.2", "Reasoning"),
  localize("chat.thinking.thinking.3", "Considering"),
  localize("chat.thinking.thinking.4", "Analyzing"),
  localize("chat.thinking.thinking.5", "Evaluating"),
  localize("chat.thinking.thinking.6", "Working")
];
const terminalMessages = [
  localize("chat.thinking.terminal.1", "Executing"),
  localize("chat.thinking.terminal.2", "Running"),
  localize("chat.thinking.terminal.3", "Processing")
];
const toolMessages = [
  localize("chat.thinking.tool.1", "Processing"),
  localize("chat.thinking.tool.2", "Preparing"),
  localize("chat.thinking.tool.3", "Loading"),
  localize("chat.thinking.tool.4", "Analyzing"),
  localize("chat.thinking.tool.5", "Evaluating")
];
const funWorkingMessages = [
  // Generic
  localize("chat.working.fun.1", "Bribing the hamster"),
  localize("chat.working.fun.2", "Reticulating splines"),
  localize("chat.working.fun.3", "Untangling the spaghetti"),
  localize("chat.working.fun.4", "Communing with the codebase"),
  // Minecraft
  localize("chat.working.fun.minecraft.1", "Mining diamonds"),
  // Microsoft
  localize("chat.working.fun.ms.1", "Summoning Clippy")
];
const FUN_WORKING_MESSAGE_RATE = 50;
function getCustomThinkingPhrases(configurationService) {
  const config = configurationService.getValue(ChatConfiguration.ThinkingPhrases);
  const customPhrases = Array.isArray(config?.phrases) ? config.phrases.filter((phrase) => typeof phrase === "string").map((phrase) => phrase.trim()).filter((phrase) => phrase.length > 0) : [];
  return {
    customPhrases,
    replaceDefaults: config?.mode === "replace" && customPhrases.length > 0
  };
}
function maybePickFunWorkingMessage(configurationService, random = Math.random) {
  if (getCustomThinkingPhrases(configurationService).replaceDefaults) {
    return void 0;
  }
  if (Math.floor(random() * FUN_WORKING_MESSAGE_RATE) === 0) {
    return funWorkingMessages[Math.floor(random() * funWorkingMessages.length)];
  }
  return void 0;
}
function buildPhrasePool(defaults, configurationService) {
  const { customPhrases, replaceDefaults } = getCustomThinkingPhrases(configurationService);
  if (customPhrases.length > 0) {
    return replaceDefaults ? [...customPhrases] : [...defaults, ...customPhrases];
  }
  return [...defaults];
}
let ChatThinkingContentPart = class extends ChatCollapsibleContentPart {
  constructor(content, context, chatContentMarkdownRenderer, streamingCompleted, instantiationService, configurationService, chatMarkdownAnchorService, languageModelsService, hoverService, storageService, contextKeyService) {
    const initialText = extractTextFromPart(content);
    const containsReasoning = initialText.trim().length > 0;
    const extractedTitle = extractTitleFromThinkingContent(initialText) ?? localize("chat.thinking.header.initial", "Thinking");
    super(extractedTitle, context, void 0, hoverService, configurationService);
    this.chatContentMarkdownRenderer = chatContentMarkdownRenderer;
    this.streamingCompleted = streamingCompleted;
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.chatMarkdownAnchorService = chatMarkdownAnchorService;
    this.languageModelsService = languageModelsService;
    this.storageService = storageService;
    this._onDidChangeHeight = this._register(new Emitter());
    this._asyncRenderCallback = () => this._onDidChangeHeight.fire();
    this.defaultTitle = localize("chat.thinking.header", "Thinking");
    this.workingTitle = localize("chat.thinking.header.working", "Working");
    this._markdownResult = this._register(new MutableDisposable());
    this.fixedScrollingMode = false;
    this.autoScrollEnabled = true;
    this.extractedTitles = [];
    this.toolInvocationCount = 0;
    this.appendedItemCount = 0;
    this.isActive = true;
    this.toolInvocations = [];
    this.allThinkingParts = [];
    this.hookCount = 0;
    this.lazyItems = [];
    this.hasExpandedOnce = false;
    this.availableMessagesByCategory = /* @__PURE__ */ new Map();
    this.toolWrappersByCallId = /* @__PURE__ */ new Map();
    this.toolIconsByCallId = /* @__PURE__ */ new Map();
    this.toolLabelsByCallId = /* @__PURE__ */ new Map();
    this.toolDisposables = this._register(new DisposableMap());
    this.ownedToolParts = /* @__PURE__ */ new Map();
    this.pendingRemovals = [];
    this.isUpdatingDimensions = false;
    this.lastKnownContentHeight = 0;
    this.lastKnownScrollTop = 0;
    this._pendingExternalResources = /* @__PURE__ */ new Map();
    this._titleDetailRendered = this._register(new MutableDisposable());
    this._pendingAppendRefresh = this._register(new MutableDisposable());
    this.diffStatsByPartId = /* @__PURE__ */ new Map();
    this._aggregatedDiff = { added: 0, removed: 0 };
    this.containsGroupedItems = false;
    this.containsReasoning = containsReasoning;
    this.reasoningDurationMs = content.reasoningDurationMs;
    this.id = content.id;
    this.content = content;
    this.allThinkingParts.push(content);
    const configuredMode = getEffectiveThinkingDisplayMode(this.configurationService, contextKeyService);
    this.thinkingDisplayMode = configuredMode;
    this.fixedScrollingMode = configuredMode === ThinkingDisplayMode.FixedScrolling;
    this.currentTitle = extractedTitle;
    if (extractedTitle !== this.defaultTitle) {
      this.lastExtractedTitle = extractedTitle;
      this.extractedTitles.push(extractedTitle);
    }
    this.currentThinkingValue = initialText;
    if (initialText.trim()) {
      this.appendedItemCount++;
    }
    if (this.configurationService.getValue(AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates)) {
      alert(localize("chat.thinking.started", "Thinking"));
    }
    if (configuredMode === ThinkingDisplayMode.Collapsed) {
      this.setExpanded(false);
    } else if (configuredMode === ThinkingDisplayMode.CollapsedPreview) {
      this.setExpanded(!this.streamingCompleted && !this.element.isComplete);
    } else {
      this.setExpanded(false);
    }
    const node = this.domNode;
    node.classList.add("chat-thinking-box");
    this._externalResourceWidget = this._register(this.instantiationService.createInstance(ChatThinkingExternalResourceWidget));
    this._register(this._externalResourceWidget.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
    node.appendChild(this._externalResourceWidget.domNode);
    if (!this.streamingCompleted && !this.element.isComplete) {
      if (!this.fixedScrollingMode) {
        node.classList.add("chat-thinking-active");
      }
    }
    if (!this.fixedScrollingMode && !this.streamingCompleted && !this.element.isComplete && this._collapseButton) {
      const labelElement = this._collapseButton.labelElement;
      labelElement.textContent = "";
      this.titleShimmerSpan = $("span.chat-thinking-title-shimmer");
      this.titleShimmerSpan.textContent = extractedTitle;
      labelElement.appendChild(this.titleShimmerSpan);
    }
    if (this.fixedScrollingMode) {
      node.classList.add("chat-thinking-fixed-mode");
      this.currentTitle = this.defaultTitle;
    }
    this._register(toDisposable(() => {
      for (const d of this.ownedToolParts.values()) {
        d.dispose();
      }
      this.ownedToolParts.clear();
    }));
    this._register(autorun((r) => {
      const isExpanded = this.expanded.read(r);
      if (this._collapseButton) {
        if (this.streamingCompleted || this.element.isComplete) {
          this._collapseButton.icon = Codicon.check;
        } else if (!this.fixedScrollingMode) {
          if (isExpanded) {
            this._collapseButton.icon = Codicon.chevronDown;
          } else {
            this._collapseButton.icon = Codicon.circleFilled;
          }
        }
      }
    }));
    this._register(autorun((r) => {
      const isExpanded = this._isExpanded.read(r);
      if (isExpanded && !this.hasExpandedOnce && this.lazyItems.length > 0) {
        this.hasExpandedOnce = true;
        this.processPendingRemovals();
        for (const item of this.lazyItems) {
          this.materializeLazyItem(item);
        }
      }
      if (isExpanded && !this.shouldAllowExpansion() && (this.streamingCompleted || this.element.isComplete)) {
        this.setExpanded(false);
        return;
      }
      this._externalResourceWidget.setCollapsed(!isExpanded);
      this._onDidChangeHeight.fire();
    }));
    const label = this.lastExtractedTitle ?? "";
    if (!this.fixedScrollingMode && !this._isExpanded.get()) {
      this.setTitle(label);
    }
    if (this._collapseButton) {
      this._register(this._collapseButton.onDidClick(() => {
        if (this.fixedScrollingMode) {
          if (this.streamingCompleted) {
            this.domNode.classList.add("chat-thinking-fixed-mode-animated");
          }
          return;
        }
        if (this.streamingCompleted) {
          return;
        }
        const expanded = this.isExpanded();
        if (expanded) {
          this.collapsedTitleBeforeExpansion = this.lastExtractedTitle;
          this.setTitle(this.defaultTitle, true);
          this.currentTitle = this.defaultTitle;
        } else {
          const collapsedTitle = this.collapsedTitleBeforeExpansion ?? this.lastExtractedTitle;
          this.collapsedTitleBeforeExpansion = void 0;
          if (collapsedTitle) {
            this.setTitle(collapsedTitle);
          } else {
            this.setTitle(this.defaultTitle, true);
            this.currentTitle = this.defaultTitle;
          }
        }
      }));
    }
  }
  static _codeBlockRendererSync(_languageId, text, _raw) {
    const codeElement = $("code");
    codeElement.textContent = text;
    return codeElement;
  }
  get aggregatedDiff() {
    return this._aggregatedDiff;
  }
  getRandomWorkingMessage(category = "tool" /* Tool */) {
    const fun = maybePickFunWorkingMessage(this.configurationService);
    if (fun) {
      return fun;
    }
    let pool = this.availableMessagesByCategory.get(category);
    if (!pool || pool.length === 0) {
      let defaults;
      switch (category) {
        case "thinking" /* Thinking */:
          defaults = defaultThinkingMessages;
          break;
        case "terminal" /* Terminal */:
          defaults = terminalMessages;
          break;
        case "tool" /* Tool */:
        default:
          defaults = toolMessages;
          break;
      }
      pool = buildPhrasePool(defaults, this.configurationService);
      this.availableMessagesByCategory.set(category, pool);
    }
    const index = Math.floor(Math.random() * pool.length);
    return pool.splice(index, 1)[0];
  }
  shouldInitEarly() {
    return this.fixedScrollingMode && !this.streamingCompleted;
  }
  shouldAnimateContent() {
    return !this.fixedScrollingMode;
  }
  shouldPrepareContentAnimation() {
    return !this.fixedScrollingMode;
  }
  contentDidInitialize() {
    if (this.fixedScrollingMode && this.streamingCompleted && this.scrollableElement) {
      const scrollableDomNode = this.scrollableElement.getDomNode();
      scrollableDomNode.style.maxHeight = "0px";
      scrollableDomNode.getBoundingClientRect();
    }
  }
  expansionDidChange(expanded) {
    if (this.fixedScrollingMode && this.streamingCompleted) {
      if (expanded) {
        this.syncDimensionsAndScheduleScroll();
      } else {
        this.updateCompletedScrollAnimationState(false);
      }
    }
  }
  // @TODO: @justschen Convert to template for each setting?
  initContent() {
    this.wrapper = $(".chat-used-context-list.chat-thinking-collapsible");
    if (!this.streamingCompleted) {
      this.wrapper.classList.add("chat-thinking-streaming");
    }
    const hasLazyThinkingItems = this.lazyItems.some((item) => item.kind === "thinking");
    if (this.currentThinkingValue && !hasLazyThinkingItems) {
      this.textContainer = $(".chat-thinking-item.markdown-content");
      this.wrapper.appendChild(this.textContainer);
      this.renderMarkdown(this.currentThinkingValue);
    }
    if (!this.streamingCompleted && !this.element.isComplete) {
      this.workingSpinnerElement = $(".chat-thinking-item.chat-thinking-spinner-item");
      const spinnerIcon = createThinkingIcon(Codicon.circleFilled);
      this.workingSpinnerElement.appendChild(spinnerIcon);
      this.workingSpinnerLabel = $("span.chat-thinking-spinner-label");
      this.workingSpinnerLabel.textContent = this.getRandomWorkingMessage("thinking" /* Thinking */);
      this.workingSpinnerElement.appendChild(this.workingSpinnerLabel);
      this.wrapper.appendChild(this.workingSpinnerElement);
      this.updateWorkingSpinnerVisibility();
    }
    if (this.fixedScrollingMode) {
      this.scrollableElement = this._register(new DomScrollableElement(this.wrapper, {
        vertical: ScrollbarVisibility.Auto,
        horizontal: ScrollbarVisibility.Hidden,
        handleMouseWheel: true,
        alwaysConsumeMouseWheel: false
      }));
      this._register(this.scrollableElement.onScroll((e) => this.handleScroll(e.scrollTop)));
      let pendingMutationRefresh;
      const mutationObserver = new MutationObserver(() => {
        if (pendingMutationRefresh) {
          return;
        }
        pendingMutationRefresh = scheduleAtNextAnimationFrame(getWindow(this.wrapper), () => {
          pendingMutationRefresh = void 0;
          if (this.streamingCompleted || !this.domNode.classList.contains("chat-used-context-collapsed")) {
            return;
          }
          this.refreshContentHeight();
          this.updateScrollDimensionsFromCache();
        });
      });
      mutationObserver.observe(this.wrapper, { childList: true, subtree: true });
      this._register({
        dispose: () => {
          mutationObserver.disconnect();
          pendingMutationRefresh?.dispose();
        }
      });
      this.childResizeObserver = this._register(new DisposableResizeObserver("ChatThinkingContentPart.child", () => {
        if (this.streamingCompleted || !this.domNode.classList.contains("chat-used-context-collapsed")) {
          return;
        }
        this.syncDimensionsAndScheduleScroll();
      }));
      if (this.textContainer) {
        this._register(this.childResizeObserver.observe(this.textContainer));
      }
      if (this.workingSpinnerElement) {
        this._register(this.childResizeObserver.observe(this.workingSpinnerElement));
      }
      const wrapperResizeObserver = this._register(new DisposableResizeObserver("ChatThinkingContentPart.wrapper", (entries) => {
        if (entries[0]) {
          this.lastKnownContentHeight = this.wrapper.scrollHeight;
          if (this.streamingCompleted && this.isExpanded()) {
            this.updateScrollDimensionsForCompletion();
          } else if (!this.streamingCompleted && this.domNode.classList.contains("chat-used-context-collapsed")) {
            this.updateScrollDimensionsFromCache();
          }
        }
      }));
      this.wrapperResizeObserverDisposable = this._register(wrapperResizeObserver.observe(this.wrapper));
      this._register(this._onDidChangeHeight.event(() => {
        if (!this.streamingCompleted && this.wrapperResizeObserverDisposable) {
          this.refreshContentHeight();
          this.updateScrollDimensionsFromCache();
          return;
        }
        this.syncDimensionsAndScheduleScroll();
      }));
      this.syncDimensionsAndScheduleScroll();
      this.updateDropdownClickability();
      return this.scrollableElement.getDomNode();
    }
    this.updateDropdownClickability();
    return this.wrapper;
  }
  handleScroll(scrollTop) {
    if (!this.scrollableElement || this.isUpdatingDimensions) {
      return;
    }
    this.lastKnownScrollTop = scrollTop;
    const contentHeight = this.lastKnownContentHeight;
    const viewportHeight = Math.min(contentHeight, THINKING_SCROLL_MAX_HEIGHT);
    const maxScrollTop = contentHeight - viewportHeight;
    this.autoScrollEnabled = maxScrollTop <= 0 || scrollTop >= maxScrollTop - 10;
    this.updateFadeClasses(scrollTop, contentHeight, viewportHeight);
  }
  updateFadeClasses(scrollTop, contentHeight, viewportHeight) {
    if (!this.fixedScrollingMode || this.streamingCompleted) {
      this.domNode.classList.remove("chat-thinking-fade-top", "chat-thinking-fade-bottom");
      return;
    }
    const currentScrollTop = scrollTop ?? this.lastKnownScrollTop;
    const currentContentHeight = contentHeight ?? this.lastKnownContentHeight;
    const currentViewportHeight = viewportHeight ?? Math.min(currentContentHeight, THINKING_SCROLL_MAX_HEIGHT);
    const maxScrollTop = currentContentHeight - currentViewportHeight;
    this.domNode.classList.toggle("chat-thinking-fade-top", currentScrollTop > 5);
    this.domNode.classList.toggle("chat-thinking-fade-bottom", maxScrollTop > 0 && currentScrollTop < maxScrollTop - 5);
  }
  // Fallback for non-ResizeObserver updates (onDidChangeHeight, initial setup).
  syncDimensionsAndScheduleScroll() {
    if (this.pendingScrollDisposable) {
      return;
    }
    this.pendingScrollDisposable = scheduleAtNextAnimationFrame(getWindow(this.domNode), () => {
      this.pendingScrollDisposable = void 0;
      if (this._store.isDisposed) {
        return;
      }
      if (this.streamingCompleted) {
        this.updateScrollDimensionsForCompletion();
        return;
      }
      this.refreshContentHeight();
      this.updateScrollDimensionsFromCache();
    });
  }
  /**
   * Re-read scrollHeight from the DOM and update cached height if changed.
   */
  refreshContentHeight() {
    if (!this.wrapper || !this.scrollableElement) {
      return;
    }
    const newHeight = this.wrapper.scrollHeight;
    if (newHeight && newHeight !== this.lastKnownContentHeight) {
      this.lastKnownContentHeight = newHeight;
    }
  }
  updateScrollDimensionsFromCache() {
    if (!this.scrollableElement || this._store.isDisposed) {
      return;
    }
    const isCollapsed = this.domNode.classList.contains("chat-used-context-collapsed");
    if (!isCollapsed) {
      return;
    }
    const contentHeight = this.lastKnownContentHeight;
    if (!contentHeight) {
      return;
    }
    const viewportHeight = Math.min(contentHeight, THINKING_SCROLL_MAX_HEIGHT);
    this.isUpdatingDimensions = true;
    try {
      const viewportWidth = this.scrollableElement.getDomNode().clientWidth;
      this.scrollableElement.setScrollDimensions({
        width: viewportWidth,
        scrollWidth: viewportWidth,
        height: viewportHeight,
        scrollHeight: contentHeight
      });
      if (this.autoScrollEnabled) {
        this.scrollToBottom(contentHeight);
      }
    } finally {
      this.isUpdatingDimensions = false;
    }
    this.updateFadeClasses(this.lastKnownScrollTop, this.lastKnownContentHeight);
    this.updateDropdownClickability(contentHeight);
  }
  scrollToBottom(contentHeight) {
    if (!this.scrollableElement) {
      return;
    }
    const viewportHeight = Math.min(contentHeight, THINKING_SCROLL_MAX_HEIGHT);
    if (contentHeight > viewportHeight) {
      const newScrollTop = contentHeight - viewportHeight;
      this.lastKnownScrollTop = newScrollTop;
      this.scrollableElement.setRevealOnScroll(false);
      this.scrollableElement.setScrollPosition({ scrollTop: newScrollTop });
      this.scrollableElement.setRevealOnScroll(true);
    }
  }
  /**
   * updates scroll dimensions when streaming is complete.
   */
  updateScrollDimensionsForCompletion() {
    if (!this.scrollableElement || !this.fixedScrollingMode) {
      return;
    }
    const contentHeight = this.wrapper.scrollHeight;
    this.lastKnownContentHeight = contentHeight;
    const scrollableDomNode = this.scrollableElement.getDomNode();
    scrollableDomNode.style.maxHeight = `${contentHeight}px`;
    const viewportWidth = scrollableDomNode.clientWidth;
    this.scrollableElement.setScrollDimensions({
      width: viewportWidth,
      scrollWidth: viewportWidth,
      height: contentHeight,
      scrollHeight: contentHeight
    });
    this.lastKnownScrollTop = 0;
    this.scrollableElement.setRevealOnScroll(false);
    this.scrollableElement.setScrollPosition({ scrollTop: 0 });
    this.scrollableElement.setRevealOnScroll(true);
    this.updateCompletedScrollAnimationState(this.isExpanded());
  }
  updateCompletedScrollAnimationState(expanded) {
    if (!this.scrollableElement) {
      return;
    }
    const scrollableDomNode = this.scrollableElement.getDomNode();
    scrollableDomNode.style.maxHeight = expanded ? `${this.lastKnownContentHeight}px` : "0px";
    scrollableDomNode.inert = !expanded;
  }
  renderMarkdown(content, reuseExisting) {
    if (this._store.isDisposed) {
      return;
    }
    const cleanedContent = content.trim();
    if (!cleanedContent) {
      this._markdownResult.clear();
      if (this.textContainer) {
        clearNode(this.textContainer);
      }
      return;
    }
    let contentToRender = cleanedContent;
    if (cleanedContent.startsWith("**") && cleanedContent.endsWith("**")) {
      contentToRender = cleanedContent.slice(2, -2);
    }
    const target = reuseExisting ? this._markdownResult.value?.element : void 0;
    const rendered = this.chatContentMarkdownRenderer.render(new MarkdownString(contentToRender), {
      fillInIncompleteTokens: true,
      asyncRenderCallback: this._asyncRenderCallback,
      codeBlockRendererSync: ChatThinkingContentPart._codeBlockRendererSync
    }, target);
    this._markdownResult.value = rendered;
    if (!target) {
      if (this.textContainer) {
        clearNode(this.textContainer);
        this.textContainer.appendChild(createThinkingIcon(Codicon.circleFilled));
        this.textContainer.appendChild(rendered.element);
      }
    }
  }
  setFinalizedTitle(title) {
    if (!this._collapseButton) {
      return;
    }
    const displayTitle = this.getFinalizedDisplayTitle(title);
    const labelElement = this._collapseButton.labelElement;
    labelElement.textContent = "";
    const firstSpaceIndex = displayTitle.indexOf(" ");
    if (firstSpaceIndex === -1) {
      labelElement.textContent = displayTitle;
    } else {
      const verb = displayTitle.substring(0, firstSpaceIndex);
      const rest = displayTitle.substring(firstSpaceIndex);
      const verbSpan = $("span");
      verbSpan.textContent = verb;
      labelElement.appendChild(verbSpan);
      const restSpan = $("span.chat-thinking-title-detail-text");
      restSpan.textContent = rest;
      labelElement.appendChild(restSpan);
    }
    if (this.diffStatsByPartId.size > 0) {
      const { added, removed } = this._aggregatedDiff;
      if (added > 0 || removed > 0) {
        const diffContainer = $("span.chat-thinking-title-diff");
        diffContainer.appendChild($("span.label-added", {}, `+${added}`));
        diffContainer.appendChild($("span.label-removed", {}, `-${removed}`));
        labelElement.appendChild(diffContainer);
        const insertionsFragment = added === 1 ? localize("chat.thinking.insertions.one", "1 insertion") : localize("chat.thinking.insertions", "{0} insertions", added);
        const deletionsFragment = removed === 1 ? localize("chat.thinking.deletions.one", "1 deletion") : localize("chat.thinking.deletions", "{0} deletions", removed);
        this.setAriaLabel(localize("chat.thinking.titleWithDiff", "{0}, {1}, {2}", displayTitle, insertionsFragment, deletionsFragment));
      } else {
        this.setAriaLabel(displayTitle);
      }
    } else {
      this.setAriaLabel(displayTitle);
    }
  }
  getFinalizedDisplayTitle(title) {
    if (this.thinkingDisplayMode !== ThinkingDisplayMode.Collapsed || !this.containsReasoning || this.containsGroupedItems || !this.reasoningDurationMs) {
      return title;
    }
    const seconds = Math.ceil(this.reasoningDurationMs / 1e3);
    const duration = localize("chat.thinking.duration.seconds", "{0}s", seconds);
    return localize("chat.thinking.titleWithDuration", "{0} - {1}", title, duration);
  }
  hasReasoningContent() {
    return this.containsReasoning;
  }
  hasGroupedItems() {
    return this.containsGroupedItems;
  }
  recordReasoningContent(content) {
    if (!content.trim()) {
      return;
    }
    this.containsReasoning = true;
  }
  setDropdownClickable(clickable) {
    if (this._collapseButton) {
      this._collapseButton.element.style.pointerEvents = clickable ? "auto" : "none";
    }
    if (!clickable && this.streamingCompleted) {
      this.setFinalizedTitle(this.lastExtractedTitle ?? this.currentTitle);
    }
  }
  shouldAllowExpansion() {
    if (this.toolInvocationCount > 0 || this.lazyItems.length > 0) {
      return true;
    }
    if (this.wrapper) {
      const meaningfulChildren = Array.from(this.wrapper.children).filter((child) => child !== this.workingSpinnerElement).length;
      if (meaningfulChildren > 1) {
        return true;
      }
    }
    const contentWithoutTitle = this.currentThinkingValue.trim();
    const titleToCompare = this.lastExtractedTitle ?? this.currentTitle;
    const stripMarkdown = (text) => {
      return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1").trim();
    };
    const strippedContent = stripMarkdown(contentWithoutTitle);
    return !(!strippedContent || strippedContent === titleToCompare);
  }
  updateDropdownClickability(knownContentHeight) {
    let allowExpansion = this.shouldAllowExpansion();
    if (allowExpansion && this.fixedScrollingMode && !this.streamingCompleted && !this.element.isComplete && this.wrapper) {
      const contentHeight = knownContentHeight ?? this.lastKnownContentHeight;
      if (!contentHeight || contentHeight <= THINKING_SCROLL_MAX_HEIGHT) {
        allowExpansion = false;
      }
    }
    if (!allowExpansion && this.isExpanded() && (this.streamingCompleted || this.element.isComplete)) {
      this.setExpanded(false);
    }
    this.setDropdownClickable(allowExpansion);
  }
  appendToWrapper(element) {
    if (!this.wrapper) {
      return;
    }
    if (this.workingSpinnerElement && this.workingSpinnerElement.parentNode === this.wrapper) {
      this.wrapper.insertBefore(element, this.workingSpinnerElement);
    } else {
      this.wrapper.appendChild(element);
    }
  }
  updateWorkingSpinnerVisibility(reader) {
    if (!this.wrapper || !this.workingSpinnerElement) {
      return;
    }
    const hasRunningTerminalTool = this.toolInvocations.some((toolInvocation) => {
      const terminalData = toolInvocation.toolSpecificData;
      if (terminalData?.kind !== "terminal" || terminalData.terminalCommandState?.exitCode !== void 0) {
        return false;
      }
      return !IChatToolInvocation.isComplete(toolInvocation, reader);
    });
    const isAttached = this.workingSpinnerElement.parentNode === this.wrapper;
    if (hasRunningTerminalTool && isAttached) {
      this.workingSpinnerElement.remove();
      this._onDidChangeHeight.fire();
    } else if (!hasRunningTerminalTool && !isAttached && !this.streamingCompleted && !this.element.isComplete) {
      this.wrapper.appendChild(this.workingSpinnerElement);
      this._onDidChangeHeight.fire();
    }
  }
  resetId() {
    this.id = void 0;
  }
  collapseContent() {
    this.setExpanded(false);
  }
  updateThinking(content) {
    if (this._store.isDisposed) {
      return;
    }
    this.content = content;
    this.reasoningDurationMs = content.reasoningDurationMs;
    for (const lazyItem of this.lazyItems) {
      if (lazyItem.kind === "thinking" && lazyItem.content.id === content.id) {
        lazyItem.content = content;
        break;
      }
    }
    const raw = extractTextFromPart(content);
    this.recordReasoningContent(raw);
    const next = raw;
    if (next === this.currentThinkingValue) {
      return;
    }
    const previousValue = this.currentThinkingValue;
    const reuseExisting = !!(this._markdownResult.value && next.startsWith(previousValue) && next.length > previousValue.length);
    this.currentThinkingValue = next;
    this.renderMarkdown(next, reuseExisting);
    if (this.fixedScrollingMode && this.scrollableElement) {
      this.refreshContentHeight();
      this.updateScrollDimensionsFromCache();
    }
    const extractedTitle = extractTitleFromThinkingContent(raw);
    if (extractedTitle && extractedTitle !== this.currentTitle) {
      if (!this.extractedTitles.includes(extractedTitle)) {
        this.extractedTitles.push(extractedTitle);
      }
      this.lastExtractedTitle = extractedTitle;
    }
    if (!extractedTitle || extractedTitle === this.currentTitle) {
      return;
    }
    const label = this.lastExtractedTitle ?? "";
    if (!this.fixedScrollingMode && !this._isExpanded.get()) {
      this.setTitle(label);
    }
    this.updateDropdownClickability();
  }
  getIsActive() {
    return this.isActive;
  }
  /**
   * Returns true when this thinking part has no meaningful content to display:
   * no tool invocations, no lazy items, no hooks, and no thinking text.
   * This happens when a tool is removed from thinking (e.g. due to confirmation)
   * and the thinking part was only created to hold that tool.
   */
  isEffectivelyEmpty() {
    this.processPendingRemovals();
    if (this.toolInvocationCount > 0 || this.lazyItems.length > 0 || this.hookCount > 0) {
      return false;
    }
    if (this.currentThinkingValue.trim().length > 0) {
      return false;
    }
    return true;
  }
  markAsInactive() {
    this.isActive = false;
    this.domNode.classList.remove("chat-thinking-active");
    this.domNode.classList.remove("chat-thinking-fade-top", "chat-thinking-fade-bottom");
    this.processPendingRemovals();
    if (this.workingSpinnerElement) {
      this.workingSpinnerElement.remove();
      this.workingSpinnerElement = void 0;
      this.workingSpinnerLabel = void 0;
    }
    for (const toolInvocation of this.toolInvocations) {
      toolInvocation.isAttachedToThinking = false;
    }
  }
  finalizeTitleIfDefault() {
    this.processPendingRemovals();
    if (this.wrapper) {
      this.wrapper.classList.remove("chat-thinking-streaming");
    }
    this.domNode.classList.remove("chat-thinking-active");
    this.domNode.classList.remove("chat-thinking-fade-top", "chat-thinking-fade-bottom");
    this.streamingCompleted = true;
    this.setContentAnimationEnabled(!this.fixedScrollingMode);
    this.flushPendingExternalResources();
    if (this.workingSpinnerElement) {
      this.workingSpinnerElement.remove();
      this.workingSpinnerElement = void 0;
      this.workingSpinnerLabel = void 0;
    }
    if (this._collapseButton) {
      this._collapseButton.icon = Codicon.check;
    }
    this.updateScrollDimensionsForCompletion();
    this.updateDropdownClickability();
    if (this.content.generatedTitle) {
      this.currentTitle = this.content.generatedTitle;
      this.setGeneratedTitleOnAllParts(this.content.generatedTitle);
      this.setFinalizedTitle(this.content.generatedTitle);
      return;
    }
    const existingTitle = this.toolInvocations.find((t) => t.generatedTitle)?.generatedTitle ?? this.allThinkingParts.find((t) => t.generatedTitle)?.generatedTitle;
    if (existingTitle) {
      this.currentTitle = existingTitle;
      this.content.generatedTitle = existingTitle;
      this.setGeneratedTitleOnAllParts(existingTitle);
      this.setFinalizedTitle(existingTitle);
      return;
    }
    const allToolsSerialized = this.toolInvocations.every((t) => t.kind === "toolInvocationSerialized");
    if (allToolsSerialized && !LocalChatSessionUri.isLocalSession(this.element.sessionResource)) {
      const cacheId = this.getTitleCacheId();
      if (cacheId) {
        const cachedTitle = this.getCachedTitle(cacheId);
        if (cachedTitle) {
          this.currentTitle = cachedTitle;
          this.content.generatedTitle = cachedTitle;
          this.setGeneratedTitleOnAllParts(cachedTitle);
          this.setFinalizedTitle(cachedTitle);
          return;
        }
      }
    }
    if (this.toolInvocationCount === 1 && this.hookCount === 0 && this.currentThinkingValue.trim() === "") {
      if (!this.singleItemInfo) {
        const lazyItem = this.lazyItems.find((item) => item.kind === "tool" && item.originalParent);
        if (lazyItem && lazyItem.kind === "tool") {
          const toolInvocation = lazyItem.toolInvocationOrMarkdown && (lazyItem.toolInvocationOrMarkdown.kind === "toolInvocation" || lazyItem.toolInvocationOrMarkdown.kind === "toolInvocationSerialized") ? lazyItem.toolInvocationOrMarkdown : void 0;
          const result = lazyItem.lazy.value;
          this.appendItemToDOM(result.domNode, lazyItem.toolInvocationId, lazyItem.toolInvocationOrMarkdown, lazyItem.originalParent);
          if (result.disposable) {
            const toolCallId = toolInvocation?.toolCallId;
            if (toolCallId) {
              this.ownedToolParts.set(toolCallId, result.disposable);
            } else {
              this._register(result.disposable);
            }
          }
        }
      }
      if (this.singleItemInfo && this.restoreSingleItemToOriginalPosition()) {
        return;
      }
    }
    if (this.extractedTitles.length === 1 && this.toolInvocationCount === 0) {
      const title = this.extractedTitles[0];
      this.currentTitle = title;
      this.content.generatedTitle = title;
      this.setGeneratedTitleOnAllParts(title);
      this.setFinalizedTitle(title);
      return;
    }
    const generateTitles = this.configurationService.getValue(ChatConfiguration.ThinkingGenerateTitles) ?? true;
    if (!generateTitles) {
      this.setFallbackTitle();
      return;
    }
    this.generateTitleViaLLM();
  }
  setGeneratedTitleOnAllParts(title) {
    for (const toolInvocation of this.toolInvocations) {
      toolInvocation.generatedTitle = title;
    }
    for (const thinkingPart of this.allThinkingParts) {
      thinkingPart.generatedTitle = title;
    }
  }
  loadTitleCache() {
    return this.storageService.getObject(TITLE_CACHE_STORAGE_KEY, StorageScope.PROFILE) ?? {};
  }
  saveTitleCache(cache) {
    if (Object.keys(cache).length === 0) {
      this.storageService.remove(TITLE_CACHE_STORAGE_KEY, StorageScope.PROFILE);
    } else {
      this.storageService.store(TITLE_CACHE_STORAGE_KEY, JSON.stringify(cache), StorageScope.PROFILE, StorageTarget.MACHINE);
    }
  }
  getTitleCacheKey(id) {
    return `${chatSessionResourceToId(this.element.sessionResource)}:${id}`;
  }
  /**
   * Stable id used to persist/restore the generated title. Tool-based blocks
   * key off the last tool call id; reasoning-only blocks fall back to the
   * thinking part id so their headers also survive a session reload.
   */
  getTitleCacheId() {
    const lastTool = this.toolInvocations[this.toolInvocations.length - 1];
    if (lastTool) {
      return lastTool.toolCallId;
    }
    return this.allThinkingParts.find((t) => t.id)?.id ?? this.content.id;
  }
  getCachedTitle(id) {
    const entry = this.loadTitleCache()[this.getTitleCacheKey(id)];
    if (!entry || Date.now() - entry.storedAt > TITLE_CACHE_TTL_MS) {
      return void 0;
    }
    return entry.title;
  }
  setCachedTitle(id, title) {
    const cache = this.loadTitleCache();
    const now = Date.now();
    for (const key of Object.keys(cache)) {
      if (now - cache[key].storedAt > TITLE_CACHE_TTL_MS) {
        delete cache[key];
      }
    }
    cache[this.getTitleCacheKey(id)] = { title, storedAt: now };
    const keys = Object.keys(cache);
    if (keys.length > TITLE_CACHE_MAX_ENTRIES) {
      const sorted = keys.sort((a, b) => cache[a].storedAt - cache[b].storedAt);
      for (let i = 0; i < sorted.length - TITLE_CACHE_MAX_ENTRIES; i++) {
        delete cache[sorted[i]];
      }
    }
    this.saveTitleCache(cache);
  }
  async generateTitleViaLLM() {
    const cts = new CancellationTokenSource();
    const timeout = setTimeout(() => cts.cancel(), 5e3);
    try {
      const models = await this.languageModelsService.selectLanguageModels({ vendor: "copilot", id: "copilot-utility-small" });
      if (!models.length) {
        this.setFallbackTitle();
        return;
      }
      if (cts.token.isCancellationRequested) {
        this.setFallbackTitle();
        return;
      }
      let context;
      if (this.extractedTitles.length > 0) {
        context = this.extractedTitles.join(", ");
      } else {
        context = this.currentThinkingValue.substring(0, 1e3);
      }
      const prompt = `Summarize the following content in a SINGLE sentence (under 10 words) using past tense. Follow these rules strictly:

			OUTPUT FORMAT:
			- MUST be a single sentence
			- MUST be under 10 words
			- The FIRST word MUST be a past tense verb (e.g. "Updated", "Reviewed", "Created", "Searched", "Analyzed")
			- No quotes, no trailing punctuation

			GENERAL:
			- The content may include tool invocations (file edits, reads, searches, terminal commands), reasoning headers, or raw thinking text
			- For reasoning headers or thinking text (no tool calls), summarize WHAT was considered/analyzed, NOT that thinking occurred
			- For thinking-only summaries, use phrases like: "Considered...", "Planned...", "Analyzed...", "Reviewed..."

			TOOL NAME FILTERING:
			- NEVER include tool names like "Replace String in File", "Multi Replace String in File", "Create File", "Read File", etc. in the output
			- If an action says "Edited X and used Replace String in File", output ONLY the action on X
			- Tool names describe HOW something was done, not WHAT was done - always omit them

			VOCABULARY - Use varied synonyms for natural-sounding summaries:
			- For edits: "Updated", "Modified", "Changed", "Refactored", "Fixed", "Adjusted"
			- For reads: "Reviewed", "Examined", "Checked", "Inspected", "Analyzed", "Explored"
			- For creates: "Created", "Added", "Generated"
			- For searches: "Searched for", "Looked up", "Investigated"
			- For terminal: "Ran command", "Executed"
			- For reasoning/thinking: "Considered", "Planned", "Analyzed", "Reviewed", "Evaluated"
			- Choose the synonym that best fits the context

${this.hookCount > 0 ? `BLOCKED/DENIED CONTENT (hooks detected):
			- Only mention "blocked" if the content explicitly includes hook results that blocked or warned about a tool (e.g. "Blocked terminal" or "Warning for read_file")
			- If blocked items are present alongside normal tool calls, briefly note the block but do NOT let it dominate the summary: e.g. "Updated file.ts, blocked terminal"

			` : `IMPORTANT: Do NOT use words like "blocked", "denied", or "tried" in the summary - there are no hooks or blocked items in this content. Just summarize normally.

			`}RULES FOR TOOL CALLS:
			1. If the SAME file was both edited AND read: Use a combined phrase like "Reviewed and updated <filename>"
			2. If exactly ONE file was edited: Start with an edit synonym + "<filename>" (include actual filename)
			3. If exactly ONE file was read: Start with a read synonym + "<filename>" (include actual filename)
			4. If MULTIPLE files were edited: Start with an edit synonym + "X files"
			5. If MULTIPLE files were read: Start with a read synonym + "X files"
			6. If BOTH edits AND reads occurred on DIFFERENT files: Combine them naturally
			7. For searches: Say "searched for <term>" or "looked up <term>" with the actual search term, NOT "searched for files"
			8. After the file info, you may add a brief summary of other actions if space permits
			9. NEVER say "1 file" - always use the actual filename when there's only one file

			RULES FOR REASONING HEADERS (no tool calls):
			1. If the input contains reasoning/analysis headers without actual tool invocations, summarize the main topic and what was considered
			2. Use past tense verbs that indicate thinking, not doing: "Considered", "Planned", "Analyzed", "Evaluated"
			3. Focus on WHAT was being thought about, not that thinking occurred

			RULES FOR RAW THINKING TEXT:
			1. Extract the main topic or question being considered from the text
			2. Identify any specific files, functions, or concepts mentioned
			3. Summarize as "Analyzed <topic>" or "Considered <specific thing>"
			4. If discussing code structure: "Reviewed <component/architecture>"
			5. If discussing a problem: "Analyzed <problem description>"
			6. If discussing implementation: "Planned <feature/change>"

			EXAMPLES WITH TOOLS:
			- "Read HomePage.tsx, Edited HomePage.tsx" \u2192 "Reviewed and updated HomePage.tsx"
			- "Edited HomePage.tsx" \u2192 "Updated HomePage.tsx"
			- "Edited config.css and used Replace String in File" \u2192 "Modified config.css"
			- "Edited App.tsx, used Multi Replace String in File" \u2192 "Refactored App.tsx"
			- "Read config.json, Read package.json" \u2192 "Reviewed 2 files"
			- "Edited App.tsx, Read utils.ts" \u2192 "Updated App.tsx and checked utils.ts"
			- "Edited App.tsx, Read utils.ts, Read types.ts" \u2192 "Updated App.tsx and reviewed 2 files"
			- "Edited index.ts, Edited styles.css, Ran terminal command" \u2192 "Modified 2 files and ran command"
			- "Read README.md, Searched for AuthService" \u2192 "Checked README.md and searched for AuthService"
			- "Searched for login, Searched for authentication" \u2192 "Searched for login and authentication"
			- "Edited api.ts, Edited models.ts, Read schema.json" \u2192 "Updated 2 files and reviewed schema.json"
			- "Edited Button.tsx, Edited Button.css, Edited index.ts" \u2192 "Modified 3 files"
			- "Searched codebase for error handling" \u2192 "Looked up error handling"

${this.hookCount > 0 ? `EXAMPLES WITH BLOCKED CONTENT (from hooks):
			- "Blocked terminal, Edited config.ts" \u2192 "Edited config.ts, terminal was blocked"
			- "Blocked terminal, Blocked read_file" \u2192 "Two tools were blocked by hooks"
			- "Warning for read_file, Edited utils.ts" \u2192 "Edited utils.ts with a hook warning"

			` : ""}EXAMPLES WITH REASONING HEADERS (no tools):
			- "Analyzing component architecture" \u2192 "Considered component architecture"
			- "Planning refactor strategy" \u2192 "Planned refactor strategy"
			- "Reviewing error handling approach, Considering edge cases" \u2192 "Analyzed error handling approach"
			- "Understanding the codebase structure" \u2192 "Reviewed codebase structure"
			- "Thinking about implementation options" \u2192 "Considered implementation options"

			EXAMPLES WITH RAW THINKING TEXT:
			- "I need to understand how the authentication flow works in this app..." \u2192 "Analyzed authentication flow"
			- "Let me think about how to refactor this component to be more maintainable..." \u2192 "Planned component refactoring"
			- "The error seems to be coming from the database connection..." \u2192 "Investigated database connection issue"
			- "Looking at the UserService class, I see it handles..." \u2192 "Reviewed UserService implementation"

			Content: ${context}`;
      const response = await this.languageModelsService.sendChatRequest(
        models[0],
        void 0,
        [{ role: ChatMessageRole.User, content: [{ type: "text", value: prompt }] }],
        {},
        cts.token
      );
      let generatedTitle = "";
      for await (const part of response.stream) {
        if (cts.token.isCancellationRequested) {
          break;
        }
        if (Array.isArray(part)) {
          for (const p of part) {
            if (p.type === "text") {
              generatedTitle += p.value;
            }
          }
        } else if (part.type === "text") {
          generatedTitle += part.value;
        }
      }
      if (cts.token.isCancellationRequested) {
        this.setFallbackTitle();
        return;
      }
      await response.result;
      generatedTitle = generatedTitle.trim();
      if (generatedTitle.includes("can't assist with that")) {
        this.setFallbackTitle();
        return;
      }
      if (generatedTitle && !this._store.isDisposed) {
        this.currentTitle = generatedTitle;
        this.setFinalizedTitle(generatedTitle);
        this.content.generatedTitle = generatedTitle;
        this.setGeneratedTitleOnAllParts(generatedTitle);
        if (!LocalChatSessionUri.isLocalSession(this.element.sessionResource)) {
          const cacheId = this.getTitleCacheId();
          if (cacheId) {
            this.setCachedTitle(cacheId, generatedTitle);
          }
        }
        return;
      }
    } catch (error) {
    } finally {
      clearTimeout(timeout);
      cts.dispose();
    }
    this.setFallbackTitle();
  }
  restoreSingleItemToOriginalPosition() {
    if (!this.singleItemInfo) {
      return false;
    }
    const { element, thinkingWrapper, originalParent, originalNextSibling, restoreToOriginalParent, toolInvocation } = this.singleItemInfo;
    const hasOtherThinkingItems = this.wrapper && Array.from(this.wrapper.children).some(
      (child) => child !== thinkingWrapper && child !== this.workingSpinnerElement
    );
    if (hasOtherThinkingItems) {
      this.singleItemInfo = void 0;
      return false;
    }
    const precedingToolInvocationPart = isHTMLElement(originalNextSibling) && originalNextSibling.parentElement === originalParent ? originalNextSibling.previousElementSibling : originalParent.lastElementChild;
    if (restoreToOriginalParent) {
      if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
        originalParent.insertBefore(element, originalNextSibling);
      } else {
        originalParent.appendChild(element);
      }
    } else if (precedingToolInvocationPart?.classList.contains("chat-tool-invocation-part")) {
      precedingToolInvocationPart.appendChild(element);
    } else if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
      originalParent.insertBefore(element, originalNextSibling);
    } else {
      originalParent.appendChild(element);
    }
    thinkingWrapper.remove();
    if (toolInvocation) {
      this.toolWrappersByCallId.delete(toolInvocation.toolCallId);
      this.toolIconsByCallId.delete(toolInvocation.toolCallId);
      toolInvocation.isAttachedToThinking = false;
    }
    hide(this.domNode);
    this.singleItemInfo = void 0;
    return true;
  }
  updateAggregatedDiff() {
    let totalAdded = 0;
    let totalRemoved = 0;
    for (const stats of this.diffStatsByPartId.values()) {
      totalAdded += stats.added;
      totalRemoved += stats.removed;
    }
    this._aggregatedDiff = { added: totalAdded, removed: totalRemoved };
    if (this.streamingCompleted || this.element.isComplete) {
      this.setFinalizedTitle(this.currentTitle);
    }
  }
  setFallbackTitle() {
    const finalLabel = this.appendedItemCount > 0 ? this.appendedItemCount === 1 ? localize("chat.thinking.finished.withStepsSingular", "Finished with 1 step") : localize("chat.thinking.finished.withStepsPlural", "Finished with {0} steps", this.appendedItemCount) : localize("chat.thinking.finished", "Finished Working");
    this.currentTitle = finalLabel;
    if (this.wrapper) {
      this.wrapper.classList.remove("chat-thinking-streaming");
    }
    this.domNode.classList.remove("chat-thinking-active");
    this.streamingCompleted = true;
    this.flushPendingExternalResources();
    if (this._collapseButton) {
      this._collapseButton.icon = Codicon.check;
      this.setFinalizedTitle(finalLabel);
    }
    this.updateDropdownClickability();
  }
  /**
   * Appends a tool invocation or content item to the thinking group.
   * The factory is called lazily - only when the thinking section is expanded.
   * If already expanded, the factory is called immediately.
   *
   * When the caller has already created the content part eagerly (for example, a
   * pre-built `ChatMarkdownContentPart` wrapped in a factory), the caller MUST pass
   * that part as `eagerDisposable` so it is registered on this thinking part
   * immediately. Otherwise, if the thinking section is collapsed and the lazy item
   * is never materialized (because the user never expands it), the eagerly-created
   * part would leak: its disposable is only referenced from inside the factory's
   * closure, which nothing ever calls.
   */
  appendItem(factory, toolInvocationId, toolInvocationOrMarkdown, originalParent, onDidChangeDiff, eagerDisposable) {
    this.processPendingRemovals();
    this.containsGroupedItems = true;
    this.trackToolMetadata(toolInvocationId, toolInvocationOrMarkdown);
    this.updateWorkingSpinnerVisibility();
    this.appendedItemCount++;
    if (onDidChangeDiff && toolInvocationId) {
      this._register(onDidChangeDiff((stats) => {
        this.diffStatsByPartId.set(toolInvocationId, stats);
        this.updateAggregatedDiff();
      }));
    }
    if (eagerDisposable) {
      this._register(eagerDisposable);
    }
    if (this.workingSpinnerLabel) {
      const isTerminalTool = toolInvocationOrMarkdown && (toolInvocationOrMarkdown.kind === "toolInvocation" || toolInvocationOrMarkdown.kind === "toolInvocationSerialized") && toolInvocationOrMarkdown.toolSpecificData?.kind === "terminal";
      const category = isTerminalTool ? "terminal" /* Terminal */ : "tool" /* Tool */;
      this.workingSpinnerLabel.textContent = this.getRandomWorkingMessage(category);
    }
    if (this.isExpanded() || this.hasExpandedOnce || this.fixedScrollingMode && !this.streamingCompleted) {
      const result = factory();
      this.appendItemToDOM(result.domNode, toolInvocationId, toolInvocationOrMarkdown, originalParent);
      if (result.disposable) {
        const toolCallId = toolInvocationOrMarkdown && (toolInvocationOrMarkdown.kind === "toolInvocation" || toolInvocationOrMarkdown.kind === "toolInvocationSerialized") ? toolInvocationOrMarkdown.toolCallId : void 0;
        if (toolCallId) {
          this.ownedToolParts.set(toolCallId, result.disposable);
        } else {
          this._register(result.disposable);
        }
      }
    } else {
      const item = {
        kind: "tool",
        lazy: new Lazy(factory),
        toolInvocationId,
        toolInvocationOrMarkdown,
        originalParent,
        isHook: !toolInvocationOrMarkdown && !!toolInvocationId
      };
      this.lazyItems.push(item);
    }
    this.updateDropdownClickability();
  }
  removeMaterializedItem(toolCallId) {
    this.toolDisposables.deleteAndDispose(toolCallId);
    this.ownedToolParts.delete(toolCallId);
    const wrapper = this.toolWrappersByCallId.get(toolCallId);
    if (wrapper) {
      this.toolWrappersByCallId.delete(toolCallId);
      this.toolIconsByCallId.delete(toolCallId);
    }
    this.appendedItemCount = Math.max(0, this.appendedItemCount - 1);
    this.toolInvocationCount = Math.max(0, this.toolInvocationCount - 1);
    const toolInvocationsIndex = this.toolInvocations.findIndex(
      (t) => (t.kind === "toolInvocation" || t.kind === "toolInvocationSerialized") && t.toolCallId === toolCallId
    );
    if (toolInvocationsIndex !== -1) {
      const label = this.toolLabelsByCallId.get(toolCallId);
      if (label) {
        const titleIndex = this.extractedTitles.indexOf(label);
        if (titleIndex !== -1) {
          this.extractedTitles.splice(titleIndex, 1);
        }
      }
      this.toolInvocations.splice(toolInvocationsIndex, 1);
    }
    this.toolLabelsByCallId.delete(toolCallId);
    this._pendingExternalResources.delete(toolCallId);
    this._externalResourceWidget.removeToolInvocation(toolCallId);
    this.updateWorkingSpinnerVisibility();
    this.updateDropdownClickability();
    this._onDidChangeHeight.fire();
  }
  /**
   * Removes a markdown edit pill child by its part ID (codeblocksPartId).
   */
  removeEditPillByPartId(partId) {
    let removed = false;
    const lazyIndex = this.lazyItems.findIndex((item) => item.kind === "tool" && item.toolInvocationId === partId);
    if (lazyIndex !== -1) {
      this.lazyItems.splice(lazyIndex, 1);
      removed = true;
    }
    if (this.diffStatsByPartId.delete(partId)) {
      this.updateAggregatedDiff();
      removed = true;
    }
    if (removed) {
      this.appendedItemCount = Math.max(0, this.appendedItemCount - 1);
      this.updateDropdownClickability();
      this._onDidChangeHeight.fire();
    }
  }
  /**
   * removes/re-establishes a lazy item from the thinking container
   * this is needed so we can check if there are confirmations still needed
   */
  removeLazyItem(toolInvocationId) {
    const index = this.lazyItems.findIndex((item) => item.kind === "tool" && item.toolInvocationId === toolInvocationId);
    if (index === -1) {
      return false;
    }
    const removedItem = this.lazyItems[index];
    this.lazyItems.splice(index, 1);
    this.appendedItemCount--;
    if (removedItem.kind === "tool" && removedItem.isHook) {
      this.hookCount = Math.max(0, this.hookCount - 1);
    } else {
      this.toolInvocationCount--;
    }
    if (removedItem.kind === "tool" && removedItem.toolInvocationOrMarkdown && (removedItem.toolInvocationOrMarkdown.kind === "toolInvocation" || removedItem.toolInvocationOrMarkdown.kind === "toolInvocationSerialized")) {
      removedItem.toolInvocationOrMarkdown.isAttachedToThinking = false;
      const toolCallId = removedItem.toolInvocationOrMarkdown.toolCallId;
      this._pendingExternalResources.delete(toolCallId);
      this._externalResourceWidget.removeToolInvocation(toolCallId);
      const label = this.toolLabelsByCallId.get(toolCallId);
      if (label) {
        const titleIndex = this.extractedTitles.indexOf(label);
        if (titleIndex !== -1) {
          this.extractedTitles.splice(titleIndex, 1);
        }
      }
      this.toolLabelsByCallId.delete(toolCallId);
    }
    const toolInvocationsIndex = this.toolInvocations.findIndex(
      (t) => (t.kind === "toolInvocation" || t.kind === "toolInvocationSerialized") && t.toolId === toolInvocationId
    );
    if (toolInvocationsIndex !== -1) {
      this.toolInvocations.splice(toolInvocationsIndex, 1);
    }
    this.updateDropdownClickability();
    this.updateWorkingSpinnerVisibility();
    return true;
  }
  processPendingRemovals() {
    this.pendingRemovalFlushDisposable?.dispose();
    this.pendingRemovalFlushDisposable = void 0;
    if (this.pendingRemovals.length === 0) {
      return;
    }
    const pendingRemovals = this.pendingRemovals;
    this.pendingRemovals = [];
    for (const pending of pendingRemovals) {
      this.removeStreamingToolEntry(pending.toolCallId, pending.toolLabel);
    }
  }
  schedulePendingRemovalsFlush() {
    if (this.pendingRemovalFlushDisposable) {
      return;
    }
    this.pendingRemovalFlushDisposable = scheduleAtNextAnimationFrame(getWindow(this.domNode), () => {
      this.pendingRemovalFlushDisposable = void 0;
      if (this._store.isDisposed) {
        return;
      }
      this.processPendingRemovals();
    });
  }
  // removes the tool entry that was previously streaming and now is not. removes item from dom and internal tracking.
  removeStreamingToolEntry(toolCallId, toolLabel) {
    this.toolDisposables.deleteAndDispose(toolCallId);
    this.ownedToolParts.get(toolCallId)?.dispose();
    this.ownedToolParts.delete(toolCallId);
    const wrapper = this.toolWrappersByCallId.get(toolCallId);
    if (wrapper) {
      wrapper.remove();
      this.toolWrappersByCallId.delete(toolCallId);
      this.toolIconsByCallId.delete(toolCallId);
    }
    const lazyIndex = this.lazyItems.findIndex(
      (item) => item.kind === "tool" && item.toolInvocationOrMarkdown && (item.toolInvocationOrMarkdown.kind === "toolInvocation" || item.toolInvocationOrMarkdown.kind === "toolInvocationSerialized") && item.toolInvocationOrMarkdown.toolCallId === toolCallId
    );
    if (lazyIndex !== -1) {
      const removedLazyItem = this.lazyItems[lazyIndex];
      if (removedLazyItem.kind === "tool" && removedLazyItem.toolInvocationOrMarkdown && (removedLazyItem.toolInvocationOrMarkdown.kind === "toolInvocation" || removedLazyItem.toolInvocationOrMarkdown.kind === "toolInvocationSerialized")) {
        removedLazyItem.toolInvocationOrMarkdown.isAttachedToThinking = false;
      }
      this.lazyItems.splice(lazyIndex, 1);
    }
    this.appendedItemCount = Math.max(0, this.appendedItemCount - 1);
    this.toolInvocationCount = Math.max(0, this.toolInvocationCount - 1);
    const toolInvocationsIndex = this.toolInvocations.findIndex(
      (t) => (t.kind === "toolInvocation" || t.kind === "toolInvocationSerialized") && t.toolCallId === toolCallId
    );
    if (toolInvocationsIndex !== -1) {
      this.toolInvocations.splice(toolInvocationsIndex, 1);
    }
    const titleIndex = this.extractedTitles.indexOf(toolLabel);
    if (titleIndex !== -1) {
      this.extractedTitles.splice(titleIndex, 1);
    }
    this.toolLabelsByCallId.delete(toolCallId);
    this._pendingExternalResources.delete(toolCallId);
    this._externalResourceWidget.removeToolInvocation(toolCallId);
    this.updateWorkingSpinnerVisibility();
    this.updateDropdownClickability();
    this._onDidChangeHeight.fire();
  }
  trackToolMetadata(toolInvocationId, toolInvocationOrMarkdown) {
    if (!toolInvocationId) {
      return;
    }
    const isHook = !toolInvocationOrMarkdown;
    if (isHook) {
      this.hookCount++;
    } else {
      this.toolInvocationCount++;
    }
    if (this.toolInvocationCount === 1) {
      this.defaultTitle = this.workingTitle;
    }
    let toolCallLabel;
    const isToolInvocation = toolInvocationOrMarkdown && (toolInvocationOrMarkdown.kind === "toolInvocation" || toolInvocationOrMarkdown.kind === "toolInvocationSerialized");
    if (isToolInvocation && toolInvocationOrMarkdown.invocationMessage) {
      const message = typeof toolInvocationOrMarkdown.invocationMessage === "string" ? toolInvocationOrMarkdown.invocationMessage : toolInvocationOrMarkdown.invocationMessage.value;
      const isStreamingEditTool = toolInvocationOrMarkdown.kind === "toolInvocation" && IChatToolInvocation.isStreaming(toolInvocationOrMarkdown) && isGenericEditToolId(toolInvocationOrMarkdown.toolId);
      if (isStreamingEditTool) {
        toolCallLabel = localize("chat.thinking.editingFiles", "Editing files");
      } else {
        toolCallLabel = message;
      }
      this.toolInvocations.push(toolInvocationOrMarkdown);
      const toolCallId = toolInvocationOrMarkdown.toolCallId;
      this.toolLabelsByCallId.set(toolCallId, toolCallLabel);
      if (toolInvocationOrMarkdown.kind === "toolInvocationSerialized") {
        this.updateExternalResourceParts(toolInvocationOrMarkdown);
        if (IChatToolInvocation.isEffectivelyHidden(toolInvocationOrMarkdown)) {
          this.pendingRemovals.push({ toolCallId: toolInvocationOrMarkdown.toolCallId, toolLabel: toolCallLabel });
          this.schedulePendingRemovalsFlush();
        }
      }
      if (toolInvocationOrMarkdown.kind === "toolInvocation") {
        let currentToolLabel = toolCallLabel;
        let isComplete = false;
        let isStreaming = IChatToolInvocation.isStreaming(toolInvocationOrMarkdown);
        const toolStore = new DisposableStore();
        this.toolDisposables.set(toolInvocationOrMarkdown.toolCallId, toolStore);
        const updateTitle = (updatedMessage) => {
          if (updatedMessage && updatedMessage !== currentToolLabel) {
            const oldIndex = this.extractedTitles.indexOf(currentToolLabel);
            const updatedIndex = this.extractedTitles.indexOf(updatedMessage);
            if (oldIndex !== -1) {
              if (updatedIndex !== -1 && updatedIndex !== oldIndex) {
                this.extractedTitles.splice(oldIndex, 1);
              } else {
                this.extractedTitles[oldIndex] = updatedMessage;
              }
            } else if (updatedIndex === -1) {
              this.extractedTitles.push(updatedMessage);
            }
            currentToolLabel = updatedMessage;
            this.toolLabelsByCallId.set(toolCallId, updatedMessage);
            this.lastExtractedTitle = updatedMessage;
            if (!this.fixedScrollingMode && !this._isExpanded.read(void 0)) {
              this.setTitle(updatedMessage);
            }
          }
        };
        const autorunDisposable = autorun((reader) => {
          if (isComplete) {
            return;
          }
          const currentState = toolInvocationOrMarkdown.state.read(reader);
          this.updateWorkingSpinnerVisibility(reader);
          if (isStreaming && currentState.type !== IChatToolInvocation.StateKind.Streaming) {
            isStreaming = false;
            const termData = toolInvocationOrMarkdown.toolSpecificData;
            if (termData?.kind === "terminal") {
              const iconEl = this.toolIconsByCallId.get(toolCallId);
              if (iconEl) {
                const newIcon = termData.commandLine?.isSandboxWrapped ? Codicon.terminalSecure : Codicon.terminal;
                setThinkingIcon(iconEl, newIcon);
              }
            }
            if (toolInvocationOrMarkdown.presentation === "hidden") {
              this.pendingRemovals.push({ toolCallId: toolInvocationOrMarkdown.toolCallId, toolLabel: currentToolLabel });
              this.schedulePendingRemovalsFlush();
              isComplete = true;
              return;
            }
          }
          if (currentState.type === IChatToolInvocation.StateKind.Completed || currentState.type === IChatToolInvocation.StateKind.Cancelled) {
            if (toolInvocationOrMarkdown.presentation === "hidden" || toolInvocationOrMarkdown.presentation === "hiddenAfterComplete") {
              this.pendingRemovals.push({ toolCallId: toolInvocationOrMarkdown.toolCallId, toolLabel: currentToolLabel });
              this.schedulePendingRemovalsFlush();
            }
            if (currentState.type === IChatToolInvocation.StateKind.Completed) {
              this.updateExternalResourceParts(toolInvocationOrMarkdown);
              const completedMessage = toolInvocationOrMarkdown.pastTenseMessage ?? toolInvocationOrMarkdown.invocationMessage;
              const completedText = typeof completedMessage === "string" ? completedMessage : completedMessage.value;
              const iconElement = this.toolIconsByCallId.get(toolCallId);
              if (iconElement && isNoProblemsFoundResult(toolInvocationOrMarkdown.toolId, completedText)) {
                setThinkingIcon(iconElement, Codicon.search);
              }
            }
            isComplete = true;
            return;
          }
          if (currentState.type === IChatToolInvocation.StateKind.Streaming) {
            isStreaming = true;
            const streamingMessage = currentState.streamingMessage.read(reader);
            if (streamingMessage) {
              const updatedMessage = typeof streamingMessage === "string" ? streamingMessage : streamingMessage.value;
              updateTitle(updatedMessage);
            }
            return;
          }
          if (currentState.type === IChatToolInvocation.StateKind.Executing) {
            const progressData = currentState.progress.read(reader);
            if (progressData.message) {
              const updatedMessage = typeof progressData.message === "string" ? progressData.message : progressData.message.value;
              updateTitle(updatedMessage);
            } else {
              const invocationMsg2 = toolInvocationOrMarkdown.invocationMessage;
              if (invocationMsg2) {
                const updatedMessage = typeof invocationMsg2 === "string" ? invocationMsg2 : invocationMsg2.value;
                updateTitle(updatedMessage);
              }
            }
            return;
          }
          const invocationMsg = toolInvocationOrMarkdown.invocationMessage;
          if (invocationMsg) {
            const updatedMessage = typeof invocationMsg === "string" ? invocationMsg : invocationMsg.value;
            updateTitle(updatedMessage);
          }
        });
        toolStore.add(autorunDisposable);
      }
    } else if (toolInvocationOrMarkdown?.kind === "markdownContent") {
      const codeblockInfo = extractCodeblockUrisFromText(toolInvocationOrMarkdown.content.value);
      if (codeblockInfo?.uri) {
        const filename = basename(codeblockInfo.uri);
        toolCallLabel = localize("chat.thinking.editedFile", "Edited {0}", filename);
      } else {
        toolCallLabel = localize("chat.thinking.editingFile", "Edited file");
      }
    } else if (toolInvocationOrMarkdown?.kind === "externalEdit") {
      const filename = basename(toolInvocationOrMarkdown.uri);
      switch (toolInvocationOrMarkdown.editKind) {
        case "create":
          toolCallLabel = localize("chat.thinking.createdFile", "Created {0}", filename);
          break;
        case "delete":
          toolCallLabel = localize("chat.thinking.deletedFile", "Deleted {0}", filename);
          break;
        case "rename":
          toolCallLabel = localize("chat.thinking.renamedFile", "Renamed {0}", filename);
          break;
        case "edit":
          toolCallLabel = localize("chat.thinking.editedFile", "Edited {0}", filename);
          break;
      }
    } else {
      toolCallLabel = toolInvocationId;
    }
    if (!this.extractedTitles.includes(toolCallLabel)) {
      this.extractedTitles.push(toolCallLabel);
    }
    this.lastExtractedTitle = toolCallLabel;
    if (!this.fixedScrollingMode && !this._isExpanded.get()) {
      this.setTitle(toolCallLabel);
    }
  }
  updateExternalResourceParts(toolInvocation) {
    if (this.fixedScrollingMode && !this.streamingCompleted && !this.element.isComplete) {
      this._pendingExternalResources.set(toolInvocation.toolCallId, toolInvocation);
      return;
    }
    const extractedImages = extractImagesFromToolInvocationOutputDetails(toolInvocation, this.element.sessionResource);
    if (extractedImages.length === 0) {
      return;
    }
    const parts = extractedImages.map((image) => ({
      kind: "data",
      value: image.data.buffer,
      mimeType: image.mimeType,
      uri: image.uri
    }));
    this._externalResourceWidget.setToolInvocationParts(toolInvocation.toolCallId, parts);
  }
  flushPendingExternalResources() {
    if (this._pendingExternalResources.size === 0) {
      return;
    }
    const pending = Array.from(this._pendingExternalResources.values());
    this._pendingExternalResources.clear();
    for (const toolInvocation of pending) {
      this.updateExternalResourceParts(toolInvocation);
    }
  }
  appendItemToDOM(content, toolInvocationId, toolInvocationOrMarkdown, originalParent) {
    if (!content.hasChildNodes() || content.textContent?.trim() === "") {
      return;
    }
    const itemWrapper = $(".chat-thinking-tool-wrapper");
    const isMarkdownEdit = toolInvocationOrMarkdown?.kind === "markdownContent";
    const isExternalEdit = toolInvocationOrMarkdown?.kind === "externalEdit";
    const isTerminalTool = toolInvocationOrMarkdown && (toolInvocationOrMarkdown.kind === "toolInvocation" || toolInvocationOrMarkdown.kind === "toolInvocationSerialized") && toolInvocationOrMarkdown.toolSpecificData?.kind === "terminal";
    const isSearchTool = toolInvocationOrMarkdown && (toolInvocationOrMarkdown.kind === "toolInvocation" || toolInvocationOrMarkdown.kind === "toolInvocationSerialized") && toolInvocationOrMarkdown.toolSpecificData?.kind === "search";
    const toolInvocationIcon = toolInvocationOrMarkdown && (toolInvocationOrMarkdown.kind === "toolInvocation" || toolInvocationOrMarkdown.kind === "toolInvocationSerialized") ? toolInvocationOrMarkdown.icon : void 0;
    let icon;
    if (isNoProblemsFoundResult(toolInvocationId, content.textContent ?? void 0)) {
      icon = Codicon.search;
    } else if (isMarkdownEdit || isExternalEdit) {
      icon = Codicon.pencil;
    } else if (isSearchTool) {
      icon = Codicon.search;
    } else if (isTerminalTool) {
      const terminalData = toolInvocationOrMarkdown.toolSpecificData;
      const exitCode = terminalData?.terminalCommandState?.exitCode;
      const isSandboxWrapped = terminalData?.commandLine?.isSandboxWrapped;
      if (exitCode !== void 0 && exitCode !== 0) {
        icon = Codicon.error;
      } else if (isSandboxWrapped) {
        icon = Codicon.terminalSecure;
      } else {
        icon = toolInvocationIcon ?? Codicon.terminal;
      }
    } else if (content.classList.contains("chat-hook-outcome-blocked")) {
      icon = Codicon.error;
    } else if (content.classList.contains("chat-hook-outcome-warning")) {
      icon = Codicon.warning;
    } else {
      icon = toolInvocationId ? getToolInvocationIcon(toolInvocationId, toolInvocationIcon, content.textContent ?? void 0) : Codicon.tools;
    }
    const iconElement = createThinkingIcon(icon);
    itemWrapper.appendChild(iconElement);
    itemWrapper.appendChild(content);
    if (this.toolInvocationCount === 1 && this.hookCount === 0 && originalParent) {
      const toolInvocation = toolInvocationOrMarkdown && (toolInvocationOrMarkdown.kind === "toolInvocation" || toolInvocationOrMarkdown.kind === "toolInvocationSerialized") ? toolInvocationOrMarkdown : void 0;
      this.singleItemInfo = {
        element: content,
        thinkingWrapper: itemWrapper,
        originalParent,
        originalNextSibling: this.domNode,
        restoreToOriginalParent: !!toolInvocation || isExternalEdit,
        toolInvocation
      };
    } else {
      this.singleItemInfo = void 0;
    }
    const isToolInvocation = toolInvocationOrMarkdown && (toolInvocationOrMarkdown.kind === "toolInvocation" || toolInvocationOrMarkdown.kind === "toolInvocationSerialized");
    if (isToolInvocation && toolInvocationOrMarkdown.toolCallId) {
      this.toolWrappersByCallId.set(toolInvocationOrMarkdown.toolCallId, itemWrapper);
      this.toolIconsByCallId.set(toolInvocationOrMarkdown.toolCallId, iconElement);
    }
    this.appendToWrapper(itemWrapper);
    if (this.fixedScrollingMode && this.scrollableElement) {
      if (this.childResizeObserver && !this.streamingCompleted) {
        const observeDisposable = this.childResizeObserver.observe(itemWrapper);
        const toolCallId = isToolInvocation ? toolInvocationOrMarkdown.toolCallId : void 0;
        if (toolCallId) {
          let store = this.toolDisposables.get(toolCallId);
          if (!store) {
            store = new DisposableStore();
            this.toolDisposables.set(toolCallId, store);
          }
          store.add(observeDisposable);
        } else {
          this._register(observeDisposable);
        }
      }
      this.scheduleAppendRefresh();
    }
  }
  scheduleAppendRefresh() {
    if (this._pendingAppendRefresh.value) {
      return;
    }
    this._pendingAppendRefresh.value = scheduleAtNextAnimationFrame(getWindow(this.wrapper), () => {
      this._pendingAppendRefresh.clear();
      if (this._store.isDisposed) {
        return;
      }
      this.refreshContentHeight();
      this.updateScrollDimensionsFromCache();
    });
  }
  materializeLazyItem(item) {
    if (item.kind === "thinking") {
      this.appendToWrapper(item.textContainer);
      this.textContainer = item.textContainer;
      this.id = item.content.id;
      this.updateThinking(item.content);
      return;
    }
    if (this.workingSpinnerLabel) {
      const isTerminalTool = item.toolInvocationOrMarkdown && (item.toolInvocationOrMarkdown.kind === "toolInvocation" || item.toolInvocationOrMarkdown.kind === "toolInvocationSerialized") && item.toolInvocationOrMarkdown.toolSpecificData?.kind === "terminal";
      const category = isTerminalTool ? "terminal" /* Terminal */ : "tool" /* Tool */;
      this.workingSpinnerLabel.textContent = this.getRandomWorkingMessage(category);
    }
    if (item.lazy.hasValue) {
      const result2 = item.lazy.value;
      if (!result2.domNode.parentElement) {
        this.appendItemToDOM(result2.domNode, item.toolInvocationId, item.toolInvocationOrMarkdown, item.originalParent);
      }
      return;
    }
    const result = item.lazy.value;
    this.appendItemToDOM(result.domNode, item.toolInvocationId, item.toolInvocationOrMarkdown, item.originalParent);
    if (result.disposable) {
      const toolCallId = item.toolInvocationOrMarkdown && (item.toolInvocationOrMarkdown.kind === "toolInvocation" || item.toolInvocationOrMarkdown.kind === "toolInvocationSerialized") ? item.toolInvocationOrMarkdown.toolCallId : void 0;
      if (toolCallId) {
        this.ownedToolParts.set(toolCallId, result.disposable);
      } else {
        this._register(result.disposable);
      }
    }
  }
  // makes a new text container. when we update, we now update this container.
  setupThinkingContainer(content) {
    if (this._store.isDisposed) {
      return;
    }
    this.appendedItemCount++;
    this.allThinkingParts.push(content);
    this.recordReasoningContent(extractTextFromPart(content));
    this.textContainer = $(".chat-thinking-item.markdown-content");
    if (this.childResizeObserver && this.fixedScrollingMode && !this.streamingCompleted) {
      this._register(this.childResizeObserver.observe(this.textContainer));
    }
    if (content.value) {
      if (this.isExpanded() || this.hasExpandedOnce || this.fixedScrollingMode && !this.streamingCompleted) {
        this.appendToWrapper(this.textContainer);
        this.id = content.id;
        this.updateThinking(content);
      } else {
        this.content = content;
        this.id = content.id;
        const lazyThinking = {
          kind: "thinking",
          textContainer: this.textContainer,
          content
        };
        this.lazyItems.push(lazyThinking);
      }
      if (this.workingSpinnerLabel) {
        this.workingSpinnerLabel.textContent = this.getRandomWorkingMessage("thinking" /* Thinking */);
      }
    }
    this.updateDropdownClickability();
  }
  setTitle(title, omitPrefix) {
    if (!title || this.element.isComplete) {
      return;
    }
    if (omitPrefix) {
      if (this._collapseButton) {
        const labelElement2 = this._collapseButton.labelElement;
        labelElement2.textContent = "";
        const plainSpan = $("span");
        plainSpan.textContent = title;
        labelElement2.appendChild(plainSpan);
        this._collapseButton.element.ariaLabel = title;
      }
      this.titleShimmerSpan = void 0;
      this.titleDetailContainer = void 0;
      this._titleDetailRendered.clear();
      this._titleFileWidgetStore.clear();
      this.currentTitle = title;
      return;
    }
    this.lastExtractedTitle = title;
    const thinkingLabel = localize("chat.thinking.label", "{0}: {1}", this.defaultTitle, title);
    this.currentTitle = thinkingLabel;
    if (!this._collapseButton) {
      return;
    }
    const labelElement = this._collapseButton.labelElement;
    if (!this.titleShimmerSpan || !this.titleShimmerSpan.parentElement) {
      labelElement.textContent = "";
      this.titleShimmerSpan = $("span.chat-thinking-title-shimmer");
      labelElement.appendChild(this.titleShimmerSpan);
    }
    this.titleShimmerSpan.textContent = localize("chat.thinking.shimmer", "{0}: ", this.defaultTitle);
    this._titleDetailRendered.clear();
    this._titleFileWidgetStore.clear();
    const result = this.chatContentMarkdownRenderer.render(new MarkdownString(title));
    result.element.classList.add("collapsible-title-content", "chat-thinking-title-detail");
    renderFileWidgets(result.element, this.instantiationService, this.chatMarkdownAnchorService, this._titleFileWidgetStore);
    this._titleDetailRendered.value = result;
    if (this.titleDetailContainer) {
      this.titleDetailContainer.replaceWith(result.element);
    } else {
      labelElement.appendChild(result.element);
    }
    this.titleDetailContainer = result.element;
    this._collapseButton.element.ariaLabel = thinkingLabel;
    this._collapseButton.element.ariaExpanded = String(this.isExpanded());
  }
  hasSameContent(other, _followingContent, _element) {
    if (_element.isComplete) {
      return true;
    }
    if ((other.kind === "toolInvocation" || other.kind === "toolInvocationSerialized") && other.toolSpecificData?.kind === "subagent" && !other.subAgentInvocationId) {
      return false;
    }
    if (other.kind === "toolInvocation" || other.kind === "toolInvocationSerialized" || other.kind === "markdownContent" || other.kind === "hook") {
      return true;
    }
    if (other.kind !== "thinking") {
      return false;
    }
    return other?.id !== this.id;
  }
  dispose() {
    this.isActive = false;
    if (this.workingSpinnerElement) {
      this.workingSpinnerElement.remove();
      this.workingSpinnerElement = void 0;
      this.workingSpinnerLabel = void 0;
    }
    this.pendingRemovalFlushDisposable?.dispose();
    this.pendingRemovalFlushDisposable = void 0;
    this.pendingScrollDisposable?.dispose();
    super.dispose();
  }
};
ChatThinkingContentPart = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IChatMarkdownAnchorService),
  __decorateParam(7, ILanguageModelsService),
  __decorateParam(8, IHoverService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, IContextKeyService)
], ChatThinkingContentPart);
export {
  ChatThinkingContentPart,
  buildPhrasePool,
  createThinkingIcon,
  defaultThinkingMessages,
  getEffectiveThinkingDisplayMode,
  getToolInvocationIcon,
  maybePickFunWorkingMessage
};
