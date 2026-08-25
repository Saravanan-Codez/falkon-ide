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
import { timeout } from "../../../../../base/common/async.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { combinedDisposable, Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { ILayoutService } from "../../../../../platform/layout/browser/layoutService.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ACTIVE_GROUP, IEditorService } from "../../../../services/editor/common/editorService.js";
import { IEditorGroupsService, isEditorGroup } from "../../../../services/editor/common/editorGroupsService.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ChatViewId, ChatViewPaneTarget, IQuickChatService, isIChatViewViewContext } from "../chat.js";
import { ChatEditor } from "../widgetHosts/editor/chatEditor.js";
import { ChatEditorInput } from "../widgetHosts/editor/chatEditorInput.js";
let ChatWidgetService = class extends Disposable {
  constructor(editorGroupsService, viewsService, quickChatService, layoutService, editorService, chatService, logService) {
    super();
    this.editorGroupsService = editorGroupsService;
    this.viewsService = viewsService;
    this.quickChatService = quickChatService;
    this.layoutService = layoutService;
    this.editorService = editorService;
    this.chatService = chatService;
    this.logService = logService;
    this._widgets = [];
    this._lastFocusedWidget = void 0;
    this._onDidAddWidget = this._register(new Emitter());
    this.onDidAddWidget = this._onDidAddWidget.event;
    this._onDidChangeWidgetVisibility = this._register(new Emitter());
    this.onDidChangeWidgetVisibility = this._onDidChangeWidgetVisibility.event;
    this._onDidBackgroundSession = this._register(new Emitter());
    this.onDidBackgroundSession = this._onDidBackgroundSession.event;
    this._onDidChangeFocusedWidget = this._register(new Emitter());
    this.onDidChangeFocusedWidget = this._onDidChangeFocusedWidget.event;
    this._onDidChangeFocusedSession = this._register(new Emitter());
    this.onDidChangeFocusedSession = this._onDidChangeFocusedSession.event;
  }
  get lastFocusedWidget() {
    return this._lastFocusedWidget;
  }
  getAllWidgets() {
    return this._widgets;
  }
  getWidgetsByLocations(location) {
    return this._widgets.filter((w) => w.location === location);
  }
  getWidgetByInputUri(uri) {
    return this._widgets.find((w) => isEqual(w.input.inputUri, uri));
  }
  getWidgetBySessionResource(sessionResource) {
    return this._widgets.find((w) => isEqual(w.viewModel?.sessionResource, sessionResource));
  }
  async revealWidget(preserveFocus) {
    const last = this.lastFocusedWidget;
    if (last && await this.reveal(last, preserveFocus)) {
      return last;
    }
    return (await this.viewsService.openView(ChatViewId, !preserveFocus))?.widget;
  }
  async reveal(widget, preserveFocus) {
    if (widget.viewModel?.sessionResource) {
      const alreadyOpenWidget = await this.revealSessionIfAlreadyOpen(widget.viewModel.sessionResource, { preserveFocus });
      if (alreadyOpenWidget) {
        return true;
      }
    }
    if (isIChatViewViewContext(widget.viewContext)) {
      const view = await this.viewsService.openView(widget.viewContext.viewId, !preserveFocus);
      if (!preserveFocus) {
        view?.focus();
      }
      return !!view;
    }
    return false;
  }
  async openSession(sessionResource, target, options) {
    const t0 = Date.now();
    const targetKind = target === ChatViewPaneTarget ? "view" : typeof target === "undefined" ? "undefined" : "editor";
    this.logService.trace(`[ChatWidgetService] openSession start uri=${sessionResource.toString()} target=${targetKind}`);
    if (typeof target === "undefined" || options?.revealIfOpened) {
      const alreadyOpenWidget = await this.revealSessionIfAlreadyOpen(sessionResource, options);
      if (alreadyOpenWidget) {
        this.logService.trace(`[ChatWidgetService] openSession done total=${Date.now() - t0}ms uri=${sessionResource.toString()} path=reveal`);
        return alreadyOpenWidget;
      }
    } else {
      await this.prepareSessionForMove(sessionResource, target);
    }
    if (target === ChatViewPaneTarget || typeof target === "undefined") {
      const chatView = await this.viewsService.openView(ChatViewId, !options?.preserveFocus);
      if (chatView) {
        await chatView.loadSession(sessionResource);
        if (!options?.preserveFocus) {
          chatView.focusInput();
        }
      }
      this.logService.trace(`[ChatWidgetService] openSession done total=${Date.now() - t0}ms uri=${sessionResource.toString()} path=view`);
      return chatView?.widget;
    }
    const pane = await this.editorService.openEditor({
      resource: sessionResource,
      options: {
        ...options,
        revealIfOpened: options?.revealIfOpened ?? true
        // always try to reveal if already opened unless explicitly told not to
      }
    }, target);
    this.logService.trace(`[ChatWidgetService] openSession done total=${Date.now() - t0}ms uri=${sessionResource.toString()} path=editor`);
    return pane instanceof ChatEditor ? pane.widget : void 0;
  }
  async revealSessionIfAlreadyOpen(sessionResource, options) {
    const chatView = this.viewsService.getViewWithId(ChatViewId);
    if (chatView?.widget.viewModel?.sessionResource && isEqual(chatView.widget.viewModel.sessionResource, sessionResource)) {
      const view = await this.viewsService.openView(ChatViewId, !options?.preserveFocus);
      if (!options?.preserveFocus) {
        view?.focus();
      }
      return chatView.widget;
    }
    const existingEditor = this.findExistingChatEditorByUri(sessionResource);
    if (existingEditor) {
      const existingEditorWindowId = existingEditor.group.windowId;
      const isGroupActive = () => dom.getWindow(this.layoutService.activeContainer).vscodeWindowId === existingEditorWindowId;
      let ensureFocusTransfer;
      if (!isGroupActive() && !options?.preserveFocus) {
        ensureFocusTransfer = Event.toPromise(Event.once(Event.filter(this.layoutService.onDidChangeActiveContainer, isGroupActive)));
      }
      const pane = await existingEditor.group.openEditor(existingEditor.editor, options);
      await ensureFocusTransfer;
      return pane instanceof ChatEditor ? pane.widget : void 0;
    }
    if (isEqual(sessionResource, this.quickChatService.sessionResource)) {
      this.quickChatService.focus();
      return void 0;
    }
    return void 0;
  }
  async prepareSessionForMove(sessionResource, target) {
    const existingWidget = this.getWidgetBySessionResource(sessionResource);
    if (existingWidget) {
      const existingEditor = isIChatViewViewContext(existingWidget.viewContext) ? void 0 : this.findExistingChatEditorByUri(sessionResource);
      if (isIChatViewViewContext(existingWidget.viewContext) && target === ChatViewPaneTarget) {
        return;
      }
      if (!isIChatViewViewContext(existingWidget.viewContext) && target !== ChatViewPaneTarget && existingEditor && this.isSameEditorTarget(existingEditor.group.id, target)) {
        return;
      }
      if (existingEditor) {
        await this.editorService.closeEditor({ editor: existingEditor.editor, groupId: existingEditor.group.id }, { preserveFocus: true });
      } else {
        await existingWidget.clear();
      }
    }
  }
  findExistingChatEditorByUri(sessionUri) {
    for (const group of this.editorGroupsService.groups) {
      for (const editor of group.editors) {
        if (editor instanceof ChatEditorInput && isEqual(editor.sessionResource, sessionUri)) {
          return { editor, group };
        }
      }
    }
    return void 0;
  }
  isSameEditorTarget(currentGroupId, target) {
    return typeof target === "number" && target === currentGroupId || target === ACTIVE_GROUP && this.editorGroupsService.activeGroup?.id === currentGroupId || isEditorGroup(target) && target.id === currentGroupId;
  }
  setLastFocusedWidget(widget) {
    if (widget === this._lastFocusedWidget) {
      return;
    }
    this._lastFocusedWidget = widget;
    this._onDidChangeFocusedWidget.fire(widget);
    this._onDidChangeFocusedSession.fire();
  }
  register(newWidget) {
    if (this._widgets.some((widget) => widget === newWidget)) {
      throw new Error("Cannot register the same widget multiple times");
    }
    this._widgets.push(newWidget);
    this._onDidAddWidget.fire(newWidget);
    if (!this._lastFocusedWidget) {
      this.setLastFocusedWidget(newWidget);
    }
    return combinedDisposable(
      newWidget.onDidFocus(() => this.setLastFocusedWidget(newWidget)),
      newWidget.onDidShow(() => this._onDidChangeWidgetVisibility.fire(newWidget)),
      newWidget.onDidHide(() => this._onDidChangeWidgetVisibility.fire(newWidget)),
      newWidget.onDidChangeViewModel(({ previousSessionResource, currentSessionResource }) => {
        if (this._lastFocusedWidget === newWidget && !isEqual(previousSessionResource, currentSessionResource)) {
          this._onDidChangeFocusedSession.fire();
        }
        if (!previousSessionResource || currentSessionResource && isEqual(previousSessionResource, currentSessionResource)) {
          return;
        }
        void timeout(200).then(() => {
          if (!this.getWidgetBySessionResource(previousSessionResource) && this.chatService.getSession(previousSessionResource)) {
            this._onDidBackgroundSession.fire(previousSessionResource);
          }
        });
      }),
      toDisposable(() => {
        this._widgets.splice(this._widgets.indexOf(newWidget), 1);
        if (this._lastFocusedWidget === newWidget) {
          this.setLastFocusedWidget(void 0);
        }
      })
    );
  }
};
ChatWidgetService = __decorateClass([
  __decorateParam(0, IEditorGroupsService),
  __decorateParam(1, IViewsService),
  __decorateParam(2, IQuickChatService),
  __decorateParam(3, ILayoutService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IChatService),
  __decorateParam(6, ILogService)
], ChatWidgetService);
export {
  ChatWidgetService
};
