import { Codicon } from "../../../../../base/common/codicons.js";
import { Schemas } from "../../../../../base/common/network.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { registerIcon } from "../../../../../platform/theme/common/iconRegistry.js";
import { EditorInputCapabilities } from "../../../../common/editor.js";
import { EditorInput } from "../../../../common/editor/editorInput.js";
import { AgentPluginItemKind } from "./agentPluginItems.js";
const AgentPluginEditorIcon = registerIcon("agent-plugin-editor-icon", Codicon.extensions, localize("agentPluginEditorLabelIcon", "Icon of the Agent Plugin editor."));
function getPluginId(item) {
  if (item.kind === AgentPluginItemKind.Installed) {
    return item.plugin.uri.toString();
  }
  return `${item.marketplaceReference.canonicalId}/${item.source}`;
}
class AgentPluginEditorInput extends EditorInput {
  constructor(_item) {
    super();
    this._item = _item;
  }
  static {
    this.ID = "workbench.agentPlugin.input";
  }
  get typeId() {
    return AgentPluginEditorInput.ID;
  }
  get capabilities() {
    return super.capabilities | EditorInputCapabilities.Singleton | EditorInputCapabilities.RequiresModal;
  }
  get resource() {
    return URI.from({
      scheme: Schemas.extension,
      path: `/agentPlugin/${encodeURIComponent(getPluginId(this._item))}`
    });
  }
  get item() {
    return this._item;
  }
  getName() {
    return localize("agentPluginInputName", "Plugin: {0}", this._item.name);
  }
  getIcon() {
    return AgentPluginEditorIcon;
  }
  matches(other) {
    if (super.matches(other)) {
      return true;
    }
    return other instanceof AgentPluginEditorInput && getPluginId(this._item) === getPluginId(other._item);
  }
}
export {
  AgentPluginEditorInput
};
