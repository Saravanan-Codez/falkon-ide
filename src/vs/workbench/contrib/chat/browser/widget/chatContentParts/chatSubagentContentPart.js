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
import * as dom from "../../../../../../base/browser/dom.js";
import { $, AnimationFrameScheduler, DisposableResizeObserver } from "../../../../../../base/browser/dom.js";
import { Action } from "../../../../../../base/common/actions.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Event } from "../../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Lazy } from "../../../../../../base/common/lazy.js";
import { DisposableStore, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { rcut } from "../../../../../../base/common/strings.js";
import { localize } from "../../../../../../nls.js";
import { IActionViewItemService } from "../../../../../../platform/actions/browser/actionViewItemService.js";
import { HiddenItemStrategy, WorkbenchToolBar } from "../../../../../../platform/actions/browser/toolbar.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../../../platform/actions/common/actions.js";
import { IAccessibilityService } from "../../../../../../platform/accessibility/common/accessibility.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IWorkbenchEnvironmentService } from "../../../../../services/environment/common/environmentService.js";
import { CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID, ChatConfiguration } from "../../../common/constants.js";
import { isAgentHostTarget } from "../../../common/chatSessionsService.js";
import { formatCopilotCredits, IChatToolInvocation, isLegacyChatTerminalToolInvocationData } from "../../../common/chatService/chatService.js";
import { getChatSessionType } from "../../../common/model/chatUri.js";
import { isResponseVM } from "../../../common/model/chatViewModel.js";
import { ChatCollapsibleContentPart } from "./chatCollapsibleContentPart.js";
import { ChatCollapsibleMarkdownContentPart } from "./chatCollapsibleMarkdownContentPart.js";
import { renderFileWidgets } from "./chatInlineAnchorWidget.js";
import { IChatMarkdownAnchorService } from "./chatMarkdownAnchorService.js";
import { buildPhrasePool, createThinkingIcon, getToolInvocationIcon } from "./chatThinkingContentPart.js";
import { ChatToolInvocationPart } from "./toolInvocationParts/chatToolInvocationPart.js";
import "./media/chatSubagentContent.css";
const MAX_TITLE_LENGTH = 100;
const subagentWorkingMessages = [
  localize("chat.subagent.working.1", "Processing"),
  localize("chat.subagent.working.2", "Preparing"),
  localize("chat.subagent.working.3", "Loading"),
  localize("chat.subagent.working.4", "Analyzing"),
  localize("chat.subagent.working.5", "Evaluating")
];
let ChatSubagentContentPart = class extends ChatCollapsibleContentPart {
  constructor(subAgentInvocationId, toolInvocation, context, chatContentMarkdownRenderer, listPool, editorPool, currentWidthDelegate, announcedToolProgressKeys, instantiationService, chatMarkdownAnchorService, hoverService, configurationService, accessibilityService, actionViewItemService, menuService, contextKeyService, environmentService) {
    const { description, isDefaultDescription, agentName, prompt, modelName, credits } = ChatSubagentContentPart.extractSubagentInfo(toolInvocation);
    const rawPrefix = agentName || localize("chat.subagent.prefix", "Subagent");
    const prefix = rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1);
    const initialTitle = `${prefix}: ${description}`;
    super(initialTitle, context, void 0, hoverService, configurationService);
    this.subAgentInvocationId = subAgentInvocationId;
    this.context = context;
    this.chatContentMarkdownRenderer = chatContentMarkdownRenderer;
    this.listPool = listPool;
    this.editorPool = editorPool;
    this.currentWidthDelegate = currentWidthDelegate;
    this.announcedToolProgressKeys = announcedToolProgressKeys;
    this.instantiationService = instantiationService;
    this.chatMarkdownAnchorService = chatMarkdownAnchorService;
    this.configurationService = configurationService;
    this.accessibilityService = accessibilityService;
    this.actionViewItemService = actionViewItemService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.environmentService = environmentService;
    this.hasToolItems = false;
    // Lazy rendering support
    this.lazyItems = [];
    this.hasExpandedOnce = false;
    this.pendingPromptRender = false;
    this.activeToolPresentations = /* @__PURE__ */ new Map();
    this._hoverDisposable = this._register(new MutableDisposable());
    this._openChatActionListeners = this._register(new MutableDisposable());
    this._openChatActionViewRegistration = this._register(new MutableDisposable());
    // Confirmation auto-expand tracking
    this.toolsWaitingForConfirmation = 0;
    this.userManuallyExpanded = false;
    this.autoExpandedForConfirmation = false;
    this._confirmationPlaceholderDisposable = this._register(new MutableDisposable());
    this._activeConfirmationTracker = this._register(new MutableDisposable());
    this._useCarouselForConfirmations = false;
    this.toolsWaitingForCarouselConfirmation = 0;
    this._confirmationActive = false;
    /** Per-tool-invocation autoruns observing tool state; each is disposed once its tool reaches a terminal state so listeners don't accumulate for the widget's lifetime. */
    this._toolStateTracking = this._register(new DisposableStore());
    this._toolPresentationBatchDepth = 0;
    this._toolPresentationDirty = false;
    this._titleDetailRendered = this._register(new MutableDisposable());
    this.description = rcut(description, MAX_TITLE_LENGTH);
    this._isDefaultDescription = isDefaultDescription;
    this.agentName = agentName;
    this.prompt = prompt;
    this.modelName = modelName;
    this.credits = credits;
    this.isInitiallyComplete = IChatToolInvocation.isComplete(toolInvocation);
    this.isExternallyActive = toolInvocation.toolSpecificData?.kind === "subagent" && toolInvocation.toolSpecificData.isActive === true;
    this.isActive = toolInvocation.toolSpecificData?.kind === "subagent" ? toolInvocation.toolSpecificData.isActive ?? !this.isInitiallyComplete : !this.isInitiallyComplete;
    this.subagentActivity = toolInvocation.toolSpecificData?.kind === "subagent" ? toolInvocation.toolSpecificData.activity : void 0;
    this._subagentToolInvocation = toolInvocation;
    this._register(this.configurationService.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(ChatConfiguration.SubagentsUseRichRendering)) {
        this._updateOpenChatLink();
      }
    }));
    if (isResponseVM(context.element)) {
      const response = context.element;
      const finalizeOnTerminal = () => {
        if (this.isActive && (response.isComplete || response.isCanceled)) {
          this.markAsInactive(true);
        }
      };
      finalizeOnTerminal();
      if (!response.isComplete && !response.isCanceled) {
        this._register(Event.once(Event.filter(response.model.onDidChange, () => response.isComplete || response.isCanceled))(finalizeOnTerminal));
      }
    }
    const node = this.domNode;
    node.classList.add("chat-thinking-box", "chat-thinking-fixed-mode", "chat-subagent-part");
    const animationContainer = this.contentAnimationContainer;
    if (animationContainer) {
      const pendingAnimationCleanup = this._register(new MutableDisposable());
      this._register(dom.addDisposableListener(node, ChatCollapsibleContentPart.userToggleEvent, (e) => {
        if (e.target === node && this.isActive && !this.accessibilityService.isMotionReduced()) {
          this.setContentAnimationEnabled(true);
          animationContainer.getBoundingClientRect();
        }
      }));
      const finishActiveToggleAnimation = (e) => {
        if (this.isActive && e.target === animationContainer && e.propertyName === "grid-template-rows") {
          pendingAnimationCleanup.clear();
          this.setContentAnimationEnabled(false);
        }
      };
      this._register(dom.addDisposableListener(animationContainer, "transitionend", finishActiveToggleAnimation));
      this._register(dom.addDisposableListener(animationContainer, "transitioncancel", finishActiveToggleAnimation));
    }
    this._updateOpenChatLink();
    if (this.isActive) {
      node.classList.add("chat-thinking-active");
    }
    if (this.isActive && this._collapseButton) {
      const labelElement = this._collapseButton.labelElement;
      labelElement.textContent = "";
      this.titleShimmerSpan = $("span.chat-thinking-title-shimmer");
      this.titleShimmerSpan.textContent = initialTitle;
      labelElement.appendChild(this.titleShimmerSpan);
    }
    if (this._collapseButton && this.isActive) {
      this._collapseButton.icon = Codicon.circleFilled;
    }
    this._register(autorun((r) => {
      this.expanded.read(r);
      if (this._collapseButton) {
        if (this.isActive) {
          this._collapseButton.icon = Codicon.circleFilled;
        } else {
          this._collapseButton.icon = Codicon.check;
        }
      }
    }));
    this._register(autorun((r) => {
      if (this._isExpanded.read(r) && !this.hasExpandedOnce) {
        this.hasExpandedOnce = true;
        this.materializePendingContent();
      }
    }));
    this.setExpanded(false);
    this._register(autorun((r) => {
      const expanded = this._isExpanded.read(r);
      if (expanded) {
        if (!this.autoExpandedForConfirmation) {
          this.userManuallyExpanded = true;
        }
      } else {
        if (this.autoExpandedForConfirmation) {
          this.autoExpandedForConfirmation = false;
        }
        if (this.userManuallyExpanded) {
          this.userManuallyExpanded = false;
        }
      }
    }));
    this.layoutScheduler = this._register(new AnimationFrameScheduler(this.domNode, () => this.performLayout()));
    this.updateHover();
    this.renderPromptSection();
    this.watchToolCompletion(toolInvocation);
  }
  /**
   * Check if a tool invocation is the parent subagent tool (the tool that spawns a subagent).
   * A parent subagent tool has subagent toolSpecificData but no subAgentInvocationId.
   */
  static isParentSubagentTool(toolInvocation) {
    return toolInvocation.toolSpecificData?.kind === "subagent" && !toolInvocation.subAgentInvocationId;
  }
  /**
   * Extracts subagent info (description, agentName, prompt) from a tool invocation.
   */
  static extractSubagentInfo(toolInvocation) {
    const defaultDescription = localize("chat.subagent.defaultDescription", "Running subagent");
    if (!ChatSubagentContentPart.isParentSubagentTool(toolInvocation)) {
      return { description: defaultDescription, isDefaultDescription: true, agentName: void 0, prompt: void 0, modelName: void 0, credits: void 0 };
    }
    if (toolInvocation.toolSpecificData?.kind === "subagent") {
      const hasDescription = !!toolInvocation.toolSpecificData.description;
      return {
        description: toolInvocation.toolSpecificData.description ?? defaultDescription,
        isDefaultDescription: !hasDescription,
        agentName: toolInvocation.toolSpecificData.agentName,
        prompt: toolInvocation.toolSpecificData.prompt,
        modelName: toolInvocation.toolSpecificData.modelName,
        credits: toolInvocation.toolSpecificData.credits
      };
    }
    if (toolInvocation.kind === "toolInvocation") {
      const state = toolInvocation.state.get();
      const params = state.type !== IChatToolInvocation.StateKind.Streaming ? state.parameters : void 0;
      const hasDescription = !!params?.description;
      return {
        description: params?.description ?? defaultDescription,
        isDefaultDescription: !hasDescription,
        agentName: params?.agentName,
        prompt: params?.prompt,
        modelName: void 0,
        credits: void 0
      };
    }
    return { description: defaultDescription, isDefaultDescription: true, agentName: void 0, prompt: void 0, modelName: void 0, credits: void 0 };
  }
  /** The subagent's own chat resource (URI string), when it runs as a distinct chat. */
  _getChatResource() {
    const data = this._subagentToolInvocation.toolSpecificData;
    return data?.kind === "subagent" ? data.chatResource : void 0;
  }
  /**
   * Creates (once) and toggles the subagent header toolbar that hosts the
   * `MenuId.ChatSubagentContent` menu. The Agents window contributes an "Open
   * Subagent" pill into that menu to reveal the subagent's own (read-only)
   * chat; in the regular chat view the menu is empty and nothing renders. The
   * subagent chat resource can arrive after the part is first constructed, so
   * this is also called from the tool-completion autorun.
   */
  _updateOpenChatLink() {
    const resource = this._shouldUseOpenChatPresentation() ? this._getChatResource() : void 0;
    this.domNode.classList.toggle("chat-subagent-has-chat", !!resource);
    this._updateOpenChatOnlyMode();
    if (!this._collapseButton) {
      return;
    }
    if (!resource) {
      this._openChatToolbarContainer?.classList.add("hidden");
      this._updateOpenChatOnlyMode();
      return;
    }
    if (!this._ensureOpenChatToolbar()) {
      return;
    }
    this._updateOpenChatToolbarContext();
    this._openChatToolbarContainer.classList.remove("hidden");
  }
  _ensureOpenChatToolbar() {
    if (this._openChatToolbar) {
      return true;
    }
    const menuAction = this._getOpenChatMenuAction();
    if (!menuAction) {
      return false;
    }
    const actionViewItemProvider = this.actionViewItemService.lookUp(MenuId.ChatSubagentContent, CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID);
    if (!actionViewItemProvider) {
      if (!this._openChatActionViewRegistration.value) {
        this._openChatActionViewRegistration.value = Event.once(Event.filter(
          this.actionViewItemService.onDidChange,
          (menuId) => menuId === MenuId.ChatSubagentContent
        ))(() => {
          this._openChatActionViewRegistration.clear();
          this._updateOpenChatLink();
        });
      }
      return false;
    }
    this._openChatActionViewRegistration.clear();
    const container = $(".chat-subagent-open-chat-toolbar");
    this._collapseButton?.element.parentElement?.insertBefore(container, this._collapseButton.element);
    this._openChatToolbarContainer = container;
    this._openChatToolbar = this._register(this.instantiationService.createInstance(WorkbenchToolBar, container, {
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      actionViewItemProvider: (action, options) => actionViewItemProvider(
        action,
        options,
        this.instantiationService,
        dom.getWindow(container).vscodeWindowId
      )
    }));
    this._openChatToolbar.setActions([menuAction]);
    this._trackOpenChatActions();
    return true;
  }
  _getOpenChatMenuAction() {
    for (const [, actions] of this.menuService.getMenuActions(MenuId.ChatSubagentContent, this.contextKeyService, { shouldForwardArgs: true })) {
      const action = actions.find((action2) => action2.id === CHAT_OPEN_AGENT_HOST_CHAT_COMMAND_ID);
      if (action instanceof MenuItemAction) {
        return action;
      }
    }
    return void 0;
  }
  _trackOpenChatActions() {
    const store = new DisposableStore();
    const itemCount = this._openChatToolbar?.getItemsLength() ?? 0;
    for (let index = 0; index < itemCount; index++) {
      const action = this._openChatToolbar?.getItemAction(index);
      if (action instanceof Action) {
        store.add(action.onDidChange(() => this._updateOpenChatOnlyMode()));
      }
    }
    this._openChatActionListeners.value = store;
    this._updateOpenChatOnlyMode();
  }
  _updateOpenChatOnlyMode() {
    if (!this._collapseButton) {
      return;
    }
    let openChatOnly = false;
    if (this._openChatToolbar) {
      const itemCount = this._openChatToolbar.getItemsLength();
      openChatOnly = this._shouldUseOpenChatPresentation() && !!this._getChatResource();
      for (let index = 0; index < itemCount; index++) {
        if (!this._openChatToolbar.getItemAction(index)?.enabled) {
          openChatOnly = false;
          break;
        }
      }
    }
    this.domNode.classList.toggle("chat-subagent-open-chat-only", openChatOnly);
    if (openChatOnly || this._shouldReserveOpenChatPresentation()) {
      dom.hide(this._collapseButton.element);
      if (this.contentAnimationContainer) {
        dom.hide(this.contentAnimationContainer);
      }
      this.setExpanded(false);
    } else {
      dom.show(this._collapseButton.element);
      if (this.contentAnimationContainer) {
        dom.show(this.contentAnimationContainer);
      }
    }
  }
  _updateOpenChatToolbarContext() {
    const chatResource = this._getChatResource();
    if (chatResource && this._openChatToolbar) {
      const data = this._subagentToolInvocation.toolSpecificData;
      const response = isResponseVM(this.context.element) ? this.context.element : void 0;
      const selectedModel = response?.session?.model.inputModel.state.get()?.selectedModel;
      const parentModelId = response?.model.request?.modelId ?? selectedModel?.identifier;
      const parentModelName = selectedModel?.metadata.name;
      const resolvedModel = response?.model.result?.metadata?.resolvedModel;
      const parentResolvedModelId = typeof resolvedModel === "string" ? resolvedModel : selectedModel?.metadata.id;
      const activeTool = Array.from(this.activeToolPresentations.entries()).at(-1);
      const displayedTool = activeTool ? { callId: activeTool[0], ...activeTool[1] } : this.subagentActivity !== "markdown" ? this.mostRecentToolPresentation : void 0;
      this._openChatToolbar.context = {
        chatResource,
        parentSessionResource: this.context.element.sessionResource.toString(),
        title: this.description,
        confirmationCount: this.toolsWaitingForCarouselConfirmation,
        confirmationActive: this._confirmationActive,
        startedAt: data?.kind === "subagent" ? data.startedAt : void 0,
        duration: data?.kind === "subagent" ? data.duration : void 0,
        isActive: this.isActive,
        ...this.modelName ? { modelName: this.modelName } : {},
        ...parentModelId ? { parentModelId } : {},
        ...parentModelName ? { parentModelName } : {},
        ...parentResolvedModelId ? { parentResolvedModelId } : {},
        ...this.isActive && displayedTool ? { activeToolCallId: displayedTool.callId, activeToolLabel: displayedTool.label, activeToolIcon: displayedTool.icon } : {}
      };
    }
  }
  _shouldUseOpenChatPresentation() {
    return this.environmentService.isSessionsWindow || this.configurationService.getValue(ChatConfiguration.SubagentsUseRichRendering);
  }
  _shouldReserveOpenChatPresentation() {
    return this._shouldUseOpenChatPresentation() && isAgentHostTarget(getChatSessionType(this.context.element.sessionResource));
  }
  getRandomWorkingMessage() {
    if (!this.availableMessages || this.availableMessages.length === 0) {
      this.availableMessages = buildPhrasePool(subagentWorkingMessages, this.configurationService);
    }
    const index = Math.floor(Math.random() * this.availableMessages.length);
    return this.availableMessages.splice(index, 1)[0];
  }
  createWorkingSpinner() {
    if (this.workingSpinnerElement || !this.wrapper) {
      return;
    }
    this.workingSpinnerElement = $(".chat-thinking-item.chat-thinking-spinner-item");
    const spinnerIcon = createThinkingIcon(Codicon.circleFilled);
    this.workingSpinnerElement.appendChild(spinnerIcon);
    this.workingSpinnerLabel = $("span.chat-thinking-spinner-label");
    this.workingSpinnerLabel.textContent = this.getRandomWorkingMessage();
    this.workingSpinnerElement.appendChild(this.workingSpinnerLabel);
    this.wrapper.appendChild(this.workingSpinnerElement);
  }
  removeWorkingSpinner() {
    if (this.workingSpinnerElement) {
      this.workingSpinnerElement.remove();
      this.workingSpinnerElement = void 0;
      this.workingSpinnerLabel = void 0;
    }
  }
  showWorkingSpinner() {
    if (this.workingSpinnerElement) {
      this.workingSpinnerElement.style.display = "";
    } else {
      this.createWorkingSpinner();
    }
  }
  initContent() {
    this.wrapper = $(".chat-used-context-list.chat-thinking-collapsible");
    if (!this.hasToolItems) {
      this.wrapper.style.display = "none";
    }
    this.materializePendingContent();
    if (this.isActive && !this.isInitiallyComplete && !this.hasToolsWaitingForConfirmation) {
      this.showWorkingSpinner();
    }
    const resizeObserver = this._register(new DisposableResizeObserver("ChatSubagentContentPart.layout", () => this.layoutScheduler.schedule()));
    this._register(resizeObserver.observe(this.wrapper));
    return this.wrapper;
  }
  /**
   * Renders the prompt as a collapsible section at the start of the content.
   * If the wrapper doesn't exist yet (lazy init) or subagent is initially complete,
   * this is deferred until expanded.
   */
  renderPromptSection() {
    if (!this.prompt || this.promptContainer) {
      return;
    }
    if (!this.wrapper || this.isInitiallyComplete && !this.isExpanded() && !this.hasExpandedOnce) {
      this.pendingPromptRender = true;
      return;
    }
    this.pendingPromptRender = false;
    this.doRenderPromptSection();
  }
  doRenderPromptSection() {
    if (!this.prompt || this.promptContainer) {
      return;
    }
    const lines = this.prompt.split("\n");
    const rawFirstLine = lines[0] || localize("chat.subagent.prompt", "Prompt");
    const restOfLines = lines.slice(1).join("\n").trim();
    const titleContent = rcut(rawFirstLine, MAX_TITLE_LENGTH);
    const wasTruncated = rawFirstLine.length > MAX_TITLE_LENGTH;
    const title = wasTruncated ? titleContent + "\u2026" : titleContent;
    const titleRemainder = rawFirstLine.length > titleContent.length ? rawFirstLine.slice(titleContent.length).trim() : "";
    const content = titleRemainder ? titleRemainder + (restOfLines ? "\n" + restOfLines : "") : restOfLines || this.prompt;
    const collapsiblePart = this._register(this.instantiationService.createInstance(
      ChatCollapsibleMarkdownContentPart,
      title,
      content,
      this.context,
      this.chatContentMarkdownRenderer
    ));
    this.promptContainer = $(".chat-thinking-tool-wrapper.chat-subagent-section");
    const promptIcon = createThinkingIcon(Codicon.comment);
    this.promptContainer.appendChild(promptIcon);
    this.promptContainer.appendChild(collapsiblePart.domNode);
    if (this.wrapper) {
      if (this.wrapper.firstChild) {
        this.wrapper.insertBefore(this.promptContainer, this.wrapper.firstChild);
      } else {
        dom.append(this.wrapper, this.promptContainer);
      }
      if (this.wrapper.style.display === "none") {
        this.wrapper.style.display = "";
      }
    }
  }
  getIsActive() {
    return this.isActive;
  }
  shouldRemainActive() {
    return this.isExternallyActive;
  }
  get hasToolsWaitingForConfirmation() {
    return this.toolsWaitingForConfirmation > 0;
  }
  beginToolPresentationBatch() {
    this._toolPresentationBatchDepth++;
  }
  endToolPresentationBatch() {
    if (this._toolPresentationBatchDepth === 0) {
      return;
    }
    this._toolPresentationBatchDepth--;
    if (this._toolPresentationBatchDepth === 0 && this._toolPresentationDirty) {
      this._toolPresentationDirty = false;
      this._updateToolPresentation();
    }
  }
  _updateToolPresentation() {
    if (this._toolPresentationBatchDepth > 0) {
      this._toolPresentationDirty = true;
      return;
    }
    this._updateOpenChatToolbarContext();
    this.updateTitle();
  }
  /** Routes this subagent's initial confirmations to the input carousel. */
  enableCarouselMode(navigateToCarousel, addToolToCarousel, shouldUseCarouselForTool, onDidChangeActiveSubagent) {
    this._useCarouselForConfirmations = true;
    this._navigateToCarousel = navigateToCarousel;
    this._addToolToCarousel = addToolToCarousel;
    this._shouldUseCarouselForTool = shouldUseCarouselForTool;
    this._activeConfirmationTracker.value = onDidChangeActiveSubagent?.((id) => this.setConfirmationActive(id === this.subAgentInvocationId));
  }
  getChatResource() {
    return this._getChatResource();
  }
  setConfirmationActive(active) {
    if (active !== this._confirmationActive) {
      this._confirmationActive = active;
      this._updateOpenChatToolbarContext();
    }
  }
  getAgentLabel() {
    if (this.agentName) {
      return this.agentName;
    }
    if (!this._isDefaultDescription && this.description) {
      return this.description;
    }
    return localize("chat.subagent.prefix", "Subagent");
  }
  markAsInactive(force = false) {
    if (force && this._subagentToolInvocation.toolSpecificData?.kind === "subagent") {
      const data = this._subagentToolInvocation.toolSpecificData;
      data.isActive = false;
      if (data.duration === void 0 && data.startedAt !== void 0) {
        data.duration = Math.max(0, Date.now() - data.startedAt);
      }
    }
    this.isActive = false;
    this._updateOpenChatToolbarContext();
    this.domNode.classList.remove("chat-thinking-active");
    if (this._collapseButton) {
      this._collapseButton.icon = Codicon.check;
    }
    this.removeWorkingSpinner();
    this.hideConfirmationPlaceholder();
    if (this._isDefaultDescription) {
      this.description = localize("chat.subagent.completedDefaultDescription", "Ran subagent");
    }
    this.finalizeTitle();
    this.setExpanded(false);
    this.setContentAnimationEnabled(true);
  }
  markAsActive() {
    if (this.isActive) {
      return;
    }
    this.isActive = true;
    this.setContentAnimationEnabled(false);
    this.domNode.classList.add("chat-thinking-active");
    if (this._collapseButton) {
      this._collapseButton.icon = Codicon.circleFilled;
    }
    if (this.wrapper && !this.hasToolsWaitingForConfirmation) {
      this.showWorkingSpinner();
    }
    this._updateOpenChatToolbarContext();
    this.updateTitle();
  }
  refreshActiveStateFromToolData(toolInvocation) {
    if (toolInvocation.toolSpecificData?.kind !== "subagent") {
      return;
    }
    this._updateOpenChatToolbarContext();
    if (toolInvocation.toolSpecificData.isActive === void 0) {
      return;
    }
    this.isExternallyActive = toolInvocation.toolSpecificData.isActive;
    if (toolInvocation.toolSpecificData.isActive) {
      this.markAsActive();
    } else {
      this.markAsInactive();
    }
  }
  finalizeTitle() {
    this.updateTitle();
    if (this._collapseButton) {
      this._collapseButton.icon = Codicon.check;
    }
  }
  updateTitle() {
    const rawName = this.agentName || localize("chat.subagent.prefix", "Subagent");
    const prefix = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const shimmerText = `${prefix}: ${this.description}`;
    const toolCallText = this.currentRunningToolMessage && this.isActive ? ` \u2014 ${this.currentRunningToolMessage}` : ``;
    if (!this._collapseButton) {
      return;
    }
    const labelElement = this._collapseButton.labelElement;
    if (!this.isActive) {
      labelElement.textContent = "";
      this.titleShimmerSpan = void 0;
      this._titleDetailRendered.clear();
      this._titleFileWidgetStore.clear();
      this.titleDetailContainer = void 0;
      const prefixSpan = $("span");
      prefixSpan.textContent = `${prefix}:`;
      labelElement.appendChild(prefixSpan);
      const descSpan = $("span.chat-thinking-title-detail-text");
      descSpan.textContent = ` ${this.description}`;
      labelElement.appendChild(descSpan);
      this._collapseButton.element.ariaLabel = shimmerText;
      this._collapseButton.element.ariaExpanded = String(this.isExpanded());
      return;
    }
    if (!this.titleShimmerSpan || !this.titleShimmerSpan.parentElement) {
      labelElement.textContent = "";
      this.titleShimmerSpan = $("span.chat-thinking-title-shimmer");
      labelElement.appendChild(this.titleShimmerSpan);
    }
    this.titleShimmerSpan.textContent = shimmerText;
    this._titleDetailRendered.clear();
    this._titleFileWidgetStore.clear();
    if (!toolCallText) {
      if (this.titleDetailContainer) {
        this.titleDetailContainer.remove();
        this.titleDetailContainer = void 0;
      }
    } else {
      const result = this.chatContentMarkdownRenderer.render(new MarkdownString(toolCallText));
      result.element.classList.add("collapsible-title-content", "chat-thinking-title-detail");
      renderFileWidgets(result.element, this.instantiationService, this.chatMarkdownAnchorService, this._titleFileWidgetStore);
      this._titleDetailRendered.value = result;
      if (this.titleDetailContainer) {
        this.titleDetailContainer.replaceWith(result.element);
      } else {
        labelElement.appendChild(result.element);
      }
      this.titleDetailContainer = result.element;
    }
    const fullLabel = `${shimmerText}${toolCallText}`;
    this._collapseButton.element.ariaLabel = fullLabel;
    this._collapseButton.element.ariaExpanded = String(this.isExpanded());
  }
  updateHover() {
    if (!this._collapseButton) {
      return;
    }
    const parts = [];
    if (this.modelName) {
      parts.push(localize("chat.subagent.modelTooltip", "Model: {0}", this.modelName));
    }
    if (typeof this.credits === "number" && this.credits > 0) {
      const formatted = formatCopilotCredits(this.credits);
      parts.push(formatted === "1" ? localize("chat.subagent.creditTooltip", "{0} credit", formatted) : localize("chat.subagent.creditsTooltip", "{0} credits", formatted));
    }
    if (parts.length === 0) {
      this._hoverDisposable.clear();
      return;
    }
    this._hoverDisposable.value = this.hoverService.setupDelayedHover(this._collapseButton.element, {
      content: parts.join(" \u2022 ")
    });
  }
  /**
   * Re-reads the subagent's credit (AIC) usage from `toolSpecificData` and
   * refreshes the hover tooltip when it has changed. Credits can arrive
   * incrementally while the subagent runs and continue updating until its
   * child turns report their final usage.
   */
  refreshCreditsFromToolData(toolInvocation) {
    if (toolInvocation.toolSpecificData?.kind !== "subagent") {
      return;
    }
    const credits = toolInvocation.toolSpecificData.credits;
    if (typeof credits === "number" && credits !== this.credits) {
      this.credits = credits;
      this.updateHover();
    }
  }
  /**
   * Re-reads the subagent's model name from `toolSpecificData` and refreshes
   * the hover when it changes. The model can arrive incrementally (e.g. agent
   * host subagents report it via their child turns' usage events).
   */
  refreshModelFromToolData(toolInvocation) {
    if (toolInvocation.toolSpecificData?.kind !== "subagent") {
      return;
    }
    const modelName = toolInvocation.toolSpecificData.modelName;
    if (modelName && modelName !== this.modelName) {
      this.modelName = modelName;
      this.updateHover();
      this._updateOpenChatToolbarContext();
    }
  }
  getToolLabel(toolInvocation, state = toolInvocation.state.get()) {
    if (state.type === IChatToolInvocation.StateKind.Streaming) {
      return void 0;
    }
    if (toolInvocation.toolSpecificData?.kind === "terminal" && !isLegacyChatTerminalToolInvocationData(toolInvocation.toolSpecificData)) {
      const intention = toolInvocation.toolSpecificData.intention?.replace(/\s+/g, " ").trim();
      if (intention) {
        return intention;
      }
    }
    const message = toolInvocation.invocationMessage;
    const messageText = typeof message === "string" ? message : message.value;
    const label = messageText.replace(/\s+/g, " ").trim();
    if (!label) {
      return void 0;
    }
    const toolIdWords = toolInvocation.toolId.replace(/([a-z\d])([A-Z])/g, "$1 $2").split(/[^a-zA-Z\d]+/).filter(Boolean);
    const normalizedLabel = label.toLocaleLowerCase();
    const genericLabels = [toolIdWords[0], toolIdWords.join(" ")].filter((candidate) => !!candidate).map((candidate) => candidate.toLocaleLowerCase());
    return genericLabels.includes(normalizedLabel) ? void 0 : label;
  }
  /**
   * Tracks a tool invocation's state for:
   * 1. Updating the title with the current tool message (persists even after completion)
   * 2. Auto-expanding when a tool is waiting for confirmation
   * 3. Auto-collapsing when the confirmation is addressed
   * This method is public to support testing.
   */
  trackToolState(toolInvocation) {
    if (toolInvocation.kind !== "toolInvocation") {
      return;
    }
    const initialState = toolInvocation.state.get();
    let wasStreamingForPresentation = initialState.type === IChatToolInvocation.StateKind.Streaming;
    if (!wasStreamingForPresentation) {
      this.currentRunningToolCallId = toolInvocation.toolCallId;
      this.currentRunningToolMessage = this.getToolLabel(toolInvocation, initialState);
      this.currentRunningToolIcon = this.currentRunningToolMessage ? getToolInvocationIcon(toolInvocation.toolId, toolInvocation.icon) : void 0;
      this.updateActiveToolPresentation(toolInvocation.toolCallId, this.currentRunningToolMessage, this.currentRunningToolIcon, initialState);
      this._updateToolPresentation();
    }
    if (initialState.type === IChatToolInvocation.StateKind.Completed || initialState.type === IChatToolInvocation.StateKind.Cancelled) {
      return;
    }
    const addToolToCarousel = this._addToolToCarousel;
    const shouldUseCarouselForTool = this._shouldUseCarouselForTool;
    let wasWaitingForConfirmation = false;
    let wasWaitingForCarouselConfirmation = false;
    const toolStateAutorun = autorun((r) => {
      const state = toolInvocation.state.read(r);
      if (wasStreamingForPresentation && state.type !== IChatToolInvocation.StateKind.Streaming) {
        wasStreamingForPresentation = false;
        this.currentRunningToolCallId = toolInvocation.toolCallId;
        this.currentRunningToolMessage = this.getToolLabel(toolInvocation, state);
        this.currentRunningToolIcon = this.currentRunningToolMessage ? getToolInvocationIcon(toolInvocation.toolId, toolInvocation.icon) : void 0;
        this.updateActiveToolPresentation(toolInvocation.toolCallId, this.currentRunningToolMessage, this.currentRunningToolIcon, state);
        this._updateToolPresentation();
      }
      if (this.currentRunningToolCallId === toolInvocation.toolCallId) {
        const toolLabel = this.getToolLabel(toolInvocation, state);
        if (toolLabel && toolLabel !== this.currentRunningToolMessage) {
          this.currentRunningToolMessage = toolLabel;
          this.currentRunningToolIcon = getToolInvocationIcon(toolInvocation.toolId, toolInvocation.icon);
          this.updateActiveToolPresentation(toolInvocation.toolCallId, this.currentRunningToolMessage, this.currentRunningToolIcon, state);
          this._updateToolPresentation();
        }
      }
      const isWaitingForConfirmation = state.type === IChatToolInvocation.StateKind.WaitingForConfirmation || state.type === IChatToolInvocation.StateKind.WaitingForPostApproval || state.type === IChatToolInvocation.StateKind.WaitingForAuthentication;
      const isWaitingForCarouselConfirmation = !!addToolToCarousel && shouldUseCarouselForTool?.(toolInvocation, state) === true;
      if (isWaitingForConfirmation && !wasWaitingForConfirmation) {
        this.toolsWaitingForConfirmation++;
        if (!this.isExpanded()) {
          this.autoExpandedForConfirmation = true;
          this.setExpanded(true);
        }
        this.removeWorkingSpinner();
      } else if (!isWaitingForConfirmation && wasWaitingForConfirmation) {
        this.toolsWaitingForConfirmation--;
        if (this.toolsWaitingForConfirmation === 0 && this.autoExpandedForConfirmation && !this.userManuallyExpanded) {
          this.autoExpandedForConfirmation = false;
          this.setExpanded(false);
        }
        if (this.toolsWaitingForConfirmation === 0 && this.isActive) {
          this.showWorkingSpinner();
        }
      }
      if (isWaitingForCarouselConfirmation && !wasWaitingForCarouselConfirmation) {
        this.toolsWaitingForCarouselConfirmation++;
        this._updateToolPresentation();
        addToolToCarousel(toolInvocation);
        this.showConfirmationPlaceholder();
      } else if (!isWaitingForCarouselConfirmation && wasWaitingForCarouselConfirmation) {
        this.toolsWaitingForCarouselConfirmation--;
        this._updateToolPresentation();
        if (this.toolsWaitingForCarouselConfirmation === 0) {
          this.hideConfirmationPlaceholder();
        } else {
          this.updateConfirmationPlaceholderLabel();
        }
      }
      wasWaitingForConfirmation = isWaitingForConfirmation;
      wasWaitingForCarouselConfirmation = isWaitingForCarouselConfirmation;
      if (state.type === IChatToolInvocation.StateKind.Completed || state.type === IChatToolInvocation.StateKind.Cancelled) {
        if (this.activeToolPresentations.delete(toolInvocation.toolCallId)) {
          this._updateToolPresentation();
        }
        queueMicrotask(() => this._toolStateTracking.delete(toolStateAutorun));
      }
    });
    this._toolStateTracking.add(toolStateAutorun);
  }
  updateActiveToolPresentation(toolCallId, label, icon, state) {
    this.activeToolPresentations.delete(toolCallId);
    if (label && icon) {
      this.mostRecentToolPresentation = { callId: toolCallId, label, icon };
    }
    if (label && icon && state.type !== IChatToolInvocation.StateKind.Completed && state.type !== IChatToolInvocation.StateKind.Cancelled) {
      this.activeToolPresentations.set(toolCallId, { label, icon });
    }
  }
  getConfirmationPlaceholderText() {
    const count = this.toolsWaitingForCarouselConfirmation;
    return count === 1 ? localize("chat.subagent.pendingConfirmation", "1 pending confirmation") : localize("chat.subagent.pendingConfirmations", "{0} pending confirmations", count);
  }
  updateConfirmationPlaceholderLabel() {
    if (this._confirmationPlaceholderLabel) {
      this._confirmationPlaceholderLabel.textContent = this.getConfirmationPlaceholderText();
    }
  }
  /** Shows a placeholder that jumps back to the carousel. */
  showConfirmationPlaceholder() {
    if (this._confirmationPlaceholder) {
      this.updateConfirmationPlaceholderLabel();
      return;
    }
    const placeholder = $("button.chat-subagent-confirmation-placeholder");
    const label = $("span.chat-subagent-placeholder-label");
    label.textContent = this.getConfirmationPlaceholderText();
    placeholder.appendChild(label);
    this._confirmationPlaceholder = placeholder;
    this._confirmationPlaceholderLabel = label;
    const placeholderDisposables = new DisposableStore();
    placeholderDisposables.add(dom.addDisposableListener(placeholder, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._navigateToCarousel?.(this.subAgentInvocationId);
    }));
    this._confirmationPlaceholderDisposable.value = placeholderDisposables;
    if (!this.hasToolItems) {
      this.hasToolItems = true;
      if (this.wrapper) {
        this.wrapper.style.display = "";
      }
    }
    if (!this.isExpanded()) {
      this.autoExpandedForConfirmation = true;
      this.setExpanded(true);
    }
    if (this.wrapper) {
      this.wrapper.appendChild(placeholder);
    }
    this.layoutScheduler.schedule();
  }
  hideConfirmationPlaceholder() {
    if (this._confirmationPlaceholder) {
      this._confirmationPlaceholder.remove();
      this._confirmationPlaceholder = void 0;
      this._confirmationPlaceholderLabel = void 0;
      this._confirmationPlaceholderDisposable.clear();
      this.layoutScheduler.schedule();
    }
  }
  /** Keeps the carousel placeholder after visible tool output. */
  ensurePlaceholderAtBottom() {
    if (this._confirmationPlaceholder?.parentElement === this.wrapper) {
      this.wrapper.appendChild(this._confirmationPlaceholder);
    }
  }
  /**
   * Watches the tool invocation for completion and renders the result.
   * Handles both live and serialized invocations.
   */
  watchToolCompletion(toolInvocation) {
    if (!ChatSubagentContentPart.isParentSubagentTool(toolInvocation)) {
      return;
    }
    if (toolInvocation.kind === "toolInvocation") {
      let wasStreaming = toolInvocation.state.get().type === IChatToolInvocation.StateKind.Streaming;
      this._register(autorun((r) => {
        const state = toolInvocation.state.read(r);
        this.refreshActiveStateFromToolData(toolInvocation);
        this.refreshActivityFromToolData(toolInvocation);
        if (state.type === IChatToolInvocation.StateKind.Completed) {
          wasStreaming = false;
          const textParts = (state.contentForModel || []).filter((part) => part.kind === "text").map((part) => part.value);
          if (textParts.length > 0) {
            this.renderResultText(textParts.join("\n"));
          }
          if (toolInvocation.toolSpecificData?.kind === "subagent") {
            if (toolInvocation.toolSpecificData.description) {
              this.description = toolInvocation.toolSpecificData.description;
              this._isDefaultDescription = false;
            }
            if (toolInvocation.toolSpecificData.modelName) {
              this.modelName = toolInvocation.toolSpecificData.modelName;
              this.updateHover();
              this._updateOpenChatToolbarContext();
            }
          }
          this.refreshCreditsFromToolData(toolInvocation);
          this._updateOpenChatLink();
          if (!this.isExternallyActive) {
            this.markAsInactive();
          }
        } else if (wasStreaming && state.type !== IChatToolInvocation.StateKind.Streaming) {
          wasStreaming = false;
          const { description, isDefaultDescription, agentName, prompt, modelName } = ChatSubagentContentPart.extractSubagentInfo(toolInvocation);
          this.description = description;
          this._isDefaultDescription = isDefaultDescription;
          this.agentName = agentName;
          this.prompt = prompt;
          if (modelName) {
            this.modelName = modelName;
            this.updateHover();
            this._updateOpenChatToolbarContext();
          }
          this.refreshCreditsFromToolData(toolInvocation);
          this.renderPromptSection();
          this.updateTitle();
        } else if (toolInvocation.toolSpecificData?.kind === "subagent") {
          const { description, isDefaultDescription, agentName } = ChatSubagentContentPart.extractSubagentInfo(toolInvocation);
          const descriptionChanged = this._isDefaultDescription && !isDefaultDescription;
          const agentNameChanged = !!agentName && agentName !== this.agentName;
          if (descriptionChanged || agentNameChanged) {
            if (descriptionChanged) {
              this.description = description;
              this._isDefaultDescription = isDefaultDescription;
            }
            if (agentNameChanged) {
              this.agentName = agentName;
            }
            this.updateTitle();
          }
          this.refreshCreditsFromToolData(toolInvocation);
          this.refreshModelFromToolData(toolInvocation);
          this._updateOpenChatLink();
        }
      }));
    } else if (toolInvocation.toolSpecificData?.kind === "subagent" && toolInvocation.toolSpecificData.result) {
      this.renderResultText(toolInvocation.toolSpecificData.result);
      this.markAsInactive();
    }
  }
  refreshActivityFromToolData(toolInvocation) {
    const activity = toolInvocation.toolSpecificData?.kind === "subagent" ? toolInvocation.toolSpecificData.activity : void 0;
    if (activity !== this.subagentActivity) {
      this.subagentActivity = activity;
      this._updateOpenChatToolbarContext();
    }
  }
  /**
   * Renders the result text as a collapsible section.
   * If the wrapper doesn't exist yet (lazy init) or subagent is initially complete,
   * this is deferred until expanded.
   */
  renderResultText(resultText) {
    if (this.resultContainer || !resultText) {
      return;
    }
    if (!this.wrapper || this.isInitiallyComplete && !this.isExpanded() && !this.hasExpandedOnce) {
      this.pendingResultText = resultText;
      return;
    }
    this.pendingResultText = void 0;
    this.doRenderResultText(resultText);
  }
  doRenderResultText(resultText) {
    if (this.resultContainer || !resultText) {
      return;
    }
    const lines = resultText.split("\n");
    const rawFirstLine = lines[0] || "";
    const restOfLines = lines.slice(1).join("\n").trim();
    const titleContent = rcut(rawFirstLine, MAX_TITLE_LENGTH);
    const wasTruncated = rawFirstLine.length > MAX_TITLE_LENGTH;
    const title = wasTruncated ? titleContent + "\u2026" : titleContent;
    const titleRemainder = rawFirstLine.length > titleContent.length ? rawFirstLine.slice(titleContent.length).trim() : "";
    const content = titleRemainder ? titleRemainder + (restOfLines ? "\n" + restOfLines : "") : restOfLines;
    const collapsiblePart = this._register(this.instantiationService.createInstance(
      ChatCollapsibleMarkdownContentPart,
      title,
      content,
      this.context,
      this.chatContentMarkdownRenderer
    ));
    this.resultContainer = $(".chat-thinking-tool-wrapper.chat-subagent-section");
    const resultIcon = createThinkingIcon(Codicon.check);
    this.resultContainer.appendChild(resultIcon);
    this.resultContainer.appendChild(collapsiblePart.domNode);
    if (this.wrapper) {
      dom.append(this.wrapper, this.resultContainer);
      if (this.wrapper.style.display === "none") {
        this.wrapper.style.display = "";
      }
    }
  }
  /**
   * Appends a tool invocation to the subagent group.
   * The tool part is created lazily - only when the subagent section is expanded,
   * unless it's actively streaming (not initially complete), in which case render immediately.
   */
  appendToolInvocation(toolInvocation, codeBlockStartIndex) {
    if (!this.hasToolItems) {
      this.hasToolItems = true;
      if (this.wrapper) {
        this.wrapper.style.display = "";
      }
    }
    this.trackToolState(toolInvocation);
    if (this.isExpanded() || this.hasExpandedOnce) {
      const part = this.createToolPart(toolInvocation, codeBlockStartIndex);
      this.appendToolPartToDOM(part, toolInvocation);
    } else {
      const item = {
        kind: "tool",
        lazy: new Lazy(() => this.createToolPart(toolInvocation, codeBlockStartIndex)),
        toolInvocation,
        codeBlockStartIndex
      };
      this.lazyItems.push(item);
    }
  }
  /**
   * Appends a markdown item (e.g., an edit pill) to the subagent content part.
   * This is used to route codeblockUri parts with subAgentInvocationId to this subagent's container.
   *
   * When the caller has already created the content part eagerly (for example, a
   * pre-built `ChatMarkdownContentPart` wrapped in a factory), the caller MUST pass
   * that part as `eagerDisposable` so it is registered on this subagent part
   * immediately. Otherwise, if the subagent section is collapsed and the lazy item
   * is never materialized, the eagerly-created part would leak.
   */
  appendMarkdownItem(factory, _codeblocksPartId, _markdown, _originalParent, eagerDisposable) {
    if (eagerDisposable) {
      this._register(eagerDisposable);
    }
    if (this.isExpanded() || this.hasExpandedOnce) {
      const result = factory();
      this.appendMarkdownItemToDOM(result.domNode);
      if (result.disposable && result.disposable !== eagerDisposable) {
        this._register(result.disposable);
      }
    } else {
      const item = {
        kind: "markdown",
        lazy: new Lazy(factory),
        eagerlyRegistered: !!eagerDisposable
      };
      this.lazyItems.push(item);
    }
  }
  /**
   * Appends a hook item (blocked/warning) to the subagent content part.
   */
  appendHookItem(factory, hookPart) {
    const hookMessage = hookPart.stopReason ? hookPart.toolDisplayName ? localize("hook.subagent.blocked", "Blocked {0}", hookPart.toolDisplayName) : localize("hook.subagent.blockedGeneric", "Blocked by hook") : hookPart.toolDisplayName ? localize("hook.subagent.warning", "Warning for {0}", hookPart.toolDisplayName) : localize("hook.subagent.warningGeneric", "Hook warning");
    this.currentRunningToolMessage = hookMessage;
    this.currentRunningToolCallId = void 0;
    this.currentRunningToolIcon = hookPart.stopReason ? Codicon.error : Codicon.warning;
    this._updateToolPresentation();
    if (this.isExpanded() || this.hasExpandedOnce) {
      const result = factory();
      this.appendHookItemToDOM(result.domNode, hookPart);
      if (result.disposable) {
        this._register(result.disposable);
      }
    } else {
      const item = {
        kind: "hook",
        lazy: new Lazy(factory),
        hookPart
      };
      this.lazyItems.push(item);
    }
  }
  /**
   * Appends a hook item's DOM node to the wrapper.
   */
  appendHookItemToDOM(domNode, hookPart) {
    const itemWrapper = $(".chat-thinking-tool-wrapper");
    const icon = hookPart.stopReason ? Codicon.error : Codicon.warning;
    const iconElement = createThinkingIcon(icon);
    itemWrapper.appendChild(iconElement);
    itemWrapper.appendChild(domNode);
    if (!this.hasToolItems) {
      this.hasToolItems = true;
      if (this.wrapper) {
        this.wrapper.style.display = "";
      }
    }
    if (this.wrapper) {
      if (this.resultContainer) {
        this.wrapper.insertBefore(itemWrapper, this.resultContainer);
      } else {
        this.wrapper.appendChild(itemWrapper);
      }
    }
    this.lastItemWrapper = itemWrapper;
    this.layoutScheduler.schedule();
  }
  /**
   * Appends a markdown item's DOM node to the wrapper.
   */
  appendMarkdownItemToDOM(domNode) {
    if (!domNode.hasChildNodes() || domNode.textContent?.trim() === "") {
      return;
    }
    const itemWrapper = $(".chat-thinking-tool-wrapper");
    const iconElement = createThinkingIcon(Codicon.edit);
    itemWrapper.appendChild(domNode);
    itemWrapper.insertBefore(iconElement, itemWrapper.firstChild);
    if (this.wrapper) {
      if (this.resultContainer) {
        this.wrapper.insertBefore(itemWrapper, this.resultContainer);
      } else {
        this.wrapper.appendChild(itemWrapper);
      }
    }
    this.lastItemWrapper = itemWrapper;
    this.layoutScheduler.schedule();
  }
  shouldInitEarly() {
    return false;
  }
  shouldAnimateContent() {
    return !this.isActive;
  }
  shouldPrepareContentAnimation() {
    return true;
  }
  /**
   * Creates a ChatToolInvocationPart for the given tool invocation.
   */
  createToolPart(toolInvocation, codeBlockStartIndex) {
    const part = this.instantiationService.createInstance(
      ChatToolInvocationPart,
      toolInvocation,
      this.context,
      this.chatContentMarkdownRenderer,
      this.listPool,
      this.editorPool,
      this.currentWidthDelegate,
      this.announcedToolProgressKeys,
      codeBlockStartIndex
    );
    this._register(part);
    return part;
  }
  /**
   * Appends a tool part's DOM node to the wrapper with appropriate icon wrapper.
   */
  appendToolPartToDOM(part, toolInvocation) {
    const content = part.domNode;
    if (!content.hasChildNodes() || content.textContent?.trim() === "") {
      return;
    }
    const itemWrapper = $(".chat-thinking-tool-wrapper");
    const icon = getToolInvocationIcon(toolInvocation.toolId, toolInvocation.icon);
    const iconElement = createThinkingIcon(icon);
    itemWrapper.appendChild(content);
    if (toolInvocation.kind === "toolInvocation") {
      const shouldUseCarouselForTool = this._shouldUseCarouselForTool;
      const iconAutorun = autorun((r) => {
        const state = toolInvocation.state.read(r);
        const hasConfirmation = state.type === IChatToolInvocation.StateKind.WaitingForConfirmation || state.type === IChatToolInvocation.StateKind.WaitingForPostApproval;
        const shouldHideInline = shouldUseCarouselForTool?.(toolInvocation, state) === true;
        if (hasConfirmation) {
          iconElement.remove();
          if (shouldHideInline) {
            itemWrapper.style.display = "none";
          } else {
            itemWrapper.style.display = "";
          }
        } else {
          if (!iconElement.parentElement) {
            itemWrapper.insertBefore(iconElement, itemWrapper.firstChild);
          }
          if (this._useCarouselForConfirmations) {
            itemWrapper.style.display = "";
            this.ensurePlaceholderAtBottom();
          }
        }
        if (state.type === IChatToolInvocation.StateKind.Completed || state.type === IChatToolInvocation.StateKind.Cancelled) {
          queueMicrotask(() => this._toolStateTracking.delete(iconAutorun));
        }
      });
      this._toolStateTracking.add(iconAutorun);
    } else {
      itemWrapper.insertBefore(iconElement, itemWrapper.firstChild);
    }
    if (this.wrapper) {
      const anchor = this._confirmationPlaceholder ?? this.workingSpinnerElement ?? this.resultContainer;
      if (anchor) {
        this.wrapper.insertBefore(itemWrapper, anchor);
      } else {
        this.wrapper.appendChild(itemWrapper);
      }
    }
    this.lastItemWrapper = itemWrapper;
    this.layoutScheduler.schedule();
  }
  /**
   * Materializes a lazy item by creating the content and adding it to the DOM.
   */
  materializeLazyItem(item) {
    if (item.lazy.hasValue) {
      return;
    }
    if (item.kind === "tool") {
      const part = item.lazy.value;
      this.appendToolPartToDOM(part, item.toolInvocation);
    } else if (item.kind === "markdown") {
      const result = item.lazy.value;
      this.appendMarkdownItemToDOM(result.domNode);
      if (result.disposable && !item.eagerlyRegistered) {
        this._register(result.disposable);
      }
    } else if (item.kind === "hook") {
      const result = item.lazy.value;
      this.appendHookItemToDOM(result.domNode, item.hookPart);
      if (result.disposable) {
        this._register(result.disposable);
      }
    }
  }
  /**
   * Materializes all pending lazy content (prompt, tool items, result) when the section is expanded.
   * This is called when first expanded, but the wrapper must exist (created by base class initContent).
   */
  materializePendingContent() {
    if (!this.wrapper) {
      return;
    }
    if (this.pendingPromptRender) {
      this.pendingPromptRender = false;
      this.doRenderPromptSection();
    }
    for (const item of this.lazyItems) {
      this.materializeLazyItem(item);
    }
    if (this.pendingResultText) {
      const resultText = this.pendingResultText;
      this.pendingResultText = void 0;
      this.doRenderResultText(resultText);
    }
  }
  performLayout() {
    if (this.lastItemWrapper && this.wrapper) {
      const height = this.lastItemWrapper.offsetHeight;
      if (height > 0) {
        this.wrapper.style.setProperty("--chat-subagent-last-item-height", `${height}px`);
      }
    }
    if (this.isActive && !this.isInitiallyComplete && this.wrapper) {
      const scrollHeight = this.wrapper.scrollHeight;
      this.wrapper.scrollTop = scrollHeight;
    }
  }
  hasSameContent(other, _followingContent, _element) {
    return (other.kind === "toolInvocation" || other.kind === "toolInvocationSerialized") && ChatSubagentContentPart.isParentSubagentTool(other) && this.subAgentInvocationId === other.toolCallId;
  }
};
ChatSubagentContentPart = __decorateClass([
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IChatMarkdownAnchorService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IAccessibilityService),
  __decorateParam(13, IActionViewItemService),
  __decorateParam(14, IMenuService),
  __decorateParam(15, IContextKeyService),
  __decorateParam(16, IWorkbenchEnvironmentService)
], ChatSubagentContentPart);
export {
  ChatSubagentContentPart
};
