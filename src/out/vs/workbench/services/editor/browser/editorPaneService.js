import { IEditorPaneService } from "../common/editorPaneService.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
class EditorPaneService {
  constructor() {
    this.onWillInstantiateEditorPane = EditorPaneDescriptor.onWillInstantiateEditorPane;
  }
  didInstantiateEditorPane(typeId) {
    return EditorPaneDescriptor.didInstantiateEditorPane(typeId);
  }
}
registerSingleton(IEditorPaneService, EditorPaneService, InstantiationType.Delayed);
export {
  EditorPaneService
};
