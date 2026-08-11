import { getDomNodePagePosition, h } from "../../../../../../../base/browser/dom.js";
import { KeybindingLabel, unthemedKeybindingLabelOptions } from "../../../../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { numberComparator } from "../../../../../../../base/common/arrays.js";
import { findFirstMin } from "../../../../../../../base/common/arraysFind.js";
import { toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { DebugLocation, derived, derivedObservableWithCache, derivedOpts, observableSignalFromEvent, observableValue, transaction } from "../../../../../../../base/common/observable.js";
import { OS } from "../../../../../../../base/common/platform.js";
import { splitLines } from "../../../../../../../base/common/strings.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { MenuEntryActionViewItem } from "../../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { observableCodeEditor } from "../../../../../../browser/observableCodeEditor.js";
import { Rect } from "../../../../../../common/core/2d/rect.js";
import { EditorOption } from "../../../../../../common/config/editorOptions.js";
import { OffsetRange } from "../../../../../../common/core/ranges/offsetRange.js";
import { Position } from "../../../../../../common/core/position.js";
import { Range } from "../../../../../../common/core/range.js";
import { TextReplacement, TextEdit } from "../../../../../../common/core/edits/textEdit.js";
import { RangeMapping } from "../../../../../../common/diff/rangeMapping.js";
import { indentOfLine } from "../../../../../../common/model/textModel.js";
import { CharCode } from "../../../../../../../base/common/charCode.js";
import { BugIndicatingError } from "../../../../../../../base/common/errors.js";
import { Size2D } from "../../../../../../common/core/2d/size.js";
function maxContentWidthInRange(editor, range, reader) {
  const model = editor.model.read(reader);
  if (!model) {
    return 0;
  }
  let maxContentWidth = 0;
  for (let i = range.startLineNumber; i < range.endLineNumberExclusive; i++) {
    const lineContentWidth = editor.getWidthOfLine(i, reader);
    maxContentWidth = Math.max(maxContentWidth, lineContentWidth);
  }
  const lines = range.mapToLineArray((l) => model.getLineContent(l));
  if (maxContentWidth < 5 && lines.some((l) => l.length > 0) && model.uri.scheme !== "file") {
    console.log("unexpected width");
  }
  return maxContentWidth;
}
function getContentSizeOfLines(editor, range, reader) {
  observableSignalFromEvent(editor, editor.editor.onDidChangeLineHeight).read(reader);
  const model = editor.model.read(reader);
  if (!model) {
    throw new BugIndicatingError("Model is required");
  }
  const sizes = [];
  for (let i = range.startLineNumber; i < range.endLineNumberExclusive; i++) {
    let lineContentWidth = editor.getWidthOfLine(i, reader);
    if (lineContentWidth === -1) {
      const column = model.getLineMaxColumn(i);
      const typicalHalfwidthCharacterWidth = editor.editor.getOption(EditorOption.fontInfo).typicalHalfwidthCharacterWidth;
      const approximation = column * typicalHalfwidthCharacterWidth;
      lineContentWidth = approximation;
    }
    const height = editor.editor.getLineHeightForPosition(new Position(i, 1));
    sizes.push(new Size2D(lineContentWidth, height));
  }
  return sizes;
}
function getOffsetForPos(editor, pos, reader) {
  editor.layoutInfo.read(reader);
  editor.value.read(reader);
  const model = editor.model.read(reader);
  if (!model) {
    return 0;
  }
  editor.scrollTop.read(reader);
  const lineContentWidth = editor.editor.getOffsetForColumn(pos.lineNumber, pos.column);
  return lineContentWidth;
}
function getPrefixTrim(diffRanges, originalLinesRange, modifiedLines, editor, reader = void 0) {
  const textModel = editor.getModel();
  if (!textModel) {
    return { prefixTrim: 0, prefixLeftOffset: 0 };
  }
  const replacementStart = diffRanges.map((r) => r.isSingleLine() ? r.startColumn - 1 : 0);
  const originalIndents = originalLinesRange.mapToLineArray((line) => indentOfLine(textModel.getLineContent(line)));
  const modifiedIndents = modifiedLines.filter((line) => line !== "").map((line) => indentOfLine(line));
  const prefixTrim = Math.min(...replacementStart, ...originalIndents, ...modifiedIndents);
  let prefixLeftOffset;
  const startLineIndent = textModel.getLineIndentColumn(originalLinesRange.startLineNumber);
  if (startLineIndent >= prefixTrim + 1) {
    observableCodeEditor(editor).scrollTop.read(reader);
    prefixLeftOffset = editor.getOffsetForColumn(originalLinesRange.startLineNumber, prefixTrim + 1);
  } else if (modifiedLines.length > 0) {
    prefixLeftOffset = getContentRenderWidth(modifiedLines[0].slice(0, prefixTrim), editor, textModel);
  } else {
    return { prefixTrim: 0, prefixLeftOffset: 0 };
  }
  return { prefixTrim, prefixLeftOffset };
}
function getContentRenderWidth(content, editor, textModel) {
  const w = editor.getOption(EditorOption.fontInfo).typicalHalfwidthCharacterWidth;
  const tabSize = textModel.getOptions().tabSize * w;
  const numTabs = content.split("	").length - 1;
  const numNoneTabs = content.length - numTabs;
  return numNoneTabs * w + numTabs * tabSize;
}
function getEditorValidOverlayRect(editor) {
  const contentLeft = editor.layoutInfoContentLeft;
  const width = derived({ name: "editor.validOverlay.width" }, (r) => {
    const hasMinimapOnTheRight = editor.layoutInfoMinimap.read(r).minimapLeft !== 0;
    const editorWidth = Math.max(0, editor.layoutInfoWidth.read(r) - contentLeft.read(r));
    if (hasMinimapOnTheRight) {
      const minimapAndScrollbarWidth = editor.layoutInfoMinimap.read(r).minimapWidth + editor.layoutInfoVerticalScrollbarWidth.read(r);
      return Math.max(0, editorWidth - minimapAndScrollbarWidth);
    }
    return editorWidth;
  });
  const height = derived({ name: "editor.validOverlay.height" }, (r) => editor.layoutInfoHeight.read(r) + editor.contentHeight.read(r));
  return derived({ name: "editor.validOverlay" }, (r) => Rect.fromLeftTopWidthHeight(contentLeft.read(r), 0, width.read(r), height.read(r)));
}
class StatusBarViewItem extends MenuEntryActionViewItem {
  constructor() {
    super(...arguments);
    this._updateLabelListener = this._register(this._contextKeyService.onDidChangeContext(() => {
      this.updateLabel();
    }));
  }
  updateLabel() {
    const kb = this._keybindingService.lookupKeybinding(this._action.id, this._contextKeyService, true);
    if (!kb) {
      return super.updateLabel();
    }
    if (this.label) {
      const div = h("div.keybinding").root;
      const keybindingLabel = this._register(new KeybindingLabel(div, OS, { disableTitle: true, ...unthemedKeybindingLabelOptions }));
      keybindingLabel.set(kb);
      this.label.textContent = this._action.label;
      this.label.appendChild(div);
      this.label.classList.add("inlineSuggestionStatusBarItemLabel");
    }
  }
  updateTooltip() {
  }
}
class UniqueUriGenerator {
  constructor(scheme) {
    this.scheme = scheme;
  }
  static {
    this._modelId = 0;
  }
  getUniqueUri() {
    return URI.from({ scheme: this.scheme, path: (/* @__PURE__ */ new Date()).toString() + String(UniqueUriGenerator._modelId++) });
  }
}
function applyEditToModifiedRangeMappings(rangeMapping, edit) {
  const updatedMappings = [];
  for (const m of rangeMapping) {
    const updatedRange = edit.mapRange(m.modifiedRange);
    updatedMappings.push(new RangeMapping(m.originalRange, updatedRange));
  }
  return updatedMappings;
}
function classNames(...classes) {
  return classes.filter((c) => typeof c === "string").join(" ");
}
function offsetRangeToRange(columnOffsetRange, startPos) {
  return new Range(
    startPos.lineNumber,
    startPos.column + columnOffsetRange.start,
    startPos.lineNumber,
    startPos.column + columnOffsetRange.endExclusive
  );
}
function getIndentationSize(line, tabSize) {
  let currentSize = 0;
  loop: for (let i = 0, len = line.length; i < len; i++) {
    switch (line.charCodeAt(i)) {
      case CharCode.Tab:
        currentSize += tabSize;
        break;
      case CharCode.Space:
        currentSize++;
        break;
      default:
        break loop;
    }
  }
  return currentSize - currentSize % tabSize;
}
function indentSizeToIndentLength(line, indentSize, tabSize) {
  let remainingSize = indentSize - indentSize % tabSize;
  let i = 0;
  for (; i < line.length; i++) {
    if (remainingSize === 0) {
      break;
    }
    switch (line.charCodeAt(i)) {
      case CharCode.Tab:
        remainingSize -= tabSize;
        break;
      case CharCode.Space:
        remainingSize--;
        break;
      default:
        throw new BugIndicatingError("Unexpected character found while calculating indent length");
    }
  }
  return i;
}
function createReindentEdit(text, range, tabSize) {
  const newLines = splitLines(text);
  const edits = [];
  const minIndentSize = findFirstMin(range.mapToLineArray((l) => getIndentationSize(newLines[l - 1], tabSize)), numberComparator);
  range.forEach((lineNumber) => {
    const indentLength = indentSizeToIndentLength(newLines[lineNumber - 1], minIndentSize, tabSize);
    edits.push(new TextReplacement(offsetRangeToRange(new OffsetRange(0, indentLength), new Position(lineNumber, 1)), ""));
  });
  return new TextEdit(edits);
}
class PathBuilder {
  constructor() {
    this._data = "";
  }
  moveTo(point) {
    this._data += `M ${point.x} ${point.y} `;
    return this;
  }
  lineTo(point) {
    this._data += `L ${point.x} ${point.y} `;
    return this;
  }
  curveTo(cp, to) {
    this._data += `Q ${cp.x} ${cp.y} ${to.x} ${to.y} `;
    return this;
  }
  curveTo2(cp1, cp2, to) {
    this._data += `C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${to.x} ${to.y} `;
    return this;
  }
  build() {
    return this._data;
  }
}
function createRectangle(layout, padding, borderRadius, options = {}) {
  const topLeftInner = layout.topLeft;
  const topRightInner = topLeftInner.deltaX(layout.width);
  const bottomLeftInner = topLeftInner.deltaY(layout.height);
  const bottomRightInner = bottomLeftInner.deltaX(layout.width);
  const { top: paddingTop, bottom: paddingBottom, left: paddingLeft, right: paddingRight } = typeof padding === "number" ? { top: padding, bottom: padding, left: padding, right: padding } : padding;
  const { topLeft: radiusTL, topRight: radiusTR, bottomLeft: radiusBL, bottomRight: radiusBR } = typeof borderRadius === "number" ? { topLeft: borderRadius, topRight: borderRadius, bottomLeft: borderRadius, bottomRight: borderRadius } : borderRadius;
  const totalHeight = layout.height + paddingTop + paddingBottom;
  const totalWidth = layout.width + paddingLeft + paddingRight;
  const topLeft = topLeftInner.deltaX(-paddingLeft).deltaY(-paddingTop);
  const topRight = topRightInner.deltaX(paddingRight).deltaY(-paddingTop);
  const topLeftBefore = topLeft.deltaY(Math.min(radiusTL, totalHeight / 2));
  const topLeftAfter = topLeft.deltaX(Math.min(radiusTL, totalWidth / 2));
  const topRightBefore = topRight.deltaX(-Math.min(radiusTR, totalWidth / 2));
  const topRightAfter = topRight.deltaY(Math.min(radiusTR, totalHeight / 2));
  const bottomLeft = bottomLeftInner.deltaX(-paddingLeft).deltaY(paddingBottom);
  const bottomRight = bottomRightInner.deltaX(paddingRight).deltaY(paddingBottom);
  const bottomLeftBefore = bottomLeft.deltaX(Math.min(radiusBL, totalWidth / 2));
  const bottomLeftAfter = bottomLeft.deltaY(-Math.min(radiusBL, totalHeight / 2));
  const bottomRightBefore = bottomRight.deltaY(-Math.min(radiusBR, totalHeight / 2));
  const bottomRightAfter = bottomRight.deltaX(-Math.min(radiusBR, totalWidth / 2));
  const path = new PathBuilder();
  if (!options.hideLeft) {
    path.moveTo(bottomLeftAfter).lineTo(topLeftBefore);
  }
  if (!options.hideLeft && !options.hideTop) {
    path.curveTo(topLeft, topLeftAfter);
  } else {
    path.moveTo(topLeftAfter);
  }
  if (!options.hideTop) {
    path.lineTo(topRightBefore);
  }
  if (!options.hideTop && !options.hideRight) {
    path.curveTo(topRight, topRightAfter);
  } else {
    path.moveTo(topRightAfter);
  }
  if (!options.hideRight) {
    path.lineTo(bottomRightBefore);
  }
  if (!options.hideRight && !options.hideBottom) {
    path.curveTo(bottomRight, bottomRightAfter);
  } else {
    path.moveTo(bottomRightAfter);
  }
  if (!options.hideBottom) {
    path.lineTo(bottomLeftBefore);
  }
  if (!options.hideBottom && !options.hideLeft) {
    path.curveTo(bottomLeft, bottomLeftAfter);
  } else {
    path.moveTo(bottomLeftAfter);
  }
  return path.build();
}
function mapOutFalsy(obs) {
  const nonUndefinedObs = derivedObservableWithCache(void 0, (reader, lastValue) => obs.read(reader) || lastValue);
  return derivedOpts({
    debugName: () => `${obs.debugName}.mapOutFalsy`
  }, (reader) => {
    nonUndefinedObs.read(reader);
    const val = obs.read(reader);
    if (!val) {
      return void 0;
    }
    return nonUndefinedObs;
  });
}
function observeElementPosition(element, store) {
  const topLeft = getDomNodePagePosition(element);
  const top = observableValue("top", topLeft.top);
  const left = observableValue("left", topLeft.left);
  const resizeObserver = new ResizeObserver(() => {
    transaction((tx) => {
      const topLeft2 = getDomNodePagePosition(element);
      top.set(topLeft2.top, tx);
      left.set(topLeft2.left, tx);
    });
  });
  resizeObserver.observe(element);
  store.add(toDisposable(() => resizeObserver.disconnect()));
  return {
    top,
    left
  };
}
function rectToProps(fn, debugLocation = DebugLocation.ofCaller()) {
  return {
    left: derived({ name: "editor.validOverlay.left" }, (reader) => (
      /** @description left */
      fn(reader)?.left
    ), debugLocation),
    top: derived({ name: "editor.validOverlay.top" }, (reader) => (
      /** @description top */
      fn(reader)?.top
    ), debugLocation),
    width: derived({ name: "editor.validOverlay.width" }, (reader) => {
      const val = fn(reader);
      if (!val) {
        return void 0;
      }
      return val.width;
    }, debugLocation),
    height: derived({ name: "editor.validOverlay.height" }, (reader) => {
      const val = fn(reader);
      if (!val) {
        return void 0;
      }
      return val.height;
    }, debugLocation)
  };
}
function observeEditorBoundingClientRect(editor, store) {
  const dom = editor.getContainerDomNode();
  const initialDomRect = observableValue("domRect", dom.getBoundingClientRect());
  store.add(editor.onDidLayoutChange((e) => {
    initialDomRect.set(dom.getBoundingClientRect(), void 0);
  }));
  return initialDomRect;
}
export {
  PathBuilder,
  StatusBarViewItem,
  UniqueUriGenerator,
  applyEditToModifiedRangeMappings,
  classNames,
  createRectangle,
  createReindentEdit,
  getContentRenderWidth,
  getContentSizeOfLines,
  getEditorValidOverlayRect,
  getOffsetForPos,
  getPrefixTrim,
  mapOutFalsy,
  maxContentWidthInRange,
  observeEditorBoundingClientRect,
  observeElementPosition,
  rectToProps
};
