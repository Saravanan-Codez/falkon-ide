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
import { renderAsPlaintext } from "../../../../../../base/browser/markdownRenderer.js";
import { StandardKeyboardEvent } from "../../../../../../base/browser/keyboardEvent.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { MarkdownString, isMarkdownString } from "../../../../../../base/common/htmlContent.js";
import { KeyCode } from "../../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { isMacintosh } from "../../../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { generateUuid } from "../../../../../../base/common/uuid.js";
import { hasKey } from "../../../../../../base/common/types.js";
import { localize } from "../../../../../../nls.js";
import { IAccessibilityService } from "../../../../../../platform/accessibility/common/accessibility.js";
import { IMarkdownRendererService } from "../../../../../../platform/markdown/browser/markdownRenderer.js";
import { defaultButtonStyles, defaultCheckboxStyles, defaultInputBoxStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { Button } from "../../../../../../base/browser/ui/button/button.js";
import { InputBox } from "../../../../../../base/browser/ui/inputbox/inputBox.js";
import { DomScrollableElement } from "../../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Checkbox } from "../../../../../../base/browser/ui/toggle/toggle.js";
import { findQuestionValidationFailure, getDisplayedQuestionText, getOptionsWithDefaultsFirst } from "../../../common/chatService/chatQuestionCarouselHelpers.js";
import { ChatQuestionCarouselData } from "../../../common/model/chatProgressTypes/chatQuestionCarouselData.js";
import { isResponseVM } from "../../../common/model/chatViewModel.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { HoverPosition } from "../../../../../../base/browser/ui/hover/hoverWidget.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { AccessibilityVerbositySettingId } from "../../../../accessibility/browser/accessibilityConfiguration.js";
import { ScrollbarVisibility } from "../../../../../../base/common/scrollable.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ITerminalChatService } from "../../../../terminal/browser/terminal.js";
import { AgentHostAutoReplyAnswer } from "../../../../../../platform/agentHost/common/agentHostSchema.js";
import { ChatCollapsibleContentPart } from "./chatCollapsibleContentPart.js";
import "./media/chatQuestionCarousel.css";
const PREVIOUS_QUESTION_ACTION_ID = "workbench.action.chat.previousQuestion";
const NEXT_QUESTION_ACTION_ID = "workbench.action.chat.nextQuestion";
class ChatQuestionAnswerCollapsiblePart extends ChatCollapsibleContentPart {
  constructor(title, prefix, value, answerIcon, context, contentFactory, onDidChangeHeight, hoverService, configurationService) {
    super(title, context, void 0, hoverService, configurationService);
    this.prefix = prefix;
    this.value = value;
    this.answerIcon = answerIcon;
    this.contentFactory = contentFactory;
    this.onDidChangeHeight = onDidChangeHeight;
  }
  init() {
    const element = super.init();
    element.classList.toggle("chat-question-answer-expandable", !!this.contentFactory);
    if (this._collapseButton) {
      const labelElement = this._collapseButton.labelElement;
      labelElement.textContent = "";
      const icon = dom.$("span.chat-question-summary-answer-icon");
      icon.classList.add(...ThemeIcon.asClassNameArray(this.answerIcon));
      icon.setAttribute("aria-hidden", "true");
      const value = dom.$("span.chat-question-summary-answer-value");
      value.textContent = this.value;
      this._register(this.hoverService.setupDelayedHover(value, { content: this.value }));
      labelElement.appendChild(icon);
      if (this.prefix) {
        const prefix = dom.$("span.chat-question-summary-prefix");
        prefix.textContent = this.prefix;
        labelElement.append(prefix, labelElement.ownerDocument.createTextNode(" "));
      }
      labelElement.appendChild(value);
      if (!this.contentFactory) {
        this._collapseButton.element.tabIndex = -1;
        this._collapseButton.element.setAttribute("aria-disabled", "true");
        this._collapseButton.element.removeAttribute("aria-expanded");
        this._hoverChevron?.remove();
      }
    }
    return element;
  }
  initContent() {
    return this.contentFactory?.() ?? dom.$(".chat-question-summary-empty-content");
  }
  expansionDidChange() {
    this.onDidChangeHeight();
  }
  hasSameContent(_other, _followingContent, _element) {
    return false;
  }
}
let ChatQuestionCarouselPart = class extends Disposable {
  constructor(carousel, _context, _options, _markdownRendererService, _hoverService, _accessibilityService, _contextKeyService, _keybindingService, _commandService, _configurationService, _terminalChatService) {
    super();
    this.carousel = carousel;
    this._context = _context;
    this._options = _options;
    this._markdownRendererService = _markdownRendererService;
    this._hoverService = _hoverService;
    this._accessibilityService = _accessibilityService;
    this._contextKeyService = _contextKeyService;
    this._keybindingService = _keybindingService;
    this._commandService = _commandService;
    this._configurationService = _configurationService;
    this._terminalChatService = _terminalChatService;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._currentIndex = 0;
    this._answers = /* @__PURE__ */ new Map();
    this._isCollapsed = false;
    this._isSkipped = false;
    this._textInputBoxes = /* @__PURE__ */ new Map();
    this._singleSelectItems = /* @__PURE__ */ new Map();
    this._multiSelectCheckboxes = /* @__PURE__ */ new Map();
    this._freeformTextareas = /* @__PURE__ */ new Map();
    this._inputBoxes = this._register(new DisposableStore());
    this._questionRenderStore = this._register(new MutableDisposable());
    /**
     * Disposable store for interactive UI components (header, nav buttons, etc.)
     * that should be disposed when transitioning to summary view.
     */
    this._interactiveUIStore = this._register(new MutableDisposable());
    this.domNode = dom.$(".chat-question-carousel-container");
    this.domNode.classList.toggle("chat-question-carousel-conversation", carousel.answerPresentation === "conversation");
    this.domNode.id = generateUuid();
    this._inChatQuestionCarouselContextKey = ChatContextKeys.inChatQuestionCarousel.bindTo(this._contextKeyService);
    this._chatQuestionCarouselHasTerminalContextKey = ChatContextKeys.chatQuestionCarouselHasTerminal.bindTo(this._contextKeyService);
    const focusTracker = this._register(dom.trackFocus(this.domNode));
    this._register(focusTracker.onDidFocus(() => {
      this._inChatQuestionCarouselContextKey.set(true);
      this._chatQuestionCarouselHasTerminalContextKey.set(!!this.carousel.terminalId);
    }));
    this._register(focusTracker.onDidBlur(() => {
      this._inChatQuestionCarouselContextKey.set(false);
      this._chatQuestionCarouselHasTerminalContextKey.reset();
    }));
    this._register({ dispose: () => {
      this._inChatQuestionCarouselContextKey.reset();
      this._chatQuestionCarouselHasTerminalContextKey.reset();
    } });
    this.domNode.tabIndex = 0;
    this.domNode.setAttribute("role", "region");
    this.domNode.setAttribute("aria-roledescription", localize("chat.questionCarousel.roleDescription", "chat question"));
    this._updateAriaLabel();
    if (carousel instanceof ChatQuestionCarouselData) {
      if (typeof carousel.draftCurrentIndex === "number") {
        this._currentIndex = Math.max(0, Math.min(carousel.draftCurrentIndex, carousel.questions.length - 1));
      }
      if (typeof carousel.draftCollapsed === "boolean") {
        this._isCollapsed = carousel.draftCollapsed;
      }
      if (carousel.draftAnswers) {
        for (const [key, value] of Object.entries(carousel.draftAnswers)) {
          this._answers.set(key, value);
        }
      }
    }
    if (carousel.data) {
      for (const [key, value] of Object.entries(carousel.data)) {
        this._answers.set(key, value);
      }
    }
    const responseIsComplete = isResponseVM(this._context.element) && this._context.element.isComplete;
    if (carousel.isUsed || responseIsComplete) {
      this._isSkipped = true;
      this.domNode.classList.add("chat-question-carousel-used");
      this.renderSummary();
      return;
    }
    const interactiveStore = new DisposableStore();
    this._interactiveUIStore.value = interactiveStore;
    this._questionContainer = dom.$(".chat-question-carousel-content");
    this.domNode.append(this._questionContainer);
    this._headerActionsContainer = dom.$(".chat-question-header-actions");
    const collapseToggleTitle = localize("chat.questionCarousel.collapseTitle", "Collapse Questions");
    const collapseButton = interactiveStore.add(new Button(this._headerActionsContainer, { ...defaultButtonStyles, secondary: true, supportIcons: true }));
    collapseButton.element.classList.add("chat-question-collapse-toggle");
    collapseButton.element.setAttribute("aria-label", collapseToggleTitle);
    this._collapseButton = collapseButton;
    if (carousel.allowSkip) {
      this._closeButtonContainer = dom.$(".chat-question-close-container");
      const skipAllTitle = localize("chat.questionCarousel.skipAllTitle", "Skip all questions");
      const skipAllButton = interactiveStore.add(new Button(this._closeButtonContainer, { ...defaultButtonStyles, secondary: true, supportIcons: true }));
      skipAllButton.label = `$(${Codicon.close.id})`;
      skipAllButton.element.classList.add("chat-question-close");
      skipAllButton.element.setAttribute("aria-label", skipAllTitle);
      interactiveStore.add(this._hoverService.setupDelayedHover(skipAllButton.element, { content: skipAllTitle }));
      this._skipAllButton = skipAllButton;
    }
    if (carousel.terminalId) {
      this._focusTerminalButtonContainer = dom.$(".chat-question-focus-terminal-container");
      const focusTerminalTitle = localize("chat.questionCarousel.focusTerminalTitle", "Focus Terminal");
      const kbLabel = this._keybindingService.lookupKeybinding("workbench.action.chat.focusQuestionCarouselTerminal")?.getLabel();
      const focusTerminalAriaLabel = kbLabel ? localize("chat.questionCarousel.focusTerminalAriaLabel", "Focus Terminal ({0})", kbLabel) : focusTerminalTitle;
      const focusTerminalButton = interactiveStore.add(new Button(this._focusTerminalButtonContainer, { ...defaultButtonStyles, secondary: true, supportIcons: true }));
      focusTerminalButton.label = `$(${Codicon.terminal.id})`;
      focusTerminalButton.element.classList.add("chat-question-focus-terminal");
      focusTerminalButton.element.setAttribute("aria-label", focusTerminalAriaLabel);
      interactiveStore.add(this._hoverService.setupDelayedHover(focusTerminalButton.element, { content: focusTerminalTitle }));
      interactiveStore.add(focusTerminalButton.onDidClick(() => this._focusTerminal()));
      const terminalInstance = this._terminalChatService.getTerminalInstanceByExecutionId(carousel.terminalId);
      if (terminalInstance) {
        interactiveStore.add(terminalInstance.onDidInputData(() => {
          if (!this._isSkipped) {
            if (carousel instanceof ChatQuestionCarouselData) {
              carousel.dismissedByTerminalInput = true;
            }
            this.ignore();
          }
        }));
      }
    }
    interactiveStore.add(collapseButton.onDidClick(() => this.toggleCollapsed()));
    if (this._skipAllButton) {
      interactiveStore.add(this._skipAllButton.onDidClick(() => this.ignore()));
    }
    interactiveStore.add(dom.addDisposableListener(this.domNode, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.keyCode === KeyCode.Escape && this.carousel.allowSkip) {
        e.preventDefault();
        e.stopPropagation();
        this.ignore();
      } else if (event.keyCode === KeyCode.Enter && (event.metaKey || event.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        this.submit();
      } else if (event.keyCode === KeyCode.Enter && !event.shiftKey) {
        const target = e.target;
        const isTextInput = target.tagName === "INPUT" && target.type === "text";
        const isFreeformTextarea = target.tagName === "TEXTAREA" && target.classList.contains("chat-question-freeform-textarea");
        if (isTextInput || isFreeformTextarea) {
          e.preventDefault();
          e.stopPropagation();
          this.handleNextOrSubmit();
        }
      } else if ((event.ctrlKey || event.metaKey) && (event.keyCode === KeyCode.Backspace || event.keyCode === KeyCode.Delete)) {
        e.stopPropagation();
      }
    }));
    this.renderCurrentQuestion();
  }
  /**
   * Saves the current question's answer to the answers map.
   */
  saveCurrentAnswer() {
    const currentQuestion = this.carousel.questions[this._currentIndex];
    const answer = this.getCurrentAnswer();
    if (answer !== void 0) {
      this._answers.set(currentQuestion.id, answer);
    } else {
      this._answers.delete(currentQuestion.id);
    }
    if (currentQuestion?.validation && typeof answer === "string" && answer !== "") {
      const error = this.getValidationError(answer, currentQuestion.validation);
      if (error) {
        this.showValidationError(error);
      } else {
        this.clearValidationError();
      }
    } else {
      this.clearValidationError();
    }
    this.updateFooterState();
    this.persistDraftState();
  }
  persistDraftState() {
    if (this.carousel.isUsed || !(this.carousel instanceof ChatQuestionCarouselData)) {
      return;
    }
    this.carousel.draftAnswers = Object.fromEntries(this._answers.entries());
    this.carousel.draftCurrentIndex = this._currentIndex;
    this.carousel.draftCollapsed = this._isCollapsed;
  }
  toggleCollapsed() {
    this._isCollapsed = !this._isCollapsed;
    this.persistDraftState();
    this.updateCollapsedPresentation();
    this._onDidChangeHeight.fire();
  }
  _focusTerminal() {
    const terminalId = this.carousel.terminalId;
    if (!terminalId) {
      return;
    }
    this._commandService.executeCommand("workbench.action.terminal.chat.focusTerminalByExecutionId", terminalId);
  }
  updateCollapsedPresentation() {
    this.domNode.classList.toggle("chat-question-carousel-collapsed", this._isCollapsed);
    if (this._collapseButton) {
      const collapsed = this._isCollapsed;
      const buttonTitle = collapsed ? localize("chat.questionCarousel.expandTitle", "Expand Questions") : localize("chat.questionCarousel.collapseTitle", "Collapse Questions");
      const contentId = this.domNode.id;
      this._collapseButton.label = collapsed ? `$(${Codicon.chevronUp.id})` : `$(${Codicon.chevronDown.id})`;
      this._collapseButton.element.setAttribute("aria-label", buttonTitle);
      this._collapseButton.element.setAttribute("aria-expanded", String(!collapsed));
      this._collapseButton.element.setAttribute("aria-controls", contentId);
      this._collapseButton.setTitle(buttonTitle);
    }
  }
  /**
   * Navigates the carousel by the given delta.
   * @param delta Negative for previous, positive for next
   */
  navigate(delta) {
    const newIndex = this._currentIndex + delta;
    if (newIndex >= 0 && newIndex < this.carousel.questions.length) {
      this.saveCurrentAnswer();
      this._currentIndex = newIndex;
      this.persistDraftState();
      this.renderCurrentQuestion(true);
      this.domNode.focus();
    }
  }
  /**
   * Handles the next/submit behavior for keyboard and option selection flows.
   * Either advances to the next question or submits when on the last question.
   */
  handleNextOrSubmit() {
    this.saveCurrentAnswer();
    if (!this.validateCurrentQuestion()) {
      return;
    }
    if (this._currentIndex < this.carousel.questions.length - 1) {
      this._currentIndex++;
      this.persistDraftState();
      this.renderCurrentQuestion(true);
    } else {
      if (!this.validateRequiredFields()) {
        return;
      }
      this._options.onSubmit(this._answers);
      this.hideAndShowSummary();
    }
  }
  /**
   * Handles explicit submit action from the dedicated submit button.
   */
  submit() {
    this.saveCurrentAnswer();
    if (!this.validateCurrentQuestion()) {
      return;
    }
    if (!this.validateRequiredFields()) {
      return;
    }
    this._options.onSubmit(this._answers);
    this.hideAndShowSummary();
  }
  /**
   * Focuses the container element and announces the question for screen reader users.
   */
  _focusContainerAndAnnounce() {
    this.domNode.focus();
    const question = this.carousel.questions[this._currentIndex];
    if (question) {
      const questionText = getDisplayedQuestionText(question);
      const messageContent = this.getQuestionText(questionText);
      const questionCount = this.carousel.questions.length;
      const alertMessage = questionCount === 1 ? messageContent : localize("chat.questionCarousel.questionAlertMulti", "Question {0} of {1}: {2}", this._currentIndex + 1, questionCount, messageContent);
      this._accessibilityService.alert(alertMessage);
    }
  }
  /**
   * Hides the carousel UI and shows a summary of answers.
   */
  hideAndShowSummary() {
    if (this._store.isDisposed) {
      return;
    }
    this._isSkipped = true;
    this.domNode.classList.add("chat-question-carousel-used");
    this.clearInteractiveResources();
    dom.clearNode(this.domNode);
    this.renderSummary();
    this._onDidChangeHeight.fire();
  }
  /**
   * Clears and disposes all interactive UI resources (header, nav buttons, input boxes, etc.)
   * and resets references to disposed elements.
   */
  clearInteractiveResources() {
    this._interactiveUIStore.clear();
    this._questionRenderStore.clear();
    this._inputBoxes.clear();
    this._textInputBoxes.clear();
    this._singleSelectItems.clear();
    this._multiSelectCheckboxes.clear();
    this._freeformTextareas.clear();
    this._prevButton = void 0;
    this._nextButton = void 0;
    this._submitButton = void 0;
    this._skipAllButton = void 0;
    this._questionContainer = void 0;
    this._headerActionsContainer = void 0;
    this._closeButtonContainer = void 0;
    this._focusTerminalButtonContainer = void 0;
    this._collapseButton = void 0;
    this._footerRow = void 0;
    this._stepIndicator = void 0;
    this._submitHint = void 0;
    this._inputScrollable = void 0;
  }
  layoutInputScrollable(inputScrollable) {
    if (!this._questionContainer) {
      return;
    }
    const scrollableNode = inputScrollable.getDomNode();
    const scrollableContent = scrollableNode.firstElementChild;
    if (!dom.isHTMLElement(scrollableContent)) {
      return;
    }
    if (scrollableNode.style.height !== "" || scrollableNode.style.maxHeight !== "") {
      scrollableNode.style.height = "";
      scrollableNode.style.maxHeight = "";
    }
    if (scrollableContent.style.height !== "" || scrollableContent.style.maxHeight !== "") {
      scrollableContent.style.height = "";
      scrollableContent.style.maxHeight = "";
    }
    const maxContainerHeight = this._questionContainer.clientHeight;
    const computedStyle = dom.getWindow(this._questionContainer).getComputedStyle(this._questionContainer);
    const contentVerticalPadding = Number.parseFloat(computedStyle.paddingTop || "0") + Number.parseFloat(computedStyle.paddingBottom || "0");
    const nonScrollableContentHeight = Array.from(this._questionContainer.children).filter((child) => child !== scrollableNode).reduce((sum, child) => sum + child.offsetHeight, 0);
    const availableScrollableHeight = Math.floor(maxContainerHeight - contentVerticalPadding - nonScrollableContentHeight);
    const contentScrollableHeight = scrollableContent.scrollHeight;
    const constrainedScrollableHeight = Math.max(0, Math.min(availableScrollableHeight, contentScrollableHeight));
    const constrainedScrollableHeightPx = `${constrainedScrollableHeight}px`;
    if (scrollableNode.style.height !== constrainedScrollableHeightPx || scrollableNode.style.maxHeight !== constrainedScrollableHeightPx) {
      scrollableNode.style.height = constrainedScrollableHeightPx;
      scrollableNode.style.maxHeight = constrainedScrollableHeightPx;
    }
    if (scrollableContent.style.height !== constrainedScrollableHeightPx || scrollableContent.style.maxHeight !== constrainedScrollableHeightPx) {
      scrollableContent.style.height = constrainedScrollableHeightPx;
      scrollableContent.style.maxHeight = constrainedScrollableHeightPx;
    }
    inputScrollable.scanDomNode();
  }
  /**
   * Skips the carousel with default values - called when user wants to proceed quickly.
   * Returns defaults for all questions.
   *
   * `carousel.isUsed` covers resolution that did not come from this part: a
   * voice answer dismisses the carousel directly, and a later auto-skip on
   * request submit would otherwise overwrite the answer that actually landed
   * with defaults.
   */
  skip() {
    if (this._isSkipped || this.carousel.isUsed || !this.carousel.allowSkip) {
      return false;
    }
    const defaults = this.getDefaultAnswers();
    this._options.onSubmit(defaults);
    this._answers.clear();
    for (const [key, value] of defaults) {
      this._answers.set(key, value);
    }
    this.hideAndShowSummary();
    return true;
  }
  /**
   * Ignores the carousel completely - called when user wants to dismiss without data.
   * Returns undefined to signal the carousel was ignored.
   *
   * Guarded on `carousel.isUsed` for the same reason as {@link skip}.
   */
  ignore() {
    if (this._isSkipped || this.carousel.isUsed || !this.carousel.allowSkip) {
      return false;
    }
    this._isSkipped = true;
    this._options.onSubmit(void 0);
    this.clearInteractiveResources();
    this.domNode.classList.add("chat-question-carousel-used");
    dom.clearNode(this.domNode);
    this.renderTerminalStateMessage();
    this._onDidChangeHeight.fire();
    return true;
  }
  /**
   * Collects default values for all questions in the carousel.
   */
  getDefaultAnswers() {
    const answers = /* @__PURE__ */ new Map();
    for (const question of this.carousel.questions) {
      const defaultAnswer = this.getDefaultAnswerForQuestion(question);
      if (defaultAnswer !== void 0) {
        answers.set(question.id, defaultAnswer);
      }
    }
    return answers;
  }
  /**
   * Gets the default answer for a specific question.
   */
  getDefaultAnswerForQuestion(question) {
    switch (question.type) {
      case "text":
        return typeof question.defaultValue === "string" ? question.defaultValue : void 0;
      case "singleSelect": {
        const defaultOptionId = typeof question.defaultValue === "string" ? question.defaultValue : void 0;
        const defaultOption = defaultOptionId !== void 0 ? question.options?.find((opt) => opt.id === defaultOptionId) : void 0;
        const selectedValue = defaultOption?.value;
        return selectedValue !== void 0 ? { selectedValue, freeformValue: void 0 } : void 0;
      }
      case "multiSelect": {
        const defaultIds = Array.isArray(question.defaultValue) ? question.defaultValue : typeof question.defaultValue === "string" ? [question.defaultValue] : [];
        const selectedValues = question.options?.filter((opt) => defaultIds.includes(opt.id)).map((opt) => opt.value).filter((v) => v !== void 0) ?? [];
        return selectedValues.length > 0 ? { selectedValues, freeformValue: void 0 } : void 0;
      }
      default:
        return typeof question.defaultValue === "string" ? question.defaultValue : Array.isArray(question.defaultValue) ? { selectedValues: question.defaultValue } : void 0;
    }
  }
  /**
   * Returns whether auto-focus should be enabled.
   * Disabled when screen reader mode is active or when explicitly disabled via options.
   */
  _shouldAutoFocus() {
    if (this._options.shouldAutoFocus === false) {
      return false;
    }
    return !this._accessibilityService.isScreenReaderOptimized();
  }
  /**
   * Updates the aria-label of the carousel container based on the current question.
   */
  _updateAriaLabel() {
    const question = this.carousel.questions[this._currentIndex];
    if (!question) {
      this.domNode.setAttribute("aria-label", localize("chat.questionCarousel.label", "Chat question"));
      return;
    }
    const questionText = getDisplayedQuestionText(question);
    const messageContent = this.getQuestionText(questionText);
    const questionCount = this.carousel.questions.length;
    let label;
    if (questionCount === 1) {
      label = localize("chat.questionCarousel.singleQuestionLabel", "Chat question: {0}", messageContent);
    } else {
      label = localize("chat.questionCarousel.multiQuestionLabel", "Chat question {0} of {1}: {2}", this._currentIndex + 1, questionCount, messageContent);
    }
    const verbose = this._configurationService.getValue(AccessibilityVerbositySettingId.ChatQuestionCarousel);
    if (verbose && this.carousel.terminalId) {
      const kbLabel = this._keybindingService.lookupKeybinding("workbench.action.chat.focusQuestionCarouselTerminal")?.getLabel();
      if (kbLabel) {
        label = localize("chat.questionCarousel.combinedFocusTerminalHint", "{0} Use {1} to focus the terminal.", label, kbLabel);
      } else {
        label = localize("chat.questionCarousel.combinedFocusTerminalHintNoKb", "{0} Use the Focus Terminal from Question Carousel command to focus the terminal.", label);
      }
    }
    this.domNode.setAttribute("aria-label", label);
  }
  /**
   * Focuses the carousel container element.
   */
  focus() {
    this.domNode.focus();
  }
  /**
   * Returns whether the carousel container has focus.
   */
  hasFocus() {
    return dom.isAncestorOfActiveElement(this.domNode);
  }
  navigateToPreviousQuestion() {
    if (this._currentIndex <= 0) {
      return false;
    }
    this.navigate(-1);
    return true;
  }
  navigateToNextQuestion() {
    if (this._currentIndex >= this.carousel.questions.length - 1) {
      return false;
    }
    this.navigate(1);
    return true;
  }
  focusTerminal() {
    if (!this.carousel.terminalId) {
      return false;
    }
    this._focusTerminal();
    return true;
  }
  renderCurrentQuestion(focusContainerForScreenReader = false) {
    if (!this._questionContainer) {
      return;
    }
    const questionRenderStore = new DisposableStore();
    this._questionRenderStore.value = questionRenderStore;
    this._inputScrollable = void 0;
    this._inputBoxes.clear();
    this._textInputBoxes.clear();
    this._singleSelectItems.clear();
    this._multiSelectCheckboxes.clear();
    this._freeformTextareas.clear();
    dom.clearNode(this._questionContainer);
    const question = this.carousel.questions[this._currentIndex];
    if (!question) {
      return;
    }
    const headerRow = dom.$(".chat-question-header-row");
    const titleRow = dom.$(".chat-question-title-row");
    if (this.carousel.message && this._currentIndex === 0) {
      const messageMd = isMarkdownString(this.carousel.message) ? MarkdownString.lift(this.carousel.message) : new MarkdownString(this.carousel.message);
      const carouselMessage = dom.$(".chat-question-carousel-message");
      const renderedMessage = questionRenderStore.add(this._markdownRendererService.render(messageMd));
      carouselMessage.appendChild(renderedMessage.element);
      headerRow.appendChild(carouselMessage);
    }
    const questionText = getDisplayedQuestionText(question);
    if (questionText) {
      const title = dom.$(".chat-question-title");
      const messageContent = this.getQuestionText(questionText);
      title.setAttribute("aria-label", messageContent);
      const rawValue = isMarkdownString(questionText) ? questionText.value : questionText;
      const suffixed = question.required ? `${rawValue} *` : rawValue;
      const md = isMarkdownString(questionText) ? MarkdownString.lift({ ...questionText, value: suffixed }) : new MarkdownString(suffixed);
      const rendered = questionRenderStore.add(this._markdownRendererService.render(md));
      title.appendChild(rendered.element);
      titleRow.appendChild(title);
    }
    headerRow.appendChild(titleRow);
    if (this._headerActionsContainer) {
      dom.clearNode(this._headerActionsContainer);
      if (this._focusTerminalButtonContainer) {
        this._headerActionsContainer.appendChild(this._focusTerminalButtonContainer);
      }
      if (this._closeButtonContainer) {
        this._headerActionsContainer.appendChild(this._closeButtonContainer);
      }
      if (this._collapseButton) {
        this._headerActionsContainer.appendChild(this._collapseButton.element);
      }
      titleRow.appendChild(this._headerActionsContainer);
    }
    this._questionContainer.appendChild(headerRow);
    if (question.description) {
      const descriptionEl = dom.$(".chat-question-description");
      descriptionEl.textContent = question.description;
      this._questionContainer.appendChild(descriptionEl);
    }
    const inputContainer = dom.$(".chat-question-input-container");
    if (question.detailedMessage) {
      const detailedMd = isMarkdownString(question.detailedMessage) ? MarkdownString.lift(question.detailedMessage) : new MarkdownString(question.detailedMessage);
      const detailedMessageEl = dom.$(".chat-question-detailed-message");
      const renderedDetailedMessage = questionRenderStore.add(this._markdownRendererService.render(detailedMd));
      detailedMessageEl.appendChild(renderedDetailedMessage.element);
      inputContainer.appendChild(detailedMessageEl);
    }
    this.renderInput(inputContainer, question);
    const inputScrollable = questionRenderStore.add(new DomScrollableElement(inputContainer, {
      vertical: ScrollbarVisibility.Visible,
      horizontal: ScrollbarVisibility.Hidden,
      consumeMouseWheelIfScrollbarIsNeeded: true
    }));
    this._inputScrollable = inputScrollable;
    const inputScrollableNode = inputScrollable.getDomNode();
    inputScrollableNode.classList.add("chat-question-input-scrollable");
    this._questionContainer.appendChild(inputScrollableNode);
    this._validationMessageElement = dom.$(".chat-question-validation-message");
    this._validationMessageElement.style.display = "none";
    this._questionContainer.appendChild(this._validationMessageElement);
    const isSingleQuestion = this.carousel.questions.length === 1;
    if (!isSingleQuestion) {
      this.renderFooter();
    } else {
      this.renderSingleQuestionFooter();
    }
    let relayoutScheduled = false;
    const relayoutScheduler = questionRenderStore.add(new MutableDisposable());
    const scheduleLayoutInputScrollable = () => {
      if (relayoutScheduled) {
        return;
      }
      relayoutScheduled = true;
      relayoutScheduler.value = dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(this.domNode), () => {
        relayoutScheduled = false;
        this.layoutInputScrollable(inputScrollable);
      });
    };
    const inputResizeObserver = questionRenderStore.add(new dom.DisposableResizeObserver("ChatQuestionCarouselPart.inputScrollable", () => scheduleLayoutInputScrollable()));
    questionRenderStore.add(inputResizeObserver.observe(inputScrollableNode));
    questionRenderStore.add(inputResizeObserver.observe(inputContainer));
    questionRenderStore.add(dom.addDisposableListener(dom.getWindow(this.domNode), dom.EventType.RESIZE, () => scheduleLayoutInputScrollable()));
    scheduleLayoutInputScrollable();
    questionRenderStore.add(dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(this.domNode), () => {
      inputContainer.scrollTop = 0;
      inputContainer.scrollLeft = 0;
      inputScrollable.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
      inputScrollable.scanDomNode();
    }));
    this._updateAriaLabel();
    this.updateCollapsedPresentation();
    if (focusContainerForScreenReader && this._accessibilityService.isScreenReaderOptimized()) {
      this._focusContainerAndAnnounce();
    }
    this._onDidChangeHeight.fire();
  }
  /**
   * Renders or updates the persistent footer with nav arrows, step indicator, and submit button.
   */
  renderFooter() {
    if (!this._footerRow) {
      const interactiveStore = this._interactiveUIStore.value;
      if (!interactiveStore) {
        return;
      }
      this._footerRow = dom.$(".chat-question-footer-row");
      const leftControls = dom.$(".chat-question-footer-left.chat-question-carousel-nav");
      leftControls.setAttribute("role", "navigation");
      leftControls.setAttribute("aria-label", localize("chat.questionCarousel.navigation", "Question navigation"));
      const arrowsContainer = dom.$(".chat-question-nav-arrows");
      const previousLabel = this.getLabelWithKeybinding(localize("previous", "Previous"), PREVIOUS_QUESTION_ACTION_ID);
      const prevButton = interactiveStore.add(new Button(arrowsContainer, { ...defaultButtonStyles, secondary: true, supportIcons: true }));
      prevButton.element.classList.add("chat-question-nav-arrow", "chat-question-nav-prev");
      prevButton.label = `$(${Codicon.chevronLeft.id})`;
      prevButton.element.setAttribute("aria-label", previousLabel);
      interactiveStore.add(this._hoverService.setupDelayedHover(prevButton.element, { content: previousLabel }));
      interactiveStore.add(prevButton.onDidClick(() => this.navigate(-1)));
      this._prevButton = prevButton;
      const nextLabel = this.getLabelWithKeybinding(localize("next", "Next"), NEXT_QUESTION_ACTION_ID);
      const nextButton = interactiveStore.add(new Button(arrowsContainer, { ...defaultButtonStyles, secondary: true, supportIcons: true }));
      nextButton.element.classList.add("chat-question-nav-arrow", "chat-question-nav-next");
      nextButton.label = `$(${Codicon.chevronRight.id})`;
      nextButton.element.setAttribute("aria-label", nextLabel);
      interactiveStore.add(this._hoverService.setupDelayedHover(nextButton.element, { content: nextLabel }));
      interactiveStore.add(nextButton.onDidClick(() => this.navigate(1)));
      this._nextButton = nextButton;
      leftControls.appendChild(arrowsContainer);
      this._stepIndicator = dom.$(".chat-question-step-indicator");
      leftControls.appendChild(this._stepIndicator);
      this._footerRow.appendChild(leftControls);
      const rightControls = dom.$(".chat-question-footer-right");
      const hint = dom.$("span.chat-question-submit-hint");
      hint.textContent = isMacintosh ? localize("chat.questionCarousel.submitHintMac", "\u2318\u23CE to submit") : localize("chat.questionCarousel.submitHintOther", "Ctrl+Enter to submit");
      rightControls.appendChild(hint);
      this._submitHint = hint;
      const submitButton = interactiveStore.add(new Button(rightControls, { ...defaultButtonStyles }));
      submitButton.element.classList.add("chat-question-submit-button");
      submitButton.label = localize("submit", "Submit");
      interactiveStore.add(submitButton.onDidClick(() => this.submit()));
      this._submitButton = submitButton;
      this._footerRow.appendChild(rightControls);
      this.domNode.append(this._footerRow);
    }
    this.updateFooterState();
  }
  /**
   * Updates the footer nav button enabled state and step indicator text.
   */
  updateFooterState() {
    if (this._prevButton) {
      this._prevButton.enabled = this._currentIndex > 0;
    }
    if (this._nextButton) {
      const canAdvance = this._currentIndex < this.carousel.questions.length - 1;
      const question = this.carousel.questions[this._currentIndex];
      const answer = this._answers.get(question?.id);
      const hasAnswer = answer !== void 0 && answer !== "";
      const hasValidationError = !!this._currentValidationError;
      this._nextButton.enabled = canAdvance && (!question?.required || hasAnswer) && !hasValidationError;
    }
    if (this._stepIndicator) {
      this._stepIndicator.textContent = localize(
        "chat.questionCarousel.stepIndicator",
        "{0}/{1}",
        this._currentIndex + 1,
        this.carousel.questions.length
      );
    }
    if (this._submitButton) {
      const isLastQuestion = this._currentIndex === this.carousel.questions.length - 1;
      this._submitButton.element.style.display = isLastQuestion ? "" : "none";
      if (this._submitHint) {
        this._submitHint.style.display = isLastQuestion ? "" : "none";
      }
    }
  }
  /**
   * Renders a simplified footer with just a submit button for single-question multi-select carousels.
   */
  renderSingleQuestionFooter() {
    if (!this._footerRow) {
      const interactiveStore = this._interactiveUIStore.value;
      if (!interactiveStore) {
        return;
      }
      this._footerRow = dom.$(".chat-question-footer-row");
      const leftControls = dom.$(".chat-question-footer-left.chat-question-carousel-nav");
      leftControls.setAttribute("role", "navigation");
      leftControls.setAttribute("aria-label", localize("chat.questionCarousel.navigation", "Question navigation"));
      this._footerRow.appendChild(leftControls);
      const rightControls = dom.$(".chat-question-footer-right");
      const hint = dom.$("span.chat-question-submit-hint");
      hint.textContent = isMacintosh ? localize("chat.questionCarousel.submitHintMac", "\u2318\u23CE to submit") : localize("chat.questionCarousel.submitHintOther", "Ctrl+Enter to submit");
      rightControls.appendChild(hint);
      this._submitHint = hint;
      const submitButton = interactiveStore.add(new Button(rightControls, { ...defaultButtonStyles }));
      submitButton.element.classList.add("chat-question-submit-button");
      submitButton.label = localize("submit", "Submit");
      interactiveStore.add(submitButton.onDidClick(() => this.submit()));
      this._submitButton = submitButton;
      this._footerRow.appendChild(rightControls);
      this.domNode.append(this._footerRow);
    }
  }
  getLabelWithKeybinding(label, actionId) {
    const keybindingLabel = this._keybindingService.lookupKeybinding(actionId, this._contextKeyService)?.getLabel();
    return keybindingLabel ? localize("chat.questionCarousel.labelWithKeybinding", "{0} ({1})", label, keybindingLabel) : label;
  }
  renderInput(container, question) {
    switch (question.type) {
      case "text":
        this.renderTextInput(container, question);
        break;
      case "singleSelect":
        this.renderSingleSelect(container, question);
        break;
      case "multiSelect":
        this.renderMultiSelect(container, question);
        break;
    }
  }
  /**
   * Sets up auto-resize behavior for a textarea element.
   * @returns A function that triggers the resize manually (useful for initial sizing).
   */
  setupTextareaAutoResize(textarea) {
    const autoResize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      if (this._inputScrollable) {
        this.layoutInputScrollable(this._inputScrollable);
      }
      this._onDidChangeHeight.fire();
    };
    this._inputBoxes.add(dom.addDisposableListener(textarea, dom.EventType.INPUT, autoResize));
    return autoResize;
  }
  renderTextInput(container, question) {
    const inputBox = this._inputBoxes.add(new InputBox(container, void 0, {
      placeholder: localize("chat.questionCarousel.enterText", "Enter your answer"),
      inputBoxStyles: defaultInputBoxStyles,
      validationOptions: question.validation ? {
        validation: (value) => {
          if (!value && !question.required) {
            return null;
          }
          const error = this.getValidationError(value, question.validation);
          if (error) {
            return { type: 2, content: error };
          }
          return null;
        }
      } : void 0
    }));
    this._inputBoxes.add(inputBox.onDidChange(() => {
      this.saveCurrentAnswer();
    }));
    const previousAnswer = this._answers.get(question.id);
    if (previousAnswer !== void 0) {
      inputBox.value = String(previousAnswer);
    } else if (question.defaultValue !== void 0) {
      inputBox.value = String(question.defaultValue);
    }
    this._textInputBoxes.set(question.id, inputBox);
    if (this._shouldAutoFocus()) {
      this._inputBoxes.add(dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(inputBox.element), () => inputBox.focus()));
    }
  }
  renderSingleSelect(container, question) {
    const orderedOptions = getOptionsWithDefaultsFirst(question);
    const selectContainer = dom.$(".chat-question-list");
    selectContainer.setAttribute("role", "listbox");
    selectContainer.setAttribute("aria-label", question.title);
    selectContainer.tabIndex = 0;
    container.appendChild(selectContainer);
    const previousAnswer = this._answers.get(question.id);
    const prevSingle = typeof previousAnswer === "object" && previousAnswer !== null && hasKey(previousAnswer, { selectedValue: true }) ? previousAnswer : void 0;
    const previousFreeform = prevSingle?.freeformValue;
    const previousSelectedValue = prevSingle?.selectedValue;
    const defaultOptionId = typeof question.defaultValue === "string" ? question.defaultValue : void 0;
    let selectedIndex = -1;
    orderedOptions.forEach(({ option }, index) => {
      if (previousSelectedValue !== void 0 && option.value === previousSelectedValue) {
        selectedIndex = index;
      } else if (selectedIndex === -1 && !previousFreeform && defaultOptionId !== void 0 && option.id === defaultOptionId) {
        selectedIndex = index;
      }
    });
    const listItems = [];
    const indicators = [];
    const updateSelection = (newIndex) => {
      listItems.forEach((item, i) => {
        const isSelected = i === newIndex;
        item.classList.toggle("selected", isSelected);
        item.setAttribute("aria-selected", String(isSelected));
        const indicator = indicators[i];
        indicator.classList.toggle("codicon", isSelected);
        indicator.classList.toggle("codicon-check", isSelected);
      });
      if (newIndex >= 0 && newIndex < listItems.length) {
        selectContainer.setAttribute("aria-activedescendant", listItems[newIndex].id);
      }
      const data = this._singleSelectItems.get(question.id);
      if (data) {
        data.selectedIndex = newIndex;
      }
      this.saveCurrentAnswer();
    };
    orderedOptions.forEach(({ option }, index) => {
      const isSelected = index === selectedIndex;
      const listItem = dom.$(".chat-question-list-item");
      listItem.setAttribute("role", "option");
      listItem.setAttribute("aria-selected", String(isSelected));
      listItem.setAttribute("aria-label", localize("chat.questionCarousel.optionLabel", "Option {0}: {1}", index + 1, option.label));
      listItem.id = `option-${question.id}-${index}`;
      listItem.tabIndex = -1;
      const number = dom.$(".chat-question-list-number");
      number.textContent = `${index + 1}`;
      listItem.appendChild(number);
      const indicator = dom.$(".chat-question-list-indicator");
      if (isSelected) {
        indicator.classList.add("codicon", "codicon-check");
      }
      indicators.push(indicator);
      const label = dom.$(".chat-question-list-label");
      const separatorIndex = option.label.indexOf(" - ");
      if (separatorIndex !== -1) {
        listItem.classList.add("has-description");
        const titleSpan = dom.$("span.chat-question-list-label-title");
        titleSpan.textContent = option.label.substring(0, separatorIndex);
        label.appendChild(titleSpan);
        const descSpan = dom.$("span.chat-question-list-label-desc");
        descSpan.textContent = option.label.substring(separatorIndex + 3);
        label.appendChild(descSpan);
      } else {
        label.textContent = option.label;
      }
      listItem.appendChild(label);
      listItem.appendChild(indicator);
      if (isSelected) {
        listItem.classList.add("selected");
      }
      this._inputBoxes.add(dom.addDisposableListener(listItem, dom.EventType.CLICK, (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateSelection(index);
        const freeform = this._freeformTextareas.get(question.id);
        if (freeform) {
          freeform.value = "";
        }
        this.handleNextOrSubmit();
      }));
      this._inputBoxes.add(this._hoverService.setupDelayedHover(listItem, {
        content: option.label,
        position: { hoverPosition: HoverPosition.BELOW },
        appearance: { showPointer: true }
      }));
      selectContainer.appendChild(listItem);
      listItems.push(listItem);
    });
    this._singleSelectItems.set(question.id, { items: listItems, selectedIndex, optionIndices: orderedOptions.map((o) => o.originalIndex) });
    if (selectedIndex >= 0 && selectedIndex < listItems.length) {
      selectContainer.setAttribute("aria-activedescendant", listItems[selectedIndex].id);
    }
    let freeformTextarea;
    if (question.allowFreeformInput !== false) {
      const freeformContainer = dom.$(".chat-question-freeform");
      const freeformNumber = dom.$(".chat-question-freeform-number");
      freeformNumber.textContent = `${orderedOptions.length + 1}`;
      freeformContainer.appendChild(freeformNumber);
      freeformTextarea = dom.$("textarea.chat-question-freeform-textarea");
      freeformTextarea.placeholder = localize("chat.questionCarousel.enterCustomAnswer", "Enter custom answer");
      freeformTextarea.rows = 1;
      if (previousFreeform !== void 0) {
        freeformTextarea.value = previousFreeform;
      }
      const autoResize = this.setupTextareaAutoResize(freeformTextarea);
      const capturedFreeform = freeformTextarea;
      this._inputBoxes.add(dom.addDisposableListener(capturedFreeform, dom.EventType.INPUT, () => {
        if (capturedFreeform.value.length > 0) {
          updateSelection(-1);
        } else {
          this.saveCurrentAnswer();
        }
      }));
      freeformContainer.appendChild(freeformTextarea);
      container.appendChild(freeformContainer);
      this._freeformTextareas.set(question.id, freeformTextarea);
      if (previousFreeform !== void 0) {
        this._inputBoxes.add(dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(capturedFreeform), () => autoResize()));
      }
    }
    this._inputBoxes.add(dom.addDisposableListener(selectContainer, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      const data = this._singleSelectItems.get(question.id);
      if (!data || !listItems.length) {
        return;
      }
      let newIndex = data.selectedIndex;
      if (event.keyCode === KeyCode.DownArrow) {
        e.preventDefault();
        newIndex = Math.min(data.selectedIndex + 1, listItems.length - 1);
      } else if (event.keyCode === KeyCode.UpArrow) {
        e.preventDefault();
        newIndex = Math.max(data.selectedIndex - 1, 0);
      } else if ((event.keyCode === KeyCode.Enter || event.keyCode === KeyCode.Space) && !event.metaKey && !event.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        this.handleNextOrSubmit();
        return;
      } else if (event.keyCode >= KeyCode.Digit1 && event.keyCode <= KeyCode.Digit9) {
        const numberIndex = event.keyCode - KeyCode.Digit1;
        if (numberIndex < listItems.length) {
          e.preventDefault();
          updateSelection(numberIndex);
        } else if (freeformTextarea && numberIndex === listItems.length) {
          e.preventDefault();
          updateSelection(-1);
          freeformTextarea.focus();
        }
        return;
      }
      if (newIndex !== data.selectedIndex && newIndex >= 0) {
        updateSelection(newIndex);
      }
    }));
    if (this._shouldAutoFocus()) {
      if (freeformTextarea && previousFreeform) {
        const capturedFreeform = freeformTextarea;
        this._inputBoxes.add(dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(capturedFreeform), () => {
          capturedFreeform.focus();
        }));
      } else if (listItems.length > 0) {
        const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;
        if (selectedIndex < 0) {
          updateSelection(0);
        }
        this._inputBoxes.add(dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(selectContainer), () => {
          listItems[focusIndex]?.focus();
        }));
      }
    }
  }
  renderMultiSelect(container, question) {
    const orderedOptions = getOptionsWithDefaultsFirst(question);
    const selectContainer = dom.$(".chat-question-list");
    selectContainer.setAttribute("role", "listbox");
    selectContainer.setAttribute("aria-multiselectable", "true");
    selectContainer.setAttribute("aria-label", question.title);
    selectContainer.tabIndex = 0;
    container.appendChild(selectContainer);
    const previousAnswer = this._answers.get(question.id);
    const prevMulti = typeof previousAnswer === "object" && previousAnswer !== null && hasKey(previousAnswer, { selectedValues: true }) ? previousAnswer : void 0;
    const previousFreeform = prevMulti?.freeformValue;
    const previousSelectedValues = prevMulti?.selectedValues ?? [];
    const defaultOptionIds = Array.isArray(question.defaultValue) ? question.defaultValue : typeof question.defaultValue === "string" ? [question.defaultValue] : [];
    const checkboxes = [];
    const listItems = [];
    let focusedIndex = 0;
    let firstCheckedIndex = -1;
    orderedOptions.forEach(({ option }, index) => {
      let isChecked = false;
      if (previousSelectedValues && previousSelectedValues.length > 0) {
        isChecked = previousSelectedValues.includes(option.value);
      } else if (!previousFreeform && defaultOptionIds.includes(option.id)) {
        isChecked = true;
      }
      const listItem = dom.$(".chat-question-list-item.multi-select");
      listItem.setAttribute("role", "option");
      listItem.setAttribute("aria-selected", String(isChecked));
      listItem.setAttribute("aria-label", localize("chat.questionCarousel.optionLabel", "Option {0}: {1}", index + 1, option.label));
      listItem.id = `option-${question.id}-${index}`;
      listItem.tabIndex = -1;
      const number = dom.$(".chat-question-list-number");
      number.textContent = `${index + 1}`;
      listItem.appendChild(number);
      const checkbox = this._inputBoxes.add(new Checkbox(option.label, isChecked, defaultCheckboxStyles));
      checkbox.domNode.classList.add("chat-question-list-checkbox");
      checkbox.domNode.tabIndex = -1;
      listItem.appendChild(checkbox.domNode);
      const label = dom.$(".chat-question-list-label");
      const separatorIndex = option.label.indexOf(" - ");
      if (separatorIndex !== -1) {
        listItem.classList.add("has-description");
        const titleSpan = dom.$("span.chat-question-list-label-title");
        titleSpan.textContent = option.label.substring(0, separatorIndex);
        label.appendChild(titleSpan);
        const descSpan = dom.$("span.chat-question-list-label-desc");
        descSpan.textContent = option.label.substring(separatorIndex + 3);
        label.appendChild(descSpan);
      } else {
        label.textContent = option.label;
      }
      listItem.appendChild(label);
      if (isChecked) {
        listItem.classList.add("checked");
        if (firstCheckedIndex === -1) {
          firstCheckedIndex = index;
        }
      }
      this._inputBoxes.add(checkbox.onChange(() => {
        listItem.classList.toggle("checked", checkbox.checked);
        listItem.setAttribute("aria-selected", String(checkbox.checked));
        this.saveCurrentAnswer();
      }));
      this._inputBoxes.add(dom.addDisposableListener(listItem, dom.EventType.CLICK, (e) => {
        focusedIndex = index;
        if (e.target !== checkbox.domNode && !checkbox.domNode.contains(e.target)) {
          checkbox.domNode.click();
        }
      }));
      this._inputBoxes.add(this._hoverService.setupDelayedHover(listItem, {
        content: option.label,
        position: { hoverPosition: HoverPosition.BELOW },
        appearance: { showPointer: true }
      }));
      selectContainer.appendChild(listItem);
      checkboxes.push(checkbox);
      listItems.push(listItem);
    });
    this._multiSelectCheckboxes.set(question.id, { checkboxes, optionIndices: orderedOptions.map((o) => o.originalIndex) });
    let freeformTextarea;
    if (question.allowFreeformInput !== false) {
      const freeformContainer = dom.$(".chat-question-freeform");
      const freeformNumber = dom.$(".chat-question-freeform-number");
      freeformNumber.textContent = `${orderedOptions.length + 1}`;
      freeformContainer.appendChild(freeformNumber);
      freeformTextarea = dom.$("textarea.chat-question-freeform-textarea");
      freeformTextarea.placeholder = localize("chat.questionCarousel.enterCustomAnswer", "Enter custom answer");
      freeformTextarea.rows = 1;
      if (previousFreeform !== void 0) {
        freeformTextarea.value = previousFreeform;
      }
      const autoResize = this.setupTextareaAutoResize(freeformTextarea);
      this._inputBoxes.add(dom.addDisposableListener(freeformTextarea, dom.EventType.INPUT, () => this.saveCurrentAnswer()));
      freeformContainer.appendChild(freeformTextarea);
      container.appendChild(freeformContainer);
      this._freeformTextareas.set(question.id, freeformTextarea);
      if (previousFreeform !== void 0) {
        this._inputBoxes.add(dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(freeformTextarea), () => autoResize()));
      }
    }
    this._inputBoxes.add(dom.addDisposableListener(selectContainer, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (!listItems.length) {
        return;
      }
      if (event.keyCode === KeyCode.DownArrow) {
        e.preventDefault();
        focusedIndex = Math.min(focusedIndex + 1, listItems.length - 1);
        listItems[focusedIndex].focus();
      } else if (event.keyCode === KeyCode.UpArrow) {
        e.preventDefault();
        focusedIndex = Math.max(focusedIndex - 1, 0);
        listItems[focusedIndex].focus();
      } else if (event.keyCode === KeyCode.Enter && !event.metaKey && !event.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        this.handleNextOrSubmit();
      } else if (event.keyCode === KeyCode.Space) {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < checkboxes.length) {
          checkboxes[focusedIndex].domNode.click();
        }
      } else if (event.keyCode >= KeyCode.Digit1 && event.keyCode <= KeyCode.Digit9) {
        const numberIndex = event.keyCode - KeyCode.Digit1;
        if (numberIndex < checkboxes.length) {
          e.preventDefault();
          checkboxes[numberIndex].domNode.click();
        } else if (freeformTextarea && numberIndex === checkboxes.length) {
          e.preventDefault();
          freeformTextarea.focus();
        }
      }
    }));
    if (this._shouldAutoFocus()) {
      if (freeformTextarea && previousFreeform) {
        const capturedFreeform = freeformTextarea;
        this._inputBoxes.add(dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(capturedFreeform), () => {
          capturedFreeform.focus();
        }));
      } else if (listItems.length > 0) {
        const initialFocusIndex = firstCheckedIndex >= 0 ? firstCheckedIndex : 0;
        focusedIndex = initialFocusIndex;
        this._inputBoxes.add(dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(selectContainer), () => {
          listItems[initialFocusIndex]?.focus();
        }));
      }
    }
  }
  getCurrentAnswer() {
    const question = this.carousel.questions[this._currentIndex];
    if (!question) {
      return void 0;
    }
    switch (question.type) {
      case "text": {
        const inputBox = this._textInputBoxes.get(question.id);
        return inputBox?.value ?? (typeof question.defaultValue === "string" ? question.defaultValue : Array.isArray(question.defaultValue) ? { selectedValues: question.defaultValue } : void 0);
      }
      case "singleSelect": {
        const data = this._singleSelectItems.get(question.id);
        let selectedValue = void 0;
        if (data && data.selectedIndex >= 0) {
          const originalIndex = data.optionIndices[data.selectedIndex];
          selectedValue = originalIndex !== void 0 ? question.options?.[originalIndex]?.value : void 0;
        }
        if (selectedValue === void 0 && typeof question.defaultValue === "string") {
          const defaultOption = question.options?.find((opt) => opt.id === question.defaultValue);
          selectedValue = defaultOption?.value;
        }
        const freeformTextarea = this._freeformTextareas.get(question.id);
        const freeformValue = freeformTextarea?.value !== "" ? freeformTextarea?.value : void 0;
        if (freeformValue) {
          return { selectedValue: void 0, freeformValue };
        }
        if (selectedValue !== void 0) {
          return { selectedValue, freeformValue: void 0 };
        }
        return void 0;
      }
      case "multiSelect": {
        const data = this._multiSelectCheckboxes.get(question.id);
        const selectedValues = [];
        if (data) {
          data.checkboxes.forEach((checkbox, index) => {
            if (checkbox.checked) {
              const originalIndex = data.optionIndices[index];
              const value = originalIndex !== void 0 ? question.options?.[originalIndex]?.value : void 0;
              if (value !== void 0) {
                selectedValues.push(value);
              }
            }
          });
        }
        const freeformTextarea = this._freeformTextareas.get(question.id);
        const freeformValue = freeformTextarea?.value !== "" ? freeformTextarea?.value : void 0;
        if (freeformValue || selectedValues.length > 0) {
          return { selectedValues, freeformValue };
        }
        return void 0;
      }
      default:
        return typeof question.defaultValue === "string" ? question.defaultValue : Array.isArray(question.defaultValue) ? { selectedValues: question.defaultValue } : void 0;
    }
  }
  /**
   * Renders a terminal-state message (Skipped/Answered) when the carousel is
   * dismissed without structured answers.
   */
  renderTerminalStateMessage() {
    const summaryContainer = dom.$(".chat-question-carousel-summary");
    const isDismissedByTerminal = this.carousel instanceof ChatQuestionCarouselData && this.carousel.dismissedByTerminalInput;
    if (this.carousel.answeredExternally) {
      const answeredMessage = dom.$(".chat-question-summary-answered");
      answeredMessage.textContent = localize("chat.questionCarousel.answered", "Answered");
      summaryContainer.appendChild(answeredMessage);
    } else {
      const skippedMessage = dom.$(".chat-question-summary-skipped");
      skippedMessage.textContent = isDismissedByTerminal ? localize("chat.questionCarousel.deferredToTerminal", "Deferring to user's input in the terminal") : localize("chat.questionCarousel.skipped", "Skipped question");
      summaryContainer.appendChild(skippedMessage);
    }
    this.domNode.appendChild(summaryContainer);
  }
  /**
   * Renders a summary of answers when the carousel is already used.
   */
  renderSummary() {
    if (this._answers.size === 0) {
      if (this.carousel.answerPresentation === "conversation") {
        if (this.carousel.autoReply) {
          this.renderConversationSummary({
            answerFallback: localize("chat.questionCarousel.answeredAutomatically", "Answered automatically"),
            answerIcon: Codicon.copilotCompact
          });
        } else if (this.carousel.answeredExternally) {
          this.renderTerminalStateMessage();
        } else if (this.carousel.isUsed) {
          this.renderConversationSummary({
            answerFallback: localize("chat.questionCarousel.skippedConversation", "Skipped question"),
            answerIcon: Codicon.closeCompact,
            hideAnswerPrefix: true
          });
        }
        return;
      }
      if (this.carousel.isUsed) {
        this.renderTerminalStateMessage();
      }
      return;
    }
    if (this.carousel.answerPresentation === "conversation") {
      this.renderConversationSummary();
      return;
    }
    const summaryContainer = dom.$(".chat-question-carousel-summary");
    for (const question of this.carousel.questions) {
      const answer = this._answers.get(question.id);
      const summaryItem = dom.$(".chat-question-summary-item");
      const questionRow = dom.$("div.chat-question-summary-label");
      const questionText = getDisplayedQuestionText(question);
      let labelText = typeof questionText === "string" ? questionText : questionText.value;
      labelText = labelText.replace(/[:\s]+$/, "");
      questionRow.textContent = localize("chat.questionCarousel.summaryQuestion", "Q: {0}", labelText);
      summaryItem.appendChild(questionRow);
      if (answer !== void 0) {
        const formattedAnswer = this.formatAnswerForSummary(question, answer);
        const answerRow = dom.$("div.chat-question-summary-answer-title");
        answerRow.textContent = localize("chat.questionCarousel.summaryAnswer", "A: {0}", formattedAnswer);
        summaryItem.appendChild(answerRow);
      } else {
        const unanswered = dom.$("div.chat-question-summary-unanswered");
        unanswered.textContent = localize("chat.questionCarousel.notAnsweredYet", "Not answered yet");
        summaryItem.appendChild(unanswered);
      }
      summaryContainer.appendChild(summaryItem);
    }
    this.domNode.appendChild(summaryContainer);
  }
  renderConversationSummary(options) {
    const summaryStore = new DisposableStore();
    this._interactiveUIStore.value = summaryStore;
    const summaryContainer = dom.$(".chat-question-carousel-summary.chat-question-carousel-conversation-summary");
    this.domNode.setAttribute("aria-label", localize("chat.questionCarousel.answeredQuestions", "Answered chat questions"));
    for (const question of this.carousel.questions) {
      const answer = this._answers.get(question.id);
      const summaryItem = dom.$(".chat-question-summary-item");
      const questionValue = dom.$(".chat-question-summary-question");
      const questionText = getDisplayedQuestionText(question);
      const displayedQuestion = (typeof questionText === "string" ? questionText : questionText.value).replace(/[:\s]+$/, "");
      const questionPrefix = dom.$("span.chat-question-summary-prefix");
      questionPrefix.textContent = localize("chat.questionCarousel.questionPrefix", "Question:");
      const questionTextValue = dom.$("span.chat-question-summary-question-value");
      questionTextValue.textContent = displayedQuestion;
      summaryStore.add(this._hoverService.setupDelayedHover(questionTextValue, { content: displayedQuestion }));
      questionValue.append(questionPrefix, questionValue.ownerDocument.createTextNode(" "), questionTextValue);
      summaryItem.appendChild(questionValue);
      const decision = dom.$(".chat-question-summary-decision");
      const answerValue = answer === void 0 ? options?.answerFallback ?? localize("chat.questionCarousel.conversationNotAnswered", "Not answered yet") : this.formatAnswerForSummary(question, answer);
      const answerPrefix = options?.hideAnswerPrefix ? void 0 : localize("chat.questionCarousel.answerPrefix", "Answered:");
      const answerTitle = answerPrefix ? localize("chat.questionCarousel.conversationAnswer", "{0} {1}", answerPrefix, answerValue) : answerValue;
      const collapsibleContext = {
        ...this._context,
        content: this._context.content ?? [],
        contentIndex: this._context.contentIndex ?? 0
      };
      const answerPart = summaryStore.add(new ChatQuestionAnswerCollapsiblePart(
        answerTitle,
        answerPrefix,
        answerValue,
        options?.answerIcon ?? (this.carousel.autoReply ? Codicon.copilotCompact : Codicon.comment),
        collapsibleContext,
        question.options?.length ? () => this.renderConversationOptions(question, answer) : void 0,
        () => this._onDidChangeHeight.fire(),
        this._hoverService,
        this._configurationService
      ));
      answerPart.domNode.classList.add("chat-question-answer-collapsible");
      decision.appendChild(answerPart.domNode);
      summaryItem.appendChild(decision);
      summaryContainer.appendChild(summaryItem);
    }
    this.domNode.appendChild(summaryContainer);
  }
  renderConversationOptions(question, answer) {
    const selectedValues = /* @__PURE__ */ new Set();
    let freeformValue;
    if (typeof answer === "string") {
      selectedValues.add(answer);
    } else if (answer) {
      if (hasKey(answer, { selectedValues: true })) {
        for (const selectedValue of answer.selectedValues) {
          selectedValues.add(selectedValue);
        }
        freeformValue = answer.freeformValue;
      } else {
        const singleAnswer = answer;
        if (singleAnswer.selectedValue !== void 0) {
          selectedValues.add(singleAnswer.selectedValue);
        }
        freeformValue = singleAnswer.freeformValue;
      }
    }
    const container = dom.$(".chat-question-summary-option-details.chat-used-context-list");
    const optionsTitle = dom.$(".chat-question-summary-options-title");
    optionsTitle.textContent = localize("chat.questionCarousel.optionsTitle", "Options");
    container.appendChild(optionsTitle);
    const optionList = dom.$("ul.chat-question-summary-option-list");
    for (const option of question.options ?? []) {
      const selected = selectedValues.has(option.value);
      const optionItem = dom.$("li.chat-question-summary-option");
      optionItem.classList.toggle("selected", selected);
      optionItem.setAttribute("aria-label", selected ? localize("chat.questionCarousel.selectedOptionAriaLabel", "{0}, selected", option.label) : option.label);
      const optionLabel = dom.$("span.chat-question-summary-option-label");
      optionLabel.textContent = option.label;
      optionItem.appendChild(optionLabel);
      if (selected) {
        optionItem.appendChild(this.renderSelectedOptionState());
      }
      optionList.appendChild(optionItem);
    }
    if (freeformValue) {
      const customItem = dom.$("li.chat-question-summary-option.selected");
      customItem.setAttribute("aria-label", localize("chat.questionCarousel.selectedCustomAnswerAriaLabel", "Custom answer: {0}, selected", freeformValue));
      const customLabel = dom.$("span.chat-question-summary-option-label");
      customLabel.textContent = localize("chat.questionCarousel.customAnswer", "Custom answer: {0}", freeformValue);
      customItem.append(customLabel, this.renderSelectedOptionState());
      optionList.appendChild(customItem);
    }
    container.appendChild(optionList);
    return container;
  }
  renderSelectedOptionState() {
    const selectedState = dom.$("span.chat-question-summary-option-selected");
    const selectedIcon = dom.$("span");
    selectedIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.checkCompact));
    selectedIcon.setAttribute("aria-hidden", "true");
    selectedState.appendChild(selectedIcon);
    return selectedState;
  }
  /**
   * Formats an answer for display in the summary.
   */
  formatAnswerForSummary(question, answer) {
    if (this.carousel.autoReply && answer === AgentHostAutoReplyAnswer) {
      return localize("chat.questionCarousel.autoReplyAnswer", "The user is not available to answer your question. Choose a pragmatic option best aligned with the context of the request.");
    }
    switch (question.type) {
      case "text":
        return String(answer);
      case "singleSelect": {
        if (typeof answer === "object") {
          const { selectedValue, freeformValue } = answer;
          const selectedLabel = selectedValue !== void 0 ? question.options?.find((opt) => opt.value === selectedValue)?.label : void 0;
          if (freeformValue) {
            return freeformValue;
          }
          return selectedLabel ?? String(selectedValue ?? "");
        }
        const label = question.options?.find((opt) => opt.value === answer)?.label;
        return label ?? String(answer);
      }
      case "multiSelect": {
        if (typeof answer === "object" && hasKey(answer, { selectedValues: true })) {
          const { selectedValues, freeformValue } = answer;
          const labels = selectedValues.map((v) => question.options?.find((opt) => opt.value === v)?.label ?? String(v));
          if (freeformValue) {
            labels.push(freeformValue);
          }
          return labels.join(localize("chat.questionCarousel.listSeparator", ", "));
        }
        return String(answer);
      }
      default:
        return String(answer);
    }
  }
  getQuestionText(questionText) {
    const md = typeof questionText === "string" ? new MarkdownString(questionText) : questionText;
    return renderAsPlaintext(md);
  }
  /**
   * Validates the current question's answer against its validation rules.
   * Returns true if valid, false if validation errors were shown.
   */
  validateCurrentQuestion() {
    const question = this.carousel.questions[this._currentIndex];
    if (!question) {
      return true;
    }
    const answer = this._answers.get(question.id);
    if (question.required && (answer === void 0 || answer === "")) {
      this.showValidationError(localize("chat.questionCarousel.required", "This field is required"));
      return false;
    }
    if (question.type === "text" && question.validation && typeof answer === "string" && answer !== "") {
      const error = this.getValidationError(answer, question.validation);
      if (error) {
        this.showValidationError(error);
        return false;
      }
    }
    this.clearValidationError();
    return true;
  }
  /**
   * Validates that all required questions have been answered.
   * Returns true if all required fields are satisfied.
   */
  validateRequiredFields() {
    for (let i = 0; i < this.carousel.questions.length; i++) {
      const question = this.carousel.questions[i];
      if (!question.required) {
        continue;
      }
      const answer = this._answers.get(question.id);
      if (answer === void 0 || answer === "") {
        this.saveCurrentAnswer();
        this._currentIndex = i;
        this.persistDraftState();
        this.renderCurrentQuestion(true);
        this.showValidationError(localize("chat.questionCarousel.required", "This field is required"));
        return false;
      }
    }
    return true;
  }
  /**
   * Returns a validation error message for the given value, or undefined if valid.
   */
  getValidationError(value, validation) {
    const failure = findQuestionValidationFailure(value, validation);
    switch (failure?.kind) {
      case void 0:
        return void 0;
      case "minLength":
        return localize("chat.questionCarousel.validation.minLength", "Minimum length is {0}", failure.limit);
      case "maxLength":
        return localize("chat.questionCarousel.validation.maxLength", "Maximum length is {0}", failure.limit);
      case "email":
        return localize("chat.questionCarousel.validation.email", "Please enter a valid email address");
      case "uri":
        return localize("chat.questionCarousel.validation.uri", "Please enter a valid URI");
      case "date":
        return localize("chat.questionCarousel.validation.date", "Please enter a valid date (YYYY-MM-DD)");
      case "dateTime":
        return localize("chat.questionCarousel.validation.dateTime", "Please enter a valid date-time");
      case "number":
        return localize("chat.questionCarousel.validation.number", "Please enter a valid number");
      case "integer":
        return localize("chat.questionCarousel.validation.integer", "Please enter a valid integer");
      case "minimum":
        return localize("chat.questionCarousel.validation.minimum", "Minimum value is {0}", failure.limit);
      case "maximum":
        return localize("chat.questionCarousel.validation.maximum", "Maximum value is {0}", failure.limit);
    }
  }
  showValidationError(message) {
    this._currentValidationError = message;
    if (this._validationMessageElement) {
      this._validationMessageElement.textContent = message;
      this._validationMessageElement.style.display = "";
    }
  }
  clearValidationError() {
    this._currentValidationError = void 0;
    if (this._validationMessageElement) {
      this._validationMessageElement.textContent = "";
      this._validationMessageElement.style.display = "none";
    }
  }
  hasSameContent(other, _followingContent, element) {
    if (!this._isSkipped && !this.carousel.isUsed && isResponseVM(element) && element.isComplete) {
      return false;
    }
    return other.kind === "questionCarousel" && other === this.carousel;
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
  dispose() {
    if (!this._isSkipped && !this.carousel.isUsed) {
      this.saveCurrentAnswer();
    }
    super.dispose();
  }
};
ChatQuestionCarouselPart = __decorateClass([
  __decorateParam(3, IMarkdownRendererService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IAccessibilityService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, ICommandService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, ITerminalChatService)
], ChatQuestionCarouselPart);
export {
  ChatQuestionCarouselPart
};
