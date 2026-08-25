var ViewEventType = /* @__PURE__ */ ((ViewEventType2) => {
  ViewEventType2[ViewEventType2["ViewCompositionStart"] = 0] = "ViewCompositionStart";
  ViewEventType2[ViewEventType2["ViewCompositionEnd"] = 1] = "ViewCompositionEnd";
  ViewEventType2[ViewEventType2["ViewConfigurationChanged"] = 2] = "ViewConfigurationChanged";
  ViewEventType2[ViewEventType2["ViewCursorStateChanged"] = 3] = "ViewCursorStateChanged";
  ViewEventType2[ViewEventType2["ViewDecorationsChanged"] = 4] = "ViewDecorationsChanged";
  ViewEventType2[ViewEventType2["ViewFlushed"] = 5] = "ViewFlushed";
  ViewEventType2[ViewEventType2["ViewFocusChanged"] = 6] = "ViewFocusChanged";
  ViewEventType2[ViewEventType2["ViewLanguageConfigurationChanged"] = 7] = "ViewLanguageConfigurationChanged";
  ViewEventType2[ViewEventType2["ViewLineMappingChanged"] = 8] = "ViewLineMappingChanged";
  ViewEventType2[ViewEventType2["ViewLinesChanged"] = 9] = "ViewLinesChanged";
  ViewEventType2[ViewEventType2["ViewLinesDeleted"] = 10] = "ViewLinesDeleted";
  ViewEventType2[ViewEventType2["ViewLinesInserted"] = 11] = "ViewLinesInserted";
  ViewEventType2[ViewEventType2["ViewRevealRangeRequest"] = 12] = "ViewRevealRangeRequest";
  ViewEventType2[ViewEventType2["ViewScrollChanged"] = 13] = "ViewScrollChanged";
  ViewEventType2[ViewEventType2["ViewThemeChanged"] = 14] = "ViewThemeChanged";
  ViewEventType2[ViewEventType2["ViewTokensChanged"] = 15] = "ViewTokensChanged";
  ViewEventType2[ViewEventType2["ViewTokensColorsChanged"] = 16] = "ViewTokensColorsChanged";
  ViewEventType2[ViewEventType2["ViewZonesChanged"] = 17] = "ViewZonesChanged";
  return ViewEventType2;
})(ViewEventType || {});
class ViewCompositionStartEvent {
  constructor() {
    this.type = 0 /* ViewCompositionStart */;
  }
}
class ViewCompositionEndEvent {
  constructor() {
    this.type = 1 /* ViewCompositionEnd */;
  }
}
class ViewConfigurationChangedEvent {
  constructor(source) {
    this.type = 2 /* ViewConfigurationChanged */;
    this._source = source;
  }
  hasChanged(id) {
    return this._source.hasChanged(id);
  }
}
class ViewCursorStateChangedEvent {
  constructor(selections, modelSelections, reason) {
    this.selections = selections;
    this.modelSelections = modelSelections;
    this.reason = reason;
    this.type = 3 /* ViewCursorStateChanged */;
  }
}
class ViewDecorationsChangedEvent {
  constructor(source) {
    this.type = 4 /* ViewDecorationsChanged */;
    if (source) {
      this.affectsMinimap = source.affectsMinimap;
      this.affectsOverviewRuler = source.affectsOverviewRuler;
      this.affectsGlyphMargin = source.affectsGlyphMargin;
      this.affectsLineNumber = source.affectsLineNumber;
    } else {
      this.affectsMinimap = true;
      this.affectsOverviewRuler = true;
      this.affectsGlyphMargin = true;
      this.affectsLineNumber = true;
    }
  }
}
class ViewFlushedEvent {
  constructor() {
    this.type = 5 /* ViewFlushed */;
  }
}
class ViewFocusChangedEvent {
  constructor(isFocused) {
    this.type = 6 /* ViewFocusChanged */;
    this.isFocused = isFocused;
  }
}
class ViewLanguageConfigurationEvent {
  constructor() {
    this.type = 7 /* ViewLanguageConfigurationChanged */;
  }
}
class ViewLineMappingChangedEvent {
  constructor() {
    this.type = 8 /* ViewLineMappingChanged */;
  }
}
class ViewLinesChangedEvent {
  constructor(fromLineNumber, count) {
    this.fromLineNumber = fromLineNumber;
    this.count = count;
    this.type = 9 /* ViewLinesChanged */;
  }
}
class ViewLinesDeletedEvent {
  constructor(fromLineNumber, toLineNumber) {
    this.type = 10 /* ViewLinesDeleted */;
    this.fromLineNumber = fromLineNumber;
    this.toLineNumber = toLineNumber;
  }
}
class ViewLinesInsertedEvent {
  constructor(fromLineNumber, toLineNumber) {
    this.type = 11 /* ViewLinesInserted */;
    this.fromLineNumber = fromLineNumber;
    this.toLineNumber = toLineNumber;
  }
}
var VerticalRevealType = /* @__PURE__ */ ((VerticalRevealType2) => {
  VerticalRevealType2[VerticalRevealType2["Simple"] = 0] = "Simple";
  VerticalRevealType2[VerticalRevealType2["Center"] = 1] = "Center";
  VerticalRevealType2[VerticalRevealType2["CenterIfOutsideViewport"] = 2] = "CenterIfOutsideViewport";
  VerticalRevealType2[VerticalRevealType2["Top"] = 3] = "Top";
  VerticalRevealType2[VerticalRevealType2["Bottom"] = 4] = "Bottom";
  VerticalRevealType2[VerticalRevealType2["NearTop"] = 5] = "NearTop";
  VerticalRevealType2[VerticalRevealType2["NearTopIfOutsideViewport"] = 6] = "NearTopIfOutsideViewport";
  return VerticalRevealType2;
})(VerticalRevealType || {});
class ViewRevealRangeRequestEvent {
  constructor(source, minimalReveal, range, selections, verticalType, revealHorizontal, scrollType) {
    this.source = source;
    this.minimalReveal = minimalReveal;
    this.range = range;
    this.selections = selections;
    this.verticalType = verticalType;
    this.revealHorizontal = revealHorizontal;
    this.scrollType = scrollType;
    this.type = 12 /* ViewRevealRangeRequest */;
  }
}
class ViewScrollChangedEvent {
  constructor(source) {
    this.type = 13 /* ViewScrollChanged */;
    this.scrollWidth = source.scrollWidth;
    this.scrollLeft = source.scrollLeft;
    this.scrollHeight = source.scrollHeight;
    this.scrollTop = source.scrollTop;
    this.scrollWidthChanged = source.scrollWidthChanged;
    this.scrollLeftChanged = source.scrollLeftChanged;
    this.scrollHeightChanged = source.scrollHeightChanged;
    this.scrollTopChanged = source.scrollTopChanged;
  }
}
class ViewThemeChangedEvent {
  constructor(theme) {
    this.theme = theme;
    this.type = 14 /* ViewThemeChanged */;
  }
}
class ViewTokensChangedEvent {
  constructor(ranges) {
    this.type = 15 /* ViewTokensChanged */;
    this.ranges = ranges;
  }
}
class ViewTokensColorsChangedEvent {
  constructor() {
    this.type = 16 /* ViewTokensColorsChanged */;
  }
}
class ViewZonesChangedEvent {
  constructor() {
    this.type = 17 /* ViewZonesChanged */;
  }
}
export {
  VerticalRevealType,
  ViewCompositionEndEvent,
  ViewCompositionStartEvent,
  ViewConfigurationChangedEvent,
  ViewCursorStateChangedEvent,
  ViewDecorationsChangedEvent,
  ViewEventType,
  ViewFlushedEvent,
  ViewFocusChangedEvent,
  ViewLanguageConfigurationEvent,
  ViewLineMappingChangedEvent,
  ViewLinesChangedEvent,
  ViewLinesDeletedEvent,
  ViewLinesInsertedEvent,
  ViewRevealRangeRequestEvent,
  ViewScrollChangedEvent,
  ViewThemeChangedEvent,
  ViewTokensChangedEvent,
  ViewTokensColorsChangedEvent,
  ViewZonesChangedEvent
};
