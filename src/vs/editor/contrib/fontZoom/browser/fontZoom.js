import { EditorAction, registerEditorAction } from "../../../browser/editorExtensions.js";
import { EditorZoom } from "../../../common/config/editorZoom.js";
import * as nls from "../../../../nls.js";
class EditorFontZoomIn extends EditorAction {
  constructor() {
    super({
      id: "editor.action.fontZoomIn",
      label: nls.localize2("EditorFontZoomIn.label", "Increase Editor Font Size"),
      precondition: void 0
    });
  }
  run(accessor, editor) {
    EditorZoom.setZoomLevel(EditorZoom.getZoomLevel() + 1);
  }
}
class EditorFontZoomOut extends EditorAction {
  constructor() {
    super({
      id: "editor.action.fontZoomOut",
      label: nls.localize2("EditorFontZoomOut.label", "Decrease Editor Font Size"),
      precondition: void 0
    });
  }
  run(accessor, editor) {
    EditorZoom.setZoomLevel(EditorZoom.getZoomLevel() - 1);
  }
}
class EditorFontZoomReset extends EditorAction {
  constructor() {
    super({
      id: "editor.action.fontZoomReset",
      label: nls.localize2("EditorFontZoomReset.label", "Reset Editor Font Size"),
      precondition: void 0
    });
  }
  run(accessor, editor) {
    EditorZoom.setZoomLevel(0);
  }
}
registerEditorAction(EditorFontZoomIn);
registerEditorAction(EditorFontZoomOut);
registerEditorAction(EditorFontZoomReset);
