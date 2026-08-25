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
import { $, addDisposableGenericMouseDownListener, addDisposableGenericMouseUpListener, addDisposableListener, addStandardDisposableListener, DisposableResizeObserver, EventHelper, EventType, getWindow, isHTMLElement, reset } from "../../../base/browser/dom.js";
import { ScrollableElement } from "../../../base/browser/ui/scrollbar/scrollableElement.js";
import { ScrollbarVisibility } from "../../../base/common/scrollable.js";
import { autorun } from "../../../base/common/observable.js";
import { isLinux } from "../../../base/common/platform.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { Action } from "../../../base/common/actions.js";
import { ActionBar } from "../../../base/browser/ui/actionbar/actionbar.js";
import { InputBox } from "../../../base/browser/ui/inputbox/inputBox.js";
import { defaultInputBoxStyles } from "../../../platform/theme/browser/defaultStyles.js";
import { Codicon } from "../../../base/common/codicons.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { IContextMenuService, IContextViewService } from "../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../platform/actions/browser/toolbar.js";
import { Menus } from "../menus.js";
import { StandardMouseEvent } from "../../../base/browser/mouseEvent.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { onUnexpectedError } from "../../../base/common/errors.js";
import { localize } from "../../../nls.js";
import { ChatInteractivity, getChatCapabilities, SessionStatus } from "../../services/sessions/common/session.js";
import { ISessionsManagementService } from "../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../services/sessions/browser/sessionsService.js";
import { ISessionsPartService } from "../../services/sessions/browser/sessionsPartService.js";
import { IHoverService } from "../../../platform/hover/browser/hover.js";
import { getDefaultHoverDelegate } from "../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { applySessionBarThemeColors } from "./sessionBarStyles.js";
import { applyDragImage } from "../../../base/browser/ui/dnd/dnd.js";
import { clearChatReferenceDragData, fillChatReferenceDragData } from "../dnd.js";
import { ISessionsProvidersService } from "../../services/sessions/browser/sessionsProvidersService.js";
import { isAgentHostProvider } from "../../common/agentHostSessionsProvider.js";
import { ICommandService } from "../../../platform/commands/common/commands.js";
import { CLOSE_CHAT_COMMAND_ID } from "../../common/sessionCommands.js";
let ChatCompositeBar = class extends Disposable {
  constructor(_themeService, _sessionsManagementService, _sessionsService, _sessionsPartService, _contextMenuService, _contextViewService, _hoverService, _instantiationService, _sessionsProvidersService, _commandService) {
    super();
    this._themeService = _themeService;
    this._sessionsManagementService = _sessionsManagementService;
    this._sessionsService = _sessionsService;
    this._sessionsPartService = _sessionsPartService;
    this._contextMenuService = _contextMenuService;
    this._contextViewService = _contextViewService;
    this._hoverService = _hoverService;
    this._instantiationService = _instantiationService;
    this._sessionsProvidersService = _sessionsProvidersService;
    this._commandService = _commandService;
    this._tabs = [];
    this._tabDisposables = this._register(new DisposableStore());
    this._sessionDisposables = this._register(new MutableDisposable());
    this._editingDisposables = this._register(new MutableDisposable());
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._visible = false;
    this._container = $(".chat-composite-bar.session-chat-tabs-bar");
    this._tabsRow = $(".chat-composite-bar-tabs-row");
    this._container.appendChild(this._tabsRow);
    this._tabsContainer = $(".chat-composite-bar-tabs");
    this._tabsContainer.setAttribute("role", "tablist");
    this._tabsContainer.setAttribute("aria-label", localize("chatTabsAriaLabel", "Chats"));
    this._tabsScrollbar = this._register(new ScrollableElement(this._tabsContainer, {
      horizontal: ScrollbarVisibility.Hidden,
      vertical: ScrollbarVisibility.Hidden,
      scrollYToX: true,
      useShadows: false
    }));
    this._tabsRow.appendChild(this._tabsScrollbar.getDomNode());
    const preventMiddleButtonDefault = (e) => {
      if (e.button === 1 && !this._isInTabInput(e)) {
        e.preventDefault();
      }
    };
    this._register(addDisposableGenericMouseDownListener(this._tabsContainer, preventMiddleButtonDefault));
    if (isLinux) {
      this._register(addDisposableGenericMouseUpListener(this._tabsContainer, preventMiddleButtonDefault));
    }
    const newChatAction = this._newChatAction = this._register(new Action(
      "chatCompositeBar.addChat",
      localize("chatCompositeBar.addChat", "New Chat"),
      ThemeIcon.asClassName(Codicon.add),
      true,
      async () => {
        const session = this._session;
        if (session && !session.isArchived.get()) {
          await this._sessionsService.openNewChatInSession(session);
          this._sessionsPartService.focusSession(session);
        }
      }
    ));
    const newChatActionBar = this._register(new ActionBar(this._tabsRow, { actionViewItemProvider: void 0 }));
    newChatActionBar.push(newChatAction, { icon: true, label: false });
    this._newChatContainer = newChatActionBar.getContainer();
    this._newChatContainer.classList.add("chat-composite-bar-new-chat");
    this._register(addDisposableListener(this._tabsContainer, EventType.SCROLL, () => {
      this._tabsScrollbar.setScrollPosition({ scrollLeft: this._tabsContainer.scrollLeft });
    }));
    this._register(this._tabsScrollbar.onScroll((e) => {
      if (e.scrollLeftChanged) {
        this._tabsContainer.scrollLeft = e.scrollLeft;
      }
    }));
    const resizeObserver = this._register(new DisposableResizeObserver("ChatCompositeBar.activeTabReveal", () => {
      this._updateScrollDimensions();
      this._revealActiveTab();
    }));
    this._register(resizeObserver.observe(this._tabsContainer));
    const heightObserver = this._register(new DisposableResizeObserver("ChatCompositeBar.height", () => {
      this._onDidChangeHeight.fire();
    }));
    this._register(heightObserver.observe(this._container));
    this._setVisible(false);
    this._updateStyles();
    this._register(this._themeService.onDidColorThemeChange(() => this._updateStyles()));
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
  /**
   * Tells the bar which session is currently relevant. The bar will display the chats
   * of the given session and track its active chat. Pass `undefined` to clear.
   */
  setSession(session) {
    if (this._session === session) {
      return;
    }
    this._session = session;
    const store = new DisposableStore();
    this._sessionDisposables.value = store;
    if (!session) {
      this._rebuildTabs([], "", void 0);
      this._setVisible(false);
      return;
    }
    this._setVisible(false);
    store.add(autorun((reader) => {
      const mainChat = session.mainChat.read(reader);
      const activeChatUri = session.activeChat.read(reader)?.resource.toString() ?? "";
      const mainChatUri = mainChat.resource.toString();
      const tabs = session.visibleChatTabs.read(reader);
      this._rebuildTabs(tabs, activeChatUri, mainChatUri);
      const supportsMultipleChats = session.capabilities.read(reader).supportsMultipleChats;
      this._newChatContainer.classList.toggle("hidden", !supportsMultipleChats);
      this._newChatAction.enabled = supportsMultipleChats && !session.isArchived.read(reader);
      this._setVisible(session.isCreated.read(reader) && session.shouldShowChatTabs.read(reader));
    }));
  }
  _rebuildTabs(chats, activeChatId, mainChatId) {
    this._cancelTabEditing();
    this._tabDisposables.clear();
    this._tabs.length = 0;
    reset(this._tabsContainer);
    for (const chat of chats) {
      this._createTab(chat, chat.resource.toString() === mainChatId);
    }
    this._updateActiveTab(activeChatId);
    this._updateScrollDimensions();
    this._onDidChangeHeight.fire();
  }
  _updateScrollDimensions() {
    this._tabsScrollbar.setScrollDimensions({
      width: this._tabsContainer.clientWidth,
      scrollWidth: this._tabsContainer.scrollWidth
    });
  }
  _createTab(chat, isMainChat) {
    const session = this._session;
    const tab = $(".chat-composite-bar-tab");
    tab.tabIndex = 0;
    tab.setAttribute("role", "tab");
    tab.dataset.chatResource = chat.resource.toString();
    tab.dataset.isMainChat = String(isMainChat);
    const tabFill = $(".chat-composite-bar-tab-fill", { "aria-hidden": true });
    tab.appendChild(tabFill);
    const labelEl = $(".chat-composite-bar-tab-label");
    this._tabDisposables.add(autorun((reader) => {
      const title = chat.title.read(reader);
      labelEl.textContent = title;
    }));
    const lockIcon = $(".chat-composite-bar-tab-lock");
    lockIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.lock));
    tab.appendChild(lockIcon);
    this._tabDisposables.add(autorun((reader) => {
      const isReadOnly = chat.interactivity.read(reader) === ChatInteractivity.ReadOnly;
      tab.classList.toggle("read-only", isReadOnly);
      tab.dataset.interactivity = chat.interactivity.read(reader);
    }));
    tab.appendChild(labelEl);
    const inputContainer = $(".chat-composite-bar-tab-input-container");
    tab.appendChild(inputContainer);
    this._tabDisposables.add(this._hoverService.setupManagedHover(
      getDefaultHoverDelegate("element"),
      tab,
      () => chat.title.get()
    ));
    this._tabDisposables.add(autorun((reader) => {
      const status = chat.status.read(reader);
      tab.classList.toggle("untitled", status === SessionStatus.Untitled);
    }));
    const indicator = $(".chat-composite-bar-tab-indicator");
    const indicatorIcon = $(".chat-composite-bar-tab-indicator-icon");
    indicator.appendChild(indicatorIcon);
    this._tabDisposables.add(autorun((reader) => {
      const activeChat = session?.activeChat.read(reader);
      const isActive = activeChat?.resource.toString() === chat.resource.toString();
      const status = chat.status.read(reader);
      const isRead = chat.isRead.read(reader);
      let mode = "none";
      if (status === SessionStatus.NeedsInput) {
        mode = "needs-input";
      } else if (status === SessionStatus.InProgress) {
        mode = "in-progress";
      } else if (!isRead && !isActive) {
        mode = "unread";
      }
      tab.classList.toggle("needs-input", mode === "needs-input");
      tab.classList.toggle("unread", mode === "unread");
      tab.classList.toggle("in-progress", mode === "in-progress");
      indicatorIcon.className = "chat-composite-bar-tab-indicator-icon";
      if (mode === "in-progress") {
        indicatorIcon.classList.add(...ThemeIcon.asClassNameArray(ThemeIcon.modify(Codicon.loading, "spin")));
      }
    }));
    tab.appendChild(indicator);
    if (!isMainChat && session) {
      const actionsContainer = $(".chat-composite-bar-tab-actions");
      tab.appendChild(actionsContainer);
      const tabToolbar = this._tabDisposables.add(this._instantiationService.createInstance(MenuWorkbenchToolBar, actionsContainer, Menus.SessionChatTab, {
        hiddenItemStrategy: HiddenItemStrategy.Ignore,
        menuOptions: { shouldForwardArgs: true },
        toolbarOptions: { primaryGroup: () => true }
      }));
      tabToolbar.context = { session, chat };
    }
    this._tabsContainer.appendChild(tab);
    const chatTab = { chat, element: tab, inputContainer };
    this._tabDisposables.add(addDisposableListener(tab, EventType.CLICK, () => {
      this._cancelTabEditing();
      this._onTabClicked(chat);
    }));
    this._tabDisposables.add(addDisposableListener(tab, EventType.AUXCLICK, (e) => {
      if (e.button !== 1) {
        return;
      }
      if (this._isInTabInput(e)) {
        return;
      }
      EventHelper.stop(e, true);
      if (isMainChat || !session) {
        return;
      }
      this._cancelTabEditing();
      void this._commandService.executeCommand(CLOSE_CHAT_COMMAND_ID, { session, chat }).catch(onUnexpectedError);
    }));
    tab.draggable = true;
    this._tabDisposables.add(addDisposableListener(tab, EventType.DRAG_START, (e) => {
      if (!e.dataTransfer) {
        e.preventDefault();
        return;
      }
      const target = e.target;
      if (target?.closest(".chat-composite-bar-tab-actions")) {
        e.preventDefault();
        return;
      }
      if (this._editingTab) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = "copy";
      const backendChatResource = this._backendChatResource(chat);
      if (backendChatResource) {
        fillChatReferenceDragData(e, backendChatResource, chat.resource, chat.title.get());
      }
      applyDragImage(e, tab, chat.title.get());
    }));
    this._tabDisposables.add(addDisposableListener(tab, EventType.DRAG_END, () => {
      clearChatReferenceDragData();
    }));
    this._tabDisposables.add(addDisposableListener(tab, EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this._onTabClicked(chat);
      }
    }));
    const renameAction = this._tabDisposables.add(new Action("sessionCompositeBar.renameChat", localize("renameChat", "Rename"), void 0, true, async () => {
      this._startTabEditing(chatTab);
    }));
    const deleteAction = this._tabDisposables.add(new Action("sessionCompositeBar.deleteChat", localize("deleteChat", "Delete Chat"), void 0, true, async () => {
      if (this._session) {
        await this._sessionsManagementService.deleteChat(this._session, chat.resource);
      }
    }));
    this._tabDisposables.add(addDisposableListener(tab, EventType.DBLCLICK, (e) => {
      if (chat.status.get() === SessionStatus.Untitled || !getChatCapabilities(chat, session, void 0).canRename) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      this._startTabEditing(chatTab);
    }));
    this._tabDisposables.add(addDisposableListener(tab, EventType.CONTEXT_MENU, (e) => {
      if (chat.status.get() === SessionStatus.Untitled) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const event = new StandardMouseEvent(getWindow(tab), e);
      this._contextMenuService.showContextMenu({
        getAnchor: () => event,
        getActions: () => {
          const capabilities = getChatCapabilities(chat, session, void 0);
          const actions = [];
          if (capabilities.canRename) {
            actions.push(renameAction);
          }
          if (capabilities.canDelete) {
            actions.push(deleteAction);
          }
          return actions;
        }
      });
    }));
    this._tabs.push(chatTab);
  }
  _onTabClicked(chat) {
    if (this._session) {
      this._sessionsService.openChat(this._session, chat.resource);
    }
  }
  _isInTabInput(event) {
    return isHTMLElement(event.target) && !!event.target.closest(".chat-composite-bar-tab-input-container");
  }
  /**
   * Resolves the opaque backend chat URI for a chat tab so a dragged `#chat:`
   * reference can carry it. Reaches the owning agent-host provider by id and
   * asks it to look up the host-supplied backend resource. Returns `undefined`
   * when the session is not agent-host backed or the provider has no hydrated
   * state for the chat — the caller then offers no chat-reference payload.
   */
  _backendChatResource(chat) {
    const providerId = this._session?.providerId;
    if (!providerId) {
      return void 0;
    }
    const provider = this._sessionsProvidersService.getProvider(providerId);
    return provider && isAgentHostProvider(provider) ? provider.getBackendChatResource(chat.resource) : void 0;
  }
  /**
   * Start an inline rename for the given tab. Enter commits via
   * {@link ISessionsManagementService.renameChat}; Escape or blur cancels.
   */
  _startTabEditing(chatTab) {
    const session = this._session;
    if (!session || this._editingTab) {
      return;
    }
    const { chat, element: tab, inputContainer } = chatTab;
    const initialTitle = chat.title.get();
    this._editingTab = chatTab;
    tab.classList.add("editing");
    const store = new DisposableStore();
    this._editingDisposables.value = store;
    const inputBox = store.add(new InputBox(inputContainer, this._contextViewService, {
      ariaLabel: localize("renameChat.aria", "Rename chat"),
      inputBoxStyles: defaultInputBoxStyles
    }));
    inputBox.element.classList.add("chat-composite-bar-tab-input");
    inputBox.value = initialTitle;
    inputBox.focus();
    inputBox.select();
    let finished = false;
    const finish = (commit) => {
      if (finished) {
        return;
      }
      finished = true;
      const newTitle = inputBox.value.trim();
      this._endTabEditing();
      if (commit && newTitle && newTitle !== initialTitle) {
        this._sessionsManagementService.renameChat(session, chat.resource, newTitle).catch(onUnexpectedError);
      }
    };
    store.add(addStandardDisposableListener(inputBox.inputElement, EventType.KEY_DOWN, (e) => {
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
    store.add(addDisposableListener(inputBox.inputElement, EventType.BLUR, () => finish(false)));
    store.add(addDisposableListener(inputBox.element, EventType.CLICK, (e) => e.stopPropagation()));
    store.add(addDisposableListener(inputBox.element, EventType.DBLCLICK, (e) => e.stopPropagation()));
  }
  _cancelTabEditing() {
    if (!this._editingTab) {
      return;
    }
    this._endTabEditing();
  }
  _endTabEditing() {
    const editingTab = this._editingTab;
    this._editingTab = void 0;
    this._editingDisposables.clear();
    if (editingTab) {
      editingTab.element.classList.remove("editing");
      reset(editingTab.inputContainer);
    }
  }
  _updateActiveTab(activeChatId) {
    for (const tab of this._tabs) {
      const isActive = tab.chat.resource.toString() === activeChatId;
      tab.element.classList.toggle("active", isActive);
      tab.element.setAttribute("aria-selected", String(isActive));
      if (isActive) {
        tab.element.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  }
  _revealActiveTab() {
    const activeTab = this._tabs.find((t) => t.element.classList.contains("active"));
    activeTab?.element.scrollIntoView({ block: "nearest", inline: "nearest" });
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
};
ChatCompositeBar = __decorateClass([
  __decorateParam(0, IThemeService),
  __decorateParam(1, ISessionsManagementService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, ISessionsPartService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IContextViewService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, ISessionsProvidersService),
  __decorateParam(9, ICommandService)
], ChatCompositeBar);
export {
  ChatCompositeBar
};
