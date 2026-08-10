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
import * as DOM from "../../../../../base/browser/dom.js";
import { BreadcrumbsWidget } from "../../../../../base/browser/ui/breadcrumbs/breadcrumbsWidget.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { ProgressBar } from "../../../../../base/browser/ui/progressbar/progressbar.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { combinedDisposable, Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { WorkbenchList, WorkbenchObjectTree } from "../../../../../platform/list/browser/listService.js";
import { defaultBreadcrumbsWidgetStyles, defaultButtonStyles, defaultProgressBarStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { FilterWidget } from "../../../../browser/parts/views/viewFilter.js";
import { IChatDebugService } from "../../common/chatDebugService.js";
import { debugEventMatchesText } from "../../common/chatDebugEvents.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { LocalChatSessionUri } from "../../common/model/chatUri.js";
import { ChatDebugEventRenderer, ChatDebugEventDelegate, ChatDebugEventTreeRenderer, getEventCreatedText, getEventNameText, getEventDetailsText } from "./chatDebugEventList.js";
import { setupBreadcrumbKeyboardNavigation, TextBreadcrumbItem, LogsViewMode } from "./chatDebugTypes.js";
import { bindFilterContextKeys } from "./chatDebugFilters.js";
import { ChatDebugDetailPanel } from "./chatDebugDetailPanel.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { Action, Separator } from "../../../../../base/common/actions.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
const $ = DOM.$;
const PAGE_SIZE = 1e3;
var LogsNavigation = /* @__PURE__ */ ((LogsNavigation2) => {
  LogsNavigation2["Home"] = "home";
  LogsNavigation2["Overview"] = "overview";
  return LogsNavigation2;
})(LogsNavigation || {});
let ChatDebugLogsView = class extends Disposable {
  constructor(parent, filterState, chatService, chatDebugService, instantiationService, contextKeyService, clipboardService, contextMenuService) {
    super();
    this.filterState = filterState;
    this.chatService = chatService;
    this.chatDebugService = chatDebugService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.clipboardService = clipboardService;
    this.contextMenuService = contextMenuService;
    this._onNavigate = this._register(new Emitter());
    this.onNavigate = this._onNavigate.event;
    this.logsViewMode = LogsViewMode.Tree;
    this.events = [];
    this.filteredEvents = [];
    this.filterDirty = true;
    this.cachedIncludeTerms = [];
    this.cachedExcludeTerms = [];
    this.eventListener = this._register(new MutableDisposable());
    this.sessionStateDisposable = this._register(new MutableDisposable());
    this.showMoreDisposables = this._register(new DisposableStore());
    this.showMoreVisible = false;
    this.visibleLimit = PAGE_SIZE;
    this.refreshScheduler = this._register(new RunOnceScheduler(() => this.refreshList(), 50));
    this.container = DOM.append(parent, $(".chat-debug-logs"));
    DOM.hide(this.container);
    const breadcrumbContainer = DOM.append(this.container, $(".chat-debug-breadcrumb"));
    this.breadcrumbWidget = this._register(new BreadcrumbsWidget(breadcrumbContainer, 3, void 0, Codicon.chevronRight, defaultBreadcrumbsWidgetStyles));
    this._register(setupBreadcrumbKeyboardNavigation(breadcrumbContainer, this.breadcrumbWidget));
    this._register(this.breadcrumbWidget.onDidSelectItem((e) => {
      if (e.type === "select" && e.item instanceof TextBreadcrumbItem) {
        this.breadcrumbWidget.setSelection(void 0);
        const items = this.breadcrumbWidget.getItems();
        const idx = items.indexOf(e.item);
        if (idx === 0) {
          this._onNavigate.fire("home" /* Home */);
        } else if (idx === 1) {
          this._onNavigate.fire("overview" /* Overview */);
        }
      }
    }));
    this.headerContainer = DOM.append(this.container, $(".chat-debug-editor-header"));
    const scopedContextKeyService = this._register(this.contextKeyService.createScoped(this.headerContainer));
    const syncContextKeys = bindFilterContextKeys(this.filterState, scopedContextKeyService);
    syncContextKeys();
    const childInstantiationService = this._register(this.instantiationService.createChild(
      new ServiceCollection([IContextKeyService, scopedContextKeyService])
    ));
    this.filterWidget = this._register(childInstantiationService.createInstance(FilterWidget, {
      placeholder: localize("chatDebug.search", "Filter (e.g. text, !exclude, before:YYYY-MM-DDTHH:MM:SS)"),
      ariaLabel: localize("chatDebug.filterAriaLabel", "Filter debug events")
    }));
    this.viewModeToggle = this._register(new Button(this.headerContainer, { ...defaultButtonStyles, secondary: true, title: localize("chatDebug.toggleViewMode", "Toggle between list and tree view") }));
    this.viewModeToggle.element.classList.add("chat-debug-view-mode-toggle", "monaco-text-button");
    this.updateViewModeToggle();
    this._register(this.viewModeToggle.onDidClick(() => {
      this.toggleViewMode();
    }));
    const filterContainer = DOM.append(this.headerContainer, $(".viewpane-filter-container"));
    filterContainer.appendChild(this.filterWidget.element);
    this._register(this.filterWidget.onDidChangeFilterText((text) => {
      this.filterState.setTextFilter(text);
    }));
    this._register(this.filterState.onDidChange(() => {
      syncContextKeys();
      this.updateMoreFiltersChecked();
      this.visibleLimit = PAGE_SIZE;
      this.filterDirty = true;
      this.refreshList();
    }));
    const contentContainer = DOM.append(this.container, $(".chat-debug-logs-content"));
    const mainColumn = DOM.append(contentContainer, $(".chat-debug-logs-main"));
    this.tableHeader = DOM.append(mainColumn, $(".chat-debug-table-header"));
    DOM.append(this.tableHeader, $("span.chat-debug-col-created", void 0, localize("chatDebug.col.created", "Created")));
    DOM.append(this.tableHeader, $("span.chat-debug-col-name", void 0, localize("chatDebug.col.name", "Name")));
    DOM.append(this.tableHeader, $("span.chat-debug-col-details", void 0, localize("chatDebug.col.details", "Details")));
    this.progressBar = this._register(new ProgressBar(mainColumn, {
      ...defaultProgressBarStyles,
      ariaLabel: localize("chatDebug.progressAriaLabel", "Chat debug logs loading progress")
    }));
    this.bodyContainer = DOM.append(mainColumn, $(".chat-debug-logs-body"));
    this.showMoreContainer = DOM.append(mainColumn, $(".chat-debug-logs-show-more"));
    DOM.hide(this.showMoreContainer);
    this.listContainer = DOM.append(this.bodyContainer, $(".chat-debug-list-container"));
    DOM.hide(this.listContainer);
    const accessibilityProvider = {
      getAriaLabel: (e) => {
        switch (e.kind) {
          case "toolCall":
            return localize("chatDebug.aria.toolCall", "Tool call: {0}{1}", e.toolName, e.result ? ` (${e.result})` : "");
          case "modelTurn":
            return localize(
              "chatDebug.aria.modelTurn",
              "Model turn: {0}{1}{2}",
              e.model ?? localize("chatDebug.aria.model", "model"),
              e.totalTokens !== void 0 ? localize("chatDebug.aria.tokenCount", " {0} tokens", e.totalTokens) : "",
              e.cachedTokens !== void 0 ? localize("chatDebug.aria.cachedTokens", " {0} cached", e.cachedTokens) : ""
            );
          case "generic":
            return `${e.category ? e.category + ": " : ""}${e.name}: ${e.details ?? ""}`;
          case "subagentInvocation":
            return localize("chatDebug.aria.subagent", "Subagent: {0}{1}", e.agentName, e.description ? ` - ${e.description}` : "");
          case "userMessage":
            return localize("chatDebug.aria.userMessage", "User message: {0}", e.message);
          case "agentResponse":
            return localize("chatDebug.aria.agentResponse", "Agent response: {0}", e.message);
        }
      },
      getWidgetAriaLabel: () => localize("chatDebug.ariaLabel", "Chat Debug Events")
    };
    let nextFallbackId = 0;
    const fallbackIds = /* @__PURE__ */ new WeakMap();
    const identityProvider = {
      getId: (e) => {
        if (e.id) {
          return e.id;
        }
        let fallback = fallbackIds.get(e);
        if (!fallback) {
          fallback = `_fallback_${nextFallbackId++}`;
          fallbackIds.set(e, fallback);
        }
        return fallback;
      }
    };
    this.list = this._register(this.instantiationService.createInstance(
      WorkbenchList,
      "ChatDebugEvents",
      this.listContainer,
      new ChatDebugEventDelegate(),
      [new ChatDebugEventRenderer()],
      { identityProvider, accessibilityProvider }
    ));
    this.treeContainer = DOM.append(this.bodyContainer, $(".chat-debug-list-container"));
    this.tree = this._register(this.instantiationService.createInstance(
      WorkbenchObjectTree,
      "ChatDebugEventsTree",
      this.treeContainer,
      new ChatDebugEventDelegate(),
      [new ChatDebugEventTreeRenderer()],
      { identityProvider, accessibilityProvider }
    ));
    this.detailPanel = this._register(this.instantiationService.createInstance(ChatDebugDetailPanel, contentContainer));
    this._register(this.detailPanel.onDidChangeWidth(() => {
      if (this.currentDimension) {
        this.layout(this.currentDimension);
      }
    }));
    this._register(this.detailPanel.onDidHide(() => {
      if (this.list.getSelection().length > 0) {
        this.list.setSelection([]);
      }
      if (this.tree.getSelection().length > 0) {
        this.tree.setSelection([]);
      }
      if (this.currentDimension) {
        this.layout(this.currentDimension);
      }
    }));
    this._register(this.list.onContextMenu((e) => {
      if (e.element) {
        this.showEventContextMenu(e.element, e.browserEvent);
      }
    }));
    this._register(this.tree.onContextMenu((e) => {
      if (e.element) {
        this.showEventContextMenu(e.element, e.browserEvent);
      }
    }));
    this._register(this.list.onDidChangeSelection((e) => {
      const selected = e.elements[0];
      if (selected) {
        this.detailPanel.show(selected);
      } else {
        this.detailPanel.hide();
      }
    }));
    this._register(this.tree.onDidChangeSelection((e) => {
      const selected = e.elements[0];
      if (selected) {
        this.detailPanel.show(selected);
      } else {
        this.detailPanel.hide();
      }
    }));
  }
  setSession(sessionResource) {
    if (!this.currentSessionResource || this.currentSessionResource.toString() !== sessionResource.toString()) {
      this.visibleLimit = PAGE_SIZE;
    }
    this.currentSessionResource = sessionResource;
  }
  setFilterText(text) {
    this.filterWidget.setFilterText(text);
  }
  show() {
    DOM.show(this.container);
    this.loadEvents();
    this.refreshList();
  }
  hide() {
    DOM.hide(this.container);
  }
  focus() {
    if (this.logsViewMode === LogsViewMode.Tree) {
      this.tree.domFocus();
    } else {
      this.list.domFocus();
    }
  }
  updateBreadcrumb() {
    if (!this.currentSessionResource) {
      return;
    }
    const sessionTitle = this.chatService.getSessionTitle(this.currentSessionResource) || LocalChatSessionUri.parseLocalSessionId(this.currentSessionResource) || this.currentSessionResource.toString();
    this.breadcrumbWidget.setItems([
      new TextBreadcrumbItem(localize("chatDebug.title", "Agent Debug Logs"), true),
      new TextBreadcrumbItem(sessionTitle, true),
      new TextBreadcrumbItem(localize("chatDebug.logs", "Logs"))
    ]);
  }
  layout(dimension) {
    this.currentDimension = dimension;
    const breadcrumbHeight = 22;
    const headerHeight = this.headerContainer.offsetHeight;
    const tableHeaderHeight = this.tableHeader.offsetHeight;
    const showMoreHeight = this.showMoreContainer.offsetHeight;
    const detailVisible = this.detailPanel.isVisible;
    const detailWidth = detailVisible ? this.detailPanel.width : 0;
    const listHeight = dimension.height - breadcrumbHeight - headerHeight - tableHeaderHeight - showMoreHeight;
    const listWidth = dimension.width - detailWidth;
    if (this.logsViewMode === LogsViewMode.Tree) {
      this.tree.layout(listHeight, listWidth);
    } else {
      this.list.layout(listHeight, listWidth);
    }
    if (this.detailPanel.isVisible) {
      this.detailPanel.layout(listHeight);
    }
    this.detailPanel.layoutSash();
  }
  refreshList() {
    if (this.filterDirty) {
      this.filteredEvents = this.events.filter((e) => this.passesCurrentFilter(e));
      this.filterDirty = false;
    }
    const totalFiltered = this.filteredEvents.length;
    const display = totalFiltered > this.visibleLimit ? this.filteredEvents.slice(0, this.visibleLimit) : this.filteredEvents;
    if (this.logsViewMode === LogsViewMode.List) {
      this.list.splice(0, this.list.length, display);
    } else {
      this.refreshTree(display);
    }
    this.updateShowMore(totalFiltered);
    if (this.currentDimension) {
      this.layout(this.currentDimension);
    }
  }
  addEvent(event) {
    this.binaryInsert(this.events, event);
    if (!this.filterDirty && this.passesCurrentFilter(event)) {
      this.binaryInsert(this.filteredEvents, event);
    }
    this.scheduleRefresh();
  }
  binaryInsert(arr, event) {
    const time = event.created.getTime();
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      if (arr[mid].created.getTime() <= time) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    if (lo === arr.length) {
      arr.push(event);
    } else {
      arr.splice(lo, 0, event);
    }
  }
  /**
   * Tests whether a single event passes the current kind + text + timestamp
   * filters. Used for incremental filtering on each addEvent() call.
   */
  passesCurrentFilter(event) {
    const category = event.kind === "generic" ? event.category : void 0;
    if (!this.filterState.isKindVisible(event.kind, category)) {
      return false;
    }
    if (!this.filterState.isTimestampVisible(event.created)) {
      return false;
    }
    this.ensureCachedTerms();
    if (this.cachedExcludeTerms.length > 0 && this.cachedExcludeTerms.some((term) => debugEventMatchesText(event, term))) {
      return false;
    }
    if (this.cachedIncludeTerms.length > 0 && !this.cachedIncludeTerms.some((term) => debugEventMatchesText(event, term))) {
      return false;
    }
    return true;
  }
  ensureCachedTerms() {
    const textOnly = this.filterState.textFilterWithoutTimestamps;
    if (textOnly === this.cachedTextFilter) {
      return;
    }
    this.cachedTextFilter = textOnly;
    if (!textOnly) {
      this.cachedIncludeTerms = [];
      this.cachedExcludeTerms = [];
      return;
    }
    const terms = textOnly.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
    this.cachedIncludeTerms = terms.filter((t) => !t.startsWith("!"));
    this.cachedExcludeTerms = terms.filter((t) => t.startsWith("!")).map((t) => t.slice(1).trim()).filter((t) => t.length > 0);
  }
  scheduleRefresh() {
    if (!this.refreshScheduler.isScheduled()) {
      this.refreshScheduler.schedule();
    }
  }
  loadEvents() {
    this.events = [...this.chatDebugService.getEvents(this.currentSessionResource || void 0)];
    this.filterDirty = true;
    const addEventDisposable = this.chatDebugService.onDidAddEvent((e) => {
      if (!this.currentSessionResource || e.sessionResource.toString() === this.currentSessionResource.toString()) {
        this.addEvent(e);
      }
    });
    const clearEventsDisposable = this.chatDebugService.onDidClearProviderEvents((sessionResource) => {
      if (!this.currentSessionResource || sessionResource.toString() === this.currentSessionResource.toString()) {
        this.events = [...this.chatDebugService.getEvents(this.currentSessionResource || void 0)];
        this.filterDirty = true;
        this.scheduleRefresh();
      }
    });
    this.eventListener.value = combinedDisposable(addEventDisposable, clearEventsDisposable);
    this.updateBreadcrumb();
    this.trackSessionState();
  }
  trackSessionState() {
    if (!this.currentSessionResource) {
      this.progressBar.stop();
      this.sessionStateDisposable.clear();
      return;
    }
    const model = this.chatService.getSession(this.currentSessionResource);
    if (!model) {
      this.progressBar.stop();
      this.sessionStateDisposable.clear();
      return;
    }
    this.sessionStateDisposable.value = autorun((reader) => {
      const inProgress = model.requestInProgress.read(reader);
      if (inProgress) {
        this.progressBar.infinite();
      } else {
        this.progressBar.stop();
      }
    });
  }
  refreshTree(filtered) {
    const treeElements = this.buildTreeHierarchy(filtered);
    this.tree.setChildren(null, treeElements);
  }
  buildTreeHierarchy(events) {
    const idToEvent = /* @__PURE__ */ new Map();
    const idToChildren = /* @__PURE__ */ new Map();
    const roots = [];
    for (const event of events) {
      if (event.id) {
        idToEvent.set(event.id, event);
      }
    }
    for (const event of events) {
      if (event.parentEventId && idToEvent.has(event.parentEventId)) {
        let children = idToChildren.get(event.parentEventId);
        if (!children) {
          children = [];
          idToChildren.set(event.parentEventId, children);
        }
        children.push(event);
      } else {
        roots.push(event);
      }
    }
    const toTreeElement = (event) => {
      const children = event.id ? idToChildren.get(event.id) : void 0;
      return {
        element: event,
        children: children?.map(toTreeElement),
        collapsible: (children?.length ?? 0) > 0,
        collapsed: false
      };
    };
    return roots.map(toTreeElement);
  }
  updateShowMore(totalFiltered) {
    if (totalFiltered <= this.visibleLimit) {
      if (this.showMoreVisible) {
        DOM.hide(this.showMoreContainer);
        this.showMoreVisible = false;
      }
      return;
    }
    if (!this.showMoreStatusLabel) {
      this.showMoreStatusLabel = DOM.append(this.showMoreContainer, $("span.chat-debug-logs-show-more-status"));
    }
    if (!this.showMoreBtn) {
      this.showMoreBtn = this.showMoreDisposables.add(new Button(this.showMoreContainer, { ...defaultButtonStyles, secondary: true, title: localize("chatDebug.showMoreTitle", "Load more events") }));
      this.showMoreDisposables.add(this.showMoreBtn.onDidClick(() => {
        this.visibleLimit += PAGE_SIZE;
        this.refreshList();
      }));
    }
    const shown = Math.min(this.visibleLimit, totalFiltered);
    const remaining = totalFiltered - shown;
    this.showMoreStatusLabel.textContent = localize("chatDebug.showingCount", "Showing {0} of {1} events", shown, totalFiltered);
    this.showMoreBtn.label = localize("chatDebug.showMore", "Show More ({0})", remaining);
    if (!this.showMoreVisible) {
      DOM.show(this.showMoreContainer);
      this.showMoreVisible = true;
    }
  }
  toggleViewMode() {
    if (this.logsViewMode === LogsViewMode.List) {
      this.logsViewMode = LogsViewMode.Tree;
      DOM.hide(this.listContainer);
      DOM.show(this.treeContainer);
    } else {
      this.logsViewMode = LogsViewMode.List;
      DOM.show(this.listContainer);
      DOM.hide(this.treeContainer);
    }
    this.updateViewModeToggle();
    this.refreshList();
    if (this.currentDimension) {
      this.layout(this.currentDimension);
    }
  }
  updateViewModeToggle() {
    const el = this.viewModeToggle.element;
    DOM.clearNode(el);
    const isTree = this.logsViewMode === LogsViewMode.Tree;
    DOM.append(el, $(`span${ThemeIcon.asCSSSelector(isTree ? Codicon.listTree : Codicon.listFlat)}`));
    const labelContainer = DOM.append(el, $("span.chat-debug-view-mode-labels"));
    const treeLabel = DOM.append(labelContainer, $("span.chat-debug-view-mode-label"));
    treeLabel.textContent = localize("chatDebug.treeView", "Tree View");
    const listLabel = DOM.append(labelContainer, $("span.chat-debug-view-mode-label"));
    listLabel.textContent = localize("chatDebug.listView", "List View");
    if (isTree) {
      listLabel.classList.add("hidden");
    } else {
      treeLabel.classList.add("hidden");
    }
    const activeLabel = isTree ? localize("chatDebug.switchToListView", "Switch to List View") : localize("chatDebug.switchToTreeView", "Switch to Tree View");
    el.setAttribute("aria-label", activeLabel);
    this.viewModeToggle.setTitle(activeLabel);
  }
  updateMoreFiltersChecked() {
    this.filterWidget.checkMoreFilters(!this.filterState.isAllFiltersDefault());
  }
  showEventContextMenu(event, browserEvent) {
    const d = event.created;
    const pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const row = [getEventCreatedText(event), getEventNameText(event), getEventDetailsText(event)].filter(Boolean).join("	");
    const name = getEventNameText(event);
    this.contextMenuService.showContextMenu({
      getAnchor: () => DOM.isMouseEvent(browserEvent) ? new StandardMouseEvent(DOM.getWindow(this.container), browserEvent) : this.container,
      getActions: () => [
        new Action("chatDebug.copyTimestamp", localize("chatDebug.copyTimestamp", "Copy Timestamp"), void 0, true, () => this.clipboardService.writeText(timestamp)),
        new Action("chatDebug.copyRow", localize("chatDebug.copyRow", "Copy Row"), void 0, true, () => this.clipboardService.writeText(row)),
        new Separator(),
        new Action("chatDebug.filterBefore", localize("chatDebug.filterBefore", "Filter Before Timestamp"), void 0, true, () => this.applyFilterToken(`before:${timestamp}`)),
        new Action("chatDebug.filterAfter", localize("chatDebug.filterAfter", "Filter After Timestamp"), void 0, true, () => this.applyFilterToken(`after:${timestamp}`)),
        new Action("chatDebug.filterName", localize("chatDebug.filterName", "Filter Name"), void 0, !!name, () => this.applyFilterToken(name))
      ]
    });
  }
  applyFilterToken(token) {
    this.filterWidget.setFilterText(token);
  }
};
ChatDebugLogsView = __decorateClass([
  __decorateParam(2, IChatService),
  __decorateParam(3, IChatDebugService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IClipboardService),
  __decorateParam(7, IContextMenuService)
], ChatDebugLogsView);
export {
  ChatDebugLogsView,
  LogsNavigation
};
