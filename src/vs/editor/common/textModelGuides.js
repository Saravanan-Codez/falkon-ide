var HorizontalGuidesState = /* @__PURE__ */ ((HorizontalGuidesState2) => {
  HorizontalGuidesState2[HorizontalGuidesState2["Disabled"] = 0] = "Disabled";
  HorizontalGuidesState2[HorizontalGuidesState2["EnabledForActive"] = 1] = "EnabledForActive";
  HorizontalGuidesState2[HorizontalGuidesState2["Enabled"] = 2] = "Enabled";
  return HorizontalGuidesState2;
})(HorizontalGuidesState || {});
class IndentGuide {
  constructor(visibleColumn, column, className, horizontalLine, forWrappedLinesAfterColumn, forWrappedLinesBeforeOrAtColumn) {
    this.visibleColumn = visibleColumn;
    this.column = column;
    this.className = className;
    this.horizontalLine = horizontalLine;
    this.forWrappedLinesAfterColumn = forWrappedLinesAfterColumn;
    this.forWrappedLinesBeforeOrAtColumn = forWrappedLinesBeforeOrAtColumn;
    if (visibleColumn !== -1 === (column !== -1)) {
      throw new Error();
    }
  }
}
class IndentGuideHorizontalLine {
  constructor(top, endColumn) {
    this.top = top;
    this.endColumn = endColumn;
  }
}
export {
  HorizontalGuidesState,
  IndentGuide,
  IndentGuideHorizontalLine
};
