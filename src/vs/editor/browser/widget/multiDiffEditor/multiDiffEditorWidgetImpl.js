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
import { getWindow, h, scheduleAtNextAnimationFrame } from "../../../../base/browser/dom.js";
import { SmoothScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { compareBy, numberComparator } from "../../../../base/common/arrays.js";
import { findFirstMax } from "../../../../base/common/arraysFind.js";
import { BugIndicatingError } from "../../../../base/common/errors.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived, disposableObservableValue, globalTransaction, observableFromEvent, observableValue, transaction } from "../../../../base/common/observable.js";
import { Scrollable, ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { localize } from "../../../../nls.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { OffsetRange } from "../../../common/core/ranges/offsetRange.js";
import { Selection } from "../../../common/core/selection.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { ObservableElementSizeObserver } from "../diffEditor/utils.js";
import { DiffEditorItemTemplate, TemplateData } from "./diffEditorItemTemplate.js";
import { ObjectPool } from "./objectPool.js";
import "./style.css";
let MultiDiffEditorWidgetImpl = class extends Disposable {
  constructor(_element, _dimension, _viewModel, _workbenchUIElementFactory, _renderSideBySide, _diffEditorOptions, _parentContextKeyService, _parentInstantiationService) {
    super();
    this._element = _element;
    this._dimension = _dimension;
    this._viewModel = _viewModel;
    this._workbenchUIElementFactory = _workbenchUIElementFactory;
    this._renderSideBySide = _renderSideBySide;
    this._diffEditorOptions = _diffEditorOptions;
    this._parentContextKeyService = _parentContextKeyService;
    this._parentInstantiationService = _parentInstantiationService;
    /**
     * When `true`, the automatic "select the first change" initialization that
     * runs once the view model finishes loading does not move keyboard focus
     * into the editor. Driven by {@link setPreserveFocusOnLoad} so a
     * `preserveFocus` open (e.g. restored in the background or on a session
     * switch) does not steal focus, while a normal user-initiated open does.
     */
    this._preserveFocusOnLoad = false;
    this._scrollableElements = h("div.scrollContent", [
      h("div@content", {
        style: {
          overflow: "hidden"
        }
      }),
      h("div.monaco-editor@overflowWidgetsDomNode", {})
    ]);
    this._scrollable = this._register(new Scrollable({
      forceIntegerValues: false,
      scheduleAtNextAnimationFrame: (cb) => scheduleAtNextAnimationFrame(getWindow(this._element), cb),
      smoothScrollDuration: 100
    }));
    this._scrollableElement = this._register(new SmoothScrollableElement(this._scrollableElements.root, {
      vertical: ScrollbarVisibility.Auto,
      horizontal: ScrollbarVisibility.Auto,
      useShadows: false
    }, this._scrollable));
    this._elements = h("div.monaco-component.multiDiffEditor", {}, [
      h("div", {}, [this._scrollableElement.getDomNode()]),
      h("div.placeholder@placeholder", {}, [h("div")])
    ]);
    this._sizeObserver = this._register(new ObservableElementSizeObserver(this._element, void 0));
    this._optionsOverride = derived(this, (reader) => {
      const renderSideBySide = this._renderSideBySide.read(reader);
      const options = renderSideBySide === void 0 ? {} : { renderSideBySide, useInlineViewWhenSpaceIsLimited: false };
      return { ...this._diffEditorOptions, ...options };
    });
    this._objectPool = this._register(new ObjectPool((data) => {
      const template = this._instantiationService.createInstance(
        DiffEditorItemTemplate,
        this._scrollableElements.content,
        this._scrollableElements.overflowWidgetsDomNode,
        this._workbenchUIElementFactory,
        this._optionsOverride
      );
      template.setData(data);
      return template;
    }));
    this.scrollTop = observableFromEvent(this, this._scrollableElement.onScroll, () => (
      /** @description scrollTop */
      this._scrollableElement.getScrollPosition().scrollTop
    ));
    this.scrollLeft = observableFromEvent(this, this._scrollableElement.onScroll, () => (
      /** @description scrollLeft */
      this._scrollableElement.getScrollPosition().scrollLeft
    ));
    this._viewItemsInfo = derived(
      this,
      (reader) => {
        const vm = this._viewModel.read(reader);
        if (!vm) {
          return { items: [], getItem: (_d) => {
            throw new BugIndicatingError();
          } };
        }
        const viewModels = vm.items.read(reader);
        const map = /* @__PURE__ */ new Map();
        const items = viewModels.map((d) => {
          const item = reader.store.add(new VirtualizedViewItem(d, this._objectPool, this.scrollLeft, (delta) => {
            this._scrollableElement.setScrollPosition({ scrollTop: this._scrollableElement.getScrollPosition().scrollTop + delta });
          }));
          const data = this._lastDocStates?.[item.getKey()];
          if (data) {
            transaction((tx) => {
              item.setViewState(data, tx);
            });
          }
          map.set(d, item);
          return item;
        });
        return { items, getItem: (d) => map.get(d) };
      }
    );
    this._viewItems = this._viewItemsInfo.map(this, (items) => items.items);
    this._spaceBetweenPx = 0;
    this._totalHeight = this._viewItems.map(this, (items, reader) => items.reduce((r, i) => r + i.contentHeight.read(reader) + this._spaceBetweenPx, 0));
    this.activeControl = derived(this, (reader) => {
      const activeDiffItem = this._viewModel.read(reader)?.activeDiffItem.read(reader);
      if (!activeDiffItem) {
        return void 0;
      }
      const viewItem = this._viewItemsInfo.read(reader).getItem(activeDiffItem);
      return viewItem.template.read(reader)?.editor;
    });
    this._contextKeyService = this._register(this._parentContextKeyService.createScoped(this._element));
    this._instantiationService = this._register(this._parentInstantiationService.createChild(
      new ServiceCollection([IContextKeyService, this._contextKeyService])
    ));
    this._contextKeyService.createKey(EditorContextKeys.inMultiDiffEditor.key, true);
    this._lastDocStates = {};
    this._register(autorunWithStore((reader, store) => {
      const viewModel = this._viewModel.read(reader);
      if (viewModel && viewModel.contextKeys) {
        for (const [key, value] of Object.entries(viewModel.contextKeys)) {
          const contextKey = this._contextKeyService.createKey(key, void 0);
          contextKey.set(value);
          store.add(toDisposable(() => contextKey.reset()));
        }
      }
    }));
    const ctxAllCollapsed = this._parentContextKeyService.createKey(EditorContextKeys.multiDiffEditorAllCollapsed.key, false);
    this._register(autorun((reader) => {
      const viewModel = this._viewModel.read(reader);
      if (viewModel) {
        const allCollapsed = viewModel.items.read(reader).every((item) => item.collapsed.read(reader));
        ctxAllCollapsed.set(allCollapsed);
      }
    }));
    const ctxRenderSideBySide = this._parentContextKeyService.createKey(EditorContextKeys.multiDiffEditorRenderSideBySide.key, true);
    this._register(autorun((reader) => {
      const renderSideBySide = this._renderSideBySide.read(reader);
      if (renderSideBySide !== void 0) {
        ctxRenderSideBySide.set(renderSideBySide);
      }
    }));
    this._register(autorun((reader) => {
      const dimension = this._dimension.read(reader);
      this._sizeObserver.observe(dimension);
    }));
    const placeholderMessage = derived((reader) => {
      const items = this._viewItems.read(reader);
      if (items.length > 0) {
        return void 0;
      }
      const vm = this._viewModel.read(reader);
      return !vm || vm.isLoading.read(reader) ? localize("loading", "Loading...") : localize("noChangedFiles", "No Changed Files");
    });
    this._register(autorun((reader) => {
      const message = placeholderMessage.read(reader);
      this._elements.placeholder.innerText = message ?? "";
      this._elements.placeholder.classList.toggle("visible", !!message);
    }));
    this._scrollableElements.content.style.position = "relative";
    this._register(autorun((reader) => {
      const height = this._sizeObserver.height.read(reader);
      this._scrollableElements.root.style.height = `${height}px`;
      const totalHeight = this._totalHeight.read(reader);
      this._scrollableElements.content.style.height = `${totalHeight}px`;
      const width = this._sizeObserver.width.read(reader);
      let scrollWidth = width;
      const viewItems = this._viewItems.read(reader);
      const max = findFirstMax(viewItems, compareBy((i) => i.maxScroll.read(reader).maxScroll, numberComparator));
      if (max) {
        const maxScroll = max.maxScroll.read(reader);
        scrollWidth = width + maxScroll.maxScroll;
      }
      this._scrollableElement.setScrollDimensions({
        width,
        height,
        scrollHeight: totalHeight,
        scrollWidth
      });
      this._applyPendingScrollState();
    }));
    _element.replaceChildren(this._elements.root);
    this._register(toDisposable(() => {
      _element.replaceChildren();
    }));
    this._register(autorun((reader) => {
      const viewModel = this._viewModel.read(reader);
      if (!viewModel) {
        return;
      }
      if (!viewModel.isLoading.read(reader)) {
        const items = viewModel.items.read(reader);
        if (items.length === 0) {
          return;
        }
        const activeDiffItem = viewModel.activeDiffItem.read(reader);
        if (activeDiffItem) {
          return;
        }
        if (this._restorePendingActiveDiffItem(viewModel, items)) {
          return;
        }
        this._navigateToChange("next", !this._preserveFocusOnLoad);
      }
    }));
    this._register(this._register(autorun((reader) => {
      globalTransaction((tx) => {
        this.render(reader);
      });
    })));
  }
  setScrollState(scrollState) {
    this._pendingScrollState = scrollState;
    this._applyPendingScrollState();
  }
  /**
   * Applies a restored scroll offset once the scrollable dimensions can
   * accommodate it; retries on subsequent dimension updates until it sticks (so
   * a fresh/reloaded widget whose content height is not yet known does not clamp
   * the offset to 0). Consumed once it lands.
   */
  _applyPendingScrollState() {
    const pending = this._pendingScrollState;
    if (!pending) {
      return;
    }
    this._scrollableElement.setScrollPosition({ scrollLeft: pending.left, scrollTop: pending.top });
    const applied = this._scrollableElement.getScrollPosition();
    const topLanded = pending.top === void 0 || applied.scrollTop >= pending.top;
    const leftLanded = pending.left === void 0 || applied.scrollLeft >= pending.left;
    if (topLanded && leftLanded) {
      this._pendingScrollState = void 0;
    }
  }
  /**
   * Clears any pending restoration state (documents, active item, scroll). Called
   * when a new model is installed without a view state, so it cannot inherit the
   * previous model's state for overlapping diff keys.
   */
  clearPendingRestorationState() {
    this._lastDocStates = void 0;
    this._lastActiveDiffItemKey = void 0;
    this._pendingScrollState = void 0;
  }
  /**
   * Controls whether the automatic first-change selection that runs once the
   * view model finishes loading preserves focus instead of moving it into the
   * editor. Set to `true` for `preserveFocus` opens so focus is not stolen
   * from elsewhere.
   */
  setPreserveFocusOnLoad(preserveFocus) {
    this._preserveFocusOnLoad = preserveFocus;
  }
  getRootElement() {
    return this._elements.root;
  }
  getContextKeyService() {
    return this._contextKeyService;
  }
  getScopedInstantiationService() {
    return this._instantiationService;
  }
  reveal(resource, options) {
    const viewItems = this._viewItems.get();
    const index = viewItems.findIndex(
      (item) => item.viewModel.originalUri?.toString() === resource.original?.toString() && item.viewModel.modifiedUri?.toString() === resource.modified?.toString()
    );
    if (index === -1) {
      throw new BugIndicatingError("Resource not found in diff editor");
    }
    const viewItem = viewItems[index];
    this._viewModel.get().activeDiffItem.setCache(viewItem.viewModel, void 0);
    let scrollTop = 0;
    for (let i = 0; i < index; i++) {
      scrollTop += viewItems[i].contentHeight.get() + this._spaceBetweenPx;
    }
    this._scrollableElement.setScrollPosition({ scrollTop });
    const diffEditor = viewItem.template.get()?.editor;
    const editor = "original" in resource ? diffEditor?.getOriginalEditor() : diffEditor?.getModifiedEditor();
    if (editor && options?.range) {
      editor.revealRangeInCenter(options.range);
      highlightRange(editor, options.range);
    }
  }
  getViewState() {
    return {
      scrollState: {
        top: this.scrollTop.get(),
        left: this.scrollLeft.get()
      },
      docStates: Object.fromEntries(this._viewItems.get().map((i) => [i.getKey(), i.getViewState()])),
      activeDiffItemKey: this._viewModel.get()?.activeDiffItem.get()?.getKey()
    };
  }
  setViewState(viewState, tx) {
    this.setScrollState(viewState.scrollState);
    this._lastDocStates = viewState.docStates;
    this._lastActiveDiffItemKey = viewState.activeDiffItemKey;
    const applyDocStates = (tx2) => {
      if (viewState.docStates) {
        for (const i of this._viewItems.get()) {
          const state = viewState.docStates[i.getKey()];
          if (state) {
            i.setViewState(state, tx2);
          }
        }
      }
    };
    if (tx) {
      applyDocStates(tx);
    } else {
      transaction(applyDocStates);
    }
    const viewModel = this._viewModel.get();
    if (viewModel) {
      this._restorePendingActiveDiffItem(viewModel, viewModel.items.get());
    }
  }
  /**
   * Restores the persisted active diff item (if any) onto the view model, so the
   * automatic first-change navigation is skipped. On an explicit (non-preserve-focus)
   * open it also moves focus into the restored item's editor, mirroring the
   * first-change navigation it replaces. Returns whether it was applied.
   */
  _restorePendingActiveDiffItem(viewModel, items) {
    const key = this._lastActiveDiffItemKey;
    if (key === void 0 || items.length === 0) {
      return false;
    }
    this._lastActiveDiffItemKey = void 0;
    const target = items.find((i) => i.getKey() === key);
    if (!target) {
      return false;
    }
    viewModel.activeDiffItem.setCache(target, void 0);
    if (!this._preserveFocusOnLoad) {
      this._viewItemsInfo.get().getItem(target).template.get()?.editor.focus();
    }
    return true;
  }
  findDocumentDiffItem(resource) {
    const item = this._viewItems.get().find(
      (v) => v.viewModel.diffEditorViewModel.model.modified.uri.toString() === resource.toString() || v.viewModel.diffEditorViewModel.model.original.uri.toString() === resource.toString()
    );
    return item?.viewModel.documentDiffItem;
  }
  tryGetCodeEditor(resource) {
    const item = this._viewItems.get().find(
      (v) => v.viewModel.diffEditorViewModel.model.modified.uri.toString() === resource.toString() || v.viewModel.diffEditorViewModel.model.original.uri.toString() === resource.toString()
    );
    const editor = item?.template.get()?.editor;
    if (!editor) {
      return void 0;
    }
    if (item.viewModel.diffEditorViewModel.model.modified.uri.toString() === resource.toString()) {
      return { diffEditor: editor, editor: editor.getModifiedEditor() };
    } else {
      return { diffEditor: editor, editor: editor.getOriginalEditor() };
    }
  }
  goToNextChange() {
    this._navigateToChange("next");
  }
  goToPreviousChange() {
    this._navigateToChange("previous");
  }
  _navigateToChange(direction, focusEditor = true) {
    const viewItems = this._viewItems.get();
    if (viewItems.length === 0) {
      return;
    }
    const activeViewModel = this._viewModel.get()?.activeDiffItem.get();
    const currentIndex = activeViewModel ? viewItems.findIndex((v) => v.viewModel === activeViewModel) : -1;
    if (currentIndex === -1) {
      this._goToFile(0, "first", focusEditor);
      return;
    }
    const currentItem = viewItems[currentIndex];
    if (currentItem.viewModel.collapsed.get()) {
      currentItem.viewModel.collapsed.set(false, void 0);
    }
    const editor = currentItem.template.get()?.editor;
    if (editor?.getDiffComputationResult()?.changes2?.length) {
      const pos = editor.getModifiedEditor().getPosition()?.lineNumber || 1;
      const changes = editor.getDiffComputationResult().changes2;
      const hasNext = direction === "next" ? changes.some((c) => c.modified.startLineNumber > pos) : changes.some((c) => c.modified.endLineNumberExclusive <= pos);
      if (hasNext) {
        editor.goToDiff(direction);
        return;
      }
    }
    const nextIndex = (currentIndex + (direction === "next" ? 1 : -1) + viewItems.length) % viewItems.length;
    this._goToFile(nextIndex, direction === "next" ? "first" : "last", focusEditor);
  }
  _goToFile(index, position, focusEditor = true) {
    const item = this._viewItems.get()[index];
    if (item.viewModel.collapsed.get()) {
      item.viewModel.collapsed.set(false, void 0);
    }
    this.reveal({ original: item.viewModel.originalUri, modified: item.viewModel.modifiedUri });
    const editor = item.template.get()?.editor;
    if (editor?.getDiffComputationResult()?.changes2?.length) {
      if (position === "first") {
        editor.revealFirstDiff();
      } else {
        const lastChange = editor.getDiffComputationResult().changes2.at(-1);
        const modifiedEditor = editor.getModifiedEditor();
        modifiedEditor.setPosition({ lineNumber: lastChange.modified.startLineNumber, column: 1 });
        modifiedEditor.revealLineInCenter(lastChange.modified.startLineNumber);
      }
    }
    if (focusEditor) {
      editor?.focus();
    }
  }
  render(reader) {
    const scrollTop = this.scrollTop.read(reader);
    let contentScrollOffsetToScrollOffset = 0;
    let itemHeightSumBefore = 0;
    let itemContentHeightSumBefore = 0;
    const viewPortHeight = this._sizeObserver.height.read(reader);
    const contentViewPort = OffsetRange.ofStartAndLength(scrollTop, viewPortHeight);
    const width = this._sizeObserver.width.read(reader);
    for (const v of this._viewItems.read(reader)) {
      const itemContentHeight = v.contentHeight.read(reader);
      const itemHeight = Math.min(itemContentHeight, viewPortHeight);
      const itemRange = OffsetRange.ofStartAndLength(itemHeightSumBefore, itemHeight);
      const itemContentRange = OffsetRange.ofStartAndLength(itemContentHeightSumBefore, itemContentHeight);
      if (itemContentRange.isBefore(contentViewPort)) {
        contentScrollOffsetToScrollOffset -= itemContentHeight - itemHeight;
        v.hide();
      } else if (itemContentRange.isAfter(contentViewPort)) {
        v.hide();
      } else {
        const scroll = Math.max(0, Math.min(contentViewPort.start - itemContentRange.start, itemContentHeight - itemHeight));
        contentScrollOffsetToScrollOffset -= scroll;
        const viewPort = OffsetRange.ofStartAndLength(scrollTop + contentScrollOffsetToScrollOffset, viewPortHeight);
        v.render(itemRange, scroll, width, viewPort);
      }
      itemHeightSumBefore += itemHeight + this._spaceBetweenPx;
      itemContentHeightSumBefore += itemContentHeight + this._spaceBetweenPx;
    }
    this._scrollableElements.content.style.transform = `translateY(${-(scrollTop + contentScrollOffsetToScrollOffset)}px)`;
  }
};
MultiDiffEditorWidgetImpl = __decorateClass([
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IInstantiationService)
], MultiDiffEditorWidgetImpl);
function highlightRange(targetEditor, range) {
  const modelNow = targetEditor.getModel();
  const decorations = targetEditor.createDecorationsCollection([{ range, options: { description: "symbol-navigate-action-highlight", className: "symbolHighlight" } }]);
  setTimeout(() => {
    if (targetEditor.getModel() === modelNow) {
      decorations.clear();
    }
  }, 350);
}
class VirtualizedViewItem extends Disposable {
  constructor(viewModel, _objectPool, _scrollLeft, _deltaScrollVertical) {
    super();
    this.viewModel = viewModel;
    this._objectPool = _objectPool;
    this._scrollLeft = _scrollLeft;
    this._deltaScrollVertical = _deltaScrollVertical;
    this._templateRef = this._register(disposableObservableValue(this, void 0));
    this.contentHeight = derived(
      this,
      (reader) => this._templateRef.read(reader)?.object.contentHeight?.read(reader) ?? this.viewModel.lastTemplateData.read(reader).contentHeight
    );
    this.maxScroll = derived(this, (reader) => this._templateRef.read(reader)?.object.maxScroll.read(reader) ?? { maxScroll: 0, scrollWidth: 0 });
    this.template = derived(this, (reader) => this._templateRef.read(reader)?.object);
    this._isHidden = observableValue(this, false);
    this._isFocused = derived(this, (reader) => this.template.read(reader)?.isFocused.read(reader) ?? false);
    this.viewModel.setIsFocused(this._isFocused, void 0);
    this._register(autorun((reader) => {
      const scrollLeft = this._scrollLeft.read(reader);
      this._templateRef.read(reader)?.object.setScrollLeft(scrollLeft);
    }));
    this._register(autorun((reader) => {
      const ref = this._templateRef.read(reader);
      if (!ref) {
        return;
      }
      const isHidden = this._isHidden.read(reader);
      if (!isHidden) {
        return;
      }
      const isFocused = ref.object.isFocused.read(reader);
      if (isFocused) {
        return;
      }
      this._clear();
    }));
  }
  dispose() {
    this._clear();
    super.dispose();
  }
  toString() {
    return `VirtualViewItem(${this.viewModel.documentDiffItem.modified?.uri.toString()})`;
  }
  getKey() {
    return this.viewModel.getKey();
  }
  getViewState() {
    transaction((tx) => {
      this._updateTemplateData(tx);
    });
    return {
      collapsed: this.viewModel.collapsed.get(),
      selections: this.viewModel.lastTemplateData.get().selections
    };
  }
  setViewState(viewState, tx) {
    this.viewModel.collapsed.set(viewState.collapsed, tx);
    this._updateTemplateData(tx);
    const data = this.viewModel.lastTemplateData.get();
    const selections = viewState.selections?.map(Selection.liftSelection);
    this.viewModel.lastTemplateData.set({
      ...data,
      selections
    }, tx);
    const ref = this._templateRef.get();
    if (ref) {
      if (selections) {
        ref.object.editor.setSelections(selections);
      }
    }
  }
  _updateTemplateData(tx) {
    const ref = this._templateRef.get();
    if (!ref) {
      return;
    }
    this.viewModel.lastTemplateData.set({
      contentHeight: ref.object.contentHeight.get(),
      selections: ref.object.editor.getSelections() ?? void 0
    }, tx);
  }
  _clear() {
    const ref = this._templateRef.get();
    if (!ref) {
      return;
    }
    transaction((tx) => {
      this._updateTemplateData(tx);
      ref.object.hide();
      this._templateRef.set(void 0, tx);
    });
  }
  hide() {
    this._isHidden.set(true, void 0);
  }
  render(verticalSpace, offset, width, viewPort) {
    this._isHidden.set(false, void 0);
    let ref = this._templateRef.get();
    if (!ref) {
      ref = this._objectPool.getUnusedObj(new TemplateData(this.viewModel, this._deltaScrollVertical));
      this._templateRef.set(ref, void 0);
      const selections = this.viewModel.lastTemplateData.get().selections;
      if (selections) {
        ref.object.editor.setSelections(selections);
      }
    }
    ref.object.render(verticalSpace, width, offset, viewPort);
  }
}
export {
  MultiDiffEditorWidgetImpl
};
