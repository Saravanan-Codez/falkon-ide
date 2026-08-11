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
import { localize } from "../../../../../nls.js";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, derived, observableFromEvent, observableSignal, observableValue, transaction } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { MultiDiffEditorInput } from "../../../multiDiffEditor/browser/multiDiffEditorInput.js";
import { MultiDiffEditorItem } from "../../../multiDiffEditor/browser/multiDiffSourceResolverService.js";
import { IChatResponseFileChangesService } from "../chatResponseFileChangesService.js";
import { IChatEditingService } from "../../common/editing/chatEditingService.js";
import { isRequestVM, isResponseVM } from "../../common/model/chatViewModel.js";
import { budgetBucketPrompts, MAX_TICKS } from "./promptBucketing.js";
const MAX_PREVIEW_LENGTH = 80;
function itemKind(item) {
  if (isRequestVM(item)) {
    return "request";
  }
  if (isResponseVM(item)) {
    return "response";
  }
  return "other";
}
const CHARS_PER_LINE = 48;
const CODE_BLOCK_UNITS = 3;
const MAX_SIGNAL = 60;
const PRIOR_PX_PER_UNIT = { request: 18, response: 20, other: 40 };
function getPromptPreview(text) {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return firstLine.length <= MAX_PREVIEW_LENGTH ? firstLine : `${firstLine.slice(0, MAX_PREVIEW_LENGTH)}\u2026`;
}
function promptsEqual(a, b) {
  return a.length === b.length && a.every((p, i) => p.requestId === b[i].requestId && p.text === b[i].text && p.timestamp === b[i].timestamp);
}
let PromptTimelineModel = class extends Disposable {
  constructor(widget, chatEditingService, chatResponseFileChangesService, editorService, instantiationService, fileService) {
    super();
    this.widget = widget;
    this.chatEditingService = chatEditingService;
    this.chatResponseFileChangesService = chatResponseFileChangesService;
    this.editorService = editorService;
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    /** All user prompts in the chat, updated as the transcript changes. */
    this._prompts = observableValue(this, []);
    /** The chat editing session for this chat, if one exists (local or agent-host). */
    this._editingSession = derived(this, (reader) => {
      const resource = this._sessionResource.read(reader);
      if (!resource) {
        return void 0;
      }
      return this.chatEditingService.editingSessionsObs.read(reader).find((s) => isEqual(s.chatSessionResource, resource));
    });
    /** Recency-bucketed ticks, capped to a fixed maximum so each keeps a >=24px slot. */
    this._baseTicks = derived(this, (reader) => {
      const prompts = this._prompts.read(reader);
      return budgetBucketPrompts(prompts, Date.now(), MAX_TICKS).map((bucket) => ({
        requestId: bucket.prompt.requestId,
        allRequestIds: bucket.prompts.map((p) => p.requestId),
        text: bucket.prompt.text,
        timestamp: bucket.prompt.timestamp,
        count: bucket.count,
        ariaLabel: bucket.count === 1 ? localize("promptTimeline.tick", "Prompt: {0}", bucket.prompt.text) : localize("promptTimeline.tickGrouped", "{0} prompts starting with: {1}", bucket.count, bucket.prompt.text)
      }));
    });
    /** Ticks decorated with per-prompt diff stats (server per-turn changeset, else editing session). */
    this._ticks = derived(this, (reader) => {
      const base = this._baseTicks.read(reader);
      return base.map((tick) => {
        const stat = this._statForRequests(tick.allRequestIds, reader);
        return stat ? { ...tick, stat } : tick;
      });
    });
    /**
     * One tick per user prompt — unbucketed and uncapped, decorated with per-prompt diff stats. The
     * gutter rail lists every prompt as its own entry (no recency bucketing/sampling), so it needs the
     * raw prompt list rather than the capped {@link ticks} the overview ruler uses.
     */
    this._promptTicks = derived(this, (reader) => {
      const prompts = this._prompts.read(reader);
      return prompts.map((prompt) => {
        const base = {
          requestId: prompt.requestId,
          allRequestIds: [prompt.requestId],
          text: prompt.text,
          timestamp: prompt.timestamp,
          count: 1,
          ariaLabel: localize("promptTimeline.tick", "Prompt: {0}", prompt.text)
        };
        const stat = this._statForRequests(base.allRequestIds, reader);
        return stat ? { ...base, stat } : base;
      });
    });
    this._activeRequestId = observableValue(this, void 0);
    /** The exact request currently scrolled to the top, unbucketed — drives the sticky header's label/position and the gutter rail's active row. */
    this._activePromptId = observableValue(this, void 0);
    /** True once the active prompt's own row has scrolled above the viewport top (drives the sticky header). */
    this._scrollPinned = observableValue(this, false);
    /** The active prompt with its 1-based position among all (unbucketed) prompts, for the sticky header. */
    this._activePrompt = derived(this, (reader) => {
      const id = this._activePromptId.read(reader);
      if (id === void 0) {
        return void 0;
      }
      const prompts = this._prompts.read(reader);
      const index = prompts.findIndex((p) => p.requestId === id);
      return index < 0 ? void 0 : { text: prompts[index].text, index: index + 1, total: prompts.length };
    });
    /** Fires when the transcript scroll offset or content height changes (drives the ruler rail). */
    this._scrollLayoutSignal = observableSignal(this);
    this._viewModelListener = this._register(new MutableDisposable());
    /** Per-item content-signal cache (id -> {version, signal}) for height estimation; version invalidates on content growth. */
    this._signalCache = /* @__PURE__ */ new Map();
    this._sessionResource = observableFromEvent(this, this.widget.onDidChangeViewModel, () => this.widget.viewModel?.sessionResource);
    this._register(this.widget.onDidChangeViewModel(() => this._bindViewModel()));
    this._register(this.widget.onDidScroll(() => {
      this._updateActive();
      this._triggerScrollLayout();
    }));
    this._register(this.widget.onDidChangeContentHeight(() => this._triggerScrollLayout()));
    this._register(autorun((reader) => {
      this._baseTicks.read(reader);
      this._updateActive();
      this._triggerScrollLayout();
    }));
    this._bindViewModel();
  }
  get ticks() {
    return this._ticks;
  }
  get promptTicks() {
    return this._promptTicks;
  }
  get activeRequestId() {
    return this._activeRequestId;
  }
  get activePromptId() {
    return this._activePromptId;
  }
  get activePinned() {
    return this._scrollPinned;
  }
  get activePrompt() {
    return this._activePrompt;
  }
  get onDidChangeScrollLayout() {
    return this._scrollLayoutSignal;
  }
  _triggerScrollLayout() {
    transaction((tx) => this._scrollLayoutSignal.trigger(tx));
  }
  /**
   * The prompts' positions for the overview-ruler rail, in an *estimated*
   * content space that stays stable while the transcript virtualizes. The rail
   * draws its own scrollbar thumb from `scrollTop`/`scrollHeight` (the transcript's
   * native scrollbar is hidden while the rail is active) so the whole lane is one
   * surface: a plain scrollbar that blooms into the prompt fan on engagement.
   *
   * The chat list's own height model (`getElementTop`/`scrollHeight`) guesses
   * every un-rendered row at one flat default height (200px). Real turns are
   * nothing like flat — prompts are short, responses tall and variable — so as
   * rows render and get measured the list's tops snap around, dragging the marks
   * with them (the "scroll jitter"). For the marks we instead build our own
   * heights: measured rows use their real `currentRenderedHeight`; un-measured
   * rows are estimated from a content signal calibrated to measured rows (see
   * `_computeAdaptiveLayout`), so marks land near their final spot immediately and
   * barely drift. Once every row is measured this estimate equals the list's real
   * layout.
   */
  getScrollLayout() {
    const layout = this._computeAdaptiveLayout();
    if (!layout) {
      return void 0;
    }
    const { items, tops, total } = layout;
    const marks = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (isRequestVM(item)) {
        marks.push({ requestId: item.id, top: tops[i] });
      }
    }
    return { marks, total, scrollTop: this.widget.scrollTop, scrollHeight: this.widget.scrollHeight, viewportHeight: this.widget.viewportHeight };
  }
  /**
   * Builds a per-item content-height model for the marks. Measured rows
   * contribute their real rendered height; un-measured rows are estimated from a
   * cheap content signal (~ rendered line count) scaled by a pixels-per-unit
   * factor *learned from the measured rows of the same kind*, so the estimate
   * calibrates to the real line height/width instead of relying on magic
   * constants. Falls back to a seed factor until a row of that kind is measured.
   */
  _computeAdaptiveLayout() {
    const items = this.widget.viewModel?.getItems();
    if (!items) {
      return void 0;
    }
    const measuredPx = { request: 0, response: 0, other: 0 };
    const measuredSignal = { request: 0, response: 0, other: 0 };
    for (const item of items) {
      const measured = item.currentRenderedHeight;
      if (measured !== void 0 && measured > 0) {
        const kind = itemKind(item);
        measuredPx[kind] += measured;
        measuredSignal[kind] += this._itemSignal(item);
      }
    }
    const pxPerUnit = (kind) => measuredSignal[kind] > 0 ? measuredPx[kind] / measuredSignal[kind] : PRIOR_PX_PER_UNIT[kind];
    const tops = [];
    let acc = 0;
    for (const item of items) {
      tops.push(acc);
      const measured = item.currentRenderedHeight;
      acc += measured !== void 0 && measured > 0 ? measured : pxPerUnit(itemKind(item)) * this._itemSignal(item);
    }
    return { items, tops, total: acc };
  }
  /**
   * A cheap, unit-less size proxy for a row (~ rendered line count), used to
   * estimate un-measured rows. Cached per item and only recomputed when the
   * content grows (responses stream), so scanning every row on each scroll stays
   * cheap even for long sessions.
   */
  _itemSignal(item) {
    if (isRequestVM(item)) {
      const cached = this._signalCache.get(item.id);
      const version = item.messageText.length;
      if (cached && cached.version === version) {
        return cached.signal;
      }
      const signal = Math.min(MAX_SIGNAL, 1 + Math.ceil(version / CHARS_PER_LINE));
      this._signalCache.set(item.id, { version, signal });
      return signal;
    }
    if (isResponseVM(item)) {
      const parts = item.response.value;
      const cached = this._signalCache.get(item.id);
      if (cached && cached.version === parts.length) {
        return cached.signal;
      }
      const text = item.response.getMarkdown();
      const codeBlocks = Math.floor((text.match(/```/g)?.length ?? 0) / 2);
      const lines = Math.ceil(text.length / CHARS_PER_LINE);
      const signal = Math.min(MAX_SIGNAL, 1 + lines + codeBlocks * CODE_BLOCK_UNITS);
      this._signalCache.set(item.id, { version: parts.length, signal });
      return signal;
    }
    return 1;
  }
  _bindViewModel() {
    this._signalCache.clear();
    this._viewModelListener.value = this.widget.viewModel?.onDidChange(() => this._recompute());
    this._recompute();
  }
  _recompute() {
    const prompts = [];
    for (const item of this.widget.viewModel?.getItems() ?? []) {
      if (isRequestVM(item)) {
        prompts.push({ requestId: item.id, text: getPromptPreview(item.messageText), timestamp: item.timestamp });
      }
    }
    if (promptsEqual(prompts, this._prompts.get())) {
      this._updateActive();
      return;
    }
    this._prompts.set(prompts, void 0);
  }
  /** Recomputes which tick maps to the prompt currently scrolled into view. */
  _updateActive() {
    const ticks = this._baseTicks.get();
    const items = this.widget.viewModel?.getItems();
    if (!items || ticks.length === 0) {
      transaction((tx) => {
        this._activeRequestId.set(void 0, tx);
        this._activePromptId.set(void 0, tx);
        this._scrollPinned.set(false, tx);
      });
      return;
    }
    const scrollTop = this.widget.scrollTop;
    const isScrolledToBottom = scrollTop + this.widget.viewportHeight >= this.widget.scrollHeight - 2;
    const threshold = 24;
    let activeRequestId;
    let activeTimestamp = 0;
    let activeTop = -1;
    if (isScrolledToBottom) {
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (isRequestVM(item)) {
          activeRequestId = item.id;
          activeTimestamp = item.timestamp;
          activeTop = this.widget.getElementTop(item) ?? -1;
          break;
        }
      }
    } else {
      for (const item of items) {
        if (isRequestVM(item)) {
          const top = this.widget.getElementTop(item);
          if (top === void 0) {
            continue;
          }
          if (top > scrollTop + threshold) {
            break;
          }
          activeRequestId = item.id;
          activeTimestamp = item.timestamp;
          activeTop = top;
        }
      }
    }
    if (activeRequestId === void 0) {
      transaction((tx) => {
        this._activeRequestId.set(ticks.at(0)?.requestId, tx);
        this._activePromptId.set(this._prompts.get().at(0)?.requestId, tx);
        this._scrollPinned.set(false, tx);
      });
      return;
    }
    let activeTick = ticks.find((t) => t.allRequestIds.includes(activeRequestId));
    if (!activeTick) {
      for (const tick of ticks) {
        if (tick.timestamp <= activeTimestamp) {
          activeTick = tick;
        } else {
          break;
        }
      }
    }
    const pinned = activeTop < scrollTop - 2;
    transaction((tx) => {
      this._activeRequestId.set((activeTick ?? ticks[ticks.length - 1]).requestId, tx);
      this._activePromptId.set(activeRequestId, tx);
      this._scrollPinned.set(pinned, tx);
    });
  }
  /** Reveals the request with the given id at the top of the transcript. */
  reveal(requestId) {
    const items = this.widget.viewModel?.getItems();
    const index = items?.findIndex((i) => isRequestVM(i) && i.id === requestId) ?? -1;
    if (items && index >= 0) {
      this.widget.reveal(items[index], 0);
    }
    const owningTick = this._baseTicks.get().find((t) => t.allRequestIds.includes(requestId));
    this._activeRequestId.set(owningTick?.requestId ?? requestId, void 0);
  }
  /**
   * Reveals the prompt the sticky header currently names (the prompt scrolled to the top). Used when the
   * header's label is activated so it jumps straight to that prompt, aligned to the top of the transcript.
   */
  revealActivePrompt() {
    const id = this._activePromptId.get();
    if (id !== void 0) {
      this.reveal(id);
    }
  }
  /**
   * Reveals the prompt `delta` positions away from the one the header names, aligned to the top of the
   * transcript like the rail and the label activation. The header then follows scroll tracking, hiding
   * once the target prompt is at the top.
   */
  navigate(delta) {
    const prompts = this._prompts.get();
    if (prompts.length === 0) {
      return;
    }
    const id = this._activePromptId.get();
    const current = id ? prompts.findIndex((p) => p.requestId === id) : 0;
    const base = current < 0 ? 0 : current;
    const target = Math.max(0, Math.min(prompts.length - 1, base + delta));
    if (target === base) {
      return;
    }
    this.reveal(prompts[target].requestId);
  }
  /** The changed files for a tick's prompts, aggregated per file (for the hover card / drill-down). */
  getRequestFiles(tick) {
    const byPath = /* @__PURE__ */ new Map();
    for (const requestId of tick.allRequestIds) {
      for (const diff of this._diffsForRequest(requestId)) {
        if (diff.identical) {
          continue;
        }
        const key = diff.modifiedURI.toString();
        const existing = byPath.get(key);
        if (existing) {
          byPath.set(key, {
            ...existing,
            diffModifiedURI: diff.modifiedSnapshotURI ?? diff.modifiedURI,
            added: existing.added + diff.added,
            removed: existing.removed + diff.removed
          });
        } else {
          byPath.set(key, {
            name: basename(diff.modifiedURI),
            originalURI: diff.originalURI,
            modifiedURI: diff.modifiedURI,
            diffModifiedURI: diff.modifiedSnapshotURI ?? diff.modifiedURI,
            added: diff.added,
            removed: diff.removed
          });
        }
      }
    }
    return [...byPath.values()];
  }
  /**
   * Opens the per-prompt changes as a multi-file diff. When a specific file is
   * given (a file row in the card), the same multi-diff is opened but revealed
   * at that file, so per-file and whole-prompt review share one experience.
   */
  async reviewChanges(tick, file) {
    const files = this.getRequestFiles(tick);
    if (files.length === 0) {
      return;
    }
    const items = [];
    let revealResource;
    for (const f of files) {
      const [originalURI, modifiedURI] = await this._readableSides(f);
      if (!originalURI && !modifiedURI) {
        continue;
      }
      items.push(new MultiDiffEditorItem(originalURI, modifiedURI, f.modifiedURI));
      if (file && isEqual(f.modifiedURI, file)) {
        revealResource = { original: originalURI, modified: modifiedURI };
      }
    }
    if (items.length === 0) {
      return;
    }
    const source = URI.parse(`multi-diff-editor:prompt-timeline/${generateUuid()}`);
    const input = this.instantiationService.createInstance(
      MultiDiffEditorInput,
      source,
      localize("promptTimeline.reviewTitle", "Changes \xB7 {0}", tick.text),
      items,
      false
    );
    const options = revealResource ? { viewState: { revealData: { resource: revealResource } } } : void 0;
    await this.editorService.openEditor(input, options);
  }
  /**
   * Resolves which sides of a file diff can actually be read. Prefers the frozen
   * before/after snapshots so only this turn's changes show, but the agent-host
   * checkpoint blobs backing them can be missing (an added file's original, or a
   * pruned/restored session where whole checkpoints are gone). The modified side
   * then falls back to the live working file so review still opens with the best
   * available fidelity; an unreadable side is dropped so the file still renders
   * as a pure add/delete instead of crashing the diff editor.
   */
  async _readableSides(file) {
    const hasFrozenOriginal = !isEqual(file.originalURI, file.modifiedURI);
    const hasFrozenModified = !isEqual(file.diffModifiedURI, file.modifiedURI);
    const [frozenOriginalReadable, frozenModifiedReadable, liveModifiedReadable] = await Promise.all([
      hasFrozenOriginal ? this._canRead(file.originalURI) : Promise.resolve(false),
      hasFrozenModified ? this._canRead(file.diffModifiedURI) : Promise.resolve(false),
      this._canRead(file.modifiedURI)
    ]);
    const modified = frozenModifiedReadable ? file.diffModifiedURI : liveModifiedReadable ? file.modifiedURI : void 0;
    return [frozenOriginalReadable ? file.originalURI : void 0, modified];
  }
  async _canRead(resource) {
    try {
      await this.fileService.readFile(resource, { length: 1 });
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Per-request file diffs, preferring the session type's authoritative
   * provider (agent-host sessions expose a server-computed per-turn changeset
   * that survives reload), and falling back to the chat editing session.
   */
  _diffsForRequest(requestId, reader) {
    const resource = reader ? this._sessionResource.read(reader) : this._sessionResource.get();
    if (resource) {
      const provided = this.chatResponseFileChangesService.getChangesForRequest(resource, requestId);
      if (provided) {
        return reader ? provided.read(reader) : provided.get();
      }
    }
    const session = reader ? this._editingSession.read(reader) : this._editingSession.get();
    if (session) {
      const obs = session.getDiffsForFilesInRequest(requestId);
      return reader ? obs.read(reader) : obs.get();
    }
    return [];
  }
  /** Sums the diff stats across the given requests, or undefined when nothing changed. */
  _statForRequests(requestIds, reader) {
    let added = 0;
    let removed = 0;
    const files = /* @__PURE__ */ new Set();
    for (const requestId of requestIds) {
      for (const diff of this._diffsForRequest(requestId, reader)) {
        if (diff.identical) {
          continue;
        }
        added += diff.added;
        removed += diff.removed;
        files.add(diff.modifiedURI.toString());
      }
    }
    return files.size > 0 ? { added, removed, fileCount: files.size } : void 0;
  }
};
PromptTimelineModel = __decorateClass([
  __decorateParam(1, IChatEditingService),
  __decorateParam(2, IChatResponseFileChangesService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IFileService)
], PromptTimelineModel);
export {
  PromptTimelineModel
};
