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
import * as dom from "../../../../../base/browser/dom.js";
import { Orientation, Sash } from "../../../../../base/browser/ui/sash/sash.js";
import { disposableTimeout } from "../../../../../base/common/async.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { localize } from "../../../../../nls.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IMarkdownRendererService } from "../../../../../platform/markdown/browser/markdownRenderer.js";
import product from "../../../../../platform/product/common/product.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { editorBackground, inputBackground, quickInputBackground, quickInputForeground } from "../../../../../platform/theme/common/colorRegistry.js";
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from "../../../../common/theme.js";
import { IChatEntitlementService } from "../../../../services/chat/common/chatEntitlementService.js";
import { IWorkbenchLayoutService } from "../../../../services/layout/browser/layoutService.js";
import { isCellTextEditOperationArray } from "../../common/model/chatModel.js";
import { ChatMode } from "../../common/chatModes.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { IChatWidgetService } from "../chat.js";
import { ChatWidget } from "../widget/chatWidget.js";
let QuickChatService = class extends Disposable {
  constructor(quickInputService, chatService, instantiationService) {
    super();
    this.quickInputService = quickInputService;
    this.chatService = chatService;
    this.instantiationService = instantiationService;
    this._onDidClose = this._register(new Emitter());
  }
  get onDidClose() {
    return this._onDidClose.event;
  }
  get enabled() {
    return !!this.chatService.isEnabled(ChatAgentLocation.Chat);
  }
  get focused() {
    const widget = this._input?.widget;
    if (!widget) {
      return false;
    }
    return dom.isAncestorOfActiveElement(widget);
  }
  get sessionResource() {
    return this._input && this._currentChat?.sessionResource;
  }
  toggle(options) {
    if (this.focused && !options?.query) {
      this.close();
    } else {
      this.open(options);
      if (options?.isPartialQuery) {
        const disposable = this._store.add(Event.once(this.onDidClose)(() => {
          this._currentChat?.clearValue();
          this._store.delete(disposable);
        }));
      }
    }
  }
  open(options) {
    if (this._input) {
      if (this._currentChat && options?.query) {
        this._currentChat.focus();
        this._currentChat.setValue(options.query, options.selection);
        if (!options.isPartialQuery) {
          this._currentChat.acceptInput();
        }
        return;
      }
      return this.focus();
    }
    const disposableStore = new DisposableStore();
    this._input = this.quickInputService.createQuickWidget();
    this._input.contextKey = "chatInputVisible";
    this._input.ignoreFocusOut = true;
    disposableStore.add(this._input);
    this._container ??= dom.$(".interactive-session");
    this._input.widget = this._container;
    this._input.show();
    if (!this._currentChat) {
      this._currentChat = this.instantiationService.createInstance(QuickChat);
      this._currentChat.render(this._container);
    } else {
      this._currentChat.show();
    }
    disposableStore.add(this._input.onDidHide(() => {
      disposableStore.dispose();
      this._currentChat.hide();
      this._input = void 0;
      this._onDidClose.fire();
    }));
    this._currentChat.focus();
    if (options?.query) {
      this._currentChat.setValue(options.query, options.selection);
      if (!options.isPartialQuery) {
        this._currentChat.acceptInput();
      }
    }
  }
  focus() {
    this._currentChat?.focus();
  }
  close() {
    this._input?.dispose();
    this._input = void 0;
  }
  async openInChatView() {
    await this._currentChat?.openChatView();
    this.close();
  }
};
QuickChatService = __decorateClass([
  __decorateParam(0, IQuickInputService),
  __decorateParam(1, IChatService),
  __decorateParam(2, IInstantiationService)
], QuickChatService);
let QuickChat = class extends Disposable {
  constructor(instantiationService, contextKeyService, chatService, layoutService, chatWidgetService, chatEntitlementService, markdownRendererService) {
    super();
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.chatService = chatService;
    this.layoutService = layoutService;
    this.chatWidgetService = chatWidgetService;
    this.chatEntitlementService = chatEntitlementService;
    this.markdownRendererService = markdownRendererService;
    this.maintainScrollTimer = this._register(new MutableDisposable());
    this._deferUpdatingDynamicLayout = false;
  }
  static {
    // TODO@TylerLeonhardt: be responsive to window size
    this.DEFAULT_MIN_HEIGHT = 200;
  }
  static {
    this.DEFAULT_HEIGHT_OFFSET = 100;
  }
  get sessionResource() {
    return this.modelRef?.object.sessionResource;
  }
  clear() {
    this.modelRef?.dispose();
    this.modelRef = void 0;
    this.updateModel();
    this.widget.inputEditor.setValue("");
    return Promise.resolve();
  }
  focus(selection) {
    if (this.widget) {
      this.widget.focusInput();
      const value = this.widget.inputEditor.getValue();
      if (value) {
        this.widget.inputEditor.setSelection(selection ?? {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: value.length + 1
        });
      }
    }
  }
  hide() {
    this.widget.setVisible(false);
    this.maintainScrollTimer.value = disposableTimeout(() => {
      this.maintainScrollTimer.clear();
    }, 30 * 1e3);
  }
  show() {
    this.widget.setVisible(true);
    if (this._deferUpdatingDynamicLayout) {
      this._deferUpdatingDynamicLayout = false;
      this.widget.updateDynamicChatTreeItemLayout(2, this.maxHeight);
    }
    if (!this.maintainScrollTimer.value) {
      this.widget.layoutDynamicChatTreeItemMode();
    }
  }
  render(parent) {
    if (this.widget) {
      throw new Error("Cannot render quick chat twice");
    }
    const scopedInstantiationService = this._register(this.instantiationService.createChild(
      new ServiceCollection([
        IContextKeyService,
        this._register(this.contextKeyService.createScoped(parent))
      ])
    ));
    this.widget = this._register(
      scopedInstantiationService.createInstance(
        ChatWidget,
        ChatAgentLocation.Chat,
        { isQuickChat: true },
        {
          autoScroll: true,
          renderInputOnTop: true,
          renderStyle: "compact",
          menus: { inputSideToolbar: MenuId.ChatInputSide, telemetrySource: "chatQuick" },
          enableImplicitContext: true,
          defaultMode: ChatMode.Ask,
          clear: () => this.clear()
        },
        {
          listForeground: quickInputForeground,
          listBackground: quickInputBackground,
          overlayBackground: EDITOR_DRAG_AND_DROP_BACKGROUND,
          inputEditorBackground: inputBackground,
          resultEditorBackground: editorBackground
        }
      )
    );
    this.widget.render(parent);
    this.widget.setVisible(true);
    this.widget.setDynamicChatTreeItemLayout(2, this.maxHeight);
    this.updateModel();
    this.sash = this._register(new Sash(parent, { getHorizontalSashTop: () => parent.offsetHeight }, { orientation: Orientation.HORIZONTAL }));
    this.setupDisclaimer(parent);
    this.registerListeners(parent);
  }
  setupDisclaimer(parent) {
    const disclaimerElement = dom.append(parent, dom.$(".disclaimer.hidden"));
    const disposables = this._store.add(new DisposableStore());
    this._register(autorun((reader) => {
      disposables.clear();
      dom.reset(disclaimerElement);
      const sentiment = this.chatEntitlementService.sentimentObs.read(reader);
      const anonymous = this.chatEntitlementService.anonymousObs.read(reader);
      const requestInProgress = this.chatService.requestInProgressObs.read(reader);
      const showDisclaimer = !sentiment.completed && anonymous && !requestInProgress;
      disclaimerElement.classList.toggle("hidden", !showDisclaimer);
      if (showDisclaimer) {
        const renderedMarkdown = disposables.add(this.markdownRendererService.render(new MarkdownString(localize({ key: "termsDisclaimer", comment: ['{Locked="]({2})"}', '{Locked="]({3})"}'] }, "By continuing with {0} Copilot, you agree to {1}'s [Terms]({2}) and [Privacy Statement]({3})", product.defaultChatAgent?.provider?.default?.name ?? "", product.defaultChatAgent?.provider?.default?.name ?? "", product.defaultChatAgent?.termsStatementUrl ?? "", product.defaultChatAgent?.privacyStatementUrl ?? ""), { isTrusted: true })));
        disclaimerElement.appendChild(renderedMarkdown.element);
      }
    }));
  }
  get maxHeight() {
    return this.layoutService.mainContainerDimension.height - QuickChat.DEFAULT_HEIGHT_OFFSET;
  }
  registerListeners(parent) {
    this._register(this.layoutService.onDidLayoutMainContainer(() => {
      if (this.widget.visible) {
        this.widget.updateDynamicChatTreeItemLayout(2, this.maxHeight);
      } else {
        this._deferUpdatingDynamicLayout = true;
      }
    }));
    this._register(this.widget.onDidChangeHeight((e) => this.sash.layout()));
    const width = parent.offsetWidth;
    this._register(this.sash.onDidStart(() => {
      this.widget.isDynamicChatTreeItemLayoutEnabled = false;
    }));
    this._register(this.sash.onDidChange((e) => {
      if (e.currentY < QuickChat.DEFAULT_MIN_HEIGHT || e.currentY > this.maxHeight) {
        return;
      }
      this.widget.layout(e.currentY, width);
      this.sash.layout();
    }));
    this._register(this.sash.onDidReset(() => {
      this.widget.isDynamicChatTreeItemLayoutEnabled = true;
      this.widget.layoutDynamicChatTreeItemMode();
    }));
  }
  async acceptInput() {
    return this.widget.acceptInput();
  }
  async openChatView() {
    const widget = await this.chatWidgetService.revealWidget();
    const model = this.modelRef?.object;
    if (!widget?.viewModel || !model) {
      return;
    }
    for (const request of model.getRequests()) {
      if (request.response?.response.value || request.response?.result) {
        const message = [];
        for (const item of request.response.response.value) {
          if (item.kind === "textEditGroup") {
            for (const group of item.edits) {
              message.push({
                kind: "textEdit",
                edits: group,
                uri: item.uri
              });
            }
          } else if (item.kind === "notebookEditGroup") {
            for (const group of item.edits) {
              if (isCellTextEditOperationArray(group)) {
                message.push({
                  kind: "textEdit",
                  edits: group.map((e) => e.edit),
                  uri: group[0].uri
                });
              } else {
                message.push({
                  kind: "notebookEdit",
                  edits: group,
                  uri: item.uri
                });
              }
            }
          } else {
            message.push(item);
          }
        }
        this.chatService.addCompleteRequest(
          widget.viewModel.sessionResource,
          request.message,
          request.variableData,
          request.attempt,
          {
            message,
            result: request.response.result,
            followups: request.response.followups
          }
        );
      } else if (request.message) {
      }
    }
    const value = this.widget.getInputState();
    if (value) {
      widget.viewModel.model.inputModel.setState(value);
    }
    widget.focusInput();
  }
  setValue(value, selection) {
    this.widget.inputEditor.setValue(value);
    this.focus(selection);
  }
  clearValue() {
    this.widget.inputEditor.setValue("");
  }
  updateModel() {
    this.modelRef ??= this.chatService.startNewLocalSession(ChatAgentLocation.Chat, { disableBackgroundKeepAlive: true, debugOwner: "ChatQuick#updateModel" });
    const model = this.modelRef?.object;
    if (!model) {
      throw new Error("Could not start chat session");
    }
    this.modelRef.object.inputModel.setState({ inputText: "", selections: [] });
    this.widget.setModel(model);
  }
  dispose() {
    this.modelRef?.dispose();
    this.modelRef = void 0;
    super.dispose();
  }
};
QuickChat = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IChatService),
  __decorateParam(3, IWorkbenchLayoutService),
  __decorateParam(4, IChatWidgetService),
  __decorateParam(5, IChatEntitlementService),
  __decorateParam(6, IMarkdownRendererService)
], QuickChat);
export {
  QuickChatService
};
