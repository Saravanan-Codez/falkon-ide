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
import "./media/chatSideChatOrigin.css";
import * as dom from "../../../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../../../base/browser/keyboardEvent.js";
import { Gesture, EventType as TouchEventType } from "../../../../../../base/browser/touch.js";
import { getDefaultHoverDelegate } from "../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { onUnexpectedError } from "../../../../../../base/common/errors.js";
import { KeyCode } from "../../../../../../base/common/keyCodes.js";
import { Disposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { localize } from "../../../../../../nls.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { ChatAgentLocation } from "../../../common/constants.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { IChatSideChatService } from "../../../common/chatSideChatService.js";
let ChatSideChatOriginPart = class extends Disposable {
  constructor(sessionResource, _chatService, _sideChatService, hoverService) {
    super();
    this._chatService = _chatService;
    this._sideChatService = _sideChatService;
    this._disposeCts = new CancellationTokenSource();
    this._renderVersion = 0;
    this._register(toDisposable(() => this._disposeCts.dispose(true)));
    this.domNode = dom.$(".chat-side-chat-origin.hidden");
    this.domNode.tabIndex = 0;
    this.domNode.setAttribute("role", "button");
    this._register(Gesture.addTarget(this.domNode));
    this._register(hoverService.setupManagedHover(
      getDefaultHoverDelegate("element"),
      this.domNode,
      localize("chat.sideChatOrigin.showOriginalMessage", "Show the original message")
    ));
    for (const eventType of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this._register(dom.addDisposableListener(this.domNode, eventType, () => {
        this._revealSource(sessionResource);
      }));
    }
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if ((event.keyCode === KeyCode.Enter || event.keyCode === KeyCode.Space) && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        this._revealSource(sessionResource);
      }
    }));
    const origin = this._sideChatService.observeSideChatOrigin(sessionResource);
    this._register(autorun((reader) => {
      this._renderOrigin(origin.read(reader));
    }));
  }
  _renderOrigin(origin) {
    const renderVersion = ++this._renderVersion;
    if (!origin) {
      dom.clearNode(this.domNode);
      this.domNode.classList.add("hidden");
      this.domNode.removeAttribute("aria-label");
      return;
    }
    const title = origin.sourceTitle ?? localize("chat.sideChatOrigin.originalConversation", "Original conversation");
    let quote;
    let shouldLoadSourceSession = false;
    if (origin.selection) {
      quote = this._normalizeQuote(origin.selection.text);
    } else {
      const sourceSession = this._chatService.getSession(origin.sourceSessionResource);
      if (sourceSession) {
        quote = this._getRequestQuote(sourceSession, origin.sourceTurnId);
      } else {
        shouldLoadSourceSession = true;
      }
    }
    this._renderContent(title, quote);
    if (shouldLoadSourceSession) {
      void this._resolveSourceQuote(origin, title, renderVersion);
    }
  }
  async _resolveSourceQuote(origin, title, renderVersion) {
    try {
      const reference = await this._chatService.acquireOrLoadSession(
        origin.sourceSessionResource,
        ChatAgentLocation.Chat,
        this._disposeCts.token,
        "ChatSideChatOriginPart#resolveSourceQuote"
      );
      if (!reference) {
        return;
      }
      try {
        if (this._disposeCts.token.isCancellationRequested || this._store.isDisposed || renderVersion !== this._renderVersion) {
          return;
        }
        const quote = this._getRequestQuote(reference.object, origin.sourceTurnId);
        if (quote && renderVersion === this._renderVersion && !this._store.isDisposed) {
          this._renderContent(title, quote);
        }
      } finally {
        reference.dispose();
      }
    } catch (error) {
      if (!this._disposeCts.token.isCancellationRequested) {
        onUnexpectedError(error);
      }
    }
  }
  _getRequestQuote(sourceSession, sourceTurnId) {
    return this._normalizeQuote(sourceSession.getRequests().find((request) => request.id === sourceTurnId)?.message.text);
  }
  _normalizeQuote(text) {
    const quote = text?.replace(/\s+/g, " ").trim();
    return quote || void 0;
  }
  _renderContent(title, quote) {
    dom.clearNode(this.domNode);
    this.domNode.classList.remove("hidden");
    this.domNode.classList.toggle("has-no-quote", !quote);
    const header = dom.$(".chat-side-chat-origin-header");
    const icon = dom.$("span.chat-side-chat-origin-icon");
    icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.reply));
    icon.setAttribute("aria-hidden", "true");
    const titleElement = dom.$("span.chat-side-chat-origin-title");
    titleElement.textContent = title;
    header.append(icon, titleElement);
    this.domNode.appendChild(header);
    if (quote) {
      const quoteElement = dom.$("span.chat-side-chat-origin-quote");
      quoteElement.textContent = quote;
      this.domNode.appendChild(quoteElement);
      this.domNode.setAttribute("aria-label", localize(
        "chat.sideChatOrigin.ariaLabel",
        "Side chat about {0}: {1}. Select to show the original message.",
        title,
        quote
      ));
    } else {
      this.domNode.setAttribute("aria-label", localize(
        "chat.sideChatOrigin.ariaLabelNoQuote",
        "Side chat about {0}. Select to show the original message.",
        title
      ));
    }
  }
  _revealSource(sessionResource) {
    void this._sideChatService.revealSideChatSource(sessionResource).catch(onUnexpectedError);
  }
};
ChatSideChatOriginPart = __decorateClass([
  __decorateParam(1, IChatService),
  __decorateParam(2, IChatSideChatService),
  __decorateParam(3, IHoverService)
], ChatSideChatOriginPart);
export {
  ChatSideChatOriginPart
};
