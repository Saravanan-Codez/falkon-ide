import { equals } from "../../base/common/objects.js";
var OverviewRulerLane = /* @__PURE__ */ ((OverviewRulerLane2) => {
  OverviewRulerLane2[OverviewRulerLane2["Left"] = 1] = "Left";
  OverviewRulerLane2[OverviewRulerLane2["Center"] = 2] = "Center";
  OverviewRulerLane2[OverviewRulerLane2["Right"] = 4] = "Right";
  OverviewRulerLane2[OverviewRulerLane2["Full"] = 7] = "Full";
  return OverviewRulerLane2;
})(OverviewRulerLane || {});
var GlyphMarginLane = /* @__PURE__ */ ((GlyphMarginLane2) => {
  GlyphMarginLane2[GlyphMarginLane2["Left"] = 1] = "Left";
  GlyphMarginLane2[GlyphMarginLane2["Center"] = 2] = "Center";
  GlyphMarginLane2[GlyphMarginLane2["Right"] = 3] = "Right";
  return GlyphMarginLane2;
})(GlyphMarginLane || {});
var MinimapPosition = /* @__PURE__ */ ((MinimapPosition2) => {
  MinimapPosition2[MinimapPosition2["Inline"] = 1] = "Inline";
  MinimapPosition2[MinimapPosition2["Gutter"] = 2] = "Gutter";
  return MinimapPosition2;
})(MinimapPosition || {});
var MinimapSectionHeaderStyle = /* @__PURE__ */ ((MinimapSectionHeaderStyle2) => {
  MinimapSectionHeaderStyle2[MinimapSectionHeaderStyle2["Normal"] = 1] = "Normal";
  MinimapSectionHeaderStyle2[MinimapSectionHeaderStyle2["Underlined"] = 2] = "Underlined";
  return MinimapSectionHeaderStyle2;
})(MinimapSectionHeaderStyle || {});
var TextDirection = /* @__PURE__ */ ((TextDirection2) => {
  TextDirection2[TextDirection2["LTR"] = 0] = "LTR";
  TextDirection2[TextDirection2["RTL"] = 1] = "RTL";
  return TextDirection2;
})(TextDirection || {});
var InjectedTextCursorStops = /* @__PURE__ */ ((InjectedTextCursorStops2) => {
  InjectedTextCursorStops2[InjectedTextCursorStops2["Both"] = 0] = "Both";
  InjectedTextCursorStops2[InjectedTextCursorStops2["Right"] = 1] = "Right";
  InjectedTextCursorStops2[InjectedTextCursorStops2["Left"] = 2] = "Left";
  InjectedTextCursorStops2[InjectedTextCursorStops2["None"] = 3] = "None";
  return InjectedTextCursorStops2;
})(InjectedTextCursorStops || {});
var EndOfLinePreference = /* @__PURE__ */ ((EndOfLinePreference2) => {
  EndOfLinePreference2[EndOfLinePreference2["TextDefined"] = 0] = "TextDefined";
  EndOfLinePreference2[EndOfLinePreference2["LF"] = 1] = "LF";
  EndOfLinePreference2[EndOfLinePreference2["CRLF"] = 2] = "CRLF";
  return EndOfLinePreference2;
})(EndOfLinePreference || {});
var DefaultEndOfLine = /* @__PURE__ */ ((DefaultEndOfLine2) => {
  DefaultEndOfLine2[DefaultEndOfLine2["LF"] = 1] = "LF";
  DefaultEndOfLine2[DefaultEndOfLine2["CRLF"] = 2] = "CRLF";
  return DefaultEndOfLine2;
})(DefaultEndOfLine || {});
var EndOfLineSequence = /* @__PURE__ */ ((EndOfLineSequence2) => {
  EndOfLineSequence2[EndOfLineSequence2["LF"] = 0] = "LF";
  EndOfLineSequence2[EndOfLineSequence2["CRLF"] = 1] = "CRLF";
  return EndOfLineSequence2;
})(EndOfLineSequence || {});
class TextModelResolvedOptions {
  /**
   * @internal
   */
  constructor(src) {
    this._textModelResolvedOptionsBrand = void 0;
    this.tabSize = Math.max(1, src.tabSize | 0);
    if (src.indentSize === "tabSize") {
      this.indentSize = this.tabSize;
      this._indentSizeIsTabSize = true;
    } else {
      this.indentSize = Math.max(1, src.indentSize | 0);
      this._indentSizeIsTabSize = false;
    }
    this.insertSpaces = Boolean(src.insertSpaces);
    this.defaultEOL = src.defaultEOL | 0;
    this.trimAutoWhitespace = Boolean(src.trimAutoWhitespace);
    this.bracketPairColorizationOptions = src.bracketPairColorizationOptions;
  }
  get originalIndentSize() {
    return this._indentSizeIsTabSize ? "tabSize" : this.indentSize;
  }
  /**
   * @internal
   */
  equals(other) {
    return this.tabSize === other.tabSize && this._indentSizeIsTabSize === other._indentSizeIsTabSize && this.indentSize === other.indentSize && this.insertSpaces === other.insertSpaces && this.defaultEOL === other.defaultEOL && this.trimAutoWhitespace === other.trimAutoWhitespace && equals(this.bracketPairColorizationOptions, other.bracketPairColorizationOptions);
  }
  /**
   * @internal
   */
  createChangeEvent(newOpts) {
    return {
      tabSize: this.tabSize !== newOpts.tabSize,
      indentSize: this.indentSize !== newOpts.indentSize,
      insertSpaces: this.insertSpaces !== newOpts.insertSpaces,
      trimAutoWhitespace: this.trimAutoWhitespace !== newOpts.trimAutoWhitespace
    };
  }
}
class FindMatch {
  /**
   * @internal
   */
  constructor(range, matches) {
    this._findMatchBrand = void 0;
    this.range = range;
    this.matches = matches;
  }
}
var TrackedRangeStickiness = /* @__PURE__ */ ((TrackedRangeStickiness2) => {
  TrackedRangeStickiness2[TrackedRangeStickiness2["AlwaysGrowsWhenTypingAtEdges"] = 0] = "AlwaysGrowsWhenTypingAtEdges";
  TrackedRangeStickiness2[TrackedRangeStickiness2["NeverGrowsWhenTypingAtEdges"] = 1] = "NeverGrowsWhenTypingAtEdges";
  TrackedRangeStickiness2[TrackedRangeStickiness2["GrowsOnlyWhenTypingBefore"] = 2] = "GrowsOnlyWhenTypingBefore";
  TrackedRangeStickiness2[TrackedRangeStickiness2["GrowsOnlyWhenTypingAfter"] = 3] = "GrowsOnlyWhenTypingAfter";
  return TrackedRangeStickiness2;
})(TrackedRangeStickiness || {});
function isITextSnapshot(obj) {
  return !!obj && typeof obj.read === "function";
}
function isITextModel(obj) {
  return Boolean(obj && obj.uri);
}
var PositionAffinity = /* @__PURE__ */ ((PositionAffinity2) => {
  PositionAffinity2[PositionAffinity2["Left"] = 0] = "Left";
  PositionAffinity2[PositionAffinity2["Right"] = 1] = "Right";
  PositionAffinity2[PositionAffinity2["None"] = 2] = "None";
  PositionAffinity2[PositionAffinity2["LeftOfInjectedText"] = 3] = "LeftOfInjectedText";
  PositionAffinity2[PositionAffinity2["RightOfInjectedText"] = 4] = "RightOfInjectedText";
  return PositionAffinity2;
})(PositionAffinity || {});
var ModelConstants = /* @__PURE__ */ ((ModelConstants2) => {
  ModelConstants2[ModelConstants2["FIRST_LINE_DETECTION_LENGTH_LIMIT"] = 1e3] = "FIRST_LINE_DETECTION_LENGTH_LIMIT";
  return ModelConstants2;
})(ModelConstants || {});
class ValidAnnotatedEditOperation {
  constructor(identifier, range, text, forceMoveMarkers, isAutoWhitespaceEdit, _isTracked) {
    this.identifier = identifier;
    this.range = range;
    this.text = text;
    this.forceMoveMarkers = forceMoveMarkers;
    this.isAutoWhitespaceEdit = isAutoWhitespaceEdit;
    this._isTracked = _isTracked;
  }
}
class SearchData {
  constructor(regex, wordSeparators, simpleSearch) {
    this.regex = regex;
    this.wordSeparators = wordSeparators;
    this.simpleSearch = simpleSearch;
  }
}
class ApplyEditsResult {
  constructor(reverseEdits, changes, trimAutoWhitespaceLineNumbers) {
    this.reverseEdits = reverseEdits;
    this.changes = changes;
    this.trimAutoWhitespaceLineNumbers = trimAutoWhitespaceLineNumbers;
  }
}
function shouldSynchronizeModel(model) {
  return !model.isTooLargeForSyncing() && !model.isForSimpleWidget;
}
export {
  ApplyEditsResult,
  DefaultEndOfLine,
  EndOfLinePreference,
  EndOfLineSequence,
  FindMatch,
  GlyphMarginLane,
  InjectedTextCursorStops,
  MinimapPosition,
  MinimapSectionHeaderStyle,
  ModelConstants,
  OverviewRulerLane,
  PositionAffinity,
  SearchData,
  TextDirection,
  TextModelResolvedOptions,
  TrackedRangeStickiness,
  ValidAnnotatedEditOperation,
  isITextModel,
  isITextSnapshot,
  shouldSynchronizeModel
};
