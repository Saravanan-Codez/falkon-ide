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
import { DomScrollableElement } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { BreadcrumbsWidget } from "../../../../../base/browser/ui/breadcrumbs/breadcrumbsWidget.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { SelectBox } from "../../../../../base/browser/ui/selectBox/selectBox.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { ScrollbarVisibility } from "../../../../../base/common/scrollable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { IContextViewService } from "../../../../../platform/contextview/browser/contextView.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { defaultBreadcrumbsWidgetStyles, defaultButtonStyles, defaultSelectBoxStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { AgentHostAhpJsonlLoggingSettingId, IAgentHostService } from "../../../../../platform/agentHost/common/agentService.js";
import { ActionType } from "../../../../../platform/agentHost/common/state/sessionActions.js";
import { IRemoteAgentHostService } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IOutputService } from "../../../../services/output/common/output.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { LocalChatSessionUri } from "../../common/model/chatUri.js";
import { AgentHostLogSourceKind, enumerateAgentHostLogSources, isAgentHostSession, readAgentHostLogSourceContent } from "./agentHostLogSources.js";
import { setupBreadcrumbKeyboardNavigation, TextBreadcrumbItem } from "./chatDebugTypes.js";
const $ = DOM.$;
const LIVE_REFRESH_DELAY = 400;
const FILTER_DEBOUNCE_DELAY = 150;
const PAGE_SIZE = 1e3;
const MAX_DETAIL_JSON = 2e4;
var WireLogNavigation = /* @__PURE__ */ ((WireLogNavigation2) => {
  WireLogNavigation2["Home"] = "home";
  WireLogNavigation2["Overview"] = "overview";
  return WireLogNavigation2;
})(WireLogNavigation || {});
let ChatDebugWireLogView = class extends Disposable {
  constructor(parent, chatService, contextViewService, editorService, configurationService, pathService, agentHostService, remoteAgentHostService, outputService, fileService, textModelService, environmentService, productService, logService) {
    super();
    this.chatService = chatService;
    this.contextViewService = contextViewService;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.pathService = pathService;
    this.agentHostService = agentHostService;
    this.remoteAgentHostService = remoteAgentHostService;
    this.outputService = outputService;
    this.fileService = fileService;
    this.textModelService = textModelService;
    this.environmentService = environmentService;
    this.productService = productService;
    this.logService = logService;
    this._onNavigate = this._register(new Emitter());
    this.onNavigate = this._onNavigate.event;
    this.headerDisposables = this._register(new DisposableStore());
    this.contentDisposables = this._register(new DisposableStore());
    /** Watches the currently-shown wire log for live updates. */
    this.liveWatch = this._register(new MutableDisposable());
    this.sources = [];
    this.entries = [];
    /** The filtered entries currently rendered in the list, in order. */
    this.renderedVisible = [];
    /** Row DOM nodes parallel to {@link renderedVisible}. */
    this.rowElements = [];
    /** Per-row disposables parallel to {@link renderedVisible}. */
    this.rowStores = [];
    /** True while the list is showing a status message instead of rows. */
    this.listShowingMessage = false;
    this.filterText = "";
    /** Monotonic token guarding against out-of-order async loads. */
    this.loadGeneration = 0;
    /** Max number of (filtered) frames rendered at once; grows via "Load more". */
    this.visibleLimit = PAGE_SIZE;
    this.loadMoreDisposables = this._register(new DisposableStore());
    this.loadMoreVisible = false;
    this.container = DOM.append(parent, $(".chat-debug-wirelog"));
    DOM.hide(this.container);
    this.refreshScheduler = this._register(new RunOnceScheduler(() => this.liveRefresh(), LIVE_REFRESH_DELAY));
    this.filterScheduler = this._register(new RunOnceScheduler(() => this.applyFilter(), FILTER_DEBOUNCE_DELAY));
    const breadcrumbContainer = DOM.append(this.container, $(".chat-debug-breadcrumb"));
    this.breadcrumbWidget = this._register(new BreadcrumbsWidget(breadcrumbContainer, 3, void 0, Codicon.chevronRight, defaultBreadcrumbsWidgetStyles));
    this._register(setupBreadcrumbKeyboardNavigation(breadcrumbContainer, this.breadcrumbWidget));
    this._register(this.breadcrumbWidget.onDidSelectItem((e) => {
      if (e.type === "select" && e.item instanceof TextBreadcrumbItem) {
        this.breadcrumbWidget.setSelection(void 0);
        const idx = this.breadcrumbWidget.getItems().indexOf(e.item);
        if (idx === 0) {
          this._onNavigate.fire("home" /* Home */);
        } else if (idx === 1) {
          this._onNavigate.fire("overview" /* Overview */);
        }
      }
    }));
    this.hintBar = DOM.append(this.container, $(".chat-debug-wirelog-hint"));
    DOM.hide(this.hintBar);
    this.toolbar = DOM.append(this.container, $(".chat-debug-wirelog-toolbar"));
    this.selectHost = DOM.append(this.toolbar, $(".chat-debug-wirelog-select"));
    this.filterInput = DOM.append(this.toolbar, $("input.chat-debug-wirelog-filter"));
    this.filterInput.type = "text";
    this.filterInput.placeholder = localize("chatDebug.wireLog.filterPlaceholder", "Filter by method, type, or id");
    this.filterInput.setAttribute("aria-label", localize("chatDebug.wireLog.filterAria", "Filter AHP log frames"));
    this._register(DOM.addDisposableListener(this.filterInput, DOM.EventType.INPUT, () => {
      this.filterScheduler.schedule();
    }));
    this.summary = DOM.append(this.container, $(".chat-debug-wirelog-summary"));
    DOM.hide(this.summary);
    this.body = DOM.append(this.container, $(".chat-debug-wirelog-body"));
    this.list = $(".chat-debug-wirelog-list");
    this.scrollable = this._register(new DomScrollableElement(this.list, {
      horizontal: ScrollbarVisibility.Auto,
      vertical: ScrollbarVisibility.Auto
    }));
    DOM.append(this.body, this.scrollable.getDomNode());
    this.loadMoreContainer = DOM.append(this.container, $(".chat-debug-wirelog-loadmore"));
    DOM.hide(this.loadMoreContainer);
    this.footer = DOM.append(this.container, $(".chat-debug-wirelog-footer"));
  }
  setSession(sessionResource) {
    this.currentSessionResource = sessionResource;
    this.selectedSourceId = void 0;
    this.visibleLimit = PAGE_SIZE;
  }
  show() {
    DOM.show(this.container);
    this.load();
  }
  hide() {
    DOM.hide(this.container);
    this.refreshScheduler.cancel();
    this.filterScheduler.cancel();
    this.liveWatch.clear();
  }
  refresh() {
    if (this.container.style.display !== "none" && !this.refreshScheduler.isScheduled()) {
      this.refreshScheduler.schedule();
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
      new TextBreadcrumbItem(localize("chatDebug.ahpLog", "AHP Log"))
    ]);
  }
  focus() {
    this.selectBox?.focus();
  }
  layout() {
    const height = this.body.clientHeight;
    if (height > 0) {
      this.list.style.height = `${height}px`;
    }
    this.scrollable.scanDomNode();
  }
  get logSourceServices() {
    return {
      pathService: this.pathService,
      agentHostService: this.agentHostService,
      remoteAgentHostService: this.remoteAgentHostService,
      outputService: this.outputService,
      fileService: this.fileService,
      textModelService: this.textModelService,
      configurationService: this.configurationService,
      environmentService: this.environmentService,
      productService: this.productService,
      logService: this.logService
    };
  }
  async load() {
    this.updateBreadcrumb();
    this.headerDisposables.clear();
    this.liveWatch.clear();
    DOM.clearNode(this.selectHost);
    this.selectBox = void 0;
    const wireLoggingEnabled = this.configurationService.getValue(AgentHostAhpJsonlLoggingSettingId);
    DOM.clearNode(this.hintBar);
    if (!wireLoggingEnabled) {
      DOM.show(this.hintBar);
      DOM.append(this.hintBar, $(`span${ThemeIcon.asCSSSelector(Codicon.info)}`));
      DOM.append(this.hintBar, $("span", void 0, localize("chatDebug.wireLog.disabledHint", "AHP logging is disabled \u2014 enable {0} and reproduce to capture client\u2194host protocol frames.", AgentHostAhpJsonlLoggingSettingId)));
    } else {
      DOM.hide(this.hintBar);
    }
    if (!isAgentHostSession(this.currentSessionResource)) {
      this.renderMessage(localize("chatDebug.wireLog.notAgentHost", "The AHP Log is available for Agent Host sessions."));
      return;
    }
    const allSources = await enumerateAgentHostLogSources(this.logSourceServices, this.currentSessionResource);
    this.sources = allSources.filter((source) => source.kind === AgentHostLogSourceKind.WireLog);
    if (this.sources.length === 0) {
      this.renderMessage(wireLoggingEnabled ? localize("chatDebug.wireLog.noFrames", "No AHP log was found yet for this session. Interact with the agent to capture protocol frames.") : localize("chatDebug.wireLog.enableToCapture", "No AHP log is available. Enable {0} and reproduce the issue to capture protocol frames.", AgentHostAhpJsonlLoggingSettingId));
      return;
    }
    if (this.sources.length > 1) {
      DOM.show(this.selectHost);
      const options = this.sources.map((source) => ({ text: source.label }));
      let selectedIndex2 = this.sources.findIndex((source) => source.id === this.selectedSourceId);
      if (selectedIndex2 < 0) {
        selectedIndex2 = 0;
      }
      const selectBox = this.headerDisposables.add(new SelectBox(options, selectedIndex2, this.contextViewService, defaultSelectBoxStyles, {
        ariaLabel: localize("chatDebug.wireLog.sourceLabel", "AHP log file")
      }));
      selectBox.render(this.selectHost);
      this.headerDisposables.add(selectBox.onDidSelect((e) => this.loadSource(e.index)));
      this.selectBox = selectBox;
    } else {
      DOM.hide(this.selectHost);
    }
    const openBtn = this.headerDisposables.add(new Button(this.toolbar, { ...defaultButtonStyles, secondary: true, supportIcons: true, title: localize("chatDebug.wireLog.openFile", "Open Full File") }));
    openBtn.element.classList.add("chat-debug-wirelog-action");
    openBtn.label = `$(go-to-file) ${localize("chatDebug.wireLog.openFile", "Open Full File")}`;
    this.headerDisposables.add(openBtn.onDidClick(() => this.openCurrentFile()));
    const refreshBtn = this.headerDisposables.add(new Button(this.toolbar, { ...defaultButtonStyles, secondary: true, supportIcons: true, title: localize("chatDebug.wireLog.refresh", "Refresh") }));
    refreshBtn.element.classList.add("chat-debug-wirelog-action");
    refreshBtn.label = `$(refresh) ${localize("chatDebug.wireLog.refresh", "Refresh")}`;
    this.headerDisposables.add(refreshBtn.onDidClick(() => this.reloadCurrentSource()));
    let selectedIndex = this.sources.findIndex((source) => source.id === this.selectedSourceId);
    if (selectedIndex < 0) {
      selectedIndex = 0;
    }
    await this.loadSource(selectedIndex);
  }
  async loadSource(index) {
    const source = this.sources[index];
    if (!source) {
      return;
    }
    this.selectedSourceId = source.id;
    this.liveWatch.clear();
    this.currentFileResource = void 0;
    this.visibleLimit = PAGE_SIZE;
    const generation = ++this.loadGeneration;
    this.renderMessage(localize("chatDebug.wireLog.loading", "Loading\u2026"));
    let content;
    try {
      content = await readAgentHostLogSourceContent(source, this.logSourceServices);
    } catch (error) {
      if (generation !== this.loadGeneration) {
        return;
      }
      this.renderMessage(localize("chatDebug.wireLog.error", "Failed to read AHP log: {0}", error instanceof Error ? error.message : String(error)));
      return;
    }
    if (generation !== this.loadGeneration) {
      return;
    }
    if (!content) {
      this.renderMessage(localize("chatDebug.wireLog.unavailable", "This AHP log is unavailable."));
      return;
    }
    this.currentFileResource = content.fileResource;
    this.entries = buildWireEntries(parseWireFrames(content.text));
    this.renderList();
    this.renderFooter(source, content.truncated);
    this.setupLiveWatch(source);
  }
  reloadCurrentSource() {
    const index = this.sources.findIndex((source) => source.id === this.selectedSourceId);
    if (index >= 0) {
      this.loadSource(index);
    }
  }
  setupLiveWatch(source) {
    const store = new DisposableStore();
    if (source.resource?.scheme === Schemas.file) {
      const watcher = store.add(this.fileService.createWatcher(source.resource, { recursive: false, excludes: [] }));
      store.add(watcher.onDidChange(() => this.refresh()));
    }
    this.liveWatch.value = store;
  }
  openCurrentFile() {
    if (this.currentFileResource) {
      this.editorService.openEditor({ resource: this.currentFileResource, options: { pinned: true } });
    }
  }
  renderMessage(message) {
    this.contentDisposables.clear();
    this.rowElements = [];
    this.rowStores = [];
    this.renderedVisible = [];
    this.listShowingMessage = true;
    DOM.hide(this.summary);
    DOM.clearNode(this.list);
    this.list.classList.add("chat-debug-wirelog-message");
    this.list.textContent = message;
    this.scrollable.scanDomNode();
    DOM.clearNode(this.footer);
    if (this.loadMoreVisible) {
      DOM.hide(this.loadMoreContainer);
      this.loadMoreVisible = false;
    }
  }
  renderSummary() {
    DOM.clearNode(this.summary);
    let requests = 0;
    let errors = 0;
    let pending = 0;
    let longest = 0;
    for (const entry of this.entries) {
      if (entry.frame.kind === "request") {
        requests++;
        if (!entry.response) {
          pending++;
        } else {
          const duration = entry.response.ts - entry.frame.ts;
          if (duration > longest) {
            longest = duration;
          }
        }
      }
      if (isErrorEntry(entry)) {
        errors++;
      }
    }
    DOM.show(this.summary);
    this.appendChip(localize("chatDebug.wireLog.chip.frames", "{0} frames", this.entries.length));
    this.appendChip(localize("chatDebug.wireLog.chip.requests", "{0} requests", requests));
    if (errors > 0) {
      this.appendChip(localize("chatDebug.wireLog.chip.errors", "{0} errors", errors), "error");
    }
    if (pending > 0) {
      this.appendChip(localize("chatDebug.wireLog.chip.pending", "{0} pending", pending), "pending");
    }
    if (longest > 0) {
      this.appendChip(localize("chatDebug.wireLog.chip.slowest", "slowest {0}", formatDuration(longest)));
    }
  }
  appendChip(text, tone) {
    const chip = DOM.append(this.summary, $("span.chat-debug-wirelog-chip", void 0, text));
    if (tone) {
      chip.classList.add(`chat-debug-wirelog-chip-${tone}`);
    }
  }
  /**
   * Applies the current filter box value and re-renders the list. Invoked
   * (debounced) from the filter input's INPUT handler; skips work when the
   * effective filter text has not changed.
   */
  applyFilter() {
    const next = this.filterInput.value.trim().toLowerCase();
    if (next === this.filterText) {
      return;
    }
    this.filterText = next;
    this.visibleLimit = PAGE_SIZE;
    this.renderList();
  }
  renderList() {
    this.contentDisposables.clear();
    DOM.clearNode(this.list);
    this.rowElements = [];
    this.rowStores = [];
    this.renderedVisible = [];
    this.listShowingMessage = false;
    if (this.entries.length === 0) {
      this.renderMessage(localize("chatDebug.wireLog.empty", "The AHP log is empty."));
      return;
    }
    this.renderSummary();
    const { filtered, display } = this.computeVisible(this.entries);
    if (display.length === 0) {
      const empty = DOM.append(this.list, $(".chat-debug-wirelog-noresults"));
      empty.textContent = localize("chatDebug.wireLog.noMatches", "No frames match '{0}'.", this.filterText);
      this.updateLoadMore(0);
      this.scrollable.scanDomNode();
      return;
    }
    for (const entry of display) {
      this.appendRow(entry);
    }
    this.renderedVisible = display;
    this.updateLoadMore(filtered.length);
    this.scrollable.scanDomNode();
  }
  /**
   * Re-reads the current wire log and updates the list in place — appending
   * newly-captured frames and refreshing rows whose state changed (e.g. a
   * response arriving for a pending request) — instead of rebuilding the
   * whole view. Used for live refreshes so the panel does not flash back to
   * "Loading…" and lose scroll position on every turn.
   */
  async liveRefresh() {
    const index = this.sources.findIndex((source2) => source2.id === this.selectedSourceId);
    const source = this.sources[index];
    if (!source) {
      return;
    }
    const generation = ++this.loadGeneration;
    let content;
    try {
      content = await readAgentHostLogSourceContent(source, this.logSourceServices);
    } catch {
      return;
    }
    if (generation !== this.loadGeneration || !content) {
      return;
    }
    this.currentFileResource = content.fileResource;
    this.applyEntries(buildWireEntries(parseWireFrames(content.text)));
    this.renderFooter(source, content.truncated);
  }
  /**
   * Applies a freshly-parsed set of entries to the list. When the previously
   * rendered rows are still a prefix of the new (filtered) set, only the
   * changed and newly-appended rows are touched; otherwise a full render is
   * performed (e.g. after a filter change or log rotation).
   */
  applyEntries(newEntries) {
    const { filtered, display } = this.computeVisible(newEntries);
    const canReconcile = !this.listShowingMessage && this.renderedVisible.length > 0 && display.length >= this.renderedVisible.length && this.renderedVisible.every((entry, i) => baseEntryKey(entry) === baseEntryKey(display[i]));
    this.entries = newEntries;
    if (!canReconcile) {
      this.renderList();
      return;
    }
    const wasAtBottom = this.isScrolledToBottom();
    this.renderSummary();
    for (let i = 0; i < this.renderedVisible.length; i++) {
      if (entryStateKey(this.renderedVisible[i]) !== entryStateKey(display[i])) {
        this.replaceRow(i, display[i]);
      }
    }
    for (let i = this.renderedVisible.length; i < display.length; i++) {
      this.appendRow(display[i]);
    }
    this.renderedVisible = display;
    this.updateLoadMore(filtered.length);
    this.scrollable.scanDomNode();
    if (wasAtBottom) {
      this.scrollToBottom();
    }
  }
  /**
   * Computes the filtered entries and the (paginated) subset currently
   * displayed. Only the first {@link visibleLimit} matching frames are shown;
   * the rest are revealed via the "Load more" button.
   */
  computeVisible(entries) {
    const filter = this.filterText;
    const filtered = filter ? entries.filter((entry) => matchesFilter(entry, filter)) : entries;
    const display = filtered.length > this.visibleLimit ? filtered.slice(0, this.visibleLimit) : filtered;
    return { filtered, display };
  }
  /**
   * Shows or hides the "Load more" affordance and updates its status label.
   */
  updateLoadMore(totalFiltered) {
    if (totalFiltered <= this.visibleLimit) {
      if (this.loadMoreVisible) {
        DOM.hide(this.loadMoreContainer);
        this.loadMoreVisible = false;
        this.layout();
      }
      return;
    }
    if (!this.loadMoreStatus) {
      this.loadMoreStatus = DOM.append(this.loadMoreContainer, $("span.chat-debug-wirelog-loadmore-status"));
    }
    if (!this.loadMoreBtn) {
      this.loadMoreBtn = this.loadMoreDisposables.add(new Button(this.loadMoreContainer, { ...defaultButtonStyles, secondary: true, title: localize("chatDebug.wireLog.loadMoreTitle", "Load more frames") }));
      this.loadMoreDisposables.add(this.loadMoreBtn.onDidClick(() => {
        this.visibleLimit += PAGE_SIZE;
        this.renderList();
      }));
    }
    const shown = Math.min(this.visibleLimit, totalFiltered);
    const remaining = totalFiltered - shown;
    this.loadMoreStatus.textContent = localize("chatDebug.wireLog.showingCount", "Showing {0} of {1} frames", shown, totalFiltered);
    this.loadMoreBtn.label = localize("chatDebug.wireLog.loadMore", "Load More ({0})", remaining);
    if (!this.loadMoreVisible) {
      DOM.show(this.loadMoreContainer);
      this.loadMoreVisible = true;
      this.layout();
    }
  }
  appendRow(entry) {
    const { row, store } = this.buildRow(entry);
    this.contentDisposables.add(store);
    this.rowElements.push(row);
    this.rowStores.push(store);
    this.list.appendChild(row);
  }
  replaceRow(index, entry) {
    const { row, store } = this.buildRow(entry);
    this.contentDisposables.add(store);
    const oldRow = this.rowElements[index];
    this.list.replaceChild(row, oldRow);
    this.rowStores[index].dispose();
    this.rowElements[index] = row;
    this.rowStores[index] = store;
  }
  isScrolledToBottom() {
    const dimensions = this.scrollable.getScrollDimensions();
    const position = this.scrollable.getScrollPosition();
    return position.scrollTop + dimensions.height >= dimensions.scrollHeight - 4;
  }
  scrollToBottom() {
    this.scrollable.setScrollPosition({ scrollTop: this.scrollable.getScrollDimensions().scrollHeight });
  }
  buildRow(entry) {
    const store = new DisposableStore();
    const frame = entry.frame;
    const isError = isErrorEntry(entry);
    const isPending = frame.kind === "request" && !entry.response;
    const row = $(".chat-debug-wirelog-row");
    if (isError) {
      row.classList.add("chat-debug-wirelog-row-error");
    }
    const header = DOM.append(row, $(".chat-debug-wirelog-row-header"));
    header.tabIndex = 0;
    header.setAttribute("role", "button");
    const chevron = DOM.append(header, $(`span.chat-debug-wirelog-chevron${ThemeIcon.asCSSSelector(Codicon.chevronRight)}`));
    chevron.setAttribute("aria-hidden", "true");
    const outbound = frame.dir === "c2s";
    const dirIcon = outbound ? Codicon.arrowRight : Codicon.arrowLeft;
    const dirEl = DOM.append(header, $(`span.chat-debug-wirelog-dir${ThemeIcon.asCSSSelector(dirIcon)}`));
    dirEl.title = outbound ? localize("chatDebug.wireLog.outbound", "VS Code \u2192 Agent Host") : localize("chatDebug.wireLog.inbound", "Agent Host \u2192 VS Code");
    const label = frame.method ?? localize("chatDebug.wireLog.responseLabel", "(response)");
    DOM.append(header, $("span.chat-debug-wirelog-method", void 0, label));
    if (frame.actionType) {
      DOM.append(header, $("span.chat-debug-wirelog-type", void 0, frame.actionType));
    }
    const badgeText = frame.kind === "request" ? localize("chatDebug.wireLog.badge.request", "request") : frame.kind === "notification" ? localize("chatDebug.wireLog.badge.notification", "notify") : localize("chatDebug.wireLog.badge.response", "response");
    DOM.append(header, $("span.chat-debug-wirelog-badge", void 0, badgeText));
    const status = DOM.append(header, $("span.chat-debug-wirelog-status"));
    if (isError) {
      status.classList.add("chat-debug-wirelog-status-error");
      const code = entry.response?.error?.code ?? frame.error?.code;
      status.textContent = code !== void 0 ? localize("chatDebug.wireLog.statusErrorCode", "error {0}", code) : localize("chatDebug.wireLog.statusError", "error");
    } else if (isPending) {
      status.classList.add("chat-debug-wirelog-status-pending");
      status.textContent = localize("chatDebug.wireLog.statusPending", "pending");
    } else if (entry.response) {
      status.classList.add("chat-debug-wirelog-status-ok");
      status.textContent = formatDuration(entry.response.ts - frame.ts);
    }
    const time = DOM.append(header, $("span.chat-debug-wirelog-time"));
    time.textContent = formatClock(frame.ts);
    if (frame.id !== void 0) {
      time.title = localize("chatDebug.wireLog.frameId", "id: {0}", frame.id);
    }
    const details = DOM.append(row, $(".chat-debug-wirelog-row-details"));
    let detailsRendered = false;
    let expanded = false;
    const setExpanded = (value, scan) => {
      expanded = value;
      if (expanded && !detailsRendered) {
        this.renderDetails(details, entry);
        detailsRendered = true;
      }
      row.classList.toggle("chat-debug-wirelog-row-expanded", expanded);
      chevron.classList.toggle("codicon-chevron-down", expanded);
      chevron.classList.toggle("codicon-chevron-right", !expanded);
      header.setAttribute("aria-expanded", String(expanded));
      if (scan) {
        this.scrollable.scanDomNode();
      }
    };
    setExpanded(isError, false);
    store.add(DOM.addDisposableListener(header, DOM.EventType.CLICK, () => setExpanded(!expanded, true)));
    store.add(DOM.addDisposableListener(header, DOM.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setExpanded(!expanded, true);
      }
    }));
    return { row, store };
  }
  renderDetails(container, entry) {
    const frame = entry.frame;
    if (frame.payload !== void 0) {
      this.appendJsonSection(container, frame.kind === "response" ? localize("chatDebug.wireLog.section.result", "Result") : localize("chatDebug.wireLog.section.params", "Params"), frame.payload);
    }
    if (frame.error) {
      this.appendJsonSection(container, localize("chatDebug.wireLog.section.error", "Error"), frame.error, true);
    }
    if (entry.response) {
      if (entry.response.error) {
        this.appendJsonSection(container, localize("chatDebug.wireLog.section.responseError", "Response Error"), entry.response.error, true);
      } else if (entry.response.payload !== void 0) {
        this.appendJsonSection(container, localize("chatDebug.wireLog.section.result", "Result"), entry.response.payload);
      }
    }
    if (frame.truncated || entry.response?.truncated) {
      DOM.append(container, $(".chat-debug-wirelog-detail-note", void 0, localize("chatDebug.wireLog.truncatedFrame", "Large payload values were elided in the log. Open the full file for complete data.")));
    }
  }
  appendJsonSection(container, title, value, isError = false) {
    const section = DOM.append(container, $(".chat-debug-wirelog-detail-section"));
    DOM.append(section, $(".chat-debug-wirelog-detail-title", void 0, title));
    const pre = DOM.append(section, $("pre.chat-debug-wirelog-detail-json"));
    if (isError) {
      pre.classList.add("chat-debug-wirelog-detail-json-error");
    }
    pre.textContent = stringifyBounded(value);
  }
  renderFooter(source, truncated) {
    DOM.clearNode(this.footer);
    const parts = [];
    if (truncated) {
      parts.push(localize("chatDebug.wireLog.footerTail", "Showing the most recent frames"));
    }
    if (source.isRemote) {
      parts.push(localize("chatDebug.wireLog.footerRemote", "remote"));
    }
    this.footer.textContent = parts.join(" \xB7 ");
  }
};
ChatDebugWireLogView = __decorateClass([
  __decorateParam(1, IChatService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IPathService),
  __decorateParam(6, IAgentHostService),
  __decorateParam(7, IRemoteAgentHostService),
  __decorateParam(8, IOutputService),
  __decorateParam(9, IFileService),
  __decorateParam(10, ITextModelService),
  __decorateParam(11, IEnvironmentService),
  __decorateParam(12, IProductService),
  __decorateParam(13, ILogService)
], ChatDebugWireLogView);
function extractActionType(method, payload) {
  switch (method) {
    case "notification":
      return typeStringOf(getProp(payload, "notification"));
    case "dispatchAction":
      return typeStringOf(Array.isArray(payload) ? payload[1] : void 0);
    case "createSession":
      return uriStringOf(getProp(Array.isArray(payload) ? payload[0] : void 0, "session"));
    default:
      return typeStringOf(getProp(payload, "action"));
  }
}
function getProp(value, key) {
  return value && typeof value === "object" ? value[key] : void 0;
}
function typeStringOf(value) {
  const type = getProp(value, "type");
  return typeof type === "string" ? type : void 0;
}
function uriStringOf(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const external = value.external;
    if (typeof external === "string") {
      return external;
    }
    if (typeof value.scheme === "string") {
      try {
        return URI.revive(value).toString(true);
      } catch {
        return void 0;
      }
    }
  }
  return void 0;
}
function parseWireFrames(text) {
  const frames = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let record;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const meta = record._ahpLog;
    if (!meta) {
      continue;
    }
    const dir = meta.dir === "s2c" ? "s2c" : "c2s";
    const ts = typeof meta.ts === "string" ? Date.parse(meta.ts) : NaN;
    const id = record.id !== void 0 && record.id !== null ? String(record.id) : void 0;
    const method = typeof record.method === "string" ? record.method : void 0;
    const hasResult = Object.prototype.hasOwnProperty.call(record, "result");
    const errorValue = record.error;
    const kind = method ? id !== void 0 ? "request" : "notification" : "response";
    const payload = method ? record.params : hasResult ? record.result : void 0;
    frames.push({
      ts: Number.isNaN(ts) ? 0 : ts,
      dir,
      truncated: meta.truncated === true,
      byteLength: typeof meta.byteLength === "number" ? meta.byteLength : void 0,
      id,
      method,
      actionType: extractActionType(method, payload),
      payload,
      error: errorValue && typeof errorValue === "object" ? errorValue : void 0,
      kind
    });
  }
  return frames;
}
function buildWireEntries(frames) {
  const entries = [];
  const pendingByKey = /* @__PURE__ */ new Map();
  const pendingKey = (dir, id) => `${dir}|${id}`;
  for (const frame of frames) {
    if (frame.kind === "response" && frame.id !== void 0) {
      const requestDir = frame.dir === "c2s" ? "s2c" : "c2s";
      const key = pendingKey(requestDir, frame.id);
      const request = pendingByKey.get(key);
      if (request) {
        request.response = frame;
        pendingByKey.delete(key);
        continue;
      }
    }
    const entry = { frame, response: void 0 };
    entries.push(entry);
    if (frame.kind === "request" && frame.id !== void 0) {
      pendingByKey.set(pendingKey(frame.dir, frame.id), entry);
    }
  }
  return entries;
}
function isErrorEntry(entry) {
  const frame = entry.frame;
  return !!entry.response?.error || frame.kind === "response" && !!frame.error || frame.actionType === ActionType.ChatError;
}
function matchesFilter(entry, filter) {
  const frame = entry.frame;
  if (frame.method?.toLowerCase().includes(filter)) {
    return true;
  }
  if (frame.actionType?.toLowerCase().includes(filter)) {
    return true;
  }
  if (frame.id !== void 0 && frame.id.toLowerCase().includes(filter)) {
    return true;
  }
  const errorMessage = entry.response?.error?.message ?? frame.error?.message;
  return !!errorMessage && errorMessage.toLowerCase().includes(filter);
}
function baseEntryKey(entry) {
  const frame = entry.frame;
  return `${frame.dir}|${frame.kind}|${frame.id ?? ""}|${frame.ts}|${frame.method ?? ""}`;
}
function entryStateKey(entry) {
  const response = entry.response;
  const responseKey = response ? `R${response.ts}${response.error ? "E" : ""}` : "P";
  return `${baseEntryKey(entry)}|${responseKey}`;
}
function stringifyBounded(value) {
  let text;
  try {
    text = JSON.stringify(value, void 0, 2) ?? String(value);
  } catch {
    text = String(value);
  }
  if (text.length > MAX_DETAIL_JSON) {
    return `${text.slice(0, MAX_DETAIL_JSON)}\u2026`;
  }
  return text;
}
function formatDuration(millis) {
  if (millis < 1e3) {
    return localize("chatDebug.wireLog.ms", "{0} ms", Math.round(millis));
  }
  return localize("chatDebug.wireLog.s", "{0} s", (millis / 1e3).toFixed(millis < 1e4 ? 1 : 0));
}
function formatClock(ts) {
  if (!ts) {
    return "";
  }
  const date = new Date(ts);
  const pad = (value, length = 2) => String(value).padStart(length, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}
export {
  ChatDebugWireLogView,
  WireLogNavigation
};
