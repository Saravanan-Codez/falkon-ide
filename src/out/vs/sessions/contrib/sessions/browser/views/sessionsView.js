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
import "../media/sessionsViewPane.css";
import * as DOM from "../../../../../base/browser/dom.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { isWeb } from "../../../../../base/common/platform.js";
import { Orientation } from "../../../../../base/browser/ui/sash/sash.js";
import { Sizing, SplitView } from "../../../../../base/browser/ui/splitview/splitview.js";
import { Color } from "../../../../../base/common/color.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IsAuxiliaryWindowContext, IsSessionsWindowContext } from "../../../../../workbench/common/contextkeys.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { ViewPane } from "../../../../../workbench/browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../../../workbench/common/views.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ChatSessionArchiveActionWordingSettingId, getChatSessionArchivedSectionLabel, getChatSessionArchiveActionWording } from "../../../../../platform/chat/common/sessionArchiveActions.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { localize } from "../../../../../nls.js";
import { SessionsList, SessionsGrouping, SessionsSorting } from "./sessionsList.js";
import { SessionStatus } from "../../../../services/sessions/common/session.js";
import { AICustomizationShortcutsWidget } from "../aiCustomizationShortcutsWidget.js";
import { AgentHostShortcutsWidget } from "../agentHostShortcutsWidget.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { agentsBackground } from "../../../../common/theme.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IHostService } from "../../../../../workbench/services/host/browser/host.js";
import { IWorkbenchLayoutService, Parts } from "../../../../../workbench/services/layout/browser/layoutService.js";
import { PANEL_SECTION_BORDER } from "../../../../../workbench/common/theme.js";
import { ISessionsManagementService } from "../../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { Menus } from "../../../../browser/menus.js";
import { MobileSessionFilterChips } from "../../../../browser/parts/mobile/mobileSessionFilterChips.js";
import { showMobileSortGroupSheet } from "../../../../browser/parts/mobile/mobileSortGroupSheet.js";
import { isPhoneLayout } from "../../../../browser/parts/mobile/mobileLayout.js";
import { IsPhoneLayoutContext } from "../../../../common/contextkeys.js";
const $ = DOM.$;
const SessionsViewId = "sessions.workbench.view.sessionsView";
const GROUPING_STORAGE_KEY = "sessionsViewPane.grouping";
const SORTING_STORAGE_KEY = "sessionsViewPane.sorting";
const CUSTOMIZATIONS_MIN_HEIGHT = 129;
const SESSIONS_SECTION_MIN_HEIGHT = 120;
async function openSessionToTheSide(sessionsService, session, options) {
  const visible = sessionsService.visibleSessions.get();
  const lastVisible = visible[visible.length - 1];
  if (lastVisible && lastVisible.sessionId !== session.sessionId) {
    sessionsService.insertAt(session, lastVisible.sessionId, "right");
  }
  await sessionsService.openSession(session.resource, options);
}
const SessionsViewFilterSubMenu = new MenuId("SessionsViewPaneFilterSubMenu");
const SessionsViewFilterOptionsSubMenu = new MenuId("SessionsViewPaneFilterOptionsSubMenu");
const SessionsViewGroupingContext = new RawContextKey("sessionsViewPane.grouping", SessionsGrouping.Workspace);
const SessionsViewSortingContext = new RawContextKey("sessionsViewPane.sorting", SessionsSorting.Created);
const IsWorkspaceGroupCappedContext = new RawContextKey("sessionsViewPane.workspaceGroupCapped", true);
let SessionsView = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, sessionsManagementService, sessionsService, hostService, layoutService, storageService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.sessionsManagementService = sessionsManagementService;
    this.sessionsService = sessionsService;
    this.hostService = hostService;
    this.layoutService = layoutService;
    this.storageService = storageService;
    this.isFindWidgetOpen = false;
    this.currentGrouping = SessionsGrouping.Workspace;
    this.currentSorting = SessionsSorting.Created;
    this.filterContextKeys = /* @__PURE__ */ new Map();
    this.currentBodyHeight = 0;
    this.currentBodyWidth = 0;
    this.didInitializePaneSizes = false;
    this.registeredFilterTypeIds = /* @__PURE__ */ new Set();
    this.archivedFilterRegistration = this._register(new DisposableStore());
    const storedGrouping = this.storageService.get(GROUPING_STORAGE_KEY, StorageScope.PROFILE);
    if (storedGrouping && Object.values(SessionsGrouping).includes(storedGrouping)) {
      this.currentGrouping = storedGrouping;
    }
    const storedSorting = this.storageService.get(SORTING_STORAGE_KEY, StorageScope.PROFILE);
    if (storedSorting && Object.values(SessionsSorting).includes(storedSorting)) {
      this.currentSorting = storedSorting;
    }
    this.groupingContextKey = SessionsViewGroupingContext.bindTo(contextKeyService);
    this.groupingContextKey.set(this.currentGrouping);
    this.sortingContextKey = SessionsViewSortingContext.bindTo(contextKeyService);
    this.sortingContextKey.set(this.currentSorting);
    this.workspaceGroupCappedContextKey = IsWorkspaceGroupCappedContext.bindTo(contextKeyService);
  }
  renderBody(parent) {
    super.renderBody(parent);
    this.viewPaneContainer = parent;
    this.viewPaneContainer.classList.add("agent-sessions-viewpane");
    this.createControls(parent);
  }
  getLocationBasedColors() {
    const colors = super.getLocationBasedColors();
    return {
      ...colors,
      background: void 0,
      listOverrideStyles: {
        ...colors.listOverrideStyles,
        listBackground: void 0,
        treeStickyScrollBackground: agentsBackground
      }
    };
  }
  createControls(parent) {
    const sessionsContainer = DOM.append(parent, $(".agent-sessions-container"));
    this.sidebarSplitViewContainer = DOM.append(sessionsContainer, $(".agent-sessions-sidebar-splitview-container"));
    const sessionsSection = DOM.append(this.sidebarSplitViewContainer, $(".agent-sessions-section"));
    const sessionsContent = DOM.append(sessionsSection, $(".agent-sessions-content"));
    const headerRow = this.headerRow = DOM.append(sessionsContent, $(".agent-sessions-header-row"));
    const headerLabel = this.headerLabel = DOM.append(headerRow, $(".agent-sessions-header-label"));
    const headerActions = this.headerActions = DOM.append(headerRow, $(".agent-sessions-header-actions"));
    const phoneLayout = isPhoneLayout(this.layoutService);
    if (!phoneLayout) {
      headerLabel.textContent = localize("sessionsHeader", "Sessions");
      const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
      this._register(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, headerActions, Menus.SidebarSessionsHeader, {
        hiddenItemStrategy: HiddenItemStrategy.NoHide,
        telemetrySource: "sessionsView.header",
        toolbarOptions: { primaryGroup: () => true }
      }));
    } else {
      headerRow.classList.add("phone-layout-empty");
    }
    const findWidgetContainer = this.findWidgetContainer = DOM.append(headerRow, $(".agent-sessions-find-widget-container"));
    findWidgetContainer.style.display = "none";
    const filterChipsContainer = isPhoneLayout(this.layoutService) ? DOM.append(sessionsContent, $(".mobile-session-filter-chips-slot")) : void 0;
    this.sessionsControlContainer = DOM.append(sessionsContent, $(".agent-sessions-control-container"));
    const sessionsControl = this.sessionsControl = this._register(this.instantiationService.createInstance(SessionsList, this.sessionsControlContainer, {
      overrideStyles: this.getLocationBasedColors().listOverrideStyles,
      grouping: () => this.currentGrouping,
      sorting: () => this.currentSorting,
      findWidgetContainer,
      onSessionOpen: (resource, preserveFocus, sideBySide) => {
        const onOpened = () => {
          if (isWeb && isPhoneLayout(this.layoutService)) {
            this.layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
          }
        };
        if (sideBySide) {
          const session = this.sessionsManagementService.getSession(resource);
          if (session) {
            openSessionToTheSide(this.sessionsService, session, { preserveFocus }).then(onOpened).catch(onUnexpectedError);
            return;
          }
        }
        this.sessionsService.openSession(resource, { preserveFocus }).then(onOpened).catch(onUnexpectedError);
      }
    }));
    this._register(this.onDidChangeBodyVisibility((visible) => sessionsControl.setVisible(visible)));
    this._register(sessionsControl.onDidChangeFindOpenState((open) => {
      this.isFindWidgetOpen = open;
      findWidgetContainer.style.display = open ? "" : "none";
      this.updateHeaderLayout();
    }));
    this._register(DOM.addDisposableListener(findWidgetContainer, "keydown", (e) => {
      if (e.key === "Escape") {
        sessionsControl.closeFind();
        e.stopPropagation();
      }
    }));
    this.workspaceGroupCappedContextKey?.set(sessionsControl.isWorkspaceGroupCapped());
    this.registerSessionTypeFilters(sessionsControl);
    this._register(this.sessionsManagementService.onDidChangeSessionTypes(() => {
      this.registerSessionTypeFilters(sessionsControl);
    }));
    this.registerStatusFilters(sessionsControl);
    this._register(this.hostService.onDidChangeFocus((hasFocus) => {
      if (hasFocus) {
        sessionsControl.refresh();
      }
    }));
    this._register(sessionsControl.onDidUpdate(() => {
      if (!sessionsControl.hasFocusOrSelection()) {
        this.restoreLastSelectedSession();
      }
    }));
    if (filterChipsContainer) {
      const chips = this._register(new MobileSessionFilterChips(filterChipsContainer, sessionsControl));
      this._register(chips.onDidRequestSortGroup(() => {
        this.openSortGroupSheet();
      }));
      this._register(chips.onDidRequestFind(() => {
        this.openFind();
      }));
    }
    this._register(autorun((reader) => {
      const activeSession = this.sessionsService.activeSession.read(reader);
      if (activeSession) {
        if (!sessionsControl.reveal(activeSession.resource)) {
          sessionsControl.clearFocus();
        }
      } else {
        sessionsControl.clearFocus();
      }
    }));
    const customizationsSection = DOM.append(this.sidebarSplitViewContainer, $(".agent-sessions-customizations-section"));
    const customizationsSizeChange = this._register(new Emitter());
    const customizationsWidget = this._customizationsWidget = this._register(this.instantiationService.createInstance(AICustomizationShortcutsWidget, customizationsSection, {
      onDidChangeLayout: () => {
        customizationsSizeChange.fire();
        this.layoutSidebarSplitView();
      }
    }));
    this.sidebarSplitView = this._register(new SplitView(this.sidebarSplitViewContainer, {
      orientation: Orientation.VERTICAL,
      proportionalLayout: false
    }));
    const sessionsPane = {
      element: sessionsSection,
      minimumSize: SESSIONS_SECTION_MIN_HEIGHT,
      maximumSize: Number.POSITIVE_INFINITY,
      onDidChange: Event.None,
      layout: (height) => {
        sessionsSection.style.height = `${height}px`;
        this.sessionsControl?.layout(this.sessionsControlContainer?.offsetHeight ?? 0, this.currentBodyWidth);
      }
    };
    const customizationsPane = {
      element: customizationsSection,
      get minimumSize() {
        return customizationsWidget.collapsed ? customizationsWidget.collapsedHeight : CUSTOMIZATIONS_MIN_HEIGHT;
      },
      get maximumSize() {
        return customizationsWidget.collapsed ? customizationsWidget.collapsedHeight : Math.max(CUSTOMIZATIONS_MIN_HEIGHT, customizationsWidget.desiredHeight);
      },
      onDidChange: Event.map(Event.any(customizationsWidget.onDidChangeHeight, customizationsSizeChange.event), () => this.getCustomizationsPaneHeight()),
      layout: (height) => {
        customizationsSection.style.height = `${height}px`;
        this._customizationsWidget?.layout(height, this.currentBodyWidth);
      }
    };
    this.sidebarSplitView.addView(sessionsPane, Sizing.Distribute, 0, true);
    this.sidebarSplitView.addView(customizationsPane, this.getCustomizationsPaneHeight(), 1, true);
    let savedCustomizationsPaneHeight = this.getCustomizationsPaneHeight();
    this._register(customizationsWidget.onDidToggleCollapsed((collapsed) => {
      if (!this.sidebarSplitView) {
        return;
      }
      if (collapsed) {
        const currentSize = this.sidebarSplitView.getViewSize(1);
        if (currentSize > customizationsWidget.collapsedHeight) {
          savedCustomizationsPaneHeight = currentSize;
        }
        this.sidebarSplitView.resizeView(1, customizationsWidget.collapsedHeight);
      } else {
        this.sidebarSplitView.resizeView(1, savedCustomizationsPaneHeight);
      }
      this.layoutSidebarSplitView();
    }));
    const updateSplitViewStyles = () => {
      const borderColor = this.themeService.getColorTheme().getColor(PANEL_SECTION_BORDER);
      this.sidebarSplitView?.style({ separatorBorder: borderColor ?? Color.transparent });
    };
    updateSplitViewStyles();
    this._register(this.themeService.onDidColorThemeChange(updateSplitViewStyles));
    if (isWeb && this.scopedContextKeyService.contextMatchesRules(ContextKeyExpr.and(
      IsSessionsWindowContext,
      IsAuxiliaryWindowContext.toNegated(),
      IsPhoneLayoutContext.negate()
    ))) {
      this._register(this.instantiationService.createInstance(AgentHostShortcutsWidget, sessionsContainer, {
        onDidChangeLayout: () => {
          this.layoutSidebarSplitView();
        }
      }));
    }
    this._register(DOM.scheduleAtNextAnimationFrame(DOM.getWindow(parent), () => this.layoutSidebarSplitView()));
  }
  focusCustomizations() {
    this._customizationsWidget?.focus();
  }
  restoreLastSelectedSession() {
    const activeSession = this.sessionsService.activeSession.get();
    if (activeSession && this.sessionsControl) {
      this.sessionsControl.reveal(activeSession.resource);
    }
  }
  registerSessionTypeFilters(sessionsControl) {
    const sessionTypes = this.sessionsManagementService.getAllSessionTypes();
    for (let i = 0; i < sessionTypes.length; i++) {
      const type = sessionTypes[i];
      if (this.registeredFilterTypeIds.has(type.id)) {
        continue;
      }
      this.registeredFilterTypeIds.add(type.id);
      const contextKey = new RawContextKey(`sessionsViewPane.filterType.${type.id}`, !sessionsControl.isSessionTypeExcluded(type.id));
      const contextKeyInstance = contextKey.bindTo(this.scopedContextKeyService);
      this.filterContextKeys.set(contextKey.key, { key: contextKeyInstance, getDefault: () => true });
      this._register(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: `sessionsViewPane.filterType.${type.id}`,
            title: type.label,
            toggled: ContextKeyExpr.equals(contextKey.key, true),
            menu: [{
              id: SessionsViewFilterOptionsSubMenu,
              group: "1_types",
              order: i
            }]
          });
        }
        run() {
          const isExcluded = sessionsControl.isSessionTypeExcluded(type.id);
          sessionsControl.setSessionTypeExcluded(type.id, !isExcluded);
          contextKeyInstance.set(isExcluded);
        }
      }));
    }
  }
  registerStatusFilters(sessionsControl) {
    const statusFilters = [
      { status: SessionStatus.Completed, label: localize("statusCompleted", "Completed") },
      { status: SessionStatus.InProgress, label: localize("statusInProgress", "In Progress") },
      { status: SessionStatus.NeedsInput, label: localize("statusNeedsInput", "Input Needed") },
      { status: SessionStatus.Error, label: localize("statusFailed", "Failed") }
    ];
    for (let i = 0; i < statusFilters.length; i++) {
      const { status, label } = statusFilters[i];
      const contextKey = new RawContextKey(`sessionsViewPane.filterStatus.${status}`, !sessionsControl.isStatusExcluded(status));
      const contextKeyInstance = contextKey.bindTo(this.scopedContextKeyService);
      this.filterContextKeys.set(contextKey.key, { key: contextKeyInstance, getDefault: () => true });
      this._register(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: `sessionsViewPane.filterStatus.${status}`,
            title: label,
            toggled: ContextKeyExpr.equals(contextKey.key, true),
            menu: [{
              id: SessionsViewFilterOptionsSubMenu,
              group: "2_status",
              order: i
            }]
          });
        }
        run() {
          const isExcluded = sessionsControl.isStatusExcluded(status);
          sessionsControl.setStatusExcluded(status, !isExcluded);
          contextKeyInstance.set(isExcluded);
        }
      }));
    }
    const archivedContextKey = new RawContextKey("sessionsViewPane.filter.showArchived", !sessionsControl.isExcludeArchived());
    const archivedContextKeyInstance = archivedContextKey.bindTo(this.scopedContextKeyService);
    this.filterContextKeys.set(archivedContextKey.key, { key: archivedContextKeyInstance, getDefault: () => false });
    const registerArchivedFilter = () => {
      this.archivedFilterRegistration.clear();
      const title = getChatSessionArchivedSectionLabel(getChatSessionArchiveActionWording(this.configurationService));
      this.archivedFilterRegistration.add(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: "sessionsViewPane.filterArchived",
            title,
            toggled: ContextKeyExpr.equals(archivedContextKey.key, true),
            menu: [{
              id: SessionsViewFilterOptionsSubMenu,
              group: "3_props",
              order: 0
            }]
          });
        }
        run() {
          const excluding = sessionsControl.isExcludeArchived();
          sessionsControl.setExcludeArchived(!excluding);
          archivedContextKeyInstance.set(excluding);
        }
      }));
    };
    registerArchivedFilter();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatSessionArchiveActionWordingSettingId)) {
        registerArchivedFilter();
      }
    }));
    const readContextKey = new RawContextKey("sessionsViewPane.filter.showRead", !sessionsControl.isExcludeRead());
    const readContextKeyInstance = readContextKey.bindTo(this.scopedContextKeyService);
    this.filterContextKeys.set(readContextKey.key, { key: readContextKeyInstance, getDefault: () => true });
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "sessionsViewPane.filterRead",
          title: localize("filterRead", "Read"),
          toggled: ContextKeyExpr.equals(readContextKey.key, true),
          menu: [{
            id: SessionsViewFilterOptionsSubMenu,
            group: "3_props",
            order: 1
          }]
        });
      }
      run() {
        const excluding = sessionsControl.isExcludeRead();
        sessionsControl.setExcludeRead(!excluding);
        readContextKeyInstance.set(excluding);
      }
    }));
    const filterContextKeys = this.filterContextKeys;
    const workspaceGroupCappedContextKey = this.workspaceGroupCappedContextKey;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "sessionsViewPane.resetFilters",
          title: localize("resetFilters", "Reset"),
          menu: [{
            id: SessionsViewFilterOptionsSubMenu,
            group: "4_reset",
            order: 0
          }]
        });
      }
      run() {
        sessionsControl.resetFilters();
        for (const { key, getDefault } of filterContextKeys.values()) {
          key.set(getDefault());
        }
        workspaceGroupCappedContextKey?.set(sessionsControl.isWorkspaceGroupCapped());
      }
    }));
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.currentBodyHeight = height;
    this.currentBodyWidth = width;
    this.updateHeaderLayout();
    this.layoutSidebarSplitView();
    if (this.sidebarSplitView || !this.sessionsControl || !this.sessionsControlContainer) {
      return;
    }
    this.sessionsControl.layout(this.sessionsControlContainer.offsetHeight, width);
  }
  layoutSidebarSplitView() {
    if (!this.sidebarSplitView || !this.sidebarSplitViewContainer) {
      return;
    }
    const height = this.sidebarSplitViewContainer.offsetHeight || this.currentBodyHeight || this.viewPaneContainer?.offsetHeight || 0;
    if (height <= 0) {
      return;
    }
    if (this.sidebarSplitViewContainer.offsetHeight === 0) {
      this.sidebarSplitViewContainer.style.height = `${height}px`;
    }
    this.sidebarSplitView.layout(height);
    if (!this.didInitializePaneSizes) {
      this.didInitializePaneSizes = true;
      this.sidebarSplitView.resizeView(1, this.getCustomizationsPaneHeight());
    }
  }
  getCustomizationsPaneHeight() {
    if (this._customizationsWidget?.collapsed) {
      return this._customizationsWidget.collapsedHeight;
    }
    const desiredHeight = this._customizationsWidget?.desiredHeight ?? 0;
    return Math.max(CUSTOMIZATIONS_MIN_HEIGHT, Number.isFinite(desiredHeight) ? desiredHeight : 0);
  }
  focus() {
    super.focus();
    this.sessionsControl?.focus();
  }
  refresh() {
    this.sessionsControl?.refresh();
  }
  openFind() {
    this.isFindWidgetOpen = true;
    if (this.findWidgetContainer) {
      this.findWidgetContainer.style.display = "";
    }
    this.updateHeaderLayout();
    this.sessionsControl?.openFind();
  }
  updateHeaderLayout() {
    if (!this.headerRow || !this.headerLabel || !this.headerActions) {
      return;
    }
    if (isPhoneLayout(this.layoutService)) {
      this.headerRow.classList.toggle("phone-layout-empty", !this.isFindWidgetOpen);
      return;
    }
    if (this.isFindWidgetOpen) {
      this.headerLabel.style.display = "none";
      this.headerActions.style.display = "none";
      return;
    }
    this.headerLabel.style.display = "";
    this.headerActions.style.display = "";
  }
  /**
   * Phone-only: present a bottom sheet with the four sort/group toggles.
   * Filtering on phone is performed via the status filter chips, so the
   * sheet intentionally omits "Filter", "Show Recent/All Sessions", and
   * "Collapse All Groups" actions found in the desktop submenu.
   */
  openSortGroupSheet() {
    const sortTitle = localize("sortGroupSheet.sort", "Sort");
    const groupTitle = localize("sortGroupSheet.group", "Group");
    const items = [
      {
        id: SessionsSorting.Created,
        label: localize("sortByCreated", "Sort by Created"),
        checked: this.currentSorting === SessionsSorting.Created,
        group: "sort",
        groupTitle: sortTitle
      },
      {
        id: SessionsSorting.Updated,
        label: localize("sortByUpdated", "Sort by Updated"),
        checked: this.currentSorting === SessionsSorting.Updated,
        group: "sort"
      },
      {
        id: SessionsGrouping.Workspace,
        label: localize("groupByWorkspace", "Group by Workspace"),
        checked: this.currentGrouping === SessionsGrouping.Workspace,
        group: "group",
        groupTitle
      },
      {
        id: SessionsGrouping.Date,
        label: localize("groupByTime", "Group by Time"),
        checked: this.currentGrouping === SessionsGrouping.Date,
        group: "group"
      }
    ];
    showMobileSortGroupSheet(this.layoutService.mainContainer, localize("sortGroupSheet.title", "Sort"), items).then((selectedId) => {
      if (!selectedId) {
        return;
      }
      if (selectedId === SessionsSorting.Created || selectedId === SessionsSorting.Updated) {
        this.setSorting(selectedId);
      } else if (selectedId === SessionsGrouping.Workspace || selectedId === SessionsGrouping.Date) {
        this.setGrouping(selectedId);
      }
    });
  }
  setGrouping(grouping) {
    if (this.currentGrouping === grouping) {
      return;
    }
    this.currentGrouping = grouping;
    this.storageService.store(GROUPING_STORAGE_KEY, this.currentGrouping, StorageScope.PROFILE, StorageTarget.USER);
    this.groupingContextKey?.set(this.currentGrouping);
    this.sessionsControl?.resetSectionCollapseState();
    this.sessionsControl?.update(true);
  }
  setSorting(sorting) {
    if (this.currentSorting === sorting) {
      return;
    }
    this.currentSorting = sorting;
    this.storageService.store(SORTING_STORAGE_KEY, this.currentSorting, StorageScope.PROFILE, StorageTarget.USER);
    this.sortingContextKey?.set(this.currentSorting);
    this.sessionsControl?.update();
  }
};
SessionsView = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, ISessionsManagementService),
  __decorateParam(11, ISessionsService),
  __decorateParam(12, IHostService),
  __decorateParam(13, IWorkbenchLayoutService),
  __decorateParam(14, IStorageService)
], SessionsView);
export {
  IsWorkspaceGroupCappedContext,
  SessionsView,
  SessionsViewFilterOptionsSubMenu,
  SessionsViewFilterSubMenu,
  SessionsViewGroupingContext,
  SessionsViewId,
  SessionsViewSortingContext,
  openSessionToTheSide
};
