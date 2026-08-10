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
import "./media/mobileOverlayViews.css";
import "./mobileDiffColors.js";
import * as DOM from "../../../../../base/browser/dom.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Gesture, EventType as TouchEventType } from "../../../../../base/browser/touch.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { autorun } from "../../../../../base/common/observable.js";
import { localize } from "../../../../../nls.js";
import { comparePaths } from "../../../../../base/common/comparers.js";
import { basename, dirname } from "../../../../../base/common/resources.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
const $ = DOM.$;
const MOBILE_OPEN_CHANGES_VIEW_COMMAND_ID = "sessions.mobile.openChangesView";
function toRow(change) {
  const v2Uri = change.uri;
  const displayUri = v2Uri ?? change.modifiedUri;
  const originalUri = change.originalUri;
  const modifiedUri = change.modifiedUri;
  const changeType = originalUri === void 0 ? "added" : modifiedUri === void 0 ? "deleted" : "modified";
  return {
    displayUri,
    originalUri,
    modifiedUri,
    changeType,
    added: change.insertions,
    removed: change.deletions
  };
}
function rowToDiffData(row) {
  return {
    originalURI: row.originalUri,
    modifiedURI: row.modifiedUri,
    identical: row.added === 0 && row.removed === 0,
    added: row.added,
    removed: row.removed
  };
}
function compareRows(a, b) {
  return comparePaths(a.displayUri.fsPath, b.displayUri.fsPath);
}
let MobileChangesView = class extends Disposable {
  constructor(workbenchContainer, onOpen, _instantiationService, sessionsService) {
    super();
    this.onOpen = onOpen;
    this.sessionsService = sessionsService;
    this._onDidDispose = this._register(new Emitter());
    /**
     * Fires when this view has been disposed (either externally or because
     * the user tapped Back). Used by the mobile overlay contribution to
     * clear its `MutableDisposable<MobileChangesView>` slot so it doesn't
     * keep a stale reference around — preserving the "value === undefined
     * <=> no overlay open" invariant.
     */
    this.onDidDispose = this._onDidDispose.event;
    this.viewStore = this._register(new DisposableStore());
    /**
     * Disposables that belong to the rows currently rendered in the list.
     * `renderList` runs on every reactive change to the active session
     * (potentially many times per session) — each render registers
     * per-row gesture targets and click/tap listeners. We hold those in a
     * dedicated store and `clear()` it at the top of every render so the
     * disposable count and gesture-target list don't grow unbounded.
     */
    this.rowsStore = this._register(new DisposableStore());
    const overlay = DOM.append(workbenchContainer, $("div.mobile-overlay-view"));
    this.viewStore.add(DOM.addDisposableListener(overlay, DOM.EventType.CONTEXT_MENU, (e) => e.preventDefault()));
    this.viewStore.add(toDisposable(() => overlay.remove()));
    const header = DOM.append(overlay, $("div.mobile-overlay-header"));
    const backBtn = DOM.append(header, $("button.mobile-overlay-back-btn", { type: "button" }));
    backBtn.setAttribute("aria-label", localize("changesView.back", "Back"));
    DOM.append(backBtn, $("span")).classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronLeft));
    DOM.append(backBtn, $("span.back-btn-label")).textContent = localize("changesView.backLabel", "Back");
    this.viewStore.add(Gesture.addTarget(backBtn));
    this.viewStore.add(DOM.addDisposableListener(backBtn, DOM.EventType.CLICK, () => this.dispose()));
    this.viewStore.add(DOM.addDisposableListener(backBtn, TouchEventType.Tap, () => this.dispose()));
    const info = DOM.append(header, $("div.mobile-overlay-header-info"));
    DOM.append(info, $("div.mobile-overlay-header-title")).textContent = localize("changesView.title", "Session Changes");
    this.subtitleEl = DOM.append(info, $("div.mobile-overlay-header-subtitle"));
    const body = DOM.append(overlay, $("div.mobile-overlay-body"));
    const scrollWrapper = DOM.append(body, $("div.mobile-overlay-scroll"));
    this.listContainer = DOM.append(scrollWrapper, $("div.mobile-changes-list"));
    this.emptyEl = DOM.append(body, $("div.mobile-overlay-empty-state"));
    this.emptyEl.style.display = "none";
    this.emptyEl.textContent = localize("changesView.empty", "No changes in this session yet.");
    this.viewStore.add(autorun((reader) => {
      const session = this.sessionsService.activeSession.read(reader);
      const rows = (session?.changes.read(reader) ?? []).map(toRow).sort(compareRows);
      this.renderList(rows);
    }));
  }
  renderList(rows) {
    this.rowsStore.clear();
    DOM.clearNode(this.listContainer);
    let totalAdded = 0;
    let totalRemoved = 0;
    for (const row of rows) {
      totalAdded += row.added;
      totalRemoved += row.removed;
    }
    if (rows.length === 0) {
      this.subtitleEl.textContent = "";
      this.emptyEl.style.display = "";
      this.listContainer.style.display = "none";
      return;
    }
    this.emptyEl.style.display = "none";
    this.listContainer.style.display = "";
    DOM.clearNode(this.subtitleEl);
    const fileWord = rows.length === 1 ? localize("changesView.subtitleFileSingular", "1 file") : localize("changesView.subtitleFilePlural", "{0} files", rows.length);
    DOM.append(this.subtitleEl, $("span.mobile-overlay-header-subtitle-files")).textContent = fileWord;
    DOM.append(this.subtitleEl, $("span.mobile-overlay-header-subtitle-sep")).textContent = " \xB7 ";
    DOM.append(this.subtitleEl, $("span.mobile-changes-row-added")).textContent = `+${totalAdded}`;
    DOM.append(this.subtitleEl, document.createTextNode(" "));
    DOM.append(this.subtitleEl, $("span.mobile-changes-row-removed")).textContent = `-${totalRemoved}`;
    const siblings = rows.map(rowToDiffData);
    for (let i = 0; i < rows.length; i++) {
      this.renderRow(rows[i], siblings, i);
    }
  }
  renderRow(row, siblings, index) {
    const button = DOM.append(this.listContainer, $("button.mobile-changes-row", { type: "button" }));
    button.classList.add(`change-${row.changeType}`);
    button.setAttribute("aria-label", localize(
      "changesView.rowAria",
      "{0}, {1}, +{2} -{3}",
      row.displayUri.path,
      localizeChangeType(row.changeType),
      row.added,
      row.removed
    ));
    const labelHost = DOM.append(button, $("div.mobile-changes-row-label"));
    const iconEl = DOM.append(labelHost, $("span.mobile-changes-row-icon"));
    iconEl.classList.add(...ThemeIcon.asClassNameArray(changeTypeIcon(row.changeType)));
    const textHost = DOM.append(labelHost, $("div.mobile-changes-row-text"));
    DOM.append(textHost, $("span.mobile-changes-row-filename")).textContent = basename(row.displayUri);
    const rawDir = dirname(row.displayUri).path.replace(/^\/file\/-/, "");
    if (rawDir && rawDir !== "/") {
      DOM.append(textHost, $("span.mobile-changes-row-dir")).textContent = rawDir;
    }
    const meta = DOM.append(button, $("div.mobile-changes-row-meta"));
    const pill = DOM.append(meta, $("span.mobile-changes-row-pill"));
    pill.classList.add(`change-${row.changeType}`);
    pill.textContent = changeTypeGlyph(row.changeType);
    pill.setAttribute("aria-hidden", "true");
    const counts = DOM.append(meta, $("span.mobile-changes-row-counts"));
    if (row.added > 0) {
      DOM.append(counts, $("span.mobile-changes-row-added")).textContent = `+${row.added}`;
    }
    if (row.removed > 0) {
      DOM.append(counts, $("span.mobile-changes-row-removed")).textContent = `-${row.removed}`;
    }
    this.rowsStore.add(Gesture.addTarget(button));
    const onActivate = () => this.onOpen(siblings[index], siblings, index);
    this.rowsStore.add(DOM.addDisposableListener(button, DOM.EventType.CLICK, onActivate));
    this.rowsStore.add(DOM.addDisposableListener(button, TouchEventType.Tap, onActivate));
  }
  dispose() {
    this._onDidDispose.fire();
    super.dispose();
  }
};
MobileChangesView = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ISessionsService)
], MobileChangesView);
function changeTypeGlyph(type) {
  switch (type) {
    case "added":
      return "A";
    case "modified":
      return "M";
    case "deleted":
      return "D";
  }
}
function changeTypeIcon(type) {
  switch (type) {
    case "added":
      return Codicon.diffAdded;
    case "modified":
      return Codicon.diffModified;
    case "deleted":
      return Codicon.diffRemoved;
  }
}
function localizeChangeType(type) {
  switch (type) {
    case "added":
      return localize("changesView.changeAdded", "added");
    case "modified":
      return localize("changesView.changeModified", "modified");
    case "deleted":
      return localize("changesView.changeDeleted", "deleted");
  }
}
function openMobileChangesView(instantiationService, workbenchContainer, onOpen) {
  return instantiationService.createInstance(MobileChangesView, workbenchContainer, onOpen);
}
export {
  MOBILE_OPEN_CHANGES_VIEW_COMMAND_ID,
  MobileChangesView,
  openMobileChangesView,
  rowToDiffData,
  toRow
};
