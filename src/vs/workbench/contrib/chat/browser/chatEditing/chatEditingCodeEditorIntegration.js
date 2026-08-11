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
import "./media/chatEditorController.css";
import { getTotalWidth } from "../../../../../base/browser/dom.js";
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore, dispose, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, constObservable, derived, observableFromEvent, observableValue } from "../../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { themeColorFromId } from "../../../../../base/common/themables.js";
import { MouseTargetType } from "../../../../../editor/browser/editorBrowser.js";
import { observableCodeEditor } from "../../../../../editor/browser/observableCodeEditor.js";
import { AccessibleDiffViewer } from "../../../../../editor/browser/widget/diffEditor/components/accessibleDiffViewer.js";
import { LineSource, renderLines, RenderOptions } from "../../../../../editor/browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js";
import { diffAddDecoration, diffDeleteDecoration, diffWholeLineAddDecoration } from "../../../../../editor/browser/widget/diffEditor/registrations.contribution.js";
import { EditorOption } from "../../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { LineRange } from "../../../../../editor/common/core/ranges/lineRange.js";
import { Selection } from "../../../../../editor/common/core/selection.js";
import { MinimapPosition, OverviewRulerLane, TrackedRangeStickiness } from "../../../../../editor/common/model.js";
import { ModelDecorationOptions } from "../../../../../editor/common/model/textModel.js";
import { InlineDecoration, InlineDecorationType } from "../../../../../editor/common/viewModel/inlineDecorations.js";
import { localize } from "../../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { TextEditorSelectionRevealType } from "../../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { EditorsOrder, isDiffEditorInput } from "../../../../common/editor.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { minimapGutterAddedBackground, minimapGutterDeletedBackground, minimapGutterModifiedBackground, overviewRulerAddedForeground, overviewRulerDeletedForeground, overviewRulerModifiedForeground } from "../../../scm/common/quickDiff.js";
import { IChatEditingService, ModifiedFileEntryState } from "../../common/editing/chatEditingService.js";
import { isTextDiffEditorForEntry } from "./chatEditing.js";
import { ActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { ctxCursorInChangeRange } from "./chatEditingEditorContextKeys.js";
import { LinkedList } from "../../../../../base/common/linkedList.js";
import { ChatEditingExplanationWidgetManager } from "./chatEditingExplanationWidget.js";
import { IChatEditingExplanationModelManager } from "./chatEditingExplanationModelManager.js";
import { IChatWidgetService } from "../chat.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
class ObjectPool {
  constructor() {
    this._free = new LinkedList();
  }
  dispose() {
    dispose(this._free);
  }
  get() {
    return this._free.shift();
  }
  putBack(obj) {
    this._free.push(obj);
  }
  get free() {
    return this._free;
  }
}
let ChatEditingCodeEditorIntegration = class {
  constructor(_entry, _editor, documentDiffInfo, renderDiffImmediately, _editorService, _accessibilitySignalsService, contextKeyService, instantiationService, _chatEditingService, _explanationModelManager, _chatWidgetService, _viewsService) {
    this._entry = _entry;
    this._editor = _editor;
    this._editorService = _editorService;
    this._accessibilitySignalsService = _accessibilitySignalsService;
    this._explanationModelManager = _explanationModelManager;
    this._chatWidgetService = _chatWidgetService;
    this._viewsService = _viewsService;
    this._currentIndex = observableValue(this, -1);
    this.currentIndex = this._currentIndex;
    this._store = new DisposableStore();
    this._diffHunksRenderStore = this._store.add(new DisposableStore());
    this._diffHunkWidgetPool = this._store.add(new ObjectPool());
    this._diffHunkWidgets = [];
    this._viewZones = [];
    this._accessibleDiffViewVisible = observableValue(this, false);
    this._diffLineDecorations = _editor.createDecorationsCollection();
    const codeEditorObs = observableCodeEditor(_editor);
    this._diffLineDecorations = this._editor.createDecorationsCollection();
    this._diffVisualDecorations = this._editor.createDecorationsCollection();
    this._store.add(new ChatEditingExplanationWidgetManager(
      this._editor,
      this._chatWidgetService,
      this._viewsService,
      this._explanationModelManager,
      this._entry.modifiedURI
    ));
    const enabledObs = derived((r) => {
      if (!isEqual(codeEditorObs.model.read(r)?.uri, documentDiffInfo.read(r).modifiedModel.uri)) {
        return false;
      }
      if (this._editor.getOption(EditorOption.inDiffEditor) && !instantiationService.invokeFunction(isTextDiffEditorForEntry, _entry, this._editor)) {
        return false;
      }
      return true;
    });
    this._store.add(autorun((r) => {
      if (!enabledObs.read(r)) {
        this._diffLineDecorations.clear();
        return;
      }
      const data = [];
      const diff = documentDiffInfo.read(r);
      for (const diffEntry of diff.changes) {
        data.push({
          range: diffEntry.modified.toInclusiveRange() ?? new Range(diffEntry.modified.startLineNumber, 1, diffEntry.modified.startLineNumber, Number.MAX_SAFE_INTEGER),
          options: ChatEditingCodeEditorIntegration._diffLineDecorationData
        });
      }
      this._diffLineDecorations.set(data);
    }));
    let lastModifyingRequestId;
    this._store.add(autorun((r) => {
      if (enabledObs.read(r) && !_entry.isCurrentlyBeingModifiedBy.read(r) && lastModifyingRequestId !== _entry.lastModifyingRequestId && !documentDiffInfo.read(r).identical) {
        lastModifyingRequestId = _entry.lastModifyingRequestId;
        const position = _editor.getPosition() ?? new Position(1, 1);
        const ranges = this._diffLineDecorations.getRanges();
        let initialIndex = ranges.findIndex((r2) => r2.containsPosition(position));
        if (initialIndex < 0) {
          initialIndex = 0;
          for (; initialIndex < ranges.length - 1; initialIndex++) {
            const range = ranges[initialIndex];
            if (range.endLineNumber >= position.lineNumber) {
              break;
            }
          }
        }
        this._currentIndex.set(initialIndex, void 0);
        _editor.revealRange(ranges[initialIndex]);
      }
    }));
    this._store.add(autorun((r) => {
      if (!enabledObs.read(r)) {
        this._clearDiffRendering();
        return;
      }
      if (!_entry.isCurrentlyBeingModifiedBy.read(r) || renderDiffImmediately) {
        const isDiffEditor = this._editor.getOption(EditorOption.inDiffEditor);
        codeEditorObs.getOption(EditorOption.fontInfo).read(r);
        codeEditorObs.getOption(EditorOption.lineHeight).read(r);
        const reviewMode = _entry.reviewMode.read(r);
        const diff = documentDiffInfo.read(r);
        this._updateDiffRendering(diff, reviewMode, isDiffEditor);
      }
    }));
    const _ctxCursorInChangeRange = ctxCursorInChangeRange.bindTo(contextKeyService);
    this._store.add(autorun((r) => {
      const position = codeEditorObs.positions.read(r)?.at(0);
      if (!position || !enabledObs.read(r)) {
        _ctxCursorInChangeRange.reset();
        return;
      }
      const diff = documentDiffInfo.read(r);
      const changeAtCursor = diff.changes.find((m) => m.modified.contains(position.lineNumber) || m.modified.isEmpty && m.modified.startLineNumber === position.lineNumber);
      _ctxCursorInChangeRange.set(!!changeAtCursor);
      if (changeAtCursor) {
        let signal;
        if (changeAtCursor.modified.isEmpty) {
          signal = AccessibilitySignal.diffLineDeleted;
        } else if (changeAtCursor.original.isEmpty) {
          signal = AccessibilitySignal.diffLineInserted;
        } else {
          signal = AccessibilitySignal.diffLineModified;
        }
        this._accessibilitySignalsService.playSignal(signal, { source: "chatEditingEditor.cursorPositionChanged" });
      }
    }));
    this._store.add(autorun((r) => {
      const visible = this._accessibleDiffViewVisible.read(r);
      if (!visible || !enabledObs.read(r)) {
        return;
      }
      const accessibleDiffWidget = new AccessibleDiffViewContainer();
      _editor.addOverlayWidget(accessibleDiffWidget);
      r.store.add(toDisposable(() => _editor.removeOverlayWidget(accessibleDiffWidget)));
      r.store.add(instantiationService.createInstance(
        AccessibleDiffViewer,
        accessibleDiffWidget.getDomNode(),
        enabledObs,
        (visible2, tx) => this._accessibleDiffViewVisible.set(visible2, tx),
        constObservable(true),
        codeEditorObs.layoutInfo.map((v, r2) => v.width),
        codeEditorObs.layoutInfo.map((v, r2) => v.height),
        documentDiffInfo.map((diff) => diff.changes.slice()),
        instantiationService.createInstance(AccessibleDiffViewerModel, documentDiffInfo, _editor)
      ));
    }));
    let actualOptions;
    const restoreActualOptions = () => {
      if (actualOptions !== void 0) {
        this._editor.updateOptions(actualOptions);
        actualOptions = void 0;
      }
    };
    this._store.add(toDisposable(restoreActualOptions));
    const renderAsBeingModified = derived(this, (r) => {
      return enabledObs.read(r) && Boolean(_entry.isCurrentlyBeingModifiedBy.read(r));
    });
    this._store.add(autorun((r) => {
      const value = renderAsBeingModified.read(r);
      if (value) {
        actualOptions ??= {
          readOnly: this._editor.getOption(EditorOption.readOnly),
          stickyScroll: this._editor.getOption(EditorOption.stickyScroll),
          codeLens: this._editor.getOption(EditorOption.codeLens),
          guides: this._editor.getOption(EditorOption.guides)
        };
        this._editor.updateOptions({
          readOnly: true,
          stickyScroll: { enabled: false },
          codeLens: false,
          guides: { indentation: false, bracketPairs: false }
        });
      } else {
        restoreActualOptions();
      }
    }));
  }
  static {
    this._diffLineDecorationData = ModelDecorationOptions.register({ description: "diff-line-decoration" });
  }
  dispose() {
    this._clear();
    this._store.dispose();
  }
  _clear() {
    this._diffLineDecorations.clear();
    this._clearDiffRendering();
    this._currentIndex.set(-1, void 0);
  }
  // ---- diff rendering logic
  _clearDiffRendering() {
    this._editor.changeViewZones((viewZoneChangeAccessor) => {
      for (const id of this._viewZones) {
        viewZoneChangeAccessor.removeZone(id);
      }
    });
    this._viewZones = [];
    this._diffHunksRenderStore.clear();
    for (const widget of this._diffHunkWidgetPool.free) {
      widget.remove();
    }
    this._diffVisualDecorations.clear();
  }
  _updateDiffRendering(diff, reviewMode, diffMode) {
    const chatDiffAddDecoration = ModelDecorationOptions.createDynamic({
      ...diffAddDecoration,
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    });
    const chatDiffWholeLineAddDecoration = ModelDecorationOptions.createDynamic({
      ...diffWholeLineAddDecoration,
      stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
    });
    const createOverviewDecoration = (overviewRulerColor, minimapColor) => {
      return ModelDecorationOptions.createDynamic({
        description: "chat-editing-decoration",
        overviewRuler: { color: themeColorFromId(overviewRulerColor), position: OverviewRulerLane.Left },
        minimap: { color: themeColorFromId(minimapColor), position: MinimapPosition.Gutter }
      });
    };
    const modifiedDecoration = createOverviewDecoration(overviewRulerModifiedForeground, minimapGutterModifiedBackground);
    const addedDecoration = createOverviewDecoration(overviewRulerAddedForeground, minimapGutterAddedBackground);
    const deletedDecoration = createOverviewDecoration(overviewRulerDeletedForeground, minimapGutterDeletedBackground);
    this._diffHunksRenderStore.clear();
    this._diffHunkWidgets.length = 0;
    const diffHunkDecorations = [];
    this._editor.changeViewZones((viewZoneChangeAccessor) => {
      for (const id of this._viewZones) {
        viewZoneChangeAccessor.removeZone(id);
      }
      this._viewZones = [];
      const modifiedVisualDecorations = [];
      const mightContainNonBasicASCII = diff.originalModel.mightContainNonBasicASCII();
      const mightContainRTL = diff.originalModel.mightContainRTL();
      const renderOptions = RenderOptions.fromEditor(this._editor);
      const editorLineCount = this._editor.getModel()?.getLineCount();
      for (const diffEntry of diff.changes) {
        const originalRange = diffEntry.original;
        diff.originalModel.tokenization.forceTokenization(Math.max(1, originalRange.endLineNumberExclusive - 1));
        const source = new LineSource(
          originalRange.mapToLineArray((l) => diff.originalModel.tokenization.getLineTokens(l)),
          [],
          mightContainNonBasicASCII,
          mightContainRTL
        );
        const decorations = [];
        if (reviewMode) {
          for (const i of diffEntry.innerChanges || []) {
            decorations.push(new InlineDecoration(
              i.originalRange.delta(-(diffEntry.original.startLineNumber - 1)),
              diffDeleteDecoration.className,
              InlineDecorationType.Regular
            ));
            if (!(i.originalRange.isEmpty() && i.originalRange.startLineNumber === 1 && i.modifiedRange.endLineNumber === editorLineCount) && !i.modifiedRange.isEmpty()) {
              modifiedVisualDecorations.push({
                range: i.modifiedRange,
                options: chatDiffAddDecoration
              });
            }
          }
        }
        const isCreatedContent = decorations.length === 1 && decorations[0].range.isEmpty() && diffEntry.original.startLineNumber === 1;
        if (!diffEntry.modified.isEmpty) {
          modifiedVisualDecorations.push({
            range: diffEntry.modified.toInclusiveRange(),
            options: chatDiffWholeLineAddDecoration
          });
        }
        if (diffEntry.original.isEmpty) {
          modifiedVisualDecorations.push({
            range: diffEntry.modified.toInclusiveRange(),
            options: addedDecoration
          });
        } else if (diffEntry.modified.isEmpty) {
          modifiedVisualDecorations.push({
            range: new Range(diffEntry.modified.startLineNumber - 1, 1, diffEntry.modified.startLineNumber, 1),
            options: deletedDecoration
          });
        } else {
          modifiedVisualDecorations.push({
            range: diffEntry.modified.toInclusiveRange(),
            options: modifiedDecoration
          });
        }
        let extraLines = 0;
        if (reviewMode && !diffMode) {
          const domNode = document.createElement("div");
          domNode.className = "chat-editing-original-zone view-lines line-delete monaco-mouse-cursor-text";
          const result = renderLines(source, renderOptions, decorations, domNode);
          extraLines = result.heightInLines;
          if (!isCreatedContent) {
            const viewZoneData = {
              afterLineNumber: diffEntry.modified.startLineNumber - 1,
              heightInLines: result.heightInLines,
              domNode,
              ordinal: 5e4 + 2
              // more than https://github.com/microsoft/vscode/blob/bf52a5cfb2c75a7327c9adeaefbddc06d529dcad/src/vs/workbench/contrib/inlineChat/browser/inlineChatZoneWidget.ts#L42
            };
            this._viewZones.push(viewZoneChangeAccessor.addZone(viewZoneData));
          }
        }
        if (reviewMode || diffMode) {
          let widget = this._diffHunkWidgetPool.get();
          if (!widget) {
            widget = this._editor.invokeWithinContext((accessor) => {
              const instaService = accessor.get(IInstantiationService);
              return instaService.createInstance(DiffHunkWidget, this._editor, diff, diffEntry, this._editor.getModel().getVersionId(), isCreatedContent ? 0 : extraLines);
            });
          } else {
            widget.update(diff, diffEntry, this._editor.getModel().getVersionId(), isCreatedContent ? 0 : extraLines);
          }
          this._diffHunksRenderStore.add(toDisposable(() => {
            this._diffHunkWidgetPool.putBack(widget);
          }));
          widget.layout(diffEntry.modified.startLineNumber);
          this._diffHunkWidgets.push(widget);
          diffHunkDecorations.push({
            range: diffEntry.modified.toInclusiveRange() ?? new Range(diffEntry.modified.startLineNumber, 1, diffEntry.modified.startLineNumber, Number.MAX_SAFE_INTEGER),
            options: {
              description: "diff-hunk-widget",
              stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
            }
          });
        }
      }
      this._diffVisualDecorations.set(!diffMode ? modifiedVisualDecorations : []);
    });
    const diffHunkDecoCollection = this._editor.createDecorationsCollection(diffHunkDecorations);
    this._diffHunksRenderStore.add(toDisposable(() => {
      diffHunkDecoCollection.clear();
    }));
    for (const extraWidget of this._diffHunkWidgetPool.free) {
      extraWidget.remove();
    }
    const positionObs = observableFromEvent(this._editor.onDidChangeCursorPosition, (_) => this._editor.getPosition());
    const activeWidgetIdx = derived((r) => {
      const position = positionObs.read(r);
      if (!position) {
        return -1;
      }
      const idx = diffHunkDecoCollection.getRanges().findIndex((r2) => r2.containsPosition(position));
      return idx;
    });
    const toggleWidget = (activeWidget) => {
      const positionIdx = activeWidgetIdx.get();
      for (let i = 0; i < this._diffHunkWidgets.length; i++) {
        const widget = this._diffHunkWidgets[i];
        widget.toggle(widget === activeWidget || i === positionIdx);
      }
    };
    this._diffHunksRenderStore.add(autorun((r) => {
      const idx = activeWidgetIdx.read(r);
      const widget = this._diffHunkWidgets[idx];
      toggleWidget(widget);
    }));
    this._diffHunksRenderStore.add(this._editor.onMouseUp((e) => {
      if (e.target.type === MouseTargetType.CONTENT_VIEW_ZONE) {
        const zone = e.target.detail;
        const idx = this._viewZones.findIndex((id) => id === zone.viewZoneId);
        if (idx >= 0) {
          this._editor.setPosition(e.target.position);
          this._editor.focus();
        }
      }
    }));
    this._diffHunksRenderStore.add(this._editor.onMouseMove((e) => {
      if (e.target.type === MouseTargetType.OVERLAY_WIDGET) {
        const id = e.target.detail;
        const widget = this._diffHunkWidgets.find((w) => w.getId() === id);
        toggleWidget(widget);
      } else if (e.target.type === MouseTargetType.CONTENT_VIEW_ZONE) {
        const zone = e.target.detail;
        const idx = this._viewZones.findIndex((id) => id === zone.viewZoneId);
        toggleWidget(this._diffHunkWidgets[idx]);
      } else if (e.target.position) {
        const { position } = e.target;
        const idx = diffHunkDecoCollection.getRanges().findIndex((r) => r.containsPosition(position));
        toggleWidget(this._diffHunkWidgets[idx]);
      } else {
        toggleWidget(void 0);
      }
    }));
    this._diffHunksRenderStore.add(Event.any(this._editor.onDidScrollChange, this._editor.onDidLayoutChange)(() => {
      for (let i = 0; i < this._diffHunkWidgets.length; i++) {
        const widget = this._diffHunkWidgets[i];
        const range = diffHunkDecoCollection.getRange(i);
        if (range) {
          widget.layout(range?.startLineNumber);
        } else {
          widget.dispose();
        }
      }
    }));
  }
  enableAccessibleDiffView() {
    this._accessibleDiffViewVisible.set(true, void 0);
  }
  // ---- navigation logic
  reveal(firstOrLast, preserveFocus) {
    const decorations = this._diffLineDecorations.getRanges().sort((a, b) => Range.compareRangesUsingStarts(a, b));
    const index = firstOrLast ? 0 : decorations.length - 1;
    const range = decorations.at(index);
    if (range) {
      this._editor.setPosition(range.getStartPosition());
      this._editor.revealRange(range);
      if (!preserveFocus) {
        this._editor.focus();
      }
      this._currentIndex.set(index, void 0);
    }
  }
  next(wrap) {
    return this._reveal(true, !wrap);
  }
  previous(wrap) {
    return this._reveal(false, !wrap);
  }
  _reveal(next, strict) {
    const position = this._editor.getPosition();
    if (!position) {
      this._currentIndex.set(-1, void 0);
      return false;
    }
    const decorations = this._diffLineDecorations.getRanges().sort((a, b) => Range.compareRangesUsingStarts(a, b));
    if (decorations.length === 0) {
      this._currentIndex.set(-1, void 0);
      return false;
    }
    let newIndex = -1;
    for (let i = 0; i < decorations.length; i++) {
      const range = decorations[i];
      if (range.containsPosition(position)) {
        newIndex = i + (next ? 1 : -1);
        break;
      } else if (Position.isBefore(position, range.getStartPosition())) {
        newIndex = next ? i : i - 1;
        break;
      }
    }
    if (strict && (newIndex < 0 || newIndex >= decorations.length)) {
      return false;
    }
    newIndex = (newIndex + decorations.length) % decorations.length;
    this._currentIndex.set(newIndex, void 0);
    const targetRange = decorations[newIndex];
    const targetPosition = next ? targetRange.getStartPosition() : targetRange.getEndPosition();
    this._editor.setPosition(targetPosition);
    this._editor.revealPositionInCenter(targetRange.getStartPosition().delta(-1));
    this._editor.focus();
    return true;
  }
  // --- hunks
  _findClosestWidget() {
    if (!this._editor.hasModel()) {
      return void 0;
    }
    const lineRelativeTop = this._editor.getTopForLineNumber(this._editor.getPosition().lineNumber) - this._editor.getScrollTop();
    let closestWidget;
    let closestDistance = Number.MAX_VALUE;
    for (const widget of this._diffHunkWidgets) {
      const widgetTop = widget.getPosition()?.preference?.top;
      if (widgetTop !== void 0) {
        const distance = Math.abs(widgetTop - lineRelativeTop);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestWidget = widget;
        }
      }
    }
    return closestWidget;
  }
  async rejectNearestChange(closestWidget) {
    closestWidget = closestWidget ?? this._findClosestWidget();
    if (closestWidget instanceof DiffHunkWidget) {
      await closestWidget.reject();
      this.next(true);
    }
  }
  async acceptNearestChange(closestWidget) {
    closestWidget = closestWidget ?? this._findClosestWidget();
    if (closestWidget instanceof DiffHunkWidget) {
      await closestWidget.accept();
      this.next(true);
    }
  }
  async toggleDiff(widget, show) {
    if (!this._editor.hasModel()) {
      return;
    }
    let selection = this._editor.getSelection();
    if (widget instanceof DiffHunkWidget) {
      const lineNumber = widget.getStartLineNumber();
      const position = lineNumber ? new Position(lineNumber, 1) : void 0;
      if (position && !selection.containsPosition(position)) {
        selection = Selection.fromPositions(position);
      }
    }
    const isDiffEditor = this._editor.getOption(EditorOption.inDiffEditor);
    if (show !== void 0 ? show : !isDiffEditor) {
      const diffEditor = await this._editorService.openEditor({
        original: { resource: this._entry.originalURI },
        modified: { resource: this._entry.modifiedURI },
        options: { selection },
        label: localize("diff.generic", "{0} (changes from chat)", basename(this._entry.modifiedURI))
      });
      if (diffEditor && diffEditor.input) {
        diffEditor.getControl()?.setSelection(selection);
        const d = autorun((r) => {
          const state = this._entry.state.read(r);
          if (state === ModifiedFileEntryState.Accepted || state === ModifiedFileEntryState.Rejected) {
            d.dispose();
            const editorIdents = [];
            for (const candidate of this._editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
              if (isDiffEditorInput(candidate.editor) && isEqual(candidate.editor.original.resource, this._entry.originalURI) && isEqual(candidate.editor.modified.resource, this._entry.modifiedURI)) {
                editorIdents.push(candidate);
              }
            }
            this._editorService.closeEditors(editorIdents);
          }
        });
      }
    } else {
      await this._editorService.openEditor({
        resource: this._entry.modifiedURI,
        options: {
          selection,
          selectionRevealType: TextEditorSelectionRevealType.NearTopIfOutsideViewport
        }
      });
    }
  }
};
ChatEditingCodeEditorIntegration = __decorateClass([
  __decorateParam(4, IEditorService),
  __decorateParam(5, IAccessibilitySignalService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IChatEditingService),
  __decorateParam(9, IChatEditingExplanationModelManager),
  __decorateParam(10, IChatWidgetService),
  __decorateParam(11, IViewsService)
], ChatEditingCodeEditorIntegration);
let DiffHunkWidget = class {
  constructor(_editor, _diffInfo, _change, _versionId, _lineDelta, instaService) {
    this._editor = _editor;
    this._diffInfo = _diffInfo;
    this._change = _change;
    this._versionId = _versionId;
    this._lineDelta = _lineDelta;
    this._id = `diff-change-widget-${DiffHunkWidget._idPool++}`;
    this._store = new DisposableStore();
    this._removed = false;
    this._domNode = document.createElement("div");
    this._domNode.className = "chat-diff-change-content-widget";
    const toolbar = instaService.createInstance(MenuWorkbenchToolBar, this._domNode, MenuId.ChatEditingEditorHunk, {
      telemetrySource: "chatEditingEditorHunk",
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      toolbarOptions: { primaryGroup: () => true },
      menuOptions: {
        renderShortTitle: true,
        arg: this
      },
      actionViewItemProvider: (action, options) => {
        const isPrimary = action.id === "chatEditor.action.acceptHunk";
        if (!action.class) {
          return new class extends ActionViewItem {
            constructor() {
              super(void 0, action, { ...options, keybindingNotRenderedWithLabel: true, icon: false, label: true });
            }
            render(container) {
              super.render(container);
              if (isPrimary) {
                this.element?.classList.add("primary");
              }
            }
          }();
        }
        return void 0;
      }
    });
    this._store.add(toolbar);
    this._store.add(toolbar.actionRunner.onWillRun((_) => _editor.focus()));
    this._editor.addOverlayWidget(this);
  }
  static {
    this._idPool = 0;
  }
  update(diffInfo, change, versionId, lineDelta) {
    this._diffInfo = diffInfo;
    this._change = change;
    this._versionId = versionId;
    this._lineDelta = lineDelta;
  }
  dispose() {
    this._store.dispose();
    this._editor.removeOverlayWidget(this);
    this._removed = true;
  }
  getId() {
    return this._id;
  }
  layout(startLineNumber) {
    const lineHeight = this._editor.getOption(EditorOption.lineHeight);
    const { contentLeft, contentWidth, verticalScrollbarWidth } = this._editor.getLayoutInfo();
    const scrollTop = this._editor.getScrollTop();
    this._position = {
      stackOrdinal: 1,
      preference: {
        top: this._editor.getTopForLineNumber(startLineNumber) - scrollTop - lineHeight * this._lineDelta,
        left: contentLeft + contentWidth - (2 * verticalScrollbarWidth + getTotalWidth(this._domNode))
      }
    };
    if (this._removed) {
      this._removed = false;
      this._editor.addOverlayWidget(this);
    } else {
      this._editor.layoutOverlayWidget(this);
    }
    this._lastStartLineNumber = startLineNumber;
  }
  remove() {
    this._editor.removeOverlayWidget(this);
    this._removed = true;
  }
  toggle(show) {
    this._domNode.classList.toggle("hover", show);
    if (this._lastStartLineNumber) {
      this.layout(this._lastStartLineNumber);
    }
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return this._position ?? null;
  }
  getStartLineNumber() {
    return this._lastStartLineNumber;
  }
  // ---
  async reject() {
    if (this._versionId !== this._editor.getModel()?.getVersionId()) {
      return false;
    }
    return await this._diffInfo.undo(this._change);
  }
  async accept() {
    if (this._versionId !== this._editor.getModel()?.getVersionId()) {
      return false;
    }
    return this._diffInfo.keep(this._change);
  }
};
DiffHunkWidget = __decorateClass([
  __decorateParam(5, IInstantiationService)
], DiffHunkWidget);
class AccessibleDiffViewContainer {
  constructor() {
    this._domNode = document.createElement("div");
    this._domNode.className = "accessible-diff-view";
    this._domNode.style.width = "100%";
    this._domNode.style.position = "absolute";
  }
  getId() {
    return "chatEdits.accessibleDiffView";
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return {
      preference: { top: 0, left: 0 },
      stackOrdinal: 1
    };
  }
}
class AccessibleDiffViewerModel {
  constructor(_documentDiffInfo, _editor) {
    this._documentDiffInfo = _documentDiffInfo;
    this._editor = _editor;
  }
  getOriginalModel() {
    return this._documentDiffInfo.get().originalModel;
  }
  getOriginalOptions() {
    return this._editor.getOptions();
  }
  originalReveal(range) {
    const changes = this._documentDiffInfo.get().changes;
    const idx = changes.findIndex((value) => value.original.intersect(LineRange.fromRange(range)));
    if (idx >= 0) {
      range = changes[idx].modified.toInclusiveRange() ?? range;
    }
    this.modifiedReveal(range);
  }
  getModifiedModel() {
    return this._editor.getModel();
  }
  getModifiedOptions() {
    return this._editor.getOptions();
  }
  modifiedReveal(range) {
    if (range) {
      this._editor.revealRange(range);
      this._editor.setSelection(range);
    }
    this._editor.focus();
  }
  modifiedSetSelection(range) {
    this._editor.setSelection(range);
  }
  modifiedFocus() {
    this._editor.focus();
  }
  getModifiedPosition() {
    return this._editor.getPosition() ?? void 0;
  }
}
export {
  ChatEditingCodeEditorIntegration
};
