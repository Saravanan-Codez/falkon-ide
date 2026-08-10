import * as editorCommon from "../common/editorCommon.js";
var ContentWidgetPositionPreference = /* @__PURE__ */ ((ContentWidgetPositionPreference2) => {
  ContentWidgetPositionPreference2[ContentWidgetPositionPreference2["EXACT"] = 0] = "EXACT";
  ContentWidgetPositionPreference2[ContentWidgetPositionPreference2["ABOVE"] = 1] = "ABOVE";
  ContentWidgetPositionPreference2[ContentWidgetPositionPreference2["BELOW"] = 2] = "BELOW";
  return ContentWidgetPositionPreference2;
})(ContentWidgetPositionPreference || {});
var OverlayWidgetPositionPreference = /* @__PURE__ */ ((OverlayWidgetPositionPreference2) => {
  OverlayWidgetPositionPreference2[OverlayWidgetPositionPreference2["TOP_RIGHT_CORNER"] = 0] = "TOP_RIGHT_CORNER";
  OverlayWidgetPositionPreference2[OverlayWidgetPositionPreference2["BOTTOM_RIGHT_CORNER"] = 1] = "BOTTOM_RIGHT_CORNER";
  OverlayWidgetPositionPreference2[OverlayWidgetPositionPreference2["TOP_CENTER"] = 2] = "TOP_CENTER";
  return OverlayWidgetPositionPreference2;
})(OverlayWidgetPositionPreference || {});
var MouseTargetType = /* @__PURE__ */ ((MouseTargetType2) => {
  MouseTargetType2[MouseTargetType2["UNKNOWN"] = 0] = "UNKNOWN";
  MouseTargetType2[MouseTargetType2["TEXTAREA"] = 1] = "TEXTAREA";
  MouseTargetType2[MouseTargetType2["GUTTER_GLYPH_MARGIN"] = 2] = "GUTTER_GLYPH_MARGIN";
  MouseTargetType2[MouseTargetType2["GUTTER_LINE_NUMBERS"] = 3] = "GUTTER_LINE_NUMBERS";
  MouseTargetType2[MouseTargetType2["GUTTER_LINE_DECORATIONS"] = 4] = "GUTTER_LINE_DECORATIONS";
  MouseTargetType2[MouseTargetType2["GUTTER_VIEW_ZONE"] = 5] = "GUTTER_VIEW_ZONE";
  MouseTargetType2[MouseTargetType2["CONTENT_TEXT"] = 6] = "CONTENT_TEXT";
  MouseTargetType2[MouseTargetType2["CONTENT_EMPTY"] = 7] = "CONTENT_EMPTY";
  MouseTargetType2[MouseTargetType2["CONTENT_VIEW_ZONE"] = 8] = "CONTENT_VIEW_ZONE";
  MouseTargetType2[MouseTargetType2["CONTENT_WIDGET"] = 9] = "CONTENT_WIDGET";
  MouseTargetType2[MouseTargetType2["OVERVIEW_RULER"] = 10] = "OVERVIEW_RULER";
  MouseTargetType2[MouseTargetType2["SCROLLBAR"] = 11] = "SCROLLBAR";
  MouseTargetType2[MouseTargetType2["OVERLAY_WIDGET"] = 12] = "OVERLAY_WIDGET";
  MouseTargetType2[MouseTargetType2["OUTSIDE_EDITOR"] = 13] = "OUTSIDE_EDITOR";
  return MouseTargetType2;
})(MouseTargetType || {});
var DiffEditorState = /* @__PURE__ */ ((DiffEditorState2) => {
  DiffEditorState2[DiffEditorState2["Idle"] = 0] = "Idle";
  DiffEditorState2[DiffEditorState2["ComputingDiff"] = 1] = "ComputingDiff";
  DiffEditorState2[DiffEditorState2["DiffComputed"] = 2] = "DiffComputed";
  return DiffEditorState2;
})(DiffEditorState || {});
function isCodeEditor(thing) {
  if (thing && typeof thing.getEditorType === "function") {
    return thing.getEditorType() === editorCommon.EditorType.ICodeEditor;
  } else {
    return false;
  }
}
function isDiffEditor(thing) {
  if (thing && typeof thing.getEditorType === "function") {
    return thing.getEditorType() === editorCommon.EditorType.IDiffEditor;
  } else {
    return false;
  }
}
function isCompositeEditor(thing) {
  return !!thing && typeof thing === "object" && typeof thing.onDidChangeActiveEditor === "function";
}
function getCodeEditor(thing) {
  if (isCodeEditor(thing)) {
    return thing;
  }
  if (isDiffEditor(thing)) {
    return thing.getModifiedEditor();
  }
  if (isCompositeEditor(thing) && isCodeEditor(thing.activeCodeEditor)) {
    return thing.activeCodeEditor;
  }
  return null;
}
function getIEditor(thing) {
  if (isCodeEditor(thing) || isDiffEditor(thing)) {
    return thing;
  }
  return null;
}
function isIOverlayWidgetPositionCoordinates(thing) {
  return !!thing && typeof thing === "object" && typeof thing.top === "number" && typeof thing.left === "number";
}
export {
  ContentWidgetPositionPreference,
  DiffEditorState,
  MouseTargetType,
  OverlayWidgetPositionPreference,
  getCodeEditor,
  getIEditor,
  isCodeEditor,
  isCompositeEditor,
  isDiffEditor,
  isIOverlayWidgetPositionCoordinates
};
