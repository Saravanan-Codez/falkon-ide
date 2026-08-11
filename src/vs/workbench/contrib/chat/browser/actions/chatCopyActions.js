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
import { status } from "../../../../../base/browser/ui/aria/aria.js";
import * as dom from "../../../../../base/browser/dom.js";
import { disposableTimeout } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Disposable, markAsSingleton, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize, localize2 } from "../../../../../nls.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { MenuEntryActionViewItem } from "../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, MenuId, MenuItemAction, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { katexContainerClassName, katexContainerLatexAttributeName } from "../../../markdown/common/markedKatexExtension.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { isChatTreeItem, isRequestVM, isResponseVM } from "../../common/model/chatViewModel.js";
import { IChatWidgetService } from "../chat.js";
import { CHAT_CATEGORY, stringifyItem } from "./chatActions.js";
import { toPortableMarkdown } from "../widget/chatClipboard.js";
const CopyItemActionId = "workbench.action.chat.copyItem";
const copyFeedbackDuration = 1200;
const copyIconClasses = ThemeIcon.asClassNameArray(Codicon.copy);
const copiedIconClasses = ThemeIcon.asClassNameArray(Codicon.check);
class ChatCopyActionViewItem extends MenuEntryActionViewItem {
  constructor() {
    super(...arguments);
    this.copiedStateReset = this._register(new MutableDisposable());
    this.actionRunnerListener = this._register(new MutableDisposable());
    this.copied = false;
  }
  get actionRunner() {
    return super.actionRunner;
  }
  set actionRunner(actionRunner) {
    super.actionRunner = actionRunner;
    this.bindActionRunner(actionRunner);
  }
  render(container) {
    super.render(container);
    this.bindActionRunner(super.actionRunner);
    if (!this.element || !this.label) {
      return;
    }
    this.element.classList.add("chat-copy-action");
    this.clearLabelIconClasses();
    this.label.style.backgroundImage = "";
    this.label.classList.remove("icon");
    this.label.textContent = "";
    this.label.setAttribute("aria-hidden", "true");
    const iconContainer = dom.append(this.label, dom.$(".chat-copy-action-icons"));
    const copyIcon = dom.append(iconContainer, dom.$(".chat-copy-action-icon.chat-copy-action-icon-copy"));
    copyIcon.classList.add(...copyIconClasses);
    copyIcon.setAttribute("aria-hidden", "true");
    const copiedIcon = dom.append(iconContainer, dom.$(".chat-copy-action-icon.chat-copy-action-icon-copied"));
    copiedIcon.classList.add(...copiedIconClasses);
    copiedIcon.setAttribute("aria-hidden", "true");
    this.renderCopiedState();
  }
  getTooltip() {
    return this.copied ? localize("interactive.copyItem.copied", "Copied") : super.getTooltip();
  }
  updateAriaLabel() {
    this.element?.setAttribute("aria-label", this.copied ? localize("interactive.copyItem.copiedAriaLabel", "Copied") : localize("interactive.copyItem.ariaLabel", "Copy"));
  }
  updateClass() {
    super.updateClass();
    this.clearLabelIconClasses();
    if (this.label) {
      this.label.style.backgroundImage = "";
      this.label.classList.remove("icon");
    }
  }
  clearLabelIconClasses() {
    this.label?.classList.remove(...copyIconClasses, ...copiedIconClasses);
  }
  renderCopiedState() {
    this.element?.classList.toggle("copied", this.copied);
    this.updateTooltip();
  }
  bindActionRunner(actionRunner) {
    this.actionRunnerListener.value = actionRunner.onDidRun((e) => {
      if (e.action !== this.action || e.error) {
        return;
      }
      this.copied = true;
      this.renderCopiedState();
      this.copiedStateReset.value = disposableTimeout(() => {
        this.copied = false;
        this.renderCopiedState();
      }, copyFeedbackDuration);
      status(localize("interactive.copyItem.status", "Copied to clipboard"));
    });
  }
}
let ChatCopyActionRendering = class extends Disposable {
  static {
    this.ID = "chat.copyActionRendering";
  }
  constructor(actionViewItemService, instantiationService) {
    super();
    const disposable = this._register(actionViewItemService.register(MenuId.ChatMessageFooter, CopyItemActionId, (action, options) => {
      if (!(action instanceof MenuItemAction)) {
        return void 0;
      }
      return instantiationService.createInstance(ChatCopyActionViewItem, action, options);
    }));
    markAsSingleton(disposable);
  }
};
ChatCopyActionRendering = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService)
], ChatCopyActionRendering);
function registerChatCopyActions() {
  registerAction2(class CopyAllAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.copyAll",
        title: localize2("interactive.copyAll.label", "Copy All"),
        f1: false,
        category: CHAT_CATEGORY,
        menu: {
          id: MenuId.ChatContext,
          when: ChatContextKeys.responseIsFiltered.negate(),
          group: "copy"
        }
      });
    }
    run(accessor, context) {
      const clipboardService = accessor.get(IClipboardService);
      const chatWidgetService = accessor.get(IChatWidgetService);
      const widget = (isRequestVM(context) || isResponseVM(context)) && chatWidgetService.getWidgetBySessionResource(context.sessionResource) || chatWidgetService.lastFocusedWidget;
      if (widget) {
        const viewModel = widget.viewModel;
        const sessionAsText = viewModel?.getItems().filter((item) => isRequestVM(item) || isResponseVM(item) && !item.errorDetails?.responseIsFiltered).map((item) => stringifyItem(item)).join("\n\n");
        if (sessionAsText) {
          clipboardService.writeText(toPortableMarkdown(sessionAsText));
        }
      }
    }
  });
  registerAction2(class CopyItemAction extends Action2 {
    constructor() {
      super({
        id: CopyItemActionId,
        title: localize2("interactive.copyItem.label", "Copy"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.copy,
        menu: [
          {
            id: MenuId.ChatContext,
            when: ChatContextKeys.responseIsFiltered.negate(),
            group: "copy"
          },
          {
            id: MenuId.ChatMessageFooter,
            group: "navigation",
            order: 1,
            when: ContextKeyExpr.and(ChatContextKeys.isResponse, ChatContextKeys.responseIsFiltered.negate())
          }
        ]
      });
    }
    async run(accessor, ...args) {
      const chatWidgetService = accessor.get(IChatWidgetService);
      const clipboardService = accessor.get(IClipboardService);
      const widget = chatWidgetService.lastFocusedWidget;
      let item = args[0];
      if (!isChatTreeItem(item)) {
        item = widget?.getFocus();
        if (!item) {
          return;
        }
      }
      const nativeSelection = dom.getActiveWindow().getSelection();
      const selectedText = nativeSelection?.toString();
      if (widget && selectedText && selectedText.length > 0 && dom.isAncestor(dom.getActiveElement(), widget.domNode)) {
        await clipboardService.writeText(selectedText);
        return;
      }
      if (!isRequestVM(item) && !isResponseVM(item)) {
        return;
      }
      const text = stringifyItem(item, false);
      await clipboardService.writeText(toPortableMarkdown(text));
    }
  });
  registerAction2(class CopyFinalResponseAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.copyFinalResponse",
        title: localize2("interactive.copyFinalResponse.label", "Copy Final Response"),
        f1: false,
        category: CHAT_CATEGORY,
        menu: {
          id: MenuId.ChatContext,
          when: ContextKeyExpr.and(ChatContextKeys.isResponse, ChatContextKeys.responseIsFiltered.negate()),
          group: "copy"
        }
      });
    }
    async run(accessor, ...args) {
      const chatWidgetService = accessor.get(IChatWidgetService);
      const clipboardService = accessor.get(IClipboardService);
      const widget = chatWidgetService.lastFocusedWidget;
      let item = args[0];
      if (!isChatTreeItem(item)) {
        item = widget?.getFocus();
        if (!item) {
          return;
        }
      }
      if (!isResponseVM(item)) {
        return;
      }
      const text = item.response.getFinalResponse();
      if (text) {
        await clipboardService.writeText(toPortableMarkdown(text));
      }
    }
  });
  registerAction2(class CopyKatexMathSourceAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.copyKatexMathSource",
        title: localize2("chat.copyKatexMathSource.label", "Copy Math Source"),
        f1: false,
        category: CHAT_CATEGORY,
        menu: {
          id: MenuId.ChatContext,
          group: "copy",
          when: ChatContextKeys.isKatexMathElement
        }
      });
    }
    async run(accessor, ...args) {
      const chatWidgetService = accessor.get(IChatWidgetService);
      const clipboardService = accessor.get(IClipboardService);
      const widget = chatWidgetService.lastFocusedWidget;
      let item = args[0];
      if (!isChatTreeItem(item)) {
        item = widget?.getFocus();
        if (!item) {
          return;
        }
      }
      let selectedElement = null;
      const activeElement = dom.getActiveElement();
      const nativeSelection = dom.getActiveWindow().getSelection();
      if (widget && nativeSelection && nativeSelection.rangeCount > 0 && dom.isAncestor(activeElement, widget.domNode)) {
        const range = nativeSelection.getRangeAt(0);
        selectedElement = range.commonAncestorContainer;
        if (selectedElement.nodeType === Node.TEXT_NODE) {
          selectedElement = selectedElement.parentElement;
        }
      }
      if (!selectedElement) {
        selectedElement = activeElement?.querySelector(`.${katexContainerClassName}`) ?? null;
      }
      const katexElement = dom.isHTMLElement(selectedElement) ? selectedElement.closest(`.${katexContainerClassName}`) : null;
      const latexSource = katexElement?.getAttribute(katexContainerLatexAttributeName) || "";
      if (latexSource) {
        await clipboardService.writeText(latexSource);
      }
    }
  });
}
export {
  ChatCopyActionRendering,
  ChatCopyActionViewItem,
  registerChatCopyActions
};
