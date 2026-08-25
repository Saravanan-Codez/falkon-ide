var ScrollType = /* @__PURE__ */ ((ScrollType2) => {
  ScrollType2[ScrollType2["Smooth"] = 0] = "Smooth";
  ScrollType2[ScrollType2["Immediate"] = 1] = "Immediate";
  return ScrollType2;
})(ScrollType || {});
function isThemeColor(o) {
  return !!o && typeof o.id === "string";
}
const EditorType = {
  ICodeEditor: "vs.editor.ICodeEditor",
  IDiffEditor: "vs.editor.IDiffEditor"
};
var Handler = /* @__PURE__ */ ((Handler2) => {
  Handler2["CompositionStart"] = "compositionStart";
  Handler2["CompositionEnd"] = "compositionEnd";
  Handler2["Type"] = "type";
  Handler2["ReplacePreviousChar"] = "replacePreviousChar";
  Handler2["CompositionType"] = "compositionType";
  Handler2["Paste"] = "paste";
  Handler2["Cut"] = "cut";
  return Handler2;
})(Handler || {});
export {
  EditorType,
  Handler,
  ScrollType,
  isThemeColor
};
