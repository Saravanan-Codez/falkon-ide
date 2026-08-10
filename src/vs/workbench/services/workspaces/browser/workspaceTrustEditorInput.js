import { Codicon } from "../../../../base/common/codicons.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { EditorInputCapabilities } from "../../../common/editor.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
const WorkspaceTrustEditorIcon = registerIcon("workspace-trust-editor-label-icon", Codicon.shield, localize("workspaceTrustEditorLabelIcon", "Icon of the workspace trust editor label."));
class WorkspaceTrustEditorInput extends EditorInput {
  constructor() {
    super(...arguments);
    this.resource = URI.from({
      scheme: Schemas.vscodeWorkspaceTrust,
      path: `workspaceTrustEditor`
    });
  }
  static {
    this.ID = "workbench.input.workspaceTrust";
  }
  get capabilities() {
    return super.capabilities | EditorInputCapabilities.Singleton | EditorInputCapabilities.RequiresModal;
  }
  get typeId() {
    return WorkspaceTrustEditorInput.ID;
  }
  matches(otherInput) {
    return super.matches(otherInput) || otherInput instanceof WorkspaceTrustEditorInput;
  }
  getName() {
    return localize("workspaceTrustEditorInputName", "Workspace Trust");
  }
  getIcon() {
    return WorkspaceTrustEditorIcon;
  }
}
export {
  WorkspaceTrustEditorInput
};
