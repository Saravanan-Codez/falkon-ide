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
import { $ } from "../../../../../../base/browser/dom.js";
import { ButtonWithIcon } from "../../../../../../base/browser/ui/button/button.js";
import { HoverStyle } from "../../../../../../base/browser/ui/hover/hover.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { observableConfigValue } from "../../../../../../platform/observable/common/platformObservableUtils.js";
import { AccessibilityWorkbenchSettingId } from "../../../../accessibility/browser/accessibilityConfiguration.js";
import { renderFileWidgets } from "./chatInlineAnchorWidget.js";
import "./media/chatCollapsibleContentPart.css";
let ChatCollapsibleContentPart = class extends Disposable {
  constructor(title, context, hoverMessage, hoverService, configurationService) {
    super();
    this.title = title;
    this.hoverMessage = hoverMessage;
    this.hoverService = hoverService;
    this._renderedTitleWithWidgets = this._register(new MutableDisposable());
    this._titleFileWidgetStore = this._register(new DisposableStore());
    this._isExpanded = observableValue(this, false);
    this._overrideIcon = observableValue(this, void 0);
    this._contentInitialized = false;
    this.ariaLabel = typeof title === "string" ? title : title.value;
    this.element = context.element;
    this.hasFollowingContent = context.contentIndex + 1 < context.content.length;
    this._showCheckmarks = observableConfigValue(AccessibilityWorkbenchSettingId.ShowChatCheckmarks, false, configurationService);
  }
  static {
    this.userToggleEvent = "chatCollapsibleUserToggle";
  }
  get icon() {
    return this._overrideIcon.get();
  }
  set icon(value) {
    this._overrideIcon.set(value, void 0);
  }
  get domNode() {
    this._domNode ??= this.init();
    return this._domNode;
  }
  init() {
    const referencesLabel = this.title;
    const buttonElement = $(".chat-used-context-label", void 0);
    const collapseButton = this._register(new ButtonWithIcon(buttonElement, {
      buttonBackground: void 0,
      buttonBorder: void 0,
      buttonForeground: void 0,
      buttonHoverBackground: void 0,
      buttonSecondaryBackground: void 0,
      buttonSecondaryForeground: void 0,
      buttonSecondaryHoverBackground: void 0,
      buttonSeparator: void 0
    }));
    this._collapseButton = collapseButton;
    this._domNode = $(".chat-used-context", void 0, buttonElement);
    collapseButton.label = referencesLabel;
    let animatedContent;
    if (this.shouldPrepareContentAnimation()) {
      this._domNode.classList.add("chat-collapsible-content-animatable");
      this._domNode.classList.toggle("chat-collapsible-content-animated", this.shouldAnimateContent());
      const animationContainer = $(".chat-collapsible-content-animation");
      this._animationContainer = animationContainer;
      animatedContent = $(".chat-collapsible-content-animation-inner");
      animationContainer.appendChild(animatedContent);
      this._domNode.appendChild(animationContainer);
    }
    const hoverChevron = $("span.chat-collapsible-hover-chevron.codicon.codicon-chevron-right", { "aria-hidden": "true" });
    this._hoverChevron = hoverChevron;
    collapseButton.element.appendChild(hoverChevron);
    if (this.hoverMessage) {
      this._register(this.hoverService.setupDelayedHover(collapseButton.iconElement, {
        content: this.hoverMessage,
        style: HoverStyle.Pointer
      }));
    }
    this._register(collapseButton.onDidClick(() => {
      const value = this._isExpanded.get();
      this._domNode?.dispatchEvent(new CustomEvent(ChatCollapsibleContentPart.userToggleEvent, { bubbles: true }));
      this._isExpanded.set(!value, void 0);
    }));
    this._isExpanded.set(this.isExpanded(), void 0);
    this._register(autorun((r) => {
      const expanded = this._isExpanded.read(r);
      const overrideIcon = this._overrideIcon.read(r);
      const showCheckmarks = this._showCheckmarks.read(r);
      if (overrideIcon) {
        collapseButton.icon = overrideIcon;
      }
      this._domNode?.classList.toggle("show-checkmarks", showCheckmarks);
      hoverChevron.classList.toggle("expanded", expanded);
      if ((expanded || this.shouldInitEarly()) && !this._contentInitialized) {
        this._contentInitialized = true;
        this._contentElement = this.initContent();
        (animatedContent ?? this._domNode)?.appendChild(this._contentElement);
        this.contentDidInitialize();
        if (expanded && animatedContent) {
          animatedContent.parentElement?.getBoundingClientRect();
        }
      }
      this._domNode?.classList.toggle("chat-used-context-collapsed", !expanded);
      if (animatedContent) {
        animatedContent.inert = !expanded;
      }
      this.updateAriaLabel(collapseButton.element, this.ariaLabel, expanded);
      this.expansionDidChange(expanded);
    }));
    return this._domNode;
  }
  shouldInitEarly() {
    return false;
  }
  shouldAnimateContent() {
    return true;
  }
  shouldPrepareContentAnimation() {
    return this.shouldAnimateContent();
  }
  setContentAnimationEnabled(enabled) {
    this.domNode.classList.toggle("chat-collapsible-content-animated", enabled);
  }
  get contentAnimationContainer() {
    return this._animationContainer;
  }
  contentDidInitialize() {
  }
  expansionDidChange(_expanded) {
  }
  updateAriaLabel(element, label, expanded) {
    element.ariaLabel = label;
    element.ariaExpanded = String(expanded);
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
  get expanded() {
    return this._isExpanded;
  }
  isExpanded() {
    return this._isExpanded.get();
  }
  setExpanded(value) {
    this._isExpanded.set(value, void 0);
  }
  setTitle(title) {
    this.title = title;
    if (this._collapseButton) {
      this._collapseButton.label = title;
    }
    this.setAriaLabel(title);
  }
  setAriaLabel(label) {
    this.ariaLabel = label;
    if (this._collapseButton) {
      this.updateAriaLabel(this._collapseButton.element, label, this.isExpanded());
    }
  }
  // Render collapsible dropdown title with widgets
  setTitleWithWidgets(content, instantiationService, chatMarkdownAnchorService, chatContentMarkdownRenderer) {
    if (this._store.isDisposed || !this._collapseButton) {
      return;
    }
    const result = chatContentMarkdownRenderer.render(content);
    result.element.classList.add("collapsible-title-content");
    this._titleFileWidgetStore.clear();
    renderFileWidgets(result.element, instantiationService, chatMarkdownAnchorService, this._titleFileWidgetStore);
    const labelElement = this._collapseButton.labelElement;
    labelElement.textContent = "";
    labelElement.appendChild(result.element);
    const textContent = result.element.textContent || "";
    this.setAriaLabel(textContent);
    this._renderedTitleWithWidgets.value = result;
  }
};
ChatCollapsibleContentPart = __decorateClass([
  __decorateParam(3, IHoverService),
  __decorateParam(4, IConfigurationService)
], ChatCollapsibleContentPart);
export {
  ChatCollapsibleContentPart
};
