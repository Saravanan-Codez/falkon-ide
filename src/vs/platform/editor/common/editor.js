import { equals } from "../../../base/common/arrays.js";
function isResolvedEditorModel(model) {
  const candidate = model;
  return typeof candidate?.resolve === "function" && typeof candidate?.isResolved === "function";
}
var EditorActivation = /* @__PURE__ */ ((EditorActivation2) => {
  EditorActivation2[EditorActivation2["ACTIVATE"] = 1] = "ACTIVATE";
  EditorActivation2[EditorActivation2["RESTORE"] = 2] = "RESTORE";
  EditorActivation2[EditorActivation2["PRESERVE"] = 3] = "PRESERVE";
  return EditorActivation2;
})(EditorActivation || {});
var EditorResolution = /* @__PURE__ */ ((EditorResolution2) => {
  EditorResolution2[EditorResolution2["PICK"] = 0] = "PICK";
  EditorResolution2[EditorResolution2["EXCLUSIVE_ONLY"] = 1] = "EXCLUSIVE_ONLY";
  return EditorResolution2;
})(EditorResolution || {});
var EditorOpenSource = /* @__PURE__ */ ((EditorOpenSource2) => {
  EditorOpenSource2[EditorOpenSource2["API"] = 0] = "API";
  EditorOpenSource2[EditorOpenSource2["USER"] = 1] = "USER";
  return EditorOpenSource2;
})(EditorOpenSource || {});
function isModalEditorOptionsProvider(obj) {
  return !!obj && typeof obj.getModalEditorOptions === "function";
}
var TextEditorSelectionRevealType = /* @__PURE__ */ ((TextEditorSelectionRevealType2) => {
  TextEditorSelectionRevealType2[TextEditorSelectionRevealType2["Center"] = 0] = "Center";
  TextEditorSelectionRevealType2[TextEditorSelectionRevealType2["CenterIfOutsideViewport"] = 1] = "CenterIfOutsideViewport";
  TextEditorSelectionRevealType2[TextEditorSelectionRevealType2["NearTop"] = 2] = "NearTop";
  TextEditorSelectionRevealType2[TextEditorSelectionRevealType2["NearTopIfOutsideViewport"] = 3] = "NearTopIfOutsideViewport";
  return TextEditorSelectionRevealType2;
})(TextEditorSelectionRevealType || {});
var TextEditorSelectionSource = /* @__PURE__ */ ((TextEditorSelectionSource2) => {
  TextEditorSelectionSource2["PROGRAMMATIC"] = "api";
  TextEditorSelectionSource2["NAVIGATION"] = "code.navigation";
  TextEditorSelectionSource2["JUMP"] = "code.jump";
  return TextEditorSelectionSource2;
})(TextEditorSelectionSource || {});
function isTextEditorDiffInformationEqual(uriIdentityService, diff1, diff2) {
  return diff1?.documentVersion === diff2?.documentVersion && uriIdentityService.extUri.isEqual(diff1?.original, diff2?.original) && uriIdentityService.extUri.isEqual(diff1?.modified, diff2?.modified) && equals(diff1?.changes, diff2?.changes, (a, b) => {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
  });
}
export {
  EditorActivation,
  EditorOpenSource,
  EditorResolution,
  TextEditorSelectionRevealType,
  TextEditorSelectionSource,
  isModalEditorOptionsProvider,
  isResolvedEditorModel,
  isTextEditorDiffInformationEqual
};
