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
import { n } from "../../../../../../../../base/browser/dom.js";
import { Event } from "../../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../../base/common/lifecycle.js";
import { autorun, constObservable, debouncedObservable2, derived, derivedDisposable, observableFromEvent } from "../../../../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../../../../platform/instantiation/common/instantiation.js";
import { observableCodeEditor } from "../../../../../../../browser/observableCodeEditor.js";
import { Rect } from "../../../../../../../common/core/2d/rect.js";
import { Position } from "../../../../../../../common/core/position.js";
import { InlineEditTabAction } from "../../inlineEditsViewInterface.js";
import { getContentSizeOfLines, rectToProps } from "../../utils/utils.js";
import { OffsetRange } from "../../../../../../../common/core/ranges/offsetRange.js";
import { LineRange } from "../../../../../../../common/core/ranges/lineRange.js";
import { HideUnchangedRegionsFeature } from "../../../../../../../browser/widget/diffEditor/features/hideUnchangedRegionsFeature.js";
import { Codicon } from "../../../../../../../../base/common/codicons.js";
import { renderIcon } from "../../../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { SymbolKinds } from "../../../../../../../common/languages.js";
import { debugLogHorizontalOffsetRanges, debugLogRects, debugView } from "../debugVisualization.js";
import { distributeFlexBoxLayout } from "../../utils/flexBoxLayout.js";
import { Point } from "../../../../../../../common/core/2d/point.js";
import { IThemeService } from "../../../../../../../../platform/theme/common/themeService.js";
import { IKeybindingService } from "../../../../../../../../platform/keybinding/common/keybinding.js";
import { getEditorBackgroundColor, getEditorBlendedColor, inlineEditIndicatorPrimaryBackground, inlineEditIndicatorSecondaryBackground, inlineEditIndicatorSuccessfulBackground, observeColor } from "../../theme.js";
import { asCssVariable, descriptionForeground, editorWidgetBackground } from "../../../../../../../../platform/theme/common/colorRegistry.js";
import { editorWidgetBorder } from "../../../../../../../../platform/theme/common/colors/editorColors.js";
import { LongDistancePreviewEditor } from "./longDistancePreviewEditor.js";
import { jumpToNextInlineEditId } from "../../../../controller/commandIds.js";
import { splitIntoContinuousLineRanges, WidgetPlacementContext } from "./longDistnaceWidgetPlacement.js";
import { InlineCompletionEditorType } from "../../../../model/provideInlineCompletions.js";
import { basename } from "../../../../../../../../base/common/resources.js";
import { IModelService } from "../../../../../../../common/services/model.js";
import { ILanguageService } from "../../../../../../../common/languages/language.js";
import { getIconClasses } from "../../../../../../../common/services/getIconClasses.js";
import { FileKind } from "../../../../../../../../platform/files/common/files.js";
const BORDER_RADIUS = 6;
const MAX_WIDGET_WIDTH = { EMPTY_SPACE: 425, OVERLAY: 375 };
const MIN_WIDGET_WIDTH = 250;
const DEFAULT_WIDGET_LAYOUT_CONSTANTS = {
  previewEditorMargin: 2,
  widgetPadding: 2,
  widgetBorder: 1,
  lowerBarHeight: 20,
  minWidgetWidth: MIN_WIDGET_WIDTH
};
let InlineEditsLongDistanceHint = class extends Disposable {
  constructor(_editor, _viewState, _previewTextModel, _tabAction, _instantiationService, _themeService, _keybindingService, _modelService, _languageService) {
    super();
    this._editor = _editor;
    this._viewState = _viewState;
    this._previewTextModel = _previewTextModel;
    this._tabAction = _tabAction;
    this._instantiationService = _instantiationService;
    this._themeService = _themeService;
    this._keybindingService = _keybindingService;
    this._modelService = _modelService;
    this._languageService = _languageService;
    this.onDidClick = Event.None;
    this._viewWithElement = void 0;
    this._hintTextPosition = derived(this, (reader) => {
      const viewState = this._viewState.read(reader);
      return viewState ? new Position(viewState.hint.lineNumber, Number.MAX_SAFE_INTEGER) : null;
    });
    this._lineSizesAroundHintPosition = derived(this, (reader) => {
      const viewState = this._viewState.read(reader);
      const p = this._hintTextPosition.read(reader);
      if (!viewState || !p) {
        return [];
      }
      const model = this._editorObs.model.read(reader);
      if (!model) {
        return [];
      }
      const range = LineRange.ofLength(p.lineNumber, 1).addMargin(5, 5).intersect(LineRange.ofLength(1, model.getLineCount()));
      if (!range) {
        return [];
      }
      const sizes = getContentSizeOfLines(this._editorObs, range, reader);
      const top = this._editorObs.observeTopForLineNumber(range.startLineNumber).read(reader);
      return splitIntoContinuousLineRanges(range, sizes, top, this._editorObs, reader);
    });
    this._isVisibleDelayed = debouncedObservable2(
      derived(this, (reader) => this._viewState.read(reader)?.hint.isVisible),
      (lastValue, newValue) => lastValue === true && newValue === false ? 200 : 0
    );
    this._previewEditorLayoutInfo = derived(this, (reader) => {
      const viewState = this._viewState.read(reader);
      if (!viewState || !this._isVisibleDelayed.read(reader)) {
        return void 0;
      }
      const continousLineRanges = this._lineSizesAroundHintPosition.read(reader);
      if (continousLineRanges.length === 0) {
        return void 0;
      }
      const editorScrollTop = this._editorObs.scrollTop.read(reader);
      const editorScrollLeft = this._editorObs.scrollLeft.read(reader);
      const editorLayout = this._editorObs.layoutInfo.read(reader);
      const previewContentHeight = this._previewEditor.contentHeight.read(reader);
      const previewEditorContentLayout = this._previewEditor.horizontalContentRangeInPreviewEditorToShow.read(reader);
      if (!previewContentHeight || !previewEditorContentLayout) {
        return void 0;
      }
      const editorTrueContentWidth = editorLayout.contentWidth - editorLayout.verticalScrollbarWidth;
      const editorTrueContentRight = editorLayout.contentLeft + editorTrueContentWidth;
      const c = this._editorObs.cursorLineNumber.read(reader);
      if (!c) {
        return void 0;
      }
      const layoutConstants = DEFAULT_WIDGET_LAYOUT_CONSTANTS;
      const extraGutterMarginToAvoidScrollBar = 2;
      const previewEditorHeight = previewContentHeight + extraGutterMarginToAvoidScrollBar;
      let possibleWidgetOutline;
      let lastPlacementContext;
      const endOfLinePadding = (lineNumber) => lineNumber === viewState.hint.lineNumber ? 40 : 20;
      for (const continousLineRange of continousLineRanges) {
        const placementContext = new WidgetPlacementContext(
          continousLineRange,
          editorTrueContentWidth,
          endOfLinePadding
        );
        lastPlacementContext = placementContext;
        const showRects = false;
        if (showRects) {
          const rects2 = stackSizesDown(
            new Point(editorTrueContentRight, continousLineRange.top - editorScrollTop),
            placementContext.availableSpaceSizes,
            "right"
          );
          debugView(debugLogRects({ ...rects2 }, this._editor.getDomNode()), reader);
        }
        possibleWidgetOutline = placementContext.tryFindWidgetOutline(
          viewState.hint.lineNumber,
          previewEditorHeight,
          editorTrueContentRight,
          layoutConstants
        );
        if (possibleWidgetOutline) {
          break;
        }
      }
      let position = "empty-space";
      if (!possibleWidgetOutline) {
        position = "overlay";
        const maxAvailableWidth = Math.min(editorLayout.width - editorLayout.contentLeft, MAX_WIDGET_WIDTH.OVERLAY);
        const fallbackPlacementContext = lastPlacementContext ?? new WidgetPlacementContext(
          continousLineRanges[0],
          editorTrueContentWidth,
          endOfLinePadding
        );
        possibleWidgetOutline = {
          horizontalWidgetRange: OffsetRange.ofStartAndLength(editorTrueContentRight - maxAvailableWidth, maxAvailableWidth),
          verticalWidgetRange: fallbackPlacementContext.getWidgetVerticalOutline(
            viewState.hint.lineNumber + 2,
            previewEditorHeight,
            layoutConstants
          ).delta(10)
        };
      }
      if (!possibleWidgetOutline) {
        return void 0;
      }
      const rectAvailableSpace = Rect.fromRanges(
        possibleWidgetOutline.horizontalWidgetRange,
        possibleWidgetOutline.verticalWidgetRange
      ).translateX(-editorScrollLeft).translateY(-editorScrollTop);
      const showAvailableSpace = false;
      if (showAvailableSpace) {
        debugView(debugLogRects({ rectAvailableSpace }, this._editor.getDomNode()), reader);
      }
      const { previewEditorMargin, widgetPadding, widgetBorder, lowerBarHeight } = layoutConstants;
      const maxWidgetWidthUpperBound = position === "overlay" ? MAX_WIDGET_WIDTH.OVERLAY : MAX_WIDGET_WIDTH.EMPTY_SPACE;
      const contentBasedWidgetWidth = previewEditorContentLayout.maxEditorWidth + previewEditorMargin + widgetPadding;
      const maxWidgetWidth = Math.min(maxWidgetWidthUpperBound, Math.max(contentBasedWidgetWidth, layoutConstants.minWidgetWidth));
      const layout = distributeFlexBoxLayout(rectAvailableSpace.width, {
        spaceBefore: { min: 0, max: 10, priority: 1 },
        content: { min: 50, rules: [{ max: 150, priority: 2 }, { max: maxWidgetWidth, priority: 1 }] },
        spaceAfter: { min: 10 }
      });
      if (!layout) {
        return null;
      }
      const ranges = lengthsToOffsetRanges([layout.spaceBefore, layout.content, layout.spaceAfter], rectAvailableSpace.left);
      const spaceBeforeRect = rectAvailableSpace.withHorizontalRange(ranges[0]);
      const widgetRect = rectAvailableSpace.withHorizontalRange(ranges[1]);
      const spaceAfterRect = rectAvailableSpace.withHorizontalRange(ranges[2]);
      const showRects2 = false;
      if (showRects2) {
        debugView(debugLogRects({ spaceBeforeRect, widgetRect, spaceAfterRect }, this._editor.getDomNode()), reader);
      }
      const previewEditorRect = widgetRect.withMargin(-widgetPadding - widgetBorder - previewEditorMargin).withMargin(0, 0, -lowerBarHeight, 0);
      const showEditorRect = false;
      if (showEditorRect) {
        debugView(debugLogRects({ previewEditorRect }, this._editor.getDomNode()), reader);
      }
      const previewEditorContentWidth = previewEditorRect.width - previewEditorContentLayout.nonContentWidth;
      const maxPrefferedRangeLength = previewEditorContentWidth * 0.8;
      const preferredRangeToReveal = previewEditorContentLayout.preferredRangeToReveal.intersect(OffsetRange.ofStartAndLength(
        previewEditorContentLayout.preferredRangeToReveal.start,
        maxPrefferedRangeLength
      )) ?? previewEditorContentLayout.preferredRangeToReveal;
      const desiredPreviewEditorScrollLeft = scrollToReveal(previewEditorContentLayout.indentationEnd, previewEditorContentWidth, preferredRangeToReveal);
      return {
        codeEditorSize: previewEditorRect.getSize(),
        codeScrollLeft: editorScrollLeft,
        contentLeft: editorLayout.contentLeft,
        widgetRect,
        previewEditorMargin,
        widgetPadding,
        widgetBorder,
        lowerBarHeight,
        desiredPreviewEditorScrollLeft: desiredPreviewEditorScrollLeft.newScrollPosition
      };
    });
    this._view = n.div({
      class: "inline-edits-view",
      style: {
        position: "absolute",
        overflow: "visible",
        top: "0px",
        left: "0px",
        display: derived(this, (reader) => !!this._previewEditorLayoutInfo.read(reader) ? "block" : "none")
      }
    }, [
      derived(this, (_reader) => [this._widgetContent])
    ]);
    this._widgetContent = derived(
      this,
      (reader) => (
        // TODO@hediet: remove when n.div lazily creates previewEditor.element node
        n.div({
          class: ["inline-edits-long-distance-hint-widget", "show-file-icons"],
          style: {
            position: "absolute",
            overflow: "hidden",
            cursor: "pointer",
            background: asCssVariable(editorWidgetBackground),
            padding: this._previewEditorLayoutInfo.map((i) => i?.widgetPadding),
            boxSizing: "border-box",
            borderRadius: BORDER_RADIUS,
            border: derived((reader2) => `${this._previewEditorLayoutInfo.read(reader2)?.widgetBorder}px solid ${this._styles.read(reader2).border}`),
            display: "flex",
            flexDirection: "column",
            opacity: derived((reader2) => this._viewState.read(reader2)?.hint.isVisible ? "1" : "0"),
            transition: "opacity 200ms ease-in-out",
            ...rectToProps((reader2) => this._previewEditorLayoutInfo.read(reader2)?.widgetRect)
          },
          onmousedown: (e) => {
            e.preventDefault();
          },
          onclick: () => {
            this._viewState.read(void 0)?.model.jump();
          }
        }, [
          n.div({
            class: ["editorContainer"],
            style: {
              overflow: "hidden",
              padding: this._previewEditorLayoutInfo.map((i) => i?.previewEditorMargin),
              background: this._styles.map((s) => s.background),
              pointerEvents: "none"
            }
          }, [
            derived(this, (r) => this._previewEditor.element)
            // --
          ]),
          n.div({ class: "bar", style: { color: asCssVariable(descriptionForeground), pointerEvents: "none", margin: "0 4px", height: this._previewEditorLayoutInfo.map((i) => i?.lowerBarHeight), display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
            derived(this, (reader2) => {
              const children = [];
              const viewState = this._viewState.read(reader2);
              if (!viewState) {
                return children;
              }
              const currentModel = this._editorObs.model.read(reader2);
              const targetUri = viewState.target.uri;
              const isCrossFileEdit = !currentModel || !viewState.target.targets(currentModel);
              if (isCrossFileEdit) {
                const fileName = basename(targetUri);
                const iconClasses = getIconClasses(this._modelService, this._languageService, targetUri, FileKind.FILE);
                children.push(n.div({
                  class: "target-file",
                  style: { display: "flex", alignItems: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                }, [
                  n.elem("span", { class: iconClasses, style: { flexShrink: "0", marginRight: "4px" } }),
                  fileName
                ]));
              } else {
                const source = this._originalOutlineSource.read(reader2);
                const originalTargetLineNumber2 = this._originalTargetLineNumber.read(reader2);
                const outlineItems = source?.getAt(originalTargetLineNumber2, reader2).slice(0, 1) ?? [];
                const outlineElements = [];
                if (outlineItems.length > 0) {
                  for (let i = 0; i < outlineItems.length; i++) {
                    const item = outlineItems[i];
                    const icon = SymbolKinds.toIcon(item.kind);
                    outlineElements.push(n.div({
                      class: "breadcrumb-item",
                      style: { display: "flex", alignItems: "center", flex: "1 1 auto", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
                    }, [
                      renderIcon(icon),
                      "\xA0",
                      item.name,
                      ...i === outlineItems.length - 1 ? [] : [renderIcon(Codicon.chevronRight)]
                    ]));
                  }
                }
                children.push(n.div({ class: "outline-elements", style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, outlineElements));
              }
              const originalTargetLineNumber = this._originalTargetLineNumber.read(reader2);
              const arrowIcon = isCrossFileEdit ? Codicon.arrowRight : viewState.hint.lineNumber < originalTargetLineNumber ? Codicon.arrowDown : Codicon.arrowUp;
              const keybinding = this._keybindingService.lookupKeybinding(jumpToNextInlineEditId);
              let label = isCrossFileEdit ? "Go to file" : "Go to suggestion";
              if (keybinding && keybinding.getLabel() === "Tab") {
                label = isCrossFileEdit ? "Tab to open" : "Tab to jump";
              }
              children.push(n.div({
                class: "go-to-label",
                style: { position: "relative", display: "flex", alignItems: "center", flex: "0 0 auto", paddingLeft: "6px" }
              }, [
                label,
                "\xA0",
                renderIcon(arrowIcon)
              ]));
              return children;
            })
          ])
        ])
      )
    );
    // Drives breadcrumbs and symbol icon
    this._originalTargetLineNumber = derived(this, (reader) => {
      const viewState = this._viewState.read(reader);
      if (!viewState) {
        return -1;
      }
      if (viewState.edit.action?.kind === "jumpTo") {
        return viewState.edit.action.position.lineNumber;
      }
      return viewState.diff[0]?.original.startLineNumber ?? -1;
    });
    this._originalOutlineSource = derivedDisposable(this, (reader) => {
      const m = this._editorObs.model.read(reader);
      const factory = HideUnchangedRegionsFeature._breadcrumbsSourceFactory.read(reader);
      return !m || !factory ? void 0 : factory(m, this._instantiationService);
    });
    this._styles = derived((reader) => {
      const v = this._tabAction.read(reader);
      const widgetBorderColor = observeColor(editorWidgetBorder, this._themeService).read(reader);
      const isHighContrast = observableFromEvent(this._themeService.onDidColorThemeChange, () => {
        const theme = this._themeService.getColorTheme();
        return theme.type === "hcDark" || theme.type === "hcLight";
      }).read(reader);
      let borderColor;
      if (isHighContrast) {
        borderColor = widgetBorderColor;
      } else {
        let border;
        switch (v) {
          case InlineEditTabAction.Inactive:
            border = inlineEditIndicatorSecondaryBackground;
            break;
          case InlineEditTabAction.Jump:
            border = inlineEditIndicatorPrimaryBackground;
            break;
          case InlineEditTabAction.Accept:
            border = inlineEditIndicatorSuccessfulBackground;
            break;
        }
        borderColor = getEditorBlendedColor(border, this._themeService).read(reader);
      }
      return {
        border: borderColor.toString(),
        background: getEditorBackgroundColor(this._viewState.map((s) => s?.editorType ?? InlineCompletionEditorType.TextEditor).read(reader))
      };
    });
    this._editorObs = observableCodeEditor(this._editor);
    this._previewEditor = this._register(
      this._instantiationService.createInstance(
        LongDistancePreviewEditor,
        this._previewTextModel,
        derived((reader) => {
          const viewState = this._viewState.read(reader);
          if (!viewState) {
            return void 0;
          }
          return {
            diff: viewState.diff,
            model: viewState.model,
            inlineSuggestInfo: viewState.inlineSuggestInfo,
            nextCursorPosition: viewState.nextCursorPosition,
            target: viewState.target
          };
        }),
        this._editor,
        this._tabAction
      )
    );
    this._viewWithElement = this._view.keepUpdated(this._store);
    this._register(this._editorObs.createOverlayWidget({
      domNode: this._viewWithElement.element,
      position: constObservable(null),
      allowEditorOverflow: false,
      minContentWidthInPx: constObservable(0)
    }));
    this._widgetContent.get().keepUpdated(this._store);
    this._register(autorun((reader) => {
      const layoutInfo = this._previewEditorLayoutInfo.read(reader);
      if (!layoutInfo) {
        return;
      }
      this._previewEditor.layout(layoutInfo.codeEditorSize.toDimension(), layoutInfo.desiredPreviewEditorScrollLeft);
    }));
    this._isVisibleDelayed.recomputeInitiallyAndOnChange(this._store);
  }
  get isHovered() {
    return this._widgetContent.get().didMouseMoveDuringHover;
  }
};
InlineEditsLongDistanceHint = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IModelService),
  __decorateParam(8, ILanguageService)
], InlineEditsLongDistanceHint);
function lengthsToOffsetRanges(lengths, initialOffset = 0) {
  const result = [];
  let offset = initialOffset;
  for (const length of lengths) {
    result.push(new OffsetRange(offset, offset + length));
    offset += length;
  }
  return result;
}
function stackSizesDown(at, sizes, alignment = "left") {
  const rects = [];
  let offset = 0;
  for (const s of sizes) {
    rects.push(
      Rect.fromLeftTopWidthHeight(
        at.x + (alignment === "left" ? 0 : -s.width),
        at.y + offset,
        s.width,
        s.height
      )
    );
    offset += s.height;
  }
  return rects;
}
function drawEditorWidths(e, reader) {
  const layoutInfo = e.getLayoutInfo();
  const contentLeft = new OffsetRange(0, layoutInfo.contentLeft);
  const trueContent = OffsetRange.ofStartAndLength(layoutInfo.contentLeft, layoutInfo.contentWidth - layoutInfo.verticalScrollbarWidth);
  const minimap = OffsetRange.ofStartAndLength(trueContent.endExclusive, layoutInfo.minimap.minimapWidth);
  const verticalScrollbar = OffsetRange.ofStartAndLength(minimap.endExclusive, layoutInfo.verticalScrollbarWidth);
  const r = new OffsetRange(0, 200);
  debugView(debugLogHorizontalOffsetRanges({
    contentLeft: Rect.fromRanges(contentLeft, r),
    trueContent: Rect.fromRanges(trueContent, r),
    minimap: Rect.fromRanges(minimap, r),
    verticalScrollbar: Rect.fromRanges(verticalScrollbar, r)
  }, e.getDomNode()), reader);
}
function scrollToReveal(currentScrollPosition, windowWidth, contentRangeToReveal) {
  const visibleRange = new OffsetRange(currentScrollPosition, currentScrollPosition + windowWidth);
  if (visibleRange.containsRange(contentRangeToReveal)) {
    return { newScrollPosition: currentScrollPosition };
  }
  if (contentRangeToReveal.length > windowWidth) {
    return { newScrollPosition: contentRangeToReveal.start };
  }
  if (contentRangeToReveal.endExclusive > visibleRange.endExclusive) {
    return { newScrollPosition: contentRangeToReveal.endExclusive - windowWidth };
  }
  if (contentRangeToReveal.start < visibleRange.start) {
    return { newScrollPosition: contentRangeToReveal.start };
  }
  return { newScrollPosition: currentScrollPosition };
}
export {
  InlineEditsLongDistanceHint,
  drawEditorWidths,
  scrollToReveal
};
