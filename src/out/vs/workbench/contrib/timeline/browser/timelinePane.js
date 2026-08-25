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
import "./media/timelinePane.css";
import { localize, localize2 } from "../../../../nls.js";
import * as DOM from "../../../../base/browser/dom.js";
import * as css from "../../../../base/browser/cssValue.js";
import { ActionRunner } from "../../../../base/common/actions.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { fromNow } from "../../../../base/common/date.js";
import { debounce } from "../../../../base/common/decorators.js";
import { Emitter } from "../../../../base/common/event.js";
import { createMatches } from "../../../../base/common/filters.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { DisposableStore, Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { escapeRegExpCharacters } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { WorkbenchObjectTree } from "../../../../platform/list/browser/listService.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITimelineService } from "../common/timeline.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { SideBySideEditor, EditorResourceAccessor } from "../../../common/editor.js";
import { ICommandService, CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { getContextMenuActions, createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId, registerAction2, Action2, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { isDark } from "../../../../platform/theme/common/theme.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { isString } from "../../../../base/common/types.js";
import { renderAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IHoverService, WorkbenchHoverDelegate } from "../../../../platform/hover/browser/hover.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
const ItemHeight = 22;
function isLoadMoreCommand(item) {
  return item instanceof LoadMoreCommand;
}
function isTimelineItem(item) {
  return !!item && !item.handle.startsWith("vscode-command:");
}
function updateRelativeTime(item, lastRelativeTime) {
  item.relativeTime = isTimelineItem(item) ? fromNow(item.timestamp) : void 0;
  item.relativeTimeFullWord = isTimelineItem(item) ? fromNow(item.timestamp, false, true) : void 0;
  if (lastRelativeTime === void 0 || item.relativeTime !== lastRelativeTime) {
    lastRelativeTime = item.relativeTime;
    item.hideRelativeTime = false;
  } else {
    item.hideRelativeTime = true;
  }
  return lastRelativeTime;
}
class TimelineAggregate {
  constructor(timeline) {
    this._stale = false;
    this._requiresReset = false;
    this.source = timeline.source;
    this.items = timeline.items;
    this._cursor = timeline.paging?.cursor;
    this.lastRenderedIndex = -1;
  }
  get cursor() {
    return this._cursor;
  }
  get more() {
    return this._cursor !== void 0;
  }
  get newest() {
    return this.items[0];
  }
  get oldest() {
    return this.items[this.items.length - 1];
  }
  add(timeline, options) {
    let updated = false;
    if (timeline.items.length !== 0 && this.items.length !== 0) {
      updated = true;
      const ids = /* @__PURE__ */ new Set();
      const timestamps = /* @__PURE__ */ new Set();
      for (const item2 of timeline.items) {
        if (item2.id === void 0) {
          timestamps.add(item2.timestamp);
        } else {
          ids.add(item2.id);
        }
      }
      let i = this.items.length;
      let item;
      while (i--) {
        item = this.items[i];
        if (item.id !== void 0 && ids.has(item.id) || timestamps.has(item.timestamp)) {
          this.items.splice(i, 1);
        }
      }
      if ((timeline.items[timeline.items.length - 1]?.timestamp ?? 0) >= (this.newest?.timestamp ?? 0)) {
        this.items.splice(0, 0, ...timeline.items);
      } else {
        this.items.push(...timeline.items);
      }
    } else if (timeline.items.length !== 0) {
      updated = true;
      this.items.push(...timeline.items);
    }
    if (options.cursor !== void 0 || typeof options.limit !== "object") {
      this._cursor = timeline.paging?.cursor;
    }
    if (updated) {
      this.items.sort(
        (a, b) => b.timestamp - a.timestamp || (a.source === void 0 ? b.source === void 0 ? 0 : 1 : b.source === void 0 ? -1 : b.source.localeCompare(a.source, void 0, { numeric: true, sensitivity: "base" }))
      );
    }
    return updated;
  }
  get stale() {
    return this._stale;
  }
  get requiresReset() {
    return this._requiresReset;
  }
  invalidate(requiresReset) {
    this._stale = true;
    this._requiresReset = requiresReset;
  }
}
class LoadMoreCommand {
  constructor(loading) {
    this.handle = "vscode-command:loadMore";
    this.timestamp = 0;
    this.description = void 0;
    this.tooltip = void 0;
    this.contextValue = void 0;
    // Make things easier for duck typing
    this.id = void 0;
    this.icon = void 0;
    this.iconDark = void 0;
    this.source = void 0;
    this.relativeTime = void 0;
    this.relativeTimeFullWord = void 0;
    this.hideRelativeTime = void 0;
    this._loading = false;
    this._loading = loading;
  }
  get loading() {
    return this._loading;
  }
  set loading(value) {
    this._loading = value;
  }
  get ariaLabel() {
    return this.label;
  }
  get label() {
    return this.loading ? localize("timeline.loadingMore", "Loading...") : localize("timeline.loadMore", "Load more");
  }
  get themeIcon() {
    return void 0;
  }
}
const TimelineFollowActiveEditorContext = new RawContextKey("timelineFollowActiveEditor", true, true);
const TimelineExcludeSources = new RawContextKey("timelineExcludeSources", "[]", true);
const TimelineViewFocusedContext = new RawContextKey("timelineFocused", true);
let TimelinePane = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, contextKeyService, configurationService, storageService, viewDescriptorService, instantiationService, editorService, commandService, progressService, timelineService, openerService, themeService, hoverService, labelService, uriIdentityService, extensionService) {
    super({ ...options, titleMenuId: MenuId.TimelineTitle }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.storageService = storageService;
    this.editorService = editorService;
    this.commandService = commandService;
    this.progressService = progressService;
    this.timelineService = timelineService;
    this.labelService = labelService;
    this.uriIdentityService = uriIdentityService;
    this.extensionService = extensionService;
    this.pendingRequests = /* @__PURE__ */ new Map();
    this.timelinesBySource = /* @__PURE__ */ new Map();
    this._followActiveEditor = true;
    this._isEmpty = true;
    this._maxItemCount = 0;
    this._visibleItemCount = 0;
    this._pendingRefresh = false;
    this.commands = this._register(this.instantiationService.createInstance(TimelinePaneCommands, this));
    this.followActiveEditorContext = TimelineFollowActiveEditorContext.bindTo(this.contextKeyService);
    this.timelineExcludeSourcesContext = TimelineExcludeSources.bindTo(this.contextKeyService);
    const excludedSourcesString = storageService.get("timeline.excludeSources", StorageScope.PROFILE, "[]");
    this.timelineExcludeSourcesContext.set(excludedSourcesString);
    this.excludedSources = new Set(JSON.parse(excludedSourcesString));
    this._register(storageService.onDidChangeValue(StorageScope.PROFILE, "timeline.excludeSources", this._store)(this.onStorageServiceChanged, this));
    this._register(configurationService.onDidChangeConfiguration(this.onConfigurationChanged, this));
    this._register(timelineService.onDidChangeProviders(this.onProvidersChanged, this));
    this._register(timelineService.onDidChangeTimeline(this.onTimelineChanged, this));
    this._register(timelineService.onDidChangeUri((uri) => this.setUri(uri), this));
  }
  static {
    this.TITLE = localize2("timeline", "Timeline");
  }
  get followActiveEditor() {
    return this._followActiveEditor;
  }
  set followActiveEditor(value) {
    if (this._followActiveEditor === value) {
      return;
    }
    this._followActiveEditor = value;
    this.followActiveEditorContext.set(value);
    this.updateFilename(this._filename);
    if (value) {
      this.onActiveEditorChanged();
    }
  }
  get pageOnScroll() {
    if (this._pageOnScroll === void 0) {
      this._pageOnScroll = this.configurationService.getValue("timeline.pageOnScroll") ?? false;
    }
    return this._pageOnScroll;
  }
  get pageSize() {
    let pageSize = this.configurationService.getValue("timeline.pageSize");
    if (pageSize === void 0 || pageSize === null) {
      pageSize = Math.max(20, Math.floor((this.tree?.renderHeight ?? 0) / ItemHeight + (this.pageOnScroll ? 1 : -1)));
    }
    return pageSize;
  }
  reset() {
    this.loadTimeline(true);
  }
  setUri(uri) {
    this.setUriCore(uri, true);
  }
  setUriCore(uri, disableFollowing) {
    if (disableFollowing) {
      this.followActiveEditor = false;
    }
    this.uri = uri;
    this.updateFilename(uri ? this.labelService.getUriBasenameLabel(uri) : void 0);
    this.treeRenderer?.setUri(uri);
    this.loadTimeline(true);
  }
  onStorageServiceChanged() {
    const excludedSourcesString = this.storageService.get("timeline.excludeSources", StorageScope.PROFILE, "[]");
    this.timelineExcludeSourcesContext.set(excludedSourcesString);
    this.excludedSources = new Set(JSON.parse(excludedSourcesString));
    const missing = this.timelineService.getSources().filter(({ id }) => !this.excludedSources.has(id) && !this.timelinesBySource.has(id));
    if (missing.length !== 0) {
      this.loadTimeline(true, missing.map(({ id }) => id));
    } else {
      this.refresh();
    }
  }
  onConfigurationChanged(e) {
    if (e.affectsConfiguration("timeline.pageOnScroll")) {
      this._pageOnScroll = void 0;
    }
  }
  onActiveEditorChanged() {
    if (!this.followActiveEditor || !this.isExpanded()) {
      return;
    }
    const uri = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (this.uriIdentityService.extUri.isEqual(uri, this.uri) && uri !== void 0 || // Fallback to match on fsPath if we are dealing with files or git schemes
    uri?.fsPath === this.uri?.fsPath && (uri?.scheme === Schemas.file || uri?.scheme === "git") && (this.uri?.scheme === Schemas.file || this.uri?.scheme === "git")) {
      for (const source of this.timelineService.getSources()) {
        if (this.excludedSources.has(source.id)) {
          continue;
        }
        const timeline = this.timelinesBySource.get(source.id);
        if (timeline !== void 0 && !timeline.stale) {
          continue;
        }
        if (timeline !== void 0) {
          this.updateTimeline(timeline, timeline.requiresReset);
        } else {
          this.loadTimelineForSource(source.id, uri, true);
        }
      }
      return;
    }
    this.setUriCore(uri, false);
  }
  onProvidersChanged(e) {
    if (e.removed) {
      for (const source of e.removed) {
        this.timelinesBySource.delete(source);
      }
      this.refresh();
    }
    if (e.added) {
      this.loadTimeline(true, e.added);
    }
  }
  onTimelineChanged(e) {
    if (e?.uri === void 0 || this.uriIdentityService.extUri.isEqual(URI.revive(e.uri), this.uri)) {
      const timeline = this.timelinesBySource.get(e.id);
      if (timeline === void 0) {
        return;
      }
      if (this.isBodyVisible()) {
        this.updateTimeline(timeline, e.reset);
      } else {
        timeline.invalidate(e.reset);
      }
    }
  }
  updateFilename(filename) {
    this._filename = filename;
    if (this.followActiveEditor || !filename) {
      this.updateTitleDescription(filename);
    } else {
      this.updateTitleDescription(`${filename} (pinned)`);
    }
  }
  get message() {
    return this._message;
  }
  set message(message) {
    this._message = message;
    this.updateMessage();
  }
  updateMessage() {
    if (this._message !== void 0) {
      this.showMessage(this._message);
    } else {
      this.hideMessage();
    }
  }
  showMessage(message) {
    if (!this.$message) {
      return;
    }
    this.$message.classList.remove("hide");
    this.resetMessageElement();
    this.$message.textContent = message;
  }
  hideMessage() {
    this.resetMessageElement();
    this.$message.classList.add("hide");
  }
  resetMessageElement() {
    DOM.clearNode(this.$message);
  }
  get hasVisibleItems() {
    return this._visibleItemCount > 0;
  }
  clear(cancelPending) {
    this._visibleItemCount = 0;
    this._maxItemCount = this.pageSize;
    this.timelinesBySource.clear();
    if (cancelPending) {
      for (const pendingRequest of this.pendingRequests.values()) {
        pendingRequest.request.tokenSource.cancel();
        pendingRequest.dispose();
      }
      this.pendingRequests.clear();
      if (!this.isBodyVisible() && this.tree) {
        this.tree.setChildren(null, void 0);
        this._isEmpty = true;
      }
    }
  }
  async loadTimeline(reset, sources) {
    if (sources === void 0) {
      if (reset) {
        this.clear(true);
      }
      if (this.uri?.scheme === Schemas.vscodeSettings || this.uri?.scheme === Schemas.webviewPanel || this.uri?.scheme === Schemas.walkThrough) {
        this.uri = void 0;
        this.clear(false);
        this.refresh();
        return;
      }
      if (this._isEmpty && this.uri !== void 0) {
        this.setLoadingUriMessage();
      }
    }
    if (this.uri === void 0) {
      this.clear(false);
      this.refresh();
      return;
    }
    if (!this.isBodyVisible()) {
      return;
    }
    let hasPendingRequests = false;
    for (const source of sources ?? this.timelineService.getSources().map((s) => s.id)) {
      const requested = this.loadTimelineForSource(source, this.uri, reset);
      if (requested) {
        hasPendingRequests = true;
      }
    }
    if (!hasPendingRequests) {
      this.refresh();
    } else if (this._isEmpty) {
      this.setLoadingUriMessage();
    }
  }
  loadTimelineForSource(source, uri, reset, options) {
    if (this.excludedSources.has(source)) {
      return false;
    }
    const timeline = this.timelinesBySource.get(source);
    if (!reset && options?.cursor !== void 0 && timeline !== void 0 && (!timeline?.more || timeline.items.length > timeline.lastRenderedIndex + this.pageSize)) {
      return false;
    }
    if (options === void 0) {
      if (!reset && timeline !== void 0 && timeline.items.length > 0 && !timeline.more) {
        return false;
      }
      options = { cursor: reset ? void 0 : timeline?.cursor, limit: this.pageSize };
    }
    const pendingRequest = this.pendingRequests.get(source);
    if (pendingRequest !== void 0) {
      options.cursor = pendingRequest.request.options.cursor;
      if (typeof options.limit === "number") {
        if (typeof pendingRequest.request.options.limit === "number") {
          options.limit += pendingRequest.request.options.limit;
        } else {
          options.limit = pendingRequest.request.options.limit;
        }
      }
    }
    pendingRequest?.request?.tokenSource.cancel();
    pendingRequest?.dispose();
    options.cacheResults = true;
    options.resetCache = reset;
    const tokenSource = new CancellationTokenSource();
    const newRequest = this.timelineService.getTimeline(source, uri, options, tokenSource);
    if (newRequest === void 0) {
      tokenSource.dispose();
      return false;
    }
    const disposables = new DisposableStore();
    this.pendingRequests.set(source, { request: newRequest, dispose: () => disposables.dispose() });
    disposables.add(tokenSource);
    disposables.add(tokenSource.token.onCancellationRequested(() => this.pendingRequests.delete(source)));
    this.handleRequest(newRequest);
    return true;
  }
  updateTimeline(timeline, reset) {
    if (reset) {
      this.timelinesBySource.delete(timeline.source);
      const { oldest } = timeline;
      this.loadTimelineForSource(timeline.source, this.uri, true, oldest !== void 0 ? { limit: { timestamp: oldest.timestamp, id: oldest.id } } : void 0);
    } else {
      const { newest } = timeline;
      this.loadTimelineForSource(timeline.source, this.uri, false, newest !== void 0 ? { limit: { timestamp: newest.timestamp, id: newest.id } } : { limit: this.pageSize });
    }
  }
  async handleRequest(request) {
    let response;
    try {
      response = await this.progressService.withProgress({ location: this.id }, () => request.result);
    } catch {
    }
    if (!request.tokenSource.token.isCancellationRequested) {
      this.pendingRequests.get(request.source)?.dispose();
      this.pendingRequests.delete(request.source);
    }
    if (response === void 0 || request.uri !== this.uri) {
      if (this.pendingRequests.size === 0 && this._pendingRefresh) {
        this.refresh();
      }
      return;
    }
    const source = request.source;
    let updated = false;
    const timeline = this.timelinesBySource.get(source);
    if (timeline === void 0) {
      this.timelinesBySource.set(source, new TimelineAggregate(response));
      updated = true;
    } else {
      updated = timeline.add(response, request.options);
    }
    if (updated) {
      this._pendingRefresh = true;
      if (this.hasVisibleItems && this.pendingRequests.size !== 0) {
        this.refreshDebounced();
      } else {
        this.refresh();
      }
    } else if (this.pendingRequests.size === 0) {
      if (this._pendingRefresh) {
        this.refresh();
      } else {
        this.tree.rerender();
      }
    }
  }
  *getItems() {
    let more = false;
    if (this.uri === void 0 || this.timelinesBySource.size === 0) {
      this._visibleItemCount = 0;
      return;
    }
    const maxCount = this._maxItemCount;
    let count = 0;
    if (this.timelinesBySource.size === 1) {
      const [source, timeline] = Iterable.first(this.timelinesBySource);
      timeline.lastRenderedIndex = -1;
      if (this.excludedSources.has(source)) {
        this._visibleItemCount = 0;
        return;
      }
      if (timeline.items.length !== 0) {
        this._visibleItemCount = 1;
      }
      more = timeline.more;
      let lastRelativeTime;
      for (const item of timeline.items) {
        item.relativeTime = void 0;
        item.hideRelativeTime = void 0;
        count++;
        if (count > maxCount) {
          more = true;
          break;
        }
        lastRelativeTime = updateRelativeTime(item, lastRelativeTime);
        yield { element: item };
      }
      timeline.lastRenderedIndex = count - 1;
    } else {
      let getNextMostRecentSource = function() {
        return sources.filter((source) => !source.nextItem.done).reduce((previous, current) => previous === void 0 || current.nextItem.value.timestamp >= previous.nextItem.value.timestamp ? current : previous, void 0);
      };
      const sources = [];
      let hasAnyItems = false;
      let mostRecentEnd = 0;
      for (const [source, timeline] of this.timelinesBySource) {
        timeline.lastRenderedIndex = -1;
        if (this.excludedSources.has(source) || timeline.stale) {
          continue;
        }
        if (timeline.items.length !== 0) {
          hasAnyItems = true;
        }
        if (timeline.more) {
          more = true;
          const last = timeline.items[Math.min(maxCount, timeline.items.length - 1)];
          if (last.timestamp > mostRecentEnd) {
            mostRecentEnd = last.timestamp;
          }
        }
        const iterator = timeline.items[Symbol.iterator]();
        sources.push({ timeline, iterator, nextItem: iterator.next() });
      }
      this._visibleItemCount = hasAnyItems ? 1 : 0;
      let lastRelativeTime;
      let nextSource;
      while (nextSource = getNextMostRecentSource()) {
        nextSource.timeline.lastRenderedIndex++;
        const item = nextSource.nextItem.value;
        item.relativeTime = void 0;
        item.hideRelativeTime = void 0;
        if (item.timestamp >= mostRecentEnd) {
          count++;
          if (count > maxCount) {
            more = true;
            break;
          }
          lastRelativeTime = updateRelativeTime(item, lastRelativeTime);
          yield { element: item };
        }
        nextSource.nextItem = nextSource.iterator.next();
      }
    }
    this._visibleItemCount = count;
    if (count > 0) {
      if (more) {
        yield {
          element: new LoadMoreCommand(this.pendingRequests.size !== 0)
        };
      } else if (this.pendingRequests.size !== 0) {
        yield {
          element: new LoadMoreCommand(true)
        };
      }
    }
  }
  refresh() {
    if (!this.isBodyVisible()) {
      return;
    }
    this.tree.setChildren(null, this.getItems());
    this._isEmpty = !this.hasVisibleItems;
    if (this.uri === void 0) {
      this.updateFilename(void 0);
      this.message = localize("timeline.editorCannotProvideTimeline", "The active editor cannot provide timeline information.");
    } else if (this._isEmpty) {
      if (this.pendingRequests.size !== 0) {
        this.setLoadingUriMessage();
      } else {
        this.updateFilename(this.labelService.getUriBasenameLabel(this.uri));
        const scmProviderCount = this.contextKeyService.getContextKeyValue("scm.providerCount");
        if (this.timelineService.getSources().filter(({ id }) => !this.excludedSources.has(id)).length === 0) {
          this.message = localize("timeline.noTimelineSourcesEnabled", "All timeline sources have been filtered out.");
        } else {
          if (this.configurationService.getValue("workbench.localHistory.enabled") && !this.excludedSources.has("timeline.localHistory")) {
            this.message = localize("timeline.noLocalHistoryYet", "Local History will track recent changes as you save them unless the file has been excluded or is too large.");
          } else if (this.excludedSources.size > 0) {
            this.message = localize("timeline.noTimelineInfoFromEnabledSources", "No filtered timeline information was provided.");
          } else {
            this.message = localize("timeline.noTimelineInfo", "No timeline information was provided.");
          }
        }
        if (!scmProviderCount || scmProviderCount === 0) {
          this.message += " " + localize("timeline.noSCM", "Source Control has not been configured.");
        }
      }
    } else {
      this.updateFilename(this.labelService.getUriBasenameLabel(this.uri));
      this.message = void 0;
    }
    this._pendingRefresh = false;
  }
  refreshDebounced() {
    this.refresh();
  }
  focus() {
    super.focus();
    this.tree.domFocus();
  }
  setExpanded(expanded) {
    const changed = super.setExpanded(expanded);
    if (changed && this.isBodyVisible()) {
      if (!this.followActiveEditor) {
        this.setUriCore(this.uri, true);
      } else {
        this.onActiveEditorChanged();
      }
    }
    return changed;
  }
  setVisible(visible) {
    if (visible) {
      this.extensionService.activateByEvent("onView:timeline");
      this.visibilityDisposables?.dispose();
      this.visibilityDisposables = new DisposableStore();
      this.editorService.onDidActiveEditorChange(this.onActiveEditorChanged, this, this.visibilityDisposables);
      this.onDidFocus(() => this.refreshDebounced(), this, this.visibilityDisposables);
      super.setVisible(visible);
      this.onActiveEditorChanged();
    } else {
      this.visibilityDisposables?.dispose();
      super.setVisible(visible);
    }
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.tree.layout(height, width);
  }
  renderHeaderTitle(container) {
    super.renderHeaderTitle(container, this.title);
    container.classList.add("timeline-view");
  }
  renderBody(container) {
    super.renderBody(container);
    this.$container = container;
    container.classList.add("tree-explorer-viewlet-tree-view", "timeline-tree-view");
    this.$message = DOM.append(this.$container, DOM.$(".message"));
    this.$message.classList.add("timeline-subtle");
    this.message = localize("timeline.editorCannotProvideTimeline", "The active editor cannot provide timeline information.");
    this.$tree = document.createElement("div");
    this.$tree.classList.add("customview-tree", "file-icon-themable-tree", "hide-arrows");
    container.appendChild(this.$tree);
    this.treeRenderer = this._register(this.instantiationService.createInstance(TimelineTreeRenderer, this.commands, this.viewDescriptorService.getViewLocationById(this.id)));
    this._register(this.treeRenderer.onDidScrollToEnd((item) => {
      if (this.pageOnScroll) {
        this.loadMore(item);
      }
    }));
    this.tree = this.instantiationService.createInstance(
      WorkbenchObjectTree,
      "TimelinePane",
      this.$tree,
      new TimelineListVirtualDelegate(),
      [this.treeRenderer],
      {
        identityProvider: new TimelineIdentityProvider(),
        accessibilityProvider: {
          getAriaLabel(element) {
            if (isLoadMoreCommand(element)) {
              return element.ariaLabel;
            }
            return element.accessibilityInformation ? element.accessibilityInformation.label : localize("timeline.aria.item", "{0}: {1}", element.relativeTimeFullWord ?? "", element.label);
          },
          getRole(element) {
            if (isLoadMoreCommand(element)) {
              return "treeitem";
            }
            return element.accessibilityInformation && element.accessibilityInformation.role ? element.accessibilityInformation.role : "treeitem";
          },
          getWidgetAriaLabel() {
            return localize("timeline", "Timeline");
          }
        },
        keyboardNavigationLabelProvider: new TimelineKeyboardNavigationLabelProvider(),
        multipleSelectionSupport: false,
        overrideStyles: this.getLocationBasedColors().listOverrideStyles
      }
    );
    TimelineViewFocusedContext.bindTo(this.tree.contextKeyService);
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(this.commands, e)));
    this._register(this.tree.onDidChangeSelection((e) => this.ensureValidItems()));
    this._register(this.tree.onDidOpen((e) => {
      if (!e.browserEvent || !this.ensureValidItems()) {
        return;
      }
      const selection = this.tree.getSelection();
      let item;
      if (selection.length === 1) {
        item = selection[0];
      }
      if (item === null) {
        return;
      }
      if (isTimelineItem(item)) {
        if (item.command) {
          let args = item.command.arguments ?? [];
          if (item.command.id === API_OPEN_EDITOR_COMMAND_ID || item.command.id === API_OPEN_DIFF_EDITOR_COMMAND_ID) {
            args = [...args, e];
          }
          this.commandService.executeCommand(item.command.id, ...args);
        }
      } else if (isLoadMoreCommand(item)) {
        this.loadMore(item);
      }
    }));
  }
  loadMore(item) {
    if (item.loading) {
      return;
    }
    item.loading = true;
    this.tree.rerender(item);
    if (this.pendingRequests.size !== 0) {
      return;
    }
    this._maxItemCount = this._visibleItemCount + this.pageSize;
    this.loadTimeline(false);
  }
  ensureValidItems() {
    if (!this.hasVisibleItems || !this.timelineService.getSources().some(({ id }) => !this.excludedSources.has(id) && this.timelinesBySource.has(id))) {
      this.tree.setChildren(null, void 0);
      this._isEmpty = true;
      this.setLoadingUriMessage();
      return false;
    }
    return true;
  }
  setLoadingUriMessage() {
    const file = this.uri && this.labelService.getUriBasenameLabel(this.uri);
    this.updateFilename(file);
    this.message = file ? localize("timeline.loading", "Loading timeline for {0}...", file) : "";
  }
  onContextMenu(commands, treeEvent) {
    const item = treeEvent.element;
    if (item === null) {
      return;
    }
    const event = treeEvent.browserEvent;
    event.preventDefault();
    event.stopPropagation();
    if (!this.ensureValidItems()) {
      return;
    }
    this.tree.setFocus([item]);
    const actions = commands.getItemContextActions(item);
    if (!actions.length) {
      return;
    }
    this.contextMenuService.showContextMenu({
      getAnchor: () => treeEvent.anchor,
      getActions: () => actions,
      getActionViewItem: (action) => {
        const keybinding = this.keybindingService.lookupKeybinding(action.id);
        if (keybinding) {
          return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel() });
        }
        return void 0;
      },
      onHide: (wasCancelled) => {
        if (wasCancelled) {
          this.tree.domFocus();
        }
      },
      getActionsContext: () => ({ uri: this.uri, item }),
      actionRunner: new TimelineActionRunner()
    });
  }
};
__decorateClass([
  debounce(500)
], TimelinePane.prototype, "refreshDebounced", 1);
TimelinePane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IViewDescriptorService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, ICommandService),
  __decorateParam(10, IProgressService),
  __decorateParam(11, ITimelineService),
  __decorateParam(12, IOpenerService),
  __decorateParam(13, IThemeService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, ILabelService),
  __decorateParam(16, IUriIdentityService),
  __decorateParam(17, IExtensionService)
], TimelinePane);
class TimelineElementTemplate {
  static {
    this.id = "TimelineElementTemplate";
  }
  constructor(container, actionViewItemProvider, hoverDelegate) {
    container.classList.add("custom-view-tree-node-item");
    this.icon = DOM.append(container, DOM.$(".custom-view-tree-node-item-icon"));
    this.iconLabel = new IconLabel(container, { supportHighlights: true, supportIcons: true, hoverDelegate });
    const timestampContainer = DOM.append(this.iconLabel.element, DOM.$(".timeline-timestamp-container"));
    this.timestamp = DOM.append(timestampContainer, DOM.$("span.timeline-timestamp"));
    const actionsContainer = DOM.append(this.iconLabel.element, DOM.$(".actions"));
    this.actionBar = new ActionBar(actionsContainer, { actionViewItemProvider });
  }
  dispose() {
    this.iconLabel.dispose();
    this.actionBar.dispose();
  }
  reset() {
    this.icon.className = "";
    this.icon.style.backgroundImage = "";
    this.actionBar.clear();
  }
}
class TimelineIdentityProvider {
  getId(item) {
    return item.handle;
  }
}
class TimelineActionRunner extends ActionRunner {
  async runAction(action, { uri, item }) {
    if (!isTimelineItem(item)) {
      await action.run();
      return;
    }
    await action.run(
      {
        $mid: MarshalledId.TimelineActionContext,
        handle: item.handle,
        source: item.source,
        uri
      },
      uri,
      item.source
    );
  }
}
class TimelineKeyboardNavigationLabelProvider {
  getKeyboardNavigationLabel(element) {
    return element.label;
  }
}
class TimelineListVirtualDelegate {
  getHeight(_element) {
    return ItemHeight;
  }
  getTemplateId(element) {
    return TimelineElementTemplate.id;
  }
}
let TimelineTreeRenderer = class extends Disposable {
  constructor(commands, viewContainerLocation, instantiationService, themeService) {
    super();
    this.commands = commands;
    this.viewContainerLocation = viewContainerLocation;
    this.instantiationService = instantiationService;
    this.themeService = themeService;
    this._onDidScrollToEnd = this._register(new Emitter());
    this.onDidScrollToEnd = this._onDidScrollToEnd.event;
    this.templateId = TimelineElementTemplate.id;
    this.actionViewItemProvider = createActionViewItem.bind(void 0, this.instantiationService);
    this._hoverDelegate = this.instantiationService.createInstance(
      WorkbenchHoverDelegate,
      this.viewContainerLocation === ViewContainerLocation.Panel ? "mouse" : "element",
      {
        instantHover: this.viewContainerLocation !== ViewContainerLocation.Panel
      },
      {
        position: {
          hoverPosition: HoverPosition.RIGHT
          // Will flip when there's no space
        }
      }
    );
  }
  setUri(uri) {
    this.uri = uri;
  }
  renderTemplate(container) {
    return new TimelineElementTemplate(container, this.actionViewItemProvider, this._hoverDelegate);
  }
  renderElement(node, index, template) {
    template.reset();
    const { element: item } = node;
    const theme = this.themeService.getColorTheme();
    const icon = isDark(theme.type) ? item.iconDark : item.icon;
    const iconUrl = icon ? URI.revive(icon) : null;
    if (iconUrl) {
      template.icon.className = "custom-view-tree-node-item-icon";
      template.icon.style.backgroundImage = css.asCSSUrl(iconUrl);
      template.icon.style.color = "";
    } else if (item.themeIcon) {
      template.icon.className = `custom-view-tree-node-item-icon ${ThemeIcon.asClassName(item.themeIcon)}`;
      if (item.themeIcon.color) {
        template.icon.style.color = theme.getColor(item.themeIcon.color.id)?.toString() ?? "";
      } else {
        template.icon.style.color = "";
      }
      template.icon.style.backgroundImage = "";
    } else {
      template.icon.className = "custom-view-tree-node-item-icon";
      template.icon.style.backgroundImage = "";
      template.icon.style.color = "";
    }
    const tooltip = item.tooltip ? isString(item.tooltip) ? item.tooltip : { markdown: item.tooltip, markdownNotSupportedFallback: renderAsPlaintext(item.tooltip) } : void 0;
    template.iconLabel.setLabel(item.label, item.description, {
      title: tooltip,
      matches: createMatches(node.filterData)
    });
    template.timestamp.textContent = item.relativeTime ?? "";
    template.timestamp.ariaLabel = item.relativeTimeFullWord ?? "";
    template.timestamp.parentElement.classList.toggle("timeline-timestamp--duplicate", isTimelineItem(item) && item.hideRelativeTime);
    template.actionBar.context = { uri: this.uri, item };
    template.actionBar.actionRunner = new TimelineActionRunner();
    template.actionBar.push(this.commands.getItemActions(item), { icon: true, label: false });
    if (isLoadMoreCommand(item)) {
      setTimeout(() => this._onDidScrollToEnd.fire(item), 0);
    }
  }
  disposeElement(element, index, templateData) {
    templateData.actionBar.actionRunner.dispose();
  }
  disposeTemplate(template) {
    template.dispose();
  }
};
TimelineTreeRenderer = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IThemeService)
], TimelineTreeRenderer);
const timelineRefresh = registerIcon("timeline-refresh", Codicon.refresh, localize("timelineRefresh", "Icon for the refresh timeline action."));
const timelinePin = registerIcon("timeline-pin", Codicon.pin, localize("timelinePin", "Icon for the pin timeline action."));
const timelineUnpin = registerIcon("timeline-unpin", Codicon.pinned, localize("timelineUnpin", "Icon for the unpin timeline action."));
let TimelinePaneCommands = class extends Disposable {
  constructor(pane, timelineService, storageService, contextKeyService, menuService) {
    super();
    this.pane = pane;
    this.timelineService = timelineService;
    this.storageService = storageService;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    this._register(this.sourceDisposables = new DisposableStore());
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "timeline.refresh",
          title: localize2("refresh", "Refresh"),
          icon: timelineRefresh,
          category: localize2("timeline", "Timeline"),
          menu: {
            id: MenuId.TimelineTitle,
            group: "navigation",
            order: 99
          }
        });
      }
      run(accessor, ...args) {
        pane.reset();
      }
    }));
    this._register(CommandsRegistry.registerCommand(
      "timeline.toggleFollowActiveEditor",
      (accessor, ...args) => pane.followActiveEditor = !pane.followActiveEditor
    ));
    this._register(MenuRegistry.appendMenuItem(MenuId.TimelineTitle, {
      command: {
        id: "timeline.toggleFollowActiveEditor",
        title: localize2("timeline.toggleFollowActiveEditorCommand.follow", "Pin the Current Timeline"),
        icon: timelinePin,
        category: localize2("timeline", "Timeline")
      },
      group: "navigation",
      order: 98,
      when: TimelineFollowActiveEditorContext
    }));
    this._register(MenuRegistry.appendMenuItem(MenuId.TimelineTitle, {
      command: {
        id: "timeline.toggleFollowActiveEditor",
        title: localize2("timeline.toggleFollowActiveEditorCommand.unfollow", "Unpin the Current Timeline"),
        icon: timelineUnpin,
        category: localize2("timeline", "Timeline")
      },
      group: "navigation",
      order: 98,
      when: TimelineFollowActiveEditorContext.toNegated()
    }));
    this._register(timelineService.onDidChangeProviders(() => this.updateTimelineSourceFilters()));
    this.updateTimelineSourceFilters();
  }
  getItemActions(element) {
    return this.getActions(MenuId.TimelineItemContext, { key: "timelineItem", value: element.contextValue }).primary;
  }
  getItemContextActions(element) {
    return this.getActions(MenuId.TimelineItemContext, { key: "timelineItem", value: element.contextValue }).secondary;
  }
  getActions(menuId, context) {
    const contextKeyService = this.contextKeyService.createOverlay([
      ["view", this.pane.id],
      [context.key, context.value]
    ]);
    const menu = this.menuService.getMenuActions(menuId, contextKeyService, { shouldForwardArgs: true });
    return getContextMenuActions(menu, "inline");
  }
  updateTimelineSourceFilters() {
    this.sourceDisposables.clear();
    const excluded = new Set(JSON.parse(this.storageService.get("timeline.excludeSources", StorageScope.PROFILE, "[]")));
    for (const source of this.timelineService.getSources()) {
      this.sourceDisposables.add(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: `timeline.toggleExcludeSource:${source.id}`,
            title: source.label,
            menu: {
              id: MenuId.TimelineFilterSubMenu,
              group: "navigation"
            },
            toggled: ContextKeyExpr.regex(`timelineExcludeSources`, new RegExp(`\\b${escapeRegExpCharacters(source.id)}\\b`)).negate()
          });
        }
        run(accessor, ...args) {
          if (!excluded.delete(source.id)) {
            excluded.add(source.id);
          }
          const storageService = accessor.get(IStorageService);
          storageService.store("timeline.excludeSources", JSON.stringify([...excluded.keys()]), StorageScope.PROFILE, StorageTarget.USER);
        }
      }));
    }
  }
};
TimelinePaneCommands = __decorateClass([
  __decorateParam(1, ITimelineService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IMenuService)
], TimelinePaneCommands);
export {
  TimelineExcludeSources,
  TimelineFollowActiveEditorContext,
  TimelineIdentityProvider,
  TimelineKeyboardNavigationLabelProvider,
  TimelineListVirtualDelegate,
  TimelinePane,
  TimelineViewFocusedContext
};
