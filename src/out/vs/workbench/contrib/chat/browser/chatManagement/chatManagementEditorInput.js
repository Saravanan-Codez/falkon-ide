import { Codicon } from "../../../../../base/common/codicons.js";
import * as nls from "../../../../../nls.js";
import { registerIcon } from "../../../../../platform/theme/common/iconRegistry.js";
import { EditorInputCapabilities } from "../../../../common/editor.js";
import { EditorInput } from "../../../../common/editor/editorInput.js";
const ModelsManagementEditorIcon = registerIcon("models-management-editor-label-icon", Codicon.settings, nls.localize("modelsManagementEditorLabelIcon", "Icon of the Models Management editor label."));
class ModelsManagementEditorInput extends EditorInput {
  constructor() {
    super();
    this.resource = void 0;
  }
  static {
    this.ID = "workbench.input.modelsManagement";
  }
  get capabilities() {
    return super.capabilities | EditorInputCapabilities.Singleton | EditorInputCapabilities.RequiresModal;
  }
  matches(otherInput) {
    return super.matches(otherInput) || otherInput instanceof ModelsManagementEditorInput;
  }
  get typeId() {
    return ModelsManagementEditorInput.ID;
  }
  getName() {
    return nls.localize("modelsManagementEditorInputName", "Language Models");
  }
  getIcon() {
    return ModelsManagementEditorIcon;
  }
  async resolve() {
    return null;
  }
}
export {
  ModelsManagementEditorInput
};
