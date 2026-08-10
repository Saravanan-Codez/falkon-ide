import "./media/mobileOverlayViews.css";
import "./media/mobileMultiDiffView.css";
import * as DOM from "../../../../../base/browser/dom.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Gesture, EventType as TouchEventType } from "../../../../../base/browser/touch.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { basename, dirname } from "../../../../../base/common/resources.js";
import { TokenizationRegistry } from "../../../../../editor/common/languages.js";
import { generateTokensCSSForColorMap } from "../../../../../editor/common/languages/supports/tokenization.js";
import { computeUnifiedDiff, hasMultipleTokenClasses, regexTokenizeLines, resolveMobileDiffLanguageId, tokenizeFileLines } from "./mobileDiffHelpers.js";
import { computeMobileMultiDiffItemHeight, computeMobileMultiDiffVirtualLayout } from "./mobileMultiDiffVirtualizer.js";
const $ = DOM.$;
const VIRTUALIZER_METRICS = {
  fileHeaderHeight: 44,
  hunkHeaderHeight: 26,
  rowHeight: 18,
  bodyVerticalPadding: 0,
  placeholderHeight: 76
};
const MAX_CONCURRENT_FILE_LOADS = 2;
const MAX_CONCURRENT_PREFETCH_LOADS = 1;
const MIN_PREFETCH_DISTANCE = 2400;
const PREFETCH_VIEWPORT_MULTIPLIER = 4;
class MobileMultiDiffView extends Disposable {
  constructor(workbenchContainer, data, textFileService, fileService, languageService) {
    super();
    this.data = data;
    this.textFileService = textFileService;
    this.fileService = fileService;
    this.languageService = languageService;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this.viewStore = this._register(new DisposableStore());
    this.disposed = false;
    this.renderGeneration = 0;
    this.mountedIndexes = /* @__PURE__ */ new Set();
    this.fileStates = data.diffs.map((diff, index) => ({
      index,
      diff,
      section: void 0,
      content: void 0,
      sectionStore: void 0,
      collapsed: false,
      loadState: "idle",
      loadKind: void 0,
      loadRequestId: 0,
      estimatedHunkCount: diff.identical || diff.added + diff.removed === 0 ? 0 : 1,
      estimatedRowCount: diff.added + diff.removed,
      hunkCount: 0,
      rowCount: 0,
      renderData: void 0,
      bodyScrollTop: 0,
      bodyViewportHeight: 0,
      fileMessage: void 0,
      bodyInner: void 0,
      renderedBodyRows: /* @__PURE__ */ new Map(),
      renderedBodyStartIndex: void 0,
      renderedBodyEndIndex: void 0
    }));
    this.render(workbenchContainer);
    this.renderGeneration++;
    this.updateVirtualLayout();
    this.scrollToInitialIndex();
    this.scheduleLoadVisibleFiles();
  }
  render(workbenchContainer) {
    const overlay = DOM.append(workbenchContainer, $("div.mobile-overlay-view.mobile-multi-diff-view"));
    this.viewStore.add(DOM.addDisposableListener(overlay, DOM.EventType.CONTEXT_MENU, (e) => e.preventDefault()));
    this.viewStore.add(toDisposable(() => overlay.remove()));
    const topBar = DOM.append(overlay, $("div.mobile-multi-diff-topbar"));
    const backBtn = DOM.append(topBar, $("button.mobile-overlay-back-btn", { type: "button" }));
    backBtn.setAttribute("aria-label", localize("multiDiffView.back", "Back"));
    DOM.append(backBtn, $("span")).classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronLeft));
    this.viewStore.add(Gesture.addTarget(backBtn));
    this.viewStore.add(DOM.addDisposableListener(backBtn, DOM.EventType.CLICK, () => this.dispose()));
    this.viewStore.add(DOM.addDisposableListener(backBtn, TouchEventType.Tap, () => this.dispose()));
    const fileCount = DOM.append(topBar, $("span.mobile-multi-diff-file-count"));
    fileCount.textContent = localize(
      "multiDiffView.fileCount",
      "{0} {1}",
      this.data.diffs.length,
      this.data.diffs.length === 1 ? localize("multiDiffView.file", "file") : localize("multiDiffView.files", "files")
    );
    const body = DOM.append(overlay, $("div.mobile-overlay-body"));
    this.scrollWrapper = DOM.append(body, $("div.mobile-overlay-scroll"));
    this.virtualContent = DOM.append(this.scrollWrapper, $("div.mobile-multi-diff-virtual-content"));
    this.viewStore.add(DOM.addDisposableListener(this.scrollWrapper, DOM.EventType.SCROLL, () => this.scheduleVirtualLayout(), { passive: true }));
  }
  scrollToInitialIndex() {
    if (this.data.initialIndex === void 0 || this.data.initialIndex <= 0) {
      return;
    }
    DOM.getWindow(this.scrollWrapper).requestAnimationFrame(() => {
      if (this.disposed) {
        return;
      }
      this.scrollWrapper.scrollTop = this.computeVirtualTop(this.data.initialIndex);
      this.updateVirtualLayout();
      this.scheduleLoadVisibleFiles();
    });
  }
  formatDirSegment(uri) {
    const parent = dirname(uri);
    const parentPath = parent.path.replace(/^\/+/, "");
    if (!parentPath || parentPath === ".") {
      return "";
    }
    const segments = parentPath.split("/").filter((s) => s.length > 0);
    if (segments.length === 0) {
      return "";
    }
    const tail = segments.slice(-2).join("/");
    const prefix = segments.length > 2 ? "\u2026/" : "";
    return `${prefix}${tail}/`;
  }
  renderFileSection(state) {
    const diff = state.diff;
    const store = new DisposableStore();
    const section = $("div.mobile-multi-diff-file-section");
    section.dataset.index = String(state.index);
    const header = DOM.append(section, $("div.mobile-multi-diff-file-header"));
    const fileNameUri = diff.modifiedURI ?? diff.originalURI;
    const fileName = fileNameUri ? basename(fileNameUri) : "";
    const dirPath = fileNameUri ? this.formatDirSegment(fileNameUri) : "";
    const chevronEl = DOM.append(header, $("span.mobile-multi-diff-file-chevron", {
      role: "button",
      tabindex: "0",
      "aria-expanded": "true"
    }));
    chevronEl.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
    chevronEl.setAttribute("aria-label", localize("multiDiffView.toggleFile", "Toggle {0}", fileName || localize("multiDiffView.fileFallback", "file")));
    const nameEl = DOM.append(header, $("span.mobile-multi-diff-file-name"));
    if (dirPath) {
      DOM.append(nameEl, $("span.mobile-multi-diff-file-dir")).textContent = dirPath;
    }
    DOM.append(nameEl, $("span.mobile-multi-diff-file-base")).textContent = fileName;
    const statsEl = DOM.append(header, $("span.mobile-multi-diff-file-stats"));
    if (!diff.identical) {
      if (diff.added) {
        DOM.append(statsEl, $("span.mobile-multi-diff-stat-added")).textContent = `+${diff.added}`;
      }
      if (diff.removed) {
        DOM.append(statsEl, $("span.mobile-multi-diff-stat-removed")).textContent = `-${diff.removed}`;
      }
    }
    const content = DOM.append(section, $("div.mobile-multi-diff-file-content"));
    const loadingEl = DOM.append(content, $("div.mobile-diff-empty-state"));
    loadingEl.textContent = localize("multiDiffView.loading", "Loading\u2026");
    const toggle = (e) => {
      e.stopPropagation();
      state.collapsed = !state.collapsed;
      section.classList.toggle("collapsed", state.collapsed);
      chevronEl.setAttribute("aria-expanded", state.collapsed ? "false" : "true");
      chevronEl.classList.remove(...ThemeIcon.asClassNameArray(state.collapsed ? Codicon.chevronDown : Codicon.chevronRight));
      chevronEl.classList.add(...ThemeIcon.asClassNameArray(state.collapsed ? Codicon.chevronRight : Codicon.chevronDown));
      this.scheduleVirtualLayout();
      if (!state.collapsed) {
        this.scheduleLoadVisibleFiles();
      }
    };
    store.add(Gesture.addTarget(header));
    store.add(DOM.addDisposableListener(header, DOM.EventType.CLICK, toggle));
    store.add(DOM.addDisposableListener(header, TouchEventType.Tap, (e) => {
      e.preventDefault();
      toggle(e);
    }));
    store.add(DOM.addDisposableListener(chevronEl, DOM.EventType.KEY_DOWN, (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(e);
      }
    }));
    return { section, content, store };
  }
  ensureFileSection(state) {
    if (!state.section || !state.content) {
      const { section, content, store } = this.renderFileSection(state);
      state.section = section;
      state.content = content;
      state.sectionStore = store;
      this.renderCurrentFileContent(state);
    }
    return state.section;
  }
  disposeFileSection(state) {
    state.sectionStore?.dispose();
    state.sectionStore = void 0;
    state.section?.remove();
    state.section = void 0;
    state.content = void 0;
    this.resetBodyRenderState(state);
  }
  scheduleVirtualLayout() {
    if (this.disposed) {
      return;
    }
    if (this.layoutAnimationFrame !== void 0) {
      return;
    }
    const targetWindow = DOM.getWindow(this.scrollWrapper);
    this.layoutAnimationFrame = targetWindow.requestAnimationFrame(() => {
      this.layoutAnimationFrame = void 0;
      this.updateVirtualLayout();
    });
  }
  updateVirtualLayout() {
    if (this.disposed) {
      return;
    }
    const layout = this.computeCurrentVirtualLayout();
    this.currentLayout = layout;
    this.virtualContent.style.height = `${layout.totalHeight}px`;
    const visibleIndexes = new Set(layout.items.map((item) => item.index));
    this.abandonOffscreenLoads(visibleIndexes);
    for (const index of Array.from(this.mountedIndexes)) {
      if (!visibleIndexes.has(index)) {
        this.disposeFileSection(this.fileStates[index]);
        this.mountedIndexes.delete(index);
      }
    }
    let previousSection;
    for (const item of layout.items) {
      const state = this.fileStates[item.index];
      const section = this.ensureFileSection(state);
      this.applyVirtualLayout(section, state, item);
      if (!this.mountedIndexes.has(item.index)) {
        this.mountedIndexes.add(item.index);
      }
      this.ensureFileSectionDomOrder(section, previousSection);
      previousSection = section;
    }
    this.scheduleLoadVisibleFiles();
  }
  ensureFileSectionDomOrder(section, previousSection) {
    const referenceNode = previousSection ? previousSection.nextSibling : this.virtualContent.firstChild;
    if (section !== referenceNode) {
      this.virtualContent.insertBefore(section, referenceNode);
    }
  }
  applyVirtualLayout(section, state, item) {
    section.style.top = `${item.renderTop}px`;
    section.style.height = `${item.renderHeight}px`;
    const bodyOffset = Math.max(0, item.innerOffset - VIRTUALIZER_METRICS.fileHeaderHeight);
    state.bodyScrollTop = bodyOffset;
    state.bodyViewportHeight = Math.max(0, this.scrollWrapper.clientHeight - VIRTUALIZER_METRICS.fileHeaderHeight);
    const content = state.content;
    content.classList.toggle("mobile-multi-diff-file-content-placeholder", state.loadState !== "loaded");
    if (state.loadState === "loaded") {
      content.style.height = "";
      content.style.transform = "";
      this.renderLoadedFileContent(state);
    } else {
      const bodyHeight = Math.max(0, item.renderHeight - VIRTUALIZER_METRICS.fileHeaderHeight);
      const placeholderHeight = Math.min(
        bodyHeight || VIRTUALIZER_METRICS.placeholderHeight,
        Math.max(VIRTUALIZER_METRICS.placeholderHeight, state.bodyViewportHeight)
      );
      content.style.height = `${bodyHeight}px`;
      content.style.transform = "";
      this.updateFileMessageHeight(state, placeholderHeight);
    }
  }
  renderCurrentFileContent(state) {
    if (!state.content) {
      return;
    }
    switch (state.loadState) {
      case "loaded":
        this.renderLoadedFileContent(state);
        break;
      case "empty":
        this.renderFileMessage(state, localize("multiDiffView.noChanges", "No changes in this file."));
        break;
      case "error":
        this.renderFileMessage(state, localize("multiDiffView.loadError", "Unable to load changes in this file."));
        break;
      case "idle":
      case "loading":
        this.renderFileMessage(state, localize("multiDiffView.loading", "Loading\u2026"));
        break;
    }
  }
  renderFileMessage(state, message) {
    if (!state.content) {
      return;
    }
    DOM.clearNode(state.content);
    this.resetBodyRenderState(state);
    const empty = DOM.append(state.content, $("div.mobile-diff-empty-state"));
    state.fileMessage = empty;
    empty.textContent = message;
    this.updateFileMessageHeight(state);
  }
  updateFileMessageHeight(state, placeholderHeight) {
    if (!state.content) {
      return;
    }
    const empty = state.fileMessage;
    if (!empty || empty.parentElement !== state.content) {
      return;
    }
    const bodyHeight = Number.parseFloat(state.content.style.height) || VIRTUALIZER_METRICS.placeholderHeight;
    const visibleHeight = placeholderHeight ?? Math.min(
      bodyHeight,
      Math.max(VIRTUALIZER_METRICS.placeholderHeight, state.bodyViewportHeight)
    );
    empty.style.height = `${visibleHeight}px`;
  }
  renderLoadedFileContent(state) {
    if (!state.content || !state.renderData) {
      return;
    }
    const bodyOverscan = Math.max(this.scrollWrapper.clientHeight, 480);
    const visibleTop = Math.max(0, state.bodyScrollTop - bodyOverscan);
    const visibleBottom = Math.min(
      state.renderData.bodyHeight,
      state.bodyScrollTop + state.bodyViewportHeight + bodyOverscan
    );
    const { startIndex, endIndex } = this.computeVisibleBodyEntryRange(state.renderData.bodyEntries, visibleTop, visibleBottom);
    const inner = this.ensureBodyInner(state);
    if (state.renderedBodyStartIndex === startIndex && state.renderedBodyEndIndex === endIndex) {
      return;
    }
    inner.style.height = `${state.renderData.bodyHeight}px`;
    inner.style.minWidth = `calc(${state.renderData.maxLineCharacterCount + 8}ch + 64px)`;
    this.reconcileBodyEntries(state, startIndex, endIndex);
    state.renderedBodyStartIndex = startIndex;
    state.renderedBodyEndIndex = endIndex;
  }
  toVirtualItem(state) {
    return {
      collapsed: state.collapsed,
      state: state.loadState === "idle" ? "unloaded" : state.loadState,
      estimatedHunkCount: state.estimatedHunkCount,
      estimatedRowCount: state.estimatedRowCount,
      hunkCount: state.hunkCount,
      rowCount: state.rowCount
    };
  }
  computeCurrentVirtualLayout() {
    return computeMobileMultiDiffVirtualLayout(this.fileStates.map((state) => this.toVirtualItem(state)), {
      viewportHeight: this.scrollWrapper.clientHeight,
      scrollTop: this.scrollWrapper.scrollTop,
      overscan: Math.max(this.scrollWrapper.clientHeight, 480),
      metrics: VIRTUALIZER_METRICS
    });
  }
  computeVirtualTop(index) {
    let top = 0;
    const end = Math.min(index, this.fileStates.length);
    for (let i = 0; i < end; i++) {
      top += computeMobileMultiDiffItemHeight(this.toVirtualItem(this.fileStates[i]), VIRTUALIZER_METRICS);
    }
    return top;
  }
  scheduleLoadVisibleFiles() {
    if (this.disposed || this.loadVisibleAnimationFrame !== void 0) {
      return;
    }
    const targetWindow = DOM.getWindow(this.scrollWrapper);
    this.loadVisibleAnimationFrame = targetWindow.requestAnimationFrame(() => {
      this.loadVisibleAnimationFrame = void 0;
      this.loadVisibleFiles();
      this.schedulePrefetchFile();
    });
  }
  cancelScheduledLoadVisibleFiles() {
    if (this.loadVisibleAnimationFrame !== void 0) {
      DOM.getWindow(this.scrollWrapper).cancelAnimationFrame(this.loadVisibleAnimationFrame);
      this.loadVisibleAnimationFrame = void 0;
    }
  }
  schedulePrefetchFile() {
    if (this.disposed || this.prefetchAnimationFrame !== void 0) {
      return;
    }
    const targetWindow = DOM.getWindow(this.scrollWrapper);
    this.prefetchAnimationFrame = targetWindow.requestAnimationFrame(() => {
      this.prefetchAnimationFrame = void 0;
      this.prefetchNearFile();
    });
  }
  cancelScheduledPrefetchFile() {
    if (this.prefetchAnimationFrame !== void 0) {
      DOM.getWindow(this.scrollWrapper).cancelAnimationFrame(this.prefetchAnimationFrame);
      this.prefetchAnimationFrame = void 0;
    }
  }
  loadVisibleFiles() {
    if (this.disposed) {
      return;
    }
    const loadingCount = this.fileStates.reduce((count, state) => count + (state.loadState === "loading" ? 1 : 0), 0);
    if (loadingCount >= MAX_CONCURRENT_FILE_LOADS) {
      return;
    }
    const layout = this.currentLayout;
    if (!layout) {
      return;
    }
    const viewportTop = this.scrollWrapper.scrollTop;
    const viewportBottom = viewportTop + this.scrollWrapper.clientHeight;
    let nextState;
    let nextDistance = Number.POSITIVE_INFINITY;
    for (const item of layout.items) {
      const state = this.fileStates[item.index];
      if (state.loadState !== "idle" || state.collapsed) {
        continue;
      }
      const itemTop = item.virtualTop;
      const itemBottom = item.virtualTop + item.virtualHeight;
      const distance = itemBottom < viewportTop ? viewportTop - itemBottom : itemTop > viewportBottom ? itemTop - viewportBottom : 0;
      if (distance < nextDistance) {
        nextState = state;
        nextDistance = distance;
      }
    }
    if (nextState) {
      this.ensureFileLoaded(nextState, "visible");
    }
  }
  prefetchNearFile() {
    if (this.disposed) {
      return;
    }
    const layout = this.currentLayout;
    if (!layout) {
      return;
    }
    const mountedIndexes = new Set(layout.items.map((item) => item.index));
    if (layout.items.some((item) => {
      const state = this.fileStates[item.index];
      return !state.collapsed && state.loadState === "idle";
    })) {
      return;
    }
    const loadingCount = this.fileStates.reduce((count, state) => count + (state.loadState === "loading" ? 1 : 0), 0);
    const prefetchLoadingCount = this.fileStates.reduce((count, state) => count + (state.loadState === "loading" && state.loadKind === "prefetch" ? 1 : 0), 0);
    if (loadingCount >= MAX_CONCURRENT_FILE_LOADS || prefetchLoadingCount >= MAX_CONCURRENT_PREFETCH_LOADS) {
      return;
    }
    const viewportTop = this.scrollWrapper.scrollTop;
    const viewportBottom = viewportTop + this.scrollWrapper.clientHeight;
    const prefetchDistance = Math.max(MIN_PREFETCH_DISTANCE, this.scrollWrapper.clientHeight * PREFETCH_VIEWPORT_MULTIPLIER);
    let virtualTop = 0;
    let nextState;
    let nextDistance = Number.POSITIVE_INFINITY;
    for (const state of this.fileStates) {
      const virtualHeight = computeMobileMultiDiffItemHeight(this.toVirtualItem(state), VIRTUALIZER_METRICS);
      const virtualBottom = virtualTop + virtualHeight;
      if (!mountedIndexes.has(state.index) && !state.collapsed && state.loadState === "idle") {
        const distance = virtualBottom < viewportTop ? viewportTop - virtualBottom : virtualTop > viewportBottom ? virtualTop - viewportBottom : 0;
        if (distance <= prefetchDistance && distance < nextDistance) {
          nextState = state;
          nextDistance = distance;
        }
      }
      virtualTop = virtualBottom;
    }
    if (nextState) {
      this.ensureFileLoaded(nextState, "prefetch");
    }
  }
  ensureFileLoaded(state, loadKind) {
    if (state.loadState !== "idle") {
      return;
    }
    state.loadState = "loading";
    state.loadKind = loadKind;
    state.loadRequestId++;
    this.renderCurrentFileContent(state);
    const generation = this.renderGeneration;
    const loadRequestId = state.loadRequestId;
    void this.loadFileContent(state, generation, loadRequestId).catch(() => {
      if (!this.isActiveFileLoad(state, generation, loadRequestId)) {
        return;
      }
      state.loadState = "error";
      state.loadKind = void 0;
      this.renderCurrentFileContent(state);
    }).finally(() => {
      if (!this.disposed && generation === this.renderGeneration && state.loadRequestId === loadRequestId) {
        this.scheduleVirtualLayout();
      }
    });
  }
  isActiveFileLoad(state, generation, loadRequestId) {
    return !this.disposed && generation === this.renderGeneration && state.loadRequestId === loadRequestId && state.loadState === "loading";
  }
  abandonOffscreenLoads(visibleIndexes) {
    for (const state of this.fileStates) {
      if (state.loadState !== "loading" || state.loadKind === "prefetch" || visibleIndexes.has(state.index)) {
        continue;
      }
      state.loadRequestId++;
      state.loadState = "idle";
      state.loadKind = void 0;
      state.renderData = void 0;
      state.hunkCount = 0;
      state.rowCount = 0;
      this.resetBodyRenderState(state);
      this.renderCurrentFileContent(state);
    }
  }
  async loadFileContent(state, generation, loadRequestId) {
    const diff = state.diff;
    if (diff.identical) {
      if (!this.isActiveFileLoad(state, generation, loadRequestId)) {
        return;
      }
      state.loadState = "empty";
      state.loadKind = void 0;
      state.renderData = void 0;
      state.hunkCount = 0;
      state.rowCount = 0;
      this.renderCurrentFileContent(state);
      return;
    }
    const languageId = resolveMobileDiffLanguageId(this.languageService, diff);
    const [originalText, modifiedText] = await Promise.all([
      this.readTextContent(diff.originalURI),
      this.readTextContent(diff.modifiedURI)
    ]);
    if (!this.isActiveFileLoad(state, generation, loadRequestId)) {
      return;
    }
    const hunks = await (this.data.computeDiff?.(originalText, modifiedText) ?? Promise.resolve(computeUnifiedDiff(originalText, modifiedText)));
    if (!this.isActiveFileLoad(state, generation, loadRequestId)) {
      return;
    }
    if (hunks.length === 0) {
      state.loadState = "empty";
      state.loadKind = void 0;
      state.renderData = void 0;
      state.hunkCount = 0;
      state.rowCount = 0;
      this.renderCurrentFileContent(state);
      return;
    }
    const [origLineHtml, modLineHtml] = await Promise.all([
      tokenizeFileLines(this.languageService, originalText, languageId),
      tokenizeFileLines(this.languageService, modifiedText, languageId)
    ]);
    if (!this.isActiveFileLoad(state, generation, loadRequestId)) {
      return;
    }
    const hasRealTokens = hasMultipleTokenClasses(origLineHtml) || hasMultipleTokenClasses(modLineHtml);
    const origLines = hasRealTokens ? origLineHtml : regexTokenizeLines(originalText, languageId);
    const modLines = hasRealTokens ? modLineHtml : regexTokenizeLines(modifiedText, languageId);
    if (!this.isActiveFileLoad(state, generation, loadRequestId)) {
      return;
    }
    state.loadState = "loaded";
    state.loadKind = void 0;
    state.hunkCount = hunks.length;
    state.rowCount = hunks.reduce((count, hunk) => count + hunk.lines.length, 0);
    const { bodyEntries, bodyHeight, maxLineCharacterCount } = this.createBodyEntries(hunks);
    state.renderData = { bodyEntries, bodyHeight, maxLineCharacterCount, origLines, modLines, hasRealTokens };
    this.resetBodyRenderState(state);
    this.renderCurrentFileContent(state);
  }
  async readTextContent(resource) {
    if (!resource) {
      return "";
    }
    try {
      const model = await this.textFileService.read(resource, { acceptTextOnly: true });
      return model.value;
    } catch {
      try {
        const file = await this.fileService.readFile(resource);
        return file.value.toString();
      } catch {
        return "";
      }
    }
  }
  createBodyEntries(hunks) {
    const bodyEntries = [];
    let top = 0;
    let maxLineCharacterCount = 0;
    for (const hunk of hunks) {
      bodyEntries.push({
        type: "hunk",
        header: hunk.header,
        top,
        height: VIRTUALIZER_METRICS.hunkHeaderHeight
      });
      top += VIRTUALIZER_METRICS.hunkHeaderHeight;
      for (const line of hunk.lines) {
        maxLineCharacterCount = Math.max(maxLineCharacterCount, line.text.length);
        bodyEntries.push({
          type: "line",
          line,
          top,
          height: VIRTUALIZER_METRICS.rowHeight
        });
        top += VIRTUALIZER_METRICS.rowHeight;
      }
    }
    return { bodyEntries, bodyHeight: top, maxLineCharacterCount };
  }
  computeVisibleBodyEntryRange(entries, visibleTop, visibleBottom) {
    if (entries.length === 0 || visibleBottom <= visibleTop) {
      return { startIndex: 0, endIndex: 0 };
    }
    const startIndex = this.findFirstBodyEntryEndingAfter(entries, visibleTop);
    const endIndex = this.findFirstBodyEntryStartingAtOrAfter(entries, visibleBottom);
    return { startIndex, endIndex: Math.max(startIndex, endIndex) };
  }
  findFirstBodyEntryEndingAfter(entries, offset) {
    let low = 0;
    let high = entries.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (entries[mid].top + entries[mid].height <= offset) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }
  findFirstBodyEntryStartingAtOrAfter(entries, offset) {
    let low = 0;
    let high = entries.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (entries[mid].top < offset) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }
  ensureBodyInner(state) {
    if (state.bodyInner && state.bodyInner.parentElement === state.content) {
      return state.bodyInner;
    }
    if (!state.content || !state.renderData) {
      throw new Error("Cannot render a loaded mobile diff body without content and render data.");
    }
    DOM.clearNode(state.content);
    this.resetBodyRenderState(state);
    const inner = DOM.append(state.content, $("div.mobile-multi-diff-file-content-inner"));
    inner.style.height = `${state.renderData.bodyHeight}px`;
    inner.style.minWidth = `calc(${state.renderData.maxLineCharacterCount + 8}ch + 64px)`;
    const colorMap = TokenizationRegistry.getColorMap();
    if (colorMap && state.renderData.hasRealTokens) {
      const styleEl = document.createElement("style");
      styleEl.textContent = generateTokensCSSForColorMap(colorMap);
      inner.appendChild(styleEl);
    }
    state.bodyInner = inner;
    return inner;
  }
  resetBodyRenderState(state) {
    state.fileMessage = void 0;
    state.bodyInner = void 0;
    state.renderedBodyRows.clear();
    state.renderedBodyStartIndex = void 0;
    state.renderedBodyEndIndex = void 0;
  }
  reconcileBodyEntries(state, startIndex, endIndex) {
    if (!state.bodyInner || !state.renderData) {
      return;
    }
    for (const [index, element] of Array.from(state.renderedBodyRows)) {
      if (index < startIndex || index >= endIndex) {
        element.remove();
        state.renderedBodyRows.delete(index);
      }
    }
    let runStart;
    let runEnd = startIndex;
    for (let index = startIndex; index < endIndex; index++) {
      if (state.renderedBodyRows.has(index)) {
        if (runStart !== void 0) {
          this.insertBodyEntryRun(state, runStart, runEnd);
          runStart = void 0;
        }
        continue;
      }
      runStart ??= index;
      runEnd = index + 1;
    }
    if (runStart !== void 0) {
      this.insertBodyEntryRun(state, runStart, runEnd);
    }
  }
  insertBodyEntryRun(state, startIndex, endIndex) {
    if (!state.bodyInner || !state.renderData) {
      return;
    }
    const htmlParts = [];
    for (let index = startIndex; index < endIndex; index++) {
      htmlParts.push(this.renderBodyEntryHtml(index, state.renderData.bodyEntries[index], state.renderData.origLines, state.renderData.modLines));
    }
    const template = document.createElement("template");
    template.innerHTML = htmlParts.join("");
    const insertedElements = Array.from(template.content.children);
    for (const element of insertedElements) {
      const index = Number(element.dataset.entryIndex);
      if (Number.isFinite(index)) {
        state.renderedBodyRows.set(index, element);
      }
    }
    state.bodyInner.insertBefore(template.content, this.findNextRenderedBodyRow(state, endIndex));
  }
  findNextRenderedBodyRow(state, startIndex) {
    for (let index = startIndex; index < state.renderData.bodyEntries.length; index++) {
      const element = state.renderedBodyRows.get(index);
      if (element) {
        return element;
      }
    }
    return null;
  }
  renderBodyEntryHtml(index, entry, origLineHtml, modLineHtml) {
    const style = `top:${entry.top}px;height:${entry.height}px;`;
    if (entry.type === "hunk") {
      return `<div class="mobile-diff-hunk-header mobile-multi-diff-body-entry" data-entry-index="${index}" style="${style}">${this.escapeHtml(entry.header)}</div>`;
    }
    const line = entry.line;
    const lineNumber = line.lineNum !== void 0 ? String(line.lineNum) : "";
    const gutter = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
    const content = this.getLineHtml(line, origLineHtml, modLineHtml);
    return [
      `<div class="mobile-diff-line mobile-multi-diff-body-entry ${line.type}" data-entry-index="${index}" style="${style}">`,
      `<span class="mobile-diff-line-num">${this.escapeHtml(lineNumber)}</span>`,
      `<span class="mobile-diff-gutter">${this.escapeHtml(gutter)}</span>`,
      `<span class="mobile-diff-content">${content}</span>`,
      "</div>"
    ].join("");
  }
  getLineHtml(line, origLineHtml, modLineHtml) {
    if (line.lineNum !== void 0) {
      const source = line.type === "added" ? modLineHtml : origLineHtml;
      const html = source[line.lineNum - 1];
      if (html !== void 0) {
        return html;
      }
    }
    return this.escapeHtml(line.text);
  }
  escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return char;
      }
    });
  }
  dispose() {
    this.disposed = true;
    if (this.layoutAnimationFrame !== void 0) {
      DOM.getWindow(this.scrollWrapper).cancelAnimationFrame(this.layoutAnimationFrame);
      this.layoutAnimationFrame = void 0;
    }
    if (this.loadVisibleAnimationFrame !== void 0) {
      this.cancelScheduledLoadVisibleFiles();
    }
    if (this.prefetchAnimationFrame !== void 0) {
      this.cancelScheduledPrefetchFile();
    }
    for (const state of this.fileStates) {
      this.disposeFileSection(state);
    }
    this.mountedIndexes.clear();
    this._onDidDispose.fire();
    this.viewStore.dispose();
    super.dispose();
  }
}
export {
  MobileMultiDiffView
};
