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
import "./mobileChatShell.css";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { $, addDisposableListener, append, EventType } from "../../../../base/browser/dom.js";
import { Emitter } from "../../../../base/common/event.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Separator } from "../../../../base/common/actions.js";
import { localize } from "../../../../nls.js";
import { autorun } from "../../../../base/common/observable.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IMenuService } from "../../../../platform/actions/common/actions.js";
import { fillInActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IDefaultAccountService } from "../../../../platform/defaultAccount/common/defaultAccount.js";
import { IAuthenticationService } from "../../../../workbench/services/authentication/common/authentication.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { IsNewChatSessionContext } from "../../../common/contextkeys.js";
import { SideBarVisibleContext } from "../../../../workbench/common/contextkeys.js";
import { Menus } from "../../menus.js";
import { ChatEntitlement, IChatEntitlementService } from "../../../../workbench/services/chat/common/chatEntitlementService.js";
import { getAccountTitleBarState, getAccountProfileImageUrl, getAccountTitleBarBadgeKey, resolveAccountInfo } from "../../accountTitleBarState.js";
import { IChatDashboardService } from "../../chatDashboardService.js";
import { MOBILE_OPEN_CHANGES_VIEW_COMMAND_ID } from "./contributions/mobileChangesView.js";
let MobileTitlebarPart = class extends Disposable {
  constructor(parent, instantiationService, sessionsService, contextKeyService, defaultAccountService, authenticationService, chatEntitlementService, menuService, chatDashboardService, commandService) {
    super();
    this.sessionsService = sessionsService;
    this.contextKeyService = contextKeyService;
    this.defaultAccountService = defaultAccountService;
    this.authenticationService = authenticationService;
    this.chatEntitlementService = chatEntitlementService;
    this.menuService = menuService;
    this.chatDashboardService = chatDashboardService;
    this.commandService = commandService;
    this._onDidClickHamburger = this._register(new Emitter());
    this.onDidClickHamburger = this._onDidClickHamburger.event;
    this._onDidClickNewSession = this._register(new Emitter());
    this.onDidClickNewSession = this._onDidClickNewSession.event;
    this._onDidClickTitle = this._register(new Emitter());
    this.onDidClickTitle = this._onDidClickTitle.event;
    this.isAccountLoading = true;
    this.accountRequestCounter = 0;
    this.avatarRequestCounter = 0;
    this.isAccountMenuVisible = false;
    this.accountPanelDisposable = this._register(new MutableDisposable());
    this.avatarLoadDisposable = this._register(new MutableDisposable());
    this.copilotDashboardStore = this._register(new MutableDisposable());
    // Changes pill state — kept here so the click handler can read the
    // latest set without re-deriving it on each tap.
    this.latestChanges = [];
    this.element = document.createElement("div");
    this.element.className = "mobile-top-bar";
    this._register(toDisposable(() => this.element.remove()));
    parent.prepend(this.element);
    const hamburger = append(this.element, $("button.mobile-top-bar-button"));
    hamburger.setAttribute("aria-label", localize("mobileTopBar.openSessions", "Open sessions"));
    const hamburgerIcon = append(hamburger, $("span"));
    const closedIconClasses = ThemeIcon.asClassNameArray(Codicon.layoutSidebarLeftOff);
    const openIconClasses = ThemeIcon.asClassNameArray(Codicon.layoutSidebarLeft);
    hamburgerIcon.classList.add(...closedIconClasses);
    this._register(addDisposableListener(hamburger, EventType.CLICK, () => this._onDidClickHamburger.fire()));
    const sidebarVisibleKeySet = /* @__PURE__ */ new Set([SideBarVisibleContext.key]);
    const updateSidebarIcon = () => {
      const isOpen = !!SideBarVisibleContext.getValue(contextKeyService);
      hamburgerIcon.classList.remove(...closedIconClasses, ...openIconClasses);
      hamburgerIcon.classList.add(...isOpen ? openIconClasses : closedIconClasses);
      hamburger.setAttribute("aria-label", isOpen ? localize("mobileTopBar.closeSessions", "Close sessions") : localize("mobileTopBar.openSessions", "Open sessions"));
    };
    updateSidebarIcon();
    const center = append(this.element, $("div.mobile-top-bar-center"));
    this.sessionTitleElement = append(center, $("button.mobile-session-title"));
    this.sessionTitleElement.setAttribute("type", "button");
    this.sessionTitleElement.textContent = localize("mobileTopBar.newSession", "New Session");
    this._register(addDisposableListener(this.sessionTitleElement, EventType.CLICK, () => this._onDidClickTitle.fire()));
    this.actionsContainer = append(center, $("div.mobile-top-bar-actions"));
    const changesPill = append(this.element, $("button.mobile-top-bar-button.mobile-changes-pill", { type: "button" }));
    changesPill.setAttribute("aria-label", localize("mobileTopBar.changes", "View changes"));
    changesPill.style.display = "none";
    const changesIcon = append(changesPill, $("span.mobile-changes-pill-icon"));
    changesIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.diffMultiple));
    const changesAddedEl = append(changesPill, $("span.mobile-changes-pill-added"));
    const changesRemovedEl = append(changesPill, $("span.mobile-changes-pill-removed"));
    this._register(addDisposableListener(changesPill, EventType.CLICK, () => this.showChangesPicker()));
    const newSessionButton = append(this.element, $("button.mobile-top-bar-button.mobile-new-session-button"));
    newSessionButton.setAttribute("aria-label", localize("mobileTopBar.newSessionAria", "New session"));
    const newSessionIcon = append(newSessionButton, $("span"));
    newSessionIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.plus));
    this._register(addDisposableListener(newSessionButton, EventType.CLICK, () => this._onDidClickNewSession.fire()));
    this.accountButton = append(this.element, $("button.mobile-top-bar-button.mobile-account-indicator"));
    this.accountButton.setAttribute("aria-label", localize("mobileTopBar.account", "Account"));
    this.accountAvatarElement = append(this.accountButton, $("img.mobile-account-avatar", { alt: "", draggable: "false" }));
    this.accountAvatarElement.decoding = "async";
    this.accountAvatarElement.referrerPolicy = "no-referrer";
    this.accountIconElement = append(this.accountButton, $("span"));
    this.accountBadgeElement = append(this.accountButton, $("span.mobile-account-badge"));
    this._register(addDisposableListener(this.accountButton, EventType.CLICK, () => this.showAccountPanel()));
    this._register(this.defaultAccountService.onDidChangeDefaultAccount(() => this.refreshAccount()));
    this._register(this.authenticationService.onDidChangeSessions(() => this.refreshAccount()));
    this._register(this.chatEntitlementService.onDidChangeEntitlement(() => this.renderAccountState()));
    this._register(this.chatEntitlementService.onDidChangeSentiment(() => this.renderAccountState()));
    this._register(this.chatEntitlementService.onDidChangeQuotaExceeded(() => this.renderAccountState()));
    this._register(this.chatEntitlementService.onDidChangeQuotaRemaining(() => this.renderAccountState()));
    this.refreshAccount();
    this._register(autorun((reader) => {
      const session = this.sessionsService.activeSession.read(reader);
      const title = session?.title.read(reader);
      this.sessionTitleElement.textContent = title || localize("mobileTopBar.newSession", "New Session");
    }));
    const isNewChatRef = { value: !!IsNewChatSessionContext.getValue(contextKeyService) };
    const renderChangesPill = () => {
      const changes = this.latestChanges;
      let added = 0;
      let removed = 0;
      for (const c of changes) {
        added += c.insertions;
        removed += c.deletions;
      }
      const hasChanges = changes.length > 0;
      const visible = hasChanges && !isNewChatRef.value;
      changesPill.style.display = visible ? "" : "none";
      if (visible) {
        if (added > 0 || removed > 0) {
          changesAddedEl.textContent = `+${added}`;
          changesRemovedEl.textContent = `-${removed}`;
          changesPill.title = localize("mobileTopBar.changesTooltip", "{0} files changed (+{1} -{2})", changes.length, added, removed);
        } else {
          changesAddedEl.textContent = changes.length === 1 ? localize("mobileTopBar.singleFileChanged", "1 file") : localize("mobileTopBar.filesChangedCount", "{0} files", changes.length);
          changesRemovedEl.textContent = "";
          changesPill.title = changes.length === 1 ? localize("mobileTopBar.singleFileChangedTooltip", "1 file changed") : localize("mobileTopBar.filesChangedTooltip", "{0} files changed", changes.length);
        }
      }
    };
    this._register(autorun((reader) => {
      const session = this.sessionsService.activeSession.read(reader);
      this.latestChanges = session?.changes.read(reader) ?? [];
      renderChangesPill();
    }));
    const toolbar = this._register(instantiationService.createInstance(MenuWorkbenchToolBar, this.actionsContainer, Menus.MobileTitleBarCenter, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      telemetrySource: "mobileTitlebar.center",
      toolbarOptions: { primaryGroup: () => true }
    }));
    const newChatKeySet = /* @__PURE__ */ new Set([IsNewChatSessionContext.key]);
    const updateCenterMode = () => {
      const isNewChat = !!IsNewChatSessionContext.getValue(contextKeyService);
      const hasActions = toolbar.getItemsLength() > 0;
      this.element.classList.toggle("show-actions", isNewChat && hasActions);
      newSessionButton.style.display = isNewChat ? "none" : "";
      this.accountButton.style.display = isNewChat ? "" : "none";
      isNewChatRef.value = isNewChat;
      renderChangesPill();
    };
    updateCenterMode();
    this._register(contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(newChatKeySet)) {
        updateCenterMode();
      }
      if (e.affectsSome(sidebarVisibleKeySet)) {
        updateSidebarIcon();
      }
    }));
    this._register(toolbar.onDidChangeMenuItems(() => updateCenterMode()));
  }
  /**
   * Explicitly set the title shown in the center slot. Called only when
   * overriding the live session title (tests, placeholders). The live
   * subscription will overwrite this on the next session change.
   */
  setTitle(title) {
    this.sessionTitleElement.textContent = title;
  }
  // --- Changes Pill --- //
  /**
   * Tap handler for the changes pill. Opens the dedicated mobile
   * Changes overlay (a master list with file icons + add/remove
   * counts) via {@link MOBILE_OPEN_CHANGES_VIEW_COMMAND_ID}. The
   * overlay's own row taps fan out into per-file diff views with
   * prev/next navigation.
   *
   * The list overlay handles its own single-file shortcut, so the
   * caller just dispatches the command unconditionally.
   */
  showChangesPicker() {
    if (!this.latestChanges.length) {
      return;
    }
    this.commandService.executeCommand(MOBILE_OPEN_CHANGES_VIEW_COMMAND_ID);
  }
  // --- Account Indicator --- //
  async refreshAccount() {
    const requestId = ++this.accountRequestCounter;
    this.isAccountLoading = true;
    this.renderAccountState();
    const info = await resolveAccountInfo(this.defaultAccountService, this.authenticationService);
    if (requestId !== this.accountRequestCounter || this._store.isDisposed) {
      return;
    }
    this.accountName = info?.accountName;
    this.accountProviderId = info?.accountProviderId;
    this.accountProviderLabel = info?.accountProviderLabel;
    this.isAccountLoading = false;
    this.refreshAvatar();
    this.renderAccountState();
  }
  renderAccountState() {
    const entitlement = this.accountName && this.chatEntitlementService.entitlement === ChatEntitlement.Unknown ? ChatEntitlement.Unresolved : this.chatEntitlementService.entitlement;
    const state = getAccountTitleBarState({
      isAccountLoading: this.isAccountLoading,
      accountName: this.accountName,
      accountProviderLabel: this.accountProviderLabel,
      entitlement,
      sentiment: this.chatEntitlementService.sentiment,
      quotas: this.chatEntitlementService.quotas,
      // The conditional-auth opt-in is desktop-only (the native agent host
      // that makes a type usable without GitHub does not run on mobile/web).
      usableWithoutGitHub: false
    });
    const hasAvatar = !!this.loadedAvatarUrl && !this.isAccountLoading;
    this.accountAvatarElement.classList.toggle("visible", hasAvatar);
    if (hasAvatar && this.accountAvatarElement.src !== this.loadedAvatarUrl) {
      this.accountAvatarElement.src = this.loadedAvatarUrl;
    } else if (!hasAvatar) {
      this.accountAvatarElement.removeAttribute("src");
    }
    const titleBarIcon = state.dotBadge ? Codicon.account : state.icon;
    this.accountIconElement.className = ThemeIcon.asClassName(titleBarIcon);
    this.accountIconElement.classList.toggle("hidden", hasAvatar);
    const badgeKey = getAccountTitleBarBadgeKey(state);
    if (badgeKey !== this.lastBadgeKey) {
      this.lastBadgeKey = badgeKey;
      this.dismissedBadgeKey = void 0;
    }
    const showBadge = !!badgeKey && badgeKey !== this.dismissedBadgeKey;
    this.accountBadgeElement.style.display = showBadge ? "" : "none";
    this.accountBadgeElement.classList.toggle("dot-badge-warning", showBadge && state.dotBadge === "warning");
    this.accountBadgeElement.classList.toggle("dot-badge-error", showBadge && state.dotBadge === "error");
    this.accountButton.setAttribute("aria-label", state.ariaLabel);
  }
  refreshAvatar() {
    const avatarUrl = getAccountProfileImageUrl(this.accountProviderId, this.accountName);
    if (avatarUrl === this.currentAvatarUrl) {
      return;
    }
    this.currentAvatarUrl = avatarUrl;
    this.loadedAvatarUrl = void 0;
    this.avatarLoadDisposable.clear();
    const requestId = ++this.avatarRequestCounter;
    if (!avatarUrl) {
      this.renderAccountState();
      return;
    }
    const image = new Image();
    image.referrerPolicy = "no-referrer";
    const clearHandlers = () => {
      image.onload = null;
      image.onerror = null;
    };
    image.onload = () => {
      if (requestId !== this.avatarRequestCounter) {
        return;
      }
      this.loadedAvatarUrl = avatarUrl;
      this.renderAccountState();
      clearHandlers();
    };
    image.onerror = () => {
      if (requestId !== this.avatarRequestCounter) {
        return;
      }
      this.loadedAvatarUrl = void 0;
      this.renderAccountState();
      clearHandlers();
    };
    this.avatarLoadDisposable.value = toDisposable(() => {
      clearHandlers();
      image.src = "";
    });
    image.src = avatarUrl;
  }
  // --- Account Sheet --- //
  showAccountPanel() {
    if (this.isAccountMenuVisible) {
      this.accountPanelDisposable.clear();
      return;
    }
    this.accountPanelDisposable.clear();
    const panelStore = new DisposableStore();
    this.accountPanelDisposable.value = panelStore;
    const badgeKey = getAccountTitleBarBadgeKey(getAccountTitleBarState({
      isAccountLoading: this.isAccountLoading,
      accountName: this.accountName,
      accountProviderLabel: this.accountProviderLabel,
      entitlement: this.chatEntitlementService.entitlement,
      sentiment: this.chatEntitlementService.sentiment,
      quotas: this.chatEntitlementService.quotas,
      usableWithoutGitHub: false
    }));
    if (badgeKey) {
      this.dismissedBadgeKey = badgeKey;
    }
    this.isAccountMenuVisible = true;
    this.renderAccountState();
    panelStore.add({
      dispose: () => {
        this.isAccountMenuVisible = false;
        this.copilotDashboardStore.clear();
        this.renderAccountState();
      }
    });
    const closeSheet = () => this.accountPanelDisposable.clear();
    const workbenchContainer = this.element.parentElement;
    const sheet = append(workbenchContainer, $("div.mobile-account-sheet"));
    panelStore.add(toDisposable(() => sheet.remove()));
    const header = append(sheet, $("div.mobile-account-sheet-header"));
    const headerTitle = append(header, $("h2.mobile-account-sheet-title"));
    headerTitle.textContent = localize("mobileAccount.title", "Account");
    const closeButton = append(header, $("button.mobile-account-sheet-close", { type: "button" }));
    closeButton.setAttribute("aria-label", localize("mobileAccount.close", "Close"));
    append(closeButton, $("span")).classList.add(...ThemeIcon.asClassNameArray(Codicon.close));
    panelStore.add(addDisposableListener(closeButton, EventType.CLICK, closeSheet));
    const content = append(sheet, $("div.mobile-account-sheet-content"));
    const profile = append(content, $("div.mobile-account-sheet-profile"));
    if (this.loadedAvatarUrl) {
      const avatar = append(profile, $("img.mobile-account-sheet-avatar", { alt: "", draggable: "false" }));
      avatar.src = this.loadedAvatarUrl;
      avatar.referrerPolicy = "no-referrer";
      avatar.decoding = "async";
    } else {
      const avatarPlaceholder = append(profile, $("div.mobile-account-sheet-avatar-placeholder"));
      append(avatarPlaceholder, $("span")).classList.add(...ThemeIcon.asClassNameArray(Codicon.account));
    }
    const profileInfo = append(profile, $("div.mobile-account-sheet-profile-info"));
    if (this.isAccountLoading) {
      append(profileInfo, $("div.mobile-account-sheet-name")).textContent = localize("mobileAccount.loading", "Loading...");
    } else if (this.accountName) {
      append(profileInfo, $("div.mobile-account-sheet-name")).textContent = this.accountName;
      if (this.accountProviderLabel) {
        append(profileInfo, $("div.mobile-account-sheet-provider")).textContent = this.accountProviderLabel;
      }
    } else {
      append(profileInfo, $("div.mobile-account-sheet-name")).textContent = localize("mobileAccount.signedOut", "Not signed in");
    }
    const entitlement = this.chatEntitlementService.entitlement;
    const showDashboard = !this.chatEntitlementService.sentiment.hidden && !!this.accountName && entitlement !== ChatEntitlement.Unknown && entitlement !== ChatEntitlement.Available;
    if (showDashboard) {
      const dashboardSection = append(content, $("div.mobile-account-sheet-section"));
      const store = new DisposableStore();
      this.copilotDashboardStore.value = store;
      const dashboardElement = this.chatDashboardService.createDashboardElement(store);
      if (dashboardElement) {
        append(dashboardSection, dashboardElement);
      }
    }
    const actionsSection = append(content, $("div.mobile-account-sheet-actions"));
    const allActions = this.getSheetActions();
    for (const action of allActions) {
      if (action instanceof Separator) {
        append(actionsSection, $("div.mobile-account-sheet-separator"));
        continue;
      }
      const row = append(actionsSection, $("button.mobile-account-sheet-action", { type: "button" }));
      row.disabled = !action.enabled;
      row.setAttribute("aria-label", action.tooltip || action.label);
      const icon = this.getActionIcon(action);
      if (icon) {
        append(row, $("span.mobile-account-sheet-action-icon")).classList.add(...ThemeIcon.asClassNameArray(icon));
      }
      append(row, $("span.mobile-account-sheet-action-label")).textContent = action.label;
      panelStore.add(addDisposableListener(row, EventType.CLICK, async (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSheet();
        await Promise.resolve(action.run());
      }));
    }
  }
  getSheetActions() {
    const menu = this.menuService.createMenu(Menus.AccountMenu, this.contextKeyService);
    const rawActions = [];
    fillInActionBarActions(menu.getActions(), rawActions);
    menu.dispose();
    return rawActions.filter((action) => {
      if (action instanceof Separator) {
        return true;
      }
      if (this.isAccountLoading && action.id === "workbench.action.agenticSignIn") {
        return false;
      }
      return !action.id.startsWith("update.");
    });
  }
  getActionIcon(action) {
    switch (action.id) {
      case "workbench.action.openSettings":
        return Codicon.settingsGear;
      case "workbench.action.agenticSignOut":
        return Codicon.signOut;
      case "workbench.action.agenticSignIn":
        return Codicon.signIn;
      default:
        return void 0;
    }
  }
};
MobileTitlebarPart = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ISessionsService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IDefaultAccountService),
  __decorateParam(5, IAuthenticationService),
  __decorateParam(6, IChatEntitlementService),
  __decorateParam(7, IMenuService),
  __decorateParam(8, IChatDashboardService),
  __decorateParam(9, ICommandService)
], MobileTitlebarPart);
export {
  MobileTitlebarPart
};
