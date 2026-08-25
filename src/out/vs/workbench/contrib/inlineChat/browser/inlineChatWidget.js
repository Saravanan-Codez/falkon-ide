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
import { $, getActiveElement, getTotalHeight, getWindow, h, reset, trackFocus } from "../../../../base/browser/dom.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../nls.js";
import { IAccessibleViewService } from "../../../../platform/accessibility/browser/accessibleView.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { MenuWorkbenchButtonBar } from "../../../../platform/actions/browser/buttonbar.js";
import { createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { IMarkdownRendererService } from "../../../../platform/markdown/browser/markdownRenderer.js";
import product from "../../../../platform/product/common/product.js";
import { asCssVariable, asCssVariableName, editorBackground, inputBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from "../../../common/theme.js";
import { IChatEntitlementService } from "../../../services/chat/common/chatEntitlementService.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { ChatWidget } from "../../chat/browser/widget/chatWidget.js";
import { chatRequestBackground } from "../../chat/common/widget/chatColors.js";
import { ChatContextKeys } from "../../chat/common/actions/chatContextKeys.js";
import { ChatMode } from "../../chat/common/chatModes.js";
import { ChatAgentVoteDirection, IChatService } from "../../chat/common/chatService/chatService.js";
import { isResponseVM } from "../../chat/common/model/chatViewModel.js";
import { CTX_INLINE_CHAT_FOCUSED, CTX_INLINE_CHAT_RESPONSE_FOCUSED, inlineChatBackground, inlineChatForeground } from "../common/inlineChat.js";
import "./media/inlineChat.css";
let InlineChatWidget = class {
  constructor(location, options, _instantiationService, contextKeyService, keybindingService, accessibilityService, configurationService, accessibleViewService, _textModelResolverService, chatService, hoverService, chatEntitlementService, markdownRendererService) {
    this._instantiationService = _instantiationService;
    this._textModelResolverService = _textModelResolverService;
    this._elements = h(
      "div.inline-chat@root",
      [
        h("div.chat-widget@chatWidget"),
        h("div.accessibleViewer@accessibleViewer"),
        h("div.status@status", [
          h("div.label.info.hidden@infoLabel"),
          h("div.actions.hidden@toolbar1"),
          h("div.label.status.hidden@statusLabel"),
          h("div.actions.secondary.hidden@toolbar2"),
          h("div.label.disclaimer.hidden@disclaimerLabel")
        ])
      ]
    );
    this._store = new DisposableStore();
    this._onDidChangeHeight = this._store.add(new Emitter());
    this.onDidChangeHeight = Event.filter(this._onDidChangeHeight.event, (_) => !this.#isLayouting);
    this.#requestInProgress = observableValue(this, false);
    this.requestInProgress = this.#requestInProgress;
    this.#isLayouting = false;
    this.#options = options;
    this.#keybindingService = keybindingService;
    this.#accessibilityService = accessibilityService;
    this.#configurationService = configurationService;
    this.#accessibleViewService = accessibleViewService;
    this.#chatService = chatService;
    this.#chatEntitlementService = chatEntitlementService;
    this.#markdownRendererService = markdownRendererService;
    this.scopedContextKeyService = this._store.add(contextKeyService.createScoped(this._elements.chatWidget));
    const scopedInstaService = _instantiationService.createChild(
      new ServiceCollection([
        IContextKeyService,
        this.scopedContextKeyService
      ]),
      this._store
    );
    this.chatWidget = scopedInstaService.createInstance(
      ChatWidget,
      location,
      { isInlineChat: true },
      {
        autoScroll: true,
        defaultElementHeight: 32,
        renderStyle: "minimal",
        renderInputOnTop: false,
        renderFollowups: true,
        supportsFileReferences: true,
        filter: (item) => {
          if (!isResponseVM(item) || item.errorDetails) {
            return true;
          }
          const emptyResponse = item.response.value.length === 0;
          if (emptyResponse) {
            return false;
          }
          if (item.response.value.every((item2) => item2.kind === "textEditGroup" && options.chatWidgetViewOptions?.rendererOptions?.renderTextEditsAsSummary?.(item2.uri))) {
            return false;
          }
          return true;
        },
        dndContainer: this._elements.root,
        defaultMode: ChatMode.Ask,
        ...options.chatWidgetViewOptions
      },
      {
        listForeground: inlineChatForeground,
        listBackground: inlineChatBackground,
        overlayBackground: EDITOR_DRAG_AND_DROP_BACKGROUND,
        inputEditorBackground: inputBackground,
        resultEditorBackground: editorBackground
      }
    );
    this._elements.root.classList.toggle("in-zone-widget", !!options.inZoneWidget);
    this.chatWidget.render(this._elements.chatWidget);
    this._elements.chatWidget.style.setProperty(asCssVariableName(chatRequestBackground), asCssVariable(inlineChatBackground));
    this.chatWidget.setVisible(true);
    this._store.add(this.chatWidget);
    const ctxResponse = ChatContextKeys.isResponse.bindTo(this.scopedContextKeyService);
    const ctxResponseVote = ChatContextKeys.responseVote.bindTo(this.scopedContextKeyService);
    const ctxResponseSupportIssues = ChatContextKeys.responseSupportsIssueReporting.bindTo(this.scopedContextKeyService);
    const ctxResponseError = ChatContextKeys.responseHasError.bindTo(this.scopedContextKeyService);
    const ctxResponseErrorFiltered = ChatContextKeys.responseIsFiltered.bindTo(this.scopedContextKeyService);
    const viewModelStore = this._store.add(new DisposableStore());
    this._store.add(this.chatWidget.onDidChangeViewModel(() => {
      viewModelStore.clear();
      const viewModel = this.chatWidget.viewModel;
      if (!viewModel) {
        return;
      }
      viewModelStore.add(toDisposable(() => {
        toolbar2.context = void 0;
        ctxResponse.reset();
        ctxResponseVote.reset();
        ctxResponseError.reset();
        ctxResponseErrorFiltered.reset();
        ctxResponseSupportIssues.reset();
      }));
      viewModelStore.add(viewModel.onDidChange(() => {
        this.#requestInProgress.set(viewModel.model.requestInProgress.get(), void 0);
        const last = viewModel.getItems().at(-1);
        toolbar2.context = last;
        ctxResponse.set(isResponseVM(last));
        ctxResponseVote.set(isResponseVM(last) ? last.vote === ChatAgentVoteDirection.Down ? "down" : last.vote === ChatAgentVoteDirection.Up ? "up" : "" : "");
        ctxResponseError.set(isResponseVM(last) && last.errorDetails !== void 0);
        ctxResponseErrorFiltered.set(!!(isResponseVM(last) && last.errorDetails?.responseIsFiltered));
        ctxResponseSupportIssues.set(isResponseVM(last) && (last.agent?.metadata.supportIssueReporting ?? false));
        this._onDidChangeHeight.fire();
      }));
      this._onDidChangeHeight.fire();
    }));
    this._store.add(this.chatWidget.onDidChangeContentHeight(() => {
      this._onDidChangeHeight.fire();
    }));
    this.#ctxResponseFocused = CTX_INLINE_CHAT_RESPONSE_FOCUSED.bindTo(contextKeyService);
    const tracker = this._store.add(trackFocus(this.domNode));
    this._store.add(tracker.onDidBlur(() => this.#ctxResponseFocused.set(false)));
    this._store.add(tracker.onDidFocus(() => this.#ctxResponseFocused.set(true)));
    this.#ctxInputEditorFocused = CTX_INLINE_CHAT_FOCUSED.bindTo(contextKeyService);
    this._store.add(this.chatWidget.inputEditor.onDidFocusEditorWidget(() => this.#ctxInputEditorFocused.set(true)));
    this._store.add(this.chatWidget.inputEditor.onDidBlurEditorWidget(() => this.#ctxInputEditorFocused.set(false)));
    if (options.statusMenuId) {
      const statusMenuOptions = options.statusMenuId.options;
      const statusButtonBar = scopedInstaService.createInstance(MenuWorkbenchButtonBar, this._elements.toolbar1, options.statusMenuId.menu, {
        toolbarOptions: { primaryGroup: "0_main" },
        telemetrySource: options.chatWidgetViewOptions?.menus?.telemetrySource,
        menuOptions: { renderShortTitle: true },
        ...statusMenuOptions
      });
      this._store.add(statusButtonBar.onDidChange(() => this._onDidChangeHeight.fire()));
      this._store.add(statusButtonBar);
    }
    const toolbar2 = scopedInstaService.createInstance(MenuWorkbenchToolBar, this._elements.toolbar2, options.secondaryMenuId ?? MenuId.for(""), {
      telemetrySource: options.chatWidgetViewOptions?.menus?.telemetrySource,
      menuOptions: { renderShortTitle: true, shouldForwardArgs: true },
      actionViewItemProvider: (action, options2) => {
        return createActionViewItem(scopedInstaService, action, options2);
      }
    });
    this._store.add(toolbar2.onDidChangeMenuItems(() => this._onDidChangeHeight.fire()));
    this._store.add(toolbar2);
    this._store.add(this.#configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AccessibilityVerbositySettingId.InlineChat)) {
        this.#updateAriaLabel();
      }
    }));
    this._elements.root.tabIndex = 0;
    this._elements.statusLabel.tabIndex = 0;
    this.#updateAriaLabel();
    this.#setupDisclaimer();
    this._store.add(hoverService.setupManagedHover(getDefaultHoverDelegate("element"), this._elements.statusLabel, () => {
      return this._elements.statusLabel.dataset["title"];
    }));
    this._store.add(this.#chatService.onDidPerformUserAction((e) => {
      if (isEqual(e.sessionResource, this.chatWidget.viewModel?.model.sessionResource) && e.action.kind === "vote") {
        this.updateStatus(localize("feedbackThanks", "Thank you for your feedback!"), { resetAfter: 1250 });
      }
    }));
  }
  #ctxInputEditorFocused;
  #ctxResponseFocused;
  #requestInProgress;
  #isLayouting;
  #options;
  #keybindingService;
  #accessibilityService;
  #configurationService;
  #accessibleViewService;
  #chatService;
  #chatEntitlementService;
  #markdownRendererService;
  #updateAriaLabel() {
    this._elements.root.ariaLabel = this.#accessibleViewService.getOpenAriaHint(AccessibilityVerbositySettingId.InlineChat);
    if (this.#accessibilityService.isScreenReaderOptimized()) {
      let label = defaultAriaLabel;
      if (this.#configurationService.getValue(AccessibilityVerbositySettingId.InlineChat)) {
        const kbLabel = this.#keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
        label = kbLabel ? localize("inlineChat.accessibilityHelp", "Inline Chat Input, Use {0} for Inline Chat Accessibility Help.", kbLabel) : localize("inlineChat.accessibilityHelpNoKb", "Inline Chat Input, Run the Inline Chat Accessibility Help command for more information.");
      }
      this.chatWidget.inputEditor.updateOptions({ ariaLabel: label });
    }
  }
  #setupDisclaimer() {
    const disposables = this._store.add(new DisposableStore());
    this._store.add(autorun((reader) => {
      disposables.clear();
      reset(this._elements.disclaimerLabel);
      const sentiment = this.#chatEntitlementService.sentimentObs.read(reader);
      const anonymous = this.#chatEntitlementService.anonymousObs.read(reader);
      const requestInProgress = this.#chatService.requestInProgressObs.read(reader);
      const showDisclaimer = !sentiment.completed && anonymous && !requestInProgress;
      this._elements.disclaimerLabel.classList.toggle("hidden", !showDisclaimer);
      if (showDisclaimer) {
        const renderedMarkdown = disposables.add(this.#markdownRendererService.render(new MarkdownString(localize({ key: "termsDisclaimer", comment: ['{Locked="]({2})"}', '{Locked="]({3})"}'] }, "By continuing with {0} Copilot, you agree to {1}'s [Terms]({2}) and [Privacy Statement]({3})", product.defaultChatAgent?.provider?.default?.name ?? "", product.defaultChatAgent?.provider?.default?.name ?? "", product.defaultChatAgent?.termsStatementUrl ?? "", product.defaultChatAgent?.privacyStatementUrl ?? ""), { isTrusted: true })));
        this._elements.disclaimerLabel.appendChild(renderedMarkdown.element);
      }
      this._onDidChangeHeight.fire();
    }));
  }
  dispose() {
    this._store.dispose();
  }
  get domNode() {
    return this._elements.root;
  }
  layout(widgetDim) {
    const contentHeight = this.contentHeight;
    this.#isLayouting = true;
    try {
      this._doLayout(widgetDim);
    } finally {
      this.#isLayouting = false;
      if (this.contentHeight !== contentHeight) {
        this._onDidChangeHeight.fire();
      }
    }
  }
  _doLayout(dimension) {
    const extraHeight = this._getExtraHeight();
    const statusHeight = getTotalHeight(this._elements.status);
    this._elements.root.style.height = `${dimension.height - extraHeight}px`;
    this._elements.root.style.width = `${dimension.width}px`;
    this.chatWidget.layout(
      dimension.height - statusHeight - extraHeight,
      dimension.width
    );
  }
  /**
   * The content height of this widget is the size that would require no scrolling
   */
  get contentHeight() {
    const data = {
      chatWidgetContentHeight: this.chatWidget.contentHeight,
      statusHeight: getTotalHeight(this._elements.status),
      extraHeight: this._getExtraHeight()
    };
    const result = data.chatWidgetContentHeight + data.statusHeight + data.extraHeight;
    return result;
  }
  get minHeight() {
    let maxWidgetOutputHeight = 100;
    for (const item of this.chatWidget.viewModel?.getItems() ?? []) {
      if (isResponseVM(item) && item.response.value.some((r) => r.kind === "textEditGroup" && !r.state?.applied)) {
        maxWidgetOutputHeight = 270;
        break;
      }
    }
    let value = this.contentHeight;
    value -= this.chatWidget.contentHeight;
    value += Math.min(this.chatWidget.input.height.get() + maxWidgetOutputHeight, this.chatWidget.contentHeight);
    return value;
  }
  _getExtraHeight() {
    return this.#options.inZoneWidget ? 1 : 2 + 4;
  }
  updateInfo(message) {
    this._elements.infoLabel.classList.toggle("hidden", !message);
    const renderedMessage = renderLabelWithIcons(message);
    reset(this._elements.infoLabel, ...renderedMessage);
    this._onDidChangeHeight.fire();
  }
  updateStatus(message, ops = {}) {
    const isTempMessage = typeof ops.resetAfter === "number";
    if (isTempMessage && !this._elements.statusLabel.dataset["state"]) {
      const statusLabel = this._elements.statusLabel.innerText;
      const title = this._elements.statusLabel.dataset["title"];
      const classes = Array.from(this._elements.statusLabel.classList.values());
      setTimeout(() => {
        this.updateStatus(statusLabel, { classes, keepMessage: true, title });
      }, ops.resetAfter);
    }
    const renderedMessage = renderLabelWithIcons(message);
    reset(this._elements.statusLabel, ...renderedMessage);
    this._elements.statusLabel.className = `label status ${(ops.classes ?? []).join(" ")}`;
    this._elements.statusLabel.classList.toggle("hidden", !message);
    if (isTempMessage) {
      this._elements.statusLabel.dataset["state"] = "temp";
    } else {
      delete this._elements.statusLabel.dataset["state"];
    }
    if (ops.title) {
      this._elements.statusLabel.dataset["title"] = ops.title;
    } else {
      delete this._elements.statusLabel.dataset["title"];
    }
    this._onDidChangeHeight.fire();
  }
  reset() {
    this.chatWidget.attachmentModel.clear(true);
    this.chatWidget.saveState();
    reset(this._elements.statusLabel);
    this._elements.statusLabel.classList.toggle("hidden", true);
    this._elements.toolbar1.classList.add("hidden");
    this._elements.toolbar2.classList.add("hidden");
    this.updateInfo("");
    this._elements.accessibleViewer.classList.toggle("hidden", true);
    this._onDidChangeHeight.fire();
  }
  focus() {
    this.chatWidget.focusInput();
  }
  hasFocus() {
    return this.domNode.contains(getActiveElement());
  }
};
InlineChatWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IAccessibilityService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IAccessibleViewService),
  __decorateParam(8, ITextModelService),
  __decorateParam(9, IChatService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IChatEntitlementService),
  __decorateParam(12, IMarkdownRendererService)
], InlineChatWidget);
const defaultAriaLabel = localize("aria-label", "Inline Chat Input");
let EditorBasedInlineChatWidget = class extends InlineChatWidget {
  constructor(location, parentEditor, options, contextKeyService, keybindingService, instantiationService, accessibilityService, configurationService, accessibleViewService, textModelResolverService, chatService, hoverService, layoutService, chatEntitlementService, markdownRendererService) {
    const overflowWidgetsNode = layoutService.getContainer(getWindow(parentEditor.getContainerDomNode())).appendChild($(".inline-chat-overflow.monaco-editor"));
    super(location, {
      ...options,
      chatWidgetViewOptions: {
        ...options.chatWidgetViewOptions,
        editorOverflowWidgetsDomNode: overflowWidgetsNode
      }
    }, instantiationService, contextKeyService, keybindingService, accessibilityService, configurationService, accessibleViewService, textModelResolverService, chatService, hoverService, chatEntitlementService, markdownRendererService);
    this._store.add(toDisposable(() => {
      overflowWidgetsNode.remove();
    }));
  }
  // --- layout
  _doLayout(dimension) {
    const newHeight = dimension.height;
    super._doLayout(dimension.with(void 0, newHeight));
    this._elements.root.style.height = `${dimension.height - this._getExtraHeight()}px`;
  }
  reset() {
    this.chatWidget.setInput();
    super.reset();
  }
};
EditorBasedInlineChatWidget = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IAccessibilityService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IAccessibleViewService),
  __decorateParam(9, ITextModelService),
  __decorateParam(10, IChatService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, ILayoutService),
  __decorateParam(13, IChatEntitlementService),
  __decorateParam(14, IMarkdownRendererService)
], EditorBasedInlineChatWidget);
export {
  EditorBasedInlineChatWidget,
  InlineChatWidget
};
