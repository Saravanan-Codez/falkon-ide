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
import "./media/chatCompositeBar.css";
import { Disposable, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { Emitter } from "../../../base/common/event.js";
import { $, addDisposableGenericMouseDownListener, addDisposableListener, addStandardDisposableListener, DisposableResizeObserver, EventType, getWindow, isMouseEvent } from "../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../base/browser/mouseEvent.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { autorun, observableSignalFromEvent } from "../../../base/common/observable.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { localize } from "../../../nls.js";
import { ISessionsManagementService } from "../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../services/sessions/browser/sessionsService.js";
import { getUntitledSessionTitle } from "../../services/sessions/common/session.js";
import { ActionRunner } from "../../../base/common/actions.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../platform/actions/browser/toolbar.js";
import { MenuItemAction } from "../../../platform/actions/common/actions.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { Menus } from "../menus.js";
import { LocalSelectionTransfer } from "../../../platform/dnd/browser/dnd.js";
import { DraggedSessionIdentifier, SessionsDataTransfers } from "../dnd.js";
import { applyDragImage } from "../../../base/browser/ui/dnd/dnd.js";
import { applySessionBarThemeColors } from "./sessionBarStyles.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { onUnexpectedError } from "../../../base/common/errors.js";
import { SessionStatusIcon } from "../sessionStatusIcon.js";
import { SessionHeaderMetaActionViewItem } from "./sessionHeaderMetaActionViewItem.js";
class SessionActivatingActionRunner extends ActionRunner {
  constructor(_getSession, _sessionsService) {
    super();
    this._getSession = _getSession;
    this._sessionsService = _sessionsService;
  }
  async runAction(action, context) {
    const session = this._getSession();
    if (session) {
      this._sessionsService.setActive(session);
    }
    await super.runAction(action, context);
  }
}
let SessionHeader = class extends Disposable {
  constructor(_themeService, instantiationService, _contextMenuService, _contextKeyService, _sessionsManagementService, _sessionsService) {
    super();
    this._themeService = _themeService;
    this._contextMenuService = _contextMenuService;
    this._contextKeyService = _contextKeyService;
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._sessionDisposables = this._register(new MutableDisposable());
    this._editingDisposables = this._register(new MutableDisposable());
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._visible = false;
    this._sessionTransfer = LocalSelectionTransfer.getInstance();
    this._container = $(".chat-composite-bar.session-header-bar");
    const header = $(".chat-composite-bar-header");
    this._container.appendChild(header);
    this._iconEl = $(".chat-composite-bar-session-icon");
    header.appendChild(this._iconEl);
    this._statusIcon = this._register(instantiationService.createInstance(SessionStatusIcon, this._iconEl));
    const main = $(".chat-composite-bar-header-main");
    header.appendChild(main);
    const titleRow = $(".chat-composite-bar-title-row");
    main.appendChild(titleRow);
    this._titleEl = $(".chat-composite-bar-session-title");
    titleRow.appendChild(this._titleEl);
    this._titleTextEl = $("span.chat-composite-bar-session-title-text");
    this._titleEl.appendChild(this._titleTextEl);
    this._register(addDisposableListener(this._titleEl, EventType.CLICK, () => {
      this.startTitleEditing();
    }));
    const titleActions = $(".chat-composite-bar-title-actions");
    titleRow.appendChild(titleActions);
    this._titleActionsEl = titleActions;
    const toolbarContainer = $(".chat-composite-bar-toolbar");
    titleActions.appendChild(toolbarContainer);
    this._toolbar = this._register(instantiationService.createInstance(MenuWorkbenchToolBar, toolbarContainer, Menus.SessionBarToolbar, {
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      menuOptions: { shouldForwardArgs: true },
      highlightToggledItems: true,
      // Render every group in the primary slot with a separator between groups
      // so the actions stay visually grouped.
      toolbarOptions: { primaryGroup: () => true, useSeparatorsInPrimaryActions: true }
    }));
    this._metaRow = $(".chat-composite-bar-meta-row");
    main.appendChild(this._metaRow);
    const metaToolbarContainer = $(".chat-composite-bar-meta-toolbar");
    this._metaRow.appendChild(metaToolbarContainer);
    const metaActionRunner = this._register(new SessionActivatingActionRunner(() => this._session, this._sessionsService));
    this._metaToolbar = this._register(instantiationService.createInstance(MenuWorkbenchToolBar, metaToolbarContainer, Menus.SessionHeaderMeta, {
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      menuOptions: { shouldForwardArgs: true },
      actionRunner: metaActionRunner,
      // Render every meta action as a consistent `icon title` pill unless it
      // registers its own action view item via IActionViewItemService.
      actionViewItemProvider: (action, options) => {
        if (action instanceof MenuItemAction) {
          return instantiationService.createInstance(SessionHeaderMetaActionViewItem, void 0, action, options);
        }
        return void 0;
      }
    }));
    this._metaActionsSignal = observableSignalFromEvent(this, this._metaToolbar.onDidChangeMenuItems);
    const heightObserver = this._register(new DisposableResizeObserver("SessionHeader.height", () => {
      this._onDidChangeHeight.fire();
    }));
    this._register(heightObserver.observe(this._container));
    this._setVisible(false);
    this._updateStyles();
    this._register(this._themeService.onDidColorThemeChange(() => this._updateStyles()));
    this._registerDragSource();
    this._registerContextMenu();
  }
  get element() {
    return this._container;
  }
  get visible() {
    return this._visible;
  }
  get height() {
    return this._visible ? this._container.offsetHeight : 0;
  }
  _registerContextMenu() {
    this._register(addDisposableListener(this._container, EventType.CONTEXT_MENU, (e) => {
      const session = this._session;
      if (!session) {
        return;
      }
      let anchor = this._container;
      if (isMouseEvent(e)) {
        anchor = new StandardMouseEvent(getWindow(this._container), e);
      }
      e.preventDefault();
      e.stopPropagation();
      this._contextMenuService.showContextMenu({
        menuId: Menus.SessionHeaderContext,
        menuActionOptions: { shouldForwardArgs: true, arg: session },
        getAnchor: () => anchor,
        contextKeyService: this._contextKeyService
      });
    }));
  }
  _registerDragSource() {
    this._container.draggable = true;
    this._register(addDisposableGenericMouseDownListener(this._container, (e) => {
      this._lastPointerDownTarget = e.target ?? void 0;
    }));
    this._register(addDisposableListener(this._container, EventType.DRAG_START, (e) => {
      const session = this._session;
      if (!session || !e.dataTransfer) {
        e.preventDefault();
        return;
      }
      const target = this._lastPointerDownTarget;
      if (target && (this._titleActionsEl.contains(target) || this._metaRow.contains(target))) {
        e.preventDefault();
        return;
      }
      if (this._renameInput) {
        e.preventDefault();
        return;
      }
      this._sessionTransfer.setData(
        [new DraggedSessionIdentifier(session.sessionId, session.resource)],
        DraggedSessionIdentifier.prototype
      );
      const payload = JSON.stringify({ sessionId: session.sessionId, resource: session.resource.toString() });
      e.dataTransfer.setData(SessionsDataTransfers.SESSION, payload);
      e.dataTransfer.effectAllowed = "move";
      applyDragImage(e, this._container, session.title.get());
    }));
    this._register(addDisposableListener(this._container, EventType.DRAG_END, () => {
      this._sessionTransfer.clearData(DraggedSessionIdentifier.prototype);
    }));
  }
  /**
   * Tells the header which session is currently relevant. Pass `undefined` to clear.
   */
  setSession(session) {
    if (this._session === session) {
      return;
    }
    this._cancelTitleEditing();
    this._session = session;
    this._toolbar.context = session;
    this._metaToolbar.context = session;
    this._statusIcon.reset();
    const store = new DisposableStore();
    this._sessionDisposables.value = store;
    if (!session) {
      this._setVisible(false);
      return;
    }
    store.add(autorun((reader) => {
      this._updateHeader(session, reader);
    }));
    store.add(autorun((reader) => {
      this._setVisible(session.isCreated.read(reader));
    }));
  }
  _updateHeader(session, reader) {
    const status = session.status.read(reader);
    const isRead = session.isRead.read(reader);
    const isArchived = session.isArchived.read(reader);
    this._statusIcon.setStatus(status, isRead, isArchived);
    const isQuickChat = session.isQuickChat?.read(reader) ?? false;
    this._titleTextEl.textContent = session.title.read(reader) || getUntitledSessionTitle(isQuickChat);
    this._titleEl.classList.toggle("editable", this._isTitleEditable());
    this._metaActionsSignal.read(reader);
    const hasMetaActions = !this._metaToolbar.isEmpty();
    this._metaRow.style.display = hasMetaActions ? "" : "none";
    this._onDidChangeHeight.fire();
  }
  _setVisible(visible) {
    const wasVisible = this._visible;
    this._visible = visible;
    this._container.style.display = this._visible ? "" : "none";
    if (wasVisible !== this._visible) {
      this._onDidChangeVisibility.fire(this._visible);
    }
  }
  _updateStyles() {
    applySessionBarThemeColors(this._container, this._themeService.getColorTheme());
  }
  /**
   * The title is editable when the backing provider declares it supports
   * renaming the session (`capabilities.supportsRename`). This is the same
   * signal that gates the `Rename...` context menu action in the sessions list.
   */
  _isTitleEditable() {
    return !!this._session && (this._session.capabilities.get().supportsRename ?? false);
  }
  startTitleEditing() {
    if (!this._isTitleEditable() || this._renameInput) {
      return;
    }
    this._startTitleEditing();
  }
  /**
   * Replace the rendered title text with an `<input>` containing the current
   * title (pre-selected). Enter commits via {@link ISessionsManagementService.renameChat},
   * Escape or blur cancels.
   */
  _startTitleEditing() {
    const session = this._session;
    if (!session || this._renameInput) {
      return;
    }
    const initialTitle = session.title.get();
    const fallbackTitle = getUntitledSessionTitle(session.isQuickChat?.get() ?? false);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "chat-composite-bar-session-title-input";
    input.value = initialTitle;
    input.placeholder = fallbackTitle;
    input.setAttribute("aria-label", localize("renameSession.aria", "Rename session"));
    input.spellcheck = false;
    this._titleTextEl.style.display = "none";
    this._titleEl.appendChild(input);
    this._titleEl.classList.add("editing");
    this._renameInput = input;
    input.focus();
    input.select();
    const store = new DisposableStore();
    this._editingDisposables.value = store;
    let finished = false;
    const finish = (commit) => {
      if (finished) {
        return;
      }
      finished = true;
      const newTitle = input.value.trim();
      this._endTitleEditing();
      if (commit && newTitle && newTitle !== initialTitle) {
        this._sessionsManagementService.renameSession(session, newTitle).catch(onUnexpectedError);
      }
    };
    store.add(addStandardDisposableListener(input, EventType.KEY_DOWN, (e) => {
      if (e.equals(KeyCode.Enter)) {
        e.preventDefault();
        e.stopPropagation();
        finish(true);
      } else if (e.equals(KeyCode.Escape)) {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      } else {
        e.stopPropagation();
      }
    }));
    store.add(addDisposableListener(input, EventType.BLUR, () => {
      finish(false);
    }));
    store.add(addDisposableGenericMouseDownListener(input, (e) => e.stopPropagation()));
    store.add(addDisposableListener(input, EventType.CLICK, (e) => e.stopPropagation()));
  }
  _cancelTitleEditing() {
    if (!this._renameInput) {
      return;
    }
    this._endTitleEditing();
  }
  _endTitleEditing() {
    if (this._renameInput) {
      this._renameInput.remove();
      this._renameInput = void 0;
    }
    this._titleTextEl.style.display = "";
    this._titleEl.classList.remove("editing");
    this._editingDisposables.clear();
  }
};
SessionHeader = __decorateClass([
  __decorateParam(0, IThemeService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ISessionsManagementService),
  __decorateParam(5, ISessionsService)
], SessionHeader);
let SessionViewFloatingToolbar = class extends Disposable {
  constructor(instantiationService) {
    super();
    this._sessionDisposables = this._register(new MutableDisposable());
    this._container = $(".chat-composite-bar.chat-composite-bar-toolbar-floating");
    const toolbar = $(".chat-composite-bar-toolbar");
    this._container.appendChild(toolbar);
    this._toolbar = this._register(instantiationService.createInstance(MenuWorkbenchToolBar, toolbar, Menus.SessionBarToolbar, {
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      menuOptions: { shouldForwardArgs: true },
      highlightToggledItems: true,
      toolbarOptions: { primaryGroup: () => true, useSeparatorsInPrimaryActions: true }
    }));
    this._setVisible(false);
  }
  get element() {
    return this._container;
  }
  setSession(session) {
    if (this._session === session) {
      return;
    }
    this._session = session;
    this._toolbar.context = session;
    const store = new DisposableStore();
    this._sessionDisposables.value = store;
    if (!session) {
      this._setVisible(false);
      return;
    }
    store.add(autorun((reader) => {
      this._setVisible(!session.isCreated.read(reader));
    }));
  }
  _setVisible(visible) {
    this._container.style.display = visible ? "" : "none";
  }
};
SessionViewFloatingToolbar = __decorateClass([
  __decorateParam(0, IInstantiationService)
], SessionViewFloatingToolbar);
export {
  SessionHeader,
  SessionViewFloatingToolbar
};
