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
import "./media/chatTipContent.css";
import * as dom from "../../../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../../../base/browser/mouseEvent.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { onUnexpectedError } from "../../../../../../base/common/errors.js";
import { Disposable, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuWorkbenchToolBar } from "../../../../../../platform/actions/browser/toolbar.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { openLinkFromMarkdown } from "../../../../../../platform/markdown/browser/markdownRenderer.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { CHAT_SETUP_ACTION_ID } from "../../actions/chatActions.js";
import { IChatTipService } from "../../chatTipService.js";
import { ChatEntitlement, IChatEntitlementService } from "../../../../../services/chat/common/chatEntitlementService.js";
const $ = dom.$;
let ChatTipContentPart = class extends Disposable {
  constructor(tip, _renderer, _chatTipService, _contextMenuService, _menuService, _contextKeyService, _instantiationService, _openerService, _commandService, _chatEntitlementService) {
    super();
    this._renderer = _renderer;
    this._chatTipService = _chatTipService;
    this._contextMenuService = _contextMenuService;
    this._menuService = _menuService;
    this._contextKeyService = _contextKeyService;
    this._instantiationService = _instantiationService;
    this._openerService = _openerService;
    this._commandService = _commandService;
    this._chatEntitlementService = _chatEntitlementService;
    this._onDidHide = this._register(new Emitter());
    this.onDidHide = this._onDidHide.event;
    this._renderedContent = this._register(new MutableDisposable());
    this._toolbar = this._register(new MutableDisposable());
    this.domNode = $(".chat-tip-widget");
    this.domNode.tabIndex = 0;
    this.domNode.setAttribute("role", "region");
    this.domNode.setAttribute("aria-roledescription", localize("chatTipRoleDescription", "tip"));
    this._inChatTipContextKey = ChatContextKeys.inChatTip.bindTo(this._contextKeyService);
    this._multipleChatTipsContextKey = ChatContextKeys.multipleChatTips.bindTo(this._contextKeyService);
    const focusTracker = this._register(dom.trackFocus(this.domNode));
    this._register(focusTracker.onDidFocus(() => this._inChatTipContextKey.set(true)));
    this._register(focusTracker.onDidBlur(() => this._inChatTipContextKey.set(false)));
    this._register({
      dispose: () => {
        this._inChatTipContextKey.reset();
        this._multipleChatTipsContextKey.reset();
      }
    });
    this._renderTip(tip);
    this._register(this._chatTipService.onDidDismissTip(() => {
      this._onDidHide.fire();
    }));
    this._register(this._chatTipService.onDidNavigateTip((tip2) => {
      this._renderTip(tip2);
      dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(this.domNode), () => this.focus());
    }));
    this._register(this._chatTipService.onDidHideTip(() => {
      this._onDidHide.fire();
    }));
    this._register(this._chatTipService.onDidDisableTips(() => {
      this._onDidHide.fire();
    }));
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.CONTEXT_MENU, (e) => {
      dom.EventHelper.stop(e, true);
      const event = new StandardMouseEvent(dom.getWindow(this.domNode), e);
      this._contextMenuService.showContextMenu({
        getAnchor: () => event,
        getActions: () => {
          const menu = this._menuService.getMenuActions(MenuId.ChatTipContext, this._contextKeyService);
          return getFlatContextMenuActions(menu);
        }
      });
    }));
  }
  hasFocus() {
    return dom.isAncestorOfActiveElement(this.domNode);
  }
  focus() {
    this.domNode.focus();
  }
  _renderTip(tip) {
    dom.clearNode(this.domNode);
    this._toolbar.clear();
    this._multipleChatTipsContextKey.set(this._chatTipService.hasMultipleTips());
    const markdownContent = this._renderer.render(tip.content, {
      actionHandler: (link, md) => {
        this._handleTipAction(link, md).catch(onUnexpectedError);
      }
    });
    this._renderedContent.value = markdownContent;
    this.domNode.appendChild(markdownContent.element);
    const toolbarContainer = $(".chat-tip-toolbar");
    this._toolbar.value = this._instantiationService.createInstance(MenuWorkbenchToolBar, toolbarContainer, MenuId.ChatTipToolbar, {
      menuOptions: {
        shouldForwardArgs: true
      }
    });
    this.domNode.appendChild(toolbarContainer);
    const textContent = markdownContent.element.textContent ?? localize("chatTip", "Chat tip");
    const hasLink = /\[.*?\]\(.*?\)/.test(tip.content.value);
    const ariaLabel = hasLink ? localize("chatTipWithAction", "{0} Tab to reach the action.", textContent) : textContent;
    this.domNode.setAttribute("aria-label", ariaLabel);
  }
  async _handleTipAction(link, mdStr) {
    if (link.startsWith("command:") && this._shouldTriggerSetup()) {
      const setupSucceeded = await this._commandService.executeCommand(CHAT_SETUP_ACTION_ID);
      if (!setupSucceeded) {
        return;
      }
    }
    await openLinkFromMarkdown(this._openerService, link, mdStr.isTrusted);
  }
  _shouldTriggerSetup() {
    if (this._chatEntitlementService.hasByokModels) {
      return false;
    }
    const sentiment = this._chatEntitlementService.sentiment;
    if (!sentiment?.completed) {
      return true;
    }
    return this._chatEntitlementService.entitlement === ChatEntitlement.Unknown;
  }
};
ChatTipContentPart = __decorateClass([
  __decorateParam(2, IChatTipService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IMenuService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, ICommandService),
  __decorateParam(9, IChatEntitlementService)
], ChatTipContentPart);
registerAction2(class PreviousTipAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.previousTip",
      title: localize2("chatTip.previous", "Previous tip"),
      icon: Codicon.chevronLeft,
      precondition: ChatContextKeys.multipleChatTips,
      f1: false,
      menu: [{
        id: MenuId.ChatTipToolbar,
        group: "navigation",
        order: 1
      }]
    });
  }
  async run(accessor) {
    const chatTipService = accessor.get(IChatTipService);
    chatTipService.navigateToPreviousTip();
  }
});
registerAction2(class NextTipAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.nextTip",
      title: localize2("chatTip.next", "Next tip"),
      icon: Codicon.chevronRight,
      precondition: ChatContextKeys.multipleChatTips,
      f1: false,
      menu: [{
        id: MenuId.ChatTipToolbar,
        group: "navigation",
        order: 2
      }]
    });
  }
  async run(accessor) {
    const chatTipService = accessor.get(IChatTipService);
    chatTipService.navigateToNextTip();
  }
});
registerAction2(class DismissTipToolbarAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.dismissTipToolbar",
      title: localize2("chatTip.dismissButton", "Dismiss tip"),
      icon: Codicon.check,
      f1: false,
      menu: [{
        id: MenuId.ChatTipToolbar,
        group: "navigation",
        order: 3
      }]
    });
  }
  async run(accessor) {
    accessor.get(IChatTipService).dismissTipForSession();
  }
});
registerAction2(class DismissTipAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.dismissTip",
      title: localize2("chatTip.dismiss", "Dismiss this tip"),
      f1: false,
      menu: [{
        id: MenuId.ChatTipContext,
        group: "chatTip",
        order: 1
      }]
    });
  }
  async run(accessor) {
    accessor.get(IChatTipService).dismissTipForSession();
  }
});
registerAction2(class DisableTipsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.disableTips",
      title: localize2("chatTip.disableTips", "Disable tips"),
      icon: Codicon.bellSlash,
      f1: false,
      menu: [{
        id: MenuId.ChatTipContext,
        group: "chatTip",
        order: 2
      }, {
        id: MenuId.ChatTipToolbar,
        group: "navigation",
        order: 5
      }]
    });
  }
  async run(accessor) {
    const chatTipService = accessor.get(IChatTipService);
    const commandService = accessor.get(ICommandService);
    await chatTipService.disableTips();
    await commandService.executeCommand("workbench.action.openSettings", "chat.tips.enabled");
  }
});
registerAction2(class ResetDismissedTipsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.resetDismissedTips",
      title: localize2("chatTip.resetDismissedTips", "Reset Dismissed Tips"),
      f1: true,
      precondition: ChatContextKeys.enabled
    });
  }
  async run(accessor) {
    accessor.get(IChatTipService).clearDismissedTips();
  }
});
export {
  ChatTipContentPart
};
