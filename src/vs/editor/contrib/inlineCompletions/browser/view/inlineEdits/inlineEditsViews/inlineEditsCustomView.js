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
import { n } from "../../../../../../../base/browser/dom.js";
import { Emitter } from "../../../../../../../base/common/event.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { autorun, constObservable, derived, derivedObservableWithCache, observableValue } from "../../../../../../../base/common/observable.js";
import { IThemeService } from "../../../../../../../platform/theme/common/themeService.js";
import { observableCodeEditor } from "../../../../../../browser/observableCodeEditor.js";
import { LineSource, renderLines, RenderOptions } from "../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { Rect } from "../../../../../../common/core/2d/rect.js";
import { LineRange } from "../../../../../../common/core/ranges/lineRange.js";
import { InlineCompletionHintStyle } from "../../../../../../common/languages.js";
import { ILanguageService } from "../../../../../../common/languages/language.js";
import { LineTokens, TokenArray } from "../../../../../../common/tokens/lineTokens.js";
import { InlineEditClickEvent, InlineEditTabAction } from "../inlineEditsViewInterface.js";
import { getEditorBackgroundColor, getEditorBlendedColor, INLINE_EDITS_BORDER_RADIUS, inlineEditIndicatorPrimaryBackground, inlineEditIndicatorSecondaryBackground, inlineEditIndicatorSuccessfulBackground } from "../theme.js";
import { getContentRenderWidth, maxContentWidthInRange, rectToProps } from "../utils/utils.js";
const MIN_END_OF_LINE_PADDING = 14;
const PADDING_VERTICALLY = 0;
const PADDING_HORIZONTALLY = 4;
const HORIZONTAL_OFFSET_WHEN_ABOVE_BELOW = 4;
const VERTICAL_OFFSET_WHEN_ABOVE_BELOW = 2;
let InlineEditsCustomView = class extends Disposable {
  constructor(_editor, displayLocation, tabAction, editorType, themeService, _languageService) {
    super();
    this._editor = _editor;
    this._languageService = _languageService;
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    this._isHovered = observableValue(this, false);
    this.isHovered = this._isHovered;
    this._viewRef = n.ref();
    this._editorObs = observableCodeEditor(this._editor);
    const styles = tabAction.map((v, reader) => {
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
      return {
        border: getEditorBlendedColor(border, themeService).read(reader).toString(),
        background: getEditorBackgroundColor(editorType.read(reader))
      };
    });
    const state = displayLocation.map((dl) => dl ? this.getState(dl) : void 0);
    const view = state.map((s) => s ? this.getRendering(s, styles) : void 0);
    this.minEditorScrollHeight = derived(this, (reader) => {
      const s = state.read(reader);
      if (!s) {
        return 0;
      }
      return s.rect.read(reader).bottom + this._editor.getScrollTop();
    });
    const overlay = n.div({
      class: "inline-edits-custom-view",
      style: {
        position: "absolute",
        overflow: "visible",
        top: "0px",
        left: "0px",
        display: "block"
      }
    }, [view]).keepUpdated(this._store);
    this._register(this._editorObs.createOverlayWidget({
      domNode: overlay.element,
      position: constObservable(null),
      allowEditorOverflow: false,
      minContentWidthInPx: derivedObservableWithCache(this, (reader, prev) => {
        const s = state.read(reader);
        if (!s) {
          return prev ?? 0;
        }
        const current = s.rect.map((rect) => rect.right).read(reader) + this._editorObs.layoutInfoVerticalScrollbarWidth.read(reader) + PADDING_HORIZONTALLY - this._editorObs.layoutInfoContentLeft.read(reader);
        return Math.max(prev ?? 0, current);
      }).recomputeInitiallyAndOnChange(this._store)
    }));
    this._register(autorun((reader) => {
      const v = view.read(reader);
      if (!v) {
        this._isHovered.set(false, void 0);
        return;
      }
      this._isHovered.set(overlay.isHovered.read(reader), void 0);
    }));
  }
  // TODO: this is very similar to side by side `fitsInsideViewport`, try to use the same function
  fitsInsideViewport(range, displayLabel, reader) {
    const editorWidth = this._editorObs.layoutInfoWidth.read(reader);
    const editorContentLeft = this._editorObs.layoutInfoContentLeft.read(reader);
    const editorVerticalScrollbar = this._editor.getLayoutInfo().verticalScrollbarWidth;
    const minimapWidth = this._editorObs.layoutInfoMinimap.read(reader).minimapLeft !== 0 ? this._editorObs.layoutInfoMinimap.read(reader).minimapWidth : 0;
    const maxOriginalContent = maxContentWidthInRange(this._editorObs, range, void 0);
    const maxModifiedContent = getContentRenderWidth(displayLabel, this._editor, this._editor.getModel());
    const padding = PADDING_HORIZONTALLY + MIN_END_OF_LINE_PADDING;
    return maxOriginalContent + maxModifiedContent + padding < editorWidth - editorContentLeft - editorVerticalScrollbar - minimapWidth;
  }
  getState(displayLocation) {
    const contentState = derived(this, (reader) => {
      const startLineNumber2 = displayLocation.range.startLineNumber;
      const endLineNumber2 = displayLocation.range.endLineNumber;
      const startColumn = displayLocation.range.startColumn;
      const endColumn = displayLocation.range.endColumn;
      const lineCount = this._editor.getModel()?.getLineCount() ?? 0;
      const lineWidth = maxContentWidthInRange(this._editorObs, new LineRange(startLineNumber2, startLineNumber2 + 1), reader);
      const lineWidthBelow = startLineNumber2 + 1 <= lineCount ? maxContentWidthInRange(this._editorObs, new LineRange(startLineNumber2 + 1, startLineNumber2 + 2), reader) : void 0;
      const lineWidthAbove = startLineNumber2 - 1 >= 1 ? maxContentWidthInRange(this._editorObs, new LineRange(startLineNumber2 - 1, startLineNumber2), reader) : void 0;
      const startContentLeftOffset = this._editor.getOffsetForColumn(startLineNumber2, startColumn);
      const endContentLeftOffset = this._editor.getOffsetForColumn(endLineNumber2, endColumn);
      return {
        lineWidth,
        lineWidthBelow,
        lineWidthAbove,
        startContentLeftOffset,
        endContentLeftOffset
      };
    });
    const startLineNumber = displayLocation.range.startLineNumber;
    const endLineNumber = displayLocation.range.endLineNumber;
    const fitsInsideViewport = this.fitsInsideViewport(new LineRange(startLineNumber, endLineNumber + 1), displayLocation.content, void 0);
    const rect = derived(this, (reader) => {
      const w = this._editorObs.getOption(EditorOption.fontInfo).read(reader).typicalHalfwidthCharacterWidth;
      const { lineWidth, lineWidthBelow, lineWidthAbove, startContentLeftOffset, endContentLeftOffset } = contentState.read(reader);
      const contentLeft = this._editorObs.layoutInfoContentLeft.read(reader);
      const lineHeight = this._editorObs.observeLineHeightForLine(startLineNumber).recomputeInitiallyAndOnChange(reader.store).read(reader);
      const scrollTop = this._editorObs.scrollTop.read(reader);
      const scrollLeft = this._editorObs.scrollLeft.read(reader);
      let position;
      if (startLineNumber === endLineNumber && endContentLeftOffset + 5 * w >= lineWidth && fitsInsideViewport) {
        position = "end";
      } else if (lineWidthBelow !== void 0 && lineWidthBelow + MIN_END_OF_LINE_PADDING - HORIZONTAL_OFFSET_WHEN_ABOVE_BELOW - PADDING_HORIZONTALLY < startContentLeftOffset) {
        position = "below";
      } else if (lineWidthAbove !== void 0 && lineWidthAbove + MIN_END_OF_LINE_PADDING - HORIZONTAL_OFFSET_WHEN_ABOVE_BELOW - PADDING_HORIZONTALLY < startContentLeftOffset) {
        position = "above";
      } else {
        position = "end";
      }
      let topOfLine;
      let contentStartOffset;
      let deltaX = 0;
      let deltaY = 0;
      switch (position) {
        case "end": {
          topOfLine = this._editorObs.editor.getTopForLineNumber(startLineNumber);
          contentStartOffset = lineWidth;
          deltaX = PADDING_HORIZONTALLY + MIN_END_OF_LINE_PADDING;
          break;
        }
        case "below": {
          topOfLine = this._editorObs.editor.getTopForLineNumber(startLineNumber + 1);
          contentStartOffset = startContentLeftOffset;
          deltaX = PADDING_HORIZONTALLY + HORIZONTAL_OFFSET_WHEN_ABOVE_BELOW;
          deltaY = PADDING_VERTICALLY + VERTICAL_OFFSET_WHEN_ABOVE_BELOW;
          break;
        }
        case "above": {
          topOfLine = this._editorObs.editor.getTopForLineNumber(startLineNumber - 1);
          contentStartOffset = startContentLeftOffset;
          deltaX = PADDING_HORIZONTALLY + HORIZONTAL_OFFSET_WHEN_ABOVE_BELOW;
          deltaY = -PADDING_VERTICALLY + VERTICAL_OFFSET_WHEN_ABOVE_BELOW;
          break;
        }
      }
      const textRect = Rect.fromLeftTopWidthHeight(
        contentLeft + contentStartOffset - scrollLeft,
        topOfLine - scrollTop,
        w * displayLocation.content.length,
        lineHeight
      );
      return textRect.withMargin(PADDING_VERTICALLY, PADDING_HORIZONTALLY).translateX(deltaX).translateY(deltaY);
    });
    return {
      rect,
      label: displayLocation.content,
      kind: displayLocation.style
    };
  }
  getRendering(state, styles) {
    const line = document.createElement("div");
    const t = this._editor.getModel().tokenization.tokenizeLinesAt(1, [state.label])?.[0];
    let tokens;
    if (t && state.kind === InlineCompletionHintStyle.Code) {
      tokens = TokenArray.fromLineTokens(t).toLineTokens(state.label, this._languageService.languageIdCodec);
    } else {
      tokens = LineTokens.createEmpty(state.label, this._languageService.languageIdCodec);
    }
    const result = renderLines(new LineSource([tokens]), RenderOptions.fromEditor(this._editor).withSetWidth(false).withScrollBeyondLastColumn(0), [], line, true);
    line.style.width = `${result.minWidthInPx}px`;
    const rect = state.rect.map((r) => r.withMargin(0, PADDING_HORIZONTALLY));
    return n.div({
      class: "collapsedView",
      ref: this._viewRef,
      style: {
        position: "absolute",
        ...rectToProps((reader) => rect.read(reader)),
        overflow: "hidden",
        boxSizing: "border-box",
        cursor: "pointer",
        border: styles.map((s) => `1px solid ${s.border}`),
        borderRadius: `${INLINE_EDITS_BORDER_RADIUS}px`,
        backgroundColor: styles.map((s) => s.background),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        whiteSpace: "nowrap"
      },
      onmousedown: (e) => {
        e.preventDefault();
      },
      onclick: (e) => {
        this._onDidClick.fire(InlineEditClickEvent.create(e));
      }
    }, [
      line
    ]);
  }
};
InlineEditsCustomView = __decorateClass([
  __decorateParam(4, IThemeService),
  __decorateParam(5, ILanguageService)
], InlineEditsCustomView);
export {
  InlineEditsCustomView
};
