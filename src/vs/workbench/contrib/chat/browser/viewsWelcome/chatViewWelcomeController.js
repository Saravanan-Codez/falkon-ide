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
import { asCSSUrl } from "../../../../../base/browser/cssValue.js";
import * as dom from "../../../../../base/browser/dom.js";
import { createCSSRule } from "../../../../../base/browser/domStylesheets.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Event } from "../../../../../base/common/event.js";
import { StringSHA1 } from "../../../../../base/common/hash.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IMarkdownRendererService } from "../../../../../platform/markdown/browser/markdownRenderer.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { defaultButtonStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { chatViewsWelcomeRegistry } from "./chatViewsWelcome.js";
const $ = dom.$;
let ChatViewWelcomeController = class extends Disposable {
  constructor(container, delegate, location, contextKeyService, instantiationService) {
    super();
    this.container = container;
    this.delegate = delegate;
    this.location = location;
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.enabled = false;
    this.enabledDisposables = this._register(new DisposableStore());
    this.renderDisposables = this._register(new DisposableStore());
    this._isShowingWelcome = observableValue(this, false);
    this.element = dom.append(this.container, dom.$(".chat-view-welcome"));
    this._register(Event.runAndSubscribe(
      delegate.onDidChangeViewWelcomeState,
      () => this.update()
    ));
    this._register(chatViewsWelcomeRegistry.onDidChange(() => this.update(true)));
  }
  get isShowingWelcome() {
    return this._isShowingWelcome;
  }
  getMatchingWelcomeView() {
    const descriptors = chatViewsWelcomeRegistry.get();
    const matchingDescriptors = descriptors.filter((descriptor) => this.contextKeyService.contextMatchesRules(descriptor.when));
    return matchingDescriptors.at(0);
  }
  update(force) {
    const enabled = this.delegate.shouldShowWelcome();
    if (this.enabled === enabled && !force) {
      return;
    }
    this.enabled = enabled;
    this.enabledDisposables.clear();
    if (!enabled) {
      this.container.classList.toggle("chat-view-welcome-visible", false);
      this.renderDisposables.clear();
      this._isShowingWelcome.set(false, void 0);
      return;
    }
    const descriptors = chatViewsWelcomeRegistry.get();
    if (descriptors.length) {
      this.render(descriptors);
      const descriptorKeys = new Set(descriptors.flatMap((d) => d.when.keys()));
      this.enabledDisposables.add(this.contextKeyService.onDidChangeContext((e) => {
        if (e.affectsSome(descriptorKeys)) {
          this.render(descriptors);
        }
      }));
    }
  }
  render(descriptors) {
    this.renderDisposables.clear();
    dom.clearNode(this.element);
    const matchingDescriptors = descriptors.filter((descriptor) => this.contextKeyService.contextMatchesRules(descriptor.when));
    const enabledDescriptor = matchingDescriptors.at(0);
    if (enabledDescriptor) {
      const content = {
        icon: enabledDescriptor.icon,
        title: enabledDescriptor.title,
        message: enabledDescriptor.content
      };
      const welcomeView = this.renderDisposables.add(this.instantiationService.createInstance(ChatViewWelcomePart, content, { firstLinkToButton: true, location: this.location }));
      this.element.appendChild(welcomeView.element);
      this.container.classList.toggle("chat-view-welcome-visible", true);
      this._isShowingWelcome.set(true, void 0);
    } else {
      this.container.classList.toggle("chat-view-welcome-visible", false);
      this._isShowingWelcome.set(false, void 0);
    }
  }
};
ChatViewWelcomeController = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInstantiationService)
], ChatViewWelcomeController);
let ChatViewWelcomePart = class extends Disposable {
  constructor(content, options, openerService, logService, markdownRendererService) {
    super();
    this.content = content;
    this.openerService = openerService;
    this.logService = logService;
    this.markdownRendererService = markdownRendererService;
    this.element = dom.$(".chat-welcome-view");
    try {
      const icon = dom.append(this.element, $(".chat-welcome-view-icon"));
      if (content.useLargeIcon) {
        icon.classList.add("large-icon");
      }
      if (content.icon) {
        if (ThemeIcon.isThemeIcon(content.icon)) {
          const iconElement = renderIcon(content.icon);
          icon.appendChild(iconElement);
        } else if (URI.isUri(content.icon)) {
          const cssUrl = asCSSUrl(content.icon);
          const hash = new StringSHA1();
          hash.update(cssUrl);
          const iconId = `chat-welcome-icon-${hash.digest()}`;
          const iconClass = `.chat-welcome-view-icon.${iconId}`;
          createCSSRule(iconClass, `
					mask: ${cssUrl} no-repeat 50% 50%;
					-webkit-mask: ${cssUrl} no-repeat 50% 50%;
					background-color: var(--vscode-icon-foreground);
				`);
          icon.classList.add(iconId, "custom-icon");
        }
      }
      const title = dom.append(this.element, $(".chat-welcome-view-title"));
      title.textContent = content.title;
      const message = dom.append(this.element, $(".chat-welcome-view-message"));
      const messageResult = this.renderMarkdownMessageContent(content.message, options);
      dom.append(message, messageResult.element);
      if (content.additionalMessage) {
        const disclaimers = dom.append(this.element, $(".chat-welcome-view-disclaimer"));
        if (typeof content.additionalMessage === "string") {
          disclaimers.textContent = content.additionalMessage;
        } else {
          const additionalMessageResult = this.renderMarkdownMessageContent(content.additionalMessage, options);
          disclaimers.appendChild(additionalMessageResult.element);
        }
      }
      if (content.tips) {
        const tips = dom.append(this.element, $(".chat-welcome-view-tips"));
        const tipsResult = this._register(this.markdownRendererService.render(content.tips));
        tips.appendChild(tipsResult.element);
      }
    } catch (err) {
      this.logService.error("Failed to render chat view welcome content", err);
    }
  }
  needsRerender(content) {
    return !!(this.content.title !== content.title || this.content.message.value !== content.message.value || this.content.additionalMessage !== content.additionalMessage || this.content.tips?.value !== content.tips?.value);
  }
  renderMarkdownMessageContent(content, options) {
    const messageResult = this._register(this.markdownRendererService.render(content));
    const firstLink = options?.firstLinkToButton ? messageResult.element.querySelector("a") : void 0;
    if (firstLink) {
      const target = firstLink.getAttribute("data-href");
      const button = this._register(new Button(firstLink.parentElement, defaultButtonStyles));
      button.label = firstLink.textContent ?? "";
      if (target) {
        this._register(button.onDidClick(() => {
          this.openerService.open(target, { allowCommands: true });
        }));
      }
      firstLink.replaceWith(button.element);
    }
    return messageResult;
  }
};
ChatViewWelcomePart = __decorateClass([
  __decorateParam(2, IOpenerService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IMarkdownRendererService)
], ChatViewWelcomePart);
export {
  ChatViewWelcomeController,
  ChatViewWelcomePart
};
