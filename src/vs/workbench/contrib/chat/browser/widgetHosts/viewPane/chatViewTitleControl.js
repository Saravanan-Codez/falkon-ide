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
import "./media/chatViewTitleControl.css";
import { addDisposableListener, EventType, h } from "../../../../../../base/browser/dom.js";
import { renderAsPlaintext } from "../../../../../../base/browser/markdownRenderer.js";
import { Gesture, EventType as TouchEventType } from "../../../../../../base/browser/touch.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Disposable, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../../../../base/common/marshallingIds.js";
import { localize } from "../../../../../../nls.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../../../platform/actions/browser/toolbar.js";
import { Action2, MenuId, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ActionViewItem } from "../../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { AgentSessionsPicker } from "../../agentSessions/agentSessionsPicker.js";
let ChatViewTitleControl = class extends Disposable {
  constructor(container, delegate, instantiationService) {
    super();
    this.container = container;
    this.delegate = delegate;
    this.instantiationService = instantiationService;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this.title = void 0;
    this.titleLabel = this._register(new MutableDisposable());
    this.modelDisposables = this._register(new MutableDisposable());
    this.lastKnownHeight = 0;
    this.render(this.container);
    this.registerActions();
  }
  static {
    this.DEFAULT_TITLE = localize("chat", "Chat");
  }
  static {
    this.PICK_AGENT_SESSION_ACTION_ID = "workbench.action.chat.pickAgentSession";
  }
  registerActions() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: ChatViewTitleControl.PICK_AGENT_SESSION_ACTION_ID,
          title: localize("chat.pickAgentSession", "Pick Agent Session"),
          f1: false,
          menu: [{
            id: MenuId.ChatViewSessionTitleNavigationToolbar,
            group: "navigation",
            order: 2
          }]
        });
      }
      async run(accessor) {
        const instantiationService = accessor.get(IInstantiationService);
        const agentSessionsPicker = instantiationService.createInstance(AgentSessionsPicker, that.titleLabel.value?.element, void 0);
        await agentSessionsPicker.pickAgentSession();
      }
    }));
  }
  render(parent) {
    const elements = h("div.chat-view-title-container", [
      h("div.chat-view-title-inner", [
        h("div.chat-view-title-navigation-toolbar@navigationToolbar"),
        h("div.chat-view-title-actions-toolbar@actionsToolbar")
      ])
    ]);
    this.navigationToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, elements.navigationToolbar, MenuId.ChatViewSessionTitleNavigationToolbar, {
      actionViewItemProvider: (action) => {
        if (action.id === ChatViewTitleControl.PICK_AGENT_SESSION_ACTION_ID) {
          this.titleLabel.value = new ChatViewTitleLabel(action);
          this.titleLabel.value.updateTitle(this.title ?? ChatViewTitleControl.DEFAULT_TITLE);
          return this.titleLabel.value;
        }
        return void 0;
      },
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      menuOptions: { shouldForwardArgs: true }
    }));
    this.actionsToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, elements.actionsToolbar, MenuId.ChatViewSessionTitleToolbar, {
      menuOptions: { shouldForwardArgs: true },
      hiddenItemStrategy: HiddenItemStrategy.NoHide
    }));
    this.titleContainer = elements.root;
    this._register(Gesture.addTarget(this.titleContainer));
    for (const eventType of [TouchEventType.Tap, EventType.CLICK]) {
      this._register(addDisposableListener(this.titleContainer, eventType, () => {
        this.delegate.focusChat();
      }));
    }
    parent.appendChild(this.titleContainer);
  }
  update(model) {
    this.model = model;
    this.modelDisposables.value = model?.onDidChange((e) => {
      if (e.kind === "setCustomTitle" || e.kind === "addRequest") {
        this.doUpdate();
      }
    });
    this.doUpdate();
  }
  doUpdate() {
    const markdownTitle = new MarkdownString(this.model?.title ?? "");
    this.title = renderAsPlaintext(markdownTitle);
    this.updateTitle(this.title ?? ChatViewTitleControl.DEFAULT_TITLE);
    const context = this.model && {
      $mid: MarshalledId.ChatViewContext,
      sessionResource: this.model.sessionResource
    };
    if (this.navigationToolbar) {
      this.navigationToolbar.context = context;
    }
    if (this.actionsToolbar) {
      this.actionsToolbar.context = context;
    }
  }
  updateTitle(title) {
    if (!this.titleContainer) {
      return;
    }
    this.titleContainer.classList.toggle("visible", this.shouldRender());
    this.titleLabel.value?.updateTitle(title);
    const currentHeight = this.getHeight();
    if (currentHeight !== this.lastKnownHeight) {
      this.lastKnownHeight = currentHeight;
      this._onDidChangeHeight.fire();
    }
  }
  shouldRender() {
    return !!this.model?.title;
  }
  getHeight() {
    if (!this.titleContainer || this.titleContainer.style.display === "none") {
      return 0;
    }
    return this.titleContainer.offsetHeight;
  }
};
ChatViewTitleControl = __decorateClass([
  __decorateParam(2, IInstantiationService)
], ChatViewTitleControl);
class ChatViewTitleLabel extends ActionViewItem {
  constructor(action, options) {
    super(null, action, { ...options, icon: false, label: true });
    this.titleLabel = void 0;
  }
  render(container) {
    super.render(container);
    container.classList.add("chat-view-title-action-item");
    this.label?.classList.add("chat-view-title-label-container");
    this.titleLabel = this.label?.appendChild(h("span.chat-view-title-label").root);
    this.updateLabel();
  }
  updateTitle(title) {
    this.title = title;
    this.updateLabel();
  }
  updateLabel() {
    if (!this.titleLabel) {
      return;
    }
    if (this.title) {
      this.titleLabel.textContent = this.title;
    } else {
      this.titleLabel.textContent = "";
    }
  }
}
export {
  ChatViewTitleControl
};
