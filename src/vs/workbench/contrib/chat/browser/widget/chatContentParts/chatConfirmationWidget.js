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
import { EventType as TouchEventType } from "../../../../../../base/browser/touch.js";
import { Button, ButtonWithDropdown } from "../../../../../../base/browser/ui/button/button.js";
import { DomScrollableElement } from "../../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Action, Separator } from "../../../../../../base/common/actions.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { ScrollbarVisibility } from "../../../../../../base/common/scrollable.js";
import { localize } from "../../../../../../nls.js";
import { MenuWorkbenchToolBar } from "../../../../../../platform/actions/browser/toolbar.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../../platform/instantiation/common/serviceCollection.js";
import { IMarkdownRendererService } from "../../../../../../platform/markdown/browser/markdownRenderer.js";
import { defaultButtonStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { renderFileWidgets } from "./chatInlineAnchorWidget.js";
import { IChatMarkdownAnchorService } from "./chatMarkdownAnchorService.js";
import { ChatMarkdownContentPart } from "./chatMarkdownContentPart.js";
import "./media/chatConfirmationWidget.css";
let ChatQueryTitlePart = class extends Disposable {
  constructor(element, _title, subtitle, _renderer, _instantiationService, _chatMarkdownAnchorService) {
    super();
    this.element = element;
    this._title = _title;
    this._renderer = _renderer;
    this._instantiationService = _instantiationService;
    this._chatMarkdownAnchorService = _chatMarkdownAnchorService;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._renderedTitle = this._register(new MutableDisposable());
    this._fileWidgetStore = this._register(new DisposableStore());
    element.classList.add("chat-query-title-part");
    this._renderedTitle.value = this.renderTitle(_title);
    element.append(this._renderedTitle.value.element);
    if (subtitle) {
      const str = this.toMdString(subtitle);
      const renderedTitle = this._register(_renderer.render(str, this.getRenderOptions()));
      const wrapper = document.createElement("small");
      wrapper.appendChild(renderedTitle.element);
      element.append(wrapper);
    }
  }
  get title() {
    return this._title;
  }
  set title(value) {
    this._title = value;
    const next = this.renderTitle(value);
    const previousEl = this._renderedTitle.value?.element;
    if (previousEl?.parentElement) {
      previousEl.replaceWith(next.element);
    } else {
      this.element.appendChild(next.element);
    }
    this._renderedTitle.value = next;
  }
  toMdString(value) {
    if (typeof value === "string") {
      return new MarkdownString("", { supportThemeIcons: true }).appendText(value);
    } else {
      return new MarkdownString(value.value, { supportThemeIcons: true, isTrusted: value.isTrusted });
    }
  }
  setOptions(options) {
    this.options = options;
    this.title = this._title;
  }
  renderTitle(value) {
    const renderedTitle = this._renderer.render(this.toMdString(value), this.getRenderOptions());
    this._fileWidgetStore.clear();
    if (this.options?.renderFileWidgets) {
      renderFileWidgets(renderedTitle.element, this._instantiationService, this._chatMarkdownAnchorService, this._fileWidgetStore);
    }
    return renderedTitle;
  }
  getRenderOptions() {
    return {
      ...this.options?.markdownRenderOptions,
      asyncRenderCallback: () => this._onDidChangeHeight.fire()
    };
  }
};
ChatQueryTitlePart = __decorateClass([
  __decorateParam(3, IMarkdownRendererService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IChatMarkdownAnchorService)
], ChatQueryTitlePart);
let BaseSimpleChatConfirmationWidget = class extends Disposable {
  constructor(context, options, instantiationService, _markdownRendererService, contextMenuService, contextKeyService) {
    super();
    this.context = context;
    this.instantiationService = instantiationService;
    this._markdownRendererService = _markdownRendererService;
    this._onDidClick = this._register(new Emitter());
    this.messageContentDisposables = this._register(new MutableDisposable());
    const { title, subtitle, message, buttons } = options;
    const elements = dom.h(".chat-confirmation-widget-container@container", [
      dom.h(".chat-confirmation-widget@root", [
        dom.h(".chat-confirmation-widget-title@title"),
        dom.h(".chat-confirmation-widget-message-container", [
          dom.h(".chat-confirmation-widget-message@message"),
          dom.h(".chat-buttons-container@buttonsContainer", [
            dom.h(".chat-buttons@buttons"),
            dom.h(".chat-toolbar@toolbar")
          ])
        ])
      ])
    ]);
    configureAccessibilityContainer(elements.container, title, message);
    this._domNode = elements.root;
    this._register(instantiationService.createInstance(
      ChatQueryTitlePart,
      elements.title,
      title,
      subtitle
    ));
    this.messageElement = elements.message;
    const messageParent = this.messageElement.parentElement;
    const messageNextSibling = this.messageElement.nextSibling;
    this.messageScrollable = this._register(new DomScrollableElement(this.messageElement, {
      vertical: ScrollbarVisibility.Auto,
      horizontal: ScrollbarVisibility.Hidden,
      consumeMouseWheelIfScrollbarIsNeeded: true
    }));
    this.messageScrollable.getDomNode().classList.add("chat-confirmation-widget-message-scrollable");
    messageParent?.insertBefore(this.messageScrollable.getDomNode(), messageNextSibling);
    const messageResizeObserver = this._register(new dom.DisposableResizeObserver("BaseSimpleChatConfirmationWidget.message", () => this.messageScrollable.scanDomNode()));
    this._register(messageResizeObserver.observe(this.messageElement));
    this._register(messageResizeObserver.observe(this.messageScrollable.getDomNode()));
    buttons.forEach((buttonData) => {
      const buttonOptions = { ...defaultButtonStyles, small: true, secondary: buttonData.isSecondary, title: buttonData.tooltip, disabled: buttonData.disabled };
      let button;
      if (buttonData.moreActions) {
        button = new ButtonWithDropdown(elements.buttons, {
          ...buttonOptions,
          contextMenuProvider: contextMenuService,
          addPrimaryActionToDropdown: false,
          actions: buttonData.moreActions.map((action) => {
            if (action instanceof Separator) {
              return action;
            }
            return this._register(new Action(
              action.label,
              action.label,
              void 0,
              !action.disabled,
              () => {
                this._onDidClick.fire({ button: action, isTouchClick: false });
                return Promise.resolve();
              }
            ));
          })
        });
      } else {
        button = new Button(elements.buttons, buttonOptions);
      }
      this._register(button);
      button.label = buttonData.label;
      this._register(button.onDidClick((event) => this._onDidClick.fire({ button: buttonData, isTouchClick: !!event && event.type === TouchEventType.Tap })));
      if (buttonData.onDidChangeDisablement) {
        this._register(buttonData.onDidChangeDisablement((disabled) => button.enabled = !disabled));
      }
    });
    if (options?.toolbarData) {
      const overlay = contextKeyService.createOverlay([
        ["chatConfirmationPartType", options.toolbarData.partType],
        ["chatConfirmationPartSource", options.toolbarData.partSource]
      ]);
      const nestedInsta = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, overlay])));
      this._register(nestedInsta.createInstance(
        MenuWorkbenchToolBar,
        elements.toolbar,
        MenuId.ChatConfirmationMenu,
        {
          // buttonConfigProvider: () => ({ showLabel: false, showIcon: true }),
          menuOptions: {
            arg: options.toolbarData.arg,
            shouldForwardArgs: true
          }
        }
      ));
    }
  }
  get onDidClick() {
    return this._onDidClick.event;
  }
  get domNode() {
    return this._domNode;
  }
  setShowButtons(showButton) {
    this.domNode.classList.toggle("hideButtons", !showButton);
  }
  renderMessage(element) {
    const store = new DisposableStore();
    const messageContentResizeObserver = store.add(new dom.DisposableResizeObserver("BaseSimpleChatConfirmationWidget.messageContent", () => this.messageScrollable.scanDomNode()));
    store.add(messageContentResizeObserver.observe(element));
    this.messageContentDisposables.value = store;
    this.messageElement.append(element);
    this.messageScrollable.scanDomNode();
  }
};
BaseSimpleChatConfirmationWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMarkdownRendererService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IContextKeyService)
], BaseSimpleChatConfirmationWidget);
let SimpleChatConfirmationWidget = class extends BaseSimpleChatConfirmationWidget {
  constructor(context, options, instantiationService, markdownRendererService, contextMenuService, contextKeyService) {
    super(context, options, instantiationService, markdownRendererService, contextMenuService, contextKeyService);
    this.updateMessage(options.message);
  }
  updateMessage(message) {
    this._renderedMessage?.remove();
    const renderedMessage = this._register(this._markdownRendererService.render(
      typeof message === "string" ? new MarkdownString(message) : message
    ));
    this.renderMessage(renderedMessage.element);
    this._renderedMessage = renderedMessage.element;
  }
};
SimpleChatConfirmationWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMarkdownRendererService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IContextKeyService)
], SimpleChatConfirmationWidget);
let BaseChatConfirmationWidget = class extends Disposable {
  constructor(_context, options, instantiationService, markdownRendererService, contextMenuService, contextKeyService, chatMarkdownAnchorService) {
    super();
    this._context = _context;
    this.instantiationService = instantiationService;
    this.markdownRendererService = markdownRendererService;
    this.contextMenuService = contextMenuService;
    this.chatMarkdownAnchorService = chatMarkdownAnchorService;
    this._onDidClick = this._register(new Emitter());
    this._buttons = [];
    this.messageContentDisposables = this._register(new MutableDisposable());
    this.markdownContentPart = this._register(new MutableDisposable());
    const { title, subtitle, message, buttons, icon, footerBanner } = options;
    this.fileWidgetOptions = options.fileWidgetOptions;
    const elements = dom.h(".chat-confirmation-widget-container@container", [
      dom.h(".chat-confirmation-widget2@root", [
        dom.h(".chat-confirmation-widget-title", [
          dom.h(".chat-title@title"),
          dom.h(".chat-toolbar-container@buttonsContainer", [
            dom.h(".chat-toolbar@toolbar")
          ])
        ]),
        dom.h(".chat-confirmation-widget-message@message"),
        dom.h(".chat-confirmation-widget-buttons", [
          dom.h(".chat-buttons@buttons")
        ])
      ])
    ]);
    configureAccessibilityContainer(elements.container, title, message, footerBanner);
    this._domNode = elements.root;
    this._buttonsDomNode = elements.buttons;
    this._register(instantiationService.createInstance(
      ChatQueryTitlePart,
      elements.title,
      new MarkdownString(icon ? `$(${icon.id}) ${typeof title === "string" ? title : title.value}` : typeof title === "string" ? title : title.value),
      subtitle
    ));
    this.messageElement = elements.message;
    const messageParent = this.messageElement.parentElement;
    const messageNextSibling = this.messageElement.nextSibling;
    this.messageScrollable = this._register(new DomScrollableElement(this.messageElement, {
      vertical: ScrollbarVisibility.Auto,
      horizontal: ScrollbarVisibility.Hidden,
      consumeMouseWheelIfScrollbarIsNeeded: true
    }));
    this.messageScrollable.getDomNode().classList.add("chat-confirmation-widget-message-scrollable");
    messageParent?.insertBefore(this.messageScrollable.getDomNode(), messageNextSibling);
    const messageResizeObserver = this._register(new dom.DisposableResizeObserver("BaseChatConfirmationWidget.message", () => this.messageScrollable.scanDomNode()));
    this._register(messageResizeObserver.observe(this.messageElement));
    this._register(messageResizeObserver.observe(this.messageScrollable.getDomNode()));
    if (footerBanner) {
      this.messageScrollable.getDomNode().insertAdjacentElement("afterend", footerBanner);
      if (!footerBanner.hasAttribute("aria-live")) {
        footerBanner.setAttribute("aria-live", "polite");
      }
    }
    this.updateButtons(buttons);
    if (options?.toolbarData) {
      const overlay = contextKeyService.createOverlay([
        ["chatConfirmationPartType", options.toolbarData.partType],
        ["chatConfirmationPartSource", options.toolbarData.partSource]
      ]);
      const nestedInsta = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, overlay])));
      this._register(nestedInsta.createInstance(
        MenuWorkbenchToolBar,
        elements.toolbar,
        MenuId.ChatConfirmationMenu,
        {
          // buttonConfigProvider: () => ({ showLabel: false, showIcon: true }),
          menuOptions: {
            arg: options.toolbarData.arg,
            shouldForwardArgs: true
          }
        }
      ));
    }
  }
  get onDidClick() {
    return this._onDidClick.event;
  }
  get domNode() {
    return this._domNode;
  }
  setShowButtons(showButton) {
    this.domNode.classList.toggle("hideButtons", !showButton);
  }
  get codeblocksPartId() {
    return this.markdownContentPart.value?.codeblocksPartId;
  }
  get codeblocks() {
    return this.markdownContentPart.value?.codeblocks;
  }
  updateButtons(buttons) {
    const focusedButton = this._buttons.find((button) => button.widget.hasFocus());
    const focusedDropdown = focusedButton?.widget instanceof ButtonWithDropdown && focusedButton.widget.dropdownButton.hasFocus();
    this._buttons = [];
    while (this._buttonsDomNode.children.length > 0) {
      this._buttonsDomNode.children[0].remove();
    }
    for (const buttonData of buttons) {
      const buttonOptions = { ...defaultButtonStyles, small: true, secondary: buttonData.isSecondary, title: buttonData.tooltip, disabled: buttonData.disabled };
      let button;
      if (buttonData.moreActions) {
        button = new ButtonWithDropdown(this._buttonsDomNode, {
          ...buttonOptions,
          contextMenuProvider: this.contextMenuService,
          addPrimaryActionToDropdown: false,
          actions: buttonData.moreActions.map((action) => {
            if (action instanceof Separator) {
              return action;
            }
            return this._register(new Action(
              action.label,
              action.label,
              void 0,
              !action.disabled,
              () => {
                this._onDidClick.fire({ button: action, isTouchClick: false });
                return Promise.resolve();
              }
            ));
          })
        });
      } else {
        button = new Button(this._buttonsDomNode, buttonOptions);
      }
      this._register(button);
      this._buttons.push({ label: buttonData.label, widget: button });
      button.label = buttonData.label;
      this._register(button.onDidClick((event) => this._onDidClick.fire({ button: buttonData, isTouchClick: !!event && event.type === TouchEventType.Tap })));
      if (buttonData.onDidChangeDisablement) {
        this._register(buttonData.onDidChangeDisablement((disabled) => button.enabled = !disabled));
      }
    }
    const buttonToFocus = focusedButton && this._buttons.find((button) => button.label === focusedButton.label)?.widget;
    if (focusedDropdown && buttonToFocus instanceof ButtonWithDropdown) {
      buttonToFocus.dropdownButton.focus();
    } else {
      buttonToFocus?.focus();
    }
  }
  renderMessage(element) {
    this.markdownContentPart.clear();
    if (!dom.isHTMLElement(element)) {
      const part = this._register(this.instantiationService.createInstance(
        ChatMarkdownContentPart,
        {
          kind: "markdownContent",
          content: typeof element === "string" ? new MarkdownString().appendMarkdown(element) : element
        },
        this._context,
        this._context.editorPool,
        false,
        this._context.codeBlockStartIndex,
        this.markdownRendererService,
        void 0,
        this._context.currentWidth.get(),
        {
          allowInlineDiffs: true,
          horizontalPadding: 6
        }
      ));
      renderFileWidgets(part.domNode, this.instantiationService, this.chatMarkdownAnchorService, this._store, this.fileWidgetOptions);
      this.markdownContentPart.value = part;
      element = part.domNode;
    }
    dom.clearNode(this.messageElement);
    const store = new DisposableStore();
    const messageContentResizeObserver = store.add(new dom.DisposableResizeObserver("BaseChatConfirmationWidget.messageContent", () => this.messageScrollable.scanDomNode()));
    store.add(messageContentResizeObserver.observe(element));
    if (this.markdownContentPart.value) {
      store.add(this.markdownContentPart.value.onDidChangeHeight(() => this.messageScrollable.scanDomNode()));
    }
    this.messageContentDisposables.value = store;
    this.messageElement.append(element);
    this.messageScrollable.scanDomNode();
  }
};
BaseChatConfirmationWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMarkdownRendererService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IChatMarkdownAnchorService)
], BaseChatConfirmationWidget);
let ChatConfirmationWidget = class extends BaseChatConfirmationWidget {
  constructor(context, options, instantiationService, markdownRendererService, contextMenuService, contextKeyService, chatMarkdownAnchorService) {
    super(context, options, instantiationService, markdownRendererService, contextMenuService, contextKeyService, chatMarkdownAnchorService);
    this.renderMessage(options.message);
  }
  updateMessage(message) {
    this._renderedMessage?.remove();
    const renderedMessage = this._register(this.markdownRendererService.render(
      typeof message === "string" ? new MarkdownString(message) : message
    ));
    this.renderMessage(renderedMessage.element);
    this._renderedMessage = renderedMessage.element;
  }
};
ChatConfirmationWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMarkdownRendererService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IChatMarkdownAnchorService)
], ChatConfirmationWidget);
let ChatCustomConfirmationWidget = class extends BaseChatConfirmationWidget {
  constructor(context, options, instantiationService, markdownRendererService, contextMenuService, contextKeyService, chatMarkdownAnchorService) {
    super(context, options, instantiationService, markdownRendererService, contextMenuService, contextKeyService, chatMarkdownAnchorService);
    this.renderMessage(options.message);
  }
};
ChatCustomConfirmationWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMarkdownRendererService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IChatMarkdownAnchorService)
], ChatCustomConfirmationWidget);
function configureAccessibilityContainer(container, title, message, footerBanner) {
  container.tabIndex = 0;
  const titleAsString = typeof title === "string" ? title : title.value;
  const messageAsString = typeof message === "string" ? message : message && "value" in message ? message.value : message && "textContent" in message ? message.textContent : "";
  const bannerAsString = footerBanner?.textContent?.trim() ?? "";
  container.setAttribute("aria-label", bannerAsString ? localize("chat.confirmationWidget.ariaLabelWithBannerTitleMessageBanner", "Chat Confirmation Dialog {0} {1} {2}", titleAsString, messageAsString, bannerAsString) : localize("chat.confirmationWidget.ariaLabel", "Chat Confirmation Dialog {0} {1}", titleAsString, messageAsString));
  container.classList.add("chat-confirmation-widget-container");
}
export {
  ChatConfirmationWidget,
  ChatCustomConfirmationWidget,
  ChatQueryTitlePart,
  SimpleChatConfirmationWidget
};
