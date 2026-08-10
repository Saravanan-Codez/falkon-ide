import { EditorInput } from "../../workbench/common/editor/editorInput.js";
import { EditorInputCapabilities } from "../../workbench/common/editor.js";
class DockedEditorInput extends EditorInput {
  get capabilities() {
    return EditorInputCapabilities.ExcludeFromEditorLimit;
  }
}
export {
  DockedEditorInput
};
